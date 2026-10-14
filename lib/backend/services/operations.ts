import type { Json } from "@/lib/supabase/database.types";
import {
  crmOperation,
  groupsOperation,
  lessonOperation,
  paymentsOperation,
} from "@/lib/validation/operations";
import { type BackendContext, requireBackendRole } from "../context";
import { databaseFailure, fail, ok, parseInput } from "../result";

export async function runOperation(
  context: BackendContext,
  module: string,
  input: unknown,
) {
  const schema =
    module === "groups"
      ? groupsOperation
      : module === "payments"
        ? paymentsOperation
        : module === "lesson-operations"
          ? lessonOperation
          : module === "crm"
            ? crmOperation
            : null;
  if (!schema) return fail("Modül geçersiz.");
  const { supabase } = await requireBackendRole(
    context,
    module === "lesson-operations" ? ["student"] : ["admin"],
  );
  const parsed = parseInput(schema, input);
  if (parsed.failure) return parsed.failure;
  const name =
    module === "groups"
      ? ["waitlist", "dequeue", "promote"].includes(parsed.data.action)
        ? "waitlist_command"
        : "groups_command"
      : module === "payments"
        ? "payments_command"
        : module === "lesson-operations"
          ? "lesson_command"
          : "crm_command";
  const { data, error } = await supabase.rpc(name, {
    p_data: parsed.data as Json,
  });
  if (error)
    return databaseFailure(
      error,
      "İşlem tamamlanamadı. Bilgileri ve oda/eğitmen çakışmalarını kontrol edin.",
    );

  return ok("İşlem kaydedildi.", data);
}
