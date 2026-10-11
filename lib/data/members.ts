import type { ServerSupabase } from "@/lib/supabase/server";
import type { Tables } from "@/lib/supabase/database.types";
import { pageRange } from "./pagination";

export type MemberRow = Pick<Tables<"members">, "id" | "center_id" | "full_name" | "phone" | "email" | "notes" | "is_active" | "created_at">;
export type MemberOption = Pick<Tables<"members">, "id" | "full_name" | "is_active">;

const MEMBER_COLUMNS = "id, center_id, full_name, phone, email, notes, is_active, created_at";
/** Upper bound for dropdown option lists; larger studios should switch to a searchable picker. */
export const OPTION_LIMIT = 1000;

export async function listMembers(supabase: ServerSupabase, { q, page }: { q: string; page: number }) {
  const [from, to] = pageRange(page);
  let query = supabase
    .from("members")
    .select(MEMBER_COLUMNS, { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, to);
  if (q) query = query.or(`full_name.ilike.%${q}%,phone.ilike.%${q}%,email.ilike.%${q}%`);

  const { data, count, error } = await query;
  return { rows: (data ?? []) as MemberRow[], total: count ?? 0, error: Boolean(error) };
}

export async function memberStats(supabase: ServerSupabase) {
  const [all, active] = await Promise.all([
    supabase.from("members").select("id", { count: "exact", head: true }),
    supabase.from("members").select("id", { count: "exact", head: true }).eq("is_active", true),
  ]);
  const total = all.count ?? 0;
  const activeCount = active.count ?? 0;
  return { total, active: activeCount, inactive: Math.max(0, total - activeCount), error: Boolean(all.error || active.error) };
}

export async function listMemberOptions(supabase: ServerSupabase) {
  const { data, error } = await supabase
    .from("members")
    .select("id, full_name, is_active")
    .order("full_name")
    .limit(OPTION_LIMIT);
  return { rows: (data ?? []) as MemberOption[], error: Boolean(error) };
}
