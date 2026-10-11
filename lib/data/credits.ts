import type { ServerSupabase } from "@/lib/supabase/server";
import type { Tables } from "@/lib/supabase/database.types";
import { pageRange } from "./pagination";

export const CREDIT_REASONS = ["purchase", "lesson_use", "admin_adjustment", "refund"] as const;
export type CreditReason = (typeof CREDIT_REASONS)[number];

export type TransactionRow = Pick<
  Tables<"credit_transactions">,
  "id" | "subscription_id" | "member_id" | "lesson_id" | "amount" | "note" | "created_at"
> & {
  reason: CreditReason;
  members: { full_name: string };
  subscriptions: { type: Tables<"subscriptions">["type"] } | null;
};

export async function listTransactions(supabase: ServerSupabase, { q, page }: { q: string; page: number }) {
  const [from, to] = pageRange(page);
  let query = supabase
    .from("credit_transactions")
    .select(
      "id, subscription_id, member_id, lesson_id, amount, reason, note, created_at, members:members!credit_transactions_member_id_fkey!inner(full_name), subscriptions:subscriptions!credit_transactions_subscription_id_fkey(type)",
      { count: "exact" },
    )
    .order("created_at", { ascending: false })
    .range(from, to);

  if (q) {
    // Match the member name or the note. PostgREST cannot OR across an embedded resource,
    // so resolve matching member ids first (UUIDs are safe to interpolate).
    const { data: matches } = await supabase.from("members").select("id").ilike("full_name", `%${q}%`).limit(200);
    const ids = (matches ?? []).map((member) => member.id);
    query = query.or(
      ids.length > 0 ? `member_id.in.(${ids.join(",")}),note.ilike.%${q}%` : `note.ilike.%${q}%`,
    );
  }

  const { data, count, error } = await query;
  return { rows: (data ?? []) as unknown as TransactionRow[], total: count ?? 0, error: Boolean(error) };
}
