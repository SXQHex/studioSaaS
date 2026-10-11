"use client";

import { useState } from "react";
import type { ActionResult } from "@/lib/actions/result";

/**
 * Shared state for the dashboard managers: runs a Server Action and exposes the
 * busy / pending-row / error / notice state that every form and row action needs.
 * Server Actions call `revalidatePath`, so the page data refreshes without a manual reload.
 */
export function useActionRunner() {
  const [busy, setBusy] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  function reset() {
    setError("");
    setNotice("");
  }

  async function run(
    action: () => Promise<ActionResult>,
    options: { rowId?: string; onSuccess?: () => void } = {},
  ): Promise<boolean> {
    reset();
    if (options.rowId) setPendingId(options.rowId);
    else setBusy(true);

    try {
      const result = await action();
      if (!result.ok) {
        setError(result.error);
        return false;
      }
      setNotice(result.message);
      options.onSuccess?.();
      return true;
    } catch {
      setError("İşlem tamamlanamadı. Bağlantınızı kontrol edip tekrar deneyin.");
      return false;
    } finally {
      setBusy(false);
      setPendingId(null);
    }
  }

  return { busy, pendingId, error, notice, setError, setNotice, reset, run };
}
