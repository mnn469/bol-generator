import path from "path";
import { prisma } from "@/lib/prisma";
import { createBolPdf } from "@/lib/pdf/createBolPdf";
import type { BolRecord } from "@prisma/client";
import type { FormData, TextStyle } from "@/lib/pdf/fieldTypes";

const STORAGE_ROOT = path.join(process.cwd(), "storage");

export class NoSequenceConfiguredError extends Error {
  constructor() {
    super("This company has no BOL sequence configured yet. Ask an admin to set one up.");
  }
}

export class NoTemplateConfiguredError extends Error {
  constructor() {
    super("This company has no BOL template configured yet. Ask an admin to upload one.");
  }
}

/**
 * Assigns the next BOL number and persists the record in a single
 * transaction, then generates the PDF afterward. The number is claimed by
 * an atomic `UPDATE ... RETURNING` — the row lock Postgres takes for that
 * statement is held until commit, so two concurrent calls for the same
 * company are serialized and can never receive the same number, even
 * though nextNumber is only ever read back as "old value" in the same
 * statement that advances it.
 *
 * The record is created before the PDF is generated and its number is
 * never reused, even if PDF generation subsequently fails — see pdfStatus.
 */
export async function generateBolNumber({
  companyId,
  userId,
  formData = {},
  style,
}: {
  companyId: string;
  userId: string;
  formData?: FormData;
  style?: TextStyle;
}): Promise<BolRecord> {
  const record = await prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<
      { assigned: number; prefix: string; padding: number }[]
    >`
      UPDATE "BolSequence"
      SET "nextNumber" = "nextNumber" + 1
      WHERE "companyId" = ${companyId}
      RETURNING "nextNumber" - 1 AS assigned, "prefix" AS prefix, "padding" AS padding
    `;

    if (rows.length === 0) {
      throw new NoSequenceConfiguredError();
    }

    const { assigned, prefix, padding } = rows[0];
    const bolNumber = `${prefix}-${String(assigned).padStart(padding, "0")}`;

    const created = await tx.bolRecord.create({
      data: {
        companyId,
        generatedByUserId: userId,
        bolNumber,
        numericNumber: assigned,
        status: "ACTIVE",
        pdfStatus: "PENDING",
        formData: formData as object,
        textFontSize: style?.fontSize,
        textColor: style?.color,
      },
    });

    await tx.auditLog.create({
      data: {
        companyId,
        userId,
        bolRecordId: created.id,
        action: "generated",
        metadata: { bolNumber },
      },
    });

    return created;
  });

  await attachPdf(record);

  return (await prisma.bolRecord.findUniqueOrThrow({ where: { id: record.id } })) ;
}

async function attachPdf(record: BolRecord) {
  try {
    const template = await prisma.bolTemplate.findUnique({
      where: { companyId: record.companyId },
    });
    if (!template) {
      throw new NoTemplateConfiguredError();
    }

    const company = await prisma.company.findUniqueOrThrow({
      where: { id: record.companyId },
    });

    const templatePath = path.isAbsolute(template.filePath)
      ? template.filePath
      : path.join(STORAGE_ROOT, template.filePath);
    const outputRelative = path.join("generated", company.code, `${record.bolNumber}.pdf`);
    const outputPath = path.join(STORAGE_ROOT, outputRelative);

    await createBolPdf({
      templatePath,
      outputPath,
      bolNumber: record.bolNumber,
      template,
      formData: (record.formData as FormData | null) ?? {},
      style: {
        fontSize: record.textFontSize ?? undefined,
        color: record.textColor ?? undefined,
      },
    });

    await prisma.bolRecord.update({
      where: { id: record.id },
      data: { pdfStatus: "READY", pdfPath: outputRelative },
    });
  } catch (err) {
    await prisma.bolRecord.update({
      where: { id: record.id },
      data: { pdfStatus: "FAILED" },
    });
    await prisma.auditLog.create({
      data: {
        companyId: record.companyId,
        userId: record.generatedByUserId,
        bolRecordId: record.id,
        action: "pdf_failed",
        metadata: { error: err instanceof Error ? err.message : String(err) },
      },
    });
  }
}
