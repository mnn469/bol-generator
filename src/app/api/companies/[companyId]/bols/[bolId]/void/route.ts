import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getMembership } from "@/lib/auth/authz";
import { prisma } from "@/lib/prisma";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ companyId: string; bolId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { companyId, bolId } = await params;
  const membership = await getMembership(session.user.id, companyId);
  if (!membership || membership.role !== "ADMIN") {
    return NextResponse.json({ error: "Only admins can void a BOL" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const reason = typeof body.reason === "string" ? body.reason.slice(0, 500) : null;

  const record = await prisma.bolRecord.findUnique({ where: { id: bolId } });
  if (!record || record.companyId !== companyId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (record.status === "VOIDED") {
    return NextResponse.json({ error: "Already voided" }, { status: 409 });
  }

  await prisma.$transaction([
    prisma.bolRecord.update({
      where: { id: bolId },
      data: { status: "VOIDED", voidedAt: new Date(), voidReason: reason },
    }),
    prisma.auditLog.create({
      data: {
        companyId,
        userId: session.user.id,
        bolRecordId: bolId,
        action: "voided",
        metadata: reason ? { reason } : undefined,
      },
    }),
  ]);

  return NextResponse.json({ ok: true });
}
