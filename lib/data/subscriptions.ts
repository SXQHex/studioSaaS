import { z } from "zod";
import type { BackendClient as ServerSupabase } from "@/lib/backend/context";
import type { Tables } from "@/lib/supabase/database.types";
import { pageRange } from "./pagination";

export const SUBSCRIPTION_STATUSES = [
  "active",
  "expired",
  "cancelled",
] as const;

export type SubscriptionRow = Pick<
  Tables<"subscriptions">,
  | "id"
  | "member_id"
  | "type"
  | "catalog_snapshot"
  | "starts_on"
  | "ends_on"
  | "credits_purchased"
  | "credits_remaining"
  | "amount"
  | "payment_status"
  | "paid_at"
  | "status"
  | "notes"
> & {
  members: { full_name: string };
  effective_ends_on: string | null;
  frozen: boolean;
};

const SUBSCRIPTION_COLUMNS =
  "id, member_id, type, catalog_snapshot, starts_on, ends_on, credits_purchased, credits_remaining, amount, payment_status, paid_at, status, notes, members:members!subscriptions_member_id_fkey!inner(full_name)";

export async function listSubscriptions(
  supabase: ServerSupabase,
  {
    q,
    status,
    page,
  }: {
    q: string;
    status: (typeof SUBSCRIPTION_STATUSES)[number] | "";
    page: number;
  },
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
  const rows = (data ?? []) as unknown as Omit<
    SubscriptionRow,
    "effective_ends_on" | "frozen"
  >[];
  const terms = rows.length
    ? await supabase.rpc("subscription_summaries", {
        p_ids: rows.map((row) => row.id),
      })
    : { data: [], error: null };
  const byId = new Map((terms.data ?? []).map((row) => [row.id, row]));
  return {
    rows: rows.map((row) => ({
      ...row,
      effective_ends_on: byId.get(row.id)?.effective_ends_on ?? row.ends_on,
      frozen: byId.get(row.id)?.frozen ?? false,
    })),
    total: count ?? 0,
    error: Boolean(error || terms.error),
  };
}

const statsSchema = z.object({
  total: z.number(),
  active: z.number(),
  remainingCredits: z.number(),
});
export async function subscriptionStats(supabase: ServerSupabase) {
  const { data, error } = await supabase.rpc("subscription_stats");
  const parsed = statsSchema.safeParse(data);
  return {
    ...(parsed.success
      ? parsed.data
      : { total: 0, active: 0, remainingCredits: 0 }),
    error: Boolean(error || !parsed.success),
  };
}
export type LessonPackageEligibility = {
  member_id: string;
  available_credits: number;
};
export async function lessonPackageEligibility(
  supabase: ServerSupabase,
  lessonId: string,
) {
  if (!lessonId)
    return { rows: [] as LessonPackageEligibility[], error: false };
  const { data, error } = await supabase.rpc("lesson_package_eligibility", {
    p_lesson: lessonId,
  });
  return { rows: data ?? [], error: Boolean(error) };
}

/** Active packages for pickers (credit adjustments, attendance warnings). */
export async function listActiveSubscriptions(
  supabase: ServerSupabase,
  limit = 1000,
) {
  const { data, error } = await supabase
    .from("subscriptions")
    .select(
      "id, member_id, type, status, starts_on, ends_on, credits_purchased, credits_remaining, members:members!subscriptions_member_id_fkey!inner(full_name)",
    )
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
  | "id"
  | "member_id"
  | "type"
  | "status"
  | "starts_on"
  | "ends_on"
  | "credits_purchased"
  | "credits_remaining"
> & { members: { full_name: string } };
