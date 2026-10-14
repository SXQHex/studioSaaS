import { requireRole } from "@/lib/supabase/access";
import { OperationsWorkspace, type Snapshot } from "@/components/operations-workspace";
export const metadata={ title:"Pazarlama CRM | FTK Studio" };
export default async function Page(){
 const {supabase,profile}=await requireRole(["admin"]);
 const {data,error}=await supabase.rpc("studio_workspace",{p_module:"crm"});
 return <OperationsWorkspace module="crm" title="Pazarlama CRM" data={(data&&typeof data==="object"&&!Array.isArray(data)?data:{}) as Snapshot} loadError={Boolean(error)} manager={profile.role==="admin"} instructor={profile.roles.includes("instructor")}/>;
}