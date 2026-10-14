"use server";

import { revalidateStudioViews } from "./revalidate";
import { requireRole } from "@/lib/supabase/access";
import { subscriptionUpdateSchema } from "@/lib/validation/schemas";
import {
  type ActionResult,
  dbErrorMessage,
  fail,
  ok,
  parseInput,
} from "./result";

const statusLabels = {
  active: "Aktif",
  expired: "Süresi doldu",
  cancelled: "İptal",
} as const;

export async function updateSubscription(
  input: unknown,
): Promise<ActionResult> {
  const { supabase } = await requireRole(["admin"]);
  const { data, failure } = parseInput(subscriptionUpdateSchema, input);
  if (failure) return failure;

  const { data: updated, error } = await supabase
    .from("subscriptions")
    .update({ status: data.status })
    .eq("id", data.id)
    .select("id")
    .maybeSingle();
  if (error) return fail(dbErrorMessage(error, "Abonelik güncellenemedi."));

  if (!updated) return fail("Abonelik bulunamadı veya yetkiniz yok.");
  revalidateStudioViews();
  const label = statusLabels[data.status];
  return ok(`Abonelik güncellendi: ${label}.`);
}
