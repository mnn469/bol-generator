import Link from "next/link";
import { signOut } from "@/auth";

export default function NoAccessPage() {
  return (
    <div className="flex flex-1 items-center justify-center px-4">
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <h1 className="text-xl font-semibold text-slate-900">No access</h1>
        <p className="mt-2 text-sm text-slate-500">
          Your account isn&apos;t assigned to any company yet, or the page you tried
          to reach requires a role you don&apos;t have. Ask a company admin to add
          you.
        </p>
        <form
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/login" });
          }}
          className="mt-6"
        >
          <button
            type="submit"
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
          >
            Sign out
          </button>
        </form>
        <Link href="/dashboard" className="mt-3 block text-sm text-slate-500 underline">
          Try again
        </Link>
      </div>
    </div>
  );
}
