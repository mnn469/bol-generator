"use server";

import { redirect } from "next/navigation";
import { requireUser, getMembership } from "@/lib/auth/authz";
import { setActiveCompanyIdCookie } from "@/lib/auth/activeCompany";

export async function selectCompanyAction(formData: FormData) {
  const user = await requireUser();
  const companyId = formData.get("companyId");
  if (typeof companyId !== "string" || !companyId) {
    redirect("/select-company");
  }

  const membership = await getMembership(user.id, companyId);
  if (!membership) {
    redirect("/no-access");
  }

  await setActiveCompanyIdCookie(companyId);
  redirect("/dashboard");
}
