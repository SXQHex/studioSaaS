import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export type AppRole = "admin" | "instructor" | "student";

export type CurrentProfile = {
  id: string;
  fullName: string;
  role: AppRole;
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

  const email = authData?.claims?.email;

  return {
    status: "ready",
    userId,
    email: typeof email === "string" ? email : "",
    profile: {
      id: profile.id,
      fullName: profile.full_name ?? "",
      role: profile.role,
    },
  };
});
