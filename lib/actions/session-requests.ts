"use server";
import * as service from "@/lib/backend/services/session-requests";
import { withBackendSession } from "./backend-session";
export async function createOrganization(input: unknown) {
  return withBackendSession(
    (context) => service.createOrganization(context, input),
    true,
  );
}
export async function createCenter(input: unknown) {
  return withBackendSession(
    (context) => service.createCenter(context, input),
    true,
  );
}
export async function grantCenterAdmin(input: unknown) {
  return withBackendSession(
    (context) => service.grantCenterAdmin(context, input),
    true,
  );
}
export async function revokeCenterAdmin(input: unknown) {
  return withBackendSession(
    (context) => service.revokeCenterAdmin(context, input),
    true,
  );
}
export async function createRoom(input: unknown) {
  return withBackendSession(
    (context) => service.createRoom(context, input),
    true,
  );
}
export async function listRequestableMembers(centerId: string) {
  return withBackendSession(
    (context) => service.listRequestableMembers(context, centerId),
    false,
  );
}
export async function createGroupProposal(input: unknown) {
  return withBackendSession(
    (context) => service.createGroupProposal(context, input),
    true,
  );
}
export async function createSessionRequest(input: unknown) {
  return withBackendSession(
    (context) => service.createSessionRequest(context, input),
    true,
  );
}
export async function reviewSessionRequest(input: unknown) {
  return withBackendSession(
    (context) => service.reviewSessionRequest(context, input),
    true,
  );
}
export async function withdrawSessionRequest(input: unknown) {
  return withBackendSession(
    (context) => service.withdrawSessionRequest(context, input),
    true,
  );
}
export async function proposeSessionRequestAlternative(input: unknown) {
  return withBackendSession(
    (context) => service.proposeSessionRequestAlternative(context, input),
    true,
  );
}
export async function respondSessionRequestAlternative(input: unknown) {
  return withBackendSession(
    (context) => service.respondSessionRequestAlternative(context, input),
    true,
  );
}
