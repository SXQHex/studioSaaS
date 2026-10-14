import type { Json } from "@/lib/supabase/database.types";
import { type RoadmapModule, roadmapSchemas } from "@/lib/validation/roadmap";
import { type BackendContext, requireBackendRole } from "../context";
import { databaseFailure, fail, ok, parseInput } from "../result";
export async function roadmapCommand(
  context: BackendContext,
  module: string,
  input: unknown,
) {
  const schema = Object.hasOwn(roadmapSchemas, module)
    ? roadmapSchemas[module as RoadmapModule]
    : null;
  if (!schema) return fail("Modül geçersiz.");
  const { supabase } = await requireBackendRole(
    context,
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
  const { data, error } = await supabase.rpc("roadmap_command", {
    p_module: module,
    p_data: payload as Json,
  });
  if (error) return databaseFailure(error, "İşlem tamamlanamadı.");

  return ok("Kaydedildi.", data);
}
export async function processEmailQueue(context: BackendContext) {
  const { supabase } = await requireBackendRole(context, ["admin"]);
  const { data, error } = await supabase.functions.invoke(
    "process-studio-email",
    { body: {} },
  );

  return error || !data?.ok
    ? fail("E-posta işlemi tamamlanamadı. Gönderim durumlarını kontrol edin.")
    : ok("Kuyruk işlendi; teslim durumları güncellendi.");
}
