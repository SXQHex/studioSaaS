import { requireRole } from "@/lib/supabase/access";
import { loadWorkspace } from "@/lib/data/workspace";
import { OperationsWorkspace } from "@/components/operations-workspace";
export const metadata = { title: "İptal, erteleme ve telafi | FTK Studio" };
export default async function Page() {
  const { supabase, profile } = await requireRole(["student"]);
  const workspace = await loadWorkspace(supabase, "lesson-operations");
  return (
    <OperationsWorkspace
      module="lesson-operations"
      title="İptal, erteleme ve telafi"
      {...workspace}
      manager={profile.role === "admin"}
      instructor={profile.roles.includes("instructor")}
    />
  );
}
