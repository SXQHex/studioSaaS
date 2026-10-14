"use client";
import {
  Activity,
  CalendarDays,
  CreditCard,
  Download,
  FileSpreadsheet,
  Users,
} from "lucide-react";

type DatasetRow = Record<string, string | number | boolean | null>;
function downloadCsv(name: string, rows: DatasetRow[]) {
  if (!rows.length) return;
  const columns = Object.keys(rows[0]);
  const quoteCsv = (value: unknown) =>
    '"' + String(value ?? "").replace(/"/g, '""') + '"';
  const csv =
    "\uFEFF" +
    [
      columns.map(quoteCsv).join(";"),
      ...rows.map((row) =>
        columns.map((column) => quoteCsv(row[column])).join(";"),
      ),
    ].join("\r\n");
  const url = URL.createObjectURL(
    new Blob([csv], { type: "text/csv;charset=utf-8;" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}
export function ReportsManager({
  metrics,
  datasets,
  loadError,
}: {
  metrics: {
    members: number;
    activeMembers: number;
    activeSubscriptions: number;
    lessons: number;
    monthLessons: number;
    attendance: number;
    present: number;
    absent: number;
    creditEvents: number;
    netCredits: number;
  };
  datasets: {
    subscriptions: DatasetRow[];
    attendance: DatasetRow[];
    credits: DatasetRow[];
  };
  loadError: boolean;
}) {
  const reports = [
    {
      title: "Abonelik raporu",
      description: "Paket, durum, tarih, kredi ve ödeme alanları",
      key: "subscriptions" as const,
      file: "abonelik-raporu.csv",
      count: datasets.subscriptions.length,
    },
    {
      title: "Yoklama raporu",
      description: "Üye, ders, katılım durumu ve tarih",
      key: "attendance" as const,
      file: "yoklama-raporu.csv",
      count: datasets.attendance.length,
    },
    {
      title: "Kredi hareketleri",
      description: "Yükleme, kullanım, düzeltme ve iade kayıtları",
      key: "credits" as const,
      file: "kredi-hareketleri.csv",
      count: datasets.credits.length,
    },
  ];
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">ANALİZ</p>
          <h1>Raporlama</h1>
          <p className="dashboard-subtitle">
            Üyelik, ders doluluğu, yoklama ve kredi hareketlerinin operasyon
            özeti.
          </p>
        </div>
        <span className="today-pill">Yönetici</span>
      </div>
      {loadError && (
        <div className="notice error">
          Bazı rapor sorguları tamamlanamadı. Sonuçlar eksik olabilir; RLS ve
          migration durumunu kontrol edin.
        </div>
      )}
      <div className="metric-grid report-metrics">
        <article className="metric-card">
          <div className="metric-top">
            <span>Toplam üye</span>
            <span className="metric-icon">
              <Users size={18} />
            </span>
          </div>
          <strong className="metric-value">{metrics.members}</strong>
          <p>{metrics.activeMembers} aktif üye</p>
        </article>
        <article className="metric-card">
          <div className="metric-top">
            <span>Aktif abonelik</span>
            <span className="metric-icon">
              <CreditCard size={18} />
            </span>
          </div>
          <strong className="metric-value">
            {metrics.activeSubscriptions}
          </strong>
          <p>Durumu aktif paketler</p>
        </article>
        <article className="metric-card">
          <div className="metric-top">
            <span>Bu ay planlanan ders</span>
            <span className="metric-icon">
              <CalendarDays size={18} />
            </span>
          </div>
          <strong className="metric-value">{metrics.monthLessons}</strong>
          <p>{metrics.lessons} toplam ders kaydı</p>
        </article>
        <article className="metric-card">
          <div className="metric-top">
            <span>Katılım oranı</span>
            <span className="metric-icon">
              <Activity size={18} />
            </span>
          </div>
          <strong className="metric-value">
            {metrics.attendance
              ? Math.round((metrics.present / metrics.attendance) * 100) + "%"
              : "—"}
          </strong>
          <p>
            {metrics.present} katılım · {metrics.absent} devamsızlık
          </p>
        </article>
      </div>
      <section className="overview-panel">
        <div className="panel-heading">
          <div>
            <h2>İndirilebilir raporlar</h2>
            <p>
              CSV dosyaları Excel ve Google Sheets ile açılabilir. Her dışa
              aktarım en fazla son 1.000 kaydı içerir.
            </p>
          </div>
          <FileSpreadsheet className="panel-icon" size={19} />
        </div>
        <div className="report-list">
          {reports.map((report) => (
            <article className="report-row" key={report.key}>
              <span className="metric-icon">
                <FileSpreadsheet size={18} />
              </span>
              <div>
                <strong>{report.title}</strong>
                <small>{report.description}</small>
                <small>{report.count} kayıt hazır</small>
              </div>
              <button
                className="secondary-action"
                type="button"
                onClick={() => downloadCsv(report.file, datasets[report.key])}
                disabled={!report.count}
              >
                <Download size={15} /> CSV indir
              </button>
            </article>
          ))}
        </div>
      </section>
      <section className="overview-panel">
        <div className="panel-heading">
          <div>
            <h2>Kredi özeti</h2>
            <p>Seçilen veri kapsamındaki net kredi hareketi</p>
          </div>
          <span className="student-credit-pill">
            {metrics.netCredits > 0 ? "+" : ""}
            {metrics.netCredits} kredi
          </span>
        </div>
        <div className="student-empty">
          Bu gösterge kredi işlem kayıtlarının net toplamıdır; mevcut aktif
          abonelik bakiyesinin yerine geçmez.
        </div>
      </section>
    </>
  );
}
