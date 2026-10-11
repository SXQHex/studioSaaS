import type { z } from "zod";
import { firstIssue } from "@/lib/validation/schemas";

export type ActionResult = { ok: true; message: string } | { ok: false; error: string };

export const ok = (message: string): ActionResult => ({ ok: true, message });
export const fail = (error: string): ActionResult => ({ ok: false, error });

type DbError = { code?: string; message?: string } | null | undefined;

/**
 * Maps database errors to user-facing Turkish messages. Messages raised by our own
 * trigger functions (SQLSTATE P0001) are already written for end users and pass through;
 * everything else is replaced so internal details never reach the browser.
 */
export function dbErrorMessage(error: DbError, fallback = "İşlem tamamlanamadı."): string {
  switch (error?.code) {
    case "42501":
      return "Bu işlem için yetkiniz yok.";
    case "23505":
      return "Bu kayıt zaten mevcut.";
    case "23503":
      return "İlişkili bir kayıt bulunamadı ya da bu kayıt başka kayıtlarda kullanılıyor.";
    case "23514":
      return "Girilen değerler veritabanı kurallarına uymuyor.";
    case "P0001":
      return error.message || fallback;
    default:
      return fallback;
  }
}

/** Parses untrusted action input; returns either the data or a ready-to-return failure. */
export function parseInput<S extends z.ZodType>(
  schema: S,
  input: unknown,
): { data: z.output<S>; failure?: undefined } | { data?: undefined; failure: ActionResult } {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { failure: fail(firstIssue(parsed.error)) };
  return { data: parsed.data };
}
