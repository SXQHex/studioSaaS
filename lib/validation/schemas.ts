import { z } from "zod";

/** Trimmed text where an empty string becomes `null`. */
const optionalText = (max: number, label: string) =>
  z
    .string()
    .trim()
    .max(max, `${label} en fazla ${max} karakter olabilir.`)
    .transform((value) => (value === "" ? null : value));

const uuid = (message: string) => z.string().uuid(message);
const isoDateTime = z
  .string()
  .refine(
    (value) => !Number.isNaN(Date.parse(value)),
    "Geçerli bir tarih ve saat girin.",
  );

const lessonTypes = ["private", "group"] as const;
const lessonStatuses = [
  "scheduled",
  "completed",
  "cancelled",
  "postponed",
] as const;
const subscriptionStatuses = ["active", "expired", "cancelled"] as const;

export const MAX_CREDITS = 100;

export const memberSchema = z.object({
  center_id: uuid("Merkez seçin."),
  full_name: z
    .string()
    .trim()
    .min(1, "Üye adı zorunludur.")
    .max(160, "Üye adı en fazla 160 karakter olabilir."),
  phone: optionalText(40, "Telefon"),
  email: z
    .string()
    .trim()
    .max(254, "E-posta en fazla 254 karakter olabilir.")
    .refine(
      (value) => value === "" || z.string().email().safeParse(value).success,
      "Geçerli bir e-posta adresi girin.",
    )
    .transform((value) => (value === "" ? null : value)),
  notes: optionalText(2000, "Notlar"),
  is_active: z.boolean(),
});
export type MemberInput = z.input<typeof memberSchema>;

export const memberStatusSchema = z.object({
  id: uuid("Geçersiz üye."),
  is_active: z.boolean(),
});

export const lessonSchema = z
  .object({
    type: z.enum(lessonTypes),
    title: z
      .string()
      .trim()
      .min(1, "Ders adı zorunludur.")
      .max(160, "Ders adı en fazla 160 karakter olabilir."),
    starts_at: isoDateTime,
    ends_at: isoDateTime.nullable(),
    instructor_id: uuid("Eğitmen seçin."),
    private_member_id: uuid("Geçersiz üye.").nullable(),
    center_id: uuid("Merkez seçin."),
    room_id: uuid("Oda seçin."),
    expected_attendees: z.number().int().min(1).max(500),
    notes: optionalText(2000, "Notlar"),
  })
  .superRefine((value, ctx) => {
    if (value.type === "private" && !value.private_member_id) {
      ctx.addIssue({
        code: "custom",
        path: ["private_member_id"],
        message: "Özel ders için bir üye seçin.",
      });
    }
    if (value.type === "private" && value.expected_attendees !== 1) {
      ctx.addIssue({
        code: "custom",
        path: ["expected_attendees"],
        message: "Özel ders için katılımcı sayısı 1 olmalıdır.",
      });
    }
    if (
      value.ends_at &&
      Date.parse(value.ends_at) <= Date.parse(value.starts_at)
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["ends_at"],
        message: "Bitiş zamanı başlangıçtan sonra olmalıdır.",
      });
    }
    if (!value.ends_at) {
      ctx.addIssue({
        code: "custom",
        path: ["ends_at"],
        message: "Oda rezervasyonu için bitiş saati zorunludur.",
      });
    }
  })
  .transform((value) => ({
    ...value,
    starts_at: new Date(value.starts_at).toISOString(),
    ends_at: value.ends_at ? new Date(value.ends_at).toISOString() : null,
    private_member_id:
      value.type === "private" ? value.private_member_id : null,
  }));
export type LessonInput = z.input<typeof lessonSchema>;

export const lessonStatusSchema = z.object({
  id: uuid("Geçersiz ders."),
  status: z.enum(lessonStatuses),
});

export const subscriptionUpdateSchema = z
  .object({
    id: uuid("Geçersiz abonelik."),
    status: z.enum(subscriptionStatuses),
  })
  .strict();

export const attendanceSchema = z.object({
  lesson_id: uuid("Ders seçin."),
  member_id: uuid("Üye seçin."),
  attended: z.boolean(),
  notes: optionalText(1000, "Notlar"),
});
export type AttendanceInput = z.input<typeof attendanceSchema>;

export const creditAdjustmentSchema = z.object({
  subscription_id: uuid("Kredi düzeltmesi için bir aktif abonelik seçin."),
  amount: z
    .number({ error: "Değişim miktarı girin." })
    .int("Değişim miktarı tam sayı olmalıdır.")
    .refine(
      (value) => value !== 0 && Math.abs(value) <= MAX_CREDITS,
      `Değişim miktarı -${MAX_CREDITS} ile ${MAX_CREDITS} arasında sıfır olmayan bir tam sayı olmalı.`,
    ),
  note: z
    .string()
    .trim()
    .min(1, "Düzeltme açıklaması zorunludur.")
    .max(500, "Açıklama en fazla 500 karakter olabilir."),
});
export type CreditAdjustmentInput = z.input<typeof creditAdjustmentSchema>;

/** First human-readable message from a failed parse. */
export function firstIssue(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Girilen bilgiler geçersiz.";
}
