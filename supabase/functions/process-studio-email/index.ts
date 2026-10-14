import {createClient} from "npm:@supabase/supabase-js@2.117.3";
const json=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{"Content-Type":"application/json"}});
Deno.serve(async(req:Request)=>{
 if(req.method!=="POST")return json({ok:false},405);
 const url=Deno.env.get("SUPABASE_URL"),key=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),api=Deno.env.get("RESEND_API_KEY");
 if(!url||!key||!api)return json({ok:false,error:"not_configured"},503);
 const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
 let centers:string[]|null=null;
 const token=req.headers.get("x-studio-worker-token");
 if(token){
 const {data,error}=await db.rpc("verify_email_worker",{p_token:token});if(error||!data)return json({ok:false},401);
 }else{
 const auth=req.headers.get("Authorization");if(!auth?.startsWith("Bearer "))return json({ok:false},401);
 const {data:user,error}=await db.auth.getUser(auth.slice(7));if(error||!user.user)return json({ok:false},401);
 const caller=createClient(url,key,{global:{headers:{Authorization:auth}},auth:{persistSession:false}});
 const scope=await caller.rpc("email_work_scope");if(scope.error||!scope.data?.length)return json({ok:false},403);centers=scope.data;
 }
 // Reconcile with provider status as a fallback when webhook configuration is unavailable.
 const receipts=await db.rpc("pending_email_receipts",{p_centers:centers});
 for(const row of (receipts.data??[]).slice(0,10)){
 try{
 const response=await fetch("https://api.resend.com/emails/"+encodeURIComponent(row.provider_id),{headers:{Authorization:"Bearer "+api},signal:AbortSignal.timeout(10000)});
 if(response.ok){const result=await response.json();const event=String(result.last_event??"");
 if(["delivered","bounced","complained","failed"].includes(event))await db.rpc("studio_email_event",{p_event_id:"poll:"+row.provider_id+":"+event,p_provider:row.provider_id,p_type:"email."+event,p_occurred_at:result.created_at??new Date().toISOString()});}
 }catch{/* keep sent until a later reconciliation succeeds */}
 }
 const claimed=await db.rpc("claim_studio_emails",{p_centers:centers});if(claimed.error)return json({ok:false},503);
 let sent=0,failed=0;
 for(const row of claimed.data??[]){
 let state="failed",provider:string|null=null,error:string|null=null;
 try{
 // Read current state after claim; cancelled reminders must never be sent by a stale lease.
 const {data:current}=await db.from("studio_email_outbox").select("status,lease_token").eq("id",row.id).single();
 if(current?.status!=="processing"||current.lease_token!==row.lease_token)continue;
 if(!row.email)throw new Error("no_email");
 const link=new URL(row.href??"/dashboard/notifications",Deno.env.get("STUDIO_APP_URL")??"https://uye.fethiyetango.com").toString();
 const response=await fetch("https://api.resend.com/emails",{method:"POST",headers:{Authorization:"Bearer "+api,"Content-Type":"application/json","Idempotency-Key":"studio-notification/"+row.id},body:JSON.stringify({from:Deno.env.get("RESEND_FROM_EMAIL")??"FTK Studio <bildirim@fethiyetango.com>",to:[row.email],subject:row.title,text:row.body+"\n\nGüncel bilgileri görüntüle: "+link}),signal:AbortSignal.timeout(10000)});
 const result=await response.json().catch(()=>({}));
 if(response.ok&&result.id){state="sent";provider=result.id;sent++;}
 else{state=response.status===429||response.status>=500?"retry":"failed";error="Provider HTTP "+response.status;failed++;}
 }catch(e){state=e instanceof Error&&e.message==="no_email"?"failed":"retry";error=state==="failed"?"Recipient email unavailable":"Temporary network failure";failed++;}
 const result=await db.rpc("finish_studio_email",{p_id:row.id,p_lease:row.lease_token,p_status:state,p_provider:provider,p_error:error});
 if(result.error)return json({ok:false,error:"persistence_failed"},503);
 }
 return json({ok:true,sent,failed});
});
