"use server";
import * as service from "@/lib/backend/services/workspace";
import { withBackendSession } from "./backend-session";
export async function listWorkspaceSection(input: unknown) {
  return withBackendSession(
    (context) => service.listWorkspaceSection(context, input),
    false,
  );
}
