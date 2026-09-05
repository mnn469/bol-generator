import { cookies } from "next/headers";

const COOKIE_NAME = "activeCompanyId";

export async function getActiveCompanyIdCookie(): Promise<string | null> {
  const store = await cookies();
  return store.get(COOKIE_NAME)?.value ?? null;
}

export async function setActiveCompanyIdCookie(companyId: string) {
  const store = await cookies();
  store.set(COOKIE_NAME, companyId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function clearActiveCompanyIdCookie() {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}
