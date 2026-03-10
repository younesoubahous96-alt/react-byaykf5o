// ============================================================
// FireSafe Pro — Customers Module
// Customers.jsx
// ============================================================
// Usage in App.jsx:
//   import Customers from './Customers';
//   customers: { component: <Customers user={user} supabase={{ url, anonKey, jwt }} /> }
// ============================================================

import React, { useState, useEffect, useCallback } from "react";

const C = {
  flame:"#FF4500", flameLight:"#FF6A33", flameDark:"#CC3700",
  ember:"#FF8C00", coal:"#0D0D0D", ash:"#1A1A1A", smoke:"#2A2A2A",
  steel:"#3A3A3A", mist:"#8A8A8A", frost:"#E8E8E8", white:"#FAFAFA",
  safe:"#22C55E", warn:"#F59E0B", danger:"#EF4444", info:"#3B82F6",
};

// ─── SUPABASE CLIENT ──────────────────────────────────────────────────────────
const makeDB = ({ url, anonKey, jwt }) => {
  let _token = jwt;
  const h = (extra={}) => ({
    "Content-Type": "application/json",
    "apikey": anonKey,
    "Authorization": `Bearer ${_token || jwt}`,
    "Prefer": "return=representation",
    ...extra,
  });
  const from = (table) => {
    const params = new URLSearchParams();
    const headers = h();
    const b = {
      select: (c="*") => { params.set("select",c); return b; },
      eq:     (c,v)   => { params.append(c,`eq.${v}`); return b; },
      neq:    (c,v)   => { params.append(c,`neq.${v}`); return b; },
      order:  (c,asc=true) => { params.append("order",`${c}.${asc?"asc":"desc"}`); return b; },
      limit:  (n)     => { params.set("limit",n); return b; },
      single: ()      => { headers["Accept"]="application/vnd.pgrst.object+json"; return b; },
      async get() {
        const qs = params.toString();
        const res = await fetch(`${url}/rest/v1/${table}${qs?"?"+qs:""}`, { headers });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message||data.hint||JSON.stringify(data));
        return data;
      },
      async insert(body) {
        const res = await fetch(`${url}/rest/v1/${table}`, { method:"POST", headers:h(), body:JSON.stringify(body) });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message||JSON.stringify(data));
        return Array.isArray(data)?data[0]:data;
      },
      async patch(body) {
        const qs = params.toString();
        const res = await fetch(`${url}/rest/v1/${table}${qs?"?"+qs:""}`, { method:"PATCH", headers:h(), body:JSON.stringify(body) });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message||JSON.stringify(data));
        return Array.isArray(data)?data[0]:data;
      },
      async del() {
        const qs = params.toString();
        const res = await fetch(`${url}/rest/v1/${table}${qs?"?"+qs:""}`, { method:"DELETE", headers:h() });
        if (!res.ok) { const data = await res.json(); throw new Error(data.message||JSON.stringify(data)); }
        return true;
      },
    };
    return b;
  };
  return { from };
};

// ─── SHARED UI ────────────────────────────────────────────────────────────────
const Spinner = ({ size=16 }) => (
  <span style={{ width:size,height:size,border:"2px solid rgba(255,255,255,0.15)",borderTopColor:"#fff",borderRadius:"50%",display:"inline-block",animation:"csSpin 0.7s linear infinite" }}/>
);

const Btn = ({ children, variant="primary", size="md", icon, onClick, disabled=false, full=false, style={} }) => {
  const vs = {
    primary:  { bg:C.flame,         color:"#fff",   hov:C.flameLight, border:"none" },
    secondary:{ bg:"transparent",   color:C.frost,  hov:C.smoke,      border:`1px solid ${C.steel}` },
    ghost:    { bg:"transparent",   color:C.mist,   hov:C.smoke,      border:"none" },
    danger:   { bg:`${C.danger}18`, color:C.danger, hov:`${C.danger}28`, border:`1px solid ${C.danger}40` },
    success:  { bg:`${C.safe}18`,   color:C.safe,   hov:`${C.safe}28`, border:`1px solid ${C.safe}40` },
  };
  const v = vs[variant]||vs.primary;
  const pad = size==="sm"?"5px 12px":size==="lg"?"12px 24px":"8px 16px";
  return (
    <button disabled={disabled} onClick={onClick}
      style={{ display:"inline-flex",alignItems:"center",justifyContent:"center",gap:6,padding:pad,
        fontSize:size==="sm"?12:13,fontWeight:500,background:v.bg,color:v.color,
        border:v.border||"none",borderRadius:6,transition:"tous 0.15s",
        opacity:disabled?0.45:1,cursor:disabled?"not-tousowed":"pointer",
        width:full?"100%":"auto",fontFamily:"inherit",...style }}
      onMouseEnter={e=>{ if(!disabled) e.currentTarget.style.background=v.hov; }}
      onMouseLeave={e=>{ if(!disabled) e.currentTarget.style.background=v.bg; }}>
      {icon && <span style={{fontSize:size==="sm"?13:15}}>{icon}</span>}
      {children}
    </button>
  );
};

const Badge = ({ children, type="default" }) => {
  const m = { default:{bg:`${C.mist}18`,color:C.mist}, success:{bg:`${C.safe}18`,color:C.safe}, danger:{bg:`${C.danger}18`,color:C.danger}, warning:{bg:`${C.warn}18`,color:C.warn}, info:{bg:`${C.info}18`,color:C.info} };
  const s = m[type]||m.default;
  return <span style={{ display:"inline-flex",alignItems:"center",padding:"2px 8px",borderRadius:20,fontSize:11,fontWeight:500,background:s.bg,color:s.color,whiteSpace:"nowrap" }}>{children}</span>;
};

const Card = ({ children, style={}, onClick }) => (
  <div onClick={onClick} style={{ background:C.ash,border:`1px solid ${C.smoke}`,borderRadius:8,...style,cursor:onClick?"pointer":"default" }}
    onMouseEnter={e=>{ if(onClick) e.currentTarget.style.borderColor=C.steel; }}
    onMouseLeave={e=>{ if(onClick) e.currentTarget.style.borderColor=C.smoke; }}>
    {children}
  </div>
);

const Field = ({ label, required, error, hint, children }) => (
  <div style={{ display:"flex",flexDirection:"column",gap:6 }}>
    {label && <label style={{ fontSize:11,fontWeight:500,color:C.mist,textTransform:"uppercase",letterSpacing:"0.05em" }}>
      {label}{required&&<span style={{color:C.flame}}> *</span>}
    </label>}
    {children}
    {error && <span style={{ fontSize:11,color:C.danger }}>{error}</span>}
    {hint  && <span style={{ fontSize:11,color:C.mist  }}>{hint}</span>}
  </div>
);

const Input = ({ value, onChange, placeholder, type="text", error }) => (
  <input type={type} value={value||""} onChange={e=>onChange(e.target.value)} placeholder={placeholder}
    style={{ width:"100%",padding:"9px 12px",background:C.smoke,border:`1px solid ${error?C.danger:C.steel}`,
      borderRadius:6,color:C.white,fontSize:13,fontFamily:"inherit",transition:"border-color 0.15s" }}
    onFocus={e=>e.target.style.borderColor=C.flame}
    onBlur={e=>e.target.style.borderColor=error?C.danger:C.steel}
  />
);

const Textarea = ({ value, onChange, placeholder, rows=3 }) => (
  <textarea value={value||""} onChange={e=>onChange(e.target.value)} placeholder={placeholder} rows={rows}
    style={{ width:"100%",padding:"9px 12px",background:C.smoke,border:`1px solid ${C.steel}`,
      borderRadius:6,color:C.white,fontSize:13,fontFamily:"inherit",resize:"vertical",lineHeight:1.5 }}
    onFocus={e=>e.target.style.borderColor=C.flame}
    onBlur={e=>e.target.style.borderColor=C.steel}
  />
);

const Select = ({ value, onChange, options, placeholder="Sélectionner..." }) => (
  <select value={value||""} onChange={e=>onChange(e.target.value)}
    style={{ width:"100%",padding:"9px 12px",background:C.smoke,border:`1px solid ${C.steel}`,
      borderRadius:6,color:value?C.white:C.mist,fontSize:13,fontFamily:"inherit" }}>
    <option value="">{placeholder}</option>
    {options.map(o => <option key={o.value||o} value={o.value||o}>{o.label||o}</option>)}
  </select>
);

const Avatar = ({ name="?", size=36 }) => {
  const initials = name.split(" ").map(n=>n[0]).join("").slice(0,2).toUpperCase();
  const hue = (name.charCodeAt(0)*37)%360;
  return <div style={{ width:size,height:size,borderRadius:"50%",background:`hsl(${hue},50%,35%)`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:size*0.35,fontWeight:700,color:"#fff",flexShrink:0 }}>{initials}</div>;
};

const Divider = ({ label }) => (
  <div style={{ display:"flex",alignItems:"center",gap:12,margin:"4px 0" }}>
    {label && <span style={{ fontSize:11,color:C.mist,textTransform:"uppercase",letterSpacing:"0.06em",whiteSpace:"nowrap" }}>{label}</span>}
    <div style={{ flex:1,height:1,background:C.smoke }}/>
  </div>
);

const ErrorBanner = ({ msg }) => (
  <div style={{ padding:"10px 14px",background:`${C.danger}12`,border:`1px solid ${C.danger}30`,borderRadius:8,fontSize:13,color:C.danger,display:"flex",gap:8,alignItems:"center" }}>
    ⚠ {msg}
  </div>
);

// ─── MODAL ────────────────────────────────────────────────────────────────────
const Modal = ({ title, onClose, children, width=540 }) => (
  <div style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.7)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000,padding:20 }}
    onClick={e=>e.target===e.currentTarget&&onClose()}>
    <div style={{ background:C.ash,border:`1px solid ${C.smoke}`,borderRadius:12,width:"100%",maxWidth:width,maxHeight:"90vh",display:"flex",flexDirection:"column",animation:"csSlideUp 0.2s ease" }}>
      <div style={{ padding:"16px 20px",borderBottom:`1px solid ${C.smoke}`,display:"flex",alignItems:"center",justifyContent:"space-between",flexShrink:0 }}>
        <h2 style={{ fontSize:15,fontWeight:700,color:C.white }}>{title}</h2>
        <button onClick={onClose} style={{ background:"none",border:"none",color:C.mist,cursor:"pointer",fontSize:20,lineHeight:1,padding:4 }}>×</button>
      </div>
      <div style={{ overflowY:"auto",flex:1 }}>{children}</div>
    </div>
  </div>
);

// ─── CUSTOMER FORM MODAL ──────────────────────────────────────────────────────
const US_STATES = ["AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY"];

const CustomerFormModal = ({ customer, companyId, db, onSave, onClose }) => {
  const isEdit = !!customer?.id;
  const [form, setForm] = useState({
    name: "", email: "", phone: "", address: "", city: "", state: "", zip: "",
    contact_name: "", contact_email: "", contact_phone: "", notes: "", is_active: true,
    ...(customer || {}),
  });
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState(null);
  const [errors, setErrors] = useState({});

  const set = (key) => (val) => setForm(f => ({ ...f, [key]: val }));

  const validate = () => {
    const e = {};
    if (!form.name?.trim()) e.name = "Le nom de l'entreprise est obligatoire";
    if (form.email && !/^\S+@\S+\.\S+$/.test(form.email)) e.email = "E-mail invalide";
    if (form.contact_email && !/^\S+@\S+\.\S+$/.test(form.contact_email)) e.contact_email = "E-mail invalide";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true); setError(null);
    try {
      let saved;
      if (isEdit) {
        saved = await db.from("customers").eq("id", customer.id).patch({ ...form, updated_at: new Date().toISOString() });
      } else {
        saved = await db.from("customers").insert({ ...form, company_id: companyId });
      }
      onSave(saved);
    } catch(e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={isEdit ? `Modifier ${customer.name}` : "Ajouter un client"} onClose={onClose}>
      <div style={{ padding:20, display:"flex", flexDirection:"column", gap:16 }}>
        {error && <ErrorBanner msg={error}/>}

        <Divider label="Informations de l'entreprise"/>
        <Field label="Nom de l'entreprise" required error={errors.name}>
          <Input value={form.name} onChange={set("name")} placeholder="Riverside Mtous LLC" error={errors.name}/>
        </Field>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
          <Field label="E-mail" error={errors.email}>
            <Input value={form.email} onChange={set("email")} placeholder="info@company.com" type="email" error={errors.email}/>
          </Field>
          <Field label="Téléphone">
            <Input value={form.phone} onChange={set("phone")} placeholder="(555) 000-0000"/>
          </Field>
        </div>

        <Divider label="Adresse"/>
        <Field label="Adresse">
          <Input value={form.address} onChange={set("address")} placeholder="12 rue de la Paix"/>
        </Field>
        <div style={{ display:"grid", gridTemplateColumns:"2fr 1fr 1fr", gap:12 }}>
          <Field label="Ville">
            <Input value={form.city} onChange={set("city")} placeholder="Paris"/>
          </Field>
          <Field label="Région">
            <Select value={form.state} onChange={set("state")} options={US_STATES} placeholder="ST"/>
          </Field>
          <Field label="Code postal">
            <Input value={form.zip} onChange={set("zip")} placeholder="02101"/>
          </Field>
        </div>

        <Divider label="Contact principal"/>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
          <Field label="Nom du contact">
            <Input value={form.contact_name} onChange={set("contact_name")} placeholder="Jane Smith"/>
          </Field>
          <Field label="Contact Téléphone">
            <Input value={form.contact_phone} onChange={set("contact_phone")} placeholder="(555) 000-0001"/>
          </Field>
        </div>
        <Field label="Contact E-mail" error={errors.contact_email}>
          <Input value={form.contact_email} onChange={set("contact_email")} placeholder="jane@company.com" type="email" error={errors.contact_email}/>
        </Field>

        <Divider label="Notes"/>
        <Field label="Notes internes">
          <Textarea value={form.notes} onChange={set("notes")} placeholder="Notes sur ce client..." rows={3}/>
        </Field>

        {isEdit && (
          <Field label="Statut">
            <div style={{ display:"flex", gap:10 }}>
              {[true, false].map(v => (
                <button key={String(v)} onClick={() => set("is_active")(v)}
                  style={{ flex:1, padding:"8px", borderRadius:6, border:`1px solid ${form.is_active===v?(v?C.safe:C.danger):C.steel}`,
                    background:form.is_active===v?(v?`${C.safe}15`:`${C.danger}15`):"transparent",
                    color:form.is_active===v?(v?C.safe:C.danger):C.mist, fontSize:13, cursor:"pointer", fontFamily:"inherit" }}>
                  {v ? "Actif" : "Inactif"}
                </button>
              ))}
            </div>
          </Field>
        )}

        <div style={{ display:"flex", gap:10, paddingTop:8 }}>
          <Btn variant="secondary" onClick={onClose} full>Annuler</Btn>
          <Btn onClick={handleSave} disabled={saving} full>
            {saving ? <><Spinner/> Enregistrement...</> : isEdit ? "Enregistrer" : "Ajouter un client"}
          </Btn>
        </div>
      </div>
    </Modal>
  );
};

// ─── BUILDING FORM MODAL ──────────────────────────────────────────────────────
const OCCUPANCY_TYPES = ["Assembly","Business","Educational","Factory/Industrial","Government","Healthcare","High-Rise","Hotel/Motel","Mercantile","Mixed-Use","Multi-Family Residential","Single-Family Residential","Storage","Utility/Misc","Warehouse"];

const BuildingFormModal = ({ building, customer, companyId, db, onSave, onClose }) => {
  const isEdit = !!building?.id;
  const [form, setForm] = useState({
    name:"", address:"", city:"", state:"", zip:"", étages:"", sq_footage:"",
    occupancy_type:"", construction_year:"", notes:"", is_active:true,
    ...(building || {}),
  });
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState(null);
  const [errors, setErrors] = useState({});

  const set = (key) => (val) => setForm(f => ({ ...f, [key]: val }));

  const validate = () => {
    const e = {};
    if (!form.name?.trim()) e.name = "Le nom du bâtiment est obligatoire";
    if (!form.address?.trim()) e.address = "Adresse is required";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true); setError(null);
    try {
      const payload = {
        ...form,
        étages:            form.étages ? parseInt(form.étages) : null,
        sq_footage:        form.sq_footage ? parseInt(form.sq_footage) : null,
        construction_year: form.construction_year ? parseInt(form.construction_year) : null,
      };
      let saved;
      if (isEdit) {
        saved = await db.from("buildings").eq("id", building.id).patch({ ...payload, updated_at: new Date().toISOString() });
      } else {
        saved = await db.from("buildings").insert({ ...payload, company_id: companyId, customer_id: customer.id });
      }
      onSave(saved);
    } catch(e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={isEdit ? `Modifier ${building.name}` : `Ajouter un bâtiment — ${customer.name}`} onClose={onClose}>
      <div style={{ padding:20, display:"flex", flexDirection:"column", gap:16 }}>
        {error && <ErrorBanner msg={error}/>}

        <Divider label="Informations du bâtiment"/>
        <Field label="Nom du bâtiment" required error={errors.name}>
          <Input value={form.name} onChange={set("name")} placeholder="Campus principal — Tour Nord" error={errors.name}/>
        </Field>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
          <Field label="Type d'occupation">
            <Select value={form.occupancy_type} onChange={set("occupancy_type")} options={OCCUPANCY_TYPES} placeholder="Sélectionner un type..."/>
          </Field>
          <Field label="Année de construction">
            <Input value={form.construction_year} onChange={set("construction_year")} placeholder="1998" type="number"/>
          </Field>
        </div>

        <Divider label="Adresse"/>
        <Field label="Adresse" required error={errors.address}>
          <Input value={form.address} onChange={set("address")} placeholder="12 rue de la Paix" error={errors.address}/>
        </Field>
        <div style={{ display:"grid", gridTemplateColumns:"2fr 1fr 1fr", gap:12 }}>
          <Field label="Ville"><Input value={form.city} onChange={set("city")} placeholder="Paris"/></Field>
          <Field label="Région"><Select value={form.state} onChange={set("state")} options={US_STATES} placeholder="ST"/></Field>
          <Field label="Code postal"><Input value={form.zip} onChange={set("zip")} placeholder="02101"/></Field>
        </div>

        <Divider label="Details"/>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
          <Field label="Étages">
            <Input value={form.étages} onChange={set("étages")} placeholder="4" type="number"/>
          </Field>
          <Field label="Surface (m²)">
            <Input value={form.sq_footage} onChange={set("sq_footage")} placeholder="4200" type="number"/>
          </Field>
        </div>
        <Field label="Notes">
          <Textarea value={form.notes} onChange={set("notes")} placeholder="Codes d'accès, parking, instructions particulières..."/>
        </Field>

        <div style={{ display:"flex", gap:10, paddingTop:8 }}>
          <Btn variant="secondary" onClick={onClose} full>Annuler</Btn>
          <Btn onClick={handleSave} disabled={saving} full>
            {saving ? <><Spinner/> Enregistrement...</> : isEdit ? "Enregistrer" : "Ajouter un bâtiment"}
          </Btn>
        </div>
      </div>
    </Modal>
  );
};

// ─── CUSTOMER DETAIL VIEW ─────────────────────────────────────────────────────
const CustomerDetail = ({ customer, db, companyId, onBack, onModifier }) => {
  const [buildings,    setBuildings]    = useState([]);
  const [inspections,  setInspections]  = useState([]);
  const [deficiencies, setDeficiencies] = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState(null);
  const [buildingModal,setBuildingModal]= useState(null); // null | "new" | building object
  const [actifsTab,    setActifTab]    = useState("buildings");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [bldgs, insps, defs] = await Promise.all([
        db.from("buildings").select("*").eq("customer_id", customer.id).order("name").get(),
        db.from("inspections").select("id,status,trade,scheduled_date,score,building:buildings(name),technician:profiles(full_name)").eq("customer_id", customer.id).order("scheduled_date", false).limit(10).get(),
        db.from("deficiencies").select("id,title,severity,status,identified_at,building:buildings(name)").eq("customer_id", customer.id).order("identified_at", false).limit(10).get(),
      ]);
      setBuildings(bldgs || []);
      setInspections(insps || []);
      setDeficiencies(defs || []);
    } catch(e) { setError(e.message); }
    finally { setLoading(false); }
  }, [customer.id]);

  useEffect(() => { load(); }, [load]);

  const handleBuildingSave = (saved) => {
    setBuildings(prev => {
      const idx = prev.findIndex(b => b.id === saved.id);
      return idx >= 0 ? prev.map(b => b.id===saved.id?saved:b) : [saved, ...prev];
    });
    setBuildingModal(null);
  };

  const handleDeleteBuilding = async (bldg) => {
    if (!window.confirm(`Supprimer "${bldg.name}"? This cannot be undone.`)) return;
    try {
      await db.from("buildings").eq("id", bldg.id).del();
      setBuildings(prev => prev.filter(b => b.id !== bldg.id));
    } catch(e) { alert("Supprimer failed: " + e.message); }
  };

  const statusColor = { scheduled:"default", in_progress:"info", completed:"success", deficient:"danger", cancelled:"default" };
  const sevColor    = { critical:"danger", high:"warning", medium:"info", low:"default" };
  const statColor   = { ouverte:"danger", quoted:"warning", in_repair:"info", repaired:"success", verified:"success", closed:"default" };

  const tabs = [
    { id:"buildings",    label:`Bâtiments (${buildings.length})` },
    { id:"inspections",  label:`Inspections (${inspections.length})` },
    { id:"deficiencies", label:`Deficiencies (${deficiencies.filter(d=>d.status==="ouverte").length} ouverte)` },
  ];

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100%", animation:"csSlideIn 0.2s ease" }}>
      {/* Header */}
      <div style={{ padding:"14px 20px", borderBottom:`1px solid ${C.smoke}`, display:"flex", alignItems:"center", gap:14, flexShrink:0 }}>
        <button onClick={onBack} style={{ background:"none",border:"none",color:C.mist,cursor:"pointer",fontSize:20,padding:"0 4px" }}>←</button>
        <Avatar name={customer.name} size={40}/>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontSize:15, fontWeight:700, color:C.white }}>{customer.name}</div>
          <div style={{ fontSize:11, color:C.mist, marginTop:2 }}>
            {[customer.city, customer.state].filter(Boolean).join(", ")}
            {customer.contact_name && ` · ${customer.contact_name}`}
          </div>
        </div>
        <Badge type={customer.is_active?"success":"default"}>{customer.is_active?"Actif":"Inactif"}</Badge>
        <Btn variant="secondary" size="sm" onClick={onEdit}>✏ Edit</Btn>
        <Btn size="sm" icon="+" onClick={() => setBuildingModal("new")}>Ajouter un bâtiment</Btn>
      </div>

      {/* Info strip */}
      <div style={{ padding:"12px 20px", background:`${C.smoke}50`, borderBottom:`1px solid ${C.smoke}`, display:"flex", gap:24, flexWrap:"wrap", flexShrink:0 }}>
        {[
          { label:"E-mail",   value: customer.email,         href:`mailto:${customer.email}` },
          { label:"Téléphone",   value: customer.phone,         href:`tel:${customer.phone}` },
          { label:"Contact", value: customer.contact_name   },
          { label:"Adresse", value: [customer.address, customer.city, customer.state, customer.zip].filter(Boolean).join(", ") },
        ].filter(f => f.value).map((f,i) => (
          <div key={i}>
            <div style={{ fontSize:10, color:C.mist, textTransform:"uppercase", letterSpacing:"0.05em" }}>{f.label}</div>
            {f.href
              ? <a href={f.href} style={{ fontSize:12, color:C.info, textDecoration:"none" }}>{f.value}</a>
              : <div style={{ fontSize:12, color:C.frost }}>{f.value}</div>
            }
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display:"flex", borderBottom:`1px solid ${C.smoke}`, background:C.ash, paddingLeft:20, gap:0, flexShrink:0 }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setActifTab(t.id)}
            style={{ padding:"10px 16px", border:"none", borderBottom:`2px solid ${actifsTab===t.id?C.flame:"transparent"}`,
              background:"transparent", color:actifsTab===t.id?C.flame:C.mist, fontSize:12, fontWeight:actifsTab===t.id?600:400,
              cursor:"pointer", whiteSpace:"nowrap", transition:"tous 0.15s" }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div style={{ flex:1, overflowY:"auto", padding:20 }}>
        {loading && <div style={{ textAlign:"center", padding:40, color:C.mist }}><Spinner size={20}/></div>}
        {error   && <ErrorBanner msg={error}/>}

        {/* Bâtiments tab */}
        {!loading && actifsTab === "buildings" && (
          <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
            {buildings.length === 0 && (
              <div style={{ padding:40, textAlign:"center" }}>
                <div style={{ fontSize:36, marginBottom:12 }}>🏢</div>
                <div style={{ fontSize:14, fontWeight:600, color:C.frost, marginBottom:8 }}>Aucun bâtiment pour l'instant</div>
                <div style={{ fontSize:13, color:C.mist, marginBottom:20 }}>Ajoutez le premier bâtiment pour ce client</div>
                <Btn icon="+" onClick={() => setBuildingModal("new")}>Ajouter un bâtiment</Btn>
              </div>
            )}
            {buildings.map(b => (
              <Card key={b.id} style={{ padding:16 }}>
                <div style={{ display:"flex", alignItems:"flex-start", gap:12 }}>
                  <div style={{ width:40,height:40,borderRadius:8,background:`${C.info}15`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,flexShrink:0 }}>🏢</div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontWeight:600, fontSize:13, color:C.white }}>{b.name}</div>
                    <div style={{ fontSize:11, color:C.mist, marginTop:3 }}>
                      {b.address}{b.city?`, ${b.city}`:""}
                      {b.occupancy_type && <span style={{ marginLeft:8 }}><Badge type="default">{b.occupancy_type}</Badge></span>}
                    </div>
                    <div style={{ display:"flex", gap:12, marginTop:6, flexWrap:"wrap" }}>
                      {b.étages      && <span style={{ fontSize:11, color:C.mist }}>🏗 {b.étages} étage{b.étages!==1?"s":""}</span>}
                      {b.sq_footage  && <span style={{ fontSize:11, color:C.mist }}>📐 {Number(b.sq_footage).toLocaleString()} m²</span>}
                      {b.construction_year && <span style={{ fontSize:11, color:C.mist }}>📅 Construit en {b.construction_year}</span>}
                    </div>
                  </div>
                  <div style={{ display:"flex", gap:6, flexShrink:0 }}>
                    <Btn variant="secondary" size="sm" onClick={() => setBuildingModal(b)}>✏ Edit</Btn>
                    <Btn variant="danger" size="sm" onClick={() => handleDeleteBuilding(b)}>🗑</Btn>
                  </div>
                </div>
                {b.notes && <div style={{ marginTop:10, fontSize:12, color:C.mist, borderTop:`1px solid ${C.smoke}`, paddingTop:10 }}>{b.notes}</div>}
              </Card>
            ))}
          </div>
        )}

        {/* Inspections tab */}
        {!loading && actifsTab === "inspections" && (
          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            {inspections.length === 0 && (
              <div style={{ padding:40, textAlign:"center", color:C.mist, fontSize:13 }}>Aucune inspection trouvée pour ce client.</div>
            )}
            {inspections.map(ins => (
              <Card key={ins.id} style={{ padding:"12px 16px" }}>
                <div style={{ display:"flex", alignItems:"center", gap:12 }}>
                  <div style={{ fontSize:22 }}>{ins.trade==="fire_alarm"?"🔔":ins.trade==="sprinkler"?"💧":ins.trade==="extinguisher"?"🧯":"🔥"}</div>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:13, fontWeight:500, color:C.white }}>{ins.building?.name}</div>
                    <div style={{ fontSize:11, color:C.mist }}>
                      {ins.trade?.replace(/_/g," ")} · {ins.scheduled_date}
                      {ins.technician?.full_name && ` · ${ins.technician.full_name}`}
                    </div>
                  </div>
                  {ins.score != null && (
                    <span style={{ fontSize:15, fontWeight:700, color:ins.score>=80?C.safe:ins.score>=60?C.warn:C.danger }}>{ins.score}%</span>
                  )}
                  <Badge type={statusColor[ins.status]||"default"}>{ins.status?.replace("_"," ")}</Badge>
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* Deficiencies tab */}
        {!loading && actifsTab === "deficiencies" && (
          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            {deficiencies.length === 0 && (
              <div style={{ padding:40, textAlign:"center", color:C.mist, fontSize:13 }}>Aucune déficience trouvée. ✓ Tout est en ordre !</div>
            )}
            {deficiencies.map(d => (
              <Card key={d.id} style={{ padding:"12px 16px", borderColor:d.status==="ouverte"?`${C.danger}40`:C.smoke }}>
                <div style={{ display:"flex", alignItems:"flex-start", gap:12 }}>
                  <div>
                    <div style={{ fontSize:13, fontWeight:500, color:C.white, marginBottom:4 }}>{d.title}</div>
                    <div style={{ fontSize:11, color:C.mist }}>{d.building?.name} · {new Date(d.identified_at).toLocaleDateString()}</div>
                  </div>
                  <div style={{ marginLeft:"auto", display:"flex", gap:6, flexShrink:0 }}>
                    <Badge type={sevColor[d.severity]||"default"}>{d.severity}</Badge>
                    <Badge type={statColor[d.status]||"default"}>{d.status?.replace("_"," ")}</Badge>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Building modal */}
      {buildingModal && (
        <BuildingFormModal
          building={buildingModal === "new" ? null : buildingModal}
          customer={customer}
          companyId={companyId}
          db={db}
          onSave={handleBuildingSave}
          onClose={() => setBuildingModal(null)}
        />
      )}
    </div>
  );
};

// ─── CUSTOMERS LIST ───────────────────────────────────────────────────────────
const CustomersList = ({ db, companyId, onSelect, onAdd }) => {
  const [customers, setCustomers] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState(null);
  const [search,    setSearch]    = useState("");
  const [filter,    setFilter]    = useState("actifs"); // actifs | tous | inactifs

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const q = db.from("customers")
        .select("*,buildings(id)")
        .eq("company_id", companyId)
        .order("name");
      if (filter === "actifs")   q.eq("is_active", true);
      if (filter === "inactifs") q.eq("is_active", false);
      const data = await q.get();
      setCustomers(data || []);
    } catch(e) { setError(e.message); }
    finally { setLoading(false); }
  }, [companyId, filter]);

  useEffect(() => { load(); }, [load]);

  const filtered = customers.filter(c =>
    c.name?.toLowerCase().includes(search.toLowerCase()) ||
    c.contact_name?.toLowerCase().includes(search.toLowerCase()) ||
    c.city?.toLowerCase().includes(search.toLowerCase()) ||
    c.email?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100%" }}>
      {/* Toolbar */}
      <div style={{ padding:"14px 20px", borderBottom:`1px solid ${C.smoke}`, display:"flex", gap:12, alignItems:"center", flexShrink:0, flexWrap:"wrap" }}>
        {/* Search */}
        <div style={{ position:"relative", flex:1, minWidth:200 }}>
          <span style={{ position:"absolute",left:10,top:"50%",transform:"translateY(-50%)",color:C.mist,pointerEvents:"none" }}>🔍</span>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Rechercher un client..."
            style={{ width:"100%",padding:"8px 12px 8px 32px",background:C.smoke,border:`1px solid ${C.steel}`,borderRadius:6,color:C.frost,fontSize:13,fontFamily:"inherit" }}
            onFocus={e=>e.target.style.borderColor=C.flame} onBlur={e=>e.target.style.borderColor=C.steel}/>
        </div>

        {/* Filter tabs */}
        <div style={{ display:"flex", gap:2, background:C.smoke, borderRadius:6, padding:3 }}>
          {["actifs","tous","inactifs"].map(f => (
            <button key={f} onClick={() => setFilter(f)}
              style={{ padding:"5px 12px",borderRadius:4,border:"none",background:filter===f?C.flame:"transparent",
                color:filter===f?"#fff":C.mist,fontSize:12,fontWeight:filter===f?600:400,cursor:"pointer",
                textTransform:"capitalize",fontFamily:"inherit",transition:"tous 0.12s" }}>
              {f}
            </button>
          ))}
        </div>

        <Btn icon="+" onClick={onAdd}>Ajouter un client</Btn>
      </div>

      {/* Stats row */}
      <div style={{ padding:"10px 20px", borderBottom:`1px solid ${C.smoke}`, display:"flex", gap:20, fontSize:12, color:C.mist, flexShrink:0 }}>
        <span><b style={{ color:C.white }}>{filtered.length}</b> clients affichés</span>
        <span><b style={{ color:C.white }}>{filtered.reduce((s,c)=>s+(c.buildings?.length||0),0)}</b> bâtiments au total</span>
      </div>

      {/* List */}
      <div style={{ flex:1, overflowY:"auto" }}>
        {loading && (
          <div style={{ padding:40, textAlign:"center", color:C.mist }}><Spinner size={20}/><div style={{ marginTop:10, fontSize:13 }}>Chargement des clients...</div></div>
        )}
        {!loading && error && <div style={{ padding:20 }}><ErrorBanner msg={error}/></div>}
        {!loading && !error && filtered.length === 0 && (
          <div style={{ padding:60, textAlign:"center" }}>
            <div style={{ fontSize:48, marginBottom:12 }}>👥</div>
            <div style={{ fontSize:15, fontWeight:600, color:C.frost, marginBottom:8 }}>
              {search ? "Aucun client ne correspond à votre recherche" : "Aucun client pour l'instant"}
            </div>
            <div style={{ fontSize:13, color:C.mist, marginBottom:20 }}>
              {search ? "Essayez un autre terme de recherche" : "Ajoutez votre premier client pour commencer"}
            </div>
            {!search && <Btn icon="+" onClick={onAdd}>Ajouter le premier client</Btn>}
          </div>
        )}

        {!loading && filtered.map(c => (
          <div key={c.id} onClick={() => onSelect(c)}
            style={{ padding:"14px 20px", borderBottom:`1px solid ${C.smoke}20`, display:"flex", alignItems:"center", gap:14, cursor:"pointer", transition:"background 0.12s" }}
            onMouseEnter={e=>e.currentTarget.style.background=C.smoke}
            onMouseLeave={e=>e.currentTarget.style.background="transparent"}>

            <Avatar name={c.name} size={42}/>

            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:3 }}>
                <span style={{ fontSize:14, fontWeight:600, color:C.white }}>{c.name}</span>
                {!c.is_active && <Badge type="default">Inactif</Badge>}
              </div>
              <div style={{ fontSize:12, color:C.mist, display:"flex", gap:12, flexWrap:"wrap" }}>
                {c.contact_name && <span>👤 {c.contact_name}</span>}
                {c.email        && <span>✉ {c.email}</span>}
                {c.phone        && <span>📞 {c.phone}</span>}
                {(c.city||c.state) && <span>📍 {[c.city,c.state].filter(Boolean).join(", ")}</span>}
              </div>
            </div>

            <div style={{ textAlign:"center", flexShrink:0 }}>
              <div style={{ fontSize:18, fontWeight:800, color:C.info }}>{c.buildings?.length || 0}</div>
              <div style={{ fontSize:10, color:C.mist }}>Building{c.buildings?.length!==1?"s":""}</div>
            </div>

            <span style={{ color:C.steel, fontSize:18 }}>›</span>
          </div>
        ))}
      </div>
    </div>
  );
};

// ─── MAIN EXPORT ──────────────────────────────────────────────────────────────
export default function Customers({ user, supabase: sbConfig }) {
  const db = React.useMemo(() => makeDB(sbConfig), []);
  const [view,     setView]     = useState("list");   // list | detail
  const [selected, setSelected] = useState(null);     // customer object
  const [modal,    setModal]    = useState(null);      // null | "add" | customer (edit)

  const handleSelect = (customer) => { setSelected(customer); setView("detail"); };
  const handleBack   = ()         => { setView("list"); setSelected(null); };
  const handleAdd    = ()         => setModal("add");
  const handleEdit   = ()         => setModal(selected);

  const handleSave = (saved) => {
    setModal(null);
    if (view === "detail") {
      setSelected(saved); // refresh detail with updated data
    } else {
      setView("detail");
      setSelected(saved);
    }
  };

  return (
    <div style={{ height:"100%", minHeight:0, display:"flex", flexDirection:"column" }}>
      <style>{`
        @keyframes csSlideIn  { from{opacity:0;transform:translateX(10px)} to{opacity:1;transform:none} }
        @keyframes csSlideUp  { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:none} }
        @keyframes csSpin     { to{transform:rotate(360deg)} }
      `}</style>

      {view === "list" && (
        <CustomersList
          db={db}
          companyId={user.company_id}
          onSelect={handleSelect}
          onAdd={handleAdd}
        />
      )}

      {view === "detail" && selected && (
        <CustomerDetail
          customer={selected}
          db={db}
          companyId={user.company_id}
          onBack={handleBack}
          onEdit={handleEdit}
        />
      )}

      {/* Add / Modifier customer modal */}
      {modal && (
        <CustomerFormModal
          customer={modal === "add" ? null : modal}
          companyId={user.company_id}
          db={db}
          onSave={handleSave}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}