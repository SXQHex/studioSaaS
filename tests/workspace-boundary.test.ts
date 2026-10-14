import { describe, expect, it, vi } from "vitest";
import {
  decodeInsights,
  decodePlanning,
  workspaceDateRange,
} from "@/lib/data/workspace";
import {
  insightsDataSchema,
  workspaceDataSchema,
  workspacePageSchema,
} from "@/lib/workspace";

const rpc = vi.fn();
vi.mock("@/lib/supabase/access", () => ({
  requireRole: vi.fn(async () => ({
    supabase: { rpc },
    profile: { roles: ["admin"] },
  })),
}));

import { listWorkspaceSection } from "@/lib/actions/workspace";

describe("workspace data boundaries", () => {
  it("rejects malformed lists instead of rendering invalid rows", () => {
    expect(
      workspacePageSchema.safeParse({ rows: [null], total: 1 }).success,
    ).toBe(false);
    expect(
      workspacePageSchema.safeParse({ rows: [{ id: 2 }], total: 1 }).success,
    ).toBe(false);
    expect(
      workspaceDataSchema.safeParse({ members: { id: "m" } }).success,
    ).toBe(false);
    expect(
      workspacePageSchema.safeParse({
        rows: [{ id: "m", center_id: "c", label: "Üye" }],
        total: 1050,
      }).success,
    ).toBe(true);
  });
  it("retains nested previous-period report data", () => {
    const data = {
      previous: { payments: [{ amount: 42 }] },
      payments: [{ amount: 84 }],
      balances: [],
      renewals: [],
      lessons: [],
      usage: [],
      crm: [],
      sources: [],
      interventions: [],
      attendance_trend: [],
    };
    expect(insightsDataSchema.parse(data).previous.payments[0].amount).toBe(42);
    expect(decodeInsights(data, null).loadError).toBe(false);
  });
  it("reports malformed planning intervals as a load failure", () => {
    const data = {
      centers: [],
      rooms: [],
      instructors: [],
      lessons: [],
      requests: [],
      hours: [{ weekday: "Monday" }],
      blocks: [],
    };
    expect(decodePlanning(data, null).loadError).toBe(true);
  });
  it("rejects impossible dates and reversed ranges", () => {
    expect(
      workspaceDateRange({ from: "2026-02-30", to: "2026-03-01" }).success,
    ).toBe(false);
    expect(
      workspaceDateRange({ from: "2026-10-20", to: "2026-10-19" }).success,
    ).toBe(false);
  });
});
describe("workspace list entry point", () => {
  it("rejects cross-module sections and invalid page/filter input before calling the database", async () => {
    rpc.mockClear();
    expect(
      (await listWorkspaceSection({ module: "crm", section: "members" })).ok,
    ).toBe(false);
    expect(
      (
        await listWorkspaceSection({
          module: "catalog",
          section: "members",
          page: 0,
        })
      ).ok,
    ).toBe(false);
    expect(
      (
        await listWorkspaceSection({
          module: "catalog",
          section: "members",
          filters: { "id);delete": "x" },
        })
      ).ok,
    ).toBe(false);
    expect(rpc).not.toHaveBeenCalled();
  });
  it("returns a visible failure when the database response violates the list contract", async () => {
    rpc.mockResolvedValueOnce({
      data: { rows: "not a list", total: 2 },
      error: null,
    });
    const result = await listWorkspaceSection({
      module: "catalog",
      section: "members",
    });
    expect(result.ok).toBe(false);
  });
});

import { databaseEnvironment } from "../scripts/verify-database.mjs";

describe("isolated PostgreSQL connection", () => {
  it("passes the connection host and port rather than connecting to the runner socket", () => {
    const env = databaseEnvironment(
      "postgresql://postgres:test%21@127.0.0.1:54322/postgres?sslmode=disable",
    );
    expect(env.PGHOST).toBe("127.0.0.1");
    expect(env.PGPORT).toBe("54322");
    expect(env.PGDATABASE).toBe("postgres");
    expect(env.PGUSER).toBe("postgres");
    expect(env.PGPASSWORD).toBe("test!");
    expect(env.PGSSLMODE).toBe("disable");
  });
});
