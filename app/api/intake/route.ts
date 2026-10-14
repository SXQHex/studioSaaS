import {createClient} from "@/lib/supabase/server";
export async function POST(req:Request){try{
 if(Number(req.headers.get("content-length")??0)>8000)return Response.json({ok:false},{status:413});
 const text=await req.text();if(text.length>8000)return Response.json({ok:false},{status:413});
 const body=JSON.parse(text);const supabase=await createClient();const {data,error}=await supabase.functions.invoke("studio-intake",{body});
 return Response.json(error?{ok:false,error:"Başvuru alınamadı. Daha sonra deneyin."}:data,{status:error?429:200});
 }catch{return Response.json({ok:false},{status:400});}}
