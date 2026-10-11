"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/supabase/access";
import { subscriptionSchema, subscriptionUpdateSchema } from "@/lib/validation/schemas";
import { type ActionResult, dbErrorMessage, fail, ok, parseInput } from "./result";

const statusLabels = { active: "Aktif", expired: "Süresi doldu", cancelled: "İptal" } as const;
const paymentLabels = { pending: "Bekliyor", paid: "Ödendi" } as const;

function revalidateSubscriptionViews() {
  revalidatePath("/dashboard/subscriptions");
  revalidatePath("/dashboard/credits");
  revalidatePath("/dashboard/attendance");
}

export async function createSubscription(input: unknown): Promise<ActionResult> {
  const { supabase, userId } = await requireRole(["admin"]);
  const { data, failure } = parseInput(subscriptionSchema, input);
  if (failure) return failure;

  const { error } = await supabase.from("subscriptions").insert({
    member_id: data.member_id,
    type: data.type,
    starts_on: data.starts_on,
    ends_on: data.ends_on,
    credits_purchased: data.credits_purchased,
    credits_remaining: data.credits_purchased,
    amount: data.amount,
    payment_status: data.payment_status,
    paid_at: data.payment_status === "paid" ? new Date().toISOString() : null,
    notes: data.notes,
    created_by: userId,
  });
  if (error) return fail(dbErrorMessage(error, "Abonelik oluşturulamadı."));

  revalidateSubscriptionViews();
  return ok("Abonelik oluşturuldu. İlk kredi hareketi veritabanı tetikleyicisiyle kaydedildi.");
}

export async function updateSubscription(input: unknown): Promise<ActionResult> {
  const { supabase } = await requireRole(["admin"]);
  const { data, failure } = parseInput(subscriptionUpdateSchema, input);
  if (failure) return failure;

  const changes: {
    status?: "active" | "expired" | "cancelled";
    payment_status?: "pending" | "paid";
    paid_at?: string | null;
  } = {};
  if (data.status) changes.status = data.status;
  if (data.payment_status) {
    changes.payment_status = data.payment_status;
    changes.paid_at = data.payment_status === "paid" ? new Date().toISOString() : null;
  }

  const { error } = await supabase.from("subscriptions").update(changes).eq("id", data.id);
  if (error) return fail(dbErrorMessage(error, "Abonelik güncellenemedi."));

  revalidateSubscriptionViews();
  const label = data.status ? statusLabels[data.status] : data.payment_status ? paymentLabels[data.payment_status] : "Güncelle";
  return ok(`Abonelik güncellendi: ${label}.`);
}
