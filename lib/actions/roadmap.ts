"use server";
import * as service from "@/lib/backend/services/roadmap";
import { withBackendSession } from "./backend-session";
export async function roadmapCommand(module: string, input: unknown) {
  return withBackendSession(
    (context) => service.roadmapCommand(context, module, input),
    true,
  );
}
export async function processEmailQueue() {
  return withBackendSession(
    (context) => service.processEmailQueue(context),
    true,
  );
}
