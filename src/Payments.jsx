// ============================================================
// FireSafe Pro — Paiements
// Payments.jsx
// ============================================================
import React, { useState, useEffect, useCallback } from "react";

const mkApi = ({ url, anonKey, jwt }) => {
  const h = (x={}) => ({ "Content-Type":"application/json", apikey:anonKey, Authorization:`Bearer ${jwt}`, Prefer:"return=representation", ...x });
  const get   = async p => { const r=await fetch(`${url}/rest/v1/${p}`,{headers:h()}); const t=await r.text(); if(!r.ok) throw new Error(JSON.parse(t)?.message||t); return t?JSON.parse(t):[]; };
  const post  = async (tb,b) => { const r=await fetch(`${url}/rest/v1/${tb}`,{method:"POST",headers:h(),body:JSON.stringify(b)}); const t=await r.text(); if(!r.ok) throw new Error(JSON.parse(t)?.message||t); return t?JSON.parse(t):null; };
  const patch = async (tb,id,b) => { const r=await fetch(`${url}/rest/v1/${tb}?id=eq.${id}`,{method:"PATCH",headers:h(),body:JSON.stringify(b)}); const t=await r.text(); if(!r.ok) throw new Error(JSON.parse(t)?.message||t); return t?JSON.parse(t):null; };
  const del   = async (tb,id) => { const r=await fetch(`${url}/rest/v1/${tb}?id=eq.${id}`,{method:"DELETE",headers:h({Prefer:""})}); if(!r.ok) throw new Error("Delete failed"); };
  return { get, post, patch, del };
};

const C = { coal:"#0D0D0D",ash:"#1A1A1A",smoke:"#2A2A2A",steel:"#3A3A3A",mist:"#8A8A8A",frost:"#E8E8E8",white:"#FAFAFA",flame:"#FF4500",ember:"#FF8C00",safe:"#22C55E",warn:"#F59E0B",danger:"#EF4444",info:"#3B82F6" };
const cur = () => localStorage.getItem("fsCurrency") || "MAD";
const fmt = n => Number(n||0).toLocaleString("fr-FR",{minimumFractionDigits:2,maximumFractionDigits:2}) + " " + cur();
const fmtDate = d => d ? new Date(d).toLocaleDateString("fr-FR",{day:"2-digit",month:"2-digit",year:"numeric"}) : "—";

const METHODS = [
  { value:"cash",    label:"💵 Espèces",     color:"#22C55E" },
  { value:"check",   label:"📄 Chèque",      color:"#3B82F6" },
  { value:"card",    label:"💳 Carte",        color:"#8B5CF6" },
  { value:"ach",     label:"🏦 Virement",     color:"#F59E0B" },
  { value:"other",   label:"🔄 Autre",        color:"#6B7280" },
];
const METHOD_MAP = Object.fromEntries(METHODS.map(m=>[m.value,m]));

const STATUS_MAP = {
  completed: { label:"Reçu",    color:"#22C55E", bg:"#22C55E18" },
  pending:   { label:"En attente",color:"#F59E0B",bg:"#F59E0B18" },
  failed:    { label:"Échoué",   color:"#EF4444", bg:"#EF444418" },
  refunded:  { label:"Remboursé",color:"#6B7280", bg:"#6B728018" },
};

const Btn = ({ children, onClick, variant="primary", size="md", disabled, style:sx={}, icon }) => {
  const v = { primary:{background:C.flame,color:"#fff"}, secondary:{background:C.smoke,color:C.frost,border:`1px solid ${C.steel}`}, ghost:{background:"transparent",color:C.mist}, danger:{background:"#EF444418",color:"#EF4444",border:"1px solid #EF444440"} };
  return <button onClick={onClick} disabled={disabled} style={{ display:"inline-flex",alignItems:"center",gap:6,border:"none",borderRadius:6,cursor:disabled?"not-allowed":"pointer",fontFamily:"inherit",fontWeight:500,transition:"all 0.12s",opacity:disabled?.5:1,fontSize:size==="sm"?12:13,padding:size==="sm"?"6px 12px":"9px 16px",...v[variant],...sx }}>{icon&&<span>{icon}</span>}{children}</button>;
};
const Field = ({ label, value, onChange, type="text", placeholder, required, as, options }) => (
  <div style={{ display:"flex",flexDirection:"column",gap:5 }}>
    {label&&<label style={{ fontSize:12,fontWeight:500,color:C.frost }}>{label}{required&&<span style={{ color:C.danger }}> *</span>}</label>}
    {as==="select" ? <select value={value} onChange={onChange} style={{ background:C.smoke,border:`1px solid ${C.steel}`,borderRadius:6,padding:"9px 12px",fontSize:13,color:value?C.white:C.mist }}>{options.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}</select>
    : as==="textarea" ? <textarea value={value} onChange={onChange} rows={2} placeholder={placeholder} style={{ background:C.smoke,border:`1px solid ${C.steel}`,borderRadius:6,padding:"9px 12px",fontSize:13,color:C.white,resize:"vertical",fontFamily:"inherit" }}/>
    : <input type={type} value={value} onChange={onChange} placeholder={placeholder} style={{ background:C.smoke,border:`1px solid ${C.steel}`,borderRadius:6,padding:"9px 12px",fontSize:13,color:C.white }} />}
  </div>
);
const Spinner = () => <div style={{ display:"flex",justifyContent:"center",padding:48 }}><div style={{ width:28,height:28,borderRadius:"50%",border:`3px solid ${C.steel}`,borderTopColor:C.flame,animation:"spin 0.7s linear infinite" }}/></div>;

// ─── PAYMENT MODAL ────────────────────────────────────────────────────────────
const PaymentModal = ({ invoices, onSave, onClose, preselectedInvoice }) => {
  const [form, setForm] = useState({
    invoice_id:       preselectedInvoice?.id || "",
    amount:           preselectedInvoice ? String(Number(preselectedInvoice.balance_due||preselectedInvoice.total||0)) : "",
    method:           "cash",
    reference_number: "",
    notes:            "",
    paid_at:          new Date().toISOString().split("T")[0],
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr]       = useState("");
  const set = k => e => setForm(f => {
    const next = { ...f, [k]: e.target.value };
    if (k === "invoice_id") {
      const inv = invoices.find(i => i.id === e.target.value);
      if (inv) next.amount = String(Number(inv.balance_due || inv.total || 0));
    }
    return next;
  });

  const selectedInvoice = invoices.find(i => i.id === form.invoice_id);

  const handleSave = async () => {
    if (!form.invoice_id) return setErr("Sélectionnez une facture");
    if (!form.amount || Number(form.amount) <= 0) return setErr("Montant invalide");
    setSaving(true); setErr("");
    try { await onSave({ ...form, amount: Number(form.amount) }); }
    catch(e) { setErr(e.message); setSaving(false); }
  };

  return (
    <div style={{ position:"fixed",inset:0,zIndex:3000,background:"rgba(0,0,0,0.75)",display:"flex",alignItems:"center",justifyContent:"center",padding:20 }}>
      <div style={{ background:C.ash,borderRadius:12,width:"100%",maxWidth:520,border:`1px solid ${C.smoke}`,overflow:"hidden",display:"flex",flexDirection:"column" }}>
        <div style={{ padding:"18px 24px",borderBottom:`1px solid ${C.smoke}`,display:"flex",justifyContent:"space-between",alignItems:"center" }}>
          <div style={{ fontSize:15,fontWeight:700,color:C.white }}>💳 Enregistrer un paiement</div>
          <button onClick={onClose} style={{ background:"none",border:"none",color:C.mist,fontSize:20,cursor:"pointer" }}>✕</button>
        </div>
        <div style={{ padding:24,display:"flex",flexDirection:"column",gap:14 }}>
          {err && <div style={{ background:"#EF444418",border:"1px solid #EF444440",borderRadius:6,padding:"10px 14px",fontSize:12,color:"#EF4444" }}>⚠️ {err}</div>}

          <Field label="Facture" value={form.invoice_id} onChange={set("invoice_id")} as="select" required
            options={[{value:"",label:"— Sélectionner une facture —"},...invoices.map(i=>({value:i.id,label:`${i.invoice_number} — ${i.customer?.name||"?"} — Solde: ${fmt(i.balance_due||i.total)}`}))]}/>

          {/* Invoice summary */}
          {selectedInvoice && (
            <div style={{ background:"#3B82F618",border:"1px solid #3B82F640",borderRadius:8,padding:"10px 14px",display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8 }}>
              {[["Total",fmt(selectedInvoice.total)],["Payé",fmt(selectedInvoice.amount_paid)],["Solde dû",fmt(selectedInvoice.balance_due||selectedInvoice.total)]].map(([l,v])=>(
                <div key={l}><div style={{ fontSize:10,color:C.mist }}>{l}</div><div style={{ fontSize:13,fontWeight:700,color:C.white }}>{v}</div></div>
              ))}
            </div>
          )}

          <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:12 }}>
            <Field label={`Montant (${cur()})`} value={form.amount} onChange={set("amount")} type="number" placeholder="0.00" required/>
            <Field label="Date de paiement" value={form.paid_at} onChange={set("paid_at")} type="date" required/>
          </div>

          <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:12 }}>
            <Field label="Mode de paiement" value={form.method} onChange={set("method")} as="select" options={METHODS.map(m=>({value:m.value,label:m.label}))}/>
            <Field label="Référence / N° chèque" value={form.reference_number} onChange={set("reference_number")} placeholder="Ex: CHQ-001234"/>
          </div>
          <Field label="Notes" value={form.notes} onChange={set("notes")} as="textarea" placeholder="Remarques optionnelles..."/>
        </div>
        <div style={{ padding:"16px 24px",borderTop:`1px solid ${C.smoke}`,display:"flex",justifyContent:"flex-end",gap:10 }}>
          <Btn variant="secondary" onClick={onClose}>Annuler</Btn>
          <Btn onClick={handleSave} disabled={saving}>{saving?"Enregistrement…":"💾 Enregistrer le paiement"}</Btn>
        </div>
      </div>
    </div>
  );
};

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
export default function Payments({ user, supabase: sbConfig }) {
  const api = mkApi(sbConfig);
  const cid = user?.company_id;

  const [payments,  setPayments]  = useState([]);
  const [invoices,  setInvoices]  = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState("");
  const [search,    setSearch]    = useState("");
  const [methodF,   setMethodF]   = useState("all");
  const [showModal, setShowModal] = useState(false);
  const [preselect, setPreselect] = useState(null);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const h = { apikey:sbConfig.anonKey, Authorization:`Bearer ${sbConfig.jwt}` };
      // Payments with customer join via invoice
      const rawPayments = await fetch(`${sbConfig.url}/rest/v1/payments?company_id=eq.${cid}&select=*&order=paid_at.desc`,{headers:h}).then(r=>r.json()).catch(()=>[]);

      // Load customer and invoice info separately
      const invIds  = [...new Set((rawPayments||[]).map(p=>p.invoice_id).filter(Boolean))];
      const custIds = [...new Set((rawPayments||[]).map(p=>p.customer_id).filter(Boolean))];
      const [invData,custData] = await Promise.all([
        invIds.length  ? fetch(`${sbConfig.url}/rest/v1/invoices?id=in.(${invIds.join(",")})&select=id,invoice_number,total,amount_paid,balance_due`,{headers:h}).then(r=>r.json()).catch(()=>[]) : [],
        custIds.length ? fetch(`${sbConfig.url}/rest/v1/customers?id=in.(${custIds.join(",")})&select=id,name`,{headers:h}).then(r=>r.json()).catch(()=>[]) : [],
      ]);
      const im = Object.fromEntries((invData||[]).map(i=>[i.id,i]));
      const cm = Object.fromEntries((custData||[]).map(c=>[c.id,c]));
      setPayments((rawPayments||[]).map(p=>({...p, invoice:im[p.invoice_id]||null, customer:cm[p.customer_id]||null })));

      // Unpaid / partial invoices for modal
      const unpaid = await fetch(`${sbConfig.url}/rest/v1/invoices?company_id=eq.${cid}&status=in.(sent,pending,overdue)&select=id,invoice_number,total,amount_paid,balance_due,customer_id,customer:customers(id,name)&order=due_date.asc`,{headers:h}).then(r=>r.json()).catch(()=>[]);
      setInvoices(unpaid||[]);
    } catch(e) { setError(e.message); } finally { setLoading(false); }
  }, [cid]);

  useEffect(() => { load(); }, [load]);

  const handleSave = async (data) => {
    const inv = invoices.find(i => i.id === data.invoice_id);
    const customerId = inv?.customer_id || data.customer_id;
    await api.post("payments", {
      ...data,
      company_id:  cid,
      customer_id: customerId,
      status:      "completed",
      paid_at:     data.paid_at ? new Date(data.paid_at).toISOString() : new Date().toISOString(),
    });
    // Update invoice amount_paid
    if (inv) {
      const newPaid = Number(inv.amount_paid||0) + Number(data.amount);
      const newStatus = newPaid >= Number(inv.total) ? "paid" : "pending";
      await api.patch("invoices", data.invoice_id, { amount_paid: newPaid, status: newStatus, ...(newStatus==="paid"?{paid_at:new Date().toISOString()}:{}) });
    }
    setShowModal(false); setPreselect(null);
    load();
  };

  const filtered = payments.filter(p => {
    const ms = !search || p.customer?.name?.toLowerCase().includes(search.toLowerCase()) || p.invoice?.invoice_number?.toLowerCase().includes(search.toLowerCase()) || p.reference_number?.toLowerCase().includes(search.toLowerCase());
    const mm = methodF === "all" || p.method === methodF;
    return ms && mm;
  });

  // Summary stats
  const totalReceived = payments.filter(p=>p.status==="completed").reduce((s,p)=>s+Number(p.amount),0);
  const thisMonth = payments.filter(p=>p.status==="completed"&&p.paid_at&&new Date(p.paid_at)>=new Date(new Date().getFullYear(),new Date().getMonth(),1)).reduce((s,p)=>s+Number(p.amount),0);
  const pending = invoices.reduce((s,i)=>s+Number(i.balance_due||0),0);

  return (
    <div style={{ height:"100%",display:"flex",flexDirection:"column",background:C.coal }}>

      {/* ── TOOLBAR ── */}
      <div style={{ padding:"14px 24px",borderBottom:`1px solid ${C.smoke}`,display:"flex",alignItems:"center",gap:12,flexWrap:"wrap" }}>
        <div style={{ position:"relative" }}>
          <span style={{ position:"absolute",left:10,top:"50%",transform:"translateY(-50%)",color:C.mist }}>🔍</span>
          <input placeholder="Client, facture, référence..." value={search} onChange={e=>setSearch(e.target.value)}
            style={{ background:C.smoke,border:`1px solid ${C.steel}`,borderRadius:6,padding:"8px 12px 8px 32px",fontSize:12,color:C.frost,width:240 }}/>
        </div>
        <div style={{ display:"flex",gap:4,background:C.ash,border:`1px solid ${C.smoke}`,borderRadius:8,padding:4 }}>
          {[{value:"all",label:"Tous"},...METHODS].map(m=>(
            <button key={m.value} onClick={()=>setMethodF(m.value)} style={{ padding:"5px 11px",borderRadius:5,border:"none",background:methodF===m.value?C.flame:"transparent",color:methodF===m.value?"#fff":C.mist,fontSize:11,cursor:"pointer" }}>{m.label}</button>
          ))}
        </div>
        <div style={{ flex:1 }}/>
        <Btn onClick={()=>{ setPreselect(null); setShowModal(true); }} icon="＋">Enregistrer un paiement</Btn>
      </div>

      {/* ── KPI CARDS ── */}
      <div style={{ display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:16,padding:"16px 24px",borderBottom:`1px solid ${C.smoke}` }}>
        {[
          { label:"Total reçu", value:fmt(totalReceived), color:C.safe,   icon:"💰", sub:"Tous les paiements" },
          { label:"Ce mois-ci", value:fmt(thisMonth),     color:C.flame,  icon:"📅", sub:new Date().toLocaleDateString("fr-FR",{month:"long",year:"numeric"}) },
          { label:"En attente", value:fmt(pending),        color:C.warn,   icon:"⏳", sub:`${invoices.length} facture(s) impayée(s)` },
        ].map(k=>(
          <div key={k.label} style={{ background:C.ash,borderRadius:10,padding:16,border:`1px solid ${C.smoke}`,display:"flex",alignItems:"center",gap:14 }}>
            <div style={{ width:44,height:44,borderRadius:10,background:`${k.color}18`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,flexShrink:0 }}>{k.icon}</div>
            <div>
              <div style={{ fontSize:11,color:C.mist,marginBottom:3 }}>{k.label}</div>
              <div style={{ fontSize:18,fontWeight:800,color:k.color,fontFamily:"Syne,sans-serif" }}>{k.value}</div>
              <div style={{ fontSize:10,color:C.steel,marginTop:1 }}>{k.sub}</div>
            </div>
          </div>
        ))}
      </div>

      {error && <div style={{ margin:"12px 24px",padding:"10px 14px",background:"#EF444418",border:"1px solid #EF444440",borderRadius:6,fontSize:12,color:"#EF4444" }}>⚠️ {error}</div>}

      <div style={{ flex:1,overflowY:"auto",padding:"0 24px 24px",marginTop:24,display:"flex",flexDirection:"column",gap:20 }}>

        {/* ── UNPAID INVOICES ── */}
        {invoices.length > 0 && (
          <div>
            <div style={{ fontSize:12,fontWeight:700,color:C.warn,marginBottom:10,display:"flex",alignItems:"center",gap:8 }}>
              ⚠️ Factures en attente de règlement ({invoices.length})
            </div>
            <div style={{ display:"flex",flexDirection:"column",gap:8 }}>
              {invoices.slice(0,5).map(inv=>(
                <div key={inv.id} style={{ background:C.ash,borderRadius:8,padding:"12px 16px",border:`1px solid ${C.warn}30`,display:"flex",alignItems:"center",gap:12 }}>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:13,fontWeight:600,color:C.white }}>{inv.customer?.name||"—"}</div>
                    <div style={{ fontSize:11,color:C.mist,marginTop:2 }}>{inv.invoice_number}</div>
                  </div>
                  <div style={{ textAlign:"right" }}>
                    <div style={{ fontSize:14,fontWeight:700,color:C.warn }}>{fmt(inv.balance_due||inv.total)}</div>
                    <div style={{ fontSize:10,color:C.mist }}>Solde dû</div>
                  </div>
                  <Btn size="sm" onClick={()=>{ setPreselect(inv); setShowModal(true); }} icon="＋">Payer</Btn>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── PAYMENTS TABLE ── */}
        <div>
          <div style={{ fontSize:12,fontWeight:700,color:C.frost,marginBottom:10 }}>Historique des paiements</div>
          {loading ? <Spinner/> : (
            <div style={{ background:C.ash,borderRadius:10,border:`1px solid ${C.smoke}`,overflow:"hidden" }}>
              <div style={{ display:"grid",gridTemplateColumns:"130px 1fr 1fr 130px 130px 110px 90px",padding:"10px 16px",background:"#111",fontSize:10,fontWeight:700,color:C.mist,textTransform:"uppercase",letterSpacing:"0.06em" }}>
                {["Date","Client","Facture","Montant","Mode","Référence","Statut"].map(h=><div key={h}>{h}</div>)}
              </div>
              {filtered.length === 0 ? (
                <div style={{ padding:40,textAlign:"center",color:C.mist,fontSize:13 }}>Aucun paiement trouvé</div>
              ) : filtered.map((p,i)=>{
                const method = METHOD_MAP[p.method]||{label:p.method,color:C.mist};
                const status = STATUS_MAP[p.status]||{label:p.status,color:C.mist,bg:C.smoke};
                return (
                  <div key={p.id} style={{ display:"grid",gridTemplateColumns:"130px 1fr 1fr 130px 130px 110px 90px",padding:"11px 16px",background:i%2===1?"#111":C.ash,borderBottom:`1px solid ${C.smoke}`,alignItems:"center" }}>
                    <span style={{ fontSize:11,color:C.mist }}>{fmtDate(p.paid_at||p.created_at)}</span>
                    <div>
                      <div style={{ fontSize:12,fontWeight:600,color:C.white }}>{p.customer?.name||"—"}</div>
                    </div>
                    <span style={{ fontSize:11,color:C.info }}>{p.invoice?.invoice_number||"—"}</span>
                    <span style={{ fontSize:13,fontWeight:700,color:C.safe }}>{fmt(p.amount)}</span>
                    <span style={{ fontSize:11,color:method.color }}>{method.label}</span>
                    <span style={{ fontSize:11,color:C.mist,fontFamily:"monospace" }}>{p.reference_number||"—"}</span>
                    <span style={{ padding:"3px 9px",borderRadius:20,fontSize:10,fontWeight:600,color:status.color,background:status.bg }}>{status.label}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>

      {showModal && (
        <PaymentModal invoices={invoices} preselectedInvoice={preselect} onSave={handleSave} onClose={()=>{ setShowModal(false); setPreselect(null); }}/>
      )}
    </div>
  );
}
