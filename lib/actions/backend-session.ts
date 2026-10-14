import type { BackendContext } from "@/lib/backend/context";
import { BackendError } from "@/lib/backend/errors";
import { requireRole } from "@/lib/supabase/access";
import { revalidateStudioViews } from "./revalidate";
export async function withBackendSession<T>(
  run: (context: BackendContext) => Promise<T>,
  mutates = true,
) {
  const context = await requireRole(["student"]);
  try {
    const result = await run({
      ...context,
      config: {
        url: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
        publishableKey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "",
      },
    });
    if (
      mutates &&
      !(
        result &&
        typeof result === "object" &&
        "ok" in result &&
        result.ok === false
      )
    )
      revalidateStudioViews();
    return result;
  } catch (error) {
    if (error instanceof BackendError)
      return {
        ok: false as const,
        error: error.message,
        status: error.status,
        code: error.code,
      };
    throw error;
  }
}
