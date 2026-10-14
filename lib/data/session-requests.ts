import type { ServerSupabase } from "@/lib/supabase/server";
import type { Tables } from "@/lib/supabase/database.types";

export type OrganizationOption = Pick<
  Tables<"organizations">,
  "id" | "name" | "slug"
>;
export type CenterOption = Pick<
  Tables<"centers">,
  "id" | "organization_id" | "name" | "address"
>;
export type RoomOption = Pick<
  Tables<"rooms">,
  "id" | "center_id" | "name" | "capacity"
>;
export type CenterAdminOption = Pick<Tables<"profiles">, "id" | "full_name">;
export type InstructorOption = Pick<Tables<"profiles">, "id" | "full_name">;
export type SessionRequestRow = Pick<
  Tables<"session_requests">,
  | "id"
  | "organization_id"
  | "center_id"
  | "room_id"
  | "instructor_id"
  | "session_type"
  | "title"
  | "private_member_id"
  | "starts_at"
  | "ends_at"
  | "expected_attendees"
  | "notes"
  | "status"
  | "created_at"
  | "review_note"
  | "requested_by"
  | "approved_lesson_id"
  | "alternative_starts_at"
  | "alternative_ends_at"
  | "alternative_note"
  | "alternative_proposed_at"
> & {
  center_name: string;
  room_name: string | null;
  instructor_name: string;
  member_name: string | null;
  events: Tables<"session_request_events">[];
  planned_groups: { title: string; starts_at: string; ends_at: string }[];
};

export async function listSchedulingResources(supabase: ServerSupabase) {
  const [organizations, centers, rooms, members, instructors, admins] =
    await Promise.all([
      supabase
        .from("organizations")
        .select("id, name, slug")
        .eq("is_active", true)
        .order("name"),
      supabase
        .from("centers")
        .select("id, organization_id, name, address")
        .eq("is_active", true)
        .order("name"),
      supabase
        .from("rooms")
        .select("id, center_id, name, capacity")
        .eq("is_active", true)
        .order("name"),
      supabase
        .from("members")
        .select("id, full_name")
        .eq("is_active", true)
        .order("full_name")
        .limit(1000),
      supabase
        .from("center_role_assignments")
        .select("profile_id")
        .eq("role", "instructor"),
      supabase
        .from("center_role_assignments")
        .select("profile_id")
        .eq("role", "admin"),
    ]);
  const instructorIds = [
    ...new Set((instructors.data ?? []).map((r) => r.profile_id)),
  ];
  const adminIds = [...new Set((admins.data ?? []).map((r) => r.profile_id))];
  const [instructorProfiles, adminProfiles] = await Promise.all([
    instructorIds.length
      ? supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", instructorIds)
          .order("full_name")
      : Promise.resolve({ data: [] as InstructorOption[], error: null }),
    adminIds.length
      ? supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", adminIds)
          .order("full_name")
      : Promise.resolve({ data: [] as CenterAdminOption[], error: null }),
  ]);
  return {
    organizations: (organizations.data ?? []) as OrganizationOption[],
    centers: (centers.data ?? []) as CenterOption[],
    rooms: (rooms.data ?? []) as RoomOption[],
    members: members.data ?? [],
    instructors: instructorProfiles.data ?? [],
    admins: adminProfiles.data ?? [],
    error: Boolean(
      organizations.error ||
        centers.error ||
        rooms.error ||
        members.error ||
        instructors.error ||
        admins.error ||
        instructorProfiles.error ||
        adminProfiles.error,
    ),
  };
}

export async function listSessionRequests(supabase: ServerSupabase) {
  const query = supabase
    .from("session_requests")
    .select(
      "id, organization_id, center_id, room_id, instructor_id, session_type, title, private_member_id, starts_at, ends_at, expected_attendees, notes, status, created_at, review_note, requested_by, approved_lesson_id, alternative_starts_at, alternative_ends_at, alternative_note, alternative_proposed_at",
    )
    .order("created_at", { ascending: false })
    .limit(200);
  const { data, error } = await query;
  const requests = data ?? [];
  const planned = requests.length
    ? await supabase.rpc("planned_group_usage", {
        p_request_ids: requests.map((r) => r.id),
      })
    : { data: [], error: null };
  const events = requests.length
    ? await supabase
        .from("session_request_events")
        .select("*")
        .in(
          "request_id",
          requests.map((r) => r.id),
        )
        .order("created_at", { ascending: false })
        .limit(1000)
    : { data: [], error: null };
  const centerIds = [...new Set(requests.map((r) => r.center_id))];
  const roomIds = [
    ...new Set(
      requests.map((r) => r.room_id).filter((id): id is string => Boolean(id)),
    ),
  ];
  const instructorIds = [...new Set(requests.map((r) => r.instructor_id))];
  const memberIds = [
    ...new Set(
      requests
        .map((r) => r.private_member_id)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const [centers, rooms, instructors, members] = await Promise.all([
    centerIds.length
      ? supabase.from("centers").select("id, name").in("id", centerIds)
      : Promise.resolve({ data: [] }),
    roomIds.length
      ? supabase.from("rooms").select("id, name").in("id", roomIds)
      : Promise.resolve({ data: [] }),
    instructorIds.length
      ? supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", instructorIds)
      : Promise.resolve({ data: [] }),
    memberIds.length
      ? supabase.from("members").select("id, full_name").in("id", memberIds)
      : Promise.resolve({ data: [] }),
  ]);
  const byId = <T extends { id: string; name?: string; full_name?: string }>(
    rows: T[] | null,
  ) => new Map((rows ?? []).map((row) => [row.id, row] as const));
  const centerMap = byId(centers.data as { id: string; name: string }[] | null);
  const roomMap = byId(rooms.data as { id: string; name: string }[] | null);
  const instructorMap = byId(
    instructors.data as { id: string; full_name: string }[] | null,
  );
  const memberMap = byId(
    members.data as { id: string; full_name: string }[] | null,
  );
  return {
    rows: requests.map((r) => ({
      ...r,
      planned_groups: (planned.data ?? []).filter(
        (group) => group.request_id === r.id,
      ),
      events: (events.data ?? []).filter((event) => event.request_id === r.id),
      center_name: centerMap.get(r.center_id)?.name ?? "Merkez",
      room_name: r.room_id ? (roomMap.get(r.room_id)?.name ?? null) : null,
      instructor_name:
        instructorMap.get(r.instructor_id)?.full_name ?? "Eğitmen",
      member_name: r.private_member_id
        ? (memberMap.get(r.private_member_id)?.full_name ?? null)
        : null,
    })) as SessionRequestRow[],
    error: Boolean(error || events.error || planned.error),
  };
}
