import { databaseId } from "@/lib/validation/database-id";
import { z } from "zod";
import { listAttendance } from "@/lib/data/attendance";
import { listTransactions } from "@/lib/data/credits";
import { LESSON_STATUSES, listLessons } from "@/lib/data/lessons";
import { listMembers } from "@/lib/data/members";
import { pageRange, sanitizeSearchTerm } from "@/lib/data/pagination";
import {
  listSubscriptions,
  SUBSCRIPTION_STATUSES,
} from "@/lib/data/subscriptions";
import { managedCenters } from "@/lib/supabase/managed-centers";
import { reportRange } from "@/lib/validation/operations";
import { type BackendContext, requireBackendRole } from "./context";
import { BackendError } from "./errors";
import { dbErrorMessage } from "./result";
import { centerAccountSchema, lookupCenterAccount } from "./services/members";
import { listRequestableMembers } from "./services/session-requests";
import { listWorkspaceSection, requestSchema } from "./services/workspace";

const id = databaseId();
const empty = z.object({}).strict();
const page = z.number().int().min(1).max(10000).default(1);
const list = z.object({ q: z.string().max(80).default(""), page });
function query<S extends z.ZodType>(
  schema: S,
  run: (ctx: BackendContext, input: z.output<S>) => Promise<unknown>,
) {
  return {
    schema,
    async run(ctx: BackendContext, input: unknown) {
      const parsed = schema.safeParse(input);
      if (!parsed.success)
        throw new BackendError(
          400,
          "INVALID_QUERY",
          parsed.error.issues[0]?.message ?? "Sorgu geçersiz.",
        );
      return run(ctx, parsed.data);
    },
  };
}
function check<T extends { error?: unknown }>(result: T) {
  if (result.error)
    throw new BackendError(503, "DATA_UNAVAILABLE", "Veriler yüklenemedi.");
  return result;
}
function rpcData<T>(result: {
  data: T | null;
  error: { code?: string; message?: string } | null;
}) {
  if (result.error)
    throw new BackendError(
      result.error.code === "42501" ? 403 : 503,
      result.error.code === "42501" ? "FORBIDDEN" : "DATA_UNAVAILABLE",
      dbErrorMessage(result.error, "Veriler yüklenemedi."),
    );
  return result.data;
}
export const queries = {
  session: query(empty, async (ctx) => ({
    userId: ctx.userId,
    email: ctx.email,
    profile: ctx.profile,
  })),
  workspace: query(requestSchema, listWorkspaceSection),
  "members.list": query(list.strict(), async (ctx, v) => {
    requireBackendRole(ctx, ["admin"]);
    const { data, error } = await ctx.supabase
      .from("centers")
      .select("id,organization_id");
    if (error)
      throw new BackendError(503, "DATA_UNAVAILABLE", "Merkezler yüklenemedi.");
    return check(
      await listMembers(ctx.supabase, {
        q: sanitizeSearchTerm(v.q),
        page: v.page,
        centerIds: managedCenters(data ?? [], ctx.profile.assignments).map(
          (c) => c.id,
        ),
      }),
    );
  }),
  "members.account": query(centerAccountSchema, lookupCenterAccount),
  "lessons.list": query(
    list
      .extend({
        status: z.union([z.enum(LESSON_STATUSES), z.literal("")]).default(""),
      })
      .strict(),
    async (ctx, v) => {
      requireBackendRole(ctx, ["admin", "instructor"]);
      return check(
        await listLessons(ctx.supabase, { ...v, q: sanitizeSearchTerm(v.q) }),
      );
    },
  ),
  "subscriptions.list": query(
    list
      .extend({
        status: z
          .union([z.enum(SUBSCRIPTION_STATUSES), z.literal("")])
          .default(""),
      })
      .strict(),
    async (ctx, v) => {
      requireBackendRole(ctx, ["admin"]);
      return check(
        await listSubscriptions(ctx.supabase, {
          ...v,
          q: sanitizeSearchTerm(v.q),
        }),
      );
    },
  ),
  "attendance.list": query(
    list
      .extend({ lessonId: z.union([id, z.literal("")]).default("") })
      .strict(),
    async (ctx, v) => {
      requireBackendRole(ctx, ["admin", "instructor", "ainstructor"]);
      return check(
        await listAttendance(ctx.supabase, {
          ...v,
          q: sanitizeSearchTerm(v.q),
        }),
      );
    },
  ),
  "credits.list": query(list.strict(), async (ctx, v) => {
    requireBackendRole(ctx, ["admin"]);
    return check(
      await listTransactions(ctx.supabase, {
        ...v,
        q: sanitizeSearchTerm(v.q),
      }),
    );
  }),
  "requests.list": query(z.object({ page }).strict(), async (ctx, v) => {
    requireBackendRole(ctx, ["admin", "instructor"]);
    const [from, to] = pageRange(v.page);
    const { data, count, error } = await ctx.supabase
      .from("session_requests")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .order("id")
      .range(from, to);
    return { rows: rpcData({ data, error }), total: count ?? 0 };
  }),
  "requests.members": query(z.object({ centerId: id }).strict(), (ctx, v) =>
    listRequestableMembers(ctx, v.centerId),
  ),
  planning: query(reportRange, async (ctx, v) => {
    requireBackendRole(ctx, ["admin"]);
    return rpcData(
      await ctx.supabase.rpc("planning_workspace", {
        p_from: v.from,
        p_to: v.to,
      }),
    );
  }),
  reports: query(reportRange, async (ctx, v) => {
    requireBackendRole(ctx, ["admin"]);
    return rpcData(
      await ctx.supabase.rpc("studio_report", { p_from: v.from, p_to: v.to }),
    );
  }),
  insights: query(reportRange, async (ctx, v) => {
    requireBackendRole(ctx, ["admin"]);
    return rpcData(
      await ctx.supabase.rpc("roadmap_workspace", {
        p_module: "insights",
        p_from: v.from,
        p_to: v.to,
      }),
    );
  }),
  policies: query(empty, async (ctx) => {
    requireBackendRole(ctx, ["admin"]);
    return rpcData(await ctx.supabase.rpc("policy_workspace"));
  }),
  "subscriptions.eligibility": query(
    z.object({ lessonId: id }).strict(),
    async (ctx, v) => {
      requireBackendRole(ctx, ["admin", "instructor", "ainstructor"]);
      return rpcData(
        await ctx.supabase.rpc("lesson_package_eligibility", {
          p_lesson: v.lessonId,
        }),
      );
    },
  ),
  "subscriptions.stats": query(empty, async (ctx) => {
    requireBackendRole(ctx, ["admin"]);
    return rpcData(await ctx.supabase.rpc("subscription_stats"));
  }),
  "account.registration": query(empty, async (ctx) =>
    rpcData(await ctx.supabase.rpc("registration_self_workspace")),
  ),
  "account.packages": query(empty, async (ctx) =>
    rpcData(await ctx.supabase.rpc("my_subscription_terms")),
  ),
  "account.balances": query(empty, async (ctx) =>
    rpcData(await ctx.supabase.rpc("my_payment_balances")),
  ),
  "instructor.lessons": query(empty, async (ctx) => {
    requireBackendRole(ctx, ["instructor", "ainstructor", "admin"]);
    return rpcData(await ctx.supabase.rpc("my_teaching_lessons"));
  }),
  "instructor.roster": query(
    z.object({ lessonId: id }).strict(),
    async (ctx, v) => {
      requireBackendRole(ctx, ["instructor", "ainstructor", "admin"]);
      return rpcData(
        await ctx.supabase.rpc("my_lesson_roster", { p_lesson_id: v.lessonId }),
      );
    },
  ),
  notifications: query(z.object({ page }).strict(), async (ctx, v) => {
    const [from, to] = pageRange(v.page);
    const { data, count, error } = await ctx.supabase
      .from("notifications")
      .select("*", { count: "exact" })
      .eq("recipient_id", ctx.userId)
      .order("created_at", { ascending: false })
      .order("id")
      .range(from, to);
    return { rows: rpcData({ data, error }), total: count ?? 0 };
  }),
};
export function getQuery(name: string) {
  if (!Object.hasOwn(queries, name))
    throw new BackendError(404, "NOT_FOUND", "Sorgu bulunamadı.");
  return queries[name as keyof typeof queries];
}
export function queryParameters(url: URL) {
  const values: Record<string, unknown> = {};
  for (const [key, value] of url.searchParams) {
    if (Object.hasOwn(values, key))
      throw new BackendError(
        400,
        "INVALID_QUERY",
        "Tekrarlanan sorgu parametresi.",
      );
    if (key === "page")
      values[key] = /^\d+$/.test(value) ? Number(value) : value;
    else if (key === "ascending")
      values[key] = value === "true" ? true : value === "false" ? false : value;
    else if (key === "filters") {
      try {
        values[key] = JSON.parse(value);
      } catch {
        throw new BackendError(
          400,
          "INVALID_QUERY",
          "Filtre geçerli JSON olmalı.",
        );
      }
    } else values[key] = value;
  }
  return values;
}
