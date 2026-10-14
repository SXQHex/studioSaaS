"use server";
import { revalidateStudioViews } from "./revalidate";
import { requireRole } from "@/lib/supabase/access";
import { policyCommandSchema, policyExceptionSchema } from "@/lib/policies";
import { dbErrorMessage, fail, ok, parseInput } from "@/lib/actions/result";
import type { Json } from "@/lib/supabase/database.types";
export async function savePolicy(input: unknown) {
  const { supabase } = await requireRole(["admin"]);
  const p = parseInput(policyCommandSchema, input);
  if (p.failure) return p.failure;
  const { error } = await supabase.rpc("policy_command", {
    p_data: p.data as Json,
  });
  if (error) return fail(dbErrorMessage(error, "Ayar kaydedilemedi."));
  revalidateStudioViews();
  return ok("Ayar kaydedildi.");
}
export async function applyPolicyException(input: unknown) {
  const { supabase } = await requireRole(["owner", "appowner"]);
  const p = parseInput(policyExceptionSchema, input);
  if (p.failure) return p.failure;
  const { error } = await supabase.rpc("policy_cancel_exception", {
    p_data: p.data as Json,
  });
  if (error) return fail(dbErrorMessage(error, "İstisna uygulanamadı."));
  revalidateStudioViews();
  return ok("Gerekçeli istisna uygulandı ve kaydedildi.");
}
