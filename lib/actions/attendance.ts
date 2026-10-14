"use server";
import * as service from "@/lib/backend/services/attendance";
import { withBackendSession } from "./backend-session";
export async function recordAttendance(input: unknown) {
  return withBackendSession(
    (context) => service.recordAttendance(context, input),
    true,
  );
}
