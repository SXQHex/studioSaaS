import Link from "next/link";
import {
  Activity,
  ArrowUpRight,
  CalendarDays,
  CreditCard,
  Users,
} from "lucide-react";
import { requireRole } from "@/lib/supabase/access";
import { StudentHome } from "./_components/student-home";

export const metadata = {
  title: "Genel Bakış | FTK Studio",
};

export default async function DashboardPage() {
  const { supabase, profile } = await requireRole(["admin", "instructor", "student"]);

  if (profile.role === "student") {
    return <StudentHome />;
  }

  const isAdmin = profile.role === "admin";
  const [lessonsResult, upcomingResult, membersResult, subscriptionsResult, attendanceResult] = await Promise.all([
    supabase.from("lessons").select("id", { count: "exact", head: true }),
    supabase.from("lessons").select("id", { count: "exact", head: true }).eq("status", "scheduled").gte("starts_at", new Date().toISOString()),
    isAdmin ? supabase.from("members").select("id", { count: "exact", head: true }) : Promise.resolve({ count: null, error: null }),
    isAdmin ? supabase.from("subscriptions").select("id", { count: "exact", head: true }).eq("status", "active") : Promise.resolve({ count: null, error: null }),
    supabase.from("attendance").select("id", { count: "exact", head: true }),
  ]);

  const metrics = isAdmin
    ? [
        { label: "Üyeler", value: membersResult.error ? "—" : String(membersResult.count ?? 0), description: membersResult.error ? "Veri alınamadı" : "Kayıtlı üye", icon: Users, href: "/dashboard/members" },
        { label: "Dersler", value: lessonsResult.error ? "—" : String(lessonsResult.count ?? 0), description: lessonsResult.error ? "Veri alınamadı" : "Tüm ders kayıtları", icon: CalendarDays, href: "/dashboard/lessons" },
        { label: "Aktif abonelikler", value: subscriptionsResult.error ? "—" : String(subscriptionsResult.count ?? 0), description: subscriptionsResult.error ? "Veri alınamadı" : "Aktif paketler", icon: CreditCard, href: "/dashboard/subscriptions" },
        { label: "Yaklaşan dersler", value: upcomingResult.error ? "—" : String(upcomingResult.count ?? 0), description: upcomingResult.error ? "Veri alınamadı" : "Planlanmış gelecek ders", icon: Activity, href: "/dashboard/lessons" },
      ]
    : [
        { label: "Dersler", value: lessonsResult.error ? "—" : String(lessonsResult.count ?? 0), description: lessonsResult.error ? "Veri alınamadı" : "Görüntülenebilir ders kayıtları", icon: CalendarDays, href: "/dashboard/lessons" },
        { label: "Yaklaşan dersler", value: upcomingResult.error ? "—" : String(upcomingResult.count ?? 0), description: upcomingResult.error ? "Veri alınamadı" : "Planlanmış gelecek ders", icon: Activity, href: "/dashboard/lessons" },
        { label: "Yoklama kayıtları", value: attendanceResult.error ? "—" : String(attendanceResult.count ?? 0), description: attendanceResult.error ? "Veri alınamadı" : "Görüntülenebilir katılım kayıtları", icon: Users, href: "/dashboard/attendance" },
      ];

  const modules = isAdmin
    ? [
        { label: "Üye yönetimi", description: "İletişim bilgileri ve üyelik durumu", icon: Users, href: "/dashboard/members" },
        { label: "Ders takvimi", description: "Özel ve grup derslerini planla", icon: CalendarDays, href: "/dashboard/lessons" },
        { label: "Yoklama", description: "Katılımı kaydet ve kredi kurallarını uygula", icon: Activity, href: "/dashboard/attendance" },
        { label: "Abonelikler", description: "Paketleri, ödemeleri ve kalan dersleri izle", icon: CreditCard, href: "/dashboard/subscriptions" },
      ]
    : [
        { label: "Ders takvimi", description: "Dersleri ve planlanan saatleri görüntüle", icon: CalendarDays, href: "/dashboard/lessons" },
        { label: "Yoklama", description: "Ders katılım kayıtlarını görüntüle veya kaydet", icon: Activity, href: "/dashboard/attendance" },
      ];

  return (
    <div className="dashboard-content">
      <div className="welcome-row">
        <div>
          <p className="eyebrow">{isAdmin ? "STÜDYO ÖZETİ" : "EĞİTMEN ÖZETİ"}</p>
          <h1>Genel bakış</h1>
          <p className="dashboard-subtitle">
            {isAdmin ? "Stüdyonun günlük akışı ve temel kayıtları." : "Ders programı ve yoklama kayıtları."}
          </p>
        </div>
        <span className="today-pill">FTK Studio</span>
      </div>

      <div className="metric-grid">
        {metrics.map((metric) => {
          const Icon = metric.icon;
          return (
            <Link className="metric-card metric-card-link" href={metric.href} key={metric.label}>
              <div className="metric-top"><span>{metric.label}</span><span className="metric-icon"><Icon size={19} aria-hidden="true" /></span></div>
              <strong className="metric-value">{metric.value}</strong>
              <p>{metric.description}</p>
              <span className="metric-action">Detayları aç <ArrowUpRight size={13} aria-hidden="true" /></span>
            </Link>
          );
        })}
      </div>

      <section className="overview-panel">
        <div className="panel-heading">
          <div>
            <h2>{isAdmin ? "Yönetim modülleri" : "Eğitmen modülleri"}</h2>
            <p>{isAdmin ? "Üyeleri, dersleri ve kredi hareketlerini buradan yönetin." : "Ders ve katılım iş akışlarına buradan erişin."}</p>
          </div>
        </div>
        <div className="module-grid">
          {modules.map((module) => {
            const Icon = module.icon;
            return (
              <Link className="module-card" href={module.href} key={module.href}>
                <span className="metric-icon"><Icon size={19} aria-hidden="true" /></span>
                <span><strong>{module.label}</strong><small>{module.description}</small></span>
                <ArrowUpRight size={16} aria-hidden="true" />
              </Link>
            );
          })}
        </div>
      </section>

      <p className="dashboard-footnote">
        Özet sayıları, giriş yapan hesabın Supabase RLS politikalarıyla erişebildiği kayıtları gösterir.
      </p>
    </div>
  );
}
