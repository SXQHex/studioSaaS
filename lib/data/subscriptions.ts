import type { ServerSupabase } from "@/lib/supabase/server";
import type { Tables } from "@/lib/supabase/database.types";
import { pageRange } from "./pagination";

export const SUBSCRIPTION_STATUSES = ["active", "expired", "cancelled"] as const;

export type SubscriptionRow = Pick<
  Tables<"subscriptions">,
  | "id"
  | "member_id"
  | "type"
  | "starts_on"
  | "ends_on"
  | "credits_purchased"
  | "credits_remaining"
  | "amount"
  | "payment_status"
  | "paid_at"
  | "status"
  | "notes"
> & { members: { full_name: string } };

const SUBSCRIPTION_COLUMNS =
  "id, member_id, type, starts_on, ends_on, credits_purchased, credits_remaining, amount, payment_status, paid_at, status, notes, members:members!subscriptions_member_id_fkey!inner(full_name)";

export async function listSubscriptions(
  supabase: ServerSupabase,
  { q, status, page }: { q: string; status: (typeof SUBSCRIPTION_STATUSES)[number] | ""; page: number },
) {
  const [from, to] = pageRange(page);
  let query = supabase
    .from("subscriptions")
    .select(SUBSCRIPTION_COLUMNS, { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, to);
  if (q) query = query.ilike("members.full_name", `%${q}%`);
  if (status) query = query.eq("status", status);

  const { data, count, error } = await query;
  return { rows: (data ?? []) as unknown as SubscriptionRow[], total: count ?? 0, error: Boolean(error) };
}

export async function subscriptionStats(supabase: ServerSupabase) {
  const [all, active] = await Promise.all([
    supabase.from("subscriptions").select("id", { count: "exact", head: true }),
    supabase.from("subscriptions").select("credits_remaining").eq("status", "active"),
  ]);
  const activeRows = active.data ?? [];
  return {
    total: all.count ?? 0,
    active: activeRows.length,
    remainingCredits: activeRows.reduce((sum, row) => sum + row.credits_remaining, 0),
  };
}

/** Active packages for pickers (credit adjustments, attendance warnings). */
export async function listActiveSubscriptions(supabase: ServerSupabase, limit = 1000) {
  const { data, error } = await supabase
    .from("subscriptions")
    .select("id, member_id, type, status, starts_on, ends_on, credits_purchased, credits_remaining, members:members!subscriptions_member_id_fkey!inner(full_name)")
    .eq("status", "active")
    .order("starts_on", { ascending: false })
    .limit(limit);
  return {
    rows: (data ?? []) as unknown as ActiveSubscription[],
    error: Boolean(error),
  };
}

export type ActiveSubscription = Pick<
  Tables<"subscriptions">,
  "id" | "member_id" | "type" | "status" | "starts_on" | "ends_on" | "credits_purchased" | "credits_remaining"
> & { members: { full_name: string } };
