import { createClient } from "@/lib/supabase/client";
import type { ActionResult } from "@/lib/actions/result";
/** Shared by the student's document list and the manager's registration table. */
export async function openRegistrationDocument(
  path: string,
): Promise<ActionResult> {
  const { data, error } = await createClient()
    .storage.from("registration-documents")
    .createSignedUrl(path, 60);
  if (error || !data) return { ok: false, error: "Belge açılamadı." };
  window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  return { ok: true, message: "Belge açıldı." };
}
