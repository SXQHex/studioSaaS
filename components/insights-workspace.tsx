"use client";
import Link from "next/link";
import { OperationsTable } from "./operations-table";
import type { InsightsData, WorkspaceRow as RoadmapRow } from "@/lib/workspace";
export function InsightsWorkspace({
  data,
  from,
  to,
  loadError,
}: {
  data: InsightsData;
  from: string;
  to: string;
  loadError: boolean;
}) {
  const previous = data.previous;
  const sum = (rows: RoadmapRow[] | undefined, k: string) =>
    rows?.reduce((n, r) => n + Number(r[k] ?? 0), 0) ?? 0;
  const ratio = (rows: RoadmapRow[] | undefined) => {
    const r = rows?.filter((l) => l.status === "completed");
    return r?.length && sum(r, "enrolled") > 0
      ? (sum(r, "attended") / sum(r, "enrolled")) * 100
      : null;
  };
  const values = [
    {
      label: "Net tahsilat (TL)",
      now: sum(data.payments, "amount"),
      before: sum(previous.payments, "amount"),
    },
    {
      label: "Yeni aday",
      now: data.crm?.length ?? 0,
      before: previous.crm?.length ?? 0,
    },
    {
      label: "Tamamlanan ders katılımı (%)",
      now: ratio(data.lessons),
      before: ratio(previous.lessons),
    },
  ];
  return (
    <div className="dashboard-content">
      <h1>Müdahale ve dönem analizi</h1>
      <form method="get" className="form-card field-grid">
        <label>
          Başlangıç
          <input type="date" name="from" defaultValue={from} required />
        </label>
        <label>
          Bitiş
          <input type="date" name="to" defaultValue={to} required />
        </label>
        <button type="submit">Karşılaştır</button>
      </form>
      <p>
        Önceki eşit uzunluktaki dönemle karşılaştırılır. Tahsilat alınan
        paradır; satış veya kampanyaya atfedilen gelir değildir. 30 günlük
        katılımsızlık takip önerisidir, kesin öğrenci kaybı değildir.
      </p>
      {loadError ? (
        <p className="notice error" role="alert">
          Analiz yüklenemedi.
        </p>
      ) : (
        <>
          <div className="metric-grid">
            {values.map((v) => (
              <article className="metric-card" key={v.label}>
                <p>{v.label}</p>
                <strong>
                  {v.now === null || !Number.isFinite(v.now)
                    ? "—"
                    : v.now.toLocaleString("tr-TR", {
                        maximumFractionDigits: 1,
                      })}
                </strong>
                <p>
                  Önceki:{" "}
                  {v.before === null || !Number.isFinite(v.before)
                    ? "—"
                    : v.before.toLocaleString("tr-TR", {
                        maximumFractionDigits: 1,
                      })}
                </p>
              </article>
            ))}
          </div>
          <section className="table-card">
            <h2>Müdahale gereken kayıtlar</h2>
            <OperationsTable
              rows={data.interventions ?? []}
              columns={["member", "reason"]}
              actions={(r) => (
                <Link href={String(r.href)}>İlgili kaydı aç</Link>
              )}
            />
          </section>
          <section className="table-card">
            <h2>Aday kaynağı dönüşümü</h2>
            <p>
              Seçilen dönemde oluşturulan adayların güncel deneme/üyelik durumu.
            </p>
            <OperationsTable
              rows={data.sources ?? []}
              columns={["source", "leads", "trials", "conversions"]}
            />
          </section>
          <section className="table-card">
            <h2>Haftalık katılım eğilimi</h2>
            <OperationsTable
              rows={data.attendance_trend ?? []}
              columns={["week", "marked", "present"]}
            />
          </section>
        </>
      )}
    </div>
  );
}
