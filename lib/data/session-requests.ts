import type { ServerSupabase } from "@/lib/supabase/server";
import type { Tables } from "@/lib/supabase/database.types";

export type OrganizationOption = Pick<Tables<"organizations">, "id" | "name" | "slug">;
export type CenterOption = Pick<Tables<"centers">, "id" | "organization_id" | "name" | "address">;
export type RoomOption = Pick<Tables<"rooms">, "id" | "center_id" | "name" | "capacity">;
export type CenterAdminOption = Pick<Tables<"profiles">, "id" | "full_name">;
export type InstructorOption = Pick<Tables<"profiles">, "id" | "full_name">;
export type SessionRequestRow = Pick<
  Tables<"session_requests">,
  "id" | "organization_id" | "center_id" | "room_id" | "instructor_id" | "session_type" | "title" |
  "private_member_id" | "starts_at" | "ends_at" | "expected_attendees" | "notes" | "status" | "created_at" | "review_note"
> & { center_name: string; room_name: string | null; instructor_name: string; member_name: string | null };

export async function listSchedulingResources(supabase: ServerSupabase) {
  const [organizations, centers, rooms, members, instructors, admins] = await Promise.all([
    supabase.from("organizations").select("id, name, slug").eq("is_active", true).order("name"),
    supabase.from("centers").select("id, organization_id, name, address").eq("is_active", true).order("name"),
    supabase.from("rooms").select("id, center_id, name, capacity").eq("is_active", true).order("name"),
    supabase.from("members").select("id, full_name").eq("is_active", true).order("full_name").limit(1000),
    supabase.from("profiles").select("id, full_name").eq("role", "instructor").order("full_name"),
    supabase.from("profiles").select("id, full_name").eq("role", "admin").order("full_name"),
  ]);
  return {
    organizations: (organizations.data ?? []) as OrganizationOption[],
    centers: (centers.data ?? []) as CenterOption[],
    rooms: (rooms.data ?? []) as RoomOption[],
    members: members.data ?? [],
    instructors: instructors.data ?? [],
    admins: admins.data ?? [],
    error: Boolean(organizations.error || centers.error || rooms.error || members.error || instructors.error || admins.error),
  };
}

export async function listSessionRequests(supabase: ServerSupabase) {
  const query = supabase.from("session_requests")
    .select("id, organization_id, center_id, room_id, instructor_id, session_type, title, private_member_id, starts_at, ends_at, expected_attendees, notes, status, created_at, review_note")
    .order("created_at", { ascending: false }).limit(200);
  const { data, error } = await query;
  const requests = data ?? [];
  const centerIds = [...new Set(requests.map((r) => r.center_id))];
  const roomIds = [...new Set(requests.map((r) => r.room_id).filter((id): id is string => Boolean(id)))];
  const instructorIds = [...new Set(requests.map((r) => r.instructor_id))];
  const memberIds = [...new Set(requests.map((r) => r.private_member_id).filter((id): id is string => Boolean(id)))];
  const [centers, rooms, instructors, members] = await Promise.all([
    centerIds.length ? supabase.from("centers").select("id, name").in("id", centerIds) : Promise.resolve({ data: [] }),
    roomIds.length ? supabase.from("rooms").select("id, name").in("id", roomIds) : Promise.resolve({ data: [] }),
    instructorIds.length ? supabase.from("profiles").select("id, full_name").in("id", instructorIds) : Promise.resolve({ data: [] }),
    memberIds.length ? supabase.from("members").select("id, full_name").in("id", memberIds) : Promise.resolve({ data: [] }),
  ]);
  const byId = <T extends { id: string; name?: string; full_name?: string }>(rows: T[] | null) => new Map((rows ?? []).map((row) => [row.id, row] as const));
  const centerMap = byId(centers.data as {id:string;name:string}[] | null);
  const roomMap = byId(rooms.data as {id:string;name:string}[] | null);
  const instructorMap = byId(instructors.data as {id:string;full_name:string}[] | null);
  const memberMap = byId(members.data as {id:string;full_name:string}[] | null);
  return {
    rows: requests.map((r) => ({
      ...r,
      center_name: centerMap.get(r.center_id)?.name ?? "Merkez",
      room_name: r.room_id ? roomMap.get(r.room_id)?.name ?? null : null,
      instructor_name: instructorMap.get(r.instructor_id)?.full_name ?? "Eğitmen",
      member_name: r.private_member_id ? memberMap.get(r.private_member_id)?.full_name ?? null : null,
    })) as SessionRequestRow[],
    error: Boolean(error),
  };
}
