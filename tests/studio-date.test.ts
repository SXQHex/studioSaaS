import { afterEach, describe, expect, it } from "vitest";
import { studioDate, studioDateTime, studioTime } from "@/lib/studio-date";

const originalTimezone = process.env.TZ;
afterEach(() => {
  if (originalTimezone === undefined) delete process.env.TZ;
  else process.env.TZ = originalTimezone;
});
describe.each(["UTC", "America/Los_Angeles"])("studio dates on a %s host", (hostTimezone) => {
  it("shows Istanbul lesson start and end times rather than the host timezone", () => {
    process.env.TZ = hostTimezone;
    expect(studioDateTime("2026-10-20T16:00:00Z")).toContain("19:00");
    expect(studioTime("2026-10-20T17:00:00Z")).toBe("20:00");
  });
  it("uses the Istanbul calendar day for events crossing midnight", () => {
    process.env.TZ = hostTimezone;
    expect(studioDateTime("2026-10-20T22:30:00Z")).toContain("21 Eki 2026");
    expect(studioTime("2026-10-20T22:30:00Z")).toBe("01:30");
    expect(studioDate("2026-10-20")).toBe("20 Eki 2026");
  });
});

import { studioInputToIso } from "@/lib/studio-date";
it("interprets studio input in Istanbul even on a Los Angeles host", () => {
  process.env.TZ = "America/Los_Angeles";
  expect(studioInputToIso("2026-10-20T19:00")).toBe("2026-10-20T16:00:00.000Z");
  expect(studioInputToIso("2026-10-21T01:30")).toBe("2026-10-20T22:30:00.000Z");
  expect(studioInputToIso("")).toBe("");
});
