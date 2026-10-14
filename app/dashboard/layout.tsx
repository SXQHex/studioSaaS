import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { getSession } from "@/lib/supabase/session";
import { createClient } from "@/lib/supabase/server";
import { DashboardShell } from "./dashboard-shell";

export const dynamic = "force-dynamic";
export const metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

export default async function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  // Memoised per request: pages and Server Actions that call requireRole() reuse this lookup.
  const session = await getSession();

  if (session.status === "anonymous") {
    redirect("/login");
  }

  const supabase = await createClient();
  const unreadResult =
    session.status === "ready"
      ? await supabase
          .from("notifications")
          .select("id", { count: "exact", head: true })
          .eq("recipient_id", session.userId)
          .is("read_at", null)
      : { count: 0, error: null };

  return (
    <DashboardShell
      email={session.status === "ready" ? session.email : ""}
      roleLabel={
        session.status === "ready"
          ? (session.profile.roles.find((r) =>
              [
                "appowner",
                "owner",
                "admin",
                "instructor",
                "ainstructor",
              ].includes(r),
            ) ?? "student")
          : "Rol doğrulanamadı"
      }
      roles={session.status === "ready" ? session.profile.roles : []}
      unreadNotificationCount={unreadResult.count ?? 0}
    >
      {children}
    </DashboardShell>
  );
}
