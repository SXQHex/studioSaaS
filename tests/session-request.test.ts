import { describe, expect, it } from "vitest";
import { sessionRequestSchema } from "@/lib/validation/session-request";

const center = "3f2b8c1e-9d4a-4b6e-8f10-2c7d5a9e1b34";
const room = "7a1c9e52-4b3d-4f80-9a6e-5d2b8c3f1e07";
const member = "5c8a2f16-3b7d-4e91-8a24-6d9f0b2c4e18";
const window = {
  center_id: center,
  room_id: room,
  title: "Seans",
  starts_at: "2026-10-12T17:00:00.000Z",
  ends_at: "2026-10-12T18:00:00.000Z",
  notes: null,
};

describe("sessionRequestSchema", () => {
  it("accepts a one-person private lesson request", () => {
    expect(sessionRequestSchema.safeParse({
      ...window, session_type: "private", private_member_id: member, expected_attendees: 1,
    }).success).toBe(true);
  });

  it("rejects a private request without a member or with group-sized attendance", () => {
    expect(sessionRequestSchema.safeParse({
      ...window, session_type: "private", private_member_id: null, expected_attendees: 1,
    }).success).toBe(false);
    expect(sessionRequestSchema.safeParse({
      ...window, session_type: "private", private_member_id: member, expected_attendees: 20,
    }).success).toBe(false);
  });

  it("allows overlapping proposals as separate inputs; reservations are checked only on approval", () => {
    const first = sessionRequestSchema.safeParse({
      ...window, session_type: "private", private_member_id: member, expected_attendees: 1,
    });
    const second = sessionRequestSchema.safeParse({
      ...window, session_type: "group", private_member_id: null, expected_attendees: 20,
    });
    expect(first.success).toBe(true);
    expect(second.success).toBe(true);
  });

  it("rejects invalid time ranges, IDs and group requests with a private member", () => {
    expect(sessionRequestSchema.safeParse({
      ...window, session_type: "group", private_member_id: null, expected_attendees: 20,
      ends_at: "2026-10-12T17:00:00.000Z",
    }).success).toBe(false);
    expect(sessionRequestSchema.safeParse({
      ...window, center_id: "not-a-uuid", session_type: "group", private_member_id: null, expected_attendees: 20,
    }).success).toBe(false);
    expect(sessionRequestSchema.safeParse({
      ...window, session_type: "group", private_member_id: member, expected_attendees: 20,
    }).success).toBe(false);
  });
});
