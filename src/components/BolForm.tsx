"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  TEXT_FONT_SIZE_OPTIONS,
  TEXT_COLOR_OPTIONS,
  type FieldDef,
  type TableFieldDef,
} from "@/lib/pdf/fieldTypes";

type SimpleValue = string | boolean;
type TableRow = Record<string, string>;

type Result =
  | { ok: true; bolNumber: string; pdfStatus: string; pdfDownloadUrl: string }
  | { ok: false; error: string };

export function BolForm({ companyId, fields }: { companyId: string; fields: FieldDef[] }) {
  const router = useRouter();
  const simpleFields = fields.filter((f): f is Exclude<FieldDef, TableFieldDef> => f.kind !== "table");
  const tableFields = fields.filter((f): f is TableFieldDef => f.kind === "table");

  const [values, setValues] = useState<Record<string, SimpleValue>>(() => {
    const initial: Record<string, SimpleValue> = {};
    for (const f of simpleFields) initial[f.key] = f.kind === "checkbox" ? false : "";
    return initial;
  });

  const [tables, setTables] = useState<Record<string, TableRow[]>>(() => {
    const initial: Record<string, TableRow[]> = {};
    for (const t of tableFields) {
      const emptyRow = Object.fromEntries(t.columns.map((c) => [c.key, ""]));
      initial[t.key] = [emptyRow];
    }
    return initial;
  });

  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [fontSize, setFontSize] = useState<number>(10);
  const [color, setColor] = useState<string>(TEXT_COLOR_OPTIONS[0].value);

  function updateTableCell(tableKey: string, rowIndex: number, colKey: string, value: string) {
    setTables((prev) => {
      const rows = prev[tableKey].map((row, i) => (i === rowIndex ? { ...row, [colKey]: value } : row));
      return { ...prev, [tableKey]: rows };
    });
  }

  function addRow(table: TableFieldDef) {
    setTables((prev) => {
      if (prev[table.key].length >= table.maxRows) return prev;
      const emptyRow = Object.fromEntries(table.columns.map((c) => [c.key, ""]));
      return { ...prev, [table.key]: [...prev[table.key], emptyRow] };
    });
  }

  function removeRow(tableKey: string, rowIndex: number) {
    setTables((prev) => ({
      ...prev,
      [tableKey]: prev[tableKey].filter((_, i) => i !== rowIndex),
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setResult(null);

    const formData: Record<string, SimpleValue | TableRow[]> = { ...values };
    for (const t of tableFields) {
      formData[t.key] = tables[t.key].filter((row) => Object.values(row).some((v) => v.trim() !== ""));
    }

    try {
      const res = await fetch(`/api/companies/${companyId}/bols/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ formData, style: { fontSize, color } }),
      });
      const data = await res.json();
      if (!res.ok) {
        setResult({ ok: false, error: data.error ?? "Failed to generate BOL" });
        return;
      }
      setResult({ ok: true, ...data });
      router.refresh();
    } catch {
      setResult({ ok: false, error: "Network error — please try again." });
    } finally {
      setSubmitting(false);
    }
  }

  if (result?.ok) {
    return (
      <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-6">
        <p className="text-sm text-emerald-900">
          Generated <span className="font-semibold">{result.bolNumber}</span>.
        </p>
        {result.pdfStatus === "READY" ? (
          <a
            href={result.pdfDownloadUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-2 inline-block text-sm font-medium text-emerald-900 underline"
          >
            Download PDF
          </a>
        ) : (
          <p className="mt-2 text-sm text-emerald-900">
            PDF generation failed — the number is reserved. Check History to retry or contact an admin.
          </p>
        )}
        <button
          type="button"
          onClick={() => setResult(null)}
          className="mt-4 block text-sm text-slate-600 underline"
        >
          Generate another
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end gap-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
        <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
          Text size (applies to everything you fill in below)
          <select
            value={fontSize}
            onChange={(e) => setFontSize(Number(e.target.value))}
            className="input"
          >
            {TEXT_FONT_SIZE_OPTIONS.map((size) => (
              <option key={size} value={size}>
                {size}pt
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
          Text color
          <select
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="input"
          >
            {TEXT_COLOR_OPTIONS.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {simpleFields
          .filter((f) => f.kind === "text")
          .map((f) => (
            <label key={f.key} className="flex flex-col gap-1 text-xs font-medium text-slate-600">
              {f.label}
              <input
                type="text"
                maxLength={f.maxLength}
                value={(values[f.key] as string) ?? ""}
                onChange={(e) => setValues((prev) => ({ ...prev, [f.key]: e.target.value }))}
                className="input"
              />
            </label>
          ))}
      </div>

      {simpleFields.some((f) => f.kind === "checkbox") ? (
        <div className="flex gap-6">
          {simpleFields
            .filter((f) => f.kind === "checkbox")
            .map((f) => (
              <label key={f.key} className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={(values[f.key] as boolean) ?? false}
                  onChange={(e) => setValues((prev) => ({ ...prev, [f.key]: e.target.checked }))}
                />
                {f.label}
              </label>
            ))}
        </div>
      ) : null}

      {tableFields.map((t) => (
        <div key={t.key} className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold text-slate-900">{t.label}</h3>
          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  {t.columns.map((c) => (
                    <th key={c.key} className="px-2 py-2">
                      {c.label}
                    </th>
                  ))}
                  <th className="px-2 py-2" />
                </tr>
              </thead>
              <tbody>
                {tables[t.key].map((row, rowIndex) => (
                  <tr key={rowIndex} className="border-t border-slate-100">
                    {t.columns.map((c) => (
                      <td key={c.key} className="px-1 py-1">
                        <input
                          type="text"
                          value={row[c.key] ?? ""}
                          onChange={(e) => updateTableCell(t.key, rowIndex, c.key, e.target.value)}
                          className="w-full rounded border border-slate-200 px-2 py-1 text-xs"
                        />
                      </td>
                    ))}
                    <td className="px-1 py-1">
                      <button
                        type="button"
                        onClick={() => removeRow(t.key, rowIndex)}
                        className="text-xs text-red-500"
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {tables[t.key].length < t.maxRows ? (
            <button
              type="button"
              onClick={() => addRow(t)}
              className="w-fit text-xs text-slate-600 underline"
            >
              + Add row
            </button>
          ) : null}
        </div>
      ))}

      {result && !result.ok ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {result.error}
        </div>
      ) : null}

      <button type="submit" disabled={submitting} className="btn-primary w-fit">
        {submitting ? "Generating…" : "Generate BOL"}
      </button>
    </form>
  );
}
