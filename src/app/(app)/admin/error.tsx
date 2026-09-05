"use client";

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 p-6">
      <h2 className="text-sm font-semibold text-red-900">Something went wrong</h2>
      <p className="mt-1 text-sm text-red-700">{error.message}</p>
      <button
        type="button"
        onClick={reset}
        className="mt-4 rounded-md border border-red-300 px-3 py-1.5 text-sm text-red-800 hover:bg-red-100"
      >
        Try again
      </button>
    </div>
  );
}
