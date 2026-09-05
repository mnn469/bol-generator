import { requireActiveCompany } from "@/lib/auth/authz";
import { TopNav } from "@/components/TopNav";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { company, role, memberships } = await requireActiveCompany();

  return (
    <div className="flex min-h-screen flex-col">
      <TopNav
        companyName={company.name}
        role={role}
        showSwitchCompany={memberships.length > 1}
      />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">{children}</main>
    </div>
  );
}
