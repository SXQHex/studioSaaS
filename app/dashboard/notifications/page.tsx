import { studioDateTime } from "@/lib/studio-date";
import { Bell, CheckCheck } from "lucide-react";
import Link from "next/link";
import { markNotificationRead } from "@/lib/actions/notifications";
import { requireRole } from "@/lib/supabase/access";

export const metadata = { title: "Bildirimler | FTK Studio" };
const dateTime = studioDateTime;

export default async function NotificationsPage() {
  const { supabase, userId } = await requireRole([
    "admin",
    "instructor",
    "student",
  ]);
  const { data, error } = await supabase
    .from("notifications")
    .select("id, title, body, href, read_at, created_at")
    .eq("recipient_id", userId)
    .order("created_at", { ascending: false })
    .limit(100);
  const rows = data ?? [];
  return (
    <div className="dashboard-content">
      <div className="page-heading">
        <div>
          <p className="eyebrow">HESAP</p>
          <h1>Bildirimler</h1>
          <p className="dashboard-subtitle">
            Seans taleplerinin oluşturulma, onay ve ret kayıtları.
          </p>
        </div>
        <Bell size={22} />
      </div>
      {error ? (
        <div className="notice error">
          Bildirimler yüklenemedi. Yeni migration'ın veritabanına uygulandığını
          kontrol edin.
        </div>
      ) : rows.length === 0 ? (
        <section className="overview-panel">
          <div className="empty-state">
            <span className="empty-icon">
              <Bell size={24} />
            </span>
            <h3>Henüz bildirim yok</h3>
            <p>
              Seans talebi oluşturulduğunda veya değerlendirildiğinde
              bildirimler burada görünür.
            </p>
          </div>
        </section>
      ) : (
        <section className="overview-panel">
          <div className="student-list">
            {rows.map((row) => (
              <article
                className={`notification-row${row.read_at ? " is-read" : ""}`}
                key={row.id}
              >
                <span className="notification-dot" />
                <div className="notification-copy">
                  <strong>{row.title}</strong>
                  <p>{row.body}</p>
                  <small>
                    {dateTime(row.created_at)}
                    {row.read_at ? " · Okundu" : " · Okunmadı"}
                  </small>
                  <div className="notification-actions">
                    <Link
                      className="secondary-action"
                      href={row.href || "/dashboard/session-requests"}
                    >
                      İlgili sayfayı aç
                    </Link>
                    {!row.read_at && (
                      <form
                        action={async () => {
                          "use server";
                          await markNotificationRead({ id: row.id });
                        }}
                      >
                        <button className="text-button" type="submit">
                          <CheckCheck size={14} /> Okundu işaretle
                        </button>
                      </form>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
