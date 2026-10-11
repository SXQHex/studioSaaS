import type { ServerSupabase } from "@/lib/supabase/server";
import type { Tables } from "@/lib/supabase/database.types";
import { pageRange } from "./pagination";

export const LESSON_STATUSES = ["scheduled", "completed", "cancelled", "postponed"] as const;

export type LessonRow = Pick<
  Tables<"lessons">,
  "id" | "type" | "title" | "starts_at" | "ends_at" | "status" | "instructor_id" | "private_member_id" | "notes" | "center_id" | "room_id" | "expected_attendees"
>;
export type LessonOption = Pick<Tables<"lessons">, "id" | "type" | "title" | "starts_at" | "status" | "private_member_id">;
export type InstructorOption = Pick<Tables<"profiles">, "id" | "full_name" | "role">;

export async function listLessons(
  supabase: ServerSupabase,
  { q, status, page }: { q: string; status: (typeof LESSON_STATUSES)[number] | ""; page: number },
) {
  const [from, to] = pageRange(page);
  let query = supabase
    .from("lessons")
    .select("id, type, title, starts_at, ends_at, status, instructor_id, private_member_id, notes, center_id, room_id, expected_attendees", { count: "exact" })
    .order("starts_at", { ascending: false })
    .range(from, to);
  if (q) query = query.or(`title.ilike.%${q}%,notes.ilike.%${q}%`);
  if (status) query = query.eq("status", status);

  const { data, count, error } = await query;
  return { rows: (data ?? []) as LessonRow[], total: count ?? 0, error: Boolean(error) };
}

export async function lessonStats(supabase: ServerSupabase) {
  const [all, scheduled, completed] = await Promise.all([
    supabase.from("lessons").select("id", { count: "exact", head: true }),
    supabase.from("lessons").select("id", { count: "exact", head: true }).eq("status", "scheduled"),
    supabase.from("lessons").select("id", { count: "exact", head: true }).eq("status", "completed"),
  ]);
  return { total: all.count ?? 0, scheduled: scheduled.count ?? 0, completed: completed.count ?? 0 };
}

export async function listInstructorOptions(supabase: ServerSupabase) {
  const { data } = await supabase
    .from("profiles")
    .select("id, full_name, role")
    .in("role", ["instructor", "admin"])
    .order("full_name");
  return (data ?? []) as InstructorOption[];
}

/** Most recent lessons for pickers (attendance form and filters). */
export async function listRecentLessonOptions(supabase: ServerSupabase, limit = 300) {
  const { data, error } = await supabase
    .from("lessons")
    .select("id, type, title, starts_at, status, private_member_id")
    .order("starts_at", { ascending: false })
    .limit(limit);
  return { rows: (data ?? []) as LessonOption[], error: Boolean(error) };
}
