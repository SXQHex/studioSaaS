import { requireRole } from "@/lib/supabase/access";
import { loadWorkspace } from "@/lib/data/workspace";
import { OperationsWorkspace } from "@/components/operations-workspace";
export const metadata = { title: "Manuel tahsilatlar | FTK Studio" };
export default async function Page() {
  const { supabase, profile } = await requireRole(["admin"]);
  const workspace = await loadWorkspace(supabase, "payments");
  return (
    <OperationsWorkspace
      module="payments"
      title="Manuel tahsilatlar"
      {...workspace}
      manager={profile.role === "admin"}
      instructor={profile.roles.includes("instructor")}
    />
  );
}
