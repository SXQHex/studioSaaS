import { requireRole } from "@/lib/supabase/access";
import { OperationsWorkspace, type Snapshot } from "@/components/operations-workspace";
export const metadata={ title:"İptal, erteleme ve telafi | FTK Studio" };
export default async function Page(){
 const {supabase,profile}=await requireRole(["student"]);
 const {data,error}=await supabase.rpc("studio_workspace",{p_module:"lesson-operations"});
 return <OperationsWorkspace module="lesson-operations" title="İptal, erteleme ve telafi" data={(data&&typeof data==="object"&&!Array.isArray(data)?data:{}) as Snapshot} loadError={Boolean(error)} manager={profile.role==="admin"} instructor={profile.roles.includes("instructor")}/>;
}