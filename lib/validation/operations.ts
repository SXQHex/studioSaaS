import { z } from "zod";
const id = z.string().uuid();
const note = z.string().trim().min(1, "Açıklama zorunlu.").max(500);
const time = z.string().datetime();
export const groupsOperation = z.discriminatedUnion("action", [
 z.object({ action:z.literal("create"),center_id:id,room_id:id,instructor_id:id,name:z.string().trim().min(1).max(160),capacity:z.number().int().min(1).max(500),weeks:z.number().int().min(1).max(52),starts_at:time,ends_at:time }),
 z.object({ action:z.enum(["enroll","unenroll","waitlist","dequeue"]),group_id:id,member_id:id }),
 z.object({ action:z.literal("promote"),group_id:id }),
]);
export const paymentsOperation = z.discriminatedUnion("action", [
 z.object({ action:z.enum(["collect","refund"]),subscription_id:id,amount:z.number().positive().max(9999999999).refine(n=>Math.abs(n*100-Math.round(n*100))<0.000001,"En fazla iki ondalık kullanın."),key:id,occurred_at:time,note }),
 z.object({ action:z.literal("reverse"),subscription_id:id,entry_id:id,key:id,occurred_at:time,note }),
]);
export const lessonOperation = z.discriminatedUnion("action", [
 z.object({ action:z.literal("policy"),center_id:id,hours:z.number().int().min(0).max(168) }),
 z.object({ action:z.enum(["student_cancel","no_show"]),lesson_id:id,member_id:id,note }),
 z.object({ action:z.literal("cancel"),lesson_id:id,note }),
 z.object({ action:z.enum(["reschedule","makeup"]),lesson_id:id,starts_at:time,ends_at:time,note }),
]);
export const crmOperation = z.discriminatedUnion("action", [
 z.object({ action:z.literal("create"),center_id:id,full_name:z.string().trim().min(2).max(160),email:z.union([z.string().email(),z.literal("")]),phone:z.string().max(40),source:z.string().trim().min(1).max(160),interests:z.string().max(2000),notes:z.string().max(2000) }).refine(v=>v.email||v.phone,"E-posta veya telefon girin."),
 z.object({ action:z.literal("update"),lead_id:id,stage:z.enum(["new","contacted","trial","followup","lost"]),trial_at:z.union([time,z.literal("")]),interests:z.string().max(2000),notes:z.string().max(2000) }),
 z.object({ action:z.literal("task"),lead_id:id,title:z.string().trim().min(1).max(160),due_at:time }),
 z.object({ action:z.literal("complete_task"),lead_id:id,task_id:id }),
 z.object({ action:z.literal("convert"),lead_id:id }),
]);
export const reportRange = z.object({ from:z.string().date(),to:z.string().date() }).refine(v=>v.to>=v.from,"Bitiş tarihi başlangıçtan önce olamaz.");
