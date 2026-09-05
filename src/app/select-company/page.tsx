import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/authz";
import { prisma } from "@/lib/prisma";
import { selectCompanyAction } from "./actions";

export default async function SelectCompanyPage() {
  const user = await requireUser();

  const memberships = await prisma.companyUser.findMany({
    where: { userId: user.id, company: { active: true } },
    include: { company: true },
    orderBy: { company: { name: "asc" } },
  });

  if (memberships.length === 0) {
    redirect("/no-access");
  }
  if (memberships.length === 1) {
    redirect("/dashboard");
  }

  return (
    <div className="flex flex-1 items-center justify-center px-4">
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-xl font-semibold text-slate-900">Select a company</h1>
        <p className="mt-1 text-sm text-slate-500">
          You belong to more than one company. Choose which one to work in.
        </p>
        <div className="mt-6 flex flex-col gap-2">
          {memberships.map((m) => (
            <form key={m.companyId} action={selectCompanyAction}>
              <input type="hidden" name="companyId" value={m.companyId} />
              <button
                type="submit"
                className="flex w-full items-center justify-between rounded-md border border-slate-200 px-4 py-3 text-left text-sm hover:border-slate-400 hover:bg-slate-50"
              >
                <span className="font-medium text-slate-900">{m.company.name}</span>
                <span className="text-xs uppercase tracking-wide text-slate-400">
                  {m.role}
                </span>
              </button>
            </form>
          ))}
        </div>
      </div>
    </div>
  );
}
