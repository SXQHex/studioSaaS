import { requireRole } from "@/lib/supabase/access";
import type {RoadmapData} from "@/components/roadmap-workspace";
import { RoadmapWorkspace } from "@/components/roadmap-workspace";
import { RegistrationSelf } from "@/components/registration-self";
export const metadata={title:"Dijital kayıt | FTK Studio"};
export default async function Page({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
 const {supabase,profile,userId}=await requireRole(["student","instructor","admin"]);
 const params=await searchParams;
 const today=new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/Istanbul",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
 let from=typeof params.from==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(params.from)?params.from:today;
 let to=typeof params.to==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(params.to)?params.to:today;
 
 const {data,error}=await supabase.rpc("roadmap_workspace",{p_module:"registration",p_from:from,p_to:to});
 const snapshot=(data&&typeof data==="object"&&!Array.isArray(data)?data:{}) as RoadmapData;
 const manager=profile.roles.some(r=>["appowner","owner","admin"].includes(r));
 return <><RoadmapWorkspace module="registration" title="Dijital kayıt" data={snapshot} loadError={Boolean(error)} canWrite={manager}/><div className="dashboard-content"><RegistrationSelf data={snapshot} userId={userId}/></div></>;
}
