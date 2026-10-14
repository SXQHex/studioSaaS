"use server";
import * as service from "@/lib/backend/services/credits";
import { withBackendSession } from "./backend-session";
export async function adjustCredits(input: unknown) {
  return withBackendSession(
    (context) => service.adjustCredits(context, input),
    true,
  );
}
