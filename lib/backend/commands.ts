import { databaseId } from "@/lib/validation/database-id";
import { z } from "zod";
import { policyCommandSchema, policyExceptionSchema } from "@/lib/policies";
import {
  crmOperation,
  groupsOperation,
  lessonOperation,
  paymentsOperation,
} from "@/lib/validation/operations";
import { roadmapSchemas } from "@/lib/validation/roadmap";
import {
  attendanceSchema,
  creditAdjustmentSchema,
  lessonSchema,
  lessonStatusSchema,
  memberSchema,
  memberStatusSchema,
  subscriptionUpdateSchema,
} from "@/lib/validation/schemas";
import {
  alternativeSessionRequestSchema,
  respondAlternativeSchema,
  reviewSessionRequestSchema,
  sessionRequestSchema,
} from "@/lib/validation/session-request";
import type { BackendContext } from "./context";
import { BackendError } from "./errors";
import * as account from "./services/account";
import * as attendance from "./services/attendance";
import * as credits from "./services/credits";
import * as lessons from "./services/lessons";
import * as members from "./services/members";
import * as notifications from "./services/notifications";
import * as operations from "./services/operations";
import * as policies from "./services/policies";
import * as roadmap from "./services/roadmap";
import * as roles from "./services/roles";
import * as requests from "./services/session-requests";
import * as subscriptions from "./services/subscriptions";

function command<S extends z.ZodType>(
  schema: S,
  run: (ctx: BackendContext, input: z.input<S>) => Promise<unknown>,
) {
  return {
    schema,
    async run(ctx: BackendContext, input: unknown) {
      const parsed = schema.safeParse(input);
      if (!parsed.success)
        throw new BackendError(
          422,
          "VALIDATION_ERROR",
          parsed.error.issues[0]?.message ?? "Bilgiler geçersiz.",
        );
      // Services own normalization; retain raw input so transforms are not applied twice.
      return run(ctx, input as z.input<S>);
    },
  };
}
const id = databaseId();
const identity = z.object({ id }).strict();
const empty = z.object({}).strict();
export const commands = {
  "account.update": command(account.editProfileSchema, account.updateMyProfile),
  "account.password": command(account.passwordSchema, account.changeMyPassword),
  "members.save": command(
    z.object({ id: id.nullable(), input: memberSchema }).strict(),
    (ctx, v) => members.saveMember(ctx, v.id, v.input),
  ),
  "members.active": command(memberStatusSchema, members.setMemberActive),
  "members.link": command(
    members.memberAccountSchema,
    members.linkMemberAccount,
  ),
  "members.unlink": command(
    members.memberLinkSchema,
    members.unlinkMemberAccount,
  ),
  "lessons.save": command(
    z.object({ id: id.nullable(), input: lessonSchema }).strict(),
    (ctx, v) => lessons.saveLesson(ctx, v.id, v.input),
  ),
  "lessons.status": command(lessonStatusSchema, lessons.changeLessonStatus),
  "attendance.record": command(attendanceSchema, attendance.recordAttendance),
  "credits.adjust": command(creditAdjustmentSchema, credits.adjustCredits),
  "subscriptions.status": command(
    subscriptionUpdateSchema,
    subscriptions.updateSubscription,
  ),
  "notifications.read": command(identity, notifications.markNotificationRead),
  "roles.assign": command(roles.assignSchema, roles.assignScopedCenterRole),
  "roles.remove": command(roles.removeSchema, roles.removeScopedCenterRole),
  "organizations.create": command(
    requests.resourceSchema,
    requests.createOrganization,
  ),
  "centers.create": command(requests.centerSchema, requests.createCenter),
  "centers.grant-admin": command(
    requests.centerAdminSchema,
    requests.grantCenterAdmin,
  ),
  "centers.revoke-admin": command(
    requests.centerAdminSchema,
    requests.revokeCenterAdmin,
  ),
  "rooms.create": command(requests.roomSchema, requests.createRoom),
  "requests.create": command(
    sessionRequestSchema,
    requests.createSessionRequest,
  ),
  "requests.group-proposal": command(
    sessionRequestSchema.and(z.object({ instructor_id: id })),
    requests.createGroupProposal,
  ),
  "requests.review": command(
    reviewSessionRequestSchema,
    requests.reviewSessionRequest,
  ),
  "requests.withdraw": command(identity, requests.withdrawSessionRequest),
  "requests.propose-alternative": command(
    alternativeSessionRequestSchema,
    requests.proposeSessionRequestAlternative,
  ),
  "requests.respond-alternative": command(
    respondAlternativeSchema,
    requests.respondSessionRequestAlternative,
  ),
  "groups.command": command(groupsOperation, (ctx, v) =>
    operations.runOperation(ctx, "groups", v),
  ),
  "payments.command": command(paymentsOperation, (ctx, v) =>
    operations.runOperation(ctx, "payments", v),
  ),
  "lesson-operations.command": command(lessonOperation, (ctx, v) =>
    operations.runOperation(ctx, "lesson-operations", v),
  ),
  "crm.command": command(crmOperation, (ctx, v) =>
    operations.runOperation(ctx, "crm", v),
  ),
  "planning.command": command(roadmapSchemas.planning, (ctx, v) =>
    roadmap.roadmapCommand(ctx, "planning", v),
  ),
  "registration.command": command(roadmapSchemas.registration, (ctx, v) =>
    roadmap.roadmapCommand(ctx, "registration", v),
  ),
  "catalog.command": command(roadmapSchemas.catalog, (ctx, v) =>
    roadmap.roadmapCommand(ctx, "catalog", v),
  ),
  "crm-automation.command": command(
    roadmapSchemas["crm-automation"],
    (ctx, v) => roadmap.roadmapCommand(ctx, "crm-automation", v),
  ),
  "progress.command": command(roadmapSchemas.progress, (ctx, v) =>
    roadmap.roadmapCommand(ctx, "progress", v),
  ),
  "communication.command": command(roadmapSchemas.communication, (ctx, v) =>
    roadmap.roadmapCommand(ctx, "communication", v),
  ),
  "communication.process": command(empty, (ctx) =>
    roadmap.processEmailQueue(ctx),
  ),
  "policies.save": command(policyCommandSchema, policies.savePolicy),
  "policies.exception": command(
    policyExceptionSchema,
    policies.applyPolicyException,
  ),
};
export function getCommand(name: string) {
  if (!Object.hasOwn(commands, name))
    throw new BackendError(404, "NOT_FOUND", "İşlem bulunamadı.");
  return commands[name as keyof typeof commands];
}
