import { subscriptionUpdateSchema } from "@/lib/validation/schemas";

import { type BackendContext, requireBackendRole } from "../context";
import {
  type ActionResult,
  databaseFailure,
  fail,
  ok,
  parseInput,
} from "../result";

const statusLabels = {
  active: "Aktif",
  expired: "Süresi doldu",
  cancelled: "İptal",
} as const;

export async function updateSubscription(
  context: BackendContext,
  input: unknown,
): Promise<ActionResult> {
  const { supabase } = await requireBackendRole(context, ["admin"]);
  const { data, failure } = parseInput(subscriptionUpdateSchema, input);
  if (failure) return failure;

  const { data: updated, error } = await supabase
    .from("subscriptions")
    .update({ status: data.status })
    .eq("id", data.id)
    .select("id")
    .maybeSingle();
  if (error) return databaseFailure(error, "Abonelik güncellenemedi.");

  if (!updated) return fail("Abonelik bulunamadı veya yetkiniz yok.");

  const label = statusLabels[data.status];
  return ok(`Abonelik güncellendi: ${label}.`);
}
