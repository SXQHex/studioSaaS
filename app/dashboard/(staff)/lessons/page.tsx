import { LESSON_STATUSES, lessonStats, listInstructorOptions, listLessons } from "@/lib/data/lessons";
import { listMemberOptions } from "@/lib/data/members";
import { listSchedulingResources } from "@/lib/data/session-requests";
import { parsePage, pickOption, sanitizeSearchTerm, type SearchParams } from "@/lib/data/pagination";
import { requireRole } from "@/lib/supabase/access";
import { LessonsManager } from "./lessons-manager";

export const metadata = { title: "Ders Takvimi | FTK Studio" };

export default async function LessonsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const { supabase, profile } = await requireRole(["admin", "instructor"]);
  const params = await searchParams;
  const q = sanitizeSearchTerm(params.q);
  const status = pickOption(params.status, LESSON_STATUSES);
  const page = parsePage(params.page);

  const [list, stats, members, instructors, resources] = await Promise.all([
    listLessons(supabase, { q, status, page }),
    lessonStats(supabase),
    listMemberOptions(supabase),
    listInstructorOptions(supabase),
    listSchedulingResources(supabase),
  ]);

  return (
    <div className="dashboard-content">
      <LessonsManager
        canManage={profile.role === "admin"}
        lessons={list.rows}
        total={list.total}
        stats={stats}
        members={members.rows}
        instructors={instructors}
        centers={resources.centers}
        rooms={resources.rooms}
        query={q}
        status={status}
        page={page}
        loadError={list.error || resources.error}
      />
    </div>
  );
}
