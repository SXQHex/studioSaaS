"use server";
import * as service from "@/lib/backend/services/roles";
import { withBackendSession } from "./backend-session";
export async function assignScopedCenterRole(input: unknown) {
  return withBackendSession(
    (context) => service.assignScopedCenterRole(context, input),
    true,
  );
}
export async function removeScopedCenterRole(input: unknown) {
  return withBackendSession(
    (context) => service.removeScopedCenterRole(context, input),
    true,
  );
}
