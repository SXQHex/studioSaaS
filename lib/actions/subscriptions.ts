"use server";
import * as service from "@/lib/backend/services/subscriptions";
import { withBackendSession } from "./backend-session";
export async function updateSubscription(input: unknown) {
  return withBackendSession(
    (context) => service.updateSubscription(context, input),
    true,
  );
}
