import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export type AppRole = "appowner" | "owner" | "admin" | "instructor" | "ainstructor" | "student";

export type CurrentProfile = {
  id: string;
  fullName: string;
  role: "admin" | "instructor" | "student";
  roles: AppRole[];
};

export type CurrentSession =
  | { status: "anonymous" }
  | { status: "no-profile"; userId: string }
  | {
      status: "ready";
      userId: string;
      email: string;
      profile: CurrentProfile;
    };

/**
 * Resolves the signed-in user and profile once per request.
 * `cache()` de-duplicates the lookup between the dashboard layout, the page and
 * Server Actions that run in the same render pass.
 */
export const getSession = cache(async (): Promise<CurrentSession> => {
  const supabase = await createClient();
  const { data: authData, error: authError } = await supabase.auth.getClaims();
  const userId = authData?.claims?.sub;

  if (authError || typeof userId !== "string") {
    return { status: "anonymous" };
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, full_name, role")
    .eq("id", userId)
    .maybeSingle();

  if (profileError || !profile) {
    return { status: "no-profile", userId };
  }

  const { data: scopedRows, error: rolesError } = await supabase.rpc("my_scoped_roles" as never);
  const valid = new Set<AppRole>(["appowner", "owner", "admin", "instructor", "ainstructor"]);
  const scopedRoles: AppRole[] = !rolesError && Array.isArray(scopedRows)
    ? (scopedRows as unknown as Array<{ role: AppRole }>).filter((row) => row && typeof row === "object" && valid.has(row.role as AppRole))
      .map((row) => row.role as AppRole)
    : [];
  const roles = [...new Set<AppRole>(["student", ...scopedRoles])];
  const active = roles.some((role) => ["appowner", "owner", "admin"].includes(role))
    ? "admin" : roles.some((role) => ["instructor", "ainstructor"].includes(role))
      ? "instructor" : "student";
  const email = authData?.claims?.email;

  return {
    status: "ready",
    userId,
    email: typeof email === "string" ? email : "",
    profile: {
      id: profile.id,
      fullName: profile.full_name ?? "",
      role: active,
      roles,
    },
  };
});
