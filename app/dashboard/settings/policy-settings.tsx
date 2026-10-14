"use client";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { Definition, Effective, PolicyWorkspace } from "@/lib/policies";
import { savePolicy, applyPolicyException } from "@/lib/actions/policies";
import { OperationsTable } from "@/components/operations-table";
const sourceNames: Record<string, string> = {
  organization_mandatory: "Organizasyon zorunlu",
  organization_default: "Organizasyon varsayılanı",
  center_override: "Merkez tarafından değiştirildi",
};
function Editor({
  d,
  e,
  scope,
  id,
  editable,
}: {
  d: Definition;
  e: Effective;
  scope: "organization" | "center";
  id: string;
  editable: boolean;
}) {
  const router = useRouter();
  const [value, setValue] = useState(String(e.value));
  const [mode, setMode] = useState(e.mode);
  const [min, setMin] = useState(String(e.min ?? ""));
  const [max, setMax] = useState(String(e.max ?? ""));
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const locked = scope === "center" && e.mode === "mandatory";
  async function submit(event: FormEvent, reset = false) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const result = await savePolicy({
        action: reset ? "reset" : scope,
        key: d.key,
        ...(scope === "organization"
          ? { organization_id: id }
          : { center_id: id }),
        value: d.kind === "boolean" ? value === "true" : Number(value),
        mode,
        min: d.kind === "number" ? Number(min) : null,
        max: d.kind === "number" ? Number(max) : null,
        expected_revision:
          scope === "organization"
            ? e.organization_revision
            : e.center_revision,
        reason,
      });
      setMessage(result.ok ? result.message : result.error);
      if (result.ok) router.refresh();
    } catch {
      setMessage("İşlem tamamlanamadı.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="form-card">
      <h3>{d.label}</h3>
      <p>
        {d.category} ·{" "}
        {scope === "center"
          ? sourceNames[e.source]
          : mode === "mandatory"
            ? "Zorunlu"
            : "Tavsiye / varsayılan"}
      </p>
      {e.override_stored != null &&
        !e.override_active &&
        scope === "center" && (
          <p>
            Önceki merkez tercihi saklanıyor; mevcut zorunluluk veya sınırlar
            nedeniyle uygulanmıyor.
          </p>
        )}
      <form onSubmit={submit} className="record-form">
        <div className="field-grid">
          <label htmlFor={"policy-" + scope + id + d.key}>
            Değer
            {d.kind === "boolean" ? (
              <select
                id={"policy-" + scope + id + d.key}
                disabled={busy || locked || !editable}
                value={value}
                onChange={(x) => setValue(x.target.value)}
              >
                <option value="true">Evet</option>
                <option value="false">Hayır</option>
              </select>
            ) : (
              <input
                id={"policy-" + scope + id + d.key}
                required
                type="number"
                step="1"
                min={
                  scope === "center"
                    ? (e.min ?? undefined)
                    : (d.min_value ?? undefined)
                }
                max={
                  scope === "center"
                    ? (e.max ?? undefined)
                    : (d.max_value ?? undefined)
                }
                disabled={busy || locked || !editable}
                value={value}
                onChange={(x) => setValue(x.target.value)}
              />
            )}
          </label>
          {scope === "organization" && (
            <label>
              Uygulama
              <select
                disabled={busy || !editable}
                value={mode}
                onChange={(x) => setMode(x.target.value as typeof mode)}
              >
                <option value="recommended">Tavsiye / varsayılan</option>
                <option value="mandatory">Zorunlu</option>
              </select>
            </label>
          )}
          {scope === "organization" && d.kind === "number" && (
            <>
              <label>
                Merkeze izin verilen alt sınır
                <input
                  required
                  type="number"
                  step="1"
                  min={d.min_value ?? undefined}
                  max={d.max_value ?? undefined}
                  value={min}
                  disabled={busy || !editable}
                  onChange={(x) => setMin(x.target.value)}
                />
              </label>
              <label>
                Merkeze izin verilen üst sınır
                <input
                  required
                  type="number"
                  step="1"
                  min={d.min_value ?? undefined}
                  max={d.max_value ?? undefined}
                  value={max}
                  disabled={busy || !editable}
                  onChange={(x) => setMax(x.target.value)}
                />
              </label>
            </>
          )}
        </div>
        {editable && !locked && (
          <>
            <label>
              Değişiklik gerekçesi
              <textarea
                required
                minLength={3}
                maxLength={500}
                value={reason}
                disabled={busy}
                onChange={(x) => setReason(x.target.value)}
              />
            </label>
            <div className="form-actions">
              <button className="primary-action" disabled={busy} type="submit">
                Kaydet
              </button>
              {scope === "center" && e.center_revision > 0 && (
                <button
                  className="secondary-action"
                  disabled={busy || reason.trim().length < 3}
                  type="button"
                  onClick={(event) => void submit(event, true)}
                >
                  Organizasyon varsayılanına dön
                </button>
              )}
            </div>
          </>
        )}
        {locked && <p>Bu ayar organizasyon tarafından zorunlu tutuluyor.</p>}
        {!editable && (
          <p>
            Organizasyon ayarını yalnızca organizasyon sahibi değiştirebilir.
          </p>
        )}
        {message && <p role="status">{message}</p>}
      </form>
    </section>
  );
}
function ExceptionForm({ data }: { data: PolicyWorkspace }) {
  const router = useRouter();
  const [lesson, setLesson] = useState("");
  const [member, setMember] = useState("");
  const [operation, setOperation] = useState("student_cancel");
  const [rule, setRule] = useState("private_cancel_hours");
  const [value, setValue] = useState("0");
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  if (!data.organizations.some((o) => o.can_edit)) return null;
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      const r = await applyPolicyException({
        lesson_id: lesson,
        member_id: member,
        operation,
        overrides: {
          [rule]:
            rule === "private_cancel_hours" ? Number(value) : value === "true",
        },
        reason,
      });
      setMessage(r.ok ? r.message : r.error);
      if (r.ok) router.refresh();
    } catch {
      setMessage("İstisna uygulanamadı.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="form-card">
      <h2>Gerekçeli iptal / gelmeme istisnası</h2>
      <p>
        Bu işlem seçilen katılımcının iptalini veya gelmeme kaydını hemen
        uygular. Genel ayarı değiştirmez; organizasyon sahibi yetkisi ve denetim
        kaydı gerekir.
      </p>
      <form className="record-form" onSubmit={submit}>
        <div className="field-grid">
          <label>
            Ders
            <select
              required
              value={lesson}
              disabled={busy}
              onChange={(e) => {
                setLesson(e.target.value);
                setMember("");
              }}
            >
              <option value="">Ders seçin</option>
              {[
                ...new Map(
                  data.exception_participants.map((p) => [
                    p.lesson_id,
                    p.lesson_label,
                  ]),
                ).entries(),
              ].map(([id, label]) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Öğrenci
            <select
              required
              value={member}
              disabled={busy || !lesson}
              onChange={(e) => setMember(e.target.value)}
            >
              <option value="">Öğrenci seçin</option>
              {data.exception_participants
                .filter((p) => p.lesson_id === lesson)
                .map((p) => (
                  <option key={p.member_id} value={p.member_id}>
                    {p.member_name}
                  </option>
                ))}
            </select>
          </label>
          <label>
            İşlem
            <select
              value={operation}
              disabled={busy}
              onChange={(e) => setOperation(e.target.value)}
            >
              <option value="student_cancel">Öğrenci iptali</option>
              <option value="no_show">Gelmedi</option>
            </select>
          </label>
          <label>
            İstisna kuralı
            <select
              value={rule}
              disabled={busy}
              onChange={(e) => {
                setRule(e.target.value);
                setValue(
                  e.target.value === "private_cancel_hours" ? "0" : "false",
                );
              }}
            >
              {data.definitions
                .filter((d) =>
                  [
                    "private_cancel_hours",
                    "group_cancel_refund",
                    "late_cancel_charge",
                    "no_show_charge",
                  ].includes(d.key),
                )
                .map((d) => (
                  <option key={d.key} value={d.key}>
                    {d.label}
                  </option>
                ))}
            </select>
          </label>
          <label htmlFor="exception-rule-value">
            Bu işlemde uygulanacak değer
            {rule === "private_cancel_hours" ? (
              <input
                id="exception-rule-value"
                type="number"
                min={0}
                max={168}
                required
                value={value}
                disabled={busy}
                onChange={(e) => setValue(e.target.value)}
              />
            ) : (
              <select
                id="exception-rule-value"
                value={value}
                disabled={busy}
                onChange={(e) => setValue(e.target.value)}
              >
                <option value="false">Hayır</option>
                <option value="true">Evet</option>
              </select>
            )}
          </label>
          <label>
            Gerekçe
            <textarea
              required
              minLength={3}
              maxLength={500}
              value={reason}
              disabled={busy}
              onChange={(e) => setReason(e.target.value)}
            />
          </label>
        </div>
        <button className="primary-action" disabled={busy} type="submit">
          İstisnayla işlemi uygula
        </button>
        {message && <p role="status">{message}</p>}
      </form>
    </section>
  );
}
export function PolicySettings({ data }: { data: PolicyWorkspace }) {
  const [scope, setScope] = useState<"organization" | "center">("center");
  const [centerId, setCenterId] = useState(data.centers[0]?.id ?? "");
  const [orgId, setOrgId] = useState(data.organizations[0]?.id ?? "");
  const center = data.centers.find((c) => c.id === centerId);
  const org = data.organizations.find((o) => o.id === orgId);
  return (
    <div className="dashboard-content">
      <div className="page-heading">
        <div>
          <p className="eyebrow">İŞLETME KURALLARI</p>
          <h1>Organizasyon ve merkez ayarları</h1>
          <p>
            Zorunlu kurallar tüm yöneticileri bağlar. Tavsiye ayarları izin
            verilen sınırlar içinde merkezde değiştirilebilir. Geçmiş işlemler
            yeniden hesaplanmaz.
          </p>
        </div>
      </div>
      <section className="form-card field-grid">
        <label>
          Ayar kapsamı
          <select
            value={scope}
            onChange={(e) => setScope(e.target.value as typeof scope)}
          >
            <option value="center">Merkez</option>
            <option value="organization">Organizasyon</option>
          </select>
        </label>
        {scope === "center" ? (
          <label>
            Merkez
            <select
              value={centerId}
              onChange={(e) => setCenterId(e.target.value)}
            >
              {data.centers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <label>
            Organizasyon
            <select value={orgId} onChange={(e) => setOrgId(e.target.value)}>
              {data.organizations.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          </label>
        )}
      </section>
      {data.definitions.map((d) => {
        const row = data.organization_policies.find(
          (o) => o.organization_id === orgId && o.key === d.key,
        );
        const e: Effective =
          scope === "center"
            ? (center?.effective[d.key] ?? {
                value: d.default_value,
                source: "organization_default",
                mode: "recommended",
                organization_revision: 0,
                center_revision: 0,
                min: d.min_value,
                max: d.max_value,
                override_stored: null,
                override_active: false,
              })
            : {
                value: row?.value ?? d.default_value,
                mode: row?.mode ?? "recommended",
                source: "organization_default",
                organization_revision: row?.revision ?? 0,
                center_revision: 0,
                min: row?.min_value ?? d.min_value,
                max: row?.max_value ?? d.max_value,
                override_stored: null,
                override_active: false,
              };
        const id = scope === "center" ? centerId : orgId;
        return id ? (
          <Editor
            key={
              scope + id + d.key + e.organization_revision + e.center_revision
            }
            d={d}
            e={e}
            scope={scope}
            id={id}
            editable={scope === "center" || Boolean(org?.can_edit)}
          />
        ) : null;
      })}
      <ExceptionForm data={data} />
      <section className="table-card">
        <h2>Ayar değişiklik geçmişi</h2>
        <OperationsTable
          rows={data.history.map((row) => ({
            ...row,
            key:
              data.definitions.find((d) => d.key === row.key)?.label ?? row.key,
          }))}
          columns={["key", "action", "reason", "created_at"]}
        />
      </section>
      <section className="table-card">
        <h2>İstisna geçmişi</h2>
        <OperationsTable
          rows={data.exceptions}
          columns={["lesson", "member", "reason", "created_at"]}
        />
      </section>
    </div>
  );
}
