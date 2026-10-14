import {createClient} from "npm:@supabase/supabase-js@2.117.3";
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{"Content-Type":"application/json"}});
Deno.serve(async(req:Request)=>{
 if(req.method!=="POST")return json({ok:false},405);
 if(Number(req.headers.get("content-length")??0)>8000)return json({ok:false},413);
 let body:Record<string,unknown>;try{const text=await req.text();if(text.length>8000)return json({ok:false},413);body=JSON.parse(text);}catch{return json({ok:false},400);}
 if(typeof body.slug!=="string"||! /^[a-z0-9-]{3,60}$/.test(body.slug))return json({ok:false},400);
 const url=Deno.env.get("SUPABASE_URL"),key=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");if(!url||!key)return json({ok:false},503);
 const db=createClient(url,key,{auth:{persistSession:false}});
 if(body.action==="info"){const {data,error}=await db.rpc("crm_intake_info",{p_slug:body.slug});return json(error||!data?{ok:false}:{ok:true,form:data},error||!data?404:200);}
 const data=body.data as Record<string,unknown>|null;
 if(!data||data.website||typeof data.full_name!=="string"||data.full_name.trim().length<2||data.full_name.length>160||typeof data.email!=="string"||typeof data.phone!=="string"||(!data.email&&!data.phone)||data.email.length>320||data.phone.length>40||typeof data.interests!=="string"||data.interests.length>2000||typeof data.marketing_opt_in!=="boolean")return json({ok:false},400);
 if(data.email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email))return json({ok:false},400);
 const ip=req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()??"unknown";
 const digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(ip));const hash=Array.from(new Uint8Array(digest)).map(b=>b.toString(16).padStart(2,"0")).join("");
 const {error}=await db.rpc("crm_intake_limited",{p_slug:body.slug,p_data:data,p_ip_hash:hash});
 return json(error?{ok:false,error:"Başvuru alınamadı. Bilgilerinizi kontrol edip daha sonra deneyin."}:{ok:true},error?429:200);
});
