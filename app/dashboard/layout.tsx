import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { getSession } from "@/lib/supabase/session";
import { DashboardShell } from "./dashboard-shell";

export const dynamic = "force-dynamic";
export const metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  // Memoised per request: pages and Server Actions that call requireRole() reuse this lookup.
  const session = await getSession();

  if (session.status === "anonymous") {
    redirect("/login");
  }

  return (
    <DashboardShell
      email={session.status === "ready" ? session.email : ""}
      roleLabel={session.status === "ready" ? session.profile.role : "Rol doğrulanamadı"}
    >
      {children}
    </DashboardShell>
  );
}
