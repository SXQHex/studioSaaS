import { describe, expect, it } from "vitest";
import {
  attendanceSchema,
  creditAdjustmentSchema,
  lessonSchema,
  memberSchema,
  subscriptionSchema,
  subscriptionUpdateSchema,
} from "@/lib/validation/schemas";

const id = "3f2b8c1e-9d4a-4b6e-8f10-2c7d5a9e1b34";
const otherId = "7a1c9e52-4b3d-4f80-9a6e-5d2b8c3f1e07";

describe("memberSchema", () => {
  it("trims text and turns empty optional fields into null", () => {
    const parsed = memberSchema.parse({ center_id: id, full_name: "  Ayşe Yılmaz ", phone: " ", email: "", notes: "", is_active: true });
    expect(parsed).toEqual({ center_id: id, full_name: "Ayşe Yılmaz", phone: null, email: null, notes: null, is_active: true });
  });

  it("requires a name and a valid e-mail when one is given", () => {
    expect(memberSchema.safeParse({ center_id: id, full_name: " ", phone: "", email: "", notes: "", is_active: true }).success).toBe(false);
    expect(memberSchema.safeParse({ center_id: id, full_name: "Ayşe", phone: "", email: "not-an-email", notes: "", is_active: true }).success).toBe(false);
  });
});

describe("lessonSchema", () => {
  const base = {
    type: "group" as const,
    title: "Grup dersi",
    starts_at: "2026-10-12T17:00:00.000Z",
    ends_at: "2026-10-12T18:00:00.000Z",
    instructor_id: id,
    private_member_id: id,
    center_id: id,
    room_id: otherId,
    expected_attendees: 20,
    notes: "",
  };

  it("drops the member of a group lesson and normalises dates", () => {
    const parsed = lessonSchema.parse({ ...base, starts_at: "2026-10-12T20:00:00+03:00" });
    expect(parsed.private_member_id).toBeNull();
    expect(parsed.starts_at).toBe("2026-10-12T17:00:00.000Z");
  });

  it("requires a member for private lessons", () => {
    expect(lessonSchema.safeParse({ ...base, type: "private", private_member_id: null, expected_attendees: 1 }).success).toBe(false);
    expect(lessonSchema.safeParse({ ...base, type: "private", expected_attendees: 1 }).success).toBe(true);
  });

  it("rejects an end time that is not after the start", () => {
    expect(lessonSchema.safeParse({ ...base, ends_at: "2026-10-12T17:00:00.000Z" }).success).toBe(false);
    expect(lessonSchema.safeParse({ ...base, ends_at: "2026-10-12T18:00:00.000Z" }).success).toBe(true);
  });
});

describe("subscriptionSchema", () => {
  const base = {
    member_id: id,
    type: "private_credits" as const,
    starts_on: "2026-10-12",
    ends_on: "2026-12-12",
    credits_purchased: 8,
    amount: 4000,
    payment_status: "pending" as const,
    notes: "",
  };

  it("forces group packages to 4 credits with no end date", () => {
    const parsed = subscriptionSchema.parse({ ...base, type: "group_4_weeks", credits_purchased: 99, ends_on: "2026-11-01" });
    expect(parsed.credits_purchased).toBe(4);
    expect(parsed.ends_on).toBeNull();
  });

  it("requires an end date on or after the start for private packages", () => {
    expect(subscriptionSchema.safeParse({ ...base, ends_on: null }).success).toBe(false);
    expect(subscriptionSchema.safeParse({ ...base, ends_on: "2026-10-01" }).success).toBe(false);
    expect(subscriptionSchema.safeParse(base).success).toBe(true);
  });

  it("bounds credits and amount", () => {
    expect(subscriptionSchema.safeParse({ ...base, credits_purchased: 0 }).success).toBe(false);
    expect(subscriptionSchema.safeParse({ ...base, credits_purchased: 101 }).success).toBe(false);
    expect(subscriptionSchema.safeParse({ ...base, credits_purchased: 2.5 }).success).toBe(false);
    expect(subscriptionSchema.safeParse({ ...base, amount: -1 }).success).toBe(false);
  });
});

describe("subscriptionUpdateSchema", () => {
  it("needs at least one field to change and rejects refunded as a manual payment status", () => {
    expect(subscriptionUpdateSchema.safeParse({ id }).success).toBe(false);
    expect(subscriptionUpdateSchema.safeParse({ id, status: "cancelled" }).success).toBe(true);
    expect(subscriptionUpdateSchema.safeParse({ id, payment_status: "refunded" }).success).toBe(false);
  });
});

describe("attendanceSchema", () => {
  it("validates ids and trims notes", () => {
    const parsed = attendanceSchema.parse({ lesson_id: id, member_id: otherId, attended: false, notes: "  geç kaldı " });
    expect(parsed.notes).toBe("geç kaldı");
    expect(attendanceSchema.safeParse({ lesson_id: "x", member_id: otherId, attended: true, notes: "" }).success).toBe(false);
  });
});

describe("creditAdjustmentSchema", () => {
  const base = { subscription_id: id, amount: 2, note: "Telafi dersi" };

  it("accepts non-zero whole adjustments within ±100", () => {
    expect(creditAdjustmentSchema.safeParse(base).success).toBe(true);
    expect(creditAdjustmentSchema.safeParse({ ...base, amount: -100 }).success).toBe(true);
  });

  it("rejects zero, fractions and out-of-range amounts", () => {
    expect(creditAdjustmentSchema.safeParse({ ...base, amount: 0 }).success).toBe(false);
    expect(creditAdjustmentSchema.safeParse({ ...base, amount: 1.5 }).success).toBe(false);
    expect(creditAdjustmentSchema.safeParse({ ...base, amount: 101 }).success).toBe(false);
  });

  it("requires an explanation", () => {
    expect(creditAdjustmentSchema.safeParse({ ...base, note: "   " }).success).toBe(false);
  });
});
