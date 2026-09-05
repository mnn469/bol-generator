import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { auth } from "@/auth";
import { getMembership } from "@/lib/auth/authz";
import { prisma } from "@/lib/prisma";

const STORAGE_ROOT = path.join(process.cwd(), "storage");

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ companyId: string; bolId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { companyId, bolId } = await params;
  const membership = await getMembership(session.user.id, companyId);
  if (!membership) {
    return NextResponse.json({ error: "You do not have access to this company" }, { status: 403 });
  }

  const record = await prisma.bolRecord.findUnique({ where: { id: bolId } });
  if (!record || record.companyId !== companyId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!record.pdfPath || record.pdfStatus !== "READY") {
    return NextResponse.json({ error: "PDF not available for this BOL" }, { status: 404 });
  }

  const fullPath = path.join(STORAGE_ROOT, record.pdfPath);
  if (!fullPath.startsWith(STORAGE_ROOT)) {
    return NextResponse.json({ error: "Invalid path" }, { status: 400 });
  }

  try {
    const bytes = await fs.readFile(fullPath);
    await prisma.auditLog.create({
      data: {
        companyId,
        userId: session.user.id,
        bolRecordId: record.id,
        action: "downloaded",
      },
    });
    return new NextResponse(new Uint8Array(bytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${record.bolNumber}.pdf"`,
      },
    });
  } catch {
    return NextResponse.json({ error: "PDF file missing on disk" }, { status: 404 });
  }
}
