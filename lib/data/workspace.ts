import type { ServerSupabase } from "@/lib/supabase/server";
import { studioDateKey } from "@/lib/studio-date";
import { reportRange } from "@/lib/validation/operations";
import {
  workspaceDataSchema,
  insightsDataSchema,
  planningDataSchema,
  workspacePageSchema,
  workspaceSections,
  type WorkspaceModule,
  type WorkspacePages,
} from "@/lib/workspace";
import type { SearchParams } from "./pagination";

export function workspaceDateRange(params: SearchParams, days = 1) {
  const to = typeof params.to === "string" ? params.to : studioDateKey();
  const start = new Date(studioDateKey() + "T12:00:00Z");
  start.setUTCDate(start.getUTCDate() - days + 1);
  const from =
    typeof params.from === "string"
      ? params.from
      : start.toISOString().slice(0, 10);
  return reportRange.safeParse({ from, to });
}
export async function loadWorkspace(
  supabase: ServerSupabase,
  module: WorkspaceModule,
) {
  const entries = await Promise.all(
    workspaceSections[module].map(async (section) => {
      const { data, error } = await supabase.rpc("workspace_section", {
        p_module: module,
        p_section: section,
      });
      const parsed = workspacePageSchema.safeParse(data);
      return {
        section,
        page: parsed.success ? parsed.data : { rows: [], total: 0 },
        error: Boolean(error || !parsed.success),
      };
    }),
  );
  const pages: WorkspacePages = Object.fromEntries(
    entries.map((e) => [e.section, e.page]),
  );
  return {
    data: Object.fromEntries(entries.map((e) => [e.section, e.page.rows])),
    pages,
    loadError: entries.some((e) => e.error),
  };
}
export function decodeWorkspace(data: unknown, error: unknown) {
  const parsed = workspaceDataSchema.safeParse(data);
  return {
    data: parsed.success ? parsed.data : {},
    loadError: Boolean(error || !parsed.success),
  };
}

export function decodeInsights(data: unknown, error: unknown) {
  const parsed = insightsDataSchema.safeParse(data);
  return {
    data: parsed.success
      ? parsed.data
      : {
          previous: {},
          payments: [],
          balances: [],
          renewals: [],
          lessons: [],
          usage: [],
          crm: [],
          sources: [],
          interventions: [],
          attendance_trend: [],
        },
    loadError: Boolean(error || !parsed.success),
  };
}
export function decodePlanning(data: unknown, error: unknown) {
  const parsed = planningDataSchema.safeParse(data);
  return {
    data: parsed.success
      ? parsed.data
      : {
          centers: [],
          rooms: [],
          instructors: [],
          lessons: [],
          requests: [],
          hours: [],
          blocks: [],
        },
    loadError: Boolean(error || !parsed.success),
  };
}
