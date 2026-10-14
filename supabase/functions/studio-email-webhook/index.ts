import {createClient} from "npm:@supabase/supabase-js@2.117.3";
import {Webhook} from "npm:svix@2.8.0";
const json=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{"Content-Type":"application/json"}});
Deno.serve(async(req:Request)=>{
 if(req.method!=="POST")return json({ok:false},405);
 const url=Deno.env.get("SUPABASE_URL"),key=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");if(!url||!key)return json({ok:false},503);
 const db=createClient(url,key,{auth:{persistSession:false}});
 const config=await db.rpc("studio_email_credentials");const secret=Deno.env.get("RESEND_WEBHOOK_SECRET")??config.data?.webhook_key;
 if(!secret)return json({ok:false},503);
 const text=await req.text();if(text.length>65536)return json({ok:false},413);
 let event:{type:string;created_at:string;data:{email_id:string}};
 try{new Webhook(secret).verify(text,{"svix-id":req.headers.get("svix-id")??"","svix-timestamp":req.headers.get("svix-timestamp")??"","svix-signature":req.headers.get("svix-signature")??""});event=JSON.parse(text);}catch{return json({ok:false},401);}
 if(!["email.delivered","email.bounced","email.complained","email.failed"].includes(event.type))return json({ok:true});
 if(!event.data?.email_id||!event.created_at)return json({ok:false},400);
 const {error}=await db.rpc("studio_email_event",{p_event_id:req.headers.get("svix-id"),p_provider:event.data.email_id,p_type:event.type,p_occurred_at:event.created_at});
 return json({ok:!error},error?503:200);
});
