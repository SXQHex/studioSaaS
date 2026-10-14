import { requireRole } from "@/lib/supabase/access";
import { loadWorkspace } from "@/lib/data/workspace";
import { RoadmapWorkspace } from "@/components/roadmap-workspace";
export const metadata = { title: "E-posta teslimleri | FTK Studio" };
export default async function Page() {
  const { supabase } = await requireRole(["admin"]);
  const workspace = await loadWorkspace(supabase, "communication");
  return (
    <RoadmapWorkspace
      module="communication"
      title="E-posta teslimleri"
      {...workspace}
      canWrite={true}
    />
  );
}
