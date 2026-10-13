import { describe,expect,it } from "vitest";
import { groupsOperation,paymentsOperation,lessonOperation,crmOperation,reportRange } from "@/lib/validation/operations";
import { csvCell,toCsv } from "@/lib/csv";
const id="b1000000-0000-4000-8000-000000000001";
describe("roadmap operation inputs",()=>{
 it("bounds recurring programme size and capacity",()=>{
  const p={action:"create",center_id:id,room_id:id,instructor_id:id,name:"Grup",capacity:10,weeks:4,starts_at:"2026-11-01T16:00:00Z",ends_at:"2026-11-01T17:00:00Z"};
  expect(groupsOperation.safeParse(p).success).toBe(true);
  expect(groupsOperation.safeParse({...p,weeks:53}).success).toBe(false);
  expect(groupsOperation.safeParse({...p,capacity:0}).success).toBe(false);
 });
 it("requires positive currency, precision, identity and receipt note",()=>{
  const p={action:"collect",subscription_id:id,amount:10.25,key:id,occurred_at:"2026-10-13T16:00:00Z",note:"Nakit"};
  expect(paymentsOperation.safeParse(p).success).toBe(true);
  for(const patch of [{amount:-1},{amount:0},{amount:10.001},{key:"bad"},{note:" "}])expect(paymentsOperation.safeParse({...p,...patch}).success).toBe(false);
 });
 it("requires outcomes to specify a participant and explanation",()=>{
  expect(lessonOperation.safeParse({action:"no_show",lesson_id:id,member_id:id,note:"Gelmedi"}).success).toBe(true);
  expect(lessonOperation.safeParse({action:"no_show",lesson_id:id,note:"Gelmedi"}).success).toBe(false);
  expect(lessonOperation.safeParse({action:"policy",center_id:id,hours:-1}).success).toBe(false);
 });
 it("requires contactable leads and cannot mark conversion with a stage update",()=>{
  const p={action:"create",center_id:id,full_name:"Aday Kullanıcı",email:"",phone:"",source:"Instagram",interests:"",notes:""};
  expect(crmOperation.safeParse(p).success).toBe(false);
  expect(crmOperation.safeParse({...p,phone:"5551234567"}).success).toBe(true);
  expect(crmOperation.safeParse({action:"update",lead_id:id,stage:"converted",trial_at:"",interests:"",notes:""}).success).toBe(false);
 });
 it("validates report date ordering and actual calendar dates",()=>{
  expect(reportRange.safeParse({from:"2026-10-01",to:"2026-10-31"}).success).toBe(true);
  expect(reportRange.safeParse({from:"2026-10-31",to:"2026-10-01"}).success).toBe(false);
  expect(reportRange.safeParse({from:"2026-02-30",to:"2026-03-01"}).success).toBe(false);
 });
});
describe("complete and spreadsheet-safe CSV",()=>{
 it("escapes quotes and prevents formula execution in untrusted text",()=>{
  expect(csvCell('=HYPERLINK("bad")')).toBe('"\'=HYPERLINK(""bad"")"');
  expect(csvCell(" +1")).toBe('"\' +1"');
  expect(csvCell(-100)).toBe('"-100"');
 });
 it("exports every row and columns absent from the first row",()=>{
  const rows=Array.from({length:1003},(_,i)=>({name:"Record "+i,...(i===1002?{note:"Final row"}:{})}));
  const csv=toCsv(rows);
  expect(csv.split("\r\n")).toHaveLength(1004);
  expect(csv).toContain("Final row");
  expect(csv).toContain('"note"');
 });
});
