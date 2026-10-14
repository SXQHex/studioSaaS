"use client";

import {
  Activity,
  BarChart3,
  Bell,
  CalendarDays,
  CreditCard,
  LayoutDashboard,
  Music2,
  ShieldCheck,
  UserCircle2,
  BookOpenCheck,
  GraduationCap,
  Users,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { SignOutButton } from "@/app/dashboard/sign-out-button";

const roleNames: Record<string, string> = {
  appowner: "Platform yöneticisi",
  owner: "Organizasyon sahibi",
  admin: "Yönetici",
  ainstructor: "Asistan eğitmen",
  instructor: "Eğitmen",
  student: "Öğrenci",
};

const navigation = [
  { href: "/dashboard", label: "Genel bakış", icon: LayoutDashboard, exact: true },
  { href: "/dashboard/members", label: "Üyeler", icon: Users },
  { href: "/dashboard/roles", label: "Merkez rolleri", icon: ShieldCheck },
  { href: "/dashboard/my-learning", label: "Öğrenci görünümüm", icon: GraduationCap },
  { href: "/dashboard/my-students", label: "Ders öğrencilerim", icon: BookOpenCheck },
  { href: "/dashboard/lessons", label: "Ders takvimi", icon: CalendarDays },
  { href: "/dashboard/attendance", label: "Yoklama", icon: Activity },
  { href: "/dashboard/subscriptions", label: "Abonelikler", icon: CreditCard },
  { href: "/dashboard/credits", label: "Kredi hareketleri", icon: Wallet },
  { href: "/dashboard/session-requests", label: "Seans talepleri", icon: CalendarDays },
  { href: "/dashboard/groups", label: "Grup programları", icon: Users },
  { href: "/dashboard/payments", label: "Manuel tahsilatlar", icon: Wallet },
  { href: "/dashboard/lesson-operations", label: "İptal ve telafi", icon: CalendarDays },
  { href: "/dashboard/crm", label: "Pazarlama CRM", icon: Users },
  { href: "/dashboard/notifications", label: "Bildirimler", icon: Bell },
  { href: "/dashboard/account", label: "Hesap ve güvenlik", icon: UserCircle2 },
  { href: "/dashboard/settings", label: "Organizasyon / merkez ayarları", icon: ShieldCheck },
  { href: "/dashboard/reports", label: "Raporlama", icon: BarChart3 },
];

export function DashboardShell({
  children,
  email,
  roleLabel,
  roles,
  unreadNotificationCount,
}: {
  children: ReactNode;
  email: string;
  roleLabel: string;
  roles: string[];
  unreadNotificationCount: number;
}) {
  const pathname = usePathname();
  const isManager = roles.some((r) => ["appowner", "owner", "admin"].includes(r));
  const isInstructor = roles.includes("instructor");
  const isAssistant = roles.includes("ainstructor");
  const visibleNavigation = isManager ? navigation
    : isInstructor ? navigation.filter((item) => ["/dashboard", "/dashboard/lessons", "/dashboard/attendance", "/dashboard/session-requests", "/dashboard/notifications", "/dashboard/my-learning", "/dashboard/lesson-operations", "/dashboard/my-students", "/dashboard/account"].includes(item.href))
    : isAssistant ? navigation.filter((item) => ["/dashboard", "/dashboard/attendance", "/dashboard/notifications", "/dashboard/my-learning", "/dashboard/lesson-operations", "/dashboard/account"].includes(item.href))
    : navigation.filter((item) => ["/dashboard", "/dashboard/notifications", "/dashboard/my-learning", "/dashboard/lesson-operations", "/dashboard/account"].includes(item.href));

  return (
    <main className="dashboard-shell">
      <aside className="sidebar">
        <Link href="/dashboard" className="dashboard-brand" aria-label="FTK Studio genel bakış">
          <span className="brand-mark small">FTK</span>
          <span><strong>FTK Studio</strong><small>YÖNETİM PANELİ</small></span>
        </Link>
        <p className="nav-label">ÇALIŞMA ALANI</p>
        <nav className="side-nav" aria-label="Ana menü">
          {visibleNavigation.map((item) => {
            const Icon = item.icon;
            const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
            return (
              <Link key={item.href} className={`side-link${active ? " active" : ""}`} href={item.href} aria-current={active ? "page" : undefined}>
                <Icon size={18} aria-hidden="true" /> <span className="side-link-label">{item.label}</span>
                {item.href === "/dashboard/notifications" && unreadNotificationCount > 0 && <span className="notification-count" title={`${unreadNotificationCount} okunmamış bildirim`}>{unreadNotificationCount > 99 ? "99+" : unreadNotificationCount}</span>}
              </Link>
            );
          })}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-status"><span className="status-dot" /> Güvenli oturum</div>
          <SignOutButton />
        </div>
      </aside>

      <section className="dashboard-main">
        <header className="dashboard-topbar">
          <div className="mobile-dashboard-brand"><Music2 size={19} /> FTK Studio</div>
          <div className="breadcrumbs">Çalışma alanı <span>/</span> {navigation.find((item) => item.exact ? pathname === item.href : pathname.startsWith(item.href))?.label ?? "Panel"}</div>
          <div className="account-chip"><span className="avatar">{email.slice(0, 1).toLocaleUpperCase("tr-TR") || "S"}</span><span><strong>{email || "Hesap"}</strong><small>{roleNames[roleLabel] ?? roleLabel}</small></span></div>
        </header>
        {roleLabel === "student" && (
          <div className="role-banner">Öğrenci panelinizde abonelik, kredi, ders ve yoklama bilgilerinizi görüntüleyebilirsiniz.</div>
        )}
        {roleLabel === "instructor" && (
          <div className="role-banner">Eğitmen erişimi: ders takvimi ve yoklama kullanılabilir; üyelik, abonelik ve kredi yönetimi yönetici rolü gerektirir.</div>
        )}
        {roleLabel === "ainstructor" && (
          <div className="role-banner">Asistan eğitmen erişimi: yalnızca atanmış derslerde yoklama ve bildirimler kullanılabilir.</div>
        )}
        {![ "appowner", "owner", "admin", "instructor", "ainstructor", "student" ].includes(roleLabel) && (
          <div className="role-banner">Hesabınızın rolü doğrulanamadı. Yetkilerinizin yüklenmesi için profil kaydını kontrol edin.</div>
        )}
        {children}
      </section>
    </main>
  );
}
