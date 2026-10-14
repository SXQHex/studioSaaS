"use server";
import * as service from "@/lib/backend/services/lessons";
import { withBackendSession } from "./backend-session";
export async function saveLesson(id: string | null, input: unknown) {
  return withBackendSession(
    (context) => service.saveLesson(context, id, input),
    true,
  );
}
export async function changeLessonStatus(input: unknown) {
  return withBackendSession(
    (context) => service.changeLessonStatus(context, input),
    true,
  );
}
