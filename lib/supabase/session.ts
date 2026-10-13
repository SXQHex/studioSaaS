import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export type AppRole = "appowner" | "owner" | "admin" | "instructor" | "ainstructor" | "student";

export type CurrentProfile = {
  id: string;
  fullName: string;
  role: "admin" | "instructor" | "student";
  roles: AppRole[];
  assignments: { role: AppRole; scopeType: 'platform' | 'organization' | 'center' | 'lesson'; scopeId: string | null }[];
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

  const { data: scopedRows, error: rolesError } = await supabase.rpc("my_scoped_roles");
  const permitted = new Set<AppRole>(["appowner", "owner", "admin", "instructor", "ainstructor"]);
  const scopes = new Set(["platform", "organization", "center", "lesson"]);
  // A role only contributes privileges if its scope is valid and authenticated.
  const assignments = !rolesError && Array.isArray(scopedRows)
    ? scopedRows.filter((r) => {
      if (!r || !permitted.has(r.role as AppRole) || !scopes.has(r.scope_type)) return false;
      if (r.scope_type === "platform") return r.role === "appowner" && r.scope_id === null;
      if (r.scope_type === "organization") return r.role === "owner" && typeof r.scope_id === "string";
      if (r.scope_type === "center") return ["admin", "instructor", "ainstructor"].includes(r.role) && typeof r.scope_id === "string";
      return ["instructor", "ainstructor"].includes(r.role) && typeof r.scope_id === "string";
    }).map((r) => ({ role: r.role as AppRole, scopeType: r.scope_type as "platform" | "organization" | "center" | "lesson", scopeId: r.scope_id }))
    : [];
  const roles: AppRole[] = [...new Set<AppRole>(["student", ...assignments.map((r) => r.role)])];
  const active = roles.some((r) => ["appowner", "owner", "admin"].includes(r))
    ? "admin" : roles.some((r) => r === "instructor" || r === "ainstructor") ? "instructor" : "student";
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
      assignments,
    },
  };
});
