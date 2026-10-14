import { createClient as createIsolatedSupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { type BackendContext, requireBackendRole } from "../context";
import {
  type ActionResult,
  databaseFailure,
  fail,
  ok,
  parseInput,
} from "../result";

export const editProfileSchema = z.object({
  full_name: z
    .string()
    .trim()
    .min(2, "Adınız en az iki karakter olmalı.")
    .max(160, "Adınız en fazla 160 karakter olabilir."),
});

export const passwordSchema = z
  .object({
    current_password: z.string().min(1, "Mevcut şifrenizi girin."),
    new_password: z
      .string()
      .min(8, "Yeni şifre en az sekiz karakter olmalı.")
      .max(128, "Şifre çok uzun."),
    confirm_password: z.string(),
  })
  .superRefine((value, ctx) => {
    if (value.new_password === value.current_password) {
      ctx.addIssue({
        code: "custom",
        path: ["new_password"],
        message: "Yeni şifre mevcut şifreden farklı olmalı.",
      });
    }
    if (value.new_password !== value.confirm_password) {
      ctx.addIssue({
        code: "custom",
        path: ["confirm_password"],
        message: "Yeni şifreler eşleşmiyor.",
      });
    }
  });

/** Self-service profile edits cannot change profile role or scoped assignments. */
export async function updateMyProfile(
  context: BackendContext,
  input: unknown,
): Promise<ActionResult> {
  const { supabase, userId } = await requireBackendRole(context, ["student"]);
  const parsed = parseInput(editProfileSchema, input);
  if (parsed.failure) return parsed.failure;

  const { data, error } = await supabase
    .from("profiles")
    .update({ full_name: parsed.data.full_name })
    .eq("id", userId)
    .select("id")
    .maybeSingle();
  if (error) return databaseFailure(error, "Profil güncellenemedi.");
  if (!data) return fail("Profil güncellenemedi; erişiminizi kontrol edin.");

  return ok("Profil adınız güncellendi.");
}

/**
 * Verify knowledge of the current password in an isolated, non-persisted Auth
 * session, then update ONLY the current logged-in account. Never store passwords
 * in profiles, application tables or logs.
 */
export async function changeMyPassword(
  context: BackendContext,
  input: unknown,
): Promise<ActionResult> {
  const { userId, email } = await requireBackendRole(context, ["student"]);
  const parsed = parseInput(passwordSchema, input);
  if (parsed.failure) return parsed.failure;
  if (!email) return fail("Oturum e-postası doğrulanamadı.");

  const url = context.config?.url;
  const key = context.config?.publishableKey;
  if (!url || !key) return fail("Kimlik doğrulama yapılandırması eksik.");

  const verificationClient = createIsolatedSupabaseClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
  const { data: verified, error: verifyError } =
    await verificationClient.auth.signInWithPassword({
      email,
      password: parsed.data.current_password,
    });
  if (verifyError || verified.user?.id !== userId) {
    return fail("Mevcut şifre doğrulanamadı.");
  }

  const { error } = await verificationClient.auth.updateUser({
    password: parsed.data.new_password,
  });
  await verificationClient.auth.signOut({ scope: "local" });
  if (error)
    return fail(
      "Şifre değiştirilemedi. Gerekirse şifre sıfırlama bağlantısını kullanın.",
    );
  return ok(
    "Şifreniz güncellendi. Yeni şifrenizle tekrar giriş yapabilirsiniz.",
  );
}
