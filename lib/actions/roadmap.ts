"use server";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/supabase/access";
import { roadmapSchemas,type RoadmapModule } from "@/lib/validation/roadmap";
import type { Json } from "@/lib/supabase/database.types";
import { fail,ok,dbErrorMessage } from "./result";
export async function roadmapCommand(module:string,input:unknown){
 const schema=roadmapSchemas[module as RoadmapModule];if(!schema)return fail("Modül geçersiz.");
 const {supabase}=await requireRole(module==="registration"||module==="progress"?["student","instructor","admin"]:["admin"]);
 const parsed=schema.safeParse(input);if(!parsed.success)return fail(parsed.error.issues[0]?.message??"Bilgiler geçersiz.");
 const payload=Object.fromEntries(Object.entries(parsed.data).map(([k,v])=>[k,v===""&&["center_id","organization_id"].includes(k)?null:v]));
 const {error}=await supabase.rpc("roadmap_command",{p_module:module,p_data:payload as Json});
 if(error)return fail(dbErrorMessage(error,"İşlem tamamlanamadı."));
 for(const p of ["/dashboard/"+module,"/dashboard/lessons","/dashboard/members","/dashboard/my-learning","/dashboard/crm","/dashboard/payments","/dashboard/insights","/dashboard/planning"])revalidatePath(p);
 return ok("Kaydedildi.");
}
export async function processEmailQueue(){
 const {supabase}=await requireRole(["admin"]);
 const {data,error}=await supabase.functions.invoke("process-studio-email",{body:{}});
 revalidatePath("/dashboard/communication");
 return error||!data?.ok?fail("E-posta işlemi tamamlanamadı. Gönderim durumlarını kontrol edin."):ok("Kuyruk işlendi; teslim durumları güncellendi.");
}
