"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/supabase/access";
import { attendanceSchema } from "@/lib/validation/schemas";
import { type ActionResult, dbErrorMessage, fail, ok, parseInput } from "./result";

export async function recordAttendance(input: unknown): Promise<ActionResult> {
  const { supabase, userId } = await requireRole(["admin", "instructor"]);
  const { data, failure } = parseInput(attendanceSchema, input);
  if (failure) return failure;

  const { data: lesson, error: lessonError } = await supabase
    .from("lessons")
    .select("type, status, private_member_id")
    .eq("id", data.lesson_id)
    .maybeSingle();
  if (lessonError || !lesson) return fail("Ders bulunamadı.");

  if (lesson.status === "cancelled" || lesson.status === "postponed") {
    return fail("İptal veya ertelenmiş bir ders için yoklama kaydı eklenemez.");
  }
  if (lesson.type === "private") {
    if (!lesson.private_member_id) {
      return fail("Özel derse henüz üye atanmamış. Önce ders kaydını düzenleyin.");
    }
    if (lesson.private_member_id !== data.member_id) {
      return fail("Özel ders yoklaması yalnızca derse atanan üye için kaydedilebilir.");
    }
  }

  const { error } = await supabase.from("attendance").insert({
    lesson_id: data.lesson_id,
    member_id: data.member_id,
    attended: data.attended,
    notes: data.notes,
    checked_in_by: userId,
  });
  if (error) {
    return fail(dbErrorMessage(error, "Yoklama kaydedilemedi."));
  }

  revalidatePath("/dashboard/attendance");
  revalidatePath("/dashboard/lessons");
  revalidatePath("/dashboard/subscriptions");
  revalidatePath("/dashboard/credits");
  return ok("Yoklama kaydedildi. Grup dersinde kredi tüketimini veritabanı kuralları yönetir.");
}
