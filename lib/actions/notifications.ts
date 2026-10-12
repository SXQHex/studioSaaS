"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/supabase/access";
import { type ActionResult, fail, ok, parseInput } from "./result";

export async function markNotificationRead(input: unknown): Promise<ActionResult> {
  const { supabase, userId } = await requireRole(["admin", "instructor", "student"]);
  const parsed = parseInput(z.object({ id: z.string().uuid() }), input);
  if (parsed.failure) return parsed.failure;
  const { error } = await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", parsed.data.id).eq("recipient_id", userId);
  if (error) return fail("Bildirim okunmuş olarak işaretlenemedi.");
  revalidatePath("/dashboard/notifications");
  return ok("Bildirim okundu.");
}
