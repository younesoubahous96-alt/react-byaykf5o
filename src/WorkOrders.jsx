// ============================================================
// FireSafe Pro — Bons de travail (Work Orders)
// WorkOrders.jsx
// ============================================================
import React, { useState, useEffect, useCallback } from "react";

// ─── API ──────────────────────────────────────────────────────────────────────
const mkApi = ({ url, anonKey, jwt }) => {
  const h = (extra = {}) => ({
    "Content-Type": "application/json",
    apikey: anonKey,
    Authorization: `Bearer ${jwt}`,
    Prefer: "return=representation",
    ...extra,
  });
  const get  = async (p) => { const r = await fetch(`${url}/rest/v1/${p}`, { headers: h() }); const t = await r.text(); if (!r.ok) throw new Error(JSON.parse(t)?.message || t); return t ? JSON.parse(t) : []; };
  const post = async (table, body) => { const r = await fetch(`${url}/rest/v1/${table}`, { method:"POST", headers:h(), body:JSON.stringify(body) }); const t = await r.text(); if (!r.ok) throw new Error(JSON.parse(t)?.message || t); return t ? JSON.parse(t) : null; };
  const patch = async (table, id, body) => { const r = await fetch(`${url}/rest/v1/${table}?id=eq.${id}`, { method:"PATCH", headers:h(), body:JSON.stringify(body) }); const t = await r.text(); if (!r.ok) throw new Error(JSON.parse(t)?.message || t); return t ? JSON.parse(t) : null; };
  const del  = async (table, id) => { const r = await fetch(`${url}/rest/v1/${table}?id=eq.${id}`, { method:"DELETE", headers:h({ Prefer:"" }) }); if (!r.ok) throw new Error(`Delete failed`); };
  return { get, post, patch, del };
};

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const C = { coal:"#0D0D0D", ash:"#1A1A1A", smoke:"#2A2A2A", steel:"#3A3A3A", mist:"#8A8A8A", frost:"#E8E8E8", white:"#FAFAFA", flame:"#FF4500", ember:"#FF8C00", safe:"#22C55E", warn:"#F59E0B", danger:"#EF4444", info:"#3B82F6" };

const STATUS_FLOW = [
  { key:"open",        label:"Ouvert",          color:"#EF4444", bg:"#EF444418", icon:"🔴" },
  { key:"assigned",    label:"Assigné",          color:"#F59E0B", bg:"#F59E0B18", icon:"👤" },
  { key:"in_progress", label:"En cours",         color:"#3B82F6", bg:"#3B82F618", icon:"🔧" },
  { key:"completed",   label:"Terminé",          color:"#22C55E", bg:"#22C55E18", icon:"✅" },
  { key:"cancelled",   label:"Annulé",           color:"#6B7280", bg:"#6B728018", icon:"❌" },
];
const STATUS_MAP  = Object.fromEntries(STATUS_FLOW.map(s=>[s.key,s]));
const NEXT_STATUS = { open:"assigned", assigned:"in_progress", in_progress:"completed" };
const NEXT_LABEL  = { open:"Assigner", assigned:"Démarrer", in_progress:"Marquer terminé" };

const PRIORITIES = [
  { value:"low",       label:"Faible",     color:"#22C55E" },
  { value:"normal",    label:"Normal",     color:"#3B82F6" },
  { value:"high",      label:"Élevée",     color:"#F59E0B" },
  { value:"emergency", label:"Urgence",    color:"#EF4444" },
];
const PRIO_MAP = Object.fromEntries(PRIORITIES.map(p=>[p.value,p]));

const WO_TYPES = [
  { value:"repair",       label:"Réparation" },
  { value:"emergency",    label:"Urgence" },
  { value:"maintenance",  label:"Maintenance" },
  { value:"installation", label:"Installation" },
];

const TRADES = [
  { value:"fire_alarm",           label:"Alarme incendie" },
  { value:"sprinkler",            label:"Sprinkleur" },
  { value:"extinguisher",         label:"Extincteur" },
  { value:"special_hazard",       label:"Risque spécial" },
  { value:"fire_door",            label:"Porte coupe-feu" },
  { value:"backflow",             label:"Anti-retour" },
  { value:"chemical_suppression", label:"Suppression chimique" },
  { value:"facilities",           label:"Installations" },
];

const currency = () => localStorage.getItem("fsCurrency") || "MAD";
const fmt = n => Number(n||0).toLocaleString("fr-FR",{minimumFractionDigits:2,maximumFractionDigits:2}) + " " + currency();

// ─── MINI UI ──────────────────────────────────────────────────────────────────
const Pill = ({ status }) => { const s = STATUS_MAP[status]||{label:status,color:C.mist,bg:C.smoke,icon:""}; return <span style={{ display:"inline-flex",alignItems:"center",gap:5,padding:"3px 10px",borderRadius:20,fontSize:11,fontWeight:600,color:s.color,background:s.bg,border:`1px solid ${s.color}40` }}>{s.icon} {s.label}</span>; };
const PrioTag = ({ priority }) => { const p = PRIO_MAP[priority]||{label:priority,color:C.mist}; return <span style={{ padding:"2px 9px",borderRadius:20,fontSize:11,fontWeight:700,color:p.color,background:`${p.color}15`,border:`1px solid ${p.color}40` }}>{p.label}</span>; };
const Avatar = ({ name="?", size=28 }) => { const i=name.split(" ").map(w=>w[0]).slice(0,2).join("").toUpperCase(); const h=name.split("").reduce((a,c)=>a+c.charCodeAt(0),0)%360; return <div style={{ width:size,height:size,borderRadius:"50%",background:`hsl(${h},55%,35%)`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:size*.36,fontWeight:700,color:"#fff",flexShrink:0 }}>{i}</div>; };
const Spinner = () => <div style={{ display:"flex",justifyContent:"center",padding:48 }}><div style={{ width:28,height:28,borderRadius:"50%",border:`3px solid ${C.steel}`,borderTopColor:C.flame,animation:"spin 0.7s linear infinite" }}/></div>;
const Btn = ({ children, onClick, variant="primary", size="md", disabled, style:sx={}, icon }) => {
  const styles = { primary:{background:C.flame,color:"#fff"}, secondary:{background:C.smoke,color:C.frost,border:`1px solid ${C.steel}`}, ghost:{background:"transparent",color:C.mist}, danger:{background:"#EF444418",color:"#EF4444",border:"1px solid #EF444440"}, success:{background:"#22C55E18",color:"#22C55E",border:"1px solid #22C55E40"} };
  return <button onClick={onClick} disabled={disabled} style={{ display:"inline-flex",alignItems:"center",gap:6,border:"none",borderRadius:6,cursor:disabled?"not-allowed":"pointer",fontFamily:"inherit",fontWeight:500,transition:"all 0.12s",opacity:disabled?.5:1,fontSize:size==="sm"?12:13,padding:size==="sm"?"6px 12px":"9px 16px",...styles[variant],...sx }}>{icon&&<span>{icon}</span>}{children}</button>;
};
const Field = ({ label, value, onChange, type="text", placeholder, required, as, options, rows=3 }) => (
  <div style={{ display:"flex",flexDirection:"column",gap:5 }}>
    {label&&<label style={{ fontSize:12,fontWeight:500,color:C.frost }}>{label}{required&&<span style={{ color:C.danger }}> *</span>}</label>}
    {as==="textarea" ? <textarea value={value} onChange={onChange} rows={rows} placeholder={placeholder} style={{ background:C.smoke,border:`1px solid ${C.steel}`,borderRadius:6,padding:"9px 12px",fontSize:13,color:C.white,resize:"vertical",fontFamily:"inherit" }}/> :
     as==="select"   ? <select value={value} onChange={onChange} style={{ background:C.smoke,border:`1px solid ${C.steel}`,borderRadius:6,padding:"9px 12px",fontSize:13,color:value?C.white:C.mist }}>{options.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}</select> :
     <input type={type} value={value} onChange={onChange} placeholder={placeholder} style={{ background:C.smoke,border:`1px solid ${C.steel}`,borderRadius:6,padding:"9px 12px",fontSize:13,color:C.white }} />}
  </div>
);

// ─── STEPPER ──────────────────────────────────────────────────────────────────
const Stepper = ({ status, onAdvance, loading }) => {
  const flowDisplay = STATUS_FLOW.filter(s => s.key !== "cancelled");
  const idx = flowDisplay.findIndex(s => s.key === status);
  const next = NEXT_STATUS[status];
  return (
    <div style={{ background:C.ash,borderRadius:10,padding:16,border:`1px solid ${C.smoke}` }}>
      <div style={{ fontSize:11,color:C.mist,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:14 }}>Progression du bon</div>
      <div style={{ display:"flex",alignItems:"center",marginBottom:16 }}>
        {flowDisplay.map((s,i) => {
          const done=i<idx, cur=i===idx;
          return (
            <React.Fragment key={s.key}>
              <div style={{ display:"flex",flexDirection:"column",alignItems:"center",gap:4 }}>
                <div style={{ width:28,height:28,borderRadius:"50%",background:done?s.color:cur?s.color:C.smoke,border:`2px solid ${done||cur?s.color:C.steel}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:done?12:11,color:done||cur?"#fff":C.steel,fontWeight:700,transition:"all 0.3s" }}>{done?"✓":s.icon}</div>
                <div style={{ fontSize:9,fontWeight:cur?700:400,color:cur?s.color:done?C.frost:C.steel,textAlign:"center",maxWidth:60 }}>{s.label}</div>
              </div>
              {i<flowDisplay.length-1&&<div style={{ flex:1,height:2,margin:"0 3px",marginBottom:18,background:i<idx?flowDisplay[i].color:C.steel,transition:"background 0.3s" }}/>}
            </React.Fragment>
          );
        })}
      </div>
      {next ? (
        <Btn onClick={()=>onAdvance(next)} disabled={loading} style={{ width:"100%",justifyContent:"center" }} icon="→">{NEXT_LABEL[status]}</Btn>
      ) : status==="completed" ? (
        <div style={{ textAlign:"center",fontSize:12,color:C.safe,padding:"6px 0" }}>✅ Bon de travail terminé</div>
      ) : status==="cancelled" ? (
        <div style={{ textAlign:"center",fontSize:12,color:C.mist,padding:"6px 0" }}>❌ Bon annulé</div>
      ) : null}
    </div>
  );
};

// ─── CREATE/EDIT MODAL ────────────────────────────────────────────────────────
const WOModal = ({ mode="create", initial={}, customers, buildings, technicians, deficiencies, onSave, onClose }) => {
  const [form, setForm] = useState({
    title:          initial.title          || "",
    description:    initial.description    || "",
    type:           initial.type           || "repair",
    priority:       initial.priority       || "normal",
    trade:          initial.trade          || "",
    customer_id:    initial.customer_id    || "",
    building_id:    initial.building_id    || "",
    assigned_to:    initial.assigned_to    || "",
    scheduled_date: initial.scheduled_date || "",
    scheduled_time: initial.scheduled_time || "",
    deficiency_id:  initial.deficiency_id  || "",
    estimated_hours:initial.estimated_hours|| "",
    labor_rate:     initial.labor_rate     || "",
    internal_notes: initial.internal_notes || "",
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr]       = useState("");
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value, ...(k==="customer_id"?{building_id:"",deficiency_id:""}:{}) }));

  const filteredBuildings   = buildings.filter(b => !form.customer_id || b.customer_id === form.customer_id);
  const filteredDeficiencies = deficiencies.filter(d => !form.customer_id || d.customer_id === form.customer_id);

  const handleSave = async () => {
    if (!form.title.trim())    return setErr("Le titre est requis");
    if (!form.customer_id)     return setErr("Sélectionnez un client");
    if (!form.building_id)     return setErr("Sélectionnez un bâtiment");
    setSaving(true); setErr("");
    try {
      await onSave({
        ...form,
        labor_hours: form.estimated_hours ? Number(form.estimated_hours) : null,
        labor_rate:  form.labor_rate      ? Number(form.labor_rate)      : null,
      });
    } catch(e) { setErr(e.message); } finally { setSaving(false); }
  };

  return (
    <div style={{ position:"fixed",inset:0,zIndex:3000,background:"rgba(0,0,0,0.7)",display:"flex",alignItems:"center",justifyContent:"center",padding:20 }}>
      <div style={{ background:C.ash,borderRadius:12,width:"100%",maxWidth:660,border:`1px solid ${C.smoke}`,maxHeight:"92vh",overflow:"hidden",display:"flex",flexDirection:"column" }}>
        <div style={{ padding:"18px 24px",borderBottom:`1px solid ${C.smoke}`,display:"flex",justifyContent:"space-between",alignItems:"center" }}>
          <div style={{ fontSize:15,fontWeight:700,color:C.white }}>{mode==="create"?"🔧 Nouveau bon de travail":"✏️ Modifier le bon"}</div>
          <button onClick={onClose} style={{ background:"none",border:"none",color:C.mist,fontSize:20,cursor:"pointer" }}>✕</button>
        </div>
        <div style={{ overflowY:"auto",padding:24,display:"flex",flexDirection:"column",gap:14 }}>
          {err && <div style={{ background:"#EF444418",border:"1px solid #EF444440",borderRadius:6,padding:"10px 14px",fontSize:12,color:"#EF4444" }}>⚠️ {err}</div>}
          <Field label="Titre" value={form.title} onChange={set("title")} placeholder="Ex: Remplacement extincteur niveau 3" required/>
          <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12 }}>
            <Field label="Type" value={form.type} onChange={set("type")} as="select" options={WO_TYPES}/>
            <Field label="Priorité" value={form.priority} onChange={set("priority")} as="select" options={PRIORITIES.map(p=>({ value:p.value, label:p.label }))}/>
            <Field label="Spécialité" value={form.trade} onChange={set("trade")} as="select" options={[{value:"",label:"— Sélectionner —"},...TRADES]}/>
          </div>
          <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:12 }}>
            <Field label="Client" value={form.customer_id} onChange={set("customer_id")} as="select" required options={[{value:"",label:"— Sélectionner —"},...customers.map(c=>({value:c.id,label:c.name}))]}/>
            <Field label="Bâtiment" value={form.building_id} onChange={set("building_id")} as="select" required options={[{value:"",label:"— Sélectionner —"},...filteredBuildings.map(b=>({value:b.id,label:b.name}))]}/>
          </div>
          {filteredDeficiencies.length > 0 && (
            <Field label="Lier à une déficience (optionnel)" value={form.deficiency_id} onChange={set("deficiency_id")} as="select"
              options={[{value:"",label:"— Aucune —"},...filteredDeficiencies.map(d=>({value:d.id,label:d.title}))]}/>
          )}
          <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:12 }}>
            <Field label="Technicien assigné" value={form.assigned_to} onChange={set("assigned_to")} as="select"
              options={[{value:"",label:"— Non assigné —"},...technicians.map(t=>({value:t.id,label:t.full_name}))]}/>
            <Field label="Date prévue" value={form.scheduled_date} onChange={set("scheduled_date")} type="date"/>
          </div>
          <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:12 }}>
            <Field label="Heures estimées" value={form.estimated_hours} onChange={set("estimated_hours")} type="number" placeholder="0.0"/>
            <Field label={`Taux horaire (${currency()})`} value={form.labor_rate} onChange={set("labor_rate")} type="number" placeholder="0.00"/>
          </div>
          <Field label="Description" value={form.description} onChange={set("description")} as="textarea" rows={3} placeholder="Décrivez les travaux à effectuer..."/>
          <Field label="Notes internes" value={form.internal_notes} onChange={set("internal_notes")} as="textarea" rows={2} placeholder="Notes visibles uniquement en interne..."/>
        </div>
        <div style={{ padding:"16px 24px",borderTop:`1px solid ${C.smoke}`,display:"flex",justifyContent:"flex-end",gap:10 }}>
          <Btn variant="secondary" onClick={onClose}>Annuler</Btn>
          <Btn onClick={handleSave} disabled={saving}>{saving?"Enregistrement…":mode==="create"?"Créer le bon":"Enregistrer"}</Btn>
        </div>
      </div>
    </div>
  );
};

// ─── MATERIALS PANEL ──────────────────────────────────────────────────────────
const MaterialsPanel = ({ woId, api }) => {
  const [materials, setMaterials] = useState([]);
  const [form, setForm]           = useState({ description:"", quantity:"1", unit_price:"" });
  const [loading, setLoading]     = useState(true);
  const [adding, setAdding]       = useState(false);

  useEffect(() => { load(); }, [woId]);
  const load = async () => {
    setLoading(true);
    try { setMaterials(await api.get(`work_order_materials?work_order_id=eq.${woId}&order=created_at.asc`) || []); }
    catch(e) { console.error(e); } finally { setLoading(false); }
  };
  const add = async () => {
    if (!form.description||!form.unit_price) return;
    setAdding(true);
    try {
      await api.post("work_order_materials", { work_order_id:woId, description:form.description, quantity:Number(form.quantity)||1, unit_price:Number(form.unit_price) });
      setForm({ description:"", quantity:"1", unit_price:"" });
      load();
    } catch(e) { console.error(e); } finally { setAdding(false); }
  };
  const remove = async (id) => { await api.del("work_order_materials", id); load(); };

  const total = materials.reduce((s,m) => s + Number(m.quantity)*Number(m.unit_price), 0);

  return (
    <div style={{ background:C.coal,borderRadius:10,border:`1px solid ${C.smoke}`,overflow:"hidden" }}>
      <div style={{ padding:"11px 14px",borderBottom:`1px solid ${C.smoke}`,fontSize:11,fontWeight:700,color:C.frost,textTransform:"uppercase",letterSpacing:"0.06em",display:"flex",justifyContent:"space-between" }}>
        🔩 Matériaux & Pièces
        {total > 0 && <span style={{ color:C.warn,fontWeight:700 }}>Total : {fmt(total)}</span>}
      </div>
      <div style={{ padding:14,display:"flex",flexDirection:"column",gap:8 }}>
        {loading ? <div style={{ fontSize:12,color:C.mist,textAlign:"center",padding:8 }}>Chargement…</div> :
          materials.length === 0 ? <div style={{ fontSize:12,color:C.steel,textAlign:"center",padding:8 }}>Aucun matériau ajouté</div> :
          materials.map(m => (
            <div key={m.id} style={{ display:"grid",gridTemplateColumns:"1fr 60px 90px 80px 24px",gap:8,alignItems:"center",padding:"7px 10px",background:C.ash,borderRadius:6,fontSize:12 }}>
              <span style={{ color:C.white }}>{m.description}</span>
              <span style={{ color:C.mist,textAlign:"center" }}>{m.quantity}</span>
              <span style={{ color:C.mist,textAlign:"right" }}>{Number(m.unit_price).toLocaleString("fr-FR",{minimumFractionDigits:2})}</span>
              <span style={{ color:C.warn,fontWeight:600,textAlign:"right" }}>{fmt(Number(m.quantity)*Number(m.unit_price))}</span>
              <button onClick={()=>remove(m.id)} style={{ background:"none",border:"none",color:"#EF4444",cursor:"pointer",fontSize:14,padding:0 }}>✕</button>
            </div>
          ))
        }
        {/* Add row */}
        <div style={{ display:"grid",gridTemplateColumns:"1fr 60px 90px auto",gap:8,alignItems:"center",marginTop:4 }}>
          <input placeholder="Description matériau" value={form.description} onChange={e=>setForm(f=>({...f,description:e.target.value}))}
            style={{ background:C.smoke,border:`1px solid ${C.steel}`,borderRadius:6,padding:"7px 10px",fontSize:12,color:C.white,fontFamily:"inherit" }}/>
          <input placeholder="Qté" value={form.quantity} onChange={e=>setForm(f=>({...f,quantity:e.target.value}))} type="number"
            style={{ background:C.smoke,border:`1px solid ${C.steel}`,borderRadius:6,padding:"7px 8px",fontSize:12,color:C.white,fontFamily:"inherit" }}/>
          <input placeholder="Prix unit." value={form.unit_price} onChange={e=>setForm(f=>({...f,unit_price:e.target.value}))} type="number"
            style={{ background:C.smoke,border:`1px solid ${C.steel}`,borderRadius:6,padding:"7px 8px",fontSize:12,color:C.white,fontFamily:"inherit" }}/>
          <Btn onClick={add} disabled={adding} size="sm" icon="＋">Ajouter</Btn>
        </div>
      </div>
    </div>
  );
};

// ─── DETAIL PANEL ─────────────────────────────────────────────────────────────
const DetailPanel = ({ wo, technicians, api, onUpdate, onClose }) => {
  const [advancing, setAdvancing] = useState(false);
  const [editMode,  setEditMode]  = useState(false);
  const [techNotes, setTechNotes] = useState(wo.technician_notes || "");
  const [savingNotes, setSavingNotes] = useState(false);

  const tech = technicians.find(t => t.id === wo.assigned_to);

  const advance = async (next) => {
    setAdvancing(true);
    try {
      const extra = {};
      if (next === "in_progress") extra.started_at   = new Date().toISOString();
      if (next === "completed")   extra.completed_at = new Date().toISOString();
      await api.patch("work_orders", wo.id, { status:next, ...extra });
      onUpdate({ ...wo, status:next, ...extra });
    } catch(e) { console.error(e); } finally { setAdvancing(false); }
  };

  const saveNotes = async () => {
    setSavingNotes(true);
    try { await api.patch("work_orders", wo.id, { technician_notes: techNotes }); onUpdate({ ...wo, technician_notes: techNotes }); }
    catch(e) { console.error(e); } finally { setSavingNotes(false); }
  };

  const dur = currency();
  const laborCost = (wo.labor_hours||0) * (wo.labor_rate||0);
  const materialCost = Number(wo.material_cost||0);
  const total = Number(wo.total_cost||0) || (laborCost + materialCost);

  return (
    <div style={{ position:"fixed",inset:0,zIndex:2000,background:"rgba(0,0,0,0.6)",display:"flex",justifyContent:"flex-end" }}
      onClick={e=>{ if(e.target===e.currentTarget) onClose(); }}>
      <div style={{ width:"100%",maxWidth:520,background:C.ash,borderLeft:`1px solid ${C.smoke}`,height:"100%",overflowY:"auto",display:"flex",flexDirection:"column" }}>

        {/* Header */}
        <div style={{ padding:"18px 20px",borderBottom:`1px solid ${C.smoke}`,position:"sticky",top:0,background:C.ash,zIndex:1 }}>
          <div style={{ display:"flex",gap:8,alignItems:"center",marginBottom:6,flexWrap:"wrap" }}>
            <Pill status={wo.status}/>
            <PrioTag priority={wo.priority}/>
            <span style={{ fontSize:11,color:C.mist,padding:"2px 8px",background:C.smoke,borderRadius:10 }}>{wo.work_order_number}</span>
          </div>
          <div style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-start" }}>
            <div style={{ fontSize:15,fontWeight:700,color:C.white,lineHeight:1.4,flex:1 }}>{wo.title}</div>
            <div style={{ display:"flex",gap:6,flexShrink:0,marginLeft:10 }}>
              <Btn variant="secondary" size="sm" onClick={()=>setEditMode(true)} icon="✏️">Modifier</Btn>
              <button onClick={onClose} style={{ background:"none",border:"none",color:C.mist,fontSize:20,cursor:"pointer" }}>✕</button>
            </div>
          </div>
        </div>

        <div style={{ flex:1,padding:20,display:"flex",flexDirection:"column",gap:16 }}>

          {/* Stepper */}
          <Stepper status={wo.status} onAdvance={advance} loading={advancing}/>

          {/* Info grid */}
          <div style={{ background:C.coal,borderRadius:10,padding:16,border:`1px solid ${C.smoke}` }}>
            <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:12 }}>
              {[
                ["🏢 Client",       wo.customer?.name   || "—"],
                ["🏗 Bâtiment",     wo.building?.name   || "—"],
                ["🔧 Type",         WO_TYPES.find(t=>t.value===wo.type)?.label || wo.type || "—"],
                ["⚙️ Spécialité",   TRADES.find(t=>t.value===wo.trade)?.label  || "—"],
                ["📅 Prévu le",     wo.scheduled_date   ? new Date(wo.scheduled_date).toLocaleDateString("fr-FR") : "—"],
                ["🕐 Démarré le",   wo.started_at       ? new Date(wo.started_at).toLocaleString("fr-FR",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"}) : "—"],
                ["✅ Terminé le",   wo.completed_at     ? new Date(wo.completed_at).toLocaleString("fr-FR",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"}) : "—"],
                ["⏱ Heures",       wo.labor_hours      ? `${wo.labor_hours}h` : "—"],
              ].map(([label,val])=>(
                <div key={label}>
                  <div style={{ fontSize:10,color:C.mist,marginBottom:2 }}>{label}</div>
                  <div style={{ fontSize:12,color:C.frost,fontWeight:500 }}>{val}</div>
                </div>
              ))}
            </div>
            {/* Costs */}
            <div style={{ marginTop:12,paddingTop:12,borderTop:`1px solid ${C.smoke}`,display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8 }}>
              {[["💼 Main d'œuvre",fmt(laborCost)],["🔩 Matériaux",fmt(materialCost)],["💰 Total",fmt(total)]].map(([l,v],i)=>(
                <div key={l} style={{ textAlign:i===2?"right":"left" }}>
                  <div style={{ fontSize:10,color:C.mist,marginBottom:2 }}>{l}</div>
                  <div style={{ fontSize:i===2?15:13,fontWeight:i===2?800:500,color:i===2?C.warn:C.frost }}>{v}</div>
                </div>
              ))}
            </div>
            {/* Technician */}
            <div style={{ marginTop:12,paddingTop:12,borderTop:`1px solid ${C.smoke}` }}>
              <div style={{ fontSize:10,color:C.mist,marginBottom:6 }}>👤 Technicien</div>
              {tech ? (
                <div style={{ display:"flex",alignItems:"center",gap:8 }}>
                  <Avatar name={tech.full_name} size={28}/>
                  <div><div style={{ fontSize:12,fontWeight:600,color:C.white }}>{tech.full_name}</div><div style={{ fontSize:10,color:C.mist }}>{tech.role}</div></div>
                </div>
              ) : <div style={{ fontSize:12,color:C.steel }}>Non assigné</div>}
            </div>
          </div>

          {/* Description */}
          {wo.description && (
            <div style={{ background:C.coal,borderRadius:10,padding:14,border:`1px solid ${C.smoke}` }}>
              <div style={{ fontSize:10,color:C.mist,marginBottom:6,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.05em" }}>Description</div>
              <div style={{ fontSize:13,color:C.frost,lineHeight:1.7 }}>{wo.description}</div>
            </div>
          )}

          {/* Materials */}
          <MaterialsPanel woId={wo.id} api={api}/>

          {/* Technician notes */}
          <div style={{ background:C.coal,borderRadius:10,border:`1px solid ${C.smoke}`,overflow:"hidden" }}>
            <div style={{ padding:"11px 14px",borderBottom:`1px solid ${C.smoke}`,fontSize:11,fontWeight:700,color:C.frost,textTransform:"uppercase",letterSpacing:"0.06em" }}>📝 Notes technicien</div>
            <div style={{ padding:14,display:"flex",flexDirection:"column",gap:8 }}>
              <textarea value={techNotes} onChange={e=>setTechNotes(e.target.value)} rows={4}
                placeholder="Notes de terrain, observations, travaux effectués..."
                style={{ background:C.smoke,border:`1px solid ${C.steel}`,borderRadius:6,padding:"9px 12px",fontSize:12,color:C.white,resize:"vertical",fontFamily:"inherit",width:"100%" }}/>
              <Btn onClick={saveNotes} disabled={savingNotes} size="sm" variant="secondary" style={{ alignSelf:"flex-end" }}>
                {savingNotes?"Enregistrement…":"💾 Enregistrer les notes"}
              </Btn>
            </div>
          </div>

        </div>
      </div>

      {editMode && (
        <WOModal mode="edit" initial={wo}
          customers={[wo.customer ? {id:wo.customer_id,name:wo.customer.name}:null].filter(Boolean)}
          buildings={[wo.building  ? {id:wo.building_id,name:wo.building.name,customer_id:wo.customer_id}:null].filter(Boolean)}
          technicians={technicians} deficiencies={[]}
          onSave={async data => { await api.patch("work_orders",wo.id,data); onUpdate({...wo,...data}); setEditMode(false); }}
          onClose={()=>setEditMode(false)}/>
      )}
    </div>
  );
};

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
export default function WorkOrders({ user, supabase: sbConfig }) {
  const api = mkApi(sbConfig);
  const cid = user?.company_id;

  const [workOrders,   setWorkOrders]   = useState([]);
  const [customers,    setCustomers]    = useState([]);
  const [buildings,    setBuildings]    = useState([]);
  const [technicians,  setTechnicians]  = useState([]);
  const [deficiencies, setDeficiencies] = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState("");
  const [view,         setView]         = useState("list"); // "list" | "kanban"
  const [search,       setSearch]       = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showCreate,   setShowCreate]   = useState(false);
  const [selected,     setSelected]     = useState(null);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      // Fetch work orders with manual joins to avoid FK ambiguity
      const h = { apikey: sbConfig.anonKey, Authorization: `Bearer ${sbConfig.jwt}` };
      const rows = await fetch(`${sbConfig.url}/rest/v1/work_orders?company_id=eq.${cid}&select=*&order=created_at.desc`, { headers: h }).then(r=>r.json()).catch(()=>[]);

      if (rows?.length) {
        const custIds = [...new Set(rows.map(r=>r.customer_id).filter(Boolean))];
        const bldIds  = [...new Set(rows.map(r=>r.building_id).filter(Boolean))];
        const profIds = [...new Set(rows.map(r=>r.assigned_to).filter(Boolean))];
        const [custs,blds,profs] = await Promise.all([
          custIds.length ? fetch(`${sbConfig.url}/rest/v1/customers?id=in.(${custIds.join(",")})&select=id,name`,{headers:h}).then(r=>r.json()).catch(()=>[]) : [],
          bldIds.length  ? fetch(`${sbConfig.url}/rest/v1/buildings?id=in.(${bldIds.join(",")})&select=id,name`,{headers:h}).then(r=>r.json()).catch(()=>[]) : [],
          profIds.length ? fetch(`${sbConfig.url}/rest/v1/profiles?id=in.(${profIds.join(",")})&select=id,full_name,role`,{headers:h}).then(r=>r.json()).catch(()=>[]) : [],
        ]);
        const cm=Object.fromEntries((custs||[]).map(c=>[c.id,c]));
        const bm=Object.fromEntries((blds||[]).map(b=>[b.id,b]));
        const pm=Object.fromEntries((profs||[]).map(p=>[p.id,p]));
        setWorkOrders(rows.map(r=>({...r,customer:cm[r.customer_id]||null,building:bm[r.building_id]||null,technician:pm[r.assigned_to]||null})));
      } else {
        setWorkOrders([]);
      }

      const [custs, blds, techs, defs] = await Promise.all([
        api.get(`customers?company_id=eq.${cid}&is_active=eq.true&select=id,name&order=name.asc`),
        api.get(`buildings?company_id=eq.${cid}&select=id,name,customer_id&order=name.asc`),
        api.get(`profiles?company_id=eq.${cid}&select=id,full_name,role&order=full_name.asc`),
        api.get(`deficiencies?company_id=eq.${cid}&status=neq.closed&select=id,title,customer_id,building_id&order=identified_at.desc`),
      ]);
      setCustomers(custs||[]); setBuildings(blds||[]); setTechnicians(techs||[]); setDeficiencies(defs||[]);
    } catch(e) { setError(e.message); } finally { setLoading(false); }
  }, [cid]);

  useEffect(() => { load(); }, [load]);

  const filtered = workOrders.filter(w => {
    const ms = !search || w.title?.toLowerCase().includes(search.toLowerCase()) || w.customer?.name?.toLowerCase().includes(search.toLowerCase()) || w.work_order_number?.toLowerCase().includes(search.toLowerCase());
    const mf = statusFilter === "all" || w.status === statusFilter;
    return ms && mf;
  });

  const counts = workOrders.reduce((a,w)=>{ a[w.status]=(a[w.status]||0)+1; return a; }, {});

  // Generate WO number
  const genWONumber = () => {
    const prefix = "WO";
    const now = new Date();
    return `${prefix}${now.getFullYear().toString().slice(2)}${String(now.getMonth()+1).padStart(2,"0")}-${String(Math.floor(Math.random()*9000)+1000)}`;
  };

  const handleCreate = async (data) => {
    await api.post("work_orders", { ...data, company_id:cid, work_order_number:genWONumber(), created_by:user.id });
    // If linked to deficiency, update its status to in_repair
    if (data.deficiency_id) {
      try { await api.patch("deficiencies", data.deficiency_id, { status:"in_repair" }); } catch(e){}
    }
    setShowCreate(false);
    load();
  };

  const handleUpdate = (updated) => {
    setWorkOrders(prev => prev.map(w => w.id===updated.id ? {...w,...updated} : w));
    setSelected(updated);
  };

  // Kanban
  const byStatus = STATUS_FLOW.reduce((a,s) => { a[s.key]=filtered.filter(w=>w.status===s.key); return a; }, {});

  return (
    <div style={{ height:"100%",display:"flex",flexDirection:"column",background:C.coal }}>

      {/* ── TOOLBAR ── */}
      <div style={{ padding:"14px 24px",borderBottom:`1px solid ${C.smoke}`,display:"flex",alignItems:"center",gap:12,flexWrap:"wrap" }}>
        <div style={{ position:"relative" }}>
          <span style={{ position:"absolute",left:10,top:"50%",transform:"translateY(-50%)",fontSize:13,color:C.mist }}>🔍</span>
          <input placeholder="Rechercher..." value={search} onChange={e=>setSearch(e.target.value)}
            style={{ background:C.smoke,border:`1px solid ${C.steel}`,borderRadius:6,padding:"8px 12px 8px 32px",fontSize:12,color:C.frost,width:220 }}/>
        </div>

        <div style={{ display:"flex",gap:4,background:C.ash,border:`1px solid ${C.smoke}`,borderRadius:8,padding:4 }}>
          {[{value:"all",label:"Tous"},...STATUS_FLOW].map(s => (
            <button key={s.value||s.key} onClick={()=>setStatusFilter(s.value||s.key)}
              style={{ padding:"5px 11px",borderRadius:5,border:"none",background:statusFilter===(s.value||s.key)?C.flame:"transparent",color:statusFilter===(s.value||s.key)?"#fff":C.mist,fontSize:11,fontWeight:500,cursor:"pointer" }}>
              {s.label}
            </button>
          ))}
        </div>

        <div style={{ display:"flex",gap:4,background:C.ash,border:`1px solid ${C.smoke}`,borderRadius:8,padding:4 }}>
          {[["list","☰ Liste"],["kanban","⬛ Kanban"]].map(([v,l])=>(
            <button key={v} onClick={()=>setView(v)} style={{ padding:"5px 11px",borderRadius:5,border:"none",background:view===v?C.flame:"transparent",color:view===v?"#fff":C.mist,fontSize:11,cursor:"pointer" }}>{l}</button>
          ))}
        </div>

        <div style={{ flex:1 }}/>
        <Btn onClick={()=>setShowCreate(true)} icon="＋">Nouveau bon de travail</Btn>
      </div>

      {/* ── STATS ── */}
      <div style={{ padding:"10px 24px",borderBottom:`1px solid ${C.smoke}`,display:"flex",gap:10,flexWrap:"wrap" }}>
        {STATUS_FLOW.map(s=>(
          <div key={s.key} style={{ display:"flex",alignItems:"center",gap:6,padding:"4px 12px",borderRadius:20,background:s.bg,border:`1px solid ${s.color}30`,fontSize:11,fontWeight:600,color:s.color }}>
            {s.icon} {s.label} <span style={{ background:s.color,color:"#fff",borderRadius:10,padding:"0 5px",fontSize:10 }}>{counts[s.key]||0}</span>
          </div>
        ))}
        <div style={{ marginLeft:"auto",display:"flex",gap:6,alignItems:"center" }}>
          {PRIORITIES.filter(p=>p.value==="high"||p.value==="emergency").map(p=>{
            const n = workOrders.filter(w=>w.priority===p.value&&w.status!=="completed"&&w.status!=="cancelled").length;
            return n>0 ? <span key={p.value} style={{ fontSize:11,color:p.color,padding:"4px 10px",background:`${p.color}15`,borderRadius:10,fontWeight:600 }}>{p.label}: {n}</span> : null;
          })}
        </div>
      </div>

      {error && <div style={{ margin:"12px 24px",padding:"10px 14px",background:"#EF444418",border:"1px solid #EF444440",borderRadius:6,fontSize:12,color:"#EF4444",display:"flex",justifyContent:"space-between" }}>⚠️ {error}<button onClick={load} style={{ background:"none",border:"none",color:"#EF4444",cursor:"pointer" }}>↺ Réessayer</button></div>}

      {/* ── CONTENT ── */}
      <div style={{ flex:1,overflowY:"auto",padding:24 }}>
        {loading ? <Spinner/> : view==="list" ? (

          /* ═══ LIST ═══ */
          <div style={{ background:C.ash,borderRadius:10,border:`1px solid ${C.smoke}`,overflow:"hidden" }}>
            <div style={{ display:"grid",gridTemplateColumns:"60px 2fr 1fr 90px 100px 130px 110px 90px",padding:"10px 16px",background:"#111",fontSize:10,fontWeight:700,color:C.mist,textTransform:"uppercase",letterSpacing:"0.06em" }}>
              {["N°","Titre / Client","Bâtiment","Type","Priorité","Statut","Technicien","Date"].map(h=><div key={h}>{h}</div>)}
            </div>
            {filtered.length===0 ? <div style={{ padding:40,textAlign:"center",color:C.mist,fontSize:13 }}>Aucun bon de travail trouvé</div> :
              filtered.map((w,i)=>(
                <div key={w.id} onClick={()=>setSelected(w)}
                  style={{ display:"grid",gridTemplateColumns:"60px 2fr 1fr 90px 100px 130px 110px 90px",padding:"11px 16px",background:i%2===1?"#111":C.ash,borderBottom:`1px solid ${C.smoke}`,cursor:"pointer",transition:"background 0.12s",alignItems:"center" }}
                  onMouseEnter={e=>e.currentTarget.style.background=C.smoke}
                  onMouseLeave={e=>e.currentTarget.style.background=i%2===1?"#111":C.ash}>
                  <span style={{ fontSize:10,color:C.mist,fontFamily:"monospace" }}>{w.work_order_number?.slice(-6)}</span>
                  <div>
                    <div style={{ fontSize:12,fontWeight:600,color:C.white }}>{w.title}</div>
                    <div style={{ fontSize:10,color:C.mist,marginTop:2 }}>{w.customer?.name||"—"}</div>
                  </div>
                  <span style={{ fontSize:12,color:C.mist }}>{w.building?.name||"—"}</span>
                  <span style={{ fontSize:11,color:C.mist }}>{WO_TYPES.find(t=>t.value===w.type)?.label||w.type}</span>
                  <PrioTag priority={w.priority}/>
                  <Pill status={w.status}/>
                  <div style={{ display:"flex",alignItems:"center",gap:6 }}>
                    {w.technician ? <><Avatar name={w.technician.full_name} size={20}/><span style={{ fontSize:11,color:C.mist }}>{w.technician.full_name.split(" ")[0]}</span></> : <span style={{ fontSize:11,color:C.steel }}>—</span>}
                  </div>
                  <span style={{ fontSize:11,color:C.mist }}>{w.scheduled_date?new Date(w.scheduled_date).toLocaleDateString("fr-FR"):"—"}</span>
                </div>
              ))
            }
          </div>

        ) : (

          /* ═══ KANBAN ═══ */
          <div style={{ display:"flex",gap:14,alignItems:"flex-start",overflowX:"auto",paddingBottom:8 }}>
            {STATUS_FLOW.map(col=>(
              <div key={col.key} style={{ minWidth:220,maxWidth:240,flexShrink:0,display:"flex",flexDirection:"column" }}>
                <div style={{ display:"flex",alignItems:"center",gap:8,padding:"8px 10px",background:col.bg,borderRadius:"8px 8px 0 0",border:`1px solid ${col.color}30`,borderBottom:"none" }}>
                  <span>{col.icon}</span>
                  <span style={{ fontSize:12,fontWeight:700,color:col.color }}>{col.label}</span>
                  <span style={{ marginLeft:"auto",background:col.color,color:"#fff",borderRadius:10,padding:"0 6px",fontSize:10,fontWeight:700 }}>{byStatus[col.key]?.length||0}</span>
                </div>
                <div style={{ background:C.ash,border:`1px solid ${C.smoke}`,borderTop:`2px solid ${col.color}`,borderRadius:"0 0 8px 8px",padding:8,display:"flex",flexDirection:"column",gap:8,minHeight:80 }}>
                  {byStatus[col.key]?.length===0 && <div style={{ fontSize:11,color:C.steel,textAlign:"center",padding:"14px 8px" }}>Aucun</div>}
                  {byStatus[col.key]?.map(w=>(
                    <div key={w.id} onClick={()=>setSelected(w)}
                      style={{ background:C.coal,border:`1px solid ${C.smoke}`,borderRadius:8,padding:"10px 12px",cursor:"pointer",transition:"all 0.12s" }}
                      onMouseEnter={e=>{e.currentTarget.style.borderColor=col.color;e.currentTarget.style.background=C.smoke;}}
                      onMouseLeave={e=>{e.currentTarget.style.borderColor=C.smoke;e.currentTarget.style.background=C.coal;}}>
                      <div style={{ fontSize:12,fontWeight:600,color:C.white,marginBottom:6,lineHeight:1.3 }}>{w.title}</div>
                      <PrioTag priority={w.priority}/>
                      <div style={{ fontSize:11,color:C.mist,marginTop:6 }}>{w.customer?.name||"—"}</div>
                      {w.technician && <div style={{ display:"flex",alignItems:"center",gap:5,marginTop:6 }}><Avatar name={w.technician.full_name} size={18}/><span style={{ fontSize:10,color:C.mist }}>{w.technician.full_name}</span></div>}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showCreate && <WOModal mode="create" customers={customers} buildings={buildings} technicians={technicians} deficiencies={deficiencies} onSave={handleCreate} onClose={()=>setShowCreate(false)}/>}
      {selected && <DetailPanel wo={selected} technicians={technicians} api={api} onUpdate={handleUpdate} onClose={()=>setSelected(null)}/>}
    </div>
  );
}
