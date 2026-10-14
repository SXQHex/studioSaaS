import { z } from "zod";

/** RPC boundary: validate row containers and the fields used by form dependencies. */
export const workspaceRowSchema = z.looseObject({
  id: z.string().optional(),
  label: z.string().nullable().optional(),
  center_id: z.string().nullable().optional(),
  organization_id: z.string().nullable().optional(),
  member_id: z.string().nullable().optional(),
  profile_id: z.string().nullable().optional(),
  group_id: z.string().nullable().optional(),
  subscription_id: z.string().nullable().optional(),
  lead_id: z.string().nullable().optional(),
  private_member_id: z.string().nullable().optional(),
  name: z.string().nullable().optional(),
  full_name: z.string().nullable().optional(),
  title: z.string().nullable().optional(),
  status: z.string().nullable().optional(),
  stage: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  interests: z.string().nullable().optional(),
  trial_at: z.string().nullable().optional(),
  active: z.boolean().optional(),
  completed_at: z.string().nullable().optional(),
});
export type WorkspaceRow = z.infer<typeof workspaceRowSchema>;
export const workspaceDataSchema = z.record(
  z.string(),
  z.array(workspaceRowSchema),
);
export type WorkspaceData = z.infer<typeof workspaceDataSchema>;
export const workspacePageSchema = z.object({
  rows: z.array(workspaceRowSchema),
  total: z.number().int().nonnegative(),
});
export type WorkspacePage = z.infer<typeof workspacePageSchema>;
export type WorkspacePages = Record<string, WorkspacePage>;

export const workspaceSections = {
  groups: [
    "centers",
    "rooms",
    "instructors",
    "members",
    "groups",
    "enrollments",
    "lessons",
    "waitlist",
  ],
  payments: ["centers", "members", "subscriptions", "payments"],
  "lesson-operations": ["members", "lessons", "outcomes", "changes"],
  crm: ["centers", "leads", "tasks"],
  catalog: ["centers", "members", "catalog", "subscriptions", "freezes"],
  "crm-automation": ["centers", "leads", "tasks", "forms", "managers"],
  progress: ["members", "progress"],
  communication: ["emails"],
  registration: ["centers", "members", "policies", "documents"],
} as const;
export type WorkspaceModule = keyof typeof workspaceSections;
export function isWorkspaceModule(value: string): value is WorkspaceModule {
  return Object.hasOwn(workspaceSections, value);
}
export function isWorkspaceSection(module: WorkspaceModule, section: string) {
  return (workspaceSections[module] as readonly string[]).includes(section);
}

export type ResourceHour = {
  center_id: string;
  resource_kind: string;
  resource_id?: string | null;
  weekday: number;
  opens: string;
  closes: string;
};
export type ResourceBlock = {
  center_id: string;
  resource_kind: string;
  resource_id?: string | null;
  kind: string;
  starts_at: string;
  ends_at: string;
};
export type PlannedLesson = {
  center_id: string;
  room_id?: string | null;
  instructor_id?: string | null;
  status: string;
  starts_at: string;
  ends_at: string;
};

export const planningHoursSchema = z.array(
  z.object({
    center_id: z.string(),
    resource_kind: z.string(),
    resource_id: z.string().nullable().optional(),
    weekday: z.number(),
    opens: z.string(),
    closes: z.string(),
  }),
);
export const planningBlocksSchema = z.array(
  z.object({
    center_id: z.string(),
    resource_kind: z.string(),
    resource_id: z.string().nullable().optional(),
    kind: z.string(),
    starts_at: z.string(),
    ends_at: z.string(),
  }),
);
export const planningLessonsSchema = z.array(
  z.object({
    center_id: z.string(),
    room_id: z.string().nullable().optional(),
    instructor_id: z.string().nullable().optional(),
    status: z.string(),
    starts_at: z.string(),
    ends_at: z.string(),
  }),
);

export const insightsDataSchema = z.object({
  previous: workspaceDataSchema,
  payments: z.array(workspaceRowSchema),
  balances: z.array(workspaceRowSchema),
  renewals: z.array(workspaceRowSchema),
  lessons: z.array(workspaceRowSchema),
  usage: z.array(workspaceRowSchema),
  crm: z.array(workspaceRowSchema),
  sources: z.array(workspaceRowSchema),
  interventions: z.array(workspaceRowSchema),
  attendance_trend: z.array(workspaceRowSchema),
});
export type InsightsData = z.infer<typeof insightsDataSchema>;
export const planningDataSchema = z.object({
  centers: z.array(workspaceRowSchema),
  rooms: z.array(workspaceRowSchema),
  instructors: z.array(workspaceRowSchema),
  lessons: planningLessonsSchema.element.and(workspaceRowSchema).array(),
  requests: z.array(workspaceRowSchema),
  hours: planningHoursSchema.element.and(workspaceRowSchema).array(),
  blocks: planningBlocksSchema.element.and(workspaceRowSchema).array(),
});
export type PlanningData = z.infer<typeof planningDataSchema>;
