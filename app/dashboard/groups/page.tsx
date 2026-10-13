import { requireRole } from "@/lib/supabase/access";
import { OperationsWorkspace, type Snapshot } from "@/components/operations-workspace";
export const metadata={ title:"Grup programları | FTK Studio" };
export default async function Page(){
 const {supabase,profile}=await requireRole(["admin"]);
 const {data,error}=await supabase.rpc("studio_workspace",{p_module:"groups"});
 return <OperationsWorkspace module="groups" title="Grup programları" data={(data&&typeof data==="object"&&!Array.isArray(data)?data:{}) as Snapshot} loadError={Boolean(error)} manager={profile.role==="admin"} instructor={profile.roles.includes("instructor")}/>;
}