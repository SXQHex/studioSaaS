"use client";
import { useState,type FormEvent } from "react";
import { useRouter,useSearchParams } from "next/navigation";
import Link from "next/link";
import {createClient} from "@/lib/supabase/client";
import { OperationsTable } from "./operations-table";
import { roadmapCommand,processEmailQueue } from "@/lib/actions/roadmap";
import { studioInputToIso } from "@/lib/studio-date";
export type RoadmapRow=Record<string,unknown>;export type RoadmapData=Record<string,RoadmapRow[]>;
type Field={key:string;label:string;type?:string;dataset?:string;choices?:string[];optional?:boolean;initial?:string};
const sel=(key:string,label:string,dataset:string):Field=>({key,label,dataset});
const txt=(key:string,label:string,type="text",initial?:string):Field=>({key,label,type,initial});
const choice=(key:string,label:string,choices:string[]):Field=>({key,label,choices});
const labels:Record<string,string>={create:"Oluştur",archive:"Satışı kapat",sell:"Paket sat",freeze:"Dondur",form:"Başvuru formu aç",toggle_form:"Form durumunu değiştir",trial:"Deneme sonucunu kaydet",assign:"Görev sorumlusu ata",retry:"Yeniden dene",publish:"Yeni kural sürümü yayımla",retire:"Kural sürümünü kapat",requirements:"Kayıt gereksinimlerini ayarla"};
const definitions:Record<string,Record<string,Field[]>>={
catalog:{
create:[sel("center_id","Merkez","centers"),txt("name","Paket adı"),choice("lesson_type","Ders türü",["private","group"]),txt("credits","Ders kredisi","number","4"),txt("price","Fiyat (TL)","number"),txt("validity_days","Geçerlilik (gün)","number","90"),txt("freeze_days","Toplam dondurma gün sınırı","number","0"),txt("freeze_count","Dondurma sayısı sınırı","number","0")],
sell:[sel("member_id","Öğrenci","members"),sel("catalog_id","Paket","catalog"),txt("starts_on","Başlangıç","date")],
archive:[sel("id","Paket","catalog")],
freeze:[sel("subscription_id","Satılan paket","subscriptions"),txt("starts_on","Dondurma başlangıcı","date"),txt("ends_on","Dondurma bitişi","date"),txt("note","Gerekçe")]},
"crm-automation":{
form:[sel("center_id","Merkez","centers"),txt("slug","Form adresi (küçük harf, rakam, tire)"),txt("title","Başvuru başlığı")],
toggle_form:[sel("id","Form","forms"),txt("active","Başvurulara açık","checkbox")],
trial:[sel("lead_id","Aday","leads"),choice("outcome","Deneme sonucu",["attended","cancelled","no_show"])],
assign:[sel("task_id","Görev","tasks"),sel("assigned_to","Sorumlu yönetici","managers")]},
progress:{create:[sel("member_id","Öğrenci","members"),choice("lesson_type","Ders türü",["private","group"]),txt("level","Seviye"),txt("skill","Beceri"),txt("score","Değerlendirme (1–5)","number","3"),txt("note","Değerlendirme notu","textarea"),txt("student_visible","Öğrenciye göster","checkbox")]},
communication:{retry:[sel("id","Başarısız gönderim","emails")]},
registration:{
publish:[{...sel("center_id","Merkez (organizasyon için boş bırakın)","centers"),optional:true},{key:"organization_id",label:"Organizasyon kimliği (merkez seçilmediyse)",optional:true},txt("title","Kural başlığı"),txt("body","Kural metni","textarea"),txt("required","Zorunlu kabul","checkbox","true")],
retire:[sel("policy_id","Kural sürümü","policies")],
requirements:[sel("center_id","Merkez","centers"),txt("emergency_contact","Acil iletişim gerekli","checkbox"),txt("document_required","Belge gerekli","checkbox")]}
};
const columnSets:Record<string,string[]>={catalog:["name","lesson_type","credits","price","validity_days","freeze_days","active"],subscriptions:["label","credits_remaining","ends_on","effective_ends_on","status"],freezes:["subscription_id","starts_on","ends_on","note"],forms:["title","slug","active"],leads:["full_name","source","trial_at","trial_outcome","stage"],tasks:["lead","title","due_at","assigned_to","completed_at"],progress:["member","lesson_type","level","skill","score","note","student_visible","created_at"],emails:["title","status","attempts","last_error","created_at","updated_at"],policies:["title","required","published_at"],members:["full_name","phone","missing"],documents:["title","member_id","created_at"]};
const sectionLabels:Record<string,string>={catalog:"Paket kataloğu",subscriptions:"Satılan paketler",freezes:"Dondurma geçmişi",forms:"Başvuru formları",leads:"Adaylar",tasks:"Takip görevleri",progress:"Gelişim geçmişi",emails:"E-posta teslimleri",policies:"Yayımlanan kurallar",members:"Kayıt eksikleri",documents:"Kayıt belgeleri"};
export function RoadmapWorkspace({module,title,data,loadError,canWrite=true}:{module:string;title:string;data:RoadmapData;loadError:boolean;canWrite?:boolean}){
 const router=useRouter();const params=useSearchParams();const ops=definitions[module]??{};
 const [action,setAction]=useState(params?.get("member_id")&&module==="catalog"?"sell":Object.keys(ops)[0]??"");const [values,setValues]=useState<Record<string,string>>(()=>({member_id:params?.get("member_id")??""}));
 const [key,setKey]=useState(()=>crypto.randomUUID());const [busy,setBusy]=useState(false);const [message,setMessage]=useState("");const [failed,setFailed]=useState(false);
 function start(a:string,row:RoadmapRow,section:string){setAction(a);setValues(section==="catalog"?{id:String(row.id),catalog_id:String(row.id)}:section==="subscriptions"?{subscription_id:String(row.id)}:section==="leads"?{lead_id:String(row.id)}:section==="tasks"?{task_id:String(row.id)}:{id:String(row.id)});setKey(crypto.randomUUID());document.getElementById("roadmap-form")?.scrollIntoView({behavior:"smooth"});}
 async function openDocument(path:string){setBusy(true);try{const {data,error}=await createClient().storage.from("registration-documents").createSignedUrl(path,60);if(error||!data)throw new Error();window.open(data.signedUrl,"_blank","noopener,noreferrer");}catch{setFailed(true);setMessage("Belge açılamadı.");}finally{setBusy(false);}}
 async function submit(e:FormEvent){e.preventDefault();setBusy(true);setMessage("");const input:Record<string,unknown>={action};
 for(const f of ops[action]??[]){const value=values[f.key]??f.initial??"";input[f.key]=f.type==="number"?Number(value):f.type==="checkbox"?value==="true":f.type==="datetime-local"?studioInputToIso(value):value;}
 if(module==="catalog"&&action==="sell")input.key=key;
 try{const r=await roadmapCommand(module,input);setFailed(!r.ok);setMessage(r.ok?r.message:r.error);if(r.ok){setKey(crypto.randomUUID());router.refresh();}}catch{setFailed(true);setMessage("İşlem tamamlanamadı.");}finally{setBusy(false);}
 }
 return <div className="dashboard-content"><div className="page-heading"><div><p className="eyebrow">STÜDYO</p><h1>{title}</h1></div></div>
 {loadError&&<p className="notice error" role="alert">Veriler yüklenemedi.</p>}
 {module==="catalog"&&<p>Kataloğa yalnızca sattığınız paketleri ekleyin. Satış koşulları korunur; yeni koşul için yeni paket oluşturun. Tahsilatı manuel tahsilat ekranından kaydedin.</p>}
 {module==="progress"&&<p>Bir ders türü ve küçük eğitmen grubuyla başlayın. 1: başlangıç, 3: uyguluyor, 5: bağımsız uyguluyor. Yalnızca öğrenciye göster seçilen değerlendirmeler öğrenci paneline yansır.</p>}
 {module==="communication"&&<button type="button" disabled={busy} onClick={async()=>{setBusy(true);try{const r=await processEmailQueue();setFailed(!r.ok);setMessage(r.ok?r.message:r.error);router.refresh();}finally{setBusy(false);}}}>Kuyruğu işle ve teslimleri kontrol et</button>}
 {canWrite&&Object.keys(ops).length>0&&<section className="form-card" id="roadmap-form"><form className="record-form" onSubmit={submit}><label>İşlem<select value={action} onChange={e=>{setAction(e.target.value);setValues({});setKey(crypto.randomUUID());}} disabled={busy}>{Object.keys(ops).map(a=><option key={a} value={a}>{labels[a]}</option>)}</select></label>
 <div className="field-grid">{(ops[action]??[]).map(f=>{const val=values[f.key]??f.initial??"";const options=(data[f.dataset??""]??[]).filter(row=>{
 if(f.dataset==="catalog"&&action==="sell"){const m=data.members?.find(m=>m.id===values.member_id);return row.active&&(!m||row.center_id===m.center_id);}
 if(f.dataset==="emails")return ["failed","retry"].includes(String(row.status));
 return true;
 });return <label key={f.key} htmlFor={module+action+f.key}>{f.label}{f.dataset||f.choices?<select id={module+action+f.key} required={!f.optional} value={val} disabled={busy} onChange={e=>setValues(v=>({...v,[f.key]:e.target.value}))}><option value="">Seçin</option>{f.choices?f.choices.map(c=><option key={c} value={c}>{({private:"Özel ders",group:"Grup dersi",attended:"Katıldı",cancelled:"İptal",no_show:"Gelmedi"} as Record<string,string>)[c]??c}</option>):options.map(o=><option key={String(o.id)} value={String(o.id)}>{String(o.label??o.name??o.title??o.full_name??o.id)}</option>)}</select>:f.type==="textarea"?<textarea id={module+action+f.key} value={val} required={!f.optional&&f.key!=="note"} maxLength={f.key==="body"?20000:2000} rows={5} onChange={e=>setValues(v=>({...v,[f.key]:e.target.value}))}/>:<input id={module+action+f.key} type={f.type??"text"} value={f.type==="checkbox"?undefined:val} checked={f.type==="checkbox"?val==="true":undefined} required={f.type!=="checkbox"&&!f.optional&&!(module==="progress"&&f.key==="note")} min={f.type==="number"?0:undefined} step={f.key==="price"?"0.01":f.type==="number"?"1":undefined} disabled={busy} onChange={e=>setValues(v=>({...v,[f.key]:f.type==="checkbox"?String(e.target.checked):e.target.value}))}/>}</label>;})}</div>
 <button type="submit" className="primary-action" disabled={busy||loadError}>{busy?"Kaydediliyor…":labels[action]}</button></form></section>}
 {message&&<p role={failed?"alert":"status"} className={"notice "+(failed?"error":"success")}>{message}</p>}
 {Object.entries(data).filter(([s])=>columnSets[s]).map(([section,rows])=><section className="table-card" key={section}><h2>{sectionLabels[section]}</h2><OperationsTable rows={rows} columns={columnSets[section]} actions={row=><>
 {section==="documents"&&<button type="button" disabled={busy} onClick={()=>openDocument(String(row.object_path))}>Belgeyi aç</button>}
 {section==="catalog"&&canWrite&&row.active&&<><button type="button" onClick={()=>start("sell",row,section)}>Sat</button><button type="button" onClick={()=>start("archive",row,section)}>Satışı kapat</button></>}
 {section==="subscriptions"&&module==="catalog"&&canWrite&&<><button type="button" onClick={()=>start("freeze",row,section)}>Dondur</button><Link href={"/dashboard/payments?action=collect&subscription_id="+String(row.id)}>Tahsilat</Link></>}
 {section==="forms"&&<Link href={"/apply/"+String(row.slug)}>Başvuru formunu aç</Link>}
 {section==="leads"&&module==="crm-automation"&&<button type="button" onClick={()=>start("trial",row,section)}>Deneme sonucu</button>}
 {section==="tasks"&&module==="crm-automation"&&<button type="button" onClick={()=>start("assign",row,section)}>Sorumlu ata</button>}
 {section==="emails"&&["failed","retry"].includes(String(row.status))&&<button type="button" onClick={()=>start("retry",row,section)}>Yeniden dene</button>}
 </>}/></section>)}
 </div>;
}
