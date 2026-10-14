"use server";
import * as service from "@/lib/backend/services/account";
import { withBackendSession } from "./backend-session";
export async function updateMyProfile(input: unknown) {
  return withBackendSession(
    (context) => service.updateMyProfile(context, input),
    true,
  );
}
export async function changeMyPassword(input: unknown) {
  return withBackendSession(
    (context) => service.changeMyPassword(context, input),
    true,
  );
}
