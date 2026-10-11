import { requireRole } from "@/lib/supabase/access";
import { listSchedulingResources, listSessionRequests } from "@/lib/data/session-requests";
import { SessionRequestsManager } from "./session-requests-manager";

export const metadata = { title: "Seans Talepleri | FTK Studio" };

export default async function SessionRequestsPage() {
  const { supabase, profile } = await requireRole(["admin", "instructor"]);
  const isAdmin = profile.role === "admin";
  const [resources, requestList] = await Promise.all([
    listSchedulingResources(supabase),
    listSessionRequests(supabase),
  ]);
  return (
    <SessionRequestsManager
      isAdmin={isAdmin}
      organizations={resources.organizations}
      centers={resources.centers}
      rooms={resources.rooms}
      admins={resources.admins}
      instructors={resources.instructors}
      requests={requestList.rows}
      loadError={resources.error || requestList.error}
    />
  );
}
