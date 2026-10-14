import { z } from "zod";
const id = z.string().uuid();
const time = z.string().datetime();
const date = z.string().date();
const short = z.string().trim().min(1).max(160);
const note = z.string().trim().min(1).max(500);
const bool = z.boolean();
export const roadmapSchemas = {
  planning: z.discriminatedUnion("action", [
    z
      .object({
        action: z.literal("hours"),
        center_id: id,
        resource_kind: z.enum(["center", "room", "instructor"]),
        resource_id: z.union([id, z.literal("")]),
        weekday: z.number().int().min(1).max(7),
        opens: z.string().regex(/^\d{2}:\d{2}$/),
        closes: z.string().regex(/^\d{2}:\d{2}$/),
      })
      .refine((v) => v.closes > v.opens, "Bitiş başlangıçtan sonra olmalı."),
    z
      .object({
        action: z.literal("block"),
        center_id: id,
        resource_kind: z.enum(["center", "room", "instructor"]),
        resource_id: z.union([id, z.literal("")]),
        kind: z.enum(["closed", "group_draft"]),
        title: short,
        starts_at: time,
        ends_at: time,
      })
      .refine(
        (v) => v.ends_at > v.starts_at,
        "Bitiş başlangıçtan sonra olmalı.",
      ),
    z.object({
      action: z.enum(["delete_hours", "delete_block"]),
      id,
      center_id: id,
    }),
  ]),
  registration: z.discriminatedUnion("action", [
    z.object({
      action: z.literal("publish"),
      center_id: z.union([id, z.literal("")]),
      organization_id: z.union([id, z.literal("")]),
      title: short,
      body: z.string().trim().min(1).max(20000),
      required: bool,
    }),
    z.object({ action: z.literal("retire"), policy_id: id }),
    z.object({
      action: z.literal("requirements"),
      center_id: id,
      emergency_contact: bool,
      document_required: bool,
    }),
    z.object({
      action: z.literal("details"),
      member_id: id,
      phone: z.string().trim().min(7).max(40),
      emergency_name: z.string().max(160),
      emergency_phone: z.string().max(40),
      marketing_opt_in: bool,
    }),
    z.object({ action: z.literal("accept"), member_id: id, policy_id: id }),
    z.object({
      action: z.literal("document"),
      member_id: id,
      title: short,
      object_path: z.string().max(500),
    }),
  ]),
  catalog: z.discriminatedUnion("action", [
    z.object({
      action: z.literal("create"),
      center_id: id,
      name: short,
      lesson_type: z.enum(["private", "group"]),
      credits: z.number().int().min(1).max(1000),
      price: z
        .number()
        .nonnegative()
        .max(9999999999)
        .refine((n) => Math.abs(n * 100 - Math.round(n * 100)) < 1e-6),
      validity_days: z.number().int().min(1).max(3650),
      freeze_days: z.number().int().min(0).max(365),
      freeze_count: z.number().int().min(0).max(12),
    }),
    z.object({ action: z.literal("archive"), id }),
    z.object({
      action: z.literal("sell"),
      member_id: id,
      catalog_id: id,
      starts_on: date,
      key: id,
    }),
    z
      .object({
        action: z.literal("freeze"),
        subscription_id: id,
        starts_on: date,
        ends_on: date,
        note,
      })
      .refine((v) => v.ends_on >= v.starts_on, "Tarihler geçersiz."),
  ]),
  "crm-automation": z.discriminatedUnion("action", [
    z.object({
      action: z.literal("form"),
      center_id: id,
      slug: z.string().regex(/^[a-z0-9-]{3,60}$/),
      title: short,
    }),
    z.object({ action: z.literal("toggle_form"), id, active: bool }),
    z.object({
      action: z.literal("trial"),
      lead_id: id,
      outcome: z.enum(["attended", "cancelled", "no_show"]),
    }),
    z.object({ action: z.literal("assign"), task_id: id, assigned_to: id }),
  ]),
  progress: z.object({
    action: z.literal("create"),
    member_id: id,
    lesson_type: z.enum(["private", "group"]),
    level: z.string().trim().min(1).max(80),
    skill: short,
    score: z.number().int().min(1).max(5),
    note: z.string().max(2000),
    student_visible: bool,
  }),
  communication: z.object({ action: z.literal("retry"), id }),
};
export type RoadmapModule = keyof typeof roadmapSchemas;
