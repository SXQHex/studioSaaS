import { requireRole } from "@/lib/supabase/access";
import { loadWorkspace } from "@/lib/data/workspace";
import { OperationsWorkspace } from "@/components/operations-workspace";
export const metadata = { title: "Pazarlama CRM | FTK Studio" };
export default async function Page() {
  const { supabase, profile } = await requireRole(["admin"]);
  const workspace = await loadWorkspace(supabase, "crm");
  return (
    <OperationsWorkspace
      module="crm"
      title="Pazarlama CRM"
      {...workspace}
      manager={profile.role === "admin"}
      instructor={profile.roles.includes("instructor")}
    />
  );
}
