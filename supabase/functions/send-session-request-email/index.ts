import {createClient} from "npm:@supabase/supabase-js@2.117.3";
Deno.serve(async(req:Request)=>{
 if(req.method!=="POST")return new Response("Method not allowed",{status:405});
 const url=Deno.env.get("SUPABASE_URL"),key=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
 const auth=req.headers.get("Authorization");if(!url||!key||!auth?.startsWith("Bearer "))return new Response("Unauthorized",{status:401});
 const db=createClient(url,key,{auth:{persistSession:false}});
 const {data,error}=await db.auth.getUser(auth.slice(7));if(error||!data.user)return new Response("Unauthorized",{status:401});
 // Notification and its outbox record were committed atomically by the request RPC.
 // The scheduled worker sends them. Never send an additional email from this compatibility endpoint.
 return new Response(JSON.stringify({ok:true,queued:true}),{headers:{"Content-Type":"application/json"}});
});
