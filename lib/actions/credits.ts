"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/supabase/access";
import { creditAdjustmentSchema } from "@/lib/validation/schemas";
import { type ActionResult, dbErrorMessage, fail, ok, parseInput } from "./result";

/**
 * Appends a manual adjustment to the credit ledger. The balance itself is updated by the
 * `credit_transactions_apply_manual_change` trigger; the member is taken from the
 * subscription rather than from the client so the two can never disagree.
 */
export async function adjustCredits(input: unknown): Promise<ActionResult> {
  const { supabase, userId } = await requireRole(["admin"]);
  const { data, failure } = parseInput(creditAdjustmentSchema, input);
  if (failure) return failure;

  const { data: subscription, error: readError } = await supabase
    .from("subscriptions")
    .select("id, member_id, status, credits_remaining, credits_purchased")
    .eq("id", data.subscription_id)
    .maybeSingle();
  if (readError || !subscription) return fail("Abonelik bulunamadı.");
  if (subscription.status !== "active") return fail("Yalnızca aktif abonelikler için kredi düzeltmesi yapılabilir.");

  const nextBalance = subscription.credits_remaining + data.amount;
  if (nextBalance < 0 || nextBalance > subscription.credits_purchased) {
    return fail("Bu değişiklik kredi bakiyesini 0 ile satın alınan kredi sayısı aralığının dışına çıkarıyor.");
  }

  const { error } = await supabase.from("credit_transactions").insert({
    subscription_id: subscription.id,
    member_id: subscription.member_id,
    amount: data.amount,
    reason: "admin_adjustment",
    note: data.note,
    created_by: userId,
  });
  if (error) return fail(dbErrorMessage(error, "Kredi düzeltmesi yapılamadı. Bakiye ve yetkiyi kontrol edin."));

  revalidatePath("/dashboard/credits");
  revalidatePath("/dashboard/subscriptions");
  return ok("Kredi düzeltmesi kaydedildi. Bakiye veritabanı tetikleyicisiyle güncellendi.");
}
