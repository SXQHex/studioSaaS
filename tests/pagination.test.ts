import { describe, expect, it } from "vitest";
import { PAGE_SIZE, pageCount, pageRange, parsePage, pickOption, pickUuid, sanitizeSearchTerm } from "@/lib/data/pagination";

describe("parsePage", () => {
  it("defaults to 1 for missing or invalid values", () => {
    expect(parsePage(undefined)).toBe(1);
    expect(parsePage("abc")).toBe(1);
    expect(parsePage("0")).toBe(1);
    expect(parsePage("-3")).toBe(1);
  });

  it("reads the first value of repeated params", () => {
    expect(parsePage("4")).toBe(4);
    expect(parsePage(["2", "9"])).toBe(2);
  });
});

describe("pageRange / pageCount", () => {
  it("returns inclusive ranges for Supabase .range()", () => {
    expect(pageRange(1)).toEqual([0, PAGE_SIZE - 1]);
    expect(pageRange(3)).toEqual([2 * PAGE_SIZE, 3 * PAGE_SIZE - 1]);
  });

  it("always reports at least one page", () => {
    expect(pageCount(0)).toBe(1);
    expect(pageCount(PAGE_SIZE)).toBe(1);
    expect(pageCount(PAGE_SIZE + 1)).toBe(2);
  });
});

describe("sanitizeSearchTerm", () => {
  it("removes characters that are meaningful in PostgREST filters", () => {
    expect(sanitizeSearchTerm("ali,full_name.eq.x)")).toBe("ali full name.eq.x");
    expect(sanitizeSearchTerm('a%b_c"d\\e*f')).toBe("a b c d e f");
  });

  it("collapses whitespace and bounds the length", () => {
    expect(sanitizeSearchTerm("  ayşe    yılmaz ")).toBe("ayşe yılmaz");
    expect(sanitizeSearchTerm("x".repeat(500))).toHaveLength(80);
    expect(sanitizeSearchTerm(undefined)).toBe("");
  });
});

describe("pickOption / pickUuid", () => {
  it("only lets whitelisted values through", () => {
    expect(pickOption("active", ["active", "expired"] as const)).toBe("active");
    expect(pickOption("drop table", ["active", "expired"] as const)).toBe("");
    expect(pickUuid("3f2b8c1e-9d4a-4b6e-8f10-2c7d5a9e1b34")).toBe("3f2b8c1e-9d4a-4b6e-8f10-2c7d5a9e1b34");
    expect(pickUuid("1; select")).toBe("");
  });
});
