"use client";
import { useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { runOperation } from "@/lib/actions/operations";
import { studioDateTimeInput } from "@/lib/studio-date";
import { OperationsTable } from "@/components/operations-table";

import {
  WorkspaceFields,
  operationPayload,
  type OperationField as Field,
} from "./workspace-fields";
import { useActionRunner } from "./use-action-runner";
import { PageNotice } from "./page-notice";
import type {
  WorkspaceData as Snapshot,
  WorkspaceRow as Item,
  WorkspacePages,
} from "@/lib/workspace";
export type {
  WorkspaceData as Snapshot,
  WorkspaceRow as Item,
} from "@/lib/workspace";
const labels: Record<string, string> = {
  create: "Oluştur",
  waitlist: "Bekleme listesine ekle",
  dequeue: "Bekleme kaydını geri çek",
  promote: "Sıradaki öğrenciyi gruba al",
  enroll: "Öğrenciyi gruba kaydet",
  unenroll: "Grup kaydını kaldır",
  collect: "Manuel tahsilat",
  refund: "Para iadesi",
  reverse: "İşlemi ters kayıtla düzelt",
  student_cancel: "Öğrenci iptali",
  no_show: "Gelmeme kaydı",
  cancel: "Dersi iptal et",
  reschedule: "Dersi ertele",
  makeup: "Telafi dersi oluştur",
  policy: "İptal süresini ayarla",
  update: "Adayı güncelle",
  task: "Takip görevi ekle",
  complete_task: "Görevi tamamla",
  convert: "Üyeye dönüştür",
};
const select = (key: string, label: string, dataset: string): Field => ({
  key,
  label,
  kind: "select",
  dataset,
});
const text = (key: string, label: string, optional = false): Field => ({
  key,
  label,
  optional,
});
const when = (key: string, label: string, optional = false): Field => ({
  key,
  label: label + " (İstanbul saati)",
  kind: "datetime-local",
  optional,
});
const baseNote = text("note", "Açıklama");
const definitions: Record<string, Record<string, Field[]>> = {
  groups: {
    create: [
      select("center_id", "Merkez", "centers"),
      text("name", "Grup adı"),
      select("room_id", "Oda", "rooms"),
      select("instructor_id", "Eğitmen", "instructors"),
      { key: "capacity", label: "Kontenjan", kind: "number", value: "20" },
      {
        key: "weeks",
        label: "Haftalık ders sayısı",
        kind: "number",
        value: "4",
      },
      when("starts_at", "İlk başlangıç"),
      when("ends_at", "İlk bitiş"),
    ],
    waitlist: [
      select("group_id", "Grup", "groups"),
      select("member_id", "Öğrenci", "members"),
    ],
    dequeue: [
      select("group_id", "Grup", "groups"),
      select("member_id", "Öğrenci", "members"),
    ],
    promote: [select("group_id", "Grup", "groups")],
    enroll: [
      select("group_id", "Grup", "groups"),
      select("member_id", "Öğrenci", "members"),
    ],
    unenroll: [
      select("group_id", "Grup", "groups"),
      select("member_id", "Öğrenci", "members"),
    ],
  },
  payments: {
    collect: [
      select("subscription_id", "Paket", "subscriptions"),
      { key: "amount", label: "Tahsilat tutarı (TL)", kind: "number" },
      when("occurred_at", "Tahsilat tarihi"),
      { ...select("method", "Ödeme yöntemi", "methods"), value: "cash" },
      baseNote,
    ],
    refund: [
      select("subscription_id", "Paket", "subscriptions"),
      { key: "amount", label: "İade tutarı (TL)", kind: "number" },
      when("occurred_at", "İade tarihi"),
      { ...select("method", "Ödeme yöntemi", "methods"), value: "cash" },
      baseNote,
    ],
    reverse: [
      select("subscription_id", "Paket", "subscriptions"),
      select("entry_id", "Düzeltilecek işlem", "payments"),
      when("occurred_at", "Düzeltme tarihi"),
      baseNote,
    ],
  },
  "lesson-operations": {
    student_cancel: [
      select("lesson_id", "Ders", "lessons"),
      select("member_id", "Öğrenci", "members"),
      baseNote,
    ],
    no_show: [
      select("lesson_id", "Ders", "lessons"),
      select("member_id", "Öğrenci", "members"),
      baseNote,
    ],
    cancel: [select("lesson_id", "Ders", "lessons"), baseNote],
    reschedule: [
      select("lesson_id", "Ders", "lessons"),
      when("starts_at", "Yeni başlangıç"),
      when("ends_at", "Yeni bitiş"),
      baseNote,
    ],
    makeup: [
      select("lesson_id", "İptal / ertelenen ders", "lessons"),
      when("starts_at", "Telafi başlangıcı"),
      when("ends_at", "Telafi bitişi"),
      baseNote,
    ],
  },
  crm: {
    create: [
      select("center_id", "Merkez", "centers"),
      text("full_name", "Ad soyad"),
      { key: "email", label: "E-posta", kind: "email", optional: true },
      text("phone", "Telefon", true),
      text("source", "Kaynak"),
      text("interests", "İlgi alanları", true),
      { key: "notes", label: "Notlar", kind: "textarea", optional: true },
    ],
    update: [
      select("lead_id", "Aday", "leads"),
      select("stage", "Aşama", "stages"),
      when("trial_at", "Deneme dersi", true),
      text("interests", "İlgi alanları", true),
      { key: "notes", label: "Notlar", kind: "textarea", optional: true },
    ],
    task: [
      select("lead_id", "Aday", "leads"),
      text("title", "Takip görevi"),
      when("due_at", "Takip tarihi"),
    ],
    complete_task: [
      select("lead_id", "Aday", "leads"),
      select("task_id", "Görev", "tasks"),
    ],
    convert: [select("lead_id", "Aday", "leads")],
  },
};
const descriptions: Record<string, string> = {
  groups:
    "Haftalık program kesin dersleri oluşturur. Tek bir çakışma varsa serinin tamamı geri alınır. Grup kaydı gelecek derslere aktarılır; geçmiş kayıtlar korunur.",
  payments:
    "Yalnızca manuel / nakit tahsilat. Kısmi ödeme kalan borcu azaltır. Hatalı işlem silinmez; ters kayıt veya iade girilir.",
  "lesson-operations":
    "İptal ve kredi kuralları organizasyon / merkez ayarlarından uygulanır. Özel ders için varsayılan ücretsiz iptal süresi 12 saattir; grup öğrenci iptalinde varsayılan iade yoktur. Eğitmen iptali ve telafi ayrı işlemlerdir.",
  crm: "Pazarlama ve aday müşteri takibi. Bu alan yalnızca merkez yöneticilerine açıktır. Üyeye dönüşüm mevcut e-posta / telefon eşleşmesini kullanır.",
};
const sectionColumns: Record<string, string[]> = {
  waitlist: ["group", "member", "status", "created_at"],
  groups: ["name", "capacity", "enrolled"],
  enrollments: ["group", "member"],
  lessons: [
    "title",
    "group",
    "starts_at",
    "ends_at",
    "status",
    "enrolled",
    "capacity",
  ],
  subscriptions: [
    "label",
    "amount",
    "paid",
    "balance",
    "credit_balance",
    "payment_status",
  ],
  payments: [
    "member",
    "amount",
    "method",
    "kind",
    "occurred_at",
    "note",
    "actor",
  ],
  leads: [
    "full_name",
    "email",
    "phone",
    "source",
    "interests",
    "stage",
    "trial_at",
    "converted_at",
  ],
  tasks: ["lead", "title", "due_at", "completed_at"],
  outcomes: ["title", "member", "outcome", "note", "created_at"],
  changes: [
    "title",
    "action",
    "note",
    "old_starts_at",
    "new_starts_at",
    "created_at",
  ],
  policies: ["cancellation_hours"],
};
const sectionNames: Record<string, string> = {
  waitlist: "Bekleme listesi",
  groups: "Gruplar",
  enrollments: "Grup kayıtları",
  lessons: "Ders listesi",
  subscriptions: "Paket ve borç durumu",
  payments: "Tahsilat defteri",
  leads: "Aday müşteriler",
  tasks: "Takip görevleri",
  outcomes: "İptal ve gelmeme kayıtları",
  changes: "Ders işlem geçmişi",
  policies: "Merkez iptal kuralları",
};
export function OperationsWorkspace({
  module,
  title,
  data,
  manager,
  instructor,
  loadError,
  pages,
}: {
  module: string;
  title: string;
  data: Snapshot;
  manager: boolean;
  instructor: boolean;
  loadError: boolean;
  pages?: WorkspacePages;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const all = definitions[module] ?? {};
  const available = Object.keys(all).filter(
    (action) =>
      module !== "lesson-operations" ||
      manager ||
      (instructor
        ? action !== "policy" && action !== "makeup"
        : action === "student_cancel"),
  );
  const [action, setAction] = useState(
    available.includes(params?.get("action") ?? "")
      ? (params?.get("action") ?? "")
      : (available[0] ?? ""),
  );
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      ["subscription_id", "lesson_id", "member_id", "lead_id"].map((k) => [
        k,
        params?.get(k) ?? "",
      ]),
    ),
  );
  const [key, setKey] = useState(() => crypto.randomUUID());
  const {
    busy,
    error,
    notice: success,
    setError,
    setNotice: setSuccess,
    run,
  } = useActionRunner();
  const fields = all[action] ?? [];
  function options(field: Field) {
    if (field.dataset === "methods")
      return [
        { id: "cash", label: "Nakit" },
        { id: "manual", label: "Diğer manuel ödeme" },
      ];
    if (field.dataset === "stages")
      return ["new", "contacted", "trial", "followup", "lost"].map((id) => ({
        id,
        label: (
          {
            new: "Yeni",
            contacted: "İletişim kuruldu",
            trial: "Deneme dersi",
            followup: "Takip",
            lost: "Kapandı",
          } as Record<string, string>
        )[id],
      }));
    return (data[field.dataset ?? ""] ?? [])
      .filter((item) => {
        if (
          ["rooms", "instructors"].includes(field.dataset ?? "") &&
          values.center_id
        )
          return item.center_id === values.center_id;
        if (field.dataset === "subscriptions" && values.member_id)
          return item.member_id === values.member_id;
        if (field.dataset === "payments" && values.subscription_id)
          return item.subscription_id === values.subscription_id;
        if (field.dataset === "tasks" && values.lead_id)
          return item.lead_id === values.lead_id;
        if (field.dataset === "members" && values.group_id) {
          const g = data.groups?.find((g) => g.id === values.group_id);
          return !g || item.center_id === g.center_id;
        }
        return true;
      })
      .map((item) => ({
        id: String(item.id),
        label: String(
          item.label ??
            item.title ??
            [item.member, item.amount, item.kind].filter(Boolean).join(" · ") ??
            item.id,
        ),
      }));
  }

  function change(key: string, raw: string, selectedRow?: Item) {
    setValues((old) => {
      const next = { ...old, [key]: raw };
      if (key === "center_id") {
        next.room_id = "";
        next.instructor_id = "";
      }
      if (key === "group_id") {
        next.member_id = "";
        next.group_center_id = String(
          selectedRow?.center_id ??
            data.groups?.find((g) => g.id === raw)?.center_id ??
            "",
        );
      }
      if (key === "subscription_id") next.entry_id = "";
      if (key === "lead_id") {
        next.task_id = "";
        if (action === "update") {
          const lead = selectedRow ?? data.leads?.find((l) => l.id === raw);
          if (lead) {
            next.stage = String(
              lead.stage === "converted" ? "followup" : (lead.stage ?? "new"),
            );
            next.interests = String(lead.interests ?? "");
            next.notes = String(lead.notes ?? "");
            next.trial_at = lead.trial_at
              ? studioDateTimeInput(String(lead.trial_at))
              : "";
          }
        }
      }
      return next;
    });
  }
  function startFromRow(nextAction: string, row: Item, section: string) {
    if (!available.includes(nextAction)) return;
    const next: Record<string, string> = {};
    if (section === "subscriptions") next.subscription_id = String(row.id);
    if (section === "payments") {
      next.subscription_id = String(row.subscription_id);
      next.entry_id = String(row.id);
    }
    if (section === "lessons") {
      next.lesson_id = String(row.id);
      if (row.private_member_id) next.member_id = String(row.private_member_id);
    }
    if (section === "groups") {
      next.group_id = String(row.id);
      next.group_center_id = String(row.center_id ?? "");
    }
    if (section === "leads") {
      next.lead_id = String(row.id);
      next.stage = String(
        row.stage === "converted" ? "followup" : (row.stage ?? "new"),
      );
      next.interests = String(row.interests ?? "");
      next.notes = String(row.notes ?? "");
      next.trial_at = row.trial_at
        ? studioDateTimeInput(String(row.trial_at))
        : "";
    }
    if (section === "tasks") {
      next.lead_id = String(row.lead_id);
      next.task_id = String(row.id);
    }
    setAction(nextAction);
    setValues(next);
    setKey(crypto.randomUUID());
    setError("");
    setSuccess("");
    document
      .getElementById("operation-form")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  function rowActions(section: string, row: Item) {
    const candidates =
      section === "subscriptions"
        ? ["collect", "refund"]
        : section === "payments"
          ? ["reverse"]
          : section === "lessons"
            ? module === "lesson-operations"
              ? ["cancel", "reschedule", "student_cancel"]
              : []
            : section === "leads"
              ? ["task", "update", "convert"]
              : section === "tasks" && !row.completed_at
                ? ["complete_task"]
                : section === "groups"
                  ? ["enroll", "waitlist"]
                  : [];
    return candidates
      .filter((a) => available.includes(a))
      .map((a) => (
        <button
          key={a}
          type="button"
          disabled={busy}
          className="text-action"
          onClick={() => startFromRow(a, row, section)}
        >
          {labels[a]}
        </button>
      ));
  }
  function filters(field: Field): Record<string, string> {
    if (
      ["rooms", "instructors"].includes(field.dataset ?? "") &&
      values.center_id
    )
      return { center_id: values.center_id };
    if (field.dataset === "subscriptions" && values.member_id)
      return { member_id: values.member_id };
    if (field.dataset === "payments" && values.subscription_id)
      return { subscription_id: values.subscription_id };
    if (field.dataset === "tasks" && values.lead_id)
      return { lead_id: values.lead_id };
    if (field.dataset === "members" && values.group_center_id)
      return { center_id: values.group_center_id };
    return {};
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const input: Record<string, unknown> = {
      action,
      ...operationPayload(fields, values),
    };
    if (module === "payments") input.key = key;
    await run(() => runOperation(module, input), {
      onSuccess: () => {
        setValues({});
        setKey(crypto.randomUUID());
        router.refresh();
      },
    });
  }
  return (
    <div className="dashboard-content">
      <div className="page-heading">
        <div>
          <p className="eyebrow">STÜDYO İŞLEMLERİ</p>
          <h1>{title}</h1>
          <p className="dashboard-subtitle">{descriptions[module]}</p>
        </div>
      </div>
      {loadError && (
        <p className="notice error" role="alert">
          Veriler yüklenemedi. Sayfayı yenileyin.
        </p>
      )}
      <section className="form-card" id="operation-form">
        <form className="record-form" onSubmit={submit}>
          <label>
            İşlem
            <select
              value={action}
              disabled={busy}
              onChange={(e) => {
                setAction(e.target.value);
                setValues({});
                setError("");
                setSuccess("");
                setKey(crypto.randomUUID());
              }}
            >
              {available.map((a) => (
                <option key={a} value={a}>
                  {labels[a]}
                </option>
              ))}
            </select>
          </label>
          {module === "payments" && (
            <p>
              Fazla tahsilat müşteri alacağı olarak izlenir. Para üstünü
              verdiğinizde aynı paket için iade kaydı girin.
            </p>
          )}
          <WorkspaceFields
            module={module}
            fields={fields}
            values={values}
            busy={busy}
            options={options}
            filters={filters}
            onChange={change}
          />
          {module === "lesson-operations" &&
            data.lessons?.some((l) => l.id === values.lesson_id) && (
              <p>
                Özel ders için bu merkezde ücretsiz iptal sınırı:{" "}
                {String(
                  data.lessons?.find((l) => l.id === values.lesson_id)
                    ?.cancellation_hours ?? 12,
                )}{" "}
                saat önce.
              </p>
            )}
          <PageNotice error={error} notice={success} loadError={false} />
          <button
            className="primary-action"
            disabled={busy || loadError}
            type="submit"
          >
            {busy ? "Kaydediliyor…" : labels[action]}
          </button>
        </form>
      </section>
      {Object.entries(data)
        .filter(
          ([name]) =>
            sectionColumns[name] && name !== "members" && name !== "policies",
        )
        .map(([name, rows]) => (
          <section className="table-card" key={name}>
            <div className="table-toolbar">
              <div>
                <h2>{sectionNames[name]}</h2>
                <p>{rows.length} kayıt</p>
              </div>
            </div>
            <OperationsTable
              rows={rows}
              columns={sectionColumns[name]}
              remote={
                pages?.[name]
                  ? { module, section: name, total: pages[name].total }
                  : undefined
              }
              actions={(row) => rowActions(name, row)}
            />
          </section>
        ))}
    </div>
  );
}
