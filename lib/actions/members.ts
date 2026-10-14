"use server";
import * as service from "@/lib/backend/services/members";
import { withBackendSession } from "./backend-session";

export type { CenterAccount } from "@/lib/backend/services/members";
export async function saveMember(id: string | null, input: unknown) {
  return withBackendSession(
    (context) => service.saveMember(context, id, input),
    true,
  );
}
export async function setMemberActive(input: unknown) {
  return withBackendSession(
    (context) => service.setMemberActive(context, input),
    true,
  );
}
export async function lookupCenterAccount(input: unknown) {
  return withBackendSession(
    (context) => service.lookupCenterAccount(context, input),
    false,
  );
}
export async function linkMemberAccount(input: unknown) {
  return withBackendSession(
    (context) => service.linkMemberAccount(context, input),
    true,
  );
}
export async function unlinkMemberAccount(input: unknown) {
  return withBackendSession(
    (context) => service.unlinkMemberAccount(context, input),
    true,
  );
}
