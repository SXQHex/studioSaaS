import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { type AppRole, getSession } from "@/lib/supabase/session";

export type { AppRole } from "@/lib/supabase/session";

/**
 * Server-side gate for pages and Server Actions. Redirects anonymous users to
 * the login page and users without a permitted role to the dashboard home.
 */
export async function requireRole(allowedRoles: AppRole[]) {
  const session = await getSession();

  if (session.status === "anonymous") {
    redirect("/login");
  }
  if (session.status === "no-profile") {
    redirect("/login?error=profile");
  }
  if (!allowedRoles.includes(session.profile.role)) {
    redirect("/dashboard");
  }

  return {
    supabase: await createClient(),
    userId: session.userId,
    email: session.email,
    profile: session.profile,
  };
}
