// ============================================================
// FireSafe Pro — Déficiences (CRUD complet + workflow)
// Deficiencies.jsx
// ============================================================
import React, { useState, useEffect, useCallback, useRef } from "react";

// ─── API ──────────────────────────────────────────────────────────────────────
const mkApi = ({ url, anonKey, jwt }) => {
  const h = (extra = {}) => ({
    "Content-Type": "application/json",
    "apikey": anonKey,
    "Authorization": `Bearer ${jwt}`,
    "Prefer": "return=representation",
    ...extra,
  });

  const get = async (path) => {
    const r = await fetch(`${url}/rest/v1/${path}`, { headers: h() });
    const t = await r.text();
    if (!r.ok) throw new Error(JSON.parse(t)?.message || t);
    return t ? JSON.parse(t) : [];
  };

  const post = async (table, body) => {
    const r = await fetch(`${url}/rest/v1/${table}`, {
      method: "POST", headers: h(), body: JSON.stringify(body),
    });
    const t = await r.text();
    if (!r.ok) throw new Error(JSON.parse(t)?.message || t);
    return t ? JSON.parse(t) : null;
  };

  const patch = async (table, id, body) => {
    const r = await fetch(`${url}/rest/v1/${table}?id=eq.${id}`, {
      method: "PATCH", headers: h(), body: JSON.stringify(body),
    });
    const t = await r.text();
    if (!r.ok) throw new Error(JSON.parse(t)?.message || t);
    return t ? JSON.parse(t) : null;
  };

  const del = async (table, id) => {
    const r = await fetch(`${url}/rest/v1/${table}?id=eq.${id}`, {
      method: "DELETE", headers: h({ "Prefer": "" }),
    });
    if (!r.ok) throw new Error(`Delete failed: ${r.status}`);
  };

  return { get, post, patch, del };
};

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const SEVERITY = {
  critical: { label: "Critique",  color: "#EF4444", bg: "#EF444418" },
  high:     { label: "Élevée",    color: "#F59E0B", bg: "#F59E0B18" },
  medium:   { label: "Moyenne",   color: "#3B82F6", bg: "#3B82F618" },
  low:      { label: "Faible",    color: "#22C55E", bg: "#22C55E18" },
};

const STATUS_FLOW = [
  { key: "open",      label: "Ouvert",          color: "#EF4444", bg: "#EF444418", icon: "🔴" },
  { key: "quoted",    label: "Devisé",           color: "#F59E0B", bg: "#F59E0B18", icon: "📋" },
  { key: "in_repair", label: "En réparation",    color: "#3B82F6", bg: "#3B82F618", icon: "🔧" },
  { key: "repaired",  label: "Réparé",           color: "#8B5CF6", bg: "#8B5CF618", icon: "✅" },
  { key: "verified",  label: "Vérifié",          color: "#22C55E", bg: "#22C55E18", icon: "🎯" },
  { key: "closed",    label: "Clôturé",          color: "#6B7280", bg: "#6B728018", icon: "🔒" },
];

const STATUS_MAP  = Object.fromEntries(STATUS_FLOW.map(s => [s.key, s]));
const NEXT_STATUS = { open:"quoted", quoted:"in_repair", in_repair:"repaired", repaired:"verified", verified:"closed" };
const NEXT_LABEL  = { open:"Devis créé", quoted:"Réparation démarrée", in_repair:"Marquer réparé", repaired:"Vérifier", verified:"Clôturer" };

const TRADES = [
  { value: "fire_alarm",           label: "Alarme incendie" },
  { value: "sprinkler",            label: "Sprinkleur" },
  { value: "extinguisher",         label: "Extincteur" },
  { value: "special_hazard",       label: "Risque spécial" },
  { value: "fire_door",            label: "Porte coupe-feu" },
  { value: "backflow",             label: "Anti-retour" },
  { value: "chemical_suppression", label: "Suppression chimique" },
  { value: "facilities",           label: "Installations" },
];

// ─── MINI DESIGN SYSTEM ───────────────────────────────────────────────────────
const C = {
  coal: "#0D0D0D", ash: "#1A1A1A", smoke: "#2A2A2A", steel: "#3A3A3A",
  mist: "#8A8A8A", frost: "#E8E8E8", white: "#FAFAFA",
  flame: "#FF4500", ember: "#FF8C00",
  safe: "#22C55E", warn: "#F59E0B", danger: "#EF4444", info: "#3B82F6",
};

const Pill = ({ status }) => {
  const s = STATUS_MAP[status] || { label: status, color: C.mist, bg: C.smoke };
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      padding: "3px 10px", borderRadius: 20,
      fontSize: 11, fontWeight: 600,
      color: s.color, background: s.bg, border: `1px solid ${s.color}40`,
    }}>
      {s.icon} {s.label}
    </span>
  );
};

const SevBadge = ({ sev }) => {
  const s = SEVERITY[sev] || { label: sev, color: C.mist, bg: C.smoke };
  return (
    <span style={{
      padding: "2px 9px", borderRadius: 20,
      fontSize: 11, fontWeight: 600,
      color: s.color, background: s.bg,
    }}>{s.label}</span>
  );
};

const Btn = ({ children, onClick, variant = "primary", size = "md", disabled, style = {}, icon }) => {
  const base = {
    display: "inline-flex", alignItems: "center", gap: 6,
    border: "none", borderRadius: 6, cursor: disabled ? "not-allowed" : "pointer",
    fontFamily: "inherit", fontWeight: 500, transition: "all 0.12s",
    opacity: disabled ? 0.5 : 1,
    fontSize: size === "sm" ? 12 : 13,
    padding: size === "sm" ? "6px 12px" : "9px 16px",
  };
  const variants = {
    primary:   { background: C.flame,   color: "#fff" },
    secondary: { background: C.smoke,   color: C.frost, border: `1px solid ${C.steel}` },
    ghost:     { background: "transparent", color: C.mist },
    danger:    { background: "#EF444418", color: "#EF4444", border: "1px solid #EF444440" },
    success:   { background: "#22C55E18", color: "#22C55E", border: "1px solid #22C55E40" },
  };
  return (
    <button onClick={onClick} disabled={disabled} style={{ ...base, ...variants[variant], ...style }}>
      {icon && <span>{icon}</span>}{children}
    </button>
  );
};

const Input = ({ label, value, onChange, type = "text", placeholder, required, as, options, rows = 3 }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
    {label && <label style={{ fontSize: 12, fontWeight: 500, color: C.frost }}>{label}{required && <span style={{ color: C.danger }}> *</span>}</label>}
    {as === "textarea" ? (
      <textarea value={value} onChange={onChange} rows={rows} placeholder={placeholder}
        style={{ background: C.smoke, border: `1px solid ${C.steel}`, borderRadius: 6, padding: "9px 12px", fontSize: 13, color: C.white, resize: "vertical", fontFamily: "inherit" }}/>
    ) : as === "select" ? (
      <select value={value} onChange={onChange}
        style={{ background: C.smoke, border: `1px solid ${C.steel}`, borderRadius: 6, padding: "9px 12px", fontSize: 13, color: value ? C.white : C.mist }}>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    ) : (
      <input type={type} value={value} onChange={onChange} placeholder={placeholder}
        style={{ background: C.smoke, border: `1px solid ${C.steel}`, borderRadius: 6, padding: "9px 12px", fontSize: 13, color: C.white }}/>
    )}
  </div>
);

const Avatar = ({ name = "?", size = 28 }) => {
  const initials = name.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase();
  const hue = name.split("").reduce((h, c) => h + c.charCodeAt(0), 0) % 360;
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%",
      background: `hsl(${hue},55%,35%)`,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: size * 0.36, fontWeight: 700, color: "#fff", flexShrink: 0,
    }}>{initials}</div>
  );
};

const Spinner = () => (
  <div style={{ display: "flex", justifyContent: "center", padding: 48 }}>
    <div style={{ width: 28, height: 28, borderRadius: "50%", border: `3px solid ${C.steel}`, borderTopColor: C.flame, animation: "spin 0.7s linear infinite" }}/>
  </div>
);

// ─── WORKFLOW STEPPER ─────────────────────────────────────────────────────────
const WorkflowStepper = ({ status, onAdvance, loading }) => {
  const currentIdx = STATUS_FLOW.findIndex(s => s.key === status);
  const next = NEXT_STATUS[status];
  return (
    <div style={{ background: C.ash, borderRadius: 10, padding: 16, border: `1px solid ${C.smoke}` }}>
      <div style={{ fontSize: 11, color: C.mist, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 14 }}>
        Workflow de résolution
      </div>

      {/* Steps */}
      <div style={{ display: "flex", alignItems: "center", marginBottom: 16 }}>
        {STATUS_FLOW.map((s, i) => {
          const done    = i < currentIdx;
          const current = i === currentIdx;
          const pending = i > currentIdx;
          return (
            <React.Fragment key={s.key}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                <div style={{
                  width: 28, height: 28, borderRadius: "50%",
                  background: done ? s.color : current ? s.color : C.smoke,
                  border: `2px solid ${done || current ? s.color : C.steel}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: done ? 12 : 11,
                  color: done || current ? "#fff" : C.steel,
                  fontWeight: 700,
                  transition: "all 0.3s",
                }}>
                  {done ? "✓" : s.icon}
                </div>
                <div style={{
                  fontSize: 9, fontWeight: current ? 700 : 400,
                  color: current ? s.color : done ? C.frost : C.steel,
                  textAlign: "center", maxWidth: 54,
                }}>{s.label}</div>
              </div>
              {i < STATUS_FLOW.length - 1 && (
                <div style={{
                  flex: 1, height: 2, margin: "0 3px",
                  marginBottom: 18,
                  background: i < currentIdx ? STATUS_FLOW[i].color : C.steel,
                  transition: "background 0.3s",
                }}/>
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* Advance button */}
      {next && (
        <Btn
          onClick={() => onAdvance(next)}
          disabled={loading}
          variant="primary"
          style={{ width: "100%", justifyContent: "center" }}
          icon="→"
        >
          {NEXT_LABEL[status]}
        </Btn>
      )}
      {!next && status === "closed" && (
        <div style={{ textAlign: "center", fontSize: 12, color: C.safe, padding: "6px 0" }}>
          ✅ Cette déficience est clôturée
        </div>
      )}
    </div>
  );
};

// ─── CREATE / EDIT MODAL ──────────────────────────────────────────────────────
const DeficiencyModal = ({ mode = "create", initial = {}, customers, buildings, technicians, onSave, onClose }) => {
  const [form, setForm] = useState({
    title:          initial.title          || "",
    description:    initial.description    || "",
    severity:       initial.severity       || "medium",
    trade:          initial.trade          || "",
    nfpa_reference: initial.nfpa_reference || "",
    customer_id:    initial.customer_id    || "",
    building_id:    initial.building_id    || "",
    assigned_to:    initial.assigned_to    || "",
    due_date:       initial.due_date       || "",
    estimated_cost: initial.estimated_cost || "",
    status:         initial.status         || "open",
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr]       = useState("");

  // Filter buildings by selected customer
  const filteredBuildings = buildings.filter(b =>
    !form.customer_id || b.customer_id === form.customer_id
  );

  const set = (k) => (e) => {
    const v = e.target.value;
    setForm(f => {
      const next = { ...f, [k]: v };
      // Reset building if customer changes
      if (k === "customer_id") next.building_id = "";
      return next;
    });
  };

  const handleSave = async () => {
    if (!form.title.trim())       return setErr("Le titre est requis");
    if (!form.customer_id)        return setErr("Sélectionnez un client");
    if (!form.building_id)        return setErr("Sélectionnez un bâtiment");
    setSaving(true); setErr("");
    try {
      await onSave({
        ...form,
        estimated_cost: form.estimated_cost ? Number(form.estimated_cost) : null,
      });
    } catch(e) { setErr(e.message); }
    finally { setSaving(false); }
  };

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 3000,
      background: "rgba(0,0,0,0.7)", display: "flex",
      alignItems: "center", justifyContent: "center", padding: 20,
    }}>
      <div style={{
        background: C.ash, borderRadius: 12, width: "100%", maxWidth: 620,
        border: `1px solid ${C.smoke}`, maxHeight: "92vh", overflow: "hidden",
        display: "flex", flexDirection: "column",
      }}>
        {/* Header */}
        <div style={{ padding: "18px 24px", borderBottom: `1px solid ${C.smoke}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: C.white }}>
            {mode === "create" ? "🔴 Signaler une déficience" : "✏️ Modifier la déficience"}
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: C.mist, fontSize: 20, cursor: "pointer" }}>✕</button>
        </div>

        {/* Body */}
        <div style={{ overflowY: "auto", padding: 24, display: "flex", flexDirection: "column", gap: 16 }}>
          {err && (
            <div style={{ background: "#EF444418", border: "1px solid #EF444440", borderRadius: 6, padding: "10px 14px", fontSize: 12, color: "#EF4444" }}>
              ⚠️ {err}
            </div>
          )}

          <Input label="Titre du problème" value={form.title} onChange={set("title")} placeholder="Ex: Extincteur manquant niveau 2" required/>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Input label="Gravité" value={form.severity} onChange={set("severity")} as="select"
              options={[
                { value: "critical", label: "🔴 Critique" },
                { value: "high",     label: "🟠 Élevée" },
                { value: "medium",   label: "🔵 Moyenne" },
                { value: "low",      label: "🟢 Faible" },
              ]}/>
            <Input label="Spécialité" value={form.trade} onChange={set("trade")} as="select"
              options={[{ value: "", label: "— Sélectionner —" }, ...TRADES]}/>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Input label="Client" value={form.customer_id} onChange={set("customer_id")} as="select" required
              options={[{ value: "", label: "— Sélectionner —" }, ...customers.map(c => ({ value: c.id, label: c.name }))]}/>
            <Input label="Bâtiment" value={form.building_id} onChange={set("building_id")} as="select" required
              options={[{ value: "", label: "— Sélectionner —" }, ...filteredBuildings.map(b => ({ value: b.id, label: b.name }))]}/>
          </div>

          <Input label="Description détaillée" value={form.description} onChange={set("description")}
            as="textarea" rows={3} placeholder="Décrivez le problème en détail..."/>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
            <Input label="Référence NFPA" value={form.nfpa_reference} onChange={set("nfpa_reference")} placeholder="Ex: NFPA 10"/>
            <Input label="Date limite" value={form.due_date} onChange={set("due_date")} type="date"/>
            <Input label="Coût estimé (MAD)" value={form.estimated_cost} onChange={set("estimated_cost")} type="number" placeholder="0.00"/>
          </div>

          <Input label="Assigné à" value={form.assigned_to} onChange={set("assigned_to")} as="select"
            options={[{ value: "", label: "— Non assigné —" }, ...technicians.map(t => ({ value: t.id, label: t.full_name }))]}/>

          {mode === "edit" && (
            <Input label="Statut" value={form.status} onChange={set("status")} as="select"
              options={STATUS_FLOW.map(s => ({ value: s.key, label: `${s.icon} ${s.label}` }))}/>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: "16px 24px", borderTop: `1px solid ${C.smoke}`, display: "flex", justifyContent: "flex-end", gap: 10 }}>
          <Btn variant="secondary" onClick={onClose}>Annuler</Btn>
          <Btn onClick={handleSave} disabled={saving}>
            {saving ? "Enregistrement…" : mode === "create" ? "Signaler la déficience" : "Enregistrer les modifications"}
          </Btn>
        </div>
      </div>
    </div>
  );
};

// ─── DETAIL PANEL ─────────────────────────────────────────────────────────────
const DetailPanel = ({ deficiency: def, technicians, api, onUpdate, onClose }) => {
  const [comment, setComment] = useState("");
  const [comments, setComments] = useState([]);
  const [loadingCmt, setLoadingCmt] = useState(true);
  const [advanceLoading, setAdvanceLoading] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [customers, setCustomers] = useState([]);
  const [buildings, setBuildings] = useState([]);

  useEffect(() => {
    loadComments();
  }, [def.id]);

  const loadComments = async () => {
    setLoadingCmt(true);
    try {
      const rows = await api.get(`deficiency_comments?deficiency_id=eq.${def.id}&select=*,author:profiles(full_name)&order=created_at.asc`);
      setComments(rows || []);
    } catch(e) { console.error(e); }
    finally { setLoadingCmt(false); }
  };

  const sendComment = async () => {
    if (!comment.trim()) return;
    try {
      await api.post("deficiency_comments", {
        deficiency_id: def.id,
        author_id:     def.user_id || def.assigned_to || null,
        comment:       comment.trim(),
      });
      setComment("");
      loadComments();
    } catch(e) { console.error(e); }
  };

  const advanceStatus = async (nextStatus) => {
    setAdvanceLoading(true);
    try {
      const extra = {};
      if (nextStatus === "repaired")  extra.repaired_at  = new Date().toISOString();
      if (nextStatus === "verified")  extra.verified_at  = new Date().toISOString();
      await api.patch("deficiencies", def.id, { status: nextStatus, ...extra });
      onUpdate({ ...def, status: nextStatus, ...extra });
    } catch(e) { console.error(e); }
    finally { setAdvanceLoading(false); }
  };

  const assignee = technicians.find(t => t.id === def.assigned_to);
  const currency = localStorage.getItem("fsCurrency") || "MAD";

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 2000,
      background: "rgba(0,0,0,0.6)", display: "flex", justifyContent: "flex-end",
    }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        width: "100%", maxWidth: 520, background: C.ash,
        borderLeft: `1px solid ${C.smoke}`, height: "100%",
        overflowY: "auto", display: "flex", flexDirection: "column",
      }}>
        {/* Header */}
        <div style={{
          padding: "18px 20px", borderBottom: `1px solid ${C.smoke}`,
          position: "sticky", top: 0, background: C.ash, zIndex: 1,
          display: "flex", gap: 10, alignItems: "flex-start",
        }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6, flexWrap: "wrap" }}>
              <Pill status={def.status}/>
              <SevBadge sev={def.severity}/>
              {def.trade && (
                <span style={{ fontSize: 11, color: C.mist, padding: "2px 8px", background: C.smoke, borderRadius: 10 }}>
                  {TRADES.find(t => t.value === def.trade)?.label || def.trade}
                </span>
              )}
            </div>
            <div style={{ fontSize: 15, fontWeight: 700, color: C.white, lineHeight: 1.4 }}>{def.title}</div>
          </div>
          <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
            <Btn variant="secondary" size="sm" onClick={() => setEditMode(true)} icon="✏️">Modifier</Btn>
            <button onClick={onClose} style={{ background: "none", border: "none", color: C.mist, fontSize: 20, cursor: "pointer", padding: "0 4px" }}>✕</button>
          </div>
        </div>

        <div style={{ flex: 1, padding: 20, display: "flex", flexDirection: "column", gap: 16 }}>

          {/* Workflow */}
          <WorkflowStepper status={def.status} onAdvance={advanceStatus} loading={advanceLoading}/>

          {/* Info grid */}
          <div style={{ background: C.coal, borderRadius: 10, padding: 16, border: `1px solid ${C.smoke}` }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              {[
                ["🏢 Client",      def.customer?.name || "—"],
                ["🏗 Bâtiment",    def.building?.name  || "—"],
                ["📅 Identifié le", def.identified_at ? new Date(def.identified_at).toLocaleDateString("fr-FR") : "—"],
                ["⏰ Date limite",  def.due_date       ? new Date(def.due_date).toLocaleDateString("fr-FR")       : "Aucune"],
                ["💰 Coût estimé", def.estimated_cost  ? `${Number(def.estimated_cost).toLocaleString("fr-FR")} ${currency}` : "—"],
                ["💸 Coût réel",   def.actual_cost     ? `${Number(def.actual_cost).toLocaleString("fr-FR")} ${currency}`    : "—"],
                ["📖 Réf. NFPA",   def.nfpa_reference || "—"],
                ["🔧 Réparé le",   def.repaired_at  ? new Date(def.repaired_at).toLocaleDateString("fr-FR")  : "—"],
              ].map(([label, val]) => (
                <div key={label}>
                  <div style={{ fontSize: 10, color: C.mist, marginBottom: 2 }}>{label}</div>
                  <div style={{ fontSize: 12, color: C.frost, fontWeight: 500 }}>{val}</div>
                </div>
              ))}
            </div>

            {/* Assignee */}
            <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${C.smoke}` }}>
              <div style={{ fontSize: 10, color: C.mist, marginBottom: 6 }}>👤 Assigné à</div>
              {assignee ? (
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Avatar name={assignee.full_name} size={28}/>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: C.white }}>{assignee.full_name}</div>
                    <div style={{ fontSize: 10, color: C.mist }}>{assignee.role}</div>
                  </div>
                </div>
              ) : (
                <div style={{ fontSize: 12, color: C.steel }}>Non assigné</div>
              )}
            </div>
          </div>

          {/* Description */}
          {def.description && (
            <div style={{ background: C.coal, borderRadius: 10, padding: 14, border: `1px solid ${C.smoke}` }}>
              <div style={{ fontSize: 10, color: C.mist, marginBottom: 6, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>Description</div>
              <div style={{ fontSize: 13, color: C.frost, lineHeight: 1.7 }}>{def.description}</div>
            </div>
          )}

          {/* Photos placeholder */}
          {def.photo_urls?.length > 0 && (
            <div style={{ background: C.coal, borderRadius: 10, padding: 14, border: `1px solid ${C.smoke}` }}>
              <div style={{ fontSize: 10, color: C.mist, marginBottom: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>📷 Photos</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {def.photo_urls.map((u, i) => (
                  <img key={i} src={u} alt={`Photo ${i+1}`} style={{ width: 80, height: 80, objectFit: "cover", borderRadius: 6, border: `1px solid ${C.smoke}` }}/>
                ))}
              </div>
            </div>
          )}

          {/* Comments */}
          <div style={{ background: C.coal, borderRadius: 10, border: `1px solid ${C.smoke}`, overflow: "hidden" }}>
            <div style={{ padding: "12px 14px", borderBottom: `1px solid ${C.smoke}`, fontSize: 11, fontWeight: 700, color: C.frost, textTransform: "uppercase", letterSpacing: "0.06em" }}>
              💬 Notes & Commentaires ({comments.length})
            </div>
            <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 10, maxHeight: 260, overflowY: "auto" }}>
              {loadingCmt ? (
                <div style={{ fontSize: 12, color: C.mist, textAlign: "center", padding: 12 }}>Chargement…</div>
              ) : comments.length === 0 ? (
                <div style={{ fontSize: 12, color: C.steel, textAlign: "center", padding: 12 }}>Aucun commentaire pour l'instant</div>
              ) : comments.map((c, i) => (
                <div key={i} style={{ display: "flex", gap: 10 }}>
                  <Avatar name={c.author?.full_name || "?"} size={28}/>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 3 }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: C.white }}>{c.author?.full_name || "—"}</span>
                      <span style={{ fontSize: 10, color: C.mist }}>{new Date(c.created_at).toLocaleString("fr-FR", { day:"2-digit", month:"2-digit", hour:"2-digit", minute:"2-digit" })}</span>
                    </div>
                    <div style={{ fontSize: 12, color: C.frost, lineHeight: 1.6, background: C.smoke, padding: "8px 10px", borderRadius: 6 }}>{c.comment}</div>
                  </div>
                </div>
              ))}
            </div>
            {/* Add comment */}
            <div style={{ padding: "10px 14px", borderTop: `1px solid ${C.smoke}`, display: "flex", gap: 8 }}>
              <textarea
                value={comment}
                onChange={e => setComment(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendComment(); }}}
                placeholder="Ajouter une note… (Entrée pour envoyer)"
                rows={2}
                style={{
                  flex: 1, background: C.smoke, border: `1px solid ${C.steel}`,
                  borderRadius: 6, padding: "8px 10px", fontSize: 12,
                  color: C.white, resize: "none", fontFamily: "inherit",
                }}
              />
              <Btn onClick={sendComment} variant="primary" size="sm" style={{ alignSelf: "flex-end" }}>Envoyer</Btn>
            </div>
          </div>

        </div>{/* end scroll body */}
      </div>

      {/* Edit modal */}
      {editMode && (
        <DeficiencyModal
          mode="edit"
          initial={def}
          customers={[def.customer ? { id: def.customer_id, name: def.customer.name } : null].filter(Boolean)}
          buildings={[def.building  ? { id: def.building_id,  name: def.building.name,  customer_id: def.customer_id } : null].filter(Boolean)}
          technicians={technicians}
          onSave={async (data) => {
            await api.patch("deficiencies", def.id, data);
            onUpdate({ ...def, ...data });
            setEditMode(false);
          }}
          onClose={() => setEditMode(false)}
        />
      )}
    </div>
  );
};

// ─── KANBAN CARD ──────────────────────────────────────────────────────────────
const KanbanCard = ({ def, onClick }) => {
  const sev = SEVERITY[def.severity] || SEVERITY.medium;
  const overdue = def.due_date && new Date(def.due_date) < new Date() && def.status !== "closed";
  return (
    <div onClick={onClick} style={{
      background: C.ash, border: `1px solid ${C.smoke}`,
      borderLeft: `3px solid ${sev.color}`,
      borderRadius: 8, padding: "10px 12px",
      cursor: "pointer", transition: "all 0.12s",
    }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = sev.color; e.currentTarget.style.background = C.smoke; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = C.smoke; e.currentTarget.style.borderLeftColor = sev.color; e.currentTarget.style.background = C.ash; }}
    >
      <div style={{ fontSize: 12, fontWeight: 600, color: C.white, lineHeight: 1.4, marginBottom: 8 }}>{def.title}</div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 6 }}>
        <SevBadge sev={def.severity}/>
        {def.trade && <span style={{ fontSize: 10, color: C.mist, padding: "1px 7px", background: C.smoke, borderRadius: 8 }}>{TRADES.find(t=>t.value===def.trade)?.label || def.trade}</span>}
      </div>
      <div style={{ fontSize: 11, color: C.mist }}>{def.building?.name || "—"} · {def.customer?.name || "—"}</div>
      {def.assigned_to && (
        <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 7 }}>
          <Avatar name={def.assignee?.full_name || "?"} size={18}/>
          <span style={{ fontSize: 10, color: C.mist }}>{def.assignee?.full_name || "?"}</span>
        </div>
      )}
      {overdue && (
        <div style={{ marginTop: 6, fontSize: 10, color: "#EF4444", fontWeight: 600 }}>⚠️ En retard</div>
      )}
    </div>
  );
};

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
export default function Deficiencies({ user, supabase: sbConfig }) {
  const api = mkApi(sbConfig);
  const companyId = user?.company_id;

  // Data
  const [deficiencies, setDeficiencies] = useState([]);
  const [customers,    setCustomers]    = useState([]);
  const [buildings,    setBuildings]    = useState([]);
  const [technicians,  setTechnicians]  = useState([]);

  // UI State
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState("");
  const [view,       setView]       = useState("kanban"); // "kanban" | "list"
  const [search,     setSearch]     = useState("");
  const [sevFilter,  setSevFilter]  = useState("all");
  const [showCreate, setShowCreate] = useState(false);
  const [selected,   setSelected]   = useState(null);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const [defs, custs, blds, techs] = await Promise.all([
        api.get(`deficiencies?company_id=eq.${companyId}&select=*,customer:customers(id,name),building:buildings(id,name),assignee:profiles!assigned_to(id,full_name)&order=identified_at.desc`),
        api.get(`customers?company_id=eq.${companyId}&is_active=eq.true&select=id,name&order=name.asc`),
        api.get(`buildings?company_id=eq.${companyId}&select=id,name,customer_id&order=name.asc`),
        api.get(`profiles?company_id=eq.${companyId}&select=id,full_name,role&order=full_name.asc`),
      ]);
      setDeficiencies(defs || []);
      setCustomers(custs || []);
      setBuildings(blds || []);
      setTechnicians(techs || []);
    } catch(e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => { load(); }, [load]);

  // Filtered list
  const filtered = deficiencies.filter(d => {
    const matchSearch = !search ||
      d.title?.toLowerCase().includes(search.toLowerCase()) ||
      d.customer?.name?.toLowerCase().includes(search.toLowerCase()) ||
      d.building?.name?.toLowerCase().includes(search.toLowerCase());
    const matchSev = sevFilter === "all" || d.severity === sevFilter;
    return matchSearch && matchSev;
  });

  // Stats
  const counts = deficiencies.reduce((acc, d) => { acc[d.status] = (acc[d.status]||0)+1; return acc; }, {});
  const sevCounts = deficiencies.reduce((acc, d) => { acc[d.severity] = (acc[d.severity]||0)+1; return acc; }, {});

  const handleCreate = async (data) => {
    await api.post("deficiencies", {
      ...data,
      company_id:    companyId,
      identified_at: new Date().toISOString(),
    });
    setShowCreate(false);
    load();
  };

  const handleUpdate = (updated) => {
    setDeficiencies(prev => prev.map(d => d.id === updated.id ? { ...d, ...updated } : d));
    setSelected(updated);
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Supprimer cette déficience ?")) return;
    await api.del("deficiencies", id);
    setSelected(null);
    load();
  };

  // Kanban grouped by status
  const byStatus = STATUS_FLOW.reduce((acc, s) => {
    acc[s.key] = filtered.filter(d => d.status === s.key);
    return acc;
  }, {});

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", background: C.coal }}>

      {/* ── HEADER BAR ── */}
      <div style={{ padding: "16px 24px", borderBottom: `1px solid ${C.smoke}`, display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>

        {/* Search */}
        <div style={{ position: "relative" }}>
          <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", fontSize: 14, color: C.mist }}>🔍</span>
          <input
            placeholder="Rechercher..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ background: C.smoke, border: `1px solid ${C.steel}`, borderRadius: 6, padding: "8px 12px 8px 32px", fontSize: 12, color: C.frost, width: 220 }}
          />
        </div>

        {/* Severity filter */}
        <div style={{ display: "flex", gap: 4, background: C.ash, border: `1px solid ${C.smoke}`, borderRadius: 8, padding: 4 }}>
          {[{ value: "all", label: "Toutes" }, ...Object.entries(SEVERITY).map(([k,v]) => ({ value: k, label: v.label }))].map(f => (
            <button key={f.value} onClick={() => setSevFilter(f.value)} style={{
              padding: "5px 12px", borderRadius: 5, border: "none",
              background: sevFilter === f.value ? C.flame : "transparent",
              color: sevFilter === f.value ? "#fff" : C.mist,
              fontSize: 11, fontWeight: 500, cursor: "pointer",
            }}>{f.label}</button>
          ))}
        </div>

        {/* View toggle */}
        <div style={{ display: "flex", gap: 4, background: C.ash, border: `1px solid ${C.smoke}`, borderRadius: 8, padding: 4 }}>
          {[["kanban","⬛ Kanban"],["list","☰ Liste"]].map(([v,l]) => (
            <button key={v} onClick={() => setView(v)} style={{
              padding: "5px 12px", borderRadius: 5, border: "none",
              background: view === v ? C.flame : "transparent",
              color: view === v ? "#fff" : C.mist,
              fontSize: 11, fontWeight: 500, cursor: "pointer",
            }}>{l}</button>
          ))}
        </div>

        <div style={{ flex: 1 }}/>
        <Btn onClick={() => setShowCreate(true)} icon="＋">Signaler une déficience</Btn>
      </div>

      {/* ── STAT PILLS ── */}
      <div style={{ padding: "10px 24px", display: "flex", gap: 10, flexWrap: "wrap", borderBottom: `1px solid ${C.smoke}` }}>
        {STATUS_FLOW.map(s => (
          <div key={s.key} style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "4px 12px", borderRadius: 20,
            background: s.bg, border: `1px solid ${s.color}30`,
            fontSize: 11, fontWeight: 600, color: s.color,
          }}>
            {s.icon} {s.label} <span style={{ background: s.color, color: "#fff", borderRadius: 10, padding: "0 5px", fontSize: 10 }}>{counts[s.key]||0}</span>
          </div>
        ))}
        <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
          {Object.entries(SEVERITY).map(([k,v]) => (
            <div key={k} style={{ fontSize: 11, color: v.color, padding: "4px 8px", background: v.bg, borderRadius: 10 }}>
              {v.label}: {sevCounts[k]||0}
            </div>
          ))}
        </div>
      </div>

      {/* ── ERROR ── */}
      {error && (
        <div style={{ margin: "12px 24px", padding: "10px 14px", background: "#EF444418", border: "1px solid #EF444440", borderRadius: 6, fontSize: 12, color: "#EF4444", display: "flex", justifyContent: "space-between" }}>
          ⚠️ {error}
          <button onClick={load} style={{ background: "none", border: "none", color: "#EF4444", cursor: "pointer", fontSize: 12 }}>↺ Réessayer</button>
        </div>
      )}

      {/* ── CONTENT ── */}
      <div style={{ flex: 1, overflowY: "auto", padding: 24 }}>
        {loading ? <Spinner/> : (

          view === "kanban" ? (
            /* ═══ KANBAN ═══ */
            <div style={{ display: "flex", gap: 14, alignItems: "flex-start", overflowX: "auto", paddingBottom: 8 }}>
              {STATUS_FLOW.map(col => (
                <div key={col.key} style={{ minWidth: 230, maxWidth: 250, flexShrink: 0, display: "flex", flexDirection: "column", gap: 0 }}>
                  {/* Column header */}
                  <div style={{
                    display: "flex", alignItems: "center", gap: 8, padding: "8px 10px",
                    background: col.bg, borderRadius: "8px 8px 0 0",
                    border: `1px solid ${col.color}30`, borderBottom: "none",
                  }}>
                    <span style={{ fontSize: 14 }}>{col.icon}</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: col.color }}>{col.label}</span>
                    <span style={{ marginLeft: "auto", background: col.color, color: "#fff", borderRadius: 10, padding: "0 6px", fontSize: 10, fontWeight: 700 }}>
                      {byStatus[col.key]?.length || 0}
                    </span>
                  </div>
                  {/* Cards */}
                  <div style={{
                    background: C.ash, border: `1px solid ${C.smoke}`, borderTop: `2px solid ${col.color}`,
                    borderRadius: "0 0 8px 8px", padding: 8,
                    display: "flex", flexDirection: "column", gap: 8,
                    minHeight: 80,
                  }}>
                    {byStatus[col.key]?.length === 0 && (
                      <div style={{ fontSize: 11, color: C.steel, textAlign: "center", padding: "16px 8px" }}>Aucune</div>
                    )}
                    {byStatus[col.key]?.map(d => (
                      <KanbanCard key={d.id} def={d} onClick={() => setSelected(d)}/>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            /* ═══ LIST ═══ */
            <div style={{ background: C.ash, borderRadius: 10, border: `1px solid ${C.smoke}`, overflow: "hidden" }}>
              {/* Table header */}
              <div style={{
                display: "grid",
                gridTemplateColumns: "2fr 1fr 100px 120px 130px 120px 100px",
                padding: "10px 16px", background: "#111",
                fontSize: 10, fontWeight: 700, color: C.mist,
                textTransform: "uppercase", letterSpacing: "0.06em",
              }}>
                {["Problème","Bâtiment","Gravité","Trade","Statut","Assigné","Date"].map(h => <div key={h}>{h}</div>)}
              </div>

              {filtered.length === 0 && (
                <div style={{ padding: 40, textAlign: "center", color: C.mist, fontSize: 13 }}>
                  Aucune déficience trouvée
                </div>
              )}

              {filtered.map((d, i) => (
                <div key={d.id}
                  onClick={() => setSelected(d)}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "2fr 1fr 100px 120px 130px 120px 100px",
                    padding: "11px 16px",
                    background: i % 2 === 1 ? "#111" : C.ash,
                    borderBottom: `1px solid ${C.smoke}`,
                    cursor: "pointer", transition: "background 0.12s",
                    alignItems: "center",
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = C.smoke}
                  onMouseLeave={e => e.currentTarget.style.background = i % 2 === 1 ? "#111" : C.ash}
                >
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: C.white }}>{d.title}</div>
                    <div style={{ fontSize: 10, color: C.mist, marginTop: 2 }}>{d.customer?.name || "—"}</div>
                  </div>
                  <div style={{ fontSize: 12, color: C.mist }}>{d.building?.name || "—"}</div>
                  <SevBadge sev={d.severity}/>
                  <div style={{ fontSize: 11, color: C.mist }}>{TRADES.find(t=>t.value===d.trade)?.label || "—"}</div>
                  <Pill status={d.status}/>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    {d.assignee ? <><Avatar name={d.assignee.full_name} size={20}/><span style={{ fontSize: 11, color: C.mist }}>{d.assignee.full_name.split(" ")[0]}</span></> : <span style={{ fontSize: 11, color: C.steel }}>—</span>}
                  </div>
                  <div style={{ fontSize: 11, color: C.mist }}>{d.identified_at ? new Date(d.identified_at).toLocaleDateString("fr-FR") : "—"}</div>
                </div>
              ))}
            </div>
          )
        )}
      </div>

      {/* ── MODALS ── */}
      {showCreate && (
        <DeficiencyModal
          mode="create"
          customers={customers}
          buildings={buildings}
          technicians={technicians}
          onSave={handleCreate}
          onClose={() => setShowCreate(false)}
        />
      )}

      {selected && (
        <DetailPanel
          deficiency={selected}
          technicians={technicians}
          api={api}
          onUpdate={handleUpdate}
          onClose={() => setSelected(null)}
        />
      )}

    </div>
  );
}
