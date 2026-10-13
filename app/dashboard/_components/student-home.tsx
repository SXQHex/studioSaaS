import { Activity, CalendarDays, CreditCard, Wallet } from "lucide-react";
import Link from "next/link";
import type { ServerSupabase } from "@/lib/supabase/server";

const dateTime = (value: string) => new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
const dateOnly = (value: string) => new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium" }).format(new Date(value));
const reasonLabels: Record<string, string> = { purchase: "Kredi alımı", lesson_use: "Ders kullanımı", admin_adjustment: "Yönetici düzeltmesi", refund: "İade" };

export async function StudentHome({ supabase, profileId, fullName }: { supabase: ServerSupabase; profileId: string; fullName: string }) {
  const memberResult = await supabase.from("members").select("id, full_name, is_active, center_id").eq("profile_id", profileId).order("created_at");
  const linkedMembers = memberResult.data ?? [];
  const member = linkedMembers[0];
  const linkedIds = linkedMembers.map((m) => m.id);
  const linkedCenters = [...new Set(linkedMembers.map((m) => m.center_id))];
  if (!member) {
    return <div className="dashboard-content"><div className="welcome-row"><div><p className="eyebrow">ÖĞRENCİ HESABI</p><h1>Hoş geldiniz{fullName ? ", " + fullName : ""}</h1><p className="dashboard-subtitle">Hesabınız henüz bir üye kaydıyla eşleştirilmemiş.</p></div><span className="today-pill">FTK Studio</span></div><section className="overview-panel"><div className="panel-heading"><div><h2>Üyelik eşleştirmesi gerekiyor</h2><p>Abonelik, kredi ve ders bilgilerinizi gösterebilmemiz için stüdyo yöneticisinin üye kaydınızı bu giriş hesabına bağlaması gerekiyor.</p></div></div></section></div>;
  }

  const now = new Date().toISOString();
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const [subscriptionsResult, attendanceResult, creditsResult] = await Promise.all([
    supabase.from("subscriptions").select("id, type, status, starts_on, ends_on, credits_purchased, credits_remaining, payment_status").in("member_id", linkedIds).eq("status", "active").lte("starts_on", today).or("ends_on.is.null,ends_on.gte." + today).order("starts_on", { ascending: false }),
    supabase.from("attendance").select("id, lesson_id, attended, checked_in_at, notes").in("member_id", linkedIds).order("checked_in_at", { ascending: false }).limit(12),
    supabase.from("credit_transactions").select("id, amount, reason, note, created_at, lesson_id").in("member_id", linkedIds).order("created_at", { ascending: false }).limit(12),
  ]);
  const attendance = attendanceResult.data ?? [];
  const lessonIds = [...new Set(attendance.map((row) => row.lesson_id))];
  const [upcomingPrivate, upcomingGroup, historyLessons] = await Promise.all([
    supabase.from("lessons").select("id, title, starts_at, ends_at, status, type").in("private_member_id", linkedIds).eq("status", "scheduled").gte("starts_at", now).order("starts_at").limit(8),
    supabase.from("lessons").select("id, title, starts_at, ends_at, status, type").in("center_id", linkedCenters).eq("type", "group").eq("status", "scheduled").gte("starts_at", now).order("starts_at").limit(8),
    lessonIds.length ? supabase.from("lessons").select("id, title, starts_at, status").in("id", lessonIds) : Promise.resolve({ data: [], error: null }),
  ]);
  const upcomingMap = new Map<string, { id: string; title: string; starts_at: string; ends_at: string | null; status: string; type: string }>();
  for (const lesson of [...(upcomingPrivate.data ?? []), ...(upcomingGroup.data ?? [])]) upcomingMap.set(lesson.id, lesson);
  const upcoming = [...upcomingMap.values()].sort((a, b) => a.starts_at.localeCompare(b.starts_at)).slice(0, 8);
  const lessonMap = new Map((historyLessons.data ?? []).map((lesson) => [lesson.id, lesson]));
  const subscriptions = (subscriptionsResult.data ?? []).filter((item) => item.starts_on <= today && (!item.ends_on || item.ends_on >= today));
  const credits = subscriptions.reduce((sum, item) => sum + item.credits_remaining, 0);

  return <div className="dashboard-content">
    <div className="welcome-row"><div><p className="eyebrow">ÖĞRENCİ PANELİ</p><h1>Merhaba, {member.full_name || fullName || "öğrenci"}</h1><p className="dashboard-subtitle">Aboneliğinizi, yaklaşan derslerinizi ve geçmiş hareketlerinizi takip edin.</p></div><span className="today-pill">FTK Studio</span></div>
    <div className="metric-grid student-metric-grid">
      <article className="metric-card"><div className="metric-top"><span>Aktif abonelik</span><span className="metric-icon"><CreditCard size={19} /></span></div><strong className="metric-value">{subscriptions.length}</strong><p>{subscriptions.length ? "Aktif paketiniz" : "Aktif paket bulunmuyor"}</p></article>
      <article className="metric-card"><div className="metric-top"><span>Kalan kredi</span><span className="metric-icon"><Wallet size={19} /></span></div><strong className="metric-value">{credits}</strong><p>Aktif aboneliklerde kalan toplam kredi</p></article>
      <article className="metric-card"><div className="metric-top"><span>Yaklaşan ders</span><span className="metric-icon"><CalendarDays size={19} /></span></div><strong className="metric-value">{upcoming.length}</strong><p>Planlanmış ve kayıtlı gelecek dersler</p></article>
    </div>
    <section className="overview-panel"><div className="panel-heading"><div><h2>Aboneliklerim</h2><p>Aktif paketler ve geçerlilik bilgileri</p></div><CreditCard className="panel-icon" size={19} /></div>
      {subscriptions.length ? <div className="student-list">{subscriptions.map((item) => <div className="student-list-row" key={item.id}><div><strong>{item.type === "group_4_weeks" ? "4 haftalık grup paketi" : "Özel ders kredi paketi"}</strong><small>{dateOnly(item.starts_on)} başlangıç{item.ends_on ? " · " + dateOnly(item.ends_on) + " bitiş" : " · Bitiş tarihi yok"} · {item.payment_status === "paid" ? "Ödendi" : "Ödeme kontrolü gerekli"}</small></div><span className="student-credit-pill">{item.credits_remaining} / {item.credits_purchased} kredi</span></div>)}</div> : <div className="student-empty">Şu anda aktif abonelik görünmüyor. Paket durumunuzu stüdyo yöneticisiyle kontrol edin.</div>}
    </section>
    <section className="overview-panel"><div className="panel-heading"><div><h2>Yaklaşan dersler</h2><p>Önümüzdeki planlanmış seanslar</p></div><CalendarDays className="panel-icon" size={19} /></div>
      {upcoming.length ? <div className="student-list">{upcoming.map((lesson) => <div className="student-list-row" key={lesson.id}><div><strong>{lesson.title}</strong><small>{dateTime(lesson.starts_at)}{lesson.ends_at ? " – " + new Intl.DateTimeFormat("tr-TR", { timeStyle: "short" }).format(new Date(lesson.ends_at)) : ""}</small></div><span className="type-pill">{lesson.type === "private" ? "Özel ders" : "Grup dersi"}</span></div>)}</div> : <div className="student-empty">Yaklaşan ders kaydı bulunmuyor.</div>}
    </section>
    <div className="student-history-grid"><section className="overview-panel"><div className="panel-heading"><div><h2>Yoklama geçmişi</h2><p>Son katılım ve devamsızlık kayıtları</p></div><Activity className="panel-icon" size={19} /></div>
      {attendance.length ? <div className="student-list">{attendance.map((row) => <div className="student-list-row" key={row.id}><div><strong>{lessonMap.get(row.lesson_id)?.title ?? "Ders kaydı"}</strong><small>{dateTime(row.checked_in_at)}{row.notes ? " · " + row.notes : ""}</small></div><span className={row.attended ? "status-pill lesson-completed" : "status-pill lesson-cancelled"}>{row.attended ? "Katıldı" : "Devamsız"}</span></div>)}</div> : <div className="student-empty">Henüz yoklama kaydı bulunmuyor.</div>}
    </section><section className="overview-panel"><div className="panel-heading"><div><h2>Kredi hareketleri</h2><p>Son yükleme, tüketim ve düzeltmeler</p></div><Wallet className="panel-icon" size={19} /></div>
      {creditsResult.data?.length ? <div className="student-list">{creditsResult.data.map((row) => <div className="student-list-row" key={row.id}><div><strong>{reasonLabels[row.reason] ?? row.reason}</strong><small>{dateTime(row.created_at)}{row.note ? " · " + row.note : ""}</small></div><span className={row.amount < 0 ? "credit-amount negative" : "credit-amount"}>{row.amount > 0 ? "+" : ""}{row.amount}</span></div>)}</div> : <div className="student-empty">Henüz kredi hareketi bulunmuyor.</div>}
    </section></div>
    <p className="dashboard-footnote">Veriler, giriş hesabınıza bağlı üye kaydı ve bu kayda erişim veren Supabase politikaları üzerinden yüklenir. <Link href="/dashboard">Paneli yenile</Link></p>
  </div>;
}
