"use client";
import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type {
  PlanningData as RoadmapData,
  WorkspaceRow as RoadmapRow,
} from "@/lib/workspace";
import { useActionRunner } from "./use-action-runner";
import { PageNotice } from "./page-notice";
import { OperationsTable } from "./operations-table";
import { roadmapCommand } from "@/lib/actions/roadmap";
import { studioDateTime, studioInputToIso } from "@/lib/studio-date";
import { weekDates, resourceUsage } from "@/lib/planning";
export function PlanningWorkspace({
  data,
  from,
  loadError,
}: {
  data: RoadmapData;
  from: string;
  loadError: boolean;
}) {
  const router = useRouter();
  const days = weekDates(from);
  const [center, setCenter] = useState(String(data.centers?.[0]?.id ?? ""));
  const [kind, setKind] = useState("room");
  const [resource, setResource] = useState("");
  const [op, setOp] = useState("hours");
  const [scope, setScope] = useState("center");
  const { busy, error, notice, run } = useActionRunner();
  const resources =
    (kind === "room" ? data.rooms : data.instructors)?.filter(
      (r) => r.center_id === center,
    ) ?? [];
  const shown = resource
    ? resources.filter((r) => r.id === resource)
    : resources;
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const input: Record<string, unknown> = {
      action: op,
      center_id: center,
      resource_kind: scope,
      resource_id: scope === "center" ? "" : String(f.get("resource_id") ?? ""),
    };
    for (const [k, v] of f) {
      if (k === "weekday") input[k] = Number(v);
      else
        input[k] = ["starts_at", "ends_at"].includes(k)
          ? studioInputToIso(String(v))
          : v;
    }
    await run(() => roadmapCommand("planning", input), {
      onSuccess: () => router.refresh(),
    });
  }
  async function remove(row: RoadmapRow, section: string) {
    await run(
      () =>
        roadmapCommand("planning", {
          action: section === "hours" ? "delete_hours" : "delete_block",
          center_id: row.center_id,
          id: row.id,
        }),
      { onSuccess: () => router.refresh() },
    );
  }

  function matches(row: RoadmapRow, id: string) {
    return (
      row.center_id === center &&
      (row.resource_kind === "center" ||
        row[kind === "room" ? "room_id" : "instructor_id"] === id ||
        (row.resource_kind === kind && row.resource_id === id))
    );
  }
  const shift = (n: number) => {
    const d = new Date(from + "T12:00:00Z");
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
  };
  return (
    <div className="dashboard-content">
      <h1>Birleşik haftalık planlama</h1>
      <p>
        Kesin dersler kaynak ayırır. Bekleyen talepler ve grup taslakları kaynak
        ayırmaz. İzin/kapanış kesin dersle çakışırsa önce dersi düzenleyin.
      </p>
      {loadError && (
        <p className="notice error" role="alert">
          Takvim yüklenemedi.
        </p>
      )}
      <div className="table-toolbar">
        <Link href={"/dashboard/planning?from=" + shift(-7)}>Önceki hafta</Link>
        <strong>
          {days[0]} — {days[6]}
        </strong>
        <Link href={"/dashboard/planning?from=" + shift(7)}>Sonraki hafta</Link>
        <label>
          Merkez
          <select
            value={center}
            onChange={(e) => {
              setCenter(e.target.value);
              setResource("");
            }}
          >
            {data.centers?.map((c) => (
              <option key={String(c.id)} value={String(c.id)}>
                {String(c.label)}
              </option>
            ))}
          </select>
        </label>
        <label>
          Görünüm
          <select
            value={kind}
            onChange={(e) => {
              setKind(e.target.value);
              setResource("");
            }}
          >
            <option value="room">Odalar</option>
            <option value="instructor">Eğitmenler</option>
          </select>
        </label>
        <label>
          Kaynak
          <select
            value={resource}
            onChange={(e) => setResource(e.target.value)}
          >
            <option value="">Tümü</option>
            {resources.map((r) => (
              <option key={String(r.id)} value={String(r.id)}>
                {String(r.label)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p>
        Ders · kesin / Talep · bekliyor / Taslak · grup / Kapalı · izin. Çalışma
        saatleri tüm hafta için tanımlı değilse kullanım yüzdesi gösterilmez.
      </p>
      {shown.map((r) => {
        const id = String(r.id);
        const usage = resourceUsage({
          days,
          centerId: center,
          kind,
          resourceId: id,
          hours: data.hours,
          blocks: data.blocks,
          lessons: data.lessons,
        });
        return (
          <section className="table-card" key={id}>
            <h2>{String(r.label)}</h2>
            <p>
              {usage.reservedHours.toFixed(1)} saat ders ·{" "}
              {usage.availableHours === null
                ? "Kullanılabilir süre eksik"
                : usage.availableHours.toFixed(1) + " saat kullanılabilir"}{" "}
              ·{" "}
              {usage.ratio === null
                ? "Oran hesaplanmadı"
                : usage.ratio.toFixed(1) + "% kullanım"}
            </p>
            <div className="table-scroll">
              <div className="week-grid">
                {days.map((day) => (
                  <div className="week-day" key={day}>
                    <h3>
                      {new Intl.DateTimeFormat("tr-TR", {
                        weekday: "short",
                        day: "numeric",
                        month: "short",
                        timeZone: "Europe/Istanbul",
                      }).format(new Date(day + "T12:00:00Z"))}
                    </h3>
                    {(data.hours ?? [])
                      .filter(
                        (h) =>
                          h.center_id === center &&
                          (h.resource_kind === "center" ||
                            (h.resource_kind === kind &&
                              h.resource_id === id)) &&
                          Number(h.weekday) ===
                            ((new Date(day + "T12:00:00Z").getUTCDay() + 6) %
                              7) +
                              1,
                      )
                      .map((h) => (
                        <small key={String(h.id)}>
                          Çalışma: {String(h.opens).slice(0, 5)}–
                          {String(h.closes).slice(0, 5)}
                          <br />
                        </small>
                      ))}
                    {(["lessons", "requests", "blocks"] as const).flatMap(
                      (section) =>
                        (data[section] ?? [])
                          .filter(
                            (row) =>
                              matches(row, id) &&
                              String(row.starts_at) &&
                              Date.parse(String(row.starts_at)) <
                                Date.parse(day + "T23:59:59+03:00") &&
                              Date.parse(String(row.ends_at)) >
                                Date.parse(day + "T00:00:00+03:00"),
                          )
                          .map((row) => (
                            <article
                              key={section + String(row.id)}
                              className={
                                "calendar-event " +
                                (section === "requests"
                                  ? "request"
                                  : section === "blocks"
                                    ? String(row.kind)
                                    : String(row.status))
                              }
                            >
                              <strong>
                                {section === "requests"
                                  ? "Talep · "
                                  : section === "blocks"
                                    ? row.kind === "closed"
                                      ? "Kapalı · "
                                      : "Taslak · "
                                    : "Ders · "}
                                {String(row.title)}
                              </strong>
                              <small>
                                {studioDateTime(String(row.starts_at))} —{" "}
                                {studioDateTime(String(row.ends_at))}
                              </small>
                              <small>
                                {String(row.room ?? "")}{" "}
                                {String(row.instructor ?? "")}
                              </small>
                              {section === "lessons" ? (
                                <Link
                                  href={
                                    "/dashboard/lesson-operations?lesson_id=" +
                                    String(row.id) +
                                    "&action=cancel"
                                  }
                                >
                                  Dersi aç
                                </Link>
                              ) : section === "requests" ? (
                                <Link
                                  href={
                                    "/dashboard/session-requests?q=" +
                                    encodeURIComponent(String(row.title))
                                  }
                                >
                                  Talebi incele
                                </Link>
                              ) : null}
                            </article>
                          )),
                    )}
                  </div>
                ))}
              </div>
            </div>
          </section>
        );
      })}
      <section className="form-card">
        <h2>Çalışma saatleri ve planlama</h2>
        <form className="record-form" onSubmit={submit}>
          <div className="field-grid">
            <label>
              İşlem
              <select value={op} onChange={(e) => setOp(e.target.value)}>
                <option value="hours">Haftalık çalışma saati</option>
                <option value="block">İzin / grup taslağı</option>
              </select>
            </label>
            <label>
              Kapsam
              <select value={scope} onChange={(e) => setScope(e.target.value)}>
                <option value="center">Merkez</option>
                <option value="room">Oda</option>
                <option value="instructor">Eğitmen</option>
              </select>
            </label>
            {scope !== "center" && (
              <label>
                Kaynak
                <select name="resource_id" required>
                  {(scope === "room" ? data.rooms : data.instructors)
                    ?.filter((r) => r.center_id === center)
                    .map((r) => (
                      <option key={String(r.id)} value={String(r.id)}>
                        {String(r.label)}
                      </option>
                    ))}
                </select>
              </label>
            )}
            {op === "hours" ? (
              <>
                <label>
                  Gün
                  <select name="weekday">
                    {[
                      "Pazartesi",
                      "Salı",
                      "Çarşamba",
                      "Perşembe",
                      "Cuma",
                      "Cumartesi",
                      "Pazar",
                    ].map((d, i) => (
                      <option key={d} value={i + 1}>
                        {d}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Açılış
                  <input name="opens" type="time" required />
                </label>
                <label>
                  Kapanış
                  <input name="closes" type="time" required />
                </label>
              </>
            ) : (
              <>
                <label>
                  Tür
                  <select name="kind">
                    <option value="closed">İzin / kapalı</option>
                    <option value="group_draft">Düşünülen grup saati</option>
                  </select>
                </label>
                <label>
                  Başlık
                  <input name="title" required maxLength={160} />
                </label>
                <label>
                  Başlangıç (İstanbul)
                  <input type="datetime-local" name="starts_at" required />
                </label>
                <label>
                  Bitiş (İstanbul)
                  <input type="datetime-local" name="ends_at" required />
                </label>
              </>
            )}
          </div>
          <button disabled={busy || loadError || !center} type="submit">
            Kaydet
          </button>
        </form>
      </section>
      <PageNotice error={error} notice={notice} loadError={false} />
      {(["hours", "blocks"] as const).map((section) => (
        <section className="table-card" key={section}>
          <h2>
            {section === "hours" ? "Çalışma saatleri" : "İzinler ve taslaklar"}
          </h2>
          <OperationsTable
            rows={(data[section] ?? []).filter((r) => r.center_id === center)}
            columns={
              section === "hours"
                ? ["resource_kind", "resource_id", "weekday", "opens", "closes"]
                : ["title", "resource_kind", "kind", "starts_at", "ends_at"]
            }
            actions={(row) => (
              <button
                type="button"
                disabled={busy}
                onClick={() => remove(row, section)}
              >
                Kaldır
              </button>
            )}
          />
        </section>
      ))}
    </div>
  );
}
