import { describe, expect, it } from "vitest";
import { managedCenters } from "../lib/supabase/managed-centers";

const centers = [
  { id: "center-a", organization_id: "org-a" },
  { id: "center-b", organization_id: "org-a" },
  { id: "center-c", organization_id: "org-b" },
];

describe("managedCenters", () => {
  it("shows organization owner all of their organization's centers", () => {
    expect(managedCenters(centers, [
      { role: "owner", scopeType: "organization", scopeId: "org-a" },
    ])).toEqual(centers.slice(0, 2));
  });

  it("shows center admin only assigned centers", () => {
    expect(managedCenters(centers, [
      { role: "admin", scopeType: "center", scopeId: "center-b" },
    ])).toEqual([centers[1]]);
  });

  it("does not treat an instructor or assistant assignment as management", () => {
    expect(managedCenters(centers, [
      { role: "admin", scopeType: "center", scopeId: "center-a" },
      { role: "instructor", scopeType: "center", scopeId: "center-c" },
      { role: "ainstructor", scopeType: "center", scopeId: "center-b" },
    ])).toEqual([centers[0]]);
  });

  it("allows platform appowner all centers", () => {
    expect(managedCenters(centers, [
      { role: "appowner", scopeType: "platform", scopeId: null },
    ])).toEqual(centers);
  });

  it("does not elevate student or incorrect scope assignments", () => {
    expect(managedCenters(centers, [
      { role: "student", scopeType: "center", scopeId: "center-a" },
      { role: "admin", scopeType: "lesson", scopeId: "center-c" },
    ])).toEqual([]);
  });
});
