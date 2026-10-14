import { z } from "zod";

/**
 * PostgreSQL UUID columns accept canonical hexadecimal IDs regardless of
 * RFC version/variant bits, including IDs imported from legacy seed data.
 * Authorization remains enforced by the caller-scoped RPCs and RLS.
 */
export const databaseId = (message = "Geçersiz kayıt kimliği.") =>
  z.guid(message);
