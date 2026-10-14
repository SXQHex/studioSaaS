import { cache } from "react";
import { type CurrentSession, loadBackendSession } from "@/lib/backend/context";
import { createClient } from "@/lib/supabase/server";

export type {
  AppRole,
  CurrentProfile,
  CurrentSession,
} from "@/lib/backend/context";
export const getSession = cache(async (): Promise<CurrentSession> => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const id = data?.claims?.sub;
  if (error || typeof id !== "string") return { status: "anonymous" };
  return loadBackendSession(
    supabase,
    id,
    typeof data?.claims?.email === "string" ? data?.claims?.email : "",
  );
});
