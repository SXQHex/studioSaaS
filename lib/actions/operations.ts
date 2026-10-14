"use server";
import * as service from "@/lib/backend/services/operations";
import { withBackendSession } from "./backend-session";
export async function runOperation(module: string, input: unknown) {
  return withBackendSession(
    (context) => service.runOperation(context, module, input),
    true,
  );
}
