export const PAGE_SIZE = 25;

type SearchParamValue = string | string[] | undefined;
export type SearchParams = Record<string, SearchParamValue>;

function first(value: SearchParamValue): string {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

/** 1-based page number from the `page` query parameter; invalid values fall back to 1. */
export function parsePage(value: SearchParamValue): number {
  const page = Number.parseInt(first(value), 10);
  return Number.isFinite(page) && page > 0 ? Math.min(page, 10_000) : 1;
}

/** Inclusive row range for Supabase `.range()`. */
export function pageRange(page: number, pageSize = PAGE_SIZE): [number, number] {
  const from = (page - 1) * pageSize;
  return [from, from + pageSize - 1];
}

export function pageCount(total: number, pageSize = PAGE_SIZE): number {
  return Math.max(1, Math.ceil(total / pageSize));
}

/**
 * Search text that is safe to interpolate into a PostgREST `.or()`/`ilike` filter:
 * strips characters that carry meaning in filter syntax (`, ( ) " \ % _ *`) and bounds the length.
 */
export function sanitizeSearchTerm(value: SearchParamValue): string {
  return first(value)
    .replace(/[,()"'\\%_*]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
}

/** Returns the value only if it is one of the allowed options, otherwise "". */
export function pickOption<T extends string>(value: SearchParamValue, allowed: readonly T[]): T | "" {
  const candidate = first(value);
  return (allowed as readonly string[]).includes(candidate) ? (candidate as T) : "";
}

/** Returns the value only if it looks like a UUID, otherwise "". */
export function pickUuid(value: SearchParamValue): string {
  const candidate = first(value);
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(candidate) ? candidate : "";
}
