import { requireRole } from "@/lib/supabase/access";
import { managedCenters } from "@/lib/supabase/managed-centers";
import { RolesManager } from "./roles-manager";

export const metadata = { title: "Merkez Rolleri | FTK Studio" };

export default async function RolesPage() {
  const { supabase, profile } = await requireRole(["admin"]);
  const centersResponse = await supabase
    .from("centers")
    .select("id, name, organization_id")
    .order("name");
  const centers = managedCenters(
    centersResponse.data ?? [],
    profile.assignments,
  );
  const ids = centers.map((c) => c.id);

  const assignmentsResponse = ids.length
    ? await supabase
        .from("center_role_assignments")
        .select("center_id, profile_id, role")
        .in("center_id", ids)
    : { data: [], error: null };
  const rows = assignmentsResponse.data ?? [];
  const profileIds = [...new Set(rows.map((row) => row.profile_id))];
  const profilesResponse = profileIds.length
    ? await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", profileIds)
    : { data: [], error: null };
  const names = new Map(
    (profilesResponse.data ?? []).map((row) => [row.id, row.full_name]),
  );

  return (
    <div className="dashboard-content">
      <RolesManager
        centers={centers}
        roles={rows.map((row) => ({
          ...row,
          profile_name: names.get(row.profile_id) || "Kullanıcı",
        }))}
        loadError={Boolean(
          centersResponse.error ||
            assignmentsResponse.error ||
            profilesResponse.error,
        )}
      />
    </div>
  );
}
