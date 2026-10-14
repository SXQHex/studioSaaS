import { requireRole } from "@/lib/supabase/access";
import { loadWorkspace } from "@/lib/data/workspace";
import { RoadmapWorkspace } from "@/components/roadmap-workspace";
export const metadata = { title: "Öğrenci gelişimi | FTK Studio" };
export default async function Page() {
  const { supabase, profile } = await requireRole(["student"]);
  const workspace = await loadWorkspace(supabase, "progress");
  return (
    <RoadmapWorkspace
      module="progress"
      title="Öğrenci gelişimi"
      {...workspace}
      canWrite={
        profile.role === "admin" || profile.roles.includes("instructor")
      }
    />
  );
}
