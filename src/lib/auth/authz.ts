import { cache } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getActiveCompanyIdCookie } from "@/lib/auth/activeCompany";
import type { Role } from "@prisma/client";

export async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }
  return session.user;
}

/**
 * Every membership lookup goes through CompanyUser at request time (never
 * cached in the JWT) so a role change or removal takes effect immediately,
 * not just on next login.
 */
export async function getMembership(userId: string, companyId: string) {
  const membership = await prisma.companyUser.findUnique({
    where: { companyId_userId: { companyId, userId } },
    include: { company: true },
  });
  if (!membership || !membership.company.active) return null;
  return membership;
}

/**
 * Resolves the signed-in user's active company: from the cookie if it names
 * a company the user still belongs to, auto-resolved if the user belongs to
 * exactly one company, or a redirect to the picker otherwise.
 *
 * Cookies can only be written from a Server Action or Route Handler, never
 * during a page render, so the single-company case is re-derived from
 * memberships on every call instead of being persisted — it's deterministic,
 * so there's nothing to gain from caching it in a cookie.
 *
 * Wrapped in React's `cache()` so multiple calls within one request (layout
 * + page) share a single DB round trip instead of querying twice.
 */
export const requireActiveCompany = cache(async () => {
  const user = await requireUser();

  const memberships = await prisma.companyUser.findMany({
    where: { userId: user.id, company: { active: true } },
    include: { company: true },
    orderBy: { company: { name: "asc" } },
  });

  if (memberships.length === 0) {
    redirect("/no-access");
  }

  const cookieCompanyId = await getActiveCompanyIdCookie();
  const membership =
    memberships.find((m) => m.companyId === cookieCompanyId) ??
    (memberships.length === 1 ? memberships[0] : undefined);

  if (!membership) {
    redirect("/select-company");
  }

  return { user, company: membership.company, role: membership.role, memberships };
});

export async function requireCompanyRole(companyId: string, allowed: Role[]) {
  const user = await requireUser();
  const membership = await getMembership(user.id, companyId);
  if (!membership || !allowed.includes(membership.role)) {
    redirect("/no-access");
  }
  return { user, company: membership.company, role: membership.role };
}
