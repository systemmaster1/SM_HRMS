"use client";
import {useCallback,useEffect,useState} from "react";
import {createClient} from "@/lib/supabase/client";
import {toast} from "@/components/Dialogs";
import {card,btnPrimary,btnGhost,fmtDateTime,Chip,inputCls} from "./shared";
import {ExternalLink,LifeBuoy,CalendarClock,RefreshCw} from "lucide-react";
import { friendlyError } from "@/lib/errors";

const TS=["open","in_progress","on_hold","resolved","closed"];
const MS=["requested","confirmed","rescheduled","completed","cancelled"];

export default function SupportCenterTab({onOpenOrg}:{onOpenOrg:(id:string)=>void}){
 const supabase=createClient(); const [tickets,setTickets]=useState<any[]>([]); const [meetings,setMeetings]=useState<any[]>([]);
 const [loading,setLoading]=useState(true); const [ticketStatus,setTicketStatus]=useState(""); const [meetingStatus,setMeetingStatus]=useState("");
 const load=useCallback(async()=>{setLoading(true);const [t,m]=await Promise.all([
  supabase.rpc("system_admin_support_tickets",{p_status:ticketStatus||null}),
  supabase.rpc("system_admin_support_meetings",{p_status:meetingStatus||null})
 ]);setLoading(false);if(t.error)toast(friendlyError(t.error),"error");else setTickets((t.data as any[])||[]);
 if(m.error)toast(friendlyError(m.error),"error");else setMeetings((m.data as any[])||[]);},[supabase,ticketStatus,meetingStatus]);
 useEffect(()=>{load()},[load]);
 const updateTicket=async(r:any,patch:any)=>{const {error}=await supabase.rpc("system_admin_update_support_ticket",{
  p_ticket:r.id,p_status:patch.status??null,p_priority:patch.priority??null,p_plan:patch.plan??null,p_target_date:patch.target_date??null});
  if(error)return toast(friendlyError(error),"error");toast("Ticket updated.");load();};
 const updateMeeting=async(r:any,patch:any)=>{
  const {data:{session}}=await supabase.auth.getSession(); if(!session)return toast("Session expired. Please sign in again.","error");
  const res=await fetch("/api/system-admin/support-meeting",{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${session.access_token}`},body:JSON.stringify({meetingId:r.id,status:patch.status,meetingUrl:patch.meeting_url,notes:patch.internal_notes})});
  const data=await res.json(); if(!res.ok)return toast(data.error||"Meeting update failed.","error");
  toast(data.emailError?"Meeting updated, but email could not be sent.":"Meeting updated and client notified."); load();
 };
 const open=tickets.filter(x=>["open","in_progress"].includes(x.status)).length;
 const upcoming=meetings.filter(x=>!["completed","cancelled"].includes(x.status)&&new Date(x.ends_at)>=new Date()).length;
 return <div className="space-y-6">
  <div className="grid gap-3 sm:grid-cols-3">
   <div className={card+" p-5"}><p className="text-xs font-semibold uppercase text-slate-400">Open support</p><p className="mt-2 text-3xl font-bold">{open}</p></div>
   <div className={card+" p-5"}><p className="text-xs font-semibold uppercase text-slate-400">Upcoming meetings</p><p className="mt-2 text-3xl font-bold">{upcoming}</p></div>
   <button onClick={load} className={card+" flex items-center justify-center gap-2 p-5 text-sm font-semibold"}><RefreshCw className="h-4 w-4"/>Refresh center</button>
  </div>
  <section className="space-y-3">
   <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="flex items-center gap-2 font-bold"><LifeBuoy className="h-5 w-5"/>Help Desk</h3>
    <select className={inputCls+" !w-auto"} value={ticketStatus} onChange={e=>setTicketStatus(e.target.value)}><option value="">All statuses</option>{TS.map(x=><option key={x}>{x}</option>)}</select></div>
   <div className={card+" overflow-hidden"}>{loading?<p className="p-5 text-sm text-slate-400">Loading…</p>:tickets.length===0?<p className="p-5 text-sm text-slate-500">No support tickets.</p>:
    <div className="divide-y divide-slate-100 dark:divide-slate-700">{tickets.map(r=><div key={r.id} className="p-5">
     <div className="flex flex-wrap items-start justify-between gap-3"><div><button onClick={()=>onOpenOrg(r.company_id)} className="text-xs font-bold text-brand-700 hover:underline">{r.org_name} · {r.org_code}</button>
      <p className="mt-1 font-semibold">#{r.ticket_no} · {r.subject}</p><p className="mt-1 max-w-3xl text-sm text-slate-500">{r.description||"No description"}</p>
      <p className="mt-2 text-xs text-slate-400">{r.raised_by_name||"User"} · {r.raised_by_email||""} · {fmtDateTime(r.created_at)}</p></div>
      <div className="flex gap-2"><Chip tone={r.priority==="urgent"?"red":r.priority==="high"?"amber":"slate"}>{r.priority}</Chip><Chip tone={r.status==="resolved"||r.status==="closed"?"green":"blue"}>{r.status}</Chip></div></div>
     <div className="mt-4 flex flex-wrap gap-2"><select className={inputCls+" !w-auto"} value={r.status} onChange={e=>updateTicket(r,{status:e.target.value})}>{TS.map(x=><option key={x}>{x}</option>)}</select>
      <select className={inputCls+" !w-auto"} value={r.priority} onChange={e=>updateTicket(r,{priority:e.target.value})}>{["low","medium","high","urgent"].map(x=><option key={x}>{x}</option>)}</select></div>
    </div>)}</div>}</div>
  </section>
  <section className="space-y-3"><div className="flex flex-wrap items-center justify-between gap-2"><h3 className="flex items-center gap-2 font-bold"><CalendarClock className="h-5 w-5"/>Support Meetings</h3>
   <select className={inputCls+" !w-auto"} value={meetingStatus} onChange={e=>setMeetingStatus(e.target.value)}><option value="">All statuses</option>{MS.map(x=><option key={x}>{x}</option>)}</select></div>
   <div className={card+" overflow-hidden"}>{meetings.length===0?<p className="p-5 text-sm text-slate-500">No meetings scheduled.</p>:<div className="divide-y divide-slate-100 dark:divide-slate-700">{meetings.map(r=><div key={r.id} className="p-5">
    <div className="flex flex-wrap justify-between gap-3"><div><button onClick={()=>onOpenOrg(r.company_id)} className="text-xs font-bold text-brand-700 hover:underline">{r.org_name} · {r.org_code}</button><p className="mt-1 font-semibold">{r.title}</p>
    <p className="mt-1 text-sm text-slate-500">{fmtDateTime(r.starts_at)} – {fmtDateTime(r.ends_at)} · {r.attendee_name||r.requested_by_name||"Client"}</p>{r.ticket_no&&<p className="mt-1 text-xs text-slate-400">Ticket #{r.ticket_no}</p>}</div><Chip tone={r.status==="confirmed"?"green":r.status==="cancelled"?"red":"blue"}>{r.status}</Chip></div>
    <div className="mt-4 flex flex-wrap gap-2"><select className={inputCls+" !w-auto"} value={r.status} onChange={e=>updateMeeting(r,{status:e.target.value})}>{MS.map(x=><option key={x}>{x}</option>)}</select>
    {r.meeting_url?<a className={btnPrimary} href={r.meeting_url} target="_blank" rel="noreferrer"><ExternalLink className="h-4 w-4"/>Join meeting</a>:<button className={btnGhost} onClick={async()=>{const u=window.prompt("Paste Google Meet / meeting URL");if(u)updateMeeting(r,{meeting_url:u})}}>Add meeting link</button>}</div>
   </div>)}</div>}</div>
  </section>
 </div>
}