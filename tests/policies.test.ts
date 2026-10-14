import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe,it,expect,vi } from "vitest";
vi.mock("next/navigation",()=>({useRouter:()=>({refresh:vi.fn()})}));
vi.mock("@/lib/actions/policies",()=>({savePolicy:vi.fn(),applyPolicyException:vi.fn()}));
import { PolicySettings } from "@/app/dashboard/settings/policy-settings";
import { policyCommandSchema,policyExceptionSchema,type PolicyWorkspace } from "@/lib/policies";
const id="b3000000-0000-4000-8000-000000000001";
const data:PolicyWorkspace={definitions:[{key:"private_cancel_hours",label:"Özel ders iptal süresi",category:"İptal",kind:"number",default_value:12,min_value:0,max_value:168}],organizations:[{id,name:"Organizasyon",can_edit:false}],centers:[{id,name:"Merkez",organization_id:id,effective:{private_cancel_hours:{value:12,source:"organization_mandatory",mode:"mandatory",organization_revision:1,center_revision:0,min:6,max:24,override_stored:null,override_active:false}}}],organization_policies:[],history:[],exceptions:[],exception_participants:[]};
describe("policy settings screen",()=>{
 it("shows mandatory source and blocks center editing",()=>{
  const html=renderToStaticMarkup(createElement(PolicySettings,{data}));
  expect(html).toContain("Organizasyon zorunlu");expect(html).toContain("disabled");expect(html).not.toContain(">Kaydet<");
 });
 it("shows a recommendation with a editable bounded value",()=>{
  const c={...data.centers[0],effective:{private_cancel_hours:{...data.centers[0].effective.private_cancel_hours,mode:"recommended" as const,source:"organization_default"}}};
  const html=renderToStaticMarkup(createElement(PolicySettings,{data:{...data,centers:[c]}}));
  expect(html).toContain('min="6"');expect(html).toContain('max="24"');expect(html).toContain(">Kaydet<");
 });
 it("does not show an owner-only exception operation to center admins",()=>{
  expect(renderToStaticMarkup(createElement(PolicySettings,{data}))).not.toContain("İstisnayla işlemi uygula");
 });
});
describe("policy command input",()=>{
 it("requires scope, value, mode and an explanation for an organizational edit",()=>{
  const p={action:"organization",organization_id:id,key:"private_cancel_hours",value:12,mode:"mandatory",expected_revision:0,reason:"İptal kuralı"};
  expect(policyCommandSchema.safeParse(p).success).toBe(true);
  expect(policyCommandSchema.safeParse({...p,reason:""}).success).toBe(false);
  expect(policyCommandSchema.safeParse({...p,mode:undefined}).success).toBe(false);
 });
 it("rejects inverted bounds and unknown exception overrides",()=>{
  expect(policyCommandSchema.safeParse({action:"center",center_id:id,key:"private_cancel_hours",value:12,min:24,max:6,expected_revision:0,reason:"Kural"}).success).toBe(false);
  expect(policyExceptionSchema.safeParse({lesson_id:id,member_id:id,operation:"student_cancel",overrides:{room_capacity:999},reason:"Bypass"}).success).toBe(false);
 });
});
