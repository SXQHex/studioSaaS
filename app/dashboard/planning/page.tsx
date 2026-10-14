import { requireRole } from "@/lib/supabase/access";
import { workspaceDateRange, decodePlanning } from "@/lib/data/workspace";
import { studioDateKey } from "@/lib/studio-date";
import type { SearchParams } from "@/lib/data/pagination";
import { PlanningWorkspace } from "@/components/planning-workspace";
export const metadata = { title: "Birleşik planlama | FTK Studio" };
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { supabase } = await requireRole(["admin"]);
  const params = await searchParams;
  const start = typeof params.from === "string" ? params.from : studioDateKey();
  const parsed = workspaceDateRange({ from: start, to: start });
  if (!parsed.success) return <p role="alert">Geçerli tarih seçin.</p>;
  const day = new Date(parsed.data.from + "T12:00:00Z");
  day.setUTCDate(day.getUTCDate() - ((day.getUTCDay() + 6) % 7));
  const from = day.toISOString().slice(0, 10);
  day.setUTCDate(day.getUTCDate() + 6);
  const { data, error } = await supabase.rpc("planning_workspace", {
    p_from: from,
    p_to: day.toISOString().slice(0, 10),
  });
  return <PlanningWorkspace {...decodePlanning(data, error)} from={from} />;
}
