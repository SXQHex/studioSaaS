import { listMembers, memberStats } from "@/lib/data/members";
import { parsePage, sanitizeSearchTerm, type SearchParams } from "@/lib/data/pagination";
import { requireRole } from "@/lib/supabase/access";
import { listSchedulingResources } from "@/lib/data/session-requests";
import { MembersManager } from "./members-manager";

export const metadata = { title: "Üyeler | FTK Studio" };

export default async function MembersPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const { supabase } = await requireRole(["admin"]);
  const params = await searchParams;
  const q = sanitizeSearchTerm(params.q);
  const page = parsePage(params.page);

  const [list, stats, resources] = await Promise.all([listMembers(supabase, { q, page }), memberStats(supabase), listSchedulingResources(supabase)]);

  return (
    <div className="dashboard-content">
      <MembersManager
        members={list.rows}
        centers={resources.centers}
        total={list.total}
        stats={stats}
        query={q}
        page={page}
        loadError={list.error || stats.error || resources.error}
      />
    </div>
  );
}
