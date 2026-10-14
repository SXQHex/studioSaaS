"use server";

import { revalidateStudioViews } from "./revalidate";
import { z } from "zod";
import { requireRole } from "@/lib/supabase/access";
import {
  type ActionResult,
  dbErrorMessage,
  fail,
  ok,
  parseInput,
} from "@/lib/actions/result";

const roleSchema = z.object({
  center_id: z.string().uuid(),
  role: z.enum(["admin", "instructor", "ainstructor"]),
});
const assignSchema = roleSchema.extend({
  email: z.string().trim().email().max(254),
});
const removeSchema = roleSchema.extend({
  profile_id: z.string().uuid(),
});

export async function assignScopedCenterRole(
  input: unknown,
): Promise<ActionResult> {
  const { supabase } = await requireRole(["admin"]);
  const parsed = parseInput(assignSchema, input);
  if (parsed.failure) return parsed.failure;

  const { data: accounts, error: lookupError } = await supabase.rpc(
    "lookup_center_account",
    {
      p_center_id: parsed.data.center_id,
      p_email: parsed.data.email,
    },
  );
  if (lookupError)
    return fail(dbErrorMessage(lookupError, "Hesap sorgulanamadı."));
  if (!accounts?.[0])
    return fail("Bu e-postaya sahip doğrulanmış bir giriş hesabı bulunamadı.");

  const { error } = await supabase.rpc("assign_center_role", {
    p_center_id: parsed.data.center_id,
    p_profile_id: accounts[0].profile_id,
    p_role: parsed.data.role,
  });
  if (error) return fail(dbErrorMessage(error, "Rol atanamadı."));
  revalidateStudioViews();
  return ok("Kullanıcının merkeze ait rolü atandı.");
}

export async function removeScopedCenterRole(
  input: unknown,
): Promise<ActionResult> {
  const { supabase } = await requireRole(["admin"]);
  const parsed = parseInput(removeSchema, input);
  if (parsed.failure) return parsed.failure;

  const { error } = await supabase.rpc("remove_center_role", {
    p_center_id: parsed.data.center_id,
    p_profile_id: parsed.data.profile_id,
    p_role: parsed.data.role,
  });
  if (error) return fail(dbErrorMessage(error, "Rol kaldırılamadı."));
  revalidateStudioViews();
  return ok("Merkez rolü kaldırıldı.");
}
