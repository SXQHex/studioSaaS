import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sql = readFileSync("supabase/schema/00_baseline_snapshot.sql", "utf8");

describe("database business-rule contract", () => {
  it("prevents duplicate lesson-credit consumption", () => {
    expect(sql).toContain("credit_transactions_one_lesson_use");
    expect(sql).toContain("on conflict do nothing");
  });

  it("does not consume group lesson credits for cancelled or postponed sessions", () => {
    expect(sql).toContain("if v_lesson.status in ('cancelled', 'postponed') then");
    expect(sql).toContain("and l.status not in ('cancelled'::public.lesson_status, 'postponed'::public.lesson_status)");
  });

  it("enforces cross-center integrity with composite foreign keys", () => {
    for (const name of [
      "subscriptions_member_center_fkey",
      "attendance_member_center_fkey",
      "attendance_lesson_center_fkey",
      "credit_transactions_subscription_center_fkey",
      "credit_transactions_member_center_fkey",
      "credit_transactions_lesson_center_fkey",
    ]) {
      expect(sql).toContain(name);
    }
  });

  it("bounds credit balances and keeps the credit ledger append-only for clients", () => {
    expect(sql).toContain("credits_remaining <= credits_purchased");
    expect(sql).toContain("credit_transactions_admin_insert_center");
    expect(sql).toContain("revoke all privileges on public.notifications from anon, authenticated");
  });

  it("prevents overlapping confirmed room and instructor bookings", () => {
    expect(sql).toContain("exclude using gist (room_id with =");
    expect(sql).toContain("exclude using gist (instructor_id with =");
  });
});
