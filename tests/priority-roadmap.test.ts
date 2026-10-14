import {describe,it,expect} from "vitest";
import {mergeIntervals,subtractIntervals,resourceUsage,weekDates} from "@/lib/planning";
import {roadmapSchemas} from "@/lib/validation/roadmap";
const id="b3000000-0000-4000-8000-000000000001";
describe("resource utilization",()=>{
 it("merges overlap and subtracts closed intervals once",()=>{expect(mergeIntervals([[1,5],[3,8],[10,12]])).toEqual([[1,8],[10,12]]);expect(subtractIntervals([[0,10]],[[2,4],[3,6]])).toEqual([[0,2],[6,10]]);});
 it("does not invent availability when hours are missing",()=>{const result=resourceUsage({days:weekDates("2026-10-12"),centerId:id,kind:"room",resourceId:"room",hours:[],blocks:[],lessons:[]});expect(result.ratio).toBeNull();expect(result.availableHours).toBeNull();});
 it("intersects center and resource hours, excludes closure and cancelled lessons",()=>{const days=weekDates("2026-10-12");const hours=days.flatMap((_,i)=>[{center_id:id,resource_kind:"center",weekday:i+1,opens:"09:00:00",closes:"18:00:00"},{center_id:id,resource_kind:"room",resource_id:"room",weekday:i+1,opens:"10:00:00",closes:"17:00:00"}]);const result=resourceUsage({days,centerId:id,kind:"room",resourceId:"room",hours,blocks:[{center_id:id,resource_kind:"center",kind:"closed",starts_at:"2026-10-12T12:00:00+03:00",ends_at:"2026-10-12T14:00:00+03:00"}],lessons:[{center_id:id,room_id:"room",status:"scheduled",starts_at:"2026-10-12T10:00:00+03:00",ends_at:"2026-10-12T11:00:00+03:00"},{center_id:id,room_id:"room",status:"cancelled",starts_at:"2026-10-12T11:00:00+03:00",ends_at:"2026-10-12T12:00:00+03:00"}]});expect(result.availableHours).toBe(47);expect(result.reservedHours).toBe(1);});
});
describe("roadmap server validation",()=>{
 it("rejects impossible scheduling and excessive package terms",()=>{expect(roadmapSchemas.planning.safeParse({action:"hours",center_id:id,resource_kind:"center",resource_id:"",weekday:1,opens:"18:00",closes:"09:00"}).success).toBe(false);expect(roadmapSchemas.catalog.safeParse({action:"create",center_id:id,name:"Bad",lesson_type:"group",credits:0,price:100,validity_days:30,freeze_days:0,freeze_count:0}).success).toBe(false);});
 it("requires explicit self acceptance identity",()=>{expect(roadmapSchemas.registration.safeParse({action:"accept",member_id:id}).success).toBe(false);});
});
