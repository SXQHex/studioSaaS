import { requireRole } from "@/lib/supabase/access";
import { loadWorkspace } from "@/lib/data/workspace";
import { OperationsWorkspace } from "@/components/operations-workspace";
export const metadata = { title: "Grup programları | FTK Studio" };
export default async function Page() {
  const { supabase, profile } = await requireRole(["admin"]);
  const workspace = await loadWorkspace(supabase, "groups");
  return (
    <OperationsWorkspace
      module="groups"
      title="Grup programları"
      {...workspace}
      manager={profile.role === "admin"}
      instructor={profile.roles.includes("instructor")}
    />
  );
}
