import { z } from "zod";
import { type BackendContext, requireBackendRole } from "../context";
import {
  type ActionResult,
  databaseFailure,
  fail,
  ok,
  parseInput,
} from "../result";

const roleSchema = z.object({
  center_id: z.string().uuid(),
  role: z.enum(["admin", "instructor", "ainstructor"]),
});
export const assignSchema = roleSchema.extend({
  email: z.string().trim().email().max(254),
});
export const removeSchema = roleSchema.extend({
  profile_id: z.string().uuid(),
});

export async function assignScopedCenterRole(
  context: BackendContext,
  input: unknown,
): Promise<ActionResult> {
  const { supabase } = await requireBackendRole(context, ["admin"]);
  const parsed = parseInput(assignSchema, input);
  if (parsed.failure) return parsed.failure;

  const { data: accounts, error: lookupError } = await supabase.rpc(
    "lookup_center_account",
    {
      p_center_id: parsed.data.center_id,
      p_email: parsed.data.email,
    },
  );
  if (lookupError) return databaseFailure(lookupError, "Hesap sorgulanamadı.");
  if (!accounts?.[0])
    return fail("Bu e-postaya sahip doğrulanmış bir giriş hesabı bulunamadı.");

  const { error } = await supabase.rpc("assign_center_role", {
    p_center_id: parsed.data.center_id,
    p_profile_id: accounts[0].profile_id,
    p_role: parsed.data.role,
  });
  if (error) return databaseFailure(error, "Rol atanamadı.");

  return ok("Kullanıcının merkeze ait rolü atandı.");
}

export async function removeScopedCenterRole(
  context: BackendContext,
  input: unknown,
): Promise<ActionResult> {
  const { supabase } = await requireBackendRole(context, ["admin"]);
  const parsed = parseInput(removeSchema, input);
  if (parsed.failure) return parsed.failure;

  const { error } = await supabase.rpc("remove_center_role", {
    p_center_id: parsed.data.center_id,
    p_profile_id: parsed.data.profile_id,
    p_role: parsed.data.role,
  });
  if (error) return databaseFailure(error, "Rol kaldırılamadı.");

  return ok("Merkez rolü kaldırıldı.");
}
