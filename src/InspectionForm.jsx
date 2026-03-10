import { useT } from './translations';
// ============================================================
// FireSafe Pro — Formulaires d'inspection Module
// InspectionForm.jsx
// ============================================================
// Drop this file into your src/ folder and import it in App.jsx
//
// Usage in App.jsx:
//   import InspectionForms from './InspectionForm';
//   // In your pages object:
//   inspections: { component: <InspectionForms user={user} supabase={{ url, anonKey, jwt }} /> }
// ============================================================

import React, { useState, useEffect, useCallback, useRef } from "react";

// ─── COLORS (matches main app) ────────────────────────────────────────────────
const C = {
  flame:"#FF4500", flameLight:"#FF6A33", flameDark:"#CC3700",
  ember:"#FF8C00", coal:"#0D0D0D", ash:"#1A1A1A", smoke:"#2A2A2A",
  steel:"#3A3A3A", mist:"#8A8A8A", frost:"#E8E8E8", white:"#FAFAFA",
  safe:"#22C55E", warn:"#F59E0B", danger:"#EF4444", info:"#3B82F6",
};

// ─── SUPABASE HELPERS (passed in via props) ───────────────────────────────────
const makeDB = ({ url, anonKey, jwt }) => {
  let _token = jwt;
  const setToken = (t) => { _token = t; };

  const headers = (extra = {}) => ({
    "Content-Type": "application/json",
    "apikey": anonKey,
    "Authorization": `Bearer ${_token || jwt}`,
    "Prefer": "return=representation",
    ...extra,
  });

  const from = (table) => {
    const params = new URLSearchParams();
    const h = headers();
    const b = {
      select: (c="*") => { params.set("select", c); return b; },
      eq:     (c, v)  => { params.append(c, `eq.${v}`); return b; },
      in:     (c, vs) => { params.append(c, `in.(${vs.join(",")})`); return b; },
      order:  (c, asc=true) => { params.append("order", `${c}.${asc?"asc":"desc"}`); return b; },
      limit:  (n)     => { params.set("limit", n); return b; },
      single: ()      => { h["Accept"] = "application/vnd.pgrst.object+json"; return b; },
      async get() {
        const qs = params.toString();
        const res = await fetch(`${url}/rest/v1/${table}${qs?"?"+qs:""}`, { headers: h });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || data.hint || JSON.stringify(data));
        return data;
      },
      async insert(body) {
        const res = await fetch(`${url}/rest/v1/${table}`, {
          method: "POST", headers: h, body: JSON.stringify(body),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || JSON.stringify(data));
        return Array.isArray(data) ? data[0] : data;
      },
      async upsert(body, onConflict) {
        const res = await fetch(`${url}/rest/v1/${table}?on_conflict=${onConflict}`, {
          method: "POST",
          headers: { ...h, "Prefer": "return=representation,resolution=merge-duplicates" },
          body: JSON.stringify(body),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || JSON.stringify(data));
        return Array.isArray(data) ? data[0] : data;
      },
      async patch(body) {
        const qs = params.toString();
        const res = await fetch(`${url}/rest/v1/${table}${qs?"?"+qs:""}`, {
          method: "PATCH", headers: h, body: JSON.stringify(body),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || JSON.stringify(data));
        return Array.isArray(data) ? data[0] : data;
      },
      async delete() {
        const qs = params.toString();
        const res = await fetch(`${url}/rest/v1/${table}${qs?"?"+qs:""}`, {
          method: "DELETE", headers: h,
        });
        if (!res.ok) { const d = await res.json(); throw new Error(d.message || JSON.stringify(d)); }
        return true;
      },
    };
    return b;
  };

  return { from, _url: url, _anonKey: anonKey, _jwt: jwt };
};

// ─── SHARED UI ────────────────────────────────────────────────────────────────
const Spinner = ({ size=18 }) => (
  <span style={{ width:size, height:size, border:`2px solid rgba(255,255,255,0.15)`, borderTopColor:"#fff", borderRadius:"50%", display:"inline-block", animation:"spin 0.7s linear infinite" }}/>
);

const Btn = ({ children, variant="primary", size="md", icon, onClick, disabled=false, full=false, style={} }) => {
  const vs = {
    primary: { bg:C.flame,        color:"#fff",  hov:C.flameLight },
    secondary:{ bg:"transparent", color:C.frost, hov:C.smoke, border:`1px solid ${C.steel}` },
    ghost:   { bg:"transparent",  color:C.mist,  hov:C.smoke },
    success: { bg:`${C.safe}18`,  color:C.safe,  hov:`${C.safe}30`, border:`1px solid ${C.safe}40` },
    danger:  { bg:`${C.danger}18`,color:C.danger,hov:`${C.danger}30`,border:`1px solid ${C.danger}40` },
  };
  const v = vs[variant]||vs.primary;
  const pad = size==="sm"?"5px 12px":size==="lg"?"12px 28px":"8px 16px";
  return (
    <button disabled={disabled} onClick={onClick}
      style={{ display:"inline-flex", alignItems:"center", justifyContent:"center", gap:6, padding:pad,
        fontSize:size==="sm"?12:13, fontWeight:500, background:v.bg, color:v.color,
        border:v.border||"none", borderRadius:6, transition:"all 0.15s",
        opacity:disabled?0.45:1, cursor:disabled?"not-allowed":"pointer",
        width:full?"100%":"auto", fontFamily:"inherit", ...style }}
      onMouseEnter={e=>{ if(!disabled) e.currentTarget.style.background=v.hov; }}
      onMouseLeave={e=>{ if(!disabled) e.currentTarget.style.background=v.bg; }}
    >{children}</button>
  );
};

const Badge = ({ children, type="default" }) => {
  const map = { default:{bg:`${C.mist}18`,color:C.mist}, success:{bg:`${C.safe}18`,color:C.safe}, danger:{bg:`${C.danger}18`,color:C.danger}, warning:{bg:`${C.warn}18`,color:C.warn}, info:{bg:`${C.info}18`,color:C.info}, flame:{bg:`${C.flame}18`,color:C.flame} };
  const s = map[type]||map.default;
  return <span style={{ display:"inline-flex", alignItems:"center", padding:"2px 8px", borderRadius:20, fontSize:11, fontWeight:500, background:s.bg, color:s.color, whiteSpace:"nowrap" }}>{children}</span>;
};

const Card = ({ children, style={} }) => (
  <div style={{ background:C.ash, border:`1px solid ${C.smoke}`, borderRadius:8, ...style }}>{children}</div>
);

const ProgressBar = ({ value, total, color=C.flame }) => {
  const pct = total > 0 ? Math.round((value/total)*100) : 0;
  return (
    <div style={{ display:"flex", alignItems:"center", gap:10 }}>
      <div style={{ flex:1, height:6, background:C.smoke, borderRadius:3, overflow:"hidden" }}>
        <div style={{ height:"100%", width:`${pct}%`, background:color, borderRadius:3, transition:"width 0.4s ease" }}/>
      </div>
      <span style={{ fontSize:11, color:C.mist, minWidth:36, textAlign:"right" }}>{value}/{total}</span>
    </div>
  );
};

// ─── ANSWER INPUT COMPONENTS ──────────────────────────────────────────────────

// Pass/Fail — large tap-friendly buttons for tablets
const PassFailInput = ({ value, onChange }) => {
  const { t } = useT();
  return (
  <div style={{ display:"flex", gap:12 }}>
    {[
      { v:"pass",  label:t("form_pass"), color:C.safe,   bg:`${C.safe}18`,   active:`${C.safe}30`   },
      { v:"échec", label:t("form_fail"), color:C.danger, bg:`${C.danger}18`, active:`${C.danger}30` },
      { v:"n/a",   label:t("form_na"),  color:C.mist,   bg:`${C.mist}10`,   active:`${C.mist}20`   },
    ].map(opt => (
      <button key={opt.v} onClick={() => onChange(value===opt.v ? null : opt.v)}
        style={{ flex:1, padding:"16px 0", borderRadius:8, border:`2px solid ${value===opt.v?opt.color:C.steel}`,
          background:value===opt.v?opt.active:opt.bg, color:value===opt.v?opt.color:C.mist,
          fontSize:15, fontWeight:700, cursor:"pointer", transition:"all 0.15s", fontFamily:"inherit" }}>
        {opt.label}
      </button>
    ))}
  </div>
  );
};

// Oui/Non
const OuiNonInput = ({ value, onChange }) => (
  <div style={{ display:"flex", gap:12 }}>
    {[
      { v:"yes", label:"Oui", color:C.safe,   bg:`${C.safe}18`   },
      { v:"no",  label:"Non",  color:C.danger, bg:`${C.danger}18` },
    ].map(opt => (
      <button key={opt.v} onClick={() => onChange(value===opt.v ? null : opt.v)}
        style={{ flex:1, padding:"14px 0", borderRadius:8, border:`2px solid ${value===opt.v?opt.color:C.steel}`,
          background:value===opt.v?opt.bg:"transparent", color:value===opt.v?opt.color:C.mist,
          fontSize:14, fontWeight:600, cursor:"pointer", transition:"all 0.15s", fontFamily:"inherit" }}>
        {opt.label}
      </button>
    ))}
  </div>
);

// Number input
const NumberInput = ({ value, onChange, placeholder="Entrer une valeur" }) => (
  <input type="number" value={value||""} onChange={e=>onChange(e.target.value)} placeholder={placeholder}
    style={{ width:"100%", padding:"12px 14px", background:C.smoke, border:`1px solid ${C.steel}`,
      borderRadius:8, color:C.white, fontSize:16, fontFamily:"inherit" }}
    onFocus={e=>e.target.style.borderColor=C.flame}
    onBlur={e=>e.target.style.borderColor=C.steel}
  />
);

// Text / notes input
const TextInput = ({ value, onChange, placeholder="Entrer des notes", rows=3 }) => (
  <textarea value={value||""} onChange={e=>onChange(e.target.value)} placeholder={placeholder} rows={rows}
    style={{ width:"100%", padding:"12px 14px", background:C.smoke, border:`1px solid ${C.steel}`,
      borderRadius:8, color:C.white, fontSize:13, fontFamily:"inherit", resize:"vertical", lineHeight:1.5 }}
    onFocus={e=>e.target.style.borderColor=C.flame}
    onBlur={e=>e.target.style.borderColor=C.steel}
  />
);

// Select / dropdown
const SelectInput = ({ value, options=[], onChange }) => (
  <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
    {options.map(opt => (
      <button key={opt} onClick={() => onChange(value===opt ? null : opt)}
        style={{ padding:"8px 16px", borderRadius:20, border:`1px solid ${value===opt?C.flame:C.steel}`,
          background:value===opt?`${C.flame}20`:"transparent", color:value===opt?C.flame:C.mist,
          fontSize:13, cursor:"pointer", transition:"all 0.15s", fontFamily:"inherit" }}>
        {opt}
      </button>
    ))}
  </div>
);

// Photo capture — uses file input + shows thumbnails
const PhotoInput = ({ photos=[], onChange }) => {
  const { t } = useT();
  const fileRef = useRef();

  const handleFiles = (e) => {
    const files = Array.from(e.target.files);
    const readers = files.map(f => new Promise(res => {
      const r = new FileReader();
      r.onload = () => res({ dataUrl: r.result, name: f.name, file: f });
      r.readAsDataURL(f);
    }));
    Promise.all(readers).then(results => onChange([...photos, ...results]));
    e.target.value = "";
  };

  const removePhoto = (i) => onChange(photos.filter((_,idx) => idx !== i));

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
      {photos.length > 0 && (
        <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
          {photos.map((p,i) => (
            <div key={i} style={{ position:"relative", width:90, height:90 }}>
              <img src={p.dataUrl} alt={p.name}
                style={{ width:90, height:90, objectFit:"cover", borderRadius:8, border:`1px solid ${C.steel}` }}/>
              <button onClick={() => removePhoto(i)}
                style={{ position:"absolute", top:-6, right:-6, width:20, height:20, borderRadius:"50%",
                  background:C.danger, border:"none", color:"#fff", fontSize:11, cursor:"pointer",
                  display:"flex", alignItems:"center", justifyContent:"center", fontWeight:700 }}>×</button>
            </div>
          ))}
        </div>
      )}
      <input ref={fileRef} type="file" accept="image/*" multiple capture="environment"
        onChange={handleFiles} style={{ display:"none" }}/>
      <Btn variant="secondary" onClick={() => fileRef.current.click()} style={{ alignSelf:"flex-start" }}>
        📷 {photos.length > 0 ? t("form_add_note") : "Prendre / Téléverser une photo"}
      </Btn>
    </div>
  );
};

// ─── SINGLE QUESTION CARD — fast tap UI for technicians ──────────────────────
const QuestionCard = ({ question, answer, onChange, index, total }) => {
  const { t } = useT();
  const [showNotes, setShowNotes] = useState(false);
  const val    = answer?.value;
  const isFail = val === "fail" || val === "échec" || val === "no";
  const isPass = val === "pass" || val === "oui" || val === "yes";
  const isDone = val != null && val !== "";
  const answerType = question.answer_type;

  return (
    <div style={{ background:C.ash, border:`2px solid ${isFail?C.danger:isPass?`${C.safe}60`:isDone?C.smoke:C.smoke}`,
      borderRadius:12, overflow:"hidden", transition:"border-color 0.15s", animation:"fadeIn 0.2s ease" }}>

      {/* Question text */}
      <div style={{ padding:"12px 16px", display:"flex", alignItems:"flex-start", gap:10 }}>
        <div style={{ width:24, height:24, borderRadius:"50%", flexShrink:0, marginTop:2,
          background: isFail?`${C.danger}25`:isPass?`${C.safe}25`:`${C.smoke}`,
          border:`2px solid ${isFail?C.danger:isPass?C.safe:C.steel}`,
          display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, fontWeight:800,
          color: isFail?C.danger:isPass?C.safe:C.mist }}>
          {isFail?"✗":isPass?"✓":index}
        </div>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:13, fontWeight:500, color:C.white, lineHeight:1.5 }}>{question.question_text}</div>
          <div style={{ display:"flex", gap:6, marginTop:4, flexWrap:"wrap", alignItems:"center" }}>
            {question.is_required && <span style={{ fontSize:10, color:C.warn, fontWeight:600 }}>{t("form_required")}</span>}
            {question.nfpa_reference && <span style={{ fontSize:10, color:C.info, fontFamily:"monospace", background:`${C.info}15`, padding:"1px 6px", borderRadius:4 }}>{question.nfpa_reference}</span>}
            {isFail && <span style={{ fontSize:10, color:C.danger, fontWeight:600 }}>{t("form_deficiency")}</span>}
          </div>
        </div>
      </div>

      {/* Answer buttons */}
      <div style={{ padding:"0 16px 12px", display:"flex", flexDirection:"column", gap:8 }}>
        {(answerType === "pass_fail" || answerType === "pass_échec") && (
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 72px", gap:8 }}>
            {[
              { v:"pass", label:t("form_pass"),    color:C.safe,   bg:`${C.safe}22`   },
              { v:"fail", label:t("form_fail"), color:C.danger, bg:`${C.danger}22` },
              { v:"na",   label:t("form_na"),            color:C.mist,   bg:`${C.mist}10`   },
            ].map(opt => (
              <button key={opt.v} onClick={() => onChange({ ...answer, value:val===opt.v?null:opt.v, passed:opt.v==="pass" })}
                style={{ padding:"13px 6px", borderRadius:8, border:`2px solid ${val===opt.v?opt.color:C.steel}`,
                  background:val===opt.v?opt.bg:"transparent", color:val===opt.v?opt.color:C.mist,
                  fontSize:12, fontWeight:700, cursor:"pointer", transition:"all 0.1s", fontFamily:"inherit",
                  transform: val===opt.v?"scale(1.02)":"scale(1)" }}>
                {opt.label}
              </button>
            ))}
          </div>
        )}
        {answerType === "yes_no" && (
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
            {[
              { v:"oui", label:"✓ Oui", color:C.safe,   bg:`${C.safe}22`   },
              { v:"non", label:"✗ Non", color:C.danger, bg:`${C.danger}22` },
            ].map(opt => (
              <button key={opt.v} onClick={() => onChange({ ...answer, value:val===opt.v?null:opt.v, passed:opt.v==="oui" })}
                style={{ padding:"13px", borderRadius:8, border:`2px solid ${val===opt.v?opt.color:C.steel}`,
                  background:val===opt.v?opt.bg:"transparent", color:val===opt.v?opt.color:C.mist,
                  fontSize:13, fontWeight:700, cursor:"pointer", transition:"all 0.1s", fontFamily:"inherit" }}>
                {opt.label}
              </button>
            ))}
          </div>
        )}
        {answerType === "text" && (
          <TextInput value={answer?.value} onChange={v => onChange({ ...answer, value:v })} placeholder="Entrer une observation..." rows={2}/>
        )}
        {answerType === "number" && (
          <NumberInput value={answer?.value} onChange={v => onChange({ ...answer, value:v })}/>
        )}
        {answerType === "select" && (
          <SelectInput value={answer?.value} options={question.answer_options||[]} onChange={v => onChange({ ...answer, value:v })}/>
        )}

        {/* Notes — auto-expands on fail, collapsible otherwise */}
        {answerType !== "text" && (
          <>
            {(isFail || showNotes) ? (
              <textarea value={answer?.notes||""} onChange={e=>onChange({...answer, notes:e.target.value})}
                placeholder={isFail?t("form_note_fail"):t("form_note_optional")}
                rows={2}
                style={{ width:"100%", padding:"10px 12px", background:C.smoke,
                  border:`1px solid ${isFail?`${C.danger}60`:C.steel}`,
                  borderRadius:8, color:C.white, fontSize:12, fontFamily:"inherit",
                  resize:"none", lineHeight:1.5, boxSizing:"border-box", marginTop:2 }}/>
            ) : (
              <button onClick={() => setShowNotes(true)}
                style={{ alignSelf:"flex-start", background:"none", border:"none", color:C.mist,
                  fontSize:11, cursor:"pointer", padding:0, fontFamily:"inherit" }}>
                {t("form_add_note")}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
};


// ─── INSPECTION FORM — STEP 1: SELECT INSPECTION ─────────────────────────────
const SelectInspection = ({ db, user, onSelect, onCreate }) => {
  const { t } = useT();
  const [inspections, setInspections] = useState([]);
  const [templates,   setTemplates]   = useState([]);
  const [customers,   setClients]   = useState([]);
  const [buildings,   setBâtiments]   = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState(null);
  const [creating,    setCreating]    = useState(false);
  const [showNew,     setShowNew]     = useState(false);
  const [editRow,     setEditRow]     = useState(null);
  const [deleteRow,   setDeleteRow]   = useState(null);
  const [editForm,    setEditForm]    = useState({});
  const [savingEdit,  setSavingEdit]  = useState(false);
  const [savingDelete,setSavingDelete]= useState(false);
  const [form, setForm] = useState({ template_id:"", building_id:"", customer_id:"", trade:"fire_alarm", scheduled_date: new Date().toISOString().split("T")[0] });

  const TRADES = ["fire_alarm","sprinkler","extinguisher","special_hazard","fire_door","backflow","chemical_suppression","facilities"];

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [insp, tmpl, cust, bldg] = await Promise.all([
          db.from("inspections")
            .select("id,status,trade,scheduled_date,building:buildings(name),customer:customers(name),template:inspection_templates(name)")
            .eq("company_id", user.company_id)
            .eq("technician_id", user.id)
            .order("scheduled_date", false)
            .limit(20)
            .get(),
          // Fetch system templates (company_id is null) + company's own templates
          // Use raw fetch with PostgREST 'or' filter
          fetch(`${db._url}/rest/v1/inspection_templates?select=id,name,trade,nfpa_reference&is_active=eq.true&or=(is_system.eq.true,company_id.eq.${user.company_id})&order=name`, {
            headers: {
              "apikey": db._anonKey,
              "Authorization": `Bearer ${db._jwt}`,
            }
          }).then(r => r.json()),
          db.from("customers").select("id,name").eq("company_id", user.company_id).eq("is_active", true).order("name").get(),
          db.from("buildings").select("id,name,customer_id,address").eq("company_id", user.company_id).eq("is_active", true).order("name").get(),
        ]);
        setInspections(insp || []);
        setTemplates(tmpl || []);
        setClients(cust || []);
        setBâtiments(bldg || []);
      } catch(e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filteredBâtiments = form.customer_id
    ? buildings.filter(b => b.customer_id === form.customer_id)
    : buildings;

  const handleCreate = async () => {
    if (!form.building_id || !form.template_id) return;
    setCreating(true);
    try {
      const bldg = buildings.find(b => b.id === form.building_id);
      const newInsp = await db.from("inspections").insert({
        company_id:    user.company_id,
        building_id:   form.building_id,
        customer_id:   bldg.customer_id,
        template_id:   form.template_id,
        technician_id: user.id,
        trade:         form.trade,
        status:        "in_progress",
        scheduled_date:form.scheduled_date,
        started_at:    new Date().toISOString(),
      });
      onCreate(newInsp);
    } catch(e) {
      setError(e.message);
    } finally {
      setCreating(false);
    }
  };

  const statusColor = { scheduled:"default", in_progress:"flame", completed:"success", deficient:"danger" };

  if (loading) return (
    <div style={{ padding:40, textAlign:"center", color:C.mist }}>
      <Spinner size={24}/><div style={{ marginTop:12, fontSize:13 }}>Chargement des inspections...</div>
    </div>
  );

  return (
    <div style={{ padding:20, display:"flex", flexDirection:"column", gap:20 }}>
      {error && (
        <div style={{ padding:"12px 16px", background:`${C.danger}15`, border:`1px solid ${C.danger}30`, borderRadius:8, fontSize:13, color:C.danger }}>
          {error}
        </div>
      )}

      {/* Start new inspection */}
      <Card style={{ padding:0 }}>
        <button onClick={() => setShowNew(n=>!n)}
          style={{ width:"100%", padding:"16px 20px", display:"flex", alignItems:"center", justifyContent:"space-between",
            background:"transparent", border:"none", color:C.white, cursor:"pointer", borderRadius:8 }}>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <div style={{ width:36,height:36,borderRadius:8,background:`${C.flame}20`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18 }}>+</div>
            <div style={{ textAlign:"left" }}>
              <div style={{ fontWeight:600, fontSize:14 }}>{t("new_insp_title")}</div>
              <div style={{ fontSize:12, color:C.mist }}>{t("new_insp_subtitle")}</div>
            </div>
          </div>
          <span style={{ color:C.mist, fontSize:18, transform:showNew?"rotate(90deg)":"none", transition:"transform 0.2s" }}>›</span>
        </button>

        {showNew && (
          <div style={{ padding:"0 20px 20px", borderTop:`1px solid ${C.smoke}`, display:"flex", flexDirection:"column", gap:14 }}>
            <div style={{ height:14 }}/>

            {/* Client */}
            <div>
              <label style={{ fontSize:11, color:C.mist, textTransform:"uppercase", letterSpacing:"0.05em" }}>{t("lbl_customer")}</label>
              <select value={form.customer_id} onChange={e => setForm(f=>({...f, customer_id:e.target.value, building_id:""}))}
                style={{ width:"100%", marginTop:6, padding:"10px 12px", background:C.smoke, border:`1px solid ${C.steel}`, borderRadius:6, color:form.customer_id?C.white:C.mist, fontSize:13, fontFamily:"inherit" }}>
                <option value="">{t("select_customer")}</option>
                {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>

            {/* Bâtiment */}
            <div>
              <label style={{ fontSize:11, color:C.mist, textTransform:"uppercase", letterSpacing:"0.05em" }}>{t("lbl_building")}</label>
              <select value={form.building_id} onChange={e => setForm(f=>({...f, building_id:e.target.value}))}
                style={{ width:"100%", marginTop:6, padding:"10px 12px", background:C.smoke, border:`1px solid ${C.steel}`, borderRadius:6, color:form.building_id?C.white:C.mist, fontSize:13, fontFamily:"inherit" }}>
                <option value="">{t("select_building")}</option>
                {filteredBâtiments.map(b => <option key={b.id} value={b.id}>{b.name} — {b.address}</option>)}
              </select>
            </div>

            {/* Template */}
            <div>
              <label style={{ fontSize:11, color:C.mist, textTransform:"uppercase", letterSpacing:"0.05em" }}>{t("lbl_template")}</label>
              <select value={form.template_id} onChange={e => {
                const tmpl = templates.find(tmpl=>tmpl.id===e.target.value);
                setForm(f=>({...f, template_id:e.target.value, trade:tmpl?.trade||f.trade}));
              }}
                style={{ width:"100%", marginTop:6, padding:"10px 12px", background:C.smoke, border:`1px solid ${C.steel}`, borderRadius:6, color:form.template_id?C.white:C.mist, fontSize:13, fontFamily:"inherit" }}>
                <option value="">{t("select_template")}</option>
                {templates.map(tmpl => <option key={tmpl.id} value={tmpl.id}>{tmpl.name} {tmpl.nfpa_reference?`(${tmpl.nfpa_reference})`:""}</option>)}
              </select>
            </div>

            {/* Spécialité */}
            <div>
              <label style={{ fontSize:11, color:C.mist, textTransform:"uppercase", letterSpacing:"0.05em" }}>{t("lbl_trade")}</label>
              <select value={form.trade} onChange={e => setForm(f=>({...f,trade:e.target.value}))}
                style={{ width:"100%", marginTop:6, padding:"10px 12px", background:C.smoke, border:`1px solid ${C.steel}`, borderRadius:6, color:C.white, fontSize:13, fontFamily:"inherit" }}>
                {TRADES.map(t => <option key={t} value={t}>{t.replace(/_/g," ").replace(/\b\w/g,l=>l.toUpperCase())}</option>)}
              </select>
            </div>

            {/* Date */}
            <div>
              <label style={{ fontSize:11, color:C.mist, textTransform:"uppercase", letterSpacing:"0.05em" }}>{t("lbl_date")}</label>
              <input type="date" value={form.scheduled_date} onChange={e=>setForm(f=>({...f,scheduled_date:e.target.value}))}
                style={{ width:"100%", marginTop:6, padding:"10px 12px", background:C.smoke, border:`1px solid ${C.steel}`, borderRadius:6, color:C.white, fontSize:13, fontFamily:"inherit" }}/>
            </div>

            <Btn full size="lg" onClick={handleCreate} disabled={!form.building_id||!form.template_id||creating}>
              {creating ? <><Spinner/> {t("btn_creating")}</> : t("btn_start_insp")}
            </Btn>
          </div>
        )}
      </Card>

      {/* ── EDIT MODAL ── */}
      {editRow && (
        <div style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.75)",zIndex:9000,display:"flex",alignItems:"center",justifyContent:"center",padding:16 }}>
          <div style={{ background:C.ash,border:`1px solid ${C.smoke}`,borderRadius:12,width:"100%",maxWidth:460,padding:24,display:"flex",flexDirection:"column",gap:14 }}>
            <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center" }}>
              <h3 style={{ fontFamily:"Syne,sans-serif",fontSize:15,fontWeight:700 }}>✏️ Modifier l'inspection</h3>
              <button onClick={()=>setEditRow(null)} style={{ background:"none",border:"none",color:C.mist,fontSize:22,cursor:"pointer",lineHeight:1 }}>×</button>
            </div>
            {["scheduled","in_progress","completed","deficient","cancelled"].map(s => (
              <button key={s} onClick={()=>setEditForm(f=>({...f,status:s}))}
                style={{ padding:"11px 14px",borderRadius:8,border:`2px solid ${editForm.status===s?{"scheduled":C.info,"in_progress":C.warn,"completed":C.safe,"deficient":C.danger,"cancelled":C.mist}[s]:C.steel}`,
                  background:editForm.status===s?`${{"scheduled":C.info,"in_progress":C.warn,"completed":C.safe,"deficient":C.danger,"cancelled":C.mist}[s]}15`:"transparent",
                  color:editForm.status===s?C.white:C.mist,fontSize:13,fontWeight:editForm.status===s?700:400,cursor:"pointer",textAlign:"left",fontFamily:"inherit",
                  display:"flex",alignItems:"center",gap:10 }}>
                <span>{{scheduled:"📅 "+t("status_scheduled"),in_progress:"⚙️ "+t("status_in_progress"),completed:"✅ "+t("status_completed"),deficient:"⚠️ Déficiente","cancelled":"🚫 Annulée"}[s]}</span>
              </button>
            ))}
            <div>
              <div style={{ fontSize:11,color:C.mist,marginBottom:5,textTransform:"uppercase",letterSpacing:"0.05em" }}>Date planifiée</div>
              <input type="date" value={editForm.date||""} onChange={e=>setEditForm(f=>({...f,date:e.target.value}))}
                style={{ width:"100%",padding:"9px 12px",background:C.smoke,border:`1px solid ${C.steel}`,borderRadius:6,color:C.white,fontSize:13,fontFamily:"inherit",boxSizing:"border-box" }}/>
            </div>
            <div style={{ display:"flex",gap:10,marginTop:4 }}>
              <button onClick={()=>setEditRow(null)} style={{ flex:1,padding:"10px",borderRadius:6,border:`1px solid ${C.steel}`,background:"transparent",color:C.mist,fontSize:13,cursor:"pointer",fontFamily:"inherit" }}>Annuler</button>
              <button onClick={async()=>{
                setSavingEdit(true);
                try {
                  await db.from("inspections").eq("id",editRow.id).patch({ status:editForm.status, scheduled_date:editForm.date||null });
                  setEditRow(null);
                  const updated = await db.from("inspections").eq("company_id",user.company_id).order("scheduled_date","desc").limit(50).select("id,trade,status,scheduled_date,building:buildings(name),customer:customers(name)").get();
                  setInspections(Array.isArray(updated)?updated:[]);
                } catch(e){ alert("Erreur: "+e.message); }
                setSavingEdit(false);
              }} disabled={savingEdit}
                style={{ flex:2,padding:"10px",borderRadius:6,border:"none",background:C.flame,color:"#fff",fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"inherit",opacity:savingEdit?0.6:1 }}>
                {savingEdit?"Enregistrement…":"✓ Enregistrer"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── DELETE CONFIRM MODAL ── */}
      {deleteRow && (
        <div style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.75)",zIndex:9000,display:"flex",alignItems:"center",justifyContent:"center",padding:16 }}>
          <div style={{ background:C.ash,border:`1px solid ${C.danger}50`,borderRadius:12,width:"100%",maxWidth:400,padding:24,display:"flex",flexDirection:"column",gap:16 }}>
            <h3 style={{ fontFamily:"Syne,sans-serif",fontSize:15,fontWeight:700,color:C.danger }}>🗑 Supprimer l'inspection ?</h3>
            <p style={{ color:C.mist,fontSize:13,lineHeight:1.6,margin:0 }}>
              L'inspection <strong style={{color:C.white}}>{deleteRow.building?.name||"—"}</strong> du <strong style={{color:C.white}}>{deleteRow.scheduled_date||"—"}</strong> sera <strong style={{color:C.danger}}>définitivement supprimée</strong>.
            </p>
            <div style={{ display:"flex",gap:10 }}>
              <button onClick={()=>setDeleteRow(null)} style={{ flex:1,padding:"10px",borderRadius:6,border:`1px solid ${C.steel}`,background:"transparent",color:C.mist,fontSize:13,cursor:"pointer",fontFamily:"inherit" }}>Annuler</button>
              <button onClick={async()=>{
                setSavingDelete(true);
                try {
                  await db.from("inspections").eq("id",deleteRow.id).delete();
                  setDeleteRow(null);
                  setInspections(prev=>prev.filter(i=>i.id!==deleteRow.id));
                } catch(e){ alert("Erreur: "+e.message); }
                setSavingDelete(false);
              }} disabled={savingDelete}
                style={{ flex:1,padding:"10px",borderRadius:6,border:"none",background:C.danger,color:"#fff",fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"inherit",opacity:savingDelete?0.6:1 }}>
                {savingDelete?"Suppression…":"🗑 Supprimer"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Existing inspections */}
      {inspections.length > 0 && (
        <div>
          <div style={{ fontSize:11, color:C.mist, textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:12 }}>
            {t("recent_list")}
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            {inspections.map(insp => (
              <Card key={insp.id} style={{ padding:0 }}>
                <div style={{ display:"flex", alignItems:"center", position:"relative" }}
                  onMouseEnter={e=>{ const btns=e.currentTarget.querySelector(".row-actions"); if(btns) btns.style.opacity="1"; }}
                  onMouseLeave={e=>{ const btns=e.currentTarget.querySelector(".row-actions"); if(btns) btns.style.opacity="0"; }}>
                  <button onClick={() => onSelect(insp.id)}
                    style={{ flex:1, padding:"14px 16px", display:"flex", alignItems:"center", gap:14,
                      background:"transparent", border:"none", color:C.white, cursor:"pointer", textAlign:"left", borderRadius:8 }}>
                    <div style={{ width:40,height:40,borderRadius:8,background:`${C.flame}15`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0 }}>
                      {insp.trade==="fire_alarm"?"🔔":insp.trade==="sprinkler"?"💧":insp.trade==="extinguisher"?"🧯":"🔥"}
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontWeight:600, fontSize:13, color:C.white, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                        {insp.building?.name || "—"}
                      </div>
                      <div style={{ fontSize:11, color:C.mist, marginTop:2 }}>
                        {insp.customer?.name} · {insp.trade?.replace(/_/g," ")} · {insp.scheduled_date}
                      </div>
                    </div>
                    <Badge type={statusColor[insp.status]||"default"}>{insp.status?.replace("_"," ")}</Badge>
                    <span style={{ color:C.mist, fontSize:18 }}>›</span>
                  </button>
                  {/* Action buttons — visible on hover */}
                  <div className="row-actions" style={{ display:"flex", gap:6, paddingRight:12, opacity:0, transition:"opacity 0.15s", flexShrink:0 }}>
                    <button onClick={e=>{ e.stopPropagation(); setEditForm({ status:insp.status, date:insp.scheduled_date||"" }); setEditRow(insp); }}
                      title="Modifier"
                      style={{ padding:"6px 10px", borderRadius:6, border:`1px solid ${C.info}50`, background:`${C.info}15`,
                        color:C.info, fontSize:12, cursor:"pointer", fontFamily:"inherit", fontWeight:600 }}>
                      ✏️
                    </button>
                    <button onClick={e=>{ e.stopPropagation(); setDeleteRow(insp); }}
                      title="Supprimer"
                      style={{ padding:"6px 10px", borderRadius:6, border:`1px solid ${C.danger}50`, background:`${C.danger}15`,
                        color:C.danger, fontSize:12, cursor:"pointer", fontFamily:"inherit", fontWeight:600 }}>
                      🗑
                    </button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {inspections.length === 0 && !showNew && (
        <div style={{ padding:40, textAlign:"center" }}>
          <div style={{ fontSize:40, marginBottom:12 }}>📋</div>
          <div style={{ fontSize:15, fontWeight:600, color:C.frost, marginBottom:8 }}>{t("no_inspections")}</div>
          <div style={{ fontSize:13, color:C.mist }}>{t("no_insp_hint")}</div>
        </div>
      )}
    </div>
  );
};

// ─── INSPECTION FORM — STEP 2: FILL OUT THE FORM ─────────────────────────────
const ActiveInspection = ({ db, user, inspectionId, onComplete, onBack }) => {
  const { t } = useT();
  const [inspection, setInspection] = useState(null);
  const [sections,   setSections]   = useState([]);
  const [questions,  setQuestions]  = useState([]);
  const [answers,    setAnswers]    = useState({}); // { questionId: { value, notes, photos, passed } }
  const [loading,    setLoading]    = useState(true);
  const [saving,     setSaving]     = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error,      setError]      = useState(null);
  const [activeSection, setActiveSection] = useState(0);
  const [showSummary,   setShowSummary]   = useState(false);
  const saveTimerRef = useRef(null);

  // Load inspection + template
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        // Load inspection with all relations
        const insp = await db.from("inspections")
          .select("*,building:buildings(name,address,city,state),customer:customers(name),template:inspection_templates(name,nfpa_reference)")
          .eq("id", inspectionId)
          .single()
          .get();
        setInspection(insp);

        if (!insp.template_id) throw new Error("Cette inspection n'a pas de modèle assigné.");

        // Load template sections
        const sects = await db.from("template_sections")
          .select("id,title,order_index")
          .eq("template_id", insp.template_id)
          .order("order_index")
          .get();
        setSections(sects || []);

        // Load questions via section_id=in(...) — template_questions has no template_id column
        const h = { apikey: db._anonKey, Authorization: `Bearer ${db._jwt}` };
        const qFields = "id,section_id,question_text,answer_type,answer_options,is_required,creates_deficiency_on,nfpa_reference,order_index";
        let qs = [];
        if ((sects||[]).length > 0) {
          const sectionIds = sects.map(s => s.id).join(",");
          const r1 = await fetch(
            `${db._url}/rest/v1/template_questions?section_id=in.(${sectionIds})&select=${qFields}&order=order_index.asc`,
            { headers: h }
          );
          if (r1.ok) {
            const d1 = await r1.json();
            if (Array.isArray(d1)) qs = d1;
          }
        }


        setQuestions(qs || []);

        // Load existing answers
        const existing = await db.from("inspection_answers")
          .select("*")
          .eq("inspection_id", inspectionId)
          .get();
        const answerMap = {};
        (existing||[]).forEach(a => {
          answerMap[a.question_id] = { value:a.answer_value, notes:a.answer_notes, photos:[], passed:a.passed, id:a.id };
        });
        setAnswers(answerMap);

        // Mark as in_progress if scheduled
        if (insp.status === "scheduled") {
          await db.from("inspections").eq("id", inspectionId).patch({ status:"in_progress", started_at:new Date().toISOString() });
        }
      } catch(e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [inspectionId]);

  // Auto-save answer to DB
  const saveAnswer = useCallback(async (questionId, answer) => {
    if (!answer.value && !answer.notes) return;
    try {
      const payload = {
        inspection_id: inspectionId,
        question_id:   questionId,
        answer_value:  answer.value,
        answer_notes:  answer.notes || null,
        passed:        answer.passed ?? null,
        photo_urls:    (answer.photos||[]).map(p=>p.dataUrl),
      };
      // Check if answer already exists, patch if so, insert if not
      if (answer.id) {
        await db.from("inspection_answers").eq("id", answer.id).patch(payload);
      } else {
        const existing = await db.from("inspection_answers")
          .eq("inspection_id", inspectionId).eq("question_id", questionId)
          .select("id").get();
        if (Array.isArray(existing) && existing.length > 0) {
          await db.from("inspection_answers").eq("id", existing[0].id).patch(payload);
          setAnswers(prev => ({ ...prev, [questionId]: { ...prev[questionId], id: existing[0].id } }));
        } else {
          const created = await db.from("inspection_answers").insert(payload);
          if (created?.id) {
            setAnswers(prev => ({ ...prev, [questionId]: { ...prev[questionId], id: created.id } }));
          }
        }
      }
    } catch(e) {
      console.warn("Auto-save failed:", e.message);
    }
  }, [inspectionId]);

  const handleAnswerChange = (questionId, answer) => {
    setAnswers(prev => ({ ...prev, [questionId]: answer }));
    // Debounced auto-save
    clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => saveAnswer(questionId, answer), 800);
  };

  // Get questions for current section
  const currentSection = sections[activeSection];
  // Show questions matching current section, OR all questions if none have section_id set
  const hasAnySectionId = questions.some(q => q.section_id);
  const currentQuestions = (hasAnySectionId
    ? questions.filter(q => q.section_id === currentSection?.id)
    : questions
  ).sort((a,b) => (a.order_index||0) - (b.order_index||0));

  // Overall progress
  const totalObligatoire  = questions.filter(q=>q.is_required).length;
  const answeredObligatoire = questions.filter(q=>q.is_required && answers[q.id]?.value).length;
  const totalRépondues  = questions.filter(q=>answers[q.id]?.value).length;
  const échecCount      = questions.filter(q=>answers[q.id]?.value==="échec"||answers[q.id]?.value==="no").length;
  const score          = totalRépondues > 0 ? Math.round(((totalRépondues - échecCount) / totalRépondues) * 100) : null;
  const canSubmit      = answeredObligatoire >= totalObligatoire;

  // Submit inspection
  const handleSubmit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      // Save all unanswered required questions check
      if (!canSubmit) {
        setError(t("form_required") + " - " + t("form_submit"));
        setSubmitting(false);
        return;
      }

      // Calculate final score
      const allRépondues    = questions.filter(q=>answers[q.id]?.value).length;
      const allFails       = questions.filter(q=>answers[q.id]?.value==="échec"||answers[q.id]?.value==="no").length;
      const finalScore     = allRépondues > 0 ? Math.round(((allRépondues-allFails)/allRépondues)*100) : 100;
      const passed         = allFails === 0;
      const finalStatus    = allFails > 0 ? "deficient" : "completed";

      // Update inspection record
      await db.from("inspections").eq("id", inspectionId).patch({
        status:       finalStatus,
        completed_at: new Date().toISOString(),
        score:        finalScore,
        passed,
      });

      // Create deficiencies for all écheced answers
      // (the DB trigger auto_create_deficiency handles this on answer insert,
      //  but we call it explicitly here for answers already saved without the trigger)
      const échecedQuestions = questions.filter(q => {
        const a = answers[q.id];
        return q.creates_deficiency_on && a?.value === q.creates_deficiency_on;
      });

      await Promise.all(échecedQuestions.map(q =>
        db.from("deficiencies").insert({
          company_id:    user.company_id,
          inspection_id: inspectionId,
          building_id:   inspection.building_id,
          customer_id:   inspection.customer_id,
          title:         `Failed: ${q.question_text}`,
          description:   answers[q.id]?.notes || null,
          trade:         inspection.trade,
          severity:      "medium",
          status:        "open",
          nfpa_reference:q.nfpa_reference || null,
        }).catch(() => {}) // ignore duplicates from trigger
      ));

      onComplete({ score: finalScore, passed, échecCount: allFails, status: finalStatus });
    } catch(e) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return (
    <div style={{ padding:40, textAlign:"center", color:C.mist }}>
      <Spinner size={24}/>
      <div style={{ marginTop:12, fontSize:13 }}>Chargement du formulaire...</div>
    </div>
  );

  if (error && !inspection) return (
    <div style={{ padding:20 }}>
      <div style={{ padding:"14px 16px", background:`${C.danger}15`, border:`1px solid ${C.danger}30`, borderRadius:8, color:C.danger, fontSize:13 }}>
        {error}
      </div>
      <Btn variant="secondary" onClick={onBack} style={{ marginTop:16 }}>← Retour</Btn>
    </div>
  );

  // ── Summary view ────────────────────────────────────────────
  if (showSummary) {
    // Live score: pass / (pass + fail) ignoring N/A
    const passCount  = questions.filter(q => answers[q.id]?.value === "pass" || answers[q.id]?.value === "oui").length;
    const failCount  = questions.filter(q => answers[q.id]?.value === "échec" || answers[q.id]?.value === "no" || answers[q.id]?.value === "fail").length;
    const naCount    = questions.filter(q => answers[q.id]?.value === "na").length;
    const skipped    = questions.filter(q => !answers[q.id]?.value).length;
    const scoreable  = passCount + failCount;
    const liveScore  = scoreable > 0 ? Math.round((passCount / scoreable) * 100) : null;
    const displayScore = score ?? liveScore;
    const scoreColor = displayScore == null ? C.steel : displayScore >= 80 ? C.safe : displayScore >= 60 ? C.warn : C.danger;
    const scoreLabel = displayScore == null ? t("pending") : displayScore >= 80 ? t("excellent") : displayScore >= 60 ? "Satisfaisant" : displayScore >= 40 ? "À améliorer" : "Non conforme";
    const missingRequired = totalObligatoire - answeredObligatoire;

    return (
      <div style={{ overflowY:"auto", flex:1 }}>
        <div style={{ padding:20, display:"flex", flexDirection:"column", gap:14, maxWidth:640, margin:"0 auto" }}>

          {/* Header */}
          <div style={{ display:"flex", alignItems:"center", gap:12 }}>
            <button onClick={() => setShowSummary(false)}
              style={{ background:`${C.smoke}`, border:"none", color:C.mist, cursor:"pointer", fontSize:16, width:32, height:32, borderRadius:8, display:"flex", alignItems:"center", justifyContent:"center" }}>←</button>
            <div>
              <h2 style={{ fontSize:16, fontWeight:700, color:C.white }}>{t("summary_title")}</h2>
              <div style={{ fontSize:11, color:C.mist, marginTop:1 }}>{inspection?.building?.name} · {inspection?.template?.name}</div>
            </div>
          </div>

          {/* Score card */}
          <div style={{ background: displayScore == null ? C.ash : `${scoreColor}12`, border:`1px solid ${scoreColor}35`,
            borderRadius:12, padding:"20px 24px", display:"flex", alignItems:"center", gap:20 }}>
            {/* Circle */}
            <div style={{ width:80, height:80, borderRadius:"50%", border:`4px solid ${scoreColor}`,
              background:`${scoreColor}15`, display:"flex", flexDirection:"column",
              alignItems:"center", justifyContent:"center", flexShrink:0 }}>
              {displayScore != null ? (
                <>
                  <span style={{ fontSize:22, fontWeight:800, color:scoreColor, lineHeight:1 }}>{displayScore}</span>
                  <span style={{ fontSize:11, fontWeight:700, color:scoreColor }}>%</span>
                </>
              ) : (
                <span style={{ fontSize:11, fontWeight:600, color:C.steel, textAlign:"center", lineHeight:1.3 }}>En<br/>attente</span>
              )}
            </div>
            {/* Info */}
            <div style={{ flex:1 }}>
              <div style={{ fontSize:15, fontWeight:700, color:scoreColor, marginBottom:4 }}>{scoreLabel}</div>
              {/* Score bar */}
              <div style={{ height:6, background:C.smoke, borderRadius:3, overflow:"hidden", marginBottom:8 }}>
                <div style={{ height:"100%", width:`${displayScore||0}%`, background:scoreColor, borderRadius:3, transition:"width 0.6s ease" }}/>
              </div>
              <div style={{ fontSize:11, color:C.mist, lineHeight:1.8 }}>
                <span style={{ color:C.safe }}>✓ {passCount} conformes</span>
                {" · "}
                <span style={{ color:failCount>0?C.danger:C.mist }}>✗ {failCount} non conformes</span>
                {" · "}
                <span style={{ color:C.mist }}>— {naCount} N/A</span>
                {skipped > 0 && <>{" · "}<span style={{ color:C.warn }}>⚪ {skipped} {t("form_na")}</span></>}
              </div>
            </div>
          </div>

          {/* Stats row */}
          <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:8 }}>
            {[
              { label:t("summary_questions"),    value:questions.length,    color:C.mist },
              { label:t("summary_answered"),    value:totalRépondues,      color:C.info },
              { label:t("summary_passed"),    value:passCount,           color:C.safe },
              { label:t("summary_deficiencies"),  value:failCount,           color:failCount>0?C.danger:C.safe },
            ].map((s,i) => (
              <div key={i} style={{ background:C.ash, border:`1px solid ${C.smoke}`, borderRadius:8, padding:"12px 8px", textAlign:"center" }}>
                <div style={{ fontSize:22, fontWeight:800, fontFamily:"Syne,sans-serif", color:s.color }}>{s.value}</div>
                <div style={{ fontSize:10, color:C.mist, marginTop:3 }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Section breakdown */}
          {sections.length > 0 && (
            <div style={{ background:C.ash, border:`1px solid ${C.smoke}`, borderRadius:10, overflow:"hidden" }}>
              <div style={{ padding:"10px 16px", borderBottom:`1px solid ${C.smoke}`, fontSize:12, fontWeight:700, color:C.frost }}>
                {t("results_by_section")}
              </div>
              {sections.map(s => {
                const sQs     = questions.filter(q => q.section_id === s.id);
                const sPassed = sQs.filter(q => answers[q.id]?.value === "pass" || answers[q.id]?.value === "oui").length;
                const sFailed = sQs.filter(q => answers[q.id]?.value === "échec" || answers[q.id]?.value === "no" || answers[q.id]?.value === "fail").length;
                const sTotal  = sPassed + sFailed;
                const sPct    = sTotal > 0 ? Math.round((sPassed / sTotal) * 100) : null;
                const sColor  = sPct == null ? C.mist : sPct >= 80 ? C.safe : sPct >= 60 ? C.warn : C.danger;
                return (
                  <div key={s.id} style={{ padding:"10px 16px", borderBottom:`1px solid ${C.smoke}20`, display:"flex", alignItems:"center", gap:12 }}>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:12, fontWeight:600, color:C.frost, marginBottom:4 }}>{s.title}</div>
                      <div style={{ height:4, background:C.smoke, borderRadius:2, overflow:"hidden" }}>
                        <div style={{ height:"100%", width:`${sPct||0}%`, background:sColor, borderRadius:2 }}/>
                      </div>
                    </div>
                    <div style={{ fontSize:12, fontWeight:700, color:sColor, flexShrink:0, width:44, textAlign:"right" }}>
                      {sPct != null ? `${sPct}%` : "—"}
                    </div>
                    <div style={{ fontSize:10, color:C.mist, flexShrink:0, width:70, textAlign:"right" }}>
                      {sPassed}✓ · {sFailed}✗
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Failed items */}
          {failCount > 0 && (
            <div style={{ background:C.ash, border:`1px solid ${C.danger}30`, borderRadius:10, overflow:"hidden" }}>
              <div style={{ padding:"10px 16px", borderBottom:`1px solid ${C.danger}20`, fontSize:12, fontWeight:700, color:C.danger }}>
                ⚠ Points non conformes ({failCount})
              </div>
              {questions.filter(q => {
                const v = answers[q.id]?.value;
                return v === "échec" || v === "no" || v === "fail";
              }).map((q,i,arr) => (
                <div key={q.id} style={{ padding:"10px 16px", borderBottom:i<arr.length-1?`1px solid ${C.smoke}20`:"none", display:"flex", gap:10 }}>
                  <span style={{ color:C.danger, fontSize:14, flexShrink:0, marginTop:1 }}>✗</span>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:12, fontWeight:500, color:C.frost }}>{q.question_text}</div>
                    {answers[q.id]?.notes && (
                      <div style={{ fontSize:11, color:C.mist, marginTop:3, fontStyle:"italic" }}>{answers[q.id].notes}</div>
                    )}
                    {q.nfpa_reference && (
                      <span style={{ display:"inline-block", marginTop:4, fontSize:10, padding:"1px 7px", borderRadius:10, background:`${C.info}18`, color:C.info, fontFamily:"monospace" }}>
                        {q.nfpa_reference}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Skipped required */}
          {missingRequired > 0 && (
            <div style={{ padding:"12px 16px", background:`${C.warn}12`, border:`1px solid ${C.warn}35`, borderRadius:8, fontSize:12, color:C.warn, display:"flex", gap:10, alignItems:"flex-start" }}>
              <span style={{ flexShrink:0 }}>⚠</span>
              <span><strong>{missingRequired} question{missingRequired>1?"s":""} obligatoire{missingRequired>1?"s":""}</strong> sans réponse — revenez en arrière pour les compléter avant de soumettre.</span>
            </div>
          )}

          {error && (
            <div style={{ padding:"12px 16px", background:`${C.danger}12`, border:`1px solid ${C.danger}30`, borderRadius:8, fontSize:12, color:C.danger }}>
              ⚠ {error}
            </div>
          )}

          {/* Actions */}
          <div style={{ display:"flex", flexDirection:"column", gap:8, paddingTop:4 }}>
            <button onClick={handleSubmit} disabled={!canSubmit||submitting}
              style={{ width:"100%", padding:"14px", borderRadius:8, border:"none", cursor:canSubmit&&!submitting?"pointer":"not-allowed",
                background:!canSubmit||submitting?C.smoke:failCount>0?C.danger:C.safe,
                color:!canSubmit||submitting?C.mist:"#fff", fontSize:14, fontWeight:700, fontFamily:"inherit",
                opacity:!canSubmit||submitting?0.6:1, transition:"all 0.15s" }}>
              {submitting
                ? "⏳ Envoi en cours…"
                : !canSubmit
                ? `⚠ ${missingRequired} question${missingRequired>1?"s":""} manquante${missingRequired>1?"s":""}`
                : failCount > 0
                ? `${t("btn_submit_deficiencies")} — ${failCount} ${t("deficiencies")}`
                : "✓ Soumettre l'inspection"}
            </button>
            <button onClick={() => setShowSummary(false)} disabled={submitting}
              style={{ width:"100%", padding:"11px", borderRadius:8, border:`1px solid ${C.smoke}`, background:"transparent",
                color:C.mist, fontSize:13, fontFamily:"inherit", cursor:"pointer" }}>
              ← Retour aux questions
            </button>
          </div>

        </div>
      </div>
    );
  }

  // ── Active form ──────────────────────────────────────────────
  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100%", minHeight:0 }}>
      {/* Sticky top bar */}
      <div style={{ padding:"12px 16px", borderBottom:`1px solid ${C.smoke}`, background:C.ash, position:"sticky", top:0, zIndex:10 }}>
        {/* Bâtiment info */}
        <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:10 }}>
          <button onClick={onBack} style={{ background:"none", border:"none", color:C.mist, cursor:"pointer", padding:"2px 6px", fontSize:16 }}>←</button>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontSize:13, fontWeight:600, color:C.white, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
              {inspection?.building?.name}
            </div>
            <div style={{ fontSize:11, color:C.mist }}>{inspection?.customer?.name} · {inspection?.template?.name}</div>
          </div>
          <button onClick={() => setShowSummary(true)}
            style={{ padding:"6px 12px", borderRadius:6, border:`1px solid ${canSubmit?C.safe:C.steel}`, background:canSubmit?`${C.safe}15`:"transparent",
              color:canSubmit?C.safe:C.mist, fontSize:12, fontWeight:600, cursor:"pointer", whiteSpace:"nowrap" }}>
            {canSubmit?"✓ Review":"Review"}
          </button>
        </div>

        {/* Overall progress */}
        <ProgressBar value={totalRépondues} total={questions.length} color={score===null?C.flame:score>=80?C.safe:score>=60?C.warn:C.danger}/>
        <div style={{ display:"flex", justifyContent:"space-between", marginTop:4 }}>
          <span style={{ fontSize:10, color:C.mist }}>{answeredObligatoire}/{totalObligatoire} {t("form_required")} {t("form_answered")}</span>
          {échecCount > 0 && <span style={{ fontSize:10, color:C.danger }}>{échecCount} échec{échecCount!==1?"s":""}</span>}
          {score !== null && <span style={{ fontSize:10, color:score>=80?C.safe:score>=60?C.warn:C.danger }}>{score}%</span>}
        </div>
      </div>

      {/* Section tabs */}
      {sections.length > 1 && (
        <div style={{ display:"flex", overflowX:"auto", borderBottom:`1px solid ${C.smoke}`, background:C.ash, padding:"0 16px", gap:0, flexShrink:0 }}>
          {sections.map((s,i) => {
            const sectionQs    = questions.filter(q=>q.section_id===s.id);
            const sectionDone  = sectionQs.filter(q=>answers[q.id]?.value).length;
            const sectionFails = sectionQs.filter(q=>answers[q.id]?.value==="échec"||answers[q.id]?.value==="no").length;
            return (
              <button key={s.id} onClick={() => setActiveSection(i)}
                style={{ padding:"10px 14px", border:"none", borderBottom:`2px solid ${activeSection===i?C.flame:"transparent"}`,
                  background:"transparent", color:activeSection===i?C.flame:C.mist, fontSize:12, fontWeight:activeSection===i?600:400,
                  cursor:"pointer", whiteSpace:"nowrap", display:"flex", alignItems:"center", gap:5, transition:"all 0.15s" }}>
                {s.title}
                {sectionFails > 0 && <span style={{ width:16,height:16,borderRadius:"50%",background:C.danger,color:"#fff",fontSize:9,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center" }}>{sectionFails}</span>}
                {sectionFails === 0 && sectionDone === sectionQs.length && sectionQs.length > 0 && <span style={{ color:C.safe, fontSize:12 }}>✓</span>}
              </button>
            );
          })}
        </div>
      )}

      {/* Questions — one at a time for speed */}
      <div style={{ flex:1, overflowY:"auto", padding:"12px 16px" }}>
        {currentSection && (
          <div style={{ marginBottom:10, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
            <h3 style={{ fontSize:13, fontWeight:700, color:C.frost }}>{currentSection.title}</h3>
            <span style={{ fontSize:11, color:C.mist }}>
              {currentQuestions.filter(q=>answers[q.id]?.value).length}/{currentQuestions.length} {t("answers_label")}
            </span>
          </div>
        )}

        {/* All questions visible, stacked compactly */}
        <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
          {currentQuestions.map((q,i) => (
            <QuestionCard key={q.id} question={q} answer={answers[q.id]||{}} index={i+1} total={currentQuestions.length}
              onChange={answer => handleAnswerChange(q.id, answer)}/>
          ))}
        </div>

        {currentQuestions.length === 0 && (
          <div style={{ padding:40, textAlign:"center", color:C.mist, fontSize:13 }}>{t("form_no_questions")}</div>
        )}

        {/* Quick jump — "Tout conformer" button for fast all-pass */}
        {currentQuestions.length > 0 && currentQuestions.some(q => (q.answer_type==="pass_fail"||q.answer_type==="pass_échec") && !answers[q.id]?.value) && (
          <button onClick={() => {
            currentQuestions.forEach(q => {
              if ((q.answer_type==="pass_fail"||q.answer_type==="pass_échec") && !answers[q.id]?.value) {
                handleAnswerChange(q.id, { ...(answers[q.id]||{}), value:"pass", passed:true });
              }
            });
          }}
            style={{ width:"100%", marginTop:12, padding:"11px", borderRadius:8,
              border:`1px solid ${C.safe}40`, background:`${C.safe}10`, color:C.safe,
              fontSize:12, fontWeight:600, cursor:"pointer", fontFamily:"inherit" }}>
            {t("form_all_pass")}
          </button>
        )}
      </div>

      {/* Bottom nav */}
      <div style={{ padding:"12px 16px", borderTop:`1px solid ${C.smoke}`, background:C.ash, display:"flex", gap:10 }}>
        {activeSection > 0 && (
          <Btn variant="secondary" onClick={() => setActiveSection(i=>i-1)} style={{ flex:1 }}>{t("form_prev")}</Btn>
        )}
        {activeSection < sections.length - 1 ? (
          <Btn onClick={() => setActiveSection(i=>i+1)} style={{ flex:1 }}>{t("form_next_section")}</Btn>
        ) : (
          <Btn onClick={() => setShowSummary(true)} style={{ flex:1 }} variant={canSubmit?"success":"primary"}>
            {canSubmit ? t("form_submit") : t("form_review")}
          </Btn>
        )}
      </div>
    </div>
  );
};

// ─── COMPLETION SCREEN ────────────────────────────────────────────────────────
const CompletionScreen = ({ result, onDone, onViewReport }) => {
  const { t } = useT();
  return (
  <div style={{ padding:40, textAlign:"center", display:"flex", flexDirection:"column", alignItems:"center", gap:20, animation:"fadeIn 0.4s ease" }}>
    <div style={{ fontSize:72 }}>{result.passed ? "✅" : "⚠️"}</div>
    <div>
      <h2 style={{ fontSize:24, fontWeight:800, fontFamily:"Syne,sans-serif", color:result.passed?C.safe:C.warn }}>
        {result.passed ? t("insp_passed") : t("insp_done")}
      </h2>
      <p style={{ fontSize:13, color:C.mist, marginTop:8 }}>
        {result.passed
          ? t("all_conforming")
          : `${result.échecCount} ${t("deficiencies_found")}.`}
      </p>
    </div>
    <div style={{ display:"flex", gap:24 }}>
      <div style={{ textAlign:"center" }}>
        <div style={{ fontSize:36, fontWeight:800, fontFamily:"Syne,sans-serif", color:result.score>=80?C.safe:result.score>=60?C.warn:C.danger }}>{result.score}%</div>
        <div style={{ fontSize:11, color:C.mist }}>Score</div>
      </div>
      <div style={{ width:1, background:C.smoke }}/>
      <div style={{ textAlign:"center" }}>
        <div style={{ fontSize:36, fontWeight:800, fontFamily:"Syne,sans-serif", color:result.échecCount>0?C.danger:C.safe }}>{result.échecCount}</div>
        <div style={{ fontSize:11, color:C.mist }}>Déficiences</div>
      </div>
    </div>
    <div style={{ display:"flex", flexDirection:"column", gap:10, width:"100%", maxWidth:300 }}>
      <button onClick={onViewReport||onDone}
        style={{ width:"100%", padding:"13px", borderRadius:8, border:"none",
          background:C.flame, color:"#fff", fontSize:13, fontWeight:700,
          cursor:"pointer", fontFamily:"inherit" }}>
        🖨 Voir le rapport PDF
      </button>
      <button onClick={onDone}
        style={{ width:"100%", padding:"11px", borderRadius:8, border:`1px solid ${C.smoke}`,
          background:"transparent", color:C.mist, fontSize:13, cursor:"pointer", fontFamily:"inherit" }}>
        {t("form_prev")}
      </button>
    </div>
  </div>
  );
};

// ─── MAIN EXPORT ──────────────────────────────────────────────────────────────
export default function InspectionForms({ user, supabase: sbConfig }) {
  const [view,         setView]        = useState("list");
  const [inspectionId, setInspectionId]= useState(null);
  const [result,       setResult]      = useState(null);
  const [showReport,   setShowReport]  = useState(false);
  const db = React.useMemo(() => makeDB(sbConfig), []);

  const handleSelect   = (id)   => { setInspectionId(id); setView("form"); };
  const handleCreate   = (insp) => { setInspectionId(insp.id); setView("form"); };
  const handleComplete = (res)  => { setResult(res); setView("complete"); };
  const handleBack     = ()     => { setView("list"); setInspectionId(null); };
  const handleDone     = ()     => { setView("list"); setInspectionId(null); setResult(null); };

  // Lazy import InspectionReportPDF via dynamic require pattern
  const [ReportPDF, setReportPDF] = React.useState(null);
  React.useEffect(() => {
    import("./InspectionReportPDF").then(m => setReportPDF(() => m.default)).catch(()=>{});
  }, []);

  return (
    <div style={{ height:"100%", minHeight:0, display:"flex", flexDirection:"column" }}>
      <style>{`
        @keyframes fadeIn { from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none} }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>

      {/* PDF report overlay */}
      {showReport && inspectionId && ReportPDF && (
        <ReportPDF inspectionId={inspectionId} supabase={sbConfig} onClose={()=>setShowReport(false)}/>
      )}

      {view === "list" && (
        <SelectInspection db={db} user={user} onSelect={handleSelect} onCreate={handleCreate}/>
      )}
      {view === "form" && inspectionId && (
        <ActiveInspection db={db} user={user} inspectionId={inspectionId} onComplete={handleComplete} onBack={handleBack}/>
      )}
      {view === "complete" && result && (
        <CompletionScreen
          result={result}
          onDone={handleDone}
          onViewReport={ReportPDF ? () => setShowReport(true) : null}
        />
      )}
    </div>
  );
}