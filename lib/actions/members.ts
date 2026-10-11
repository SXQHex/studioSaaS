"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/supabase/access";
import { memberSchema, memberStatusSchema } from "@/lib/validation/schemas";
import { type ActionResult, dbErrorMessage, ok, parseInput } from "./result";

export async function saveMember(id: string | null, input: unknown): Promise<ActionResult> {
  const { supabase } = await requireRole(["admin"]);
  const { data, failure } = parseInput(memberSchema, input);
  if (failure) return failure;

  const { center_id, ...memberFields } = data;
  const result = id
    ? await supabase.from("members").update(memberFields).eq("id", id)
    : await supabase.from("members").insert({ ...memberFields, center_id });
  if (result.error) return { ok: false, error: dbErrorMessage(result.error, "Üye kaydedilemedi.") };

  revalidatePath("/dashboard/members");
  return ok(id ? "Üye bilgileri güncellendi." : "Yeni üye kaydedildi.");
}

export async function setMemberActive(input: unknown): Promise<ActionResult> {
  const { supabase } = await requireRole(["admin"]);
  const { data, failure } = parseInput(memberStatusSchema, input);
  if (failure) return failure;

  const { error } = await supabase.from("members").update({ is_active: data.is_active }).eq("id", data.id);
  if (error) return { ok: false, error: dbErrorMessage(error, "Üye durumu güncellenemedi.") };

  revalidatePath("/dashboard/members");
  return ok(data.is_active ? "Üye yeniden aktifleştirildi." : "Üye pasife alındı.");
}
