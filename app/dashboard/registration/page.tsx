import { requireRole } from "@/lib/supabase/access";
import { loadWorkspace, decodeWorkspace } from "@/lib/data/workspace";
import { RoadmapWorkspace } from "@/components/roadmap-workspace";
import { RegistrationSelf } from "@/components/registration-self";
export const metadata = { title: "Dijital kayıt | FTK Studio" };
export default async function Page() {
  const { supabase, profile, userId } = await requireRole(["student"]);
  const [workspace, own] = await Promise.all([
    loadWorkspace(supabase, "registration"),
    supabase.rpc("registration_self_workspace"),
  ]);
  const self = decodeWorkspace(own.data, own.error);
  return (
    <>
      <RoadmapWorkspace
        module="registration"
        title="Dijital kayıt"
        {...workspace}
        canWrite={profile.role === "admin"}
      />
      <div className="dashboard-content">
        {self.loadError ? (
          <p role="alert">Kayıt bilgileriniz yüklenemedi.</p>
        ) : (
          <RegistrationSelf data={self.data} userId={userId} />
        )}
      </div>
    </>
  );
}
