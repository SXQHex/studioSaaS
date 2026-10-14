import { describe, expect, it } from "vitest";
import { databaseId } from "@/lib/validation/database-id";
import { roadmapSchemas } from "@/lib/validation/roadmap";
import { requestSchema } from "@/lib/backend/services/workspace";
import { memberSchema } from "@/lib/validation/schemas";

const centerId = "00000000-0000-0000-0000-000000000102";
describe("PostgreSQL record IDs", () => {
  it.each([
    centerId,
    "10000000-0000-4000-8000-000000000001",
    "FFFFFFFF-FFFF-FFFF-FFFF-FFFFFFFFFFFF",
  ])("accepts canonical database ID %s", (id) => {
    expect(databaseId().parse(id)).toBe(id);
  });
  it.each([
    "",
    "center",
    "00000000-0000-0000-0000-00000000010g",
    centerId + "x",
  ])("rejects malformed database ID %s", (id) => {
    expect(databaseId().safeParse(id).success).toBe(false);
  });
  it("accepts the live legacy center for catalog creation and picker reloads", () => {
    expect(
      roadmapSchemas.catalog.safeParse({
        action: "create",
        center_id: centerId,
        name: "4 ders",
        lesson_type: "private",
        credits: 4,
        price: 1000.5,
        validity_days: 90,
        freeze_days: 0,
        freeze_count: 0,
      }).success,
    ).toBe(true);
    expect(
      requestSchema.safeParse({
        module: "catalog",
        section: "centers",
        selected: centerId,
      }).success,
    ).toBe(true);
    expect(
      memberSchema.safeParse({
        center_id: centerId,
        full_name: "Test Öğrenci",
        phone: "",
        email: "",
        notes: "",
        is_active: true,
      }).success,
    ).toBe(true);
  });
});
