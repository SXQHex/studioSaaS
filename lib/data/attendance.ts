import type { ServerSupabase } from "@/lib/supabase/server";
import type { Tables } from "@/lib/supabase/database.types";
import { pageRange } from "./pagination";

export type AttendanceRow = Pick<
  Tables<"attendance">,
  "id" | "lesson_id" | "member_id" | "attended" | "checked_in_at" | "notes"
> & {
  members: { full_name: string; email: string | null; phone: string | null };
  lessons: { title: string; starts_at: string } | null;
};

export async function listAttendance(
  supabase: ServerSupabase,
  { q, lessonId, page }: { q: string; lessonId: string; page: number },
) {
  const [from, to] = pageRange(page);
  let query = supabase
    .from("attendance")
    .select(
      "id, lesson_id, member_id, attended, checked_in_at, notes, members:members!attendance_member_id_fkey!inner(full_name, email, phone), lessons:lessons!attendance_lesson_id_fkey(title, starts_at)",
      { count: "exact" },
    )
    .order("checked_in_at", { ascending: false })
    .range(from, to);
  if (q) query = query.ilike("members.full_name", `%${q}%`);
  if (lessonId) query = query.eq("lesson_id", lessonId);

  const { data, count, error } = await query;
  return { rows: (data ?? []) as unknown as AttendanceRow[], total: count ?? 0, error: Boolean(error) };
}

export async function attendanceStats(supabase: ServerSupabase) {
  const [all, attended] = await Promise.all([
    supabase.from("attendance").select("id", { count: "exact", head: true }),
    supabase.from("attendance").select("id", { count: "exact", head: true }).eq("attended", true),
  ]);
  const total = all.count ?? 0;
  const present = attended.count ?? 0;
  return { total, attended: present, absent: Math.max(0, total - present) };
}

/** Members who already have an attendance row for the lesson (they cannot be added twice). */
export async function recordedMemberIds(supabase: ServerSupabase, lessonId: string) {
  if (!lessonId) return [] as string[];
  const { data } = await supabase.from("attendance").select("member_id").eq("lesson_id", lessonId);
  return (data ?? []).map((row) => row.member_id);
}
