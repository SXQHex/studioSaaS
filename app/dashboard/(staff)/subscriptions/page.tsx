import { listMemberOptions } from "@/lib/data/members";
import { parsePage, pickOption, sanitizeSearchTerm, type SearchParams } from "@/lib/data/pagination";
import { SUBSCRIPTION_STATUSES, listSubscriptions, subscriptionStats } from "@/lib/data/subscriptions";
import { requireRole } from "@/lib/supabase/access";
import { SubscriptionsManager } from "./subscriptions-manager";

export const metadata = { title: "Abonelikler | FTK Studio" };

export default async function SubscriptionsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const { supabase } = await requireRole(["admin"]);
  const params = await searchParams;
  const q = sanitizeSearchTerm(params.q);
  const status = pickOption(params.status, SUBSCRIPTION_STATUSES);
  const page = parsePage(params.page);

  const [list, stats, members] = await Promise.all([
    listSubscriptions(supabase, { q, status, page }),
    subscriptionStats(supabase),
    listMemberOptions(supabase),
  ]);

  return (
    <div className="dashboard-content">
      <SubscriptionsManager
        subscriptions={list.rows}
        total={list.total}
        stats={stats}
        members={members.rows}
        query={q}
        status={status}
        page={page}
        loadError={list.error || members.error}
      />
    </div>
  );
}
