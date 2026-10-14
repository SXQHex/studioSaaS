"use client";
import { useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { openRegistrationDocument } from "@/lib/registration-documents";
import { OperationsTable } from "./operations-table";
import { roadmapCommand, processEmailQueue } from "@/lib/actions/roadmap";
import {
  WorkspaceFields,
  operationPayload,
  type OperationField as Field,
} from "./workspace-fields";
import { useActionRunner } from "./use-action-runner";
import { PageNotice } from "./page-notice";
import type {
  WorkspaceRow as RoadmapRow,
  WorkspaceData as RoadmapData,
  WorkspacePages,
} from "@/lib/workspace";
export type {
  WorkspaceRow as RoadmapRow,
  WorkspaceData as RoadmapData,
} from "@/lib/workspace";
const sel = (key: string, label: string, dataset: string): Field => ({
  key,
  label,
  dataset,
});
const txt = (
  key: string,
  label: string,
  kind = "text",
  value?: string,
): Field => ({ key, label, kind, value });
const choice = (key: string, label: string, choices: string[]): Field => ({
  key,
  label,
  choices,
});
const labels: Record<string, string> = {
  create: "Oluştur",
  archive: "Satışı kapat",
  sell: "Paket sat",
  freeze: "Dondur",
  form: "Başvuru formu aç",
  toggle_form: "Form durumunu değiştir",
  trial: "Deneme sonucunu kaydet",
  assign: "Görev sorumlusu ata",
  retry: "Yeniden dene",
  publish: "Yeni kural sürümü yayımla",
  retire: "Kural sürümünü kapat",
  requirements: "Kayıt gereksinimlerini ayarla",
};
const definitions: Record<string, Record<string, Field[]>> = {
  catalog: {
    create: [
      sel("center_id", "Merkez", "centers"),
      txt("name", "Paket adı"),
      choice("lesson_type", "Ders türü", ["private", "group"]),
      txt("credits", "Ders kredisi", "number", "4"),
      txt("price", "Fiyat (TL)", "number"),
      txt("validity_days", "Geçerlilik (gün)", "number", "90"),
      txt("freeze_days", "Toplam dondurma gün sınırı", "number", "0"),
      txt("freeze_count", "Dondurma sayısı sınırı", "number", "0"),
    ],
    sell: [
      sel("member_id", "Öğrenci", "members"),
      sel("catalog_id", "Paket", "catalog"),
      txt("starts_on", "Başlangıç", "date"),
    ],
    archive: [sel("id", "Paket", "catalog")],
    freeze: [
      sel("subscription_id", "Satılan paket", "subscriptions"),
      txt("starts_on", "Dondurma başlangıcı", "date"),
      txt("ends_on", "Dondurma bitişi", "date"),
      txt("note", "Gerekçe"),
    ],
  },
  "crm-automation": {
    form: [
      sel("center_id", "Merkez", "centers"),
      txt("slug", "Form adresi (küçük harf, rakam, tire)"),
      txt("title", "Başvuru başlığı"),
    ],
    toggle_form: [
      sel("id", "Form", "forms"),
      txt("active", "Başvurulara açık", "checkbox"),
    ],
    trial: [
      sel("lead_id", "Aday", "leads"),
      choice("outcome", "Deneme sonucu", ["attended", "cancelled", "no_show"]),
    ],
    assign: [
      sel("task_id", "Görev", "tasks"),
      sel("assigned_to", "Sorumlu yönetici", "managers"),
    ],
  },
  progress: {
    create: [
      sel("member_id", "Öğrenci", "members"),
      choice("lesson_type", "Ders türü", ["private", "group"]),
      txt("level", "Seviye"),
      txt("skill", "Beceri"),
      txt("score", "Değerlendirme (1–5)", "number", "3"),
      { ...txt("note", "Değerlendirme notu", "textarea"), optional: true },
      txt("student_visible", "Öğrenciye göster", "checkbox"),
    ],
  },
  communication: { retry: [sel("id", "Başarısız gönderim", "emails")] },
  registration: {
    publish: [
      {
        ...sel(
          "center_id",
          "Merkez (organizasyon için boş bırakın)",
          "centers",
        ),
        optional: true,
      },
      {
        key: "organization_id",
        label: "Organizasyon kimliği (merkez seçilmediyse)",
        optional: true,
      },
      txt("title", "Kural başlığı"),
      txt("body", "Kural metni", "textarea"),
      txt("required", "Zorunlu kabul", "checkbox", "true"),
    ],
    retire: [sel("policy_id", "Kural sürümü", "policies")],
    requirements: [
      sel("center_id", "Merkez", "centers"),
      txt("emergency_contact", "Acil iletişim gerekli", "checkbox"),
      txt("document_required", "Belge gerekli", "checkbox"),
    ],
  },
};
const columnSets: Record<string, string[]> = {
  catalog: [
    "name",
    "lesson_type",
    "credits",
    "price",
    "validity_days",
    "freeze_days",
    "active",
  ],
  subscriptions: [
    "label",
    "credits_remaining",
    "ends_on",
    "effective_ends_on",
    "status",
  ],
  freezes: ["subscription_id", "starts_on", "ends_on", "note"],
  forms: ["title", "slug", "active"],
  leads: ["full_name", "source", "trial_at", "trial_outcome", "stage"],
  tasks: ["lead", "title", "due_at", "assigned_to", "completed_at"],
  progress: [
    "member",
    "lesson_type",
    "level",
    "skill",
    "score",
    "note",
    "student_visible",
    "created_at",
  ],
  emails: [
    "title",
    "status",
    "attempts",
    "last_error",
    "created_at",
    "updated_at",
  ],
  policies: ["title", "required", "published_at"],
  members: ["full_name", "phone", "missing"],
  documents: ["title", "member_id", "created_at"],
};
const sectionLabels: Record<string, string> = {
  catalog: "Paket kataloğu",
  subscriptions: "Satılan paketler",
  freezes: "Dondurma geçmişi",
  forms: "Başvuru formları",
  leads: "Adaylar",
  tasks: "Takip görevleri",
  progress: "Gelişim geçmişi",
  emails: "E-posta teslimleri",
  policies: "Yayımlanan kurallar",
  members: "Kayıt eksikleri",
  documents: "Kayıt belgeleri",
};
export function RoadmapWorkspace({
  module,
  title,
  data,
  loadError,
  canWrite = true,
  pages,
}: {
  module: string;
  title: string;
  data: RoadmapData;
  loadError: boolean;
  canWrite?: boolean;
  pages?: WorkspacePages;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const ops = definitions[module] ?? {};
  const [action, setAction] = useState(
    params?.get("member_id") && module === "catalog"
      ? "sell"
      : (Object.keys(ops)[0] ?? ""),
  );
  const [values, setValues] = useState<Record<string, string>>(() => ({
    member_id: params?.get("member_id") ?? "",
  }));
  const [key, setKey] = useState(() => crypto.randomUUID());
  const { busy, error, notice, run } = useActionRunner();
  function start(a: string, row: RoadmapRow, section: string) {
    setAction(a);
    setValues(
      section === "catalog"
        ? { id: String(row.id), catalog_id: String(row.id) }
        : section === "subscriptions"
          ? { subscription_id: String(row.id) }
          : section === "leads"
            ? { lead_id: String(row.id) }
            : section === "tasks"
              ? { task_id: String(row.id) }
              : { id: String(row.id) },
    );
    setKey(crypto.randomUUID());
    document
      .getElementById("roadmap-form")
      ?.scrollIntoView({ behavior: "smooth" });
  }
  async function openDocument(path: string) {
    await run(() => openRegistrationDocument(path));
  }
  function options(f: Field) {
    if (f.choices)
      return f.choices.map((c) => ({
        id: c,
        label:
          (
            {
              private: "Özel ders",
              group: "Grup dersi",
              attended: "Katıldı",
              cancelled: "İptal",
              no_show: "Gelmedi",
            } as Record<string, string>
          )[c] ?? c,
      }));
    return (data[f.dataset ?? ""] ?? []).map((row) => ({
      id: String(row.id),
      label: String(
        row.label ?? row.name ?? row.title ?? row.full_name ?? row.id,
      ),
    }));
  }
  function filters(f: Field): Record<string, string> {
    if (f.dataset === "catalog" && action === "sell")
      return {
        ...(values.member_center_id
          ? { center_id: values.member_center_id }
          : {}),
        active: "true",
      };
    return {};
  }
  function change(k: string, value: string, row?: RoadmapRow) {
    setValues((old) => ({
      ...old,
      [k]: value,
      ...(k === "member_id"
        ? {
            catalog_id: "",
            member_center_id: String(
              row?.center_id ??
                data.members?.find((m) => m.id === value)?.center_id ??
                "",
            ),
          }
        : {}),
    }));
  }
  async function submit(e: FormEvent) {
    e.preventDefault();
    const input: Record<string, unknown> = {
      action,
      ...operationPayload(ops[action] ?? [], values),
    };
    if (module === "catalog" && action === "sell") input.key = key;
    await run(() => roadmapCommand(module, input), {
      onSuccess: () => {
        setKey(crypto.randomUUID());
        setValues({});
        router.refresh();
      },
    });
  }
  return (
    <div className="dashboard-content">
      <div className="page-heading">
        <div>
          <p className="eyebrow">STÜDYO</p>
          <h1>{title}</h1>
        </div>
      </div>
      {loadError && (
        <p className="notice error" role="alert">
          Veriler yüklenemedi.
        </p>
      )}
      {module === "catalog" && (
        <p>
          Kataloğa yalnızca sattığınız paketleri ekleyin. Satış koşulları
          korunur; yeni koşul için yeni paket oluşturun. Tahsilatı manuel
          tahsilat ekranından kaydedin.
        </p>
      )}
      {module === "progress" && (
        <p>
          Bir ders türü ve küçük eğitmen grubuyla başlayın. 1: başlangıç, 3:
          uyguluyor, 5: bağımsız uyguluyor. Yalnızca öğrenciye göster seçilen
          değerlendirmeler öğrenci paneline yansır.
        </p>
      )}
      {module === "communication" && (
        <button
          type="button"
          disabled={busy}
          onClick={() =>
            run(processEmailQueue, { onSuccess: () => router.refresh() })
          }
        >
          Kuyruğu işle ve teslimleri kontrol et
        </button>
      )}
      {canWrite && Object.keys(ops).length > 0 && (
        <section className="form-card" id="roadmap-form">
          <form className="record-form" onSubmit={submit}>
            <label>
              İşlem
              <select
                value={action}
                onChange={(e) => {
                  setAction(e.target.value);
                  setValues({});
                  setKey(crypto.randomUUID());
                }}
                disabled={busy}
              >
                {Object.keys(ops).map((a) => (
                  <option key={a} value={a}>
                    {labels[a]}
                  </option>
                ))}
              </select>
            </label>
            <WorkspaceFields
              module={module}
              fields={ops[action] ?? []}
              values={values}
              busy={busy}
              options={options}
              filters={filters}
              onChange={change}
            />
            <button
              type="submit"
              className="primary-action"
              disabled={busy || loadError}
            >
              {busy ? "Kaydediliyor…" : labels[action]}
            </button>
          </form>
        </section>
      )}
      <PageNotice error={error} notice={notice} loadError={false} />
      {Object.entries(data)
        .filter(([s]) => columnSets[s])
        .map(([section, rows]) => (
          <section className="table-card" key={section}>
            <h2>{sectionLabels[section]}</h2>
            <OperationsTable
              rows={rows}
              columns={columnSets[section]}
              remote={
                pages?.[section]
                  ? { module, section, total: pages[section].total }
                  : undefined
              }
              actions={(row) => (
                <>
                  {section === "documents" && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => openDocument(String(row.object_path))}
                    >
                      Belgeyi aç
                    </button>
                  )}
                  {section === "catalog" && canWrite && row.active && (
                    <>
                      <button
                        type="button"
                        onClick={() => start("sell", row, section)}
                      >
                        Sat
                      </button>
                      <button
                        type="button"
                        onClick={() => start("archive", row, section)}
                      >
                        Satışı kapat
                      </button>
                    </>
                  )}
                  {section === "subscriptions" &&
                    module === "catalog" &&
                    canWrite && (
                      <>
                        <button
                          type="button"
                          onClick={() => start("freeze", row, section)}
                        >
                          Dondur
                        </button>
                        <Link
                          href={
                            "/dashboard/payments?action=collect&subscription_id=" +
                            String(row.id)
                          }
                        >
                          Tahsilat
                        </Link>
                      </>
                    )}
                  {section === "forms" && (
                    <Link href={"/apply/" + String(row.slug)}>
                      Başvuru formunu aç
                    </Link>
                  )}
                  {section === "leads" && module === "crm-automation" && (
                    <button
                      type="button"
                      onClick={() => start("trial", row, section)}
                    >
                      Deneme sonucu
                    </button>
                  )}
                  {section === "tasks" && module === "crm-automation" && (
                    <button
                      type="button"
                      onClick={() => start("assign", row, section)}
                    >
                      Sorumlu ata
                    </button>
                  )}
                  {section === "emails" &&
                    ["failed", "retry"].includes(String(row.status)) && (
                      <button
                        type="button"
                        onClick={() => start("retry", row, section)}
                      >
                        Yeniden dene
                      </button>
                    )}
                </>
              )}
            />
          </section>
        ))}
    </div>
  );
}
