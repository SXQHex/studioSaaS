import { requireRole } from "@/lib/supabase/access";
import { workspaceDateRange, decodeInsights } from "@/lib/data/workspace";
import { InsightsWorkspace } from "@/components/insights-workspace";
export const metadata = { title: "Müdahale analizi | FTK Studio" };
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { supabase } = await requireRole(["admin"]);
  const params = await searchParams;
  const range = workspaceDateRange(params, 30);
  if (!range.success) return <p role="alert">Tarih aralığı geçersiz.</p>;
  const { from, to } = range.data;
  const { data, error } = await supabase.rpc("roadmap_workspace", {
    p_module: "insights",
    p_from: from,
    p_to: to,
  });
  return (
    <InsightsWorkspace {...decodeInsights(data, error)} from={from} to={to} />
  );
}
