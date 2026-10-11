"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/supabase/access";
import { lessonSchema, lessonStatusSchema } from "@/lib/validation/schemas";
import { type ActionResult, dbErrorMessage, fail, ok, parseInput } from "./result";

const statusLabels = {
  scheduled: "Planlandı",
  completed: "Tamamlandı",
  cancelled: "İptal",
  postponed: "Ertelendi",
} as const;

function revalidateLessonViews() {
  revalidatePath("/dashboard/lessons");
  revalidatePath("/dashboard/attendance");
  revalidatePath("/dashboard/subscriptions");
  revalidatePath("/dashboard/credits");
}

export async function saveLesson(id: string | null, input: unknown): Promise<ActionResult> {
  const { supabase, userId } = await requireRole(["admin"]);
  const { data, failure } = parseInput(lessonSchema, input);
  if (failure) return failure;
  if (!id && data.type === "private") {
    return fail("Özel dersler eğitmen talebi üzerinden oluşturulmalı ve yönetici tarafından onaylanmalı.");
  }
  if (id && data.type === "private") {
    const { data: current } = await supabase.from("lessons").select("type").eq("id", id).maybeSingle();
    if (!current || current.type !== "private") {
      return fail("Özel ders oluşturmak için eğitmen talebi ve yönetici onayı kullanılmalı.");
    }
  }
  const { data: room, error: roomError } = await supabase.from("rooms")
    .select("id, center_id, capacity, is_active").eq("id", data.room_id).maybeSingle();
  if (roomError || !room || !room.is_active || room.center_id !== data.center_id) {
    return fail("Seçilen oda belirtilen merkeze ait değil veya kullanılamıyor.");
  }
  if (data.expected_attendees > room.capacity) return fail(`Katılımcı sayısı seçilen odanın kapasitesini (${room.capacity}) aşıyor.`);
  if (data.type === "private" && data.private_member_id) {
    const { data: member, error: memberError } = await supabase.from("members")
      .select("id").eq("id", data.private_member_id).eq("center_id", data.center_id).eq("is_active", true).maybeSingle();
    if (memberError || !member) return fail("Özel ders üyesi seçilen merkeze ait değil veya aktif değil.");
  }

  const result = id
    ? await supabase.from("lessons").update(data).eq("id", id)
    : await supabase.from("lessons").insert({ ...data, status: "scheduled", created_by: userId });
  if (result.error) return fail(dbErrorMessage(result.error, "Ders kaydedilemedi."));

  revalidateLessonViews();
  return ok(id ? "Ders bilgileri güncellendi." : "Ders planlandı.");
}

export async function changeLessonStatus(input: unknown): Promise<ActionResult> {
  const { supabase } = await requireRole(["admin"]);
  const { data, failure } = parseInput(lessonStatusSchema, input);
  if (failure) return failure;

  const { data: current, error: readError } = await supabase
    .from("lessons")
    .select("status")
    .eq("id", data.id)
    .maybeSingle();
  if (readError || !current) return fail("Ders bulunamadı.");
  if (current.status === data.status) return ok(`Ders zaten “${statusLabels[data.status]}” durumunda.`);
  if (current.status === "completed") {
    return fail("Tamamlanan dersin durumu değiştirilemez; krediler işlenmiş olabilir.");
  }

  const { error } = await supabase.from("lessons").update({ status: data.status }).eq("id", data.id);
  if (error) return fail(dbErrorMessage(error, "Ders durumu değiştirilemedi."));

  revalidateLessonViews();
  return ok(`Ders durumu “${statusLabels[data.status]}” olarak güncellendi.`);
}
