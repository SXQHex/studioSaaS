import type { RoadmapRow } from "@/components/roadmap-workspace";
type Interval=[number,number];
export function mergeIntervals(items:Interval[]):Interval[]{const sorted=[...items].sort((a,b)=>a[0]-b[0]);const result:Interval[]=[];for(const [a,b] of sorted){const last=result.at(-1);if(last&&a<=last[1])last[1]=Math.max(last[1],b);else result.push([a,b]);}return result;}
export function subtractIntervals(items:Interval[],blocks:Interval[]):Interval[]{let result=mergeIntervals(items);for(const [a,b] of mergeIntervals(blocks)){result=result.flatMap(([s,e])=>b<=s||a>=e?[[s,e] as Interval]:[...(a>s?[[s,a] as Interval]:[]),...(b<e?[[b,e] as Interval]:[])]);}return result;}
export function weekDates(from:string){return Array.from({length:7},(_,i)=>{const d=new Date(from+"T12:00:00Z");d.setUTCDate(d.getUTCDate()+i);return d.toISOString().slice(0,10);});}
export function resourceUsage({days,centerId,kind,resourceId,hours,blocks,lessons}:{days:string[];centerId:string;kind:string;resourceId:string;hours:RoadmapRow[];blocks:RoadmapRow[];lessons:RoadmapRow[]}){
 let available=0;let complete=true;const start=Date.parse(days[0]+"T00:00:00+03:00"),end=Date.parse(days[6]+"T00:00:00+03:00")+86400000;
 for(const day of days){const weekday=((new Date(day+"T12:00:00Z").getUTCDay()+6)%7)+1;
 const center=hours.filter(h=>h.center_id===centerId&&h.resource_kind==="center"&&Number(h.weekday)===weekday);
 const own=hours.filter(h=>h.center_id===centerId&&h.resource_kind===kind&&h.resource_id===resourceId&&Number(h.weekday)===weekday);
 if(!center.length&&!own.length){complete=false;continue;}
 const intervals=(own.length?own:center).map(h=>[Date.parse(day+"T"+String(h.opens)+"+03:00"),Date.parse(day+"T"+String(h.closes)+"+03:00")] as Interval);
 let working=mergeIntervals(intervals);
 if(center.length&&own.length){const centers=mergeIntervals(center.map(h=>[Date.parse(day+"T"+String(h.opens)+"+03:00"),Date.parse(day+"T"+String(h.closes)+"+03:00")] as Interval));working=working.flatMap(([a,b])=>centers.map(([c,d])=>[Math.max(a,c),Math.min(b,d)] as Interval).filter(([a,b])=>b>a));}
 const blocked=blocks.filter(b=>b.center_id===centerId&&b.kind==="closed"&&(b.resource_kind==="center"||(b.resource_kind===kind&&b.resource_id===resourceId))).map(b=>[Date.parse(String(b.starts_at)),Date.parse(String(b.ends_at))] as Interval);
 available+=subtractIntervals(working,blocked).reduce((n,[a,b])=>n+b-a,0);
 }
 const reserved=mergeIntervals(lessons.filter(l=>l.center_id===centerId&&l[kind==="room"?"room_id":"instructor_id"]===resourceId&&["scheduled","completed"].includes(String(l.status))).map(l=>[Math.max(start,Date.parse(String(l.starts_at))),Math.min(end,Date.parse(String(l.ends_at)))] as Interval).filter(([a,b])=>b>a)).reduce((n,[a,b])=>n+b-a,0);
 return {availableHours:complete?available/3600000:null,reservedHours:reserved/3600000,ratio:complete&&available>0?reserved/available*100:null};
}
