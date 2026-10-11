import { attendanceStats, listAttendance, recordedMemberIds } from "@/lib/data/attendance";
import { listRecentLessonOptions } from "@/lib/data/lessons";
import { listMemberOptions } from "@/lib/data/members";
import { parsePage, pickUuid, sanitizeSearchTerm, type SearchParams } from "@/lib/data/pagination";
import { listActiveSubscriptions } from "@/lib/data/subscriptions";
import { requireRole } from "@/lib/supabase/access";
import { AttendanceManager } from "./attendance-manager";

export const metadata = { title: "Yoklama | FTK Studio" };

export default async function AttendancePage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const { supabase } = await requireRole(["admin", "instructor"]);
  const params = await searchParams;
  const q = sanitizeSearchTerm(params.q);
  const lessonId = pickUuid(params.lesson);
  const page = parsePage(params.page);

  const [list, stats, lessons, members, subscriptions, recorded] = await Promise.all([
    listAttendance(supabase, { q, lessonId, page }),
    attendanceStats(supabase),
    listRecentLessonOptions(supabase),
    listMemberOptions(supabase),
    listActiveSubscriptions(supabase),
    recordedMemberIds(supabase, lessonId),
  ]);

  return (
    <div className="dashboard-content">
      <AttendanceManager
        lessons={lessons.rows}
        members={members.rows}
        attendance={list.rows}
        total={list.total}
        stats={stats}
        recordedMemberIds={recorded}
        subscriptions={subscriptions.rows}
        lessonId={lessonId}
        query={q}
        page={page}
        loadError={list.error || lessons.error || members.error || subscriptions.error}
      />
    </div>
  );
}
