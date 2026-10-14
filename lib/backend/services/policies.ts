import { policyCommandSchema, policyExceptionSchema } from "@/lib/policies";
import type { Json } from "@/lib/supabase/database.types";
import { type BackendContext, requireBackendRole } from "../context";
import { databaseFailure, ok, parseInput } from "../result";
export async function savePolicy(context: BackendContext, input: unknown) {
  const { supabase } = await requireBackendRole(context, ["admin"]);
  const p = parseInput(policyCommandSchema, input);
  if (p.failure) return p.failure;
  const { error } = await supabase.rpc("policy_command", {
    p_data: p.data as Json,
  });
  if (error) return databaseFailure(error, "Ayar kaydedilemedi.");

  return ok("Ayar kaydedildi.");
}
export async function applyPolicyException(
  context: BackendContext,
  input: unknown,
) {
  const { supabase } = await requireBackendRole(context, ["owner", "appowner"]);
  const p = parseInput(policyExceptionSchema, input);
  if (p.failure) return p.failure;
  const { error } = await supabase.rpc("policy_cancel_exception", {
    p_data: p.data as Json,
  });
  if (error) return databaseFailure(error, "İstisna uygulanamadı.");

  return ok("Gerekçeli istisna uygulandı ve kaydedildi.");
}
