import { requireRole } from "@/lib/supabase/access";
import { loadWorkspace } from "@/lib/data/workspace";
import { RoadmapWorkspace } from "@/components/roadmap-workspace";
export const metadata = { title: "Paket kataloğu | FTK Studio" };
export default async function Page() {
  const { supabase } = await requireRole(["admin"]);
  const workspace = await loadWorkspace(supabase, "catalog");
  return (
    <RoadmapWorkspace
      module="catalog"
      title="Paket kataloğu"
      {...workspace}
      canWrite={true}
    />
  );
}
