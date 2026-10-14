"use client";
import { useEffect, useId, useState, type ReactNode } from "react";
import { listWorkspaceSection } from "@/lib/actions/workspace";
import { studioDateTime } from "@/lib/studio-date";
const names: Record<string, string> = {
  missing: "Eksikler",
  resource_kind: "Kaynak türü",
  resource_id: "Kaynak",
  weekday: "Haftanın günü",
  opens: "Açılış",
  closes: "Kapanış",
  lesson_type: "Ders türü",
  credits: "Ders kredisi",
  price: "Fiyat",
  validity_days: "Geçerlilik (gün)",
  freeze_days: "Dondurma (gün)",
  effective_ends_on: "Etkin bitiş",
  starts_on: "Başlangıç tarihi",
  active: "Satışa açık",
  trial_outcome: "Deneme sonucu",
  assigned_to: "Sorumlu",
  attempts: "Deneme sayısı",
  last_error: "Hata",
  updated_at: "Son güncelleme",
  required: "Zorunlu",
  published_at: "Yayımlanma",
  level: "Seviye",
  skill: "Beceri",
  score: "Değerlendirme",
  student_visible: "Öğrenciye açık",
  week: "Hafta",
  marked: "Yoklama kaydı",
  present: "Katılan",
  trials: "Deneme",
  conversions: "Üyelik",
  lesson: "Ders",
  key: "Ayar",
  reason: "Gerekçe",
  method: "Ödeme yöntemi",
  name: "Ad",
  full_name: "Ad soyad",
  label: "Paket",
  capacity: "Kontenjan",
  enrolled: "Kayıtlı",
  group: "Grup",
  member: "Öğrenci",
  amount: "Tutar",
  paid: "Net tahsilat",
  balance: "Kalan borç",
  payment_status: "Ödeme durumu",
  kind: "İşlem",
  occurred_at: "İşlem tarihi",
  note: "Açıklama",
  actor: "İşlemi yapan",
  email: "E-posta",
  phone: "Telefon",
  source: "Kaynak",
  interests: "İlgi alanları",
  stage: "Aşama",
  trial_at: "Deneme dersi",
  converted_at: "Üyeye dönüşüm",
  lead: "Aday",
  title: "Başlık",
  due_at: "Takip tarihi",
  completed_at: "Tamamlandı",
  starts_at: "Başlangıç",
  ends_at: "Bitiş",
  status: "Durum",
  outcome: "Sonuç",
  created_at: "Kayıt tarihi",
  action: "İşlem",
  old_starts_at: "Önceki saat",
  new_starts_at: "Yeni saat",
  cancellation_hours: "Ücretsiz iptal süresi (saat)",
  room: "Oda",
  instructor: "Eğitmen",
  hours: "Kullanım (saat)",
  lessons: "Ders sayısı",
  attended: "Katılan",
  credits_remaining: "Kalan kredi",
  ends_on: "Paket bitişi",
  subscription_id: "Paket kaydı",
  lesson_id: "Ders kaydı",
  member_id: "Üye kaydı",
};
const statuses: Record<string, string> = {
  true: "Evet",
  false: "Hayır",
  private: "Özel ders",
  group: "Grup dersi",
  room: "Oda",
  instructor: "Eğitmen",
  closed: "Kapalı / izin",
  group_draft: "Grup taslağı",
  attended: "Katıldı",
  processing: "İşleniyor",
  sent: "Sağlayıcıya gönderildi",
  delivered: "Teslim edildi",
  retry: "Yeniden denenecek",
  failed: "Başarısız",
  bounced: "Adres reddetti",
  complained: "Şikayet",
  organization: "Organizasyon ayarı",
  center: "Merkez ayarı",
  reset: "Varsayılana dönüş",
  cash: "Nakit",
  manual: "Manuel",
  waiting: "Bekliyor",
  promoted: "Gruba alındı",
  scheduled: "Planlandı",
  completed: "Tamamlandı",
  cancelled: "İptal",
  postponed: "Ertelendi",
  active: "Aktif",
  expired: "Süresi doldu",
  paid: "Ödendi",
  pending: "Bekliyor",
  refunded: "İade",
  collection: "Tahsilat",
  refund: "İade",
  reversal: "Ters kayıt",
  legacy: "Açılış",
  new: "Yeni",
  contacted: "İletişim",
  trial: "Deneme",
  followup: "Takip",
  converted: "Üyeye dönüştü",
  lost: "Kapandı",
  student_cancel: "Erken iptal",
  late_cancel: "Geç iptal",
  no_show: "Gelmedi",
  cancel: "Ders iptali",
  reschedule: "Erteleme",
  makeup: "Telafi",
};
export function OperationsTable({
  rows,
  columns,
  actions,
  remote,
}: {
  rows: Record<string, unknown>[];
  columns: string[];
  actions?: (row: Record<string, unknown>) => ReactNode;
  remote?: { module: string; section: string; total: number };
}) {
  const id = useId();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [sort, setSort] = useState("");
  const [ascending, setAscending] = useState(true);
  const [page, setPage] = useState(1);
  const [loaded, setLoaded] = useState({
    rows,
    total: remote?.total ?? rows.length,
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const module = remote?.module;
  const section = remote?.section;
  const initialTotal = remote?.total ?? rows.length;
  const stateColumn = columns.find((c) =>
    ["status", "stage", "kind", "payment_status"].includes(c),
  );
  useEffect(() => {
    if (!module || !section) return;
    if (page === 1 && !query && !sort && !status) {
      setLoaded({ rows, total: initialTotal });
      return;
    }

    let active = true;
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const result = await listWorkspaceSection({
          module,
          section,
          page,
          query,
          sort: sort || "id",
          ascending,
          filters: status && stateColumn ? { [stateColumn]: status } : {},
        });
        if (!active) return;
        if (result.ok) {
          setLoaded({ rows: result.rows, total: result.total });
          setError("");
          const last = Math.max(1, Math.ceil(result.total / 25));
          if (page > last) setPage(last);
        } else setError(result.error);
      } catch {
        if (active) setError("Liste yüklenemedi.");
      } finally {
        if (active) setLoading(false);
      }
    }, 200);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [
    module,
    section,
    page,
    query,
    sort,
    ascending,
    status,
    stateColumn,
    rows,
    initialTotal,
  ]);
  const displayed = remote ? loaded.rows : rows;
  const stateOptions: Record<string, string[]> = {
    stage: ["new", "contacted", "trial", "followup", "converted", "lost"],
    kind: ["collection", "refund", "reversal", "legacy"],
    payment_status: ["pending", "paid", "refunded"],
  };
  const sectionStates: Record<string, string[]> = {
    lessons: ["scheduled", "completed", "cancelled", "postponed"],
    subscriptions: ["active", "expired", "cancelled"],
    waitlist: ["waiting", "promoted", "cancelled"],
    emails: [
      "pending",
      "processing",
      "sent",
      "delivered",
      "retry",
      "failed",
      "cancelled",
      "bounced",
      "complained",
    ],
  };
  const states = stateColumn
    ? remote
      ? (stateOptions[stateColumn] ?? sectionStates[remote.section] ?? [])
      : [
          ...new Set(
            displayed.map((r) => String(r[stateColumn] ?? "")).filter(Boolean),
          ),
        ]
    : [];
  const filtered = remote
    ? displayed
    : rows.filter(
        (row) =>
          (!status || String(row[stateColumn ?? ""]) === status) &&
          (!query ||
            columns.some((c) =>
              String(row[c] ?? "")
                .toLocaleLowerCase("tr-TR")
                .includes(query.toLocaleLowerCase("tr-TR")),
            )),
      );
  const sorted = remote
    ? filtered
    : [...filtered].sort((a, b) => {
        if (!sort) return 0;
        const av = a[sort],
          bv = b[sort];
        const n =
          typeof av === "number" && typeof bv === "number"
            ? av - bv
            : String(av ?? "").localeCompare(String(bv ?? ""), "tr", {
                numeric: true,
              });
        return ascending ? n : -n;
      });
  const pages = Math.max(
    1,
    Math.ceil((remote ? loaded.total : sorted.length) / 25),
  );
  const current = Math.min(page, pages);
  return (
    <>
      {error && (
        <p role="alert" className="notice error">
          {error}
        </p>
      )}
      <div className="table-toolbar">
        <label htmlFor={id}>
          Kayıtlarda ara
          <input
            id={id}
            type="search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(1);
            }}
          />
        </label>
        {stateColumn && (
          <label>
            Durum
            <select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
            >
              <option value="">Tümü</option>
              {states.map((v) => (
                <option key={v} value={v}>
                  {statuses[v] ?? v}
                </option>
              ))}
            </select>
          </label>
        )}
        <p aria-live="polite">
          {remote ? loaded.total : filtered.length} kayıt{" "}
          {loading ? "· Yükleniyor…" : ""}
        </p>
      </div>
      <div className="table-scroll" aria-busy={loading}>
        {sorted.length ? (
          <table className="data-table">
            <thead>
              <tr>
                {columns.map((c) => (
                  <th
                    key={c}
                    aria-sort={
                      sort === c
                        ? ascending
                          ? "ascending"
                          : "descending"
                        : "none"
                    }
                  >
                    <button
                      type="button"
                      className="text-action"
                      onClick={() => {
                        setSort(c);
                        setAscending(sort === c ? !ascending : true);
                        setPage(1);
                      }}
                    >
                      {names[c] ?? c}{" "}
                      {sort === c ? (ascending ? "↑" : "↓") : ""}
                    </button>
                  </th>
                ))}
                {actions && <th>İşlemler</th>}
              </tr>
            </thead>
            <tbody>
              {(remote
                ? sorted
                : sorted.slice((current - 1) * 25, current * 25)
              ).map((row, i) => (
                <tr key={String(row.id ?? i)}>
                  {columns.map((c) => {
                    const v = row[c];
                    const str =
                      v == null
                        ? "—"
                        : typeof v === "number"
                          ? new Intl.NumberFormat("tr-TR", {
                              maximumFractionDigits: 2,
                            }).format(v)
                          : String(v);
                    return (
                      <td key={c}>
                        {v != null && c.endsWith("_at")
                          ? studioDateTime(str)
                          : (statuses[str] ?? str)}
                      </td>
                    );
                  })}
                  {actions && <td>{actions(row)}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="empty-state compact">Eşleşen kayıt yok.</div>
        )}
      </div>
      <div className="table-toolbar">
        <button
          type="button"
          disabled={loading || current === 1}
          onClick={() => setPage(current - 1)}
        >
          Önceki
        </button>
        <span>
          {current} / {pages}
        </span>
        <button
          type="button"
          disabled={loading || current === pages}
          onClick={() => setPage(current + 1)}
        >
          Sonraki
        </button>
      </div>
    </>
  );
}
