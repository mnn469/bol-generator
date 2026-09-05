import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { auth } from "@/auth";
import { getMembership } from "@/lib/auth/authz";
import { prisma } from "@/lib/prisma";
import { generateBolNumber, NoSequenceConfiguredError, NoTemplateConfiguredError } from "@/lib/bol/generateBolNumber";
import { buildFormDataSchema, fieldDefListSchema, textStyleSchema, type FormData } from "@/lib/pdf/fieldTypes";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ companyId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { companyId } = await params;
  const membership = await getMembership(session.user.id, companyId);
  if (!membership) {
    return NextResponse.json({ error: "You do not have access to this company" }, { status: 403 });
  }
  if (membership.role === "VIEWER") {
    return NextResponse.json({ error: "Viewers cannot generate BOLs" }, { status: 403 });
  }

  const template = await prisma.bolTemplate.findUnique({ where: { companyId } });
  if (!template) {
    return NextResponse.json(
      { error: "This company has no BOL template configured yet. Ask an admin to upload one." },
      { status: 409 }
    );
  }

  const fields = fieldDefListSchema.safeParse(template.fields ?? []);
  if (!fields.success) {
    return NextResponse.json(
      { error: "This company's BOL template has an invalid field configuration. Ask an admin to fix it." },
      { status: 409 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const parsedFormData = buildFormDataSchema(fields.data).safeParse(body.formData ?? {});
  if (!parsedFormData.success) {
    return NextResponse.json(
      { error: "Invalid form data", details: parsedFormData.error.flatten() },
      { status: 400 }
    );
  }

  const parsedStyle = textStyleSchema.safeParse(body.style ?? {});
  if (!parsedStyle.success) {
    return NextResponse.json(
      { error: "Invalid text style", details: parsedStyle.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const record = await generateBolNumber({
      companyId,
      userId: session.user.id,
      formData: parsedFormData.data as FormData,
      style: parsedStyle.data,
    });
    return NextResponse.json({
      id: record.id,
      bolNumber: record.bolNumber,
      pdfStatus: record.pdfStatus,
      pdfDownloadUrl: `/api/companies/${companyId}/bols/${record.id}/pdf`,
    });
  } catch (err) {
    if (err instanceof NoSequenceConfiguredError || err instanceof NoTemplateConfiguredError) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return NextResponse.json(
        { error: "That BOL number was already used. Ask an admin to check the sequence's next number." },
        { status: 409 }
      );
    }
    console.error("BOL generation failed", err);
    return NextResponse.json({ error: "Failed to generate BOL" }, { status: 500 });
  }
}
