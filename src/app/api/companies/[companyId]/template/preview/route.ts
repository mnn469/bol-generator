import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { auth } from "@/auth";
import { getMembership } from "@/lib/auth/authz";
import { prisma } from "@/lib/prisma";
import { createBolPdf } from "@/lib/pdf/createBolPdf";
import { fieldDefListSchema, type FormData } from "@/lib/pdf/fieldTypes";

const STORAGE_ROOT = path.join(process.cwd(), "storage");

/** Fills every field with a placeholder so an admin can eyeball every field's position at once. */
function sampleFormData(fields: ReturnType<typeof fieldDefListSchema.parse>): FormData {
  const data: FormData = {};
  for (const field of fields) {
    if (field.kind === "text") {
      data[field.key] = field.label.toUpperCase();
    } else if (field.kind === "checkbox") {
      data[field.key] = true;
    } else {
      const row: Record<string, string> = {};
      for (const col of field.columns) row[col.key] = col.label.toUpperCase();
      data[field.key] = [row, row];
    }
  }
  return data;
}

/**
 * Renders the company's current template with a placeholder number, without
 * touching the BOL sequence or creating a BolRecord — lets an admin dial in
 * numberX/Y and the cover box by eye before it's used for real.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ companyId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { companyId } = await params;
  const membership = await getMembership(session.user.id, companyId);
  if (!membership || membership.role !== "ADMIN") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const template = await prisma.bolTemplate.findUnique({ where: { companyId } });
  if (!template) {
    return NextResponse.json({ error: "No template configured yet" }, { status: 404 });
  }

  const templatePath = path.isAbsolute(template.filePath)
    ? template.filePath
    : path.join(STORAGE_ROOT, template.filePath);
  const outputPath = path.join(STORAGE_ROOT, "generated", "_previews", `${companyId}.pdf`);

  const fields = fieldDefListSchema.safeParse(template.fields ?? []);

  await createBolPdf({
    templatePath,
    outputPath,
    bolNumber: "PREVIEW-000000",
    template,
    formData: fields.success ? sampleFormData(fields.data) : {},
  });

  const bytes = await fs.readFile(outputPath);
  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": "inline; filename=\"bol-template-preview.pdf\"",
    },
  });
}
