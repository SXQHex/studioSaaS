"use client";
import { useEffect, useId, useState } from "react";
import { listWorkspaceSection } from "@/lib/actions/workspace";
import { studioInputToIso } from "@/lib/studio-date";
import type { WorkspaceRow } from "@/lib/workspace";

export type OperationField = {
  key: string;
  label: string;
  kind?: string;
  dataset?: string;
  choices?: string[];
  optional?: boolean;
  value?: string;
};
export type FieldOption = { id: string; label: string };
export function operationPayload(
  fields: OperationField[],
  values: Record<string, string>,
) {
  return Object.fromEntries(
    fields.map((f) => {
      const value = values[f.key] ?? f.value ?? "";
      return [
        f.key,
        f.kind === "number"
          ? Number(value)
          : f.kind === "checkbox"
            ? value === "true"
            : f.kind === "datetime-local"
              ? studioInputToIso(value)
              : value,
      ];
    }),
  );
}
function WorkspacePicker({
  module,
  field,
  value,
  initial,
  filters,
  busy,
  onChange,
}: {
  module: string;
  field: OperationField;
  value: string;
  initial: FieldOption[];
  filters: Record<string, string>;
  busy: boolean;
  onChange: (value: string, row?: WorkspaceRow) => void;
}) {
  const id = useId();
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [result, setResult] = useState({
    rows: initial.map((o) => ({ id: o.id, label: o.label })) as WorkspaceRow[],
    total: initial.length,
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<FieldOption | null>(null);
  const filterKey = JSON.stringify(filters);
  useEffect(() => {
    let active = true;
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const r = await listWorkspaceSection({
          module,
          section: field.dataset,
          page,
          query,
          filters: JSON.parse(filterKey),
          selected: value || null,
        });
        if (!active) return;
        if (r.ok) {
          setResult({ rows: r.rows, total: r.total });
          setError("");
        } else setError(r.error);
      } catch {
        if (active) setError("Seçenekler yüklenemedi.");
      } finally {
        if (active) setLoading(false);
      }
    }, 200);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [module, field.dataset, page, query, filterKey, value]);
  const options = result.rows.map((row) => ({
    id: String(row.id),
    label: String(
      row.label ?? row.title ?? row.full_name ?? row.name ?? row.id,
    ),
  }));
  const chosen =
    options.find((o) => o.id === value) ??
    (selected?.id === value ? selected : initial.find((o) => o.id === value));
  return (
    <>
      <input
        type="search"
        aria-label={`${field.label} seçeneklerinde ara`}
        maxLength={80}
        value={query}
        disabled={busy}
        onChange={(e) => {
          setQuery(e.target.value);
          setPage(1);
        }}
      />
      <select
        id={id}
        aria-label={field.label}
        required={!field.optional}
        value={value}
        disabled={busy || loading}
        onChange={(e) => {
          const option = options.find((o) => o.id === e.target.value);
          setSelected(option ?? null);
          onChange(
            e.target.value,
            result.rows.find((r) => r.id === e.target.value),
          );
        }}
      >
        <option value="">Seçin</option>
        {value && !options.some((o) => o.id === value) && (
          <option value={value}>{chosen?.label ?? "Seçili kayıt"}</option>
        )}
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
      </select>
      {result.total > 25 && (
        <span className="table-toolbar">
          <button
            type="button"
            disabled={busy || loading || page === 1}
            onClick={() => setPage((p) => p - 1)}
          >
            Önceki seçenekler
          </button>
          <span>
            {page} / {Math.max(1, Math.ceil(result.total / 25))}
          </span>
          <button
            type="button"
            disabled={busy || loading || page * 25 >= result.total}
            onClick={() => setPage((p) => p + 1)}
          >
            Sonraki seçenekler
          </button>
        </span>
      )}
      {error && <span role="alert">{error}</span>}
    </>
  );
}
export function WorkspaceFields({
  module,
  fields,
  values,
  busy,
  options,
  onChange,
  filters,
}: {
  module: string;
  fields: OperationField[];
  values: Record<string, string>;
  busy: boolean;
  options: (field: OperationField) => FieldOption[];
  onChange: (key: string, value: string, row?: WorkspaceRow) => void;
  filters: (field: OperationField) => Record<string, string>;
}) {
  const id = useId();
  return (
    <div className="field-grid">
      {fields.map((f) => {
        const value = values[f.key] ?? f.value ?? "";
        const remote = f.dataset && !["methods", "stages"].includes(f.dataset);
        return (
          <label key={f.key} htmlFor={`${id}-${f.key}`}>
            {f.label}
            {!f.optional && f.kind !== "checkbox" ? " *" : ""}
            {remote ? (
              <WorkspacePicker
                key={f.key + JSON.stringify(filters(f))}
                module={module}
                field={f}
                value={value}
                initial={options(f)}
                filters={filters(f)}
                busy={busy}
                onChange={(v, row) => onChange(f.key, v, row)}
              />
            ) : f.dataset || f.choices ? (
              <select
                id={`${id}-${f.key}`}
                value={value}
                required={!f.optional}
                disabled={busy}
                onChange={(e) => onChange(f.key, e.target.value)}
              >
                <option value="">Seçin</option>
                {options(f).map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </select>
            ) : f.kind === "textarea" ? (
              <textarea
                id={`${id}-${f.key}`}
                required={!f.optional}
                value={value}
                disabled={busy}
                rows={5}
                maxLength={f.key === "body" ? 20000 : 2000}
                onChange={(e) => onChange(f.key, e.target.value)}
              />
            ) : (
              <input
                id={`${id}-${f.key}`}
                type={f.kind ?? "text"}
                value={f.kind === "checkbox" ? undefined : value}
                checked={f.kind === "checkbox" ? value === "true" : undefined}
                required={!f.optional && f.kind !== "checkbox"}
                disabled={busy}
                min={f.kind === "number" ? 0 : undefined}
                step={
                  f.kind === "number"
                    ? ["amount", "price"].includes(f.key)
                      ? "0.01"
                      : "1"
                    : undefined
                }
                maxLength={f.kind === "email" ? 320 : 500}
                onChange={(e) =>
                  onChange(
                    f.key,
                    f.kind === "checkbox"
                      ? String(e.target.checked)
                      : e.target.value,
                  )
                }
              />
            )}
          </label>
        );
      })}
    </div>
  );
}
