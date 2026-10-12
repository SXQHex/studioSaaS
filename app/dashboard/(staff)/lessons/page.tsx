import { LESSON_STATUSES, lessonStats, listInstructorOptions, listLessons } from "@/lib/data/lessons";
import { listMemberOptions } from "@/lib/data/members";
import { parsePage, pickOption, type SearchParams, sanitizeSearchTerm } from "@/lib/data/pagination";
import { listSchedulingResources } from "@/lib/data/session-requests";
import { requireRole } from "@/lib/supabase/access";
import { LessonsManager } from "./lessons-manager";

export const metadata = { title: "Ders Takvimi | FTK Studio" };

export default async function LessonsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const { supabase, profile } = await requireRole(["admin", "instructor"]);
  const params = await searchParams;
  const q = sanitizeSearchTerm(params.q);
  const status = pickOption(params.status, LESSON_STATUSES);
  const page = parsePage(params.page);

  const calendarStart = new Date();
  calendarStart.setMonth(calendarStart.getMonth() - 6, 1);
  calendarStart.setHours(0, 0, 0, 0);
  const calendarEnd = new Date();
  calendarEnd.setMonth(calendarEnd.getMonth() + 12, 1);
  calendarEnd.setHours(23, 59, 59, 999);
  const [list, stats, members, instructors, resources, calendarResult] = await Promise.all([
    listLessons(supabase, { q, status, page }),
    lessonStats(supabase),
    listMemberOptions(supabase),
    listInstructorOptions(supabase),
    listSchedulingResources(supabase),
    supabase.from("lessons").select("id, type, title, starts_at, ends_at, status, instructor_id, private_member_id, notes, center_id, room_id, expected_attendees").gte("starts_at", calendarStart.toISOString()).lte("starts_at", calendarEnd.toISOString()).order("starts_at").limit(1500),
  ]);

  return (
    <div className="dashboard-content">
      <LessonsManager
        canManage={profile.role === "admin"}
        lessons={list.rows}
        calendarLessons={(calendarResult.data ?? []) as typeof list.rows}
        total={list.total}
        stats={stats}
        members={members.rows}
        instructors={instructors}
        centers={resources.centers}
        rooms={resources.rooms}
        query={q}
        status={status}
        page={page}
        loadError={list.error || resources.error || Boolean(calendarResult.error)}
      />
    </div>
  );
}
