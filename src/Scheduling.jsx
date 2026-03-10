// ============================================================
// FireSafe Pro — Planification (Scheduling)
// ============================================================
import React, { useState, useEffect, useCallback } from "react";

const C = {
  flame:"#FF4500", flameLight:"#FF6A33", ember:"#FF8C00",
  ash:"#1A1A1A", smoke:"#2A2A2A", steel:"#3A3A3A",
  mist:"#8A8A8A", frost:"#E8E8E8", white:"#FAFAFA",
  safe:"#22C55E", warn:"#F59E0B", danger:"#EF4444", info:"#3B82F6",
};
const TRADE_COLOR = { fire_alarm:C.flame, sprinkler:C.info, extinguisher:C.safe, special_hazard:C.warn, fire_door:C.mist, facilities:C.ember, backflow:"#a855f7" };
const TRADE_FR    = { fire_alarm:"Alarme incendie", sprinkler:"Sprinkleur", extinguisher:"Extincteur", special_hazard:"Risque spécial", fire_door:"Porte coupe-feu", facilities:"Installations", backflow:"Anti-retour" };
const STATUS_FR   = { scheduled:"Planifié", confirmed:"Confirmé", in_progress:"En cours", completed:"Terminé", cancelled:"Annulé", rescheduled:"Reprogrammé" };
const STATUS_COL  = { scheduled:C.mist, confirmed:C.info, in_progress:C.ember, completed:C.safe, cancelled:C.danger, rescheduled:C.warn };
const RECUR_FR    = { one_time:"Ponctuel", monthly:"Mensuel", quarterly:"Trimestriel", semi_annual:"Semestriel", annual:"Annuel" };
const DAYS        = ["Lun","Mar","Mer","Jeu","Ven","Sam","Dim"];

const isoDate = d => d.toISOString().split("T")[0];

// ─── API HELPERS ──────────────────────────────────────────────────────────────
const apiFetch = async (url, anonKey, jwt, path, opts={}) => {
  const res = await fetch(`${url}/rest/v1/${path}`, {
    headers: { "apikey":anonKey, "Authorization":`Bearer ${jwt}`, "Content-Type":"application/json", "Prefer":"return=representation" },
    ...opts,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(text);
  return text ? JSON.parse(text) : null;
};

// ─── SHARED UI ────────────────────────────────────────────────────────────────
const Spinner = () => (
  <span style={{width:14,height:14,border:"2px solid rgba(255,255,255,0.2)",borderTopColor:"#fff",borderRadius:"50%",display:"inline-block",animation:"ss 0.7s linear infinite"}}/>
);

function Btn({children, onClick, variant="primary", size="md", disabled=false, style={}}) {
  const bg = variant==="primary"?C.flame:variant==="danger"?`${C.danger}20`:variant==="success"?`${C.safe}20`:"transparent";
  const col = variant==="primary"?"#fff":variant==="danger"?C.danger:variant==="success"?C.safe:C.frost;
  const border = variant==="primary"?"none":variant==="danger"?`1px solid ${C.danger}50`:variant==="success"?`1px solid ${C.safe}50`:`1px solid ${C.steel}`;
  const pad = size==="sm"?"4px 10px":size==="lg"?"10px 22px":"7px 14px";
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{display:"inline-flex",alignItems:"center",gap:6,padding:pad,fontSize:size==="sm"?11:13,
        fontWeight:500,background:bg,color:col,border,borderRadius:6,cursor:disabled?"not-allowed":"pointer",
        opacity:disabled?0.45:1,fontFamily:"inherit",transition:"opacity 0.15s",...style}}>
      {children}
    </button>
  );
}

function Field({label, required, children, error}) {
  return (
    <div style={{display:"flex",flexDirection:"column",gap:5}}>
      {label && <label style={{fontSize:11,color:C.mist,textTransform:"uppercase",letterSpacing:"0.05em",fontWeight:500}}>{label}{required&&<span style={{color:C.flame}}> *</span>}</label>}
      {children}
      {error && <span style={{fontSize:11,color:C.danger}}>{error}</span>}
    </div>
  );
}

const inputStyle = {width:"100%",padding:"8px 11px",background:C.smoke,border:`1px solid ${C.steel}`,borderRadius:6,color:C.white,fontSize:13,fontFamily:"inherit"};

function Input({value, onChange, type="text", placeholder, min, max}) {
  return <input type={type} value={value||""} onChange={e=>onChange(e.target.value)} placeholder={placeholder} min={min} max={max} style={inputStyle}/>;
}

function Select({value, onChange, options, placeholder="Sélectionner..."}) {
  return (
    <select value={value||""} onChange={e=>onChange(e.target.value)} style={{...inputStyle,color:value?C.white:C.mist}}>
      <option value="">{placeholder}</option>
      {options.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

function Textarea({value, onChange, placeholder, rows=3}) {
  return <textarea value={value||""} onChange={e=>onChange(e.target.value)} placeholder={placeholder} rows={rows} style={{...inputStyle,resize:"vertical",lineHeight:1.5}}/>;
}

function Badge({children, color}) {
  return <span style={{display:"inline-flex",alignItems:"center",padding:"2px 8px",borderRadius:20,fontSize:10,fontWeight:600,background:`${color}22`,color,whiteSpace:"nowrap"}}>{children}</span>;
}

// ─── MODAL WRAPPER ────────────────────────────────────────────────────────────
function Modal({title, onClose, children, width=560}) {
  return (
    <div
      onClick={e=>{ if(e.target===e.currentTarget) onClose(); }}
      style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.8)",zIndex:9999,
        display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
      <div style={{background:C.ash,border:`1px solid ${C.steel}`,borderRadius:10,
        width:"100%",maxWidth:width,maxHeight:"90vh",display:"flex",flexDirection:"column",
        boxShadow:"0 20px 60px rgba(0,0,0,0.5)"}}>
        <div style={{padding:"14px 18px",borderBottom:`1px solid ${C.smoke}`,
          display:"flex",justifyContent:"space-between",alignItems:"center",flexShrink:0}}>
          <span style={{fontSize:14,fontWeight:700,color:C.white}}>{title}</span>
          <button onClick={onClose} style={{background:"none",border:"none",color:C.mist,fontSize:22,cursor:"pointer",lineHeight:1,padding:"0 4px"}}>×</button>
        </div>
        <div style={{overflowY:"auto",flex:1,padding:18}}>{children}</div>
      </div>
    </div>
  );
}

// ─── JOB FORM ────────────────────────────────────────────────────────────────
function JobForm({job, prefillDate, companyId, sbConfig, onSave, onClose}) {
  const {url, anonKey, jwt} = sbConfig;
  const isEdit = !!job?.id;
  const [form, setForm] = useState({
    title:"", trade:"fire_alarm", status:"scheduled",
    scheduled_date:prefillDate||"", scheduled_time:"08:00",
    estimated_duration:120, recurrence:"one_time",
    notes:"", customer_id:"", building_id:"", assigned_to:"",
    ...(job||{}),
  });
  const [customers, setCustomers] = useState([]);
  const [buildings, setBuildings]  = useState([]);
  const [technicians, setTechnicians] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState("");
  const set = k => v => setForm(f=>({...f,[k]:v}));

  useEffect(()=>{
    apiFetch(url,anonKey,jwt,`customers?company_id=eq.${companyId}&is_active=eq.true&order=name&select=id,name`).then(setCustomers).catch(()=>{});
    apiFetch(url,anonKey,jwt,`profiles?company_id=eq.${companyId}&select=id,full_name`).then(d=>setTechnicians(d||[])).catch(()=>{});
  },[]);

  useEffect(()=>{
    if(!form.customer_id){setBuildings([]); return;}
    apiFetch(url,anonKey,jwt,`buildings?customer_id=eq.${form.customer_id}&order=name&select=id,name`).then(setBuildings).catch(()=>{});
  },[form.customer_id]);

  const save = async () => {
    if(!form.title.trim()) return setError("Le titre est obligatoire.");
    if(!form.customer_id)  return setError("Veuillez sélectionner un client.");
    if(!form.building_id)  return setError("Veuillez sélectionner un bâtiment.");
    if(!form.scheduled_date) return setError("Veuillez saisir une date.");
    setSaving(true); setError("");
    try {
      const body = {...form, company_id:companyId, assigned_to:form.assigned_to||null, estimated_duration:Number(form.estimated_duration)||120};
      let saved;
      if(isEdit) {
        saved = await apiFetch(url,anonKey,jwt,`schedules?id=eq.${job.id}`, {method:"PATCH", body:JSON.stringify({...body,updated_at:new Date().toISOString()})});
      } else {
        saved = await apiFetch(url,anonKey,jwt,`schedules`, {method:"POST", body:JSON.stringify(body)});
      }
      onSave(Array.isArray(saved)?saved[0]:saved);
    } catch(e) { setError(e.message); }
    finally { setSaving(false); }
  };

  return (
    <Modal title={isEdit?"Modifier l'intervention":"Nouvelle intervention"} onClose={onClose} width={580}>
      <div style={{display:"flex",flexDirection:"column",gap:14}}>
        {error && <div style={{padding:"9px 13px",background:`${C.danger}15`,border:`1px solid ${C.danger}40`,borderRadius:6,fontSize:12,color:C.danger}}>⚠ {error}</div>}

        <Field label="Titre" required><Input value={form.title} onChange={set("title")} placeholder="Inspection alarme incendie — Bâtiment A"/></Field>

        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          <Field label="Client" required>
            <Select value={form.customer_id} onChange={v=>{set("customer_id")(v);set("building_id")("");}}
              options={(customers||[]).map(c=>({value:c.id,label:c.name}))} placeholder="Sélectionner un client..."/>
          </Field>
          <Field label="Bâtiment" required>
            <Select value={form.building_id} onChange={set("building_id")}
              options={(buildings||[]).map(b=>({value:b.id,label:b.name}))} placeholder="Sélectionner un bâtiment..."/>
          </Field>
        </div>

        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          <Field label="Spécialité">
            <Select value={form.trade} onChange={set("trade")} options={Object.entries(TRADE_FR).map(([v,l])=>({value:v,label:l}))}/>
          </Field>
          <Field label="Technicien">
            <Select value={form.assigned_to} onChange={set("assigned_to")}
              options={(technicians||[]).map(t=>({value:t.id,label:t.full_name}))} placeholder="Non assigné"/>
          </Field>
        </div>

        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12}}>
          <Field label="Date" required><Input type="date" value={form.scheduled_date} onChange={set("scheduled_date")}/></Field>
          <Field label="Heure"><Input type="time" value={form.scheduled_time} onChange={set("scheduled_time")}/></Field>
          <Field label="Durée (min)"><Input type="number" value={form.estimated_duration} onChange={set("estimated_duration")} min="15" max="480"/></Field>
        </div>

        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          <Field label="Récurrence">
            <Select value={form.recurrence} onChange={set("recurrence")} options={Object.entries(RECUR_FR).map(([v,l])=>({value:v,label:l}))}/>
          </Field>
          <Field label="Statut">
            <Select value={form.status} onChange={set("status")} options={Object.entries(STATUS_FR).map(([v,l])=>({value:v,label:l}))}/>
          </Field>
        </div>

        <Field label="Notes"><Textarea value={form.notes} onChange={set("notes")} placeholder="Instructions, codes d'accès..."/></Field>

        <div style={{display:"flex",gap:10,paddingTop:8,borderTop:`1px solid ${C.smoke}`}}>
          <Btn variant="secondary" onClick={onClose}>Annuler</Btn>
          <Btn onClick={save} disabled={saving} style={{marginLeft:"auto"}}>
            {saving?<><Spinner/> Enregistrement...</>:isEdit?"Enregistrer":"Créer"}
          </Btn>
        </div>
      </div>
    </Modal>
  );
}

// ─── JOB DETAIL ───────────────────────────────────────────────────────────────
function JobDetail({job, sbConfig, onClose, onEdit, onDeleted, onStatusChanged}) {
  const {url, anonKey, jwt} = sbConfig;
  const [status, setStatus] = useState(job.status);
  const [busy, setBusy] = useState(false);

  const changeStatus = async (s) => {
    setBusy(true);
    try {
      await apiFetch(url,anonKey,jwt,`schedules?id=eq.${job.id}`,{method:"PATCH",body:JSON.stringify({status:s,updated_at:new Date().toISOString()})});
      setStatus(s);
      onStatusChanged(s);
    } catch(e){alert(e.message);}
    finally{setBusy(false);}
  };

  const del = async () => {
    if(!confirm("Supprimer cette intervention ?")) return;
    try {
      await apiFetch(url,anonKey,jwt,`schedules?id=eq.${job.id}`,{method:"DELETE"});
      onDeleted();
    } catch(e){alert(e.message);}
  };

  const col = TRADE_COLOR[job.trade]||C.mist;
  const rows = [
    {label:"📅 Date", value:job.scheduled_date?new Date(job.scheduled_date+"T12:00:00").toLocaleDateString("fr-FR",{weekday:"long",day:"numeric",month:"long",year:"numeric"}):"—"},
    {label:"🕐 Heure", value:job.scheduled_time?.slice(0,5)||"Non définie"},
    {label:"⏱ Durée", value:job.estimated_duration?`${job.estimated_duration} min`:"—"},
    {label:"🏢 Client", value:job.customer?.name||"—"},
    {label:"🏗 Bâtiment", value:job.building?.name||"—"},
    {label:"👷 Technicien", value:job.technician?.full_name||"Non assigné"},
  ];

  return (
    <Modal title="Détail de l'intervention" onClose={onClose} width={480}>
      <div style={{display:"flex",flexDirection:"column",gap:14}}>
        <div style={{padding:14,background:`${col}12`,border:`1px solid ${col}30`,borderRadius:8}}>
          <div style={{fontSize:14,fontWeight:700,color:C.white,marginBottom:8}}>{job.title}</div>
          <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
            <Badge color={col}>{TRADE_FR[job.trade]||job.trade}</Badge>
            <Badge color={STATUS_COL[status]||C.mist}>{STATUS_FR[status]||status}</Badge>
            {job.recurrence&&job.recurrence!=="one_time"&&<Badge color={C.info}>{RECUR_FR[job.recurrence]}</Badge>}
          </div>
        </div>

        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
          {rows.map((r,i)=>(
            <div key={i} style={{background:C.smoke,borderRadius:6,padding:"9px 11px"}}>
              <div style={{fontSize:10,color:C.mist,marginBottom:3}}>{r.label}</div>
              <div style={{fontSize:12,fontWeight:500,color:C.white}}>{r.value}</div>
            </div>
          ))}
        </div>

        {job.notes&&<div style={{background:C.smoke,borderRadius:6,padding:"9px 11px",fontSize:12,color:C.frost,lineHeight:1.5}}>{job.notes}</div>}

        <div>
          <div style={{fontSize:11,color:C.mist,textTransform:"uppercase",letterSpacing:"0.05em",marginBottom:8}}>Changer le statut</div>
          <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
            {Object.entries(STATUS_FR).filter(([v])=>v!==status).map(([v,l])=>(
              <button key={v} onClick={()=>changeStatus(v)} disabled={busy}
                style={{padding:"4px 12px",borderRadius:6,border:`1px solid ${STATUS_COL[v]}50`,
                  background:`${STATUS_COL[v]}15`,color:STATUS_COL[v],fontSize:11,
                  fontWeight:500,cursor:"pointer",fontFamily:"inherit",opacity:busy?0.5:1}}>
                {l}
              </button>
            ))}
          </div>
        </div>

        <div style={{display:"flex",gap:8,paddingTop:8,borderTop:`1px solid ${C.smoke}`}}>
          <Btn variant="danger" size="sm" onClick={del}>🗑 Supprimer</Btn>
          <Btn variant="secondary" size="sm" onClick={onEdit} style={{marginLeft:"auto"}}>✏ Modifier</Btn>
          <Btn size="sm" onClick={onClose}>Fermer</Btn>
        </div>
      </div>
    </Modal>
  );
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
export default function Scheduling({user, supabase:sbConfig}) {
  const {url, anonKey, jwt} = sbConfig;

  const getMonday = () => {
    const t=new Date(); t.setHours(0,0,0,0);
    const diff = t.getDay()===0?-6:1-t.getDay();
    const m=new Date(t); m.setDate(t.getDate()+diff);
    return m;
  };

  const [monday,   setMonday]   = useState(getMonday);
  const [viewMode, setViewMode] = useState("week");
  const [jobs,     setJobs]     = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState("");
  const [detail,   setDetail]   = useState(null);  // job to show detail
  const [editing,  setEditing]  = useState(null);  // {job?} | {date?}
  const [listFilter, setListFilter] = useState("all");

  const today = new Date(); today.setHours(0,0,0,0);
  const weekDates = DAYS.map((_,i)=>{ const d=new Date(monday); d.setDate(monday.getDate()+i); return d; });

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const from = isoDate(weekDates[0]);
      const toDate = viewMode==="week" ? new Date(weekDates[6]) : new Date(Date.now()+90*864e5);
      const to = isoDate(toDate);

      const rawJobs = await apiFetch(url,anonKey,jwt,
        `schedules?company_id=eq.${user.company_id}&scheduled_date=gte.${from}&scheduled_date=lte.${to}&order=scheduled_date.asc,scheduled_time.asc`
      ) || [];

      if(!rawJobs.length){setJobs([]); return;}

      const custIds = [...new Set(rawJobs.map(j=>j.customer_id).filter(Boolean))];
      const bldIds  = [...new Set(rawJobs.map(j=>j.building_id).filter(Boolean))];
      const profIds = [...new Set(rawJobs.map(j=>j.assigned_to).filter(Boolean))];

      const [custs,blds,profs] = await Promise.all([
        custIds.length ? apiFetch(url,anonKey,jwt,`customers?id=in.(${custIds.join(",")})&select=id,name`) : [],
        bldIds.length  ? apiFetch(url,anonKey,jwt,`buildings?id=in.(${bldIds.join(",")})&select=id,name`)  : [],
        profIds.length ? apiFetch(url,anonKey,jwt,`profiles?id=in.(${profIds.join(",")})&select=id,full_name`) : [],
      ]);

      const cm=Object.fromEntries((custs||[]).map(c=>[c.id,c]));
      const bm=Object.fromEntries((blds||[]).map(b=>[b.id,b]));
      const pm=Object.fromEntries((profs||[]).map(p=>[p.id,p]));

      setJobs(rawJobs.map(j=>({...j,
        customer:  cm[j.customer_id]||null,
        building:  bm[j.building_id]||null,
        technician:pm[j.assigned_to]||null,
      })));
    } catch(e){ setError(e.message); }
    finally { setLoading(false); }
  }, [monday, viewMode, user.company_id]);

  useEffect(()=>{ load(); },[load]);

  const prevWeek = () => { const m=new Date(monday); m.setDate(m.getDate()-7); setMonday(m); };
  const nextWeek = () => { const m=new Date(monday); m.setDate(m.getDate()+7); setMonday(m); };

  const jobsByDay = jobs.reduce((acc,job)=>{
    const d=new Date(job.scheduled_date+"T12:00:00");
    let dow=d.getDay()-1; if(dow===-1)dow=6;
    if(!acc[dow])acc[dow]=[];
    acc[dow].push(job);
    return acc;
  },{});

  const onSaved = () => { setEditing(null); setDetail(null); load(); };
  const onDeleted = () => { setDetail(null); load(); };
  const onStatusChanged = (s) => {
    setJobs(prev=>prev.map(j=>j.id===detail?.id?{...j,status:s}:j));
    setDetail(prev=>prev?{...prev,status:s}:null);
  };

  return (
    <div style={{display:"flex",flexDirection:"column",minHeight:0,flex:1}}>
      <style>{`@keyframes ss{to{transform:rotate(360deg)}}`}</style>

      {/* TOOLBAR */}
      <div style={{padding:"10px 16px",borderBottom:`1px solid ${C.smoke}`,display:"flex",alignItems:"center",gap:10,flexShrink:0,flexWrap:"wrap",background:C.ash}}>
        <button onClick={prevWeek} style={{width:30,height:30,borderRadius:5,border:`1px solid ${C.steel}`,background:"transparent",color:C.frost,cursor:"pointer",fontSize:16}}>‹</button>
        <span style={{fontSize:13,fontWeight:600,color:C.white,minWidth:190,textAlign:"center"}}>
          {weekDates[0].toLocaleDateString("fr-FR",{day:"numeric",month:"short"})} – {weekDates[6].toLocaleDateString("fr-FR",{day:"numeric",month:"short",year:"numeric"})}
        </span>
        <button onClick={nextWeek} style={{width:30,height:30,borderRadius:5,border:`1px solid ${C.steel}`,background:"transparent",color:C.frost,cursor:"pointer",fontSize:16}}>›</button>
        <button onClick={()=>setMonday(getMonday())} style={{padding:"4px 10px",borderRadius:5,border:`1px solid ${C.steel}`,background:"transparent",color:C.mist,fontSize:12,cursor:"pointer",fontFamily:"inherit"}}>Aujourd'hui</button>

        <div style={{display:"flex",gap:2,background:C.smoke,borderRadius:5,padding:3,marginLeft:"auto"}}>
          {[["week","Semaine"],["list","Liste"]].map(([v,l])=>(
            <button key={v} onClick={()=>setViewMode(v)} style={{padding:"4px 12px",borderRadius:4,border:"none",background:viewMode===v?C.flame:"transparent",color:viewMode===v?"#fff":C.mist,fontSize:12,cursor:"pointer",fontFamily:"inherit"}}>{l}</button>
          ))}
        </div>

        <button
          onClick={()=>setEditing({date:isoDate(today)})}
          style={{padding:"7px 14px",borderRadius:6,border:"none",background:C.flame,color:"#fff",fontSize:13,fontWeight:500,cursor:"pointer",fontFamily:"inherit"}}>
          + Nouvelle intervention
        </button>
      </div>

      {/* STATS */}
      <div style={{display:"flex",borderBottom:`1px solid ${C.smoke}`,flexShrink:0,background:C.ash}}>
        {[
          {label:"Total",       value:jobs.length,                                         color:C.mist},
          {label:"Planifiées",  value:jobs.filter(j=>["scheduled","confirmed"].includes(j.status)).length, color:C.info},
          {label:"Terminées",   value:jobs.filter(j=>j.status==="completed").length,        color:C.safe},
          {label:"Annulées",    value:jobs.filter(j=>j.status==="cancelled").length,        color:C.danger},
        ].map((s,i)=>(
          <div key={i} style={{padding:"8px 18px",borderRight:`1px solid ${C.smoke}`}}>
            <div style={{fontSize:10,color:C.mist,textTransform:"uppercase",letterSpacing:"0.05em",marginBottom:3}}>{s.label}</div>
            <div style={{fontSize:17,fontWeight:800,color:s.color}}>{loading?"—":s.value}</div>
          </div>
        ))}
      </div>

      {error && <div style={{margin:12,padding:"9px 13px",background:`${C.danger}12`,border:`1px solid ${C.danger}30`,borderRadius:6,fontSize:13,color:C.danger}}>⚠ {error}</div>}

      {/* WEEK CALENDAR */}
      {viewMode==="week" && (
        <div style={{flex:1,overflowY:"auto",padding:12}}>
          <div style={{border:`1px solid ${C.smoke}`,borderRadius:8,overflow:"hidden"}}>
            {/* Day headers */}
            <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",borderBottom:`1px solid ${C.smoke}`}}>
              {weekDates.map((date,i)=>{
                const isToday=date.toDateString()===today.toDateString();
                return (
                  <div key={i} style={{padding:"10px 8px",textAlign:"center",borderRight:i<6?`1px solid ${C.smoke}`:"none",background:isToday?`${C.flame}12`:i>=5?`${C.smoke}40`:"transparent"}}>
                    <div style={{fontSize:10,color:C.mist,fontWeight:500,textTransform:"uppercase",marginBottom:4}}>{DAYS[i]}</div>
                    <div style={{width:28,height:28,borderRadius:"50%",margin:"0 auto",background:isToday?C.flame:"transparent",display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:isToday?700:400,color:isToday?"#fff":C.frost}}>
                      {date.getDate()}
                    </div>
                  </div>
                );
              })}
            </div>
            {/* Job cells */}
            <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",minHeight:380}}>
              {weekDates.map((date,i)=>{
                const dayJobs=jobsByDay[i]||[];
                const isWeekend=i>=5;
                const isToday=date.toDateString()===today.toDateString();
                return (
                  <div key={i} style={{padding:"6px 5px",borderRight:i<6?`1px solid ${C.smoke}`:"none",display:"flex",flexDirection:"column",gap:4,background:isWeekend?`${C.smoke}30`:isToday?`${C.flame}04`:"transparent"}}>
                    {loading&&i===0&&<div style={{fontSize:11,color:C.mist,padding:6}}>Chargement...</div>}
                    {dayJobs.map((job,j)=>{
                      const col=TRADE_COLOR[job.trade]||C.mist;
                      return (
                        <div key={j} onClick={()=>setDetail(job)}
                          style={{padding:"6px 7px",borderRadius:5,background:`${col}15`,borderLeft:`3px solid ${col}`,cursor:"pointer"}}>
                          <div style={{fontSize:10,fontWeight:700,color:col}}>{job.scheduled_time?.slice(0,5)||"—"}</div>
                          <div style={{fontSize:11,fontWeight:600,color:C.white,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{job.building?.name||job.title}</div>
                          <div style={{fontSize:10,color:C.mist,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{job.customer?.name||""}</div>
                          <div style={{display:"flex",alignItems:"center",gap:3,marginTop:3}}>
                            <span style={{width:5,height:5,borderRadius:"50%",background:STATUS_COL[job.status]||C.mist,flexShrink:0}}/>
                            <span style={{fontSize:9,color:STATUS_COL[job.status]||C.mist}}>{STATUS_FR[job.status]||job.status}</span>
                          </div>
                        </div>
                      );
                    })}
                    {!isWeekend&&(
                      <button onClick={()=>setEditing({date:isoDate(date)})}
                        style={{marginTop:"auto",padding:"5px",borderRadius:5,border:`1px dashed ${C.smoke}`,background:"transparent",color:C.steel,fontSize:11,cursor:"pointer",fontFamily:"inherit",width:"100%"}}
                        onMouseEnter={e=>{e.currentTarget.style.borderColor=C.flame;e.currentTarget.style.color=C.flame;}}
                        onMouseLeave={e=>{e.currentTarget.style.borderColor=C.smoke;e.currentTarget.style.color=C.steel;}}>
                        + Ajouter
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* LIST VIEW */}
      {viewMode==="list" && (
        <div style={{flex:1,overflowY:"auto"}}>
          <div style={{padding:"8px 14px",borderBottom:`1px solid ${C.smoke}`,display:"flex",gap:4,background:C.ash}}>
            {[["all","Tous"],["scheduled","Planifiés"],["confirmed","Confirmés"],["in_progress","En cours"],["completed","Terminés"],["cancelled","Annulés"]].map(([v,l])=>(
              <button key={v} onClick={()=>setListFilter(v)}
                style={{padding:"4px 11px",borderRadius:4,border:"none",background:listFilter===v?C.flame:"transparent",color:listFilter===v?"#fff":C.mist,fontSize:12,cursor:"pointer",fontFamily:"inherit"}}>
                {l}
              </button>
            ))}
          </div>
          {loading&&<div style={{padding:40,textAlign:"center",color:C.mist,fontSize:13}}>Chargement...</div>}
          {!loading&&jobs.filter(j=>listFilter==="all"||j.status===listFilter).length===0&&(
            <div style={{padding:60,textAlign:"center"}}>
              <div style={{fontSize:40,marginBottom:12}}>📅</div>
              <div style={{fontSize:14,color:C.frost,marginBottom:8}}>Aucune intervention</div>
              <button onClick={()=>setEditing({date:isoDate(today)})} style={{padding:"8px 16px",borderRadius:6,border:"none",background:C.flame,color:"#fff",fontSize:13,cursor:"pointer",fontFamily:"inherit"}}>+ Nouvelle intervention</button>
            </div>
          )}
          {!loading&&(()=>{
            const filtered=jobs.filter(j=>listFilter==="all"||j.status===listFilter);
            const groups=filtered.reduce((acc,j)=>{if(!acc[j.scheduled_date])acc[j.scheduled_date]=[];acc[j.scheduled_date].push(j);return acc;},{});
            return Object.entries(groups).map(([date,dayJobs])=>{
              const d=new Date(date+"T12:00:00");
              const isToday=d.toDateString()===today.toDateString();
              const label=isToday?"Aujourd'hui":d.toLocaleDateString("fr-FR",{weekday:"long",day:"numeric",month:"long"});
              return (
                <div key={date}>
                  <div style={{padding:"8px 16px",background:`${C.smoke}60`,borderBottom:`1px solid ${C.smoke}`,display:"flex",alignItems:"center",gap:10}}>
                    <span style={{fontSize:12,fontWeight:700,color:isToday?C.flame:C.frost,textTransform:"capitalize"}}>{label}</span>
                    <span style={{fontSize:11,color:C.mist}}>{dayJobs.length} intervention{dayJobs.length>1?"s":""}</span>
                  </div>
                  {dayJobs.map((job,i)=>{
                    const col=TRADE_COLOR[job.trade]||C.mist;
                    const sCol=STATUS_COL[job.status]||C.mist;
                    return (
                      <div key={i} onClick={()=>setDetail(job)}
                        style={{padding:"12px 16px",borderBottom:`1px solid ${C.smoke}20`,display:"flex",alignItems:"center",gap:12,cursor:"pointer"}}
                        onMouseEnter={e=>e.currentTarget.style.background=C.smoke}
                        onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                        <div style={{width:34,height:34,borderRadius:7,background:`${col}18`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:15,flexShrink:0}}>
                          {job.trade==="fire_alarm"?"🔔":job.trade==="sprinkler"?"💧":job.trade==="extinguisher"?"🧯":job.trade==="fire_door"?"🚪":"🔧"}
                        </div>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{fontSize:13,fontWeight:600,color:C.white,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{job.title}</div>
                          <div style={{fontSize:11,color:C.mist,marginTop:2}}>{job.customer?.name}{job.building?.name&&` · ${job.building.name}`}</div>
                        </div>
                        <div style={{textAlign:"right",flexShrink:0}}>
                          <div style={{fontSize:12,fontWeight:600,color:C.frost}}>{job.scheduled_time?.slice(0,5)||"—"}</div>
                          {job.technician?.full_name&&<div style={{fontSize:11,color:C.mist,marginTop:2}}>{job.technician.full_name.split(" ")[0]}</div>}
                        </div>
                        <Badge color={sCol}>{STATUS_FR[job.status]||job.status}</Badge>
                        <span style={{color:C.steel,fontSize:18}}>›</span>
                      </div>
                    );
                  })}
                </div>
              );
            });
          })()}
        </div>
      )}

      {/* DETAIL MODAL */}
      {detail && !editing && (
        <JobDetail
          job={detail}
          sbConfig={sbConfig}
          onClose={()=>setDetail(null)}
          onEdit={()=>setEditing({job:detail})}
          onDeleted={onDeleted}
          onStatusChanged={onStatusChanged}
        />
      )}

      {/* FORM MODAL */}
      {editing && (
        <JobForm
          job={editing.job||null}
          prefillDate={editing.date||null}
          companyId={user.company_id}
          sbConfig={sbConfig}
          onSave={onSaved}
          onClose={()=>setEditing(null)}
        />
      )}
    </div>
  );
}