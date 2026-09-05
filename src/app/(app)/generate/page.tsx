import { redirect } from "next/navigation";
import Link from "next/link";
import { requireActiveCompany } from "@/lib/auth/authz";
import { prisma } from "@/lib/prisma";
import { fieldDefListSchema } from "@/lib/pdf/fieldTypes";
import { BolForm } from "@/components/BolForm";

export default async function GeneratePage() {
  const { company, role } = await requireActiveCompany();
  if (role === "VIEWER") {
    redirect("/dashboard");
  }

  const template = await prisma.bolTemplate.findUnique({ where: { companyId: company.id } });

  if (!template) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900">
        This company has no BOL template configured yet.{" "}
        {role === "ADMIN" ? (
          <Link href="/admin" className="underline">
            Set one up in Admin.
          </Link>
        ) : (
          "Ask an admin to set one up."
        )}
      </div>
    );
  }

  const fields = fieldDefListSchema.safeParse(template.fields ?? []);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Generate BOL — {company.name}</h1>
        <p className="mt-1 text-sm text-slate-500">
          Fill in the shipment details, then generate. The number is assigned only once you submit.
        </p>
      </div>

      {fields.success ? (
        <BolForm companyId={company.id} fields={fields.data} />
      ) : (
        <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-sm text-red-800">
          This company&apos;s BOL template has an invalid field configuration.{" "}
          {role === "ADMIN" ? (
            <Link href="/admin" className="underline">
              Fix it in Admin.
            </Link>
          ) : (
            "Ask an admin to fix it."
          )}
        </div>
      )}
    </div>
  );
}
