import { z } from "zod";

const uuid = z.string().uuid();
const label = z.string().trim().min(1).max(160);

export const sessionRequestSchema = z.object({
  center_id: uuid,
  room_id: uuid,
  session_type: z.enum(["private", "group"]),
  title: label,
  private_member_id: uuid.nullable(),
  starts_at: z.string().datetime(),
  ends_at: z.string().datetime(),
  expected_attendees: z.number().int().min(1).max(500),
  notes: z.string().trim().max(2000).nullable(),
}).superRefine((value, ctx) => {
  if (Date.parse(value.ends_at) <= Date.parse(value.starts_at)) {
    ctx.addIssue({ code: "custom", path: ["ends_at"], message: "Bitiş saati başlangıçtan sonra olmalı." });
  }
  if (value.session_type === "private" && !value.private_member_id) {
    ctx.addIssue({ code: "custom", path: ["private_member_id"], message: "Özel ders için üye seçin." });
  }
  if (value.session_type === "private" && value.expected_attendees !== 1) {
    ctx.addIssue({ code: "custom", path: ["expected_attendees"], message: "Özel ders için katılımcı sayısı 1 olmalıdır." });
  }
  if (value.session_type === "group" && value.private_member_id) {
    ctx.addIssue({ code: "custom", path: ["private_member_id"], message: "Grup dersinde özel üye seçilemez." });
  }
});
