import { requireRole } from "@/lib/supabase/access";
import { loadWorkspace } from "@/lib/data/workspace";
import { RoadmapWorkspace } from "@/components/roadmap-workspace";
export const metadata = { title: "CRM otomasyonu | FTK Studio" };
export default async function Page() {
  const { supabase } = await requireRole(["admin"]);
  const workspace = await loadWorkspace(supabase, "crm-automation");
  return (
    <RoadmapWorkspace
      module="crm-automation"
      title="CRM otomasyonu"
      {...workspace}
      canWrite={true}
    />
  );
}
