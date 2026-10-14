"use server";
import * as service from "@/lib/backend/services/policies";
import { withBackendSession } from "./backend-session";
export async function savePolicy(input: unknown) {
  return withBackendSession(
    (context) => service.savePolicy(context, input),
    true,
  );
}
export async function applyPolicyException(input: unknown) {
  return withBackendSession(
    (context) => service.applyPolicyException(context, input),
    true,
  );
}
