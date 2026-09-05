import Link from "next/link";
import { signOut } from "@/auth";
import type { Role } from "@prisma/client";

export function TopNav({
  companyName,
  role,
  showSwitchCompany,
}: {
  companyName: string;
  role: Role;
  showSwitchCompany: boolean;
}) {
  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <div className="flex items-center gap-6">
          <Link href="/dashboard" className="font-semibold text-slate-900">
            BOL Generator
          </Link>
          <nav className="flex items-center gap-4 text-sm text-slate-600">
            <Link href="/dashboard" className="hover:text-slate-900">
              Dashboard
            </Link>
            <Link href="/history" className="hover:text-slate-900">
              History
            </Link>
            {role === "ADMIN" ? (
              <Link href="/admin" className="hover:text-slate-900">
                Admin
              </Link>
            ) : null}
          </nav>
        </div>

        <div className="flex items-center gap-3 text-sm">
          <div className="text-right">
            <div className="font-medium text-slate-900">{companyName}</div>
            <div className="text-xs uppercase tracking-wide text-slate-400">{role}</div>
          </div>
          {showSwitchCompany ? (
            <Link
              href="/select-company"
              className="rounded-md border border-slate-200 px-3 py-1.5 text-slate-600 hover:bg-slate-50"
            >
              Switch
            </Link>
          ) : null}
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/login" });
            }}
          >
            <button
              type="submit"
              className="rounded-md border border-slate-200 px-3 py-1.5 text-slate-600 hover:bg-slate-50"
            >
              Sign out
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
