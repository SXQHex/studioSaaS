"use server";
import { revalidateStudioViews } from "./revalidate";
import { requireRole } from "@/lib/supabase/access";
import { roadmapSchemas, type RoadmapModule } from "@/lib/validation/roadmap";
import type { Json } from "@/lib/supabase/database.types";
import { fail, ok, dbErrorMessage, parseInput } from "./result";
export async function roadmapCommand(module: string, input: unknown) {
  const schema = Object.hasOwn(roadmapSchemas, module)
    ? roadmapSchemas[module as RoadmapModule]
    : null;
  if (!schema) return fail("Modül geçersiz.");
  const { supabase } = await requireRole(
    module === "registration" || module === "progress"
      ? ["student", "instructor", "admin"]
      : ["admin"],
  );
  const parsed = parseInput(schema, input);
  if (parsed.failure) return parsed.failure;
  const payload = Object.fromEntries(
    Object.entries(parsed.data).map(([k, v]) => [
      k,
      v === "" && ["center_id", "organization_id"].includes(k) ? null : v,
    ]),
  );
  const { error } = await supabase.rpc("roadmap_command", {
    p_module: module,
    p_data: payload as Json,
  });
  if (error) return fail(dbErrorMessage(error, "İşlem tamamlanamadı."));
  revalidateStudioViews();
  return ok("Kaydedildi.");
}
export async function processEmailQueue() {
  const { supabase } = await requireRole(["admin"]);
  const { data, error } = await supabase.functions.invoke(
    "process-studio-email",
    { body: {} },
  );
  revalidateStudioViews();
  return error || !data?.ok
    ? fail("E-posta işlemi tamamlanamadı. Gönderim durumlarını kontrol edin.")
    : ok("Kuyruk işlendi; teslim durumları güncellendi.");
}
