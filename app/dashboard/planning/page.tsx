import { requireRole } from "@/lib/supabase/access";
import type {RoadmapData} from "@/components/roadmap-workspace";
import { PlanningWorkspace } from "@/components/planning-workspace";
export const metadata={title:"Birleşik planlama | FTK Studio"};
export default async function Page({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
 const {supabase,profile,userId}=await requireRole(["admin"]);
 const params=await searchParams;
 const today=new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/Istanbul",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
 let from=typeof params.from==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(params.from)?params.from:today;
 let to=typeof params.to==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(params.to)?params.to:today;
 const d=new Date(from+"T12:00:00Z");if(Number.isNaN(d.valueOf()))return <p>Geçerli tarih seçin.</p>;d.setUTCDate(d.getUTCDate()-((d.getUTCDay()+6)%7));from=d.toISOString().slice(0,10);d.setUTCDate(d.getUTCDate()+6);to=d.toISOString().slice(0,10);
 const {data,error}=await supabase.rpc("roadmap_workspace",{p_module:"planning",p_from:from,p_to:to});
 const snapshot=(data&&typeof data==="object"&&!Array.isArray(data)?data:{}) as RoadmapData;
 const manager=profile.roles.some(r=>["appowner","owner","admin"].includes(r));
 return <PlanningWorkspace data={snapshot} from={from} loadError={Boolean(error)}/>;
}
