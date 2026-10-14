import { listMembers, memberStats } from "@/lib/data/members";
import {
  parsePage,
  sanitizeSearchTerm,
  type SearchParams,
} from "@/lib/data/pagination";
import { requireRole } from "@/lib/supabase/access";
import { managedCenters } from "@/lib/supabase/managed-centers";
import { listSchedulingResources } from "@/lib/data/session-requests";
import { MembersManager } from "./members-manager";

export const metadata = { title: "Üyeler | FTK Studio" };

export default async function MembersPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { supabase, profile } = await requireRole(["admin"]);
  const params = await searchParams;
  const q = sanitizeSearchTerm(params.q);
  const page = parsePage(params.page);

  const resources = await listSchedulingResources(supabase);
  const centers = managedCenters(resources.centers, profile.assignments);
  const centerIds = centers.map((c) => c.id);
  const [list, stats] = await Promise.all([
    listMembers(supabase, { q, page, centerIds }),
    memberStats(supabase, centerIds),
  ]);

  return (
    <div className="dashboard-content">
      <MembersManager
        members={list.rows}
        centers={centers}
        total={list.total}
        stats={stats}
        query={q}
        page={page}
        loadError={list.error || stats.error || resources.error}
      />
    </div>
  );
}
