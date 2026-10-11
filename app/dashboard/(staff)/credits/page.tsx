import { listTransactions } from "@/lib/data/credits";
import { parsePage, sanitizeSearchTerm, type SearchParams } from "@/lib/data/pagination";
import { listActiveSubscriptions } from "@/lib/data/subscriptions";
import { requireRole } from "@/lib/supabase/access";
import { CreditsManager } from "./credits-manager";

export const metadata = { title: "Kredi Hareketleri | FTK Studio" };

export default async function CreditsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const { supabase } = await requireRole(["admin"]);
  const params = await searchParams;
  const q = sanitizeSearchTerm(params.q);
  const page = parsePage(params.page);

  const [list, subscriptions] = await Promise.all([
    listTransactions(supabase, { q, page }),
    listActiveSubscriptions(supabase),
  ]);

  return (
    <div className="dashboard-content">
      <CreditsManager
        transactions={list.rows}
        total={list.total}
        subscriptions={subscriptions.rows}
        query={q}
        page={page}
        loadError={list.error || subscriptions.error}
      />
    </div>
  );
}
