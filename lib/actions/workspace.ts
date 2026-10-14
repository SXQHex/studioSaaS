"use server";
import { z } from "zod";
import { requireRole } from "@/lib/supabase/access";
import { dbErrorMessage } from "./result";
import {
  isWorkspaceModule,
  isWorkspaceSection,
  workspacePageSchema,
} from "@/lib/workspace";
const requestSchema = z.object({
  module: z.string(),
  section: z.string(),
  page: z.number().int().min(1).max(10000).default(1),
  query: z.string().max(80).default(""),
  sort: z
    .string()
    .regex(/^[a-z_]{1,60}$/)
    .default("id"),
  ascending: z.boolean().default(true),
  filters: z
    .record(z.string().regex(/^[a-z_]{1,60}$/), z.string().max(200))
    .default({}),
  selected: z.string().uuid().nullable().default(null),
});
export async function listWorkspaceSection(input: unknown) {
  const parsed = requestSchema.safeParse(input);
  if (
    !parsed.success ||
    !isWorkspaceModule(parsed.data.module) ||
    !isWorkspaceSection(parsed.data.module, parsed.data.section)
  )
    return { ok: false as const, error: "Liste parametreleri geçersiz." };
  const { module, section, page, query, sort, ascending, filters, selected } =
    parsed.data;
  const { supabase } = await requireRole(
    ["lesson-operations", "progress", "registration"].includes(module)
      ? ["student"]
      : ["admin"],
  );
  const { data, error } = await supabase.rpc("workspace_section", {
    p_module: module,
    p_section: section,
    p_page: page,
    p_query: query,
    p_sort: sort,
    p_ascending: ascending,
    p_filters: filters,
    p_selected: selected,
  });
  if (error)
    return {
      ok: false as const,
      error: dbErrorMessage(error, "Liste yüklenemedi."),
    };
  const decoded = workspacePageSchema.safeParse(data);
  return decoded.success
    ? { ok: true as const, ...decoded.data }
    : { ok: false as const, error: "Liste yüklenemedi." };
}
