"use server";
import { revalidatePath } from "next/cache";
import type { Json } from "@/lib/supabase/database.types";
import { requireRole } from "@/lib/supabase/access";
import { dbErrorMessage, fail, ok, parseInput } from "@/lib/actions/result";
import { groupsOperation, paymentsOperation, lessonOperation, crmOperation } from "@/lib/validation/operations";

export async function runOperation(module: string,input: unknown) {
 const schema = module==="groups" ? groupsOperation : module==="payments" ? paymentsOperation : module==="lesson-operations" ? lessonOperation : module==="crm" ? crmOperation : null;
 if(!schema) return fail("Modül geçersiz.");
 const { supabase } = await requireRole(module==="lesson-operations" ? ["student"] : ["admin"]);
 const parsed = parseInput(schema,input);
 if(parsed.failure) return parsed.failure;
 const name = module==="groups" ? (["waitlist","dequeue","promote"].includes(parsed.data.action) ? "waitlist_command" : "groups_command") : module==="payments" ? "payments_command" : module==="lesson-operations" ? "lesson_command" : "crm_command";
 const { error } = await supabase.rpc(name,{ p_data:parsed.data as Json });
 if(error) return fail(dbErrorMessage(error,"İşlem tamamlanamadı. Bilgileri ve oda/eğitmen çakışmalarını kontrol edin."));
 for(const path of ["/dashboard/"+module,"/dashboard/my-learning","/dashboard/my-students","/dashboard/lessons","/dashboard/subscriptions","/dashboard/credits","/dashboard/reports","/dashboard/members","/dashboard/notifications"]) revalidatePath(path);
 return ok("İşlem kaydedildi.");
}
