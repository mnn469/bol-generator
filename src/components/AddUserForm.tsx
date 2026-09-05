"use client";

import { useActionState } from "react";

type AddUserResult = { temporaryPassword: string; email: string } | undefined;

export function AddUserForm({
  action,
}: {
  action: (
    prevState: AddUserResult,
    formData: FormData
  ) => Promise<AddUserResult>;
}) {
  const [result, formAction, pending] = useActionState(action, undefined);

  return (
    <form action={formAction} className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4">
      <h3 className="text-sm font-semibold text-slate-900">Add user</h3>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <input
          name="name"
          placeholder="Name (for new users)"
          className="rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
        <input
          name="email"
          type="email"
          required
          placeholder="Email"
          className="rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
        <select name="role" defaultValue="USER" className="rounded-md border border-slate-300 px-3 py-2 text-sm">
          <option value="ADMIN">Admin</option>
          <option value="USER">User</option>
          <option value="VIEWER">Viewer</option>
        </select>
      </div>
      <button
        type="submit"
        disabled={pending}
        className="w-fit rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-60"
      >
        {pending ? "Adding…" : "Add user"}
      </button>
      {result ? (
        <p className="text-sm text-emerald-700">
          Created <span className="font-medium">{result.email}</span> with temporary
          password <code className="rounded bg-slate-100 px-1 py-0.5">{result.temporaryPassword}</code>.
          Share it securely — it won&apos;t be shown again.
        </p>
      ) : null}
    </form>
  );
}
