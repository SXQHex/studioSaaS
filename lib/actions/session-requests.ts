"use server";

import { revalidateStudioViews } from "./revalidate";
import { z } from "zod";
import {
  sessionRequestSchema,
  reviewSessionRequestSchema,
  alternativeSessionRequestSchema,
  respondAlternativeSchema,
} from "@/lib/validation/session-request";
import { requireRole } from "@/lib/supabase/access";
import {
  type ActionResult,
  dbErrorMessage,
  fail,
  ok,
  parseInput,
} from "./result";

const uuid = z.string().uuid();
const label = z.string().trim().min(1).max(160);
const resourceSchema = z.object({ name: label });
const centerSchema = z.object({
  organization_id: uuid,
  name: label,
  address: z.string().trim().max(500).nullable(),
});
const roomSchema = z.object({
  center_id: uuid,
  name: z.string().trim().min(1).max(120),
  capacity: z.number().int().min(1).max(500),
});
const centerAdminSchema = z.object({ center_id: uuid, profile_id: uuid });

export async function createOrganization(
  input: unknown,
): Promise<ActionResult> {
  const { supabase, userId } = await requireRole(["admin"]);
  const parsed = parseInput(resourceSchema, input);
  if (parsed.failure) return parsed.failure;
  const slug = parsed.data.name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  if (!slug) return fail("Organizasyon adı geçerli bir kısa ad üretemiyor.");
  const { error } = await supabase
    .from("organizations")
    .insert({ name: parsed.data.name, slug, created_by: userId });
  if (error) return fail(dbErrorMessage(error, "Organizasyon oluşturulamadı."));
  revalidateStudioViews();
  return ok("Organizasyon oluşturuldu.");
}

export async function createCenter(input: unknown): Promise<ActionResult> {
  const { supabase } = await requireRole(["admin"]);
  const parsed = parseInput(centerSchema, input);
  if (parsed.failure) return parsed.failure;
  const { error } = await supabase.rpc("create_center", {
    p_organization_id: parsed.data.organization_id,
    p_name: parsed.data.name,
    p_address: parsed.data.address,
  });
  if (error) return fail(dbErrorMessage(error, "Merkez oluşturulamadı."));
  revalidateStudioViews();
  return ok("Merkez oluşturuldu.");
}

export async function grantCenterAdmin(input: unknown): Promise<ActionResult> {
  const { supabase } = await requireRole(["admin"]);
  const parsed = parseInput(centerAdminSchema, input);
  if (parsed.failure) return parsed.failure;
  const { error } = await supabase.rpc("grant_center_admin", {
    p_center_id: parsed.data.center_id,
    p_profile_id: parsed.data.profile_id,
  });
  if (error) return fail(dbErrorMessage(error, "Merkez yöneticisi atanamadı."));
  revalidateStudioViews();
  return ok("Merkez yöneticisi yetkilendirildi.");
}

export async function revokeCenterAdmin(input: unknown): Promise<ActionResult> {
  const { supabase } = await requireRole(["admin"]);
  const parsed = parseInput(centerAdminSchema, input);
  if (parsed.failure) return parsed.failure;
  const { error } = await supabase.rpc("revoke_center_admin", {
    p_center_id: parsed.data.center_id,
    p_profile_id: parsed.data.profile_id,
  });
  if (error)
    return fail(
      dbErrorMessage(error, "Merkez yöneticisi yetkisi kaldırılamadı."),
    );
  revalidateStudioViews();
  return ok("Merkez yöneticisi yetkisi kaldırıldı.");
}

export async function createRoom(input: unknown): Promise<ActionResult> {
  const { supabase } = await requireRole(["admin"]);
  const parsed = parseInput(roomSchema, input);
  if (parsed.failure) return parsed.failure;
  const { error } = await supabase.from("rooms").insert(parsed.data);
  if (error) return fail(dbErrorMessage(error, "Oda oluşturulamadı."));
  revalidateStudioViews();
  return ok("Oda oluşturuldu.");
}

export async function listRequestableMembers(
  centerId: string,
): Promise<
  | { ok: true; rows: { id: string; full_name: string }[] }
  | { ok: false; error: string }
> {
  const { supabase } = await requireRole(["instructor"]);
  const parsed = uuid.safeParse(centerId);
  if (!parsed.success) return { ok: false, error: "Merkez kimliği geçersiz." };
  const { data, error } = await supabase.rpc("list_requestable_members", {
    p_center_id: parsed.data,
  });
  if (error)
    return {
      ok: false,
      error: dbErrorMessage(error, "Bu merkez için üye listesi alınamadı."),
    };
  return { ok: true, rows: data ?? [] };
}

export async function createGroupProposal(
  input: unknown,
): Promise<ActionResult> {
  const { supabase } = await requireRole(["admin"]);
  const parsed = parseInput(sessionRequestSchema, input);
  if (parsed.failure) return parsed.failure;
  const instructor = parseInput(z.object({ instructor_id: uuid }), input);
  if (instructor.failure) return instructor.failure;
  if (
    parsed.data.session_type !== "group" ||
    parsed.data.private_member_id !== null
  ) {
    return fail("Yönetici yalnızca grup dersi taslağı oluşturabilir.");
  }
  const { data: requestId, error } = await supabase.rpc(
    "create_session_request",
    {
      p_center_id: parsed.data.center_id,
      p_room_id: parsed.data.room_id,
      p_session_type: "group",
      p_title: parsed.data.title,
      p_private_member_id: null,
      p_starts_at: parsed.data.starts_at,
      p_ends_at: parsed.data.ends_at,
      p_expected_attendees: parsed.data.expected_attendees,
      p_notes: parsed.data.notes,
      p_instructor_id: instructor.data.instructor_id,
    },
  );
  if (error || !requestId)
    return fail(dbErrorMessage(error, "Grup dersi taslağı oluşturulamadı."));
  revalidateStudioViews();
  return ok(
    "Grup dersi taslağı oluşturuldu; bildirimler e-posta kuyruğuna alındı.",
  );
}

export async function createSessionRequest(
  input: unknown,
): Promise<ActionResult> {
  const { supabase } = await requireRole(["instructor"]);
  const parsed = parseInput(sessionRequestSchema, input);
  if (parsed.failure) return parsed.failure;
  const { data, error } = await supabase.rpc("create_session_request", {
    p_center_id: parsed.data.center_id,
    p_room_id: parsed.data.room_id,
    p_session_type: parsed.data.session_type,
    p_title: parsed.data.title,
    p_private_member_id: parsed.data.private_member_id,
    p_starts_at: parsed.data.starts_at,
    p_ends_at: parsed.data.ends_at,
    p_expected_attendees: parsed.data.expected_attendees,
    p_notes: parsed.data.notes,
    p_instructor_id: null,
  });
  if (error || !data)
    return fail(dbErrorMessage(error, "Seans talebi oluşturulamadı."));
  revalidateStudioViews();
  return ok("Talep yöneticiye iletildi; bildirimler e-posta kuyruğuna alındı.");
}

export async function reviewSessionRequest(
  input: unknown,
): Promise<ActionResult> {
  const { supabase } = await requireRole(["admin"]);
  const parsed = parseInput(reviewSessionRequestSchema, input);
  if (parsed.failure) return parsed.failure;
  const { error } = await supabase.rpc("review_session_request", {
    p_request_id: parsed.data.id,
    p_approve: parsed.data.approve,
    p_review_note: parsed.data.note,
  });
  if (error)
    return fail(
      dbErrorMessage(
        error,
        "Talep değerlendirilemedi. Oda veya eğitmen çakışmasını kontrol edin.",
      ),
    );
  revalidateStudioViews();
  return ok(
    parsed.data.approve
      ? "Talep onaylandı ve seans rezerve edildi; bildirimler kuyruğa alındı."
      : "Talep reddedildi; bildirimler kuyruğa alındı.",
  );
}

export async function withdrawSessionRequest(
  input: unknown,
): Promise<ActionResult> {
  const { supabase } = await requireRole(["admin", "instructor"]);
  const parsed = parseInput(z.object({ id: uuid }), input);
  if (parsed.failure) return parsed.failure;
  const { error } = await supabase.rpc("withdraw_session_request", {
    p_request_id: parsed.data.id,
  });
  if (error) return fail(dbErrorMessage(error, "Talep geri çekilemedi."));
  revalidateStudioViews();
  return ok("Talebiniz geri çekildi. Oda rezervasyonu oluşturulmadı.");
}
export async function proposeSessionRequestAlternative(
  input: unknown,
): Promise<ActionResult> {
  const { supabase } = await requireRole(["admin"]);
  const parsed = parseInput(alternativeSessionRequestSchema, input);
  if (parsed.failure) return parsed.failure;
  const { error } = await supabase.rpc("propose_session_request_alternative", {
    p_request_id: parsed.data.id,
    p_starts_at: parsed.data.starts_at,
    p_ends_at: parsed.data.ends_at,
    p_note: parsed.data.note,
  });
  if (error) return fail(dbErrorMessage(error, "Alternatif saat önerilemedi."));
  revalidateStudioViews();
  return ok("Alternatif saat talep sahibine iletildi. Oda henüz ayrılmadı.");
}
export async function respondSessionRequestAlternative(
  input: unknown,
): Promise<ActionResult> {
  const { supabase } = await requireRole(["admin", "instructor"]);
  const parsed = parseInput(respondAlternativeSchema, input);
  if (parsed.failure) return parsed.failure;
  const { error } = await supabase.rpc("respond_session_request_alternative", {
    p_request_id: parsed.data.id,
    p_proposed_at: parsed.data.proposed_at,
    p_accept: parsed.data.accept,
  });
  if (error)
    return fail(dbErrorMessage(error, "Alternatif saate yanıt kaydedilemedi."));
  revalidateStudioViews();
  return ok(
    parsed.data.accept
      ? "Alternatif kabul edildi. Talep yönetici onayı bekliyor; oda henüz ayrılmadı."
      : "Alternatif saat kabul edilmedi. İlk talebiniz onay beklemeye devam ediyor.",
  );
}
