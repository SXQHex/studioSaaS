import { databaseId } from "@/lib/validation/database-id";
import { z } from "zod";
import { type BackendContext, requireBackendRole } from "../context";
import { type ActionResult, fail, ok, parseInput } from "../result";

export async function markNotificationRead(
  context: BackendContext,
  input: unknown,
): Promise<ActionResult> {
  const { supabase, userId } = await requireBackendRole(context, [
    "admin",
    "instructor",
    "student",
  ]);
  const parsed = parseInput(z.object({ id: databaseId() }), input);
  if (parsed.failure) return parsed.failure;
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", parsed.data.id)
    .eq("recipient_id", userId);
  if (error) return fail("Bildirim okunmuş olarak işaretlenemedi.");

  return ok("Bildirim okundu.");
}
