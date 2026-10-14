import Link from "next/link";
import { requireRole } from "@/lib/supabase/access";
import { OperationsTable } from "@/components/operations-table";
import { reportRange } from "@/lib/validation/operations";
type Row = Record<string, unknown>;
type Report = Record<string, Row[]>;
const definitions: Record<string, { title: string; columns: string[] }> = {
  payments: {
    title: "Tahsilat, iade ve düzeltme",
    columns: ["member", "amount", "method", "kind", "occurred_at", "note"],
  },
  balances: {
    title: "Dönem sonu borç",
    columns: [
      "member",
      "amount",
      "paid",
      "balance",
      "status",
      "credits_remaining",
    ],
  },
  renewals: {
    title: "Yenileme adayları",
    columns: ["member", "ends_on", "credits_remaining"],
  },
  lessons: {
    title: "Ders doluluğu",
    columns: [
      "title",
      "starts_at",
      "status",
      "capacity",
      "enrolled",
      "attended",
    ],
  },
  usage: {
    title: "Oda ve eğitmen kullanımı",
    columns: ["room", "instructor", "hours", "lessons"],
  },
  crm: {
    title: "CRM dönüşümleri · dönemde oluşturulan adaylar",
    columns: ["name", "source", "stage", "created_at", "converted_at"],
  },
};
export const metadata = { title: "Yönetim raporları | FTK Studio" };
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { supabase } = await requireRole(["admin"]);
  const params = await searchParams;
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const parsed = reportRange.safeParse({
    from:
      typeof params.from === "string" ? params.from : today.slice(0, 8) + "01",
    to: typeof params.to === "string" ? params.to : today,
  });
  if (!parsed.success)
    return (
      <div className="dashboard-content">
        <h1>Yönetim raporları</h1>
        <p role="alert">Geçerli başlangıç ve bitiş tarihleri seçin.</p>
        <Link href="/dashboard/reports">Tarihleri sıfırla</Link>
      </div>
    );
  const { from, to } = parsed.data;
  const { data, error } = await supabase.rpc("studio_report", {
    p_from: from,
    p_to: to,
  });
  const report = (
    data && typeof data === "object" && !Array.isArray(data) ? data : {}
  ) as Report;
  const sum = (rows: Row[] | undefined, key: string) =>
    rows?.reduce((n, row) => n + Number(row[key] ?? 0), 0) ?? 0;
  const crm = report.crm ?? [];
  const converted = crm.filter((row) => row.stage === "converted").length;
  const metrics = [
    ["Net tahsilat (TL)", sum(report.payments, "amount")],
    ["Dönem sonu borç (TL)", sum(report.balances, "balance")],
    ["Yenileme adayı", report.renewals?.length ?? 0],
    [
      "CRM dönüşümü",
      crm.length ? Math.round((converted / crm.length) * 100) + "%" : "—",
    ],
  ];
  return (
    <div className="dashboard-content">
      <div className="page-heading">
        <div>
          <p className="eyebrow">YÖNETİM ANALİZİ</p>
          <h1>Yönetim raporları</h1>
          <p className="dashboard-subtitle">
            Tarihler İstanbul saatine göre değerlendirilir. Borç raporu seçilen
            dönem sonunu; yenileme ve CRM aşamaları güncel durumu gösterir.
            Kullanım ayrılmış ders saatidir.
          </p>
        </div>
      </div>
      <form className="form-card field-grid" method="get">
        <label>
          Başlangıç
          <input required type="date" name="from" defaultValue={from} />
        </label>
        <label>
          Bitiş
          <input required type="date" name="to" defaultValue={to} min={from} />
        </label>
        <button className="primary-action" type="submit">
          Raporu getir
        </button>
      </form>
      {error ? (
        <p className="notice error" role="alert">
          Rapor yüklenemedi. Tekrar deneyin; bu sonuç üzerinden karar vermeyin.
        </p>
      ) : (
        <>
          <div className="metric-grid">
            {metrics.map(([label, value]) => (
              <article className="metric-card" key={String(label)}>
                <p>{label}</p>
                <strong className="metric-value">
                  {typeof value === "number"
                    ? new Intl.NumberFormat("tr-TR", {
                        maximumFractionDigits: 2,
                      }).format(value)
                    : value}
                </strong>
              </article>
            ))}
          </div>
          {Object.entries(definitions).map(([key, def]) => (
            <section className="table-card" key={key}>
              <div className="table-toolbar">
                <div>
                  <h2>{def.title}</h2>
                  <p>
                    {report[key]?.length ?? 0} kayıt · dışa aktarımın tamamı
                    dahil
                  </p>
                </div>
                <a
                  className="secondary-action"
                  href={
                    "/dashboard/reports/export?" +
                    new URLSearchParams({ dataset: key, from, to }).toString()
                  }
                >
                  CSV indir
                </a>
              </div>
              <OperationsTable rows={report[key] ?? []} columns={def.columns} />
            </section>
          ))}
        </>
      )}
    </div>
  );
}
