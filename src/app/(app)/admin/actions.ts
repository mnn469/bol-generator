"use server";

import path from "path";
import fs from "fs/promises";
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { requireCompanyRole } from "@/lib/auth/authz";
import { prisma } from "@/lib/prisma";
import { fieldDefListSchema } from "@/lib/pdf/fieldTypes";

const STORAGE_ROOT = path.join(process.cwd(), "storage");

function num(formData: FormData, key: string): number {
  const v = Number(formData.get(key));
  if (!Number.isFinite(v)) throw new Error(`Invalid number for ${key}`);
  return v;
}

export async function updateSequenceAction(companyId: string, formData: FormData) {
  await requireCompanyRole(companyId, ["ADMIN"]);

  const prefix = String(formData.get("prefix") ?? "").trim();
  const padding = num(formData, "padding");
  const nextNumber = num(formData, "nextNumber");

  if (!prefix) throw new Error("Prefix is required");
  if (padding < 1 || padding > 12) throw new Error("Padding must be between 1 and 12");
  if (nextNumber < 1) throw new Error("Next number must be positive");

  await prisma.bolSequence.upsert({
    where: { companyId },
    update: { prefix, padding, nextNumber },
    create: { companyId, prefix, padding, nextNumber },
  });

  revalidatePath("/admin");
}

export async function updateTemplateAction(companyId: string, formData: FormData) {
  await requireCompanyRole(companyId, ["ADMIN"]);
  const company = await prisma.company.findUniqueOrThrow({ where: { id: companyId } });

  const existing = await prisma.bolTemplate.findUnique({ where: { companyId } });

  let filePath = existing?.filePath;
  const file = formData.get("file");
  if (file instanceof File && file.size > 0) {
    if (file.type !== "application/pdf") {
      throw new Error("Template file must be a PDF");
    }
    const bytes = Buffer.from(await file.arrayBuffer());
    const relative = path.join("templates", `${company.code.toLowerCase()}-${Date.now()}.pdf`);
    const fullPath = path.join(STORAGE_ROOT, relative);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, bytes);
    filePath = relative;
  }

  if (!filePath) {
    throw new Error("A template PDF file is required");
  }

  const copyLabelsRaw = String(formData.get("copyLabels") ?? "").trim();
  const copyLabels = copyLabelsRaw
    ? copyLabelsRaw.split(",").map((s) => s.trim()).filter(Boolean)
    : [];

  const fieldsRaw = String(formData.get("fields") ?? "[]").trim() || "[]";
  let fieldsJson: unknown;
  try {
    fieldsJson = JSON.parse(fieldsRaw);
  } catch {
    throw new Error("Form fields must be valid JSON");
  }
  const fieldsParsed = fieldDefListSchema.safeParse(fieldsJson);
  if (!fieldsParsed.success) {
    throw new Error(`Invalid form fields: ${fieldsParsed.error.issues[0]?.message ?? "validation failed"}`);
  }

  const data = {
    name: String(formData.get("name") ?? "BOL Template"),
    filePath,
    numberX: num(formData, "numberX"),
    numberY: num(formData, "numberY"),
    numberFontSize: num(formData, "numberFontSize"),
    numberPrefixText: String(formData.get("numberPrefixText") ?? "No. "),
    coverExistingNumber: formData.get("coverExistingNumber") === "on",
    coverX: num(formData, "coverX"),
    coverY: num(formData, "coverY"),
    coverWidth: num(formData, "coverWidth"),
    coverHeight: num(formData, "coverHeight"),
    copyLabels,
    copyLabelX: num(formData, "copyLabelX"),
    copyLabelY: num(formData, "copyLabelY"),
    copyFontSize: num(formData, "copyFontSize"),
    fields: fieldsParsed.data,
  };

  await prisma.bolTemplate.upsert({
    where: { companyId },
    update: data,
    create: { companyId, ...data },
  });

  revalidatePath("/admin");
}

export async function addUserAction(
  companyId: string,
  _prevState: { temporaryPassword: string; email: string } | undefined,
  formData: FormData
) {
  await requireCompanyRole(companyId, ["ADMIN"]);

  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const role = String(formData.get("role") ?? "USER");
  if (!["ADMIN", "USER", "VIEWER"].includes(role)) throw new Error("Invalid role");
  if (!email) throw new Error("Email is required");

  let user = await prisma.user.findUnique({ where: { email } });
  let temporaryPassword: string | undefined;

  if (!user) {
    if (!name) throw new Error("Name is required for a new user");
    temporaryPassword = Math.random().toString(36).slice(2, 10);
    const passwordHash = await bcrypt.hash(temporaryPassword, 10);
    user = await prisma.user.create({ data: { name, email, passwordHash } });
  }

  await prisma.companyUser.upsert({
    where: { companyId_userId: { companyId, userId: user.id } },
    update: { role: role as "ADMIN" | "USER" | "VIEWER" },
    create: { companyId, userId: user.id, role: role as "ADMIN" | "USER" | "VIEWER" },
  });

  revalidatePath("/admin");

  return temporaryPassword
    ? { temporaryPassword, email }
    : undefined;
}

export async function updateUserRoleAction(companyId: string, formData: FormData) {
  await requireCompanyRole(companyId, ["ADMIN"]);
  const userId = String(formData.get("userId"));
  const role = String(formData.get("role"));
  if (!["ADMIN", "USER", "VIEWER"].includes(role)) throw new Error("Invalid role");

  await prisma.companyUser.update({
    where: { companyId_userId: { companyId, userId } },
    data: { role: role as "ADMIN" | "USER" | "VIEWER" },
  });

  revalidatePath("/admin");
}

export async function removeUserAction(companyId: string, formData: FormData) {
  const { user: actingUser } = await requireCompanyRole(companyId, ["ADMIN"]);
  const userId = String(formData.get("userId"));

  if (userId === actingUser.id) {
    throw new Error("You cannot remove yourself from the company");
  }

  await prisma.companyUser.delete({
    where: { companyId_userId: { companyId, userId } },
  });

  revalidatePath("/admin");
}
