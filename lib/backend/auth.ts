import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import {
  type BackendConfig,
  type BackendContext,
  loadBackendSession,
} from "./context";
import { BackendError } from "./errors";
/** Fresh client per request. The publishable key + caller JWT preserves RLS. */
export async function authenticateBearer(
  request: Request,
  config: BackendConfig,
): Promise<BackendContext> {
  const header = request.headers.get("authorization");
  const token = header?.match(/^Bearer ([^\s]+)$/i)?.[1];
  if (!token || token.length > 8192)
    throw new BackendError(
      401,
      "UNAUTHENTICATED",
      "Geçerli Bearer token gerekli.",
    );
  const { url, publishableKey: key } = config;
  if (!url || !key)
    throw new BackendError(503, "NOT_CONFIGURED", "API yapılandırması eksik.");
  const supabase = createClient<Database>(url, key, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user)
    throw new BackendError(
      401,
      "UNAUTHENTICATED",
      "Oturum geçersiz veya süresi dolmuş.",
    );
  const actor = await loadBackendSession(
    supabase,
    data.user.id,
    data.user.email ?? "",
  );
  if (actor.status !== "ready")
    throw new BackendError(
      403,
      "PROFILE_REQUIRED",
      "Giriş hesabına ait profil bulunamadı.",
    );
  return {
    supabase,
    userId: actor.userId,
    email: actor.email,
    profile: actor.profile,
    config,
  };
}
