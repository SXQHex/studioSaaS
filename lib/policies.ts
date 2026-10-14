import { z } from "zod";
export const policyCommandSchema = z
  .object({
    action: z.enum(["organization", "center", "reset"]),
    key: z.string().min(1).max(80),
    organization_id: z.string().uuid().optional(),
    center_id: z.string().uuid().optional(),
    value: z.union([z.number().int(), z.boolean()]).optional(),
    mode: z.enum(["mandatory", "recommended"]).optional(),
    min: z.number().int().nullable().optional(),
    max: z.number().int().nullable().optional(),
    expected_revision: z.number().int().nonnegative(),
    reason: z.string().trim().min(3).max(500),
  })
  .superRefine((v, c) => {
    if (v.action === "organization" && (!v.organization_id || !v.mode))
      c.addIssue({ code: "custom", message: "Organizasyon ve mod gerekli." });
    if (v.action !== "organization" && !v.center_id)
      c.addIssue({ code: "custom", message: "Merkez gerekli." });
    if (v.action !== "reset" && v.value === undefined)
      c.addIssue({ code: "custom", message: "Değer gerekli." });
    if (v.min != null && v.max != null && v.min > v.max)
      c.addIssue({ code: "custom", message: "Alt sınır üst sınırı aşamaz." });
  });
export const policyExceptionSchema = z.object({
  lesson_id: z.string().uuid(),
  member_id: z.string().uuid(),
  operation: z.enum(["student_cancel", "no_show"]),
  overrides: z
    .object({
      private_cancel_hours: z.number().int().min(0).max(168).optional(),
      group_cancel_refund: z.boolean().optional(),
      late_cancel_charge: z.boolean().optional(),
      no_show_charge: z.boolean().optional(),
    })
    .strict()
    .refine((v) => Object.keys(v).length > 0, "İstisna değeri gerekli."),
  reason: z.string().trim().min(3).max(500),
});
export type Definition = {
  key: string;
  label: string;
  category: string;
  kind: "number" | "boolean";
  default_value: number | boolean;
  min_value: number | null;
  max_value: number | null;
};
export type Effective = {
  value: number | boolean;
  source: string;
  mode: "mandatory" | "recommended";
  organization_revision: number;
  center_revision: number;
  min: number | null;
  max: number | null;
  override_stored: number | boolean | null;
  override_active: boolean;
};
export type PolicyWorkspace = {
  definitions: Definition[];
  organizations: { id: string; name: string; can_edit: boolean }[];
  centers: {
    id: string;
    name: string;
    organization_id: string;
    effective: Record<string, Effective>;
  }[];
  organization_policies: {
    organization_id: string;
    key: string;
    value: number | boolean;
    mode: "mandatory" | "recommended";
    min_value: number | null;
    max_value: number | null;
    revision: number;
  }[];
  exception_participants: {
    lesson_id: string;
    member_id: string;
    lesson_label: string;
    member_name: string;
  }[];
  history: Record<string, unknown>[];
  exceptions: Record<string, unknown>[];
};
