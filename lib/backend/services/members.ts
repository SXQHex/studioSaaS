import { databaseId } from "@/lib/validation/database-id";
import { z } from "zod";
import { memberSchema, memberStatusSchema } from "@/lib/validation/schemas";
import { type BackendContext, requireBackendRole } from "../context";
import { type ActionResult, dbErrorMessage, ok, parseInput } from "../result";

export async function saveMember(
  context: BackendContext,
  id: string | null,
  input: unknown,
): Promise<ActionResult> {
  const { supabase } = await requireBackendRole(context, ["admin"]);
  const { data, failure } = parseInput(memberSchema, input);
  if (failure) return failure;

  const { center_id, ...memberFields } = data;
  const result = id
    ? await supabase.from("members").update(memberFields).eq("id", id)
    : await supabase.from("members").insert({ ...memberFields, center_id });
  if (result.error)
    return {
      ok: false,
      error: dbErrorMessage(result.error, "Üye kaydedilemedi."),
    };

  return ok(id ? "Üye bilgileri güncellendi." : "Yeni üye kaydedildi.");
}

export async function setMemberActive(
  context: BackendContext,
  input: unknown,
): Promise<ActionResult> {
  const { supabase } = await requireBackendRole(context, ["admin"]);
  const { data, failure } = parseInput(memberStatusSchema, input);
  if (failure) return failure;

  const { error } = await supabase
    .from("members")
    .update({ is_active: data.is_active })
    .eq("id", data.id);
  if (error)
    return {
      ok: false,
      error: dbErrorMessage(error, "Üye durumu güncellenemedi."),
    };

  return ok(
    data.is_active ? "Üye yeniden aktifleştirildi." : "Üye pasife alındı.",
  );
}

const exactEmail = z
  .string()
  .trim()
  .email("Geçerli bir giriş e-postası girin.")
  .max(254)
  .transform((e) => e.toLowerCase());
const uuid = databaseId();
export const centerAccountSchema = z.object({
  center_id: uuid,
  email: exactEmail,
});
export const memberAccountSchema = z.object({
  member_id: uuid,
  email: exactEmail,
});
export const memberLinkSchema = z.object({ member_id: uuid });

export type CenterAccount = {
  profile_id: string;
  email: string;
  full_name: string;
  linked_member_id: string | null;
};

export async function lookupCenterAccount(
  context: BackendContext,
  input: unknown,
): Promise<
  { ok: true; account: CenterAccount | null } | { ok: false; error: string }
> {
  const { supabase } = await requireBackendRole(context, ["admin"]);
  const parsed = centerAccountSchema.safeParse(input);
  if (!parsed.success)
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Giriş bilgileri geçersiz.",
    };
  const { data, error } = await supabase.rpc("lookup_center_account", {
    p_center_id: parsed.data.center_id,
    p_email: parsed.data.email,
  });
  if (error)
    return { ok: false, error: dbErrorMessage(error, "Hesap aranamadı.") };
  return { ok: true, account: data?.[0] ?? null };
}

export async function linkMemberAccount(
  context: BackendContext,
  input: unknown,
): Promise<ActionResult> {
  const { supabase } = await requireBackendRole(context, ["admin"]);
  const parsed = parseInput(memberAccountSchema, input);
  if (parsed.failure) return parsed.failure;
  const { error } = await supabase.rpc("link_member_account", {
    p_member_id: parsed.data.member_id,
    p_account_email: parsed.data.email,
  });
  if (error)
    return {
      ok: false,
      error: dbErrorMessage(error, "Hesap üyeye bağlanamadı."),
    };

  return ok("Üye giriş hesabına bağlandı.");
}

export async function unlinkMemberAccount(
  context: BackendContext,
  input: unknown,
): Promise<ActionResult> {
  const { supabase } = await requireBackendRole(context, ["admin"]);
  const parsed = parseInput(memberLinkSchema, input);
  if (parsed.failure) return parsed.failure;
  const { error } = await supabase.rpc("unlink_member_account", {
    p_member_id: parsed.data.member_id,
  });
  if (error)
    return {
      ok: false,
      error: dbErrorMessage(error, "Hesap bağlantısı kaldırılamadı."),
    };

  return ok("Üyenin giriş hesabı bağlantısı kaldırıldı.");
}
