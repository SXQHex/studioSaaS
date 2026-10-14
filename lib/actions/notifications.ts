"use server";
import * as service from "@/lib/backend/services/notifications";
import { withBackendSession } from "./backend-session";
export async function markNotificationRead(input: unknown) {
  return withBackendSession(
    (context) => service.markNotificationRead(context, input),
    true,
  );
}
