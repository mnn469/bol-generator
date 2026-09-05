import { redirect } from "next/navigation";
import { requireActiveCompany } from "@/lib/auth/authz";
import { prisma } from "@/lib/prisma";
import { AddUserForm } from "@/components/AddUserForm";
import {
  updateSequenceAction,
  updateTemplateAction,
  addUserAction,
  updateUserRoleAction,
  removeUserAction,
} from "./actions";

export default async function AdminPage() {
  const { company, role } = await requireActiveCompany();
  if (role !== "ADMIN") {
    redirect("/no-access");
  }

  const companyId = company.id;
  const companyName = company.name;
  const [sequence, template, members] = await Promise.all([
    prisma.bolSequence.findUnique({ where: { companyId } }),
    prisma.bolTemplate.findUnique({ where: { companyId } }),
    prisma.companyUser.findMany({
      where: { companyId },
      include: { user: true },
      orderBy: { user: { name: "asc" } },
    }),
  ]);

  const boundUpdateSequence = updateSequenceAction.bind(null, companyId);
  const boundUpdateTemplate = updateTemplateAction.bind(null, companyId);
  const boundAddUser = addUserAction.bind(null, companyId);
  const boundUpdateUserRole = updateUserRoleAction.bind(null, companyId);
  const boundRemoveUser = removeUserAction.bind(null, companyId);

  return (
    <div className="flex flex-col gap-10">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Admin — {companyName}</h1>
        <p className="mt-1 text-sm text-slate-500">
          Manage this company&apos;s BOL numbering, template, and users.
        </p>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-slate-900">BOL sequence</h2>
        <form action={boundUpdateSequence} className="flex flex-wrap items-end gap-4 rounded-lg border border-slate-200 bg-white p-4">
          <Field label="Prefix">
            <input name="prefix" defaultValue={sequence?.prefix ?? "BOL"} className="input" />
          </Field>
          <Field label="Next number">
            <input
              name="nextNumber"
              type="number"
              defaultValue={sequence?.nextNumber ?? 1}
              className="input"
            />
          </Field>
          <Field label="Padding (digits)">
            <input
              name="padding"
              type="number"
              defaultValue={sequence?.padding ?? 6}
              className="input"
            />
          </Field>
          <button type="submit" className="btn-primary">
            Save
          </button>
        </form>
        <p className="text-xs text-slate-400">
          Example next number: {sequence ? `${sequence.prefix}-${String(sequence.nextNumber).padStart(sequence.padding, "0")}` : "—"}.
          Changing the next number only affects future BOLs; it never rewrites past records.
        </p>
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900">BOL template</h2>
          {template ? (
            <a
              href={`/api/companies/${companyId}/template/preview`}
              target="_blank"
              rel="noreferrer"
              className="text-sm text-slate-600 underline"
            >
              Generate test PDF
            </a>
          ) : null}
        </div>
        <form
          action={boundUpdateTemplate}
          className="flex flex-col gap-4 rounded-lg border border-slate-200 bg-white p-4"
        >
          <Field label="Template name">
            <input name="name" defaultValue={template?.name ?? "BOL Template"} className="input" />
          </Field>

          <Field label={template ? `Replace PDF (current: ${template.filePath})` : "Template PDF"}>
            <input name="file" type="file" accept="application/pdf" className="input" />
          </Field>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Field label="Number X">
              <input name="numberX" type="number" step="0.1" defaultValue={template?.numberX ?? 420} className="input" />
            </Field>
            <Field label="Number Y">
              <input name="numberY" type="number" step="0.1" defaultValue={template?.numberY ?? 760} className="input" />
            </Field>
            <Field label="Number font size">
              <input name="numberFontSize" type="number" step="0.5" defaultValue={template?.numberFontSize ?? 14} className="input" />
            </Field>
            <Field label="Number prefix text">
              <input name="numberPrefixText" defaultValue={template?.numberPrefixText ?? "No. "} className="input" />
            </Field>
          </div>

          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              name="coverExistingNumber"
              defaultChecked={template?.coverExistingNumber ?? false}
            />
            Cover a pre-printed number on the template with a white box before drawing the new one
          </label>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Field label="Cover X">
              <input name="coverX" type="number" step="0.1" defaultValue={template?.coverX ?? 400} className="input" />
            </Field>
            <Field label="Cover Y">
              <input name="coverY" type="number" step="0.1" defaultValue={template?.coverY ?? 750} className="input" />
            </Field>
            <Field label="Cover width">
              <input name="coverWidth" type="number" step="0.1" defaultValue={template?.coverWidth ?? 160} className="input" />
            </Field>
            <Field label="Cover height">
              <input name="coverHeight" type="number" step="0.1" defaultValue={template?.coverHeight ?? 24} className="input" />
            </Field>
          </div>

          <Field label="Copy labels (comma-separated; leave blank for a single unlabeled page)">
            <input
              name="copyLabels"
              defaultValue={template?.copyLabels.join(", ") ?? ""}
              placeholder="SHIPPER COPY, RECEIVER COPY, RECORDS COPY"
              className="input"
            />
          </Field>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <Field label="Copy label X">
              <input name="copyLabelX" type="number" step="0.1" defaultValue={template?.copyLabelX ?? 420} className="input" />
            </Field>
            <Field label="Copy label Y">
              <input name="copyLabelY" type="number" step="0.1" defaultValue={template?.copyLabelY ?? 735} className="input" />
            </Field>
            <Field label="Copy font size">
              <input name="copyFontSize" type="number" step="0.5" defaultValue={template?.copyFontSize ?? 11} className="input" />
            </Field>
          </div>

          <Field label="Form fields (JSON) — what the user fills in before generating, and where each answer is drawn">
            <textarea
              name="fields"
              defaultValue={JSON.stringify(template?.fields ?? [], null, 2)}
              rows={14}
              spellCheck={false}
              className="input font-mono text-xs"
            />
          </Field>

          <p className="text-xs text-slate-400">
            Coordinates are in PDF points, origin at the bottom-left of the page. Save, then use
            &quot;Generate test PDF&quot; above (it fills every field with a sample value) to check
            alignment and iterate.
          </p>

          <button type="submit" className="btn-primary w-fit">
            Save template
          </button>
        </form>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-slate-900">Users</h2>
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2">Name</th>
                <th className="px-4 py-2">Email</th>
                <th className="px-4 py-2">Role</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.id} className="border-t border-slate-100">
                  <td className="px-4 py-2 text-slate-900">{m.user.name}</td>
                  <td className="px-4 py-2 text-slate-500">{m.user.email}</td>
                  <td className="px-4 py-2">
                    <form action={boundUpdateUserRole} className="flex items-center gap-2">
                      <input type="hidden" name="userId" value={m.userId} />
                      <select
                        name="role"
                        defaultValue={m.role}
                        className="rounded-md border border-slate-300 px-2 py-1 text-xs"
                      >
                        <option value="ADMIN">Admin</option>
                        <option value="USER">User</option>
                        <option value="VIEWER">Viewer</option>
                      </select>
                      <button type="submit" className="text-xs text-slate-600 underline">
                        Update
                      </button>
                    </form>
                  </td>
                  <td className="px-4 py-2">
                    <form action={boundRemoveUser}>
                      <input type="hidden" name="userId" value={m.userId} />
                      <button type="submit" className="text-xs text-red-600 underline">
                        Remove
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <AddUserForm action={boundAddUser} />
      </section>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
      {label}
      {children}
    </label>
  );
}
