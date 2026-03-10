// ============================================================
// FireSafe Pro — Invoice PDF  (A4 strict, pinned footer)
// InvoicePDF.jsx
// ============================================================
import React, { useState, useEffect } from "react";

// ─── API ──────────────────────────────────────────────────────────────────────
const get = async (url, anonKey, jwt, path) => {
  const r = await fetch(`${url}/rest/v1/${path}`, {
    headers: { apikey: anonKey, Authorization: `Bearer ${jwt}` },
  });
  const t = await r.text();
  if (!r.ok) throw new Error(t);
  return t ? JSON.parse(t) : [];
};

// ─── HELPERS ──────────────────────────────────────────────────────────────────
const getCurrency = () => localStorage.getItem("fsCurrency") || "MAD";

const fmt = (n) =>
  Number(n || 0).toLocaleString("fr-FR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }) + " " + getCurrency();

const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString("fr-FR", {
    day: "2-digit", month: "2-digit", year: "numeric",
  }) : "—";

// ─── NUMBER → FRENCH WORDS ────────────────────────────────────────────────────
const ONES = ["","un","deux","trois","quatre","cinq","six","sept","huit","neuf","dix",
              "onze","douze","treize","quatorze","quinze","seize","dix-sept","dix-huit","dix-neuf"];
const TENS = ["","","vingt","trente","quarante","cinquante",
              "soixante","soixante","quatre-vingt","quatre-vingt"];

function below1000(n) {
  if (n === 0) return "";
  if (n < 20)  return ONES[n];
  const t = Math.floor(n / 10), u = n % 10;
  if (t === 7 || t === 9)
    return TENS[t] + (u === 0 ? "" : (t === 7 && u === 1 ? " et " : "-") + ONES[10 + u]);
  if (t === 8)
    return "quatre-vingt" + (u === 0 ? "s" : "-" + ONES[u]);
  return TENS[t] + (u === 0 ? "" : u === 1 ? " et un" : "-" + ONES[u]);
}

function toWords(amount) {
  if (!amount || amount === 0) return "ZÉRO";
  const n   = Math.abs(amount);
  const int = Math.floor(n);
  const dec = Math.round((n - int) * 100);
  let s = "";
  const M = Math.floor(int / 1_000_000);
  if (M > 0) s += (M === 1 ? "un million" : below1000(M) + " millions") + " ";
  const K = Math.floor((int % 1_000_000) / 1000);
  if (K > 0) s += (K === 1 ? "mille" : below1000(K) + " mille") + " ";
  const H = int % 1000;
  const hh = Math.floor(H / 100);
  if (hh > 0) s += (hh === 1 ? "cent" : ONES[hh] + " cent") + (H % 100 === 0 && hh > 1 ? "s" : "") + " ";
  s += below1000(H % 100);
  if (dec > 0) s += " et " + below1000(dec) + " centimes";
  return s.trim().replace(/\s+/g, " ").toUpperCase();
}

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const STATUS_FR  = { draft:"Brouillon", sent:"Envoyée", pending:"En attente", paid:"Payée", overdue:"En retard", void:"Annulée" };
const STATUS_COL = { draft:"#888", sent:"#3B82F6", pending:"#F59E0B", paid:"#22C55E", overdue:"#EF4444", void:"#888" };

// A4 dimensions at 96 dpi: 794 × 1123 px
const A4W = 794;
const A4H = 1123;
const PAD = 40; // horizontal padding

// ─── COMPONENT ────────────────────────────────────────────────────────────────
export default function InvoicePDF({ invoice: init, onClose, supabase: sb }) {
  const { url, anonKey, jwt } = sb;

  const [inv,     setInv]     = useState(init);
  const [items,   setItems]   = useState([]);
  const [co,      setCo]      = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [invArr, rawLines] = await Promise.all([
          get(url, anonKey, jwt,
            `invoices?id=eq.${init.id}&select=*,customer:customers(*),building:buildings(name,address,city,zip)`),
          get(url, anonKey, jwt,
            `invoice_line_items?invoice_id=eq.${init.id}&order=order_index`),
        ]);
        const full = invArr?.[0] || init;
        setInv(full);

        let lines = rawLines || [];
        if (!lines.length && full.proposal_id) {
          lines = await get(url, anonKey, jwt,
            `proposal_line_items?proposal_id=eq.${full.proposal_id}&order=order_index`) || [];
        }
        setItems(lines);

        const companyId = full?.company_id || init?.company_id;
        const coArr = companyId
          ? await get(url, anonKey, jwt, `companies?id=eq.${companyId}&select=*`)
          : null;
        setCo(coArr?.[0] || null);
      } catch(e) { console.error(e); }
      finally { setLoading(false); }
    })();
  }, [init.id]);

  // ── Totals ──
  const subtotal = items.reduce((s, i) => s + Number(i.quantity || 0) * Number(i.unit_price || 0), 0);
  const taxRate  = Number(inv?.tax_rate || 20);
  const taxPct   = taxRate > 1 ? taxRate : taxRate * 100;
  const taxAmt   = subtotal * (taxPct / 100);
  const discount = Number(inv?.discount || 0);
  const total    = subtotal + taxAmt - discount;
  const paid     = Number(inv?.amount_paid || 0);
  const balance  = total - paid;

  // ── Company ──
  const logo    = co?.logo_url  || localStorage.getItem("fsCompanyLogo") || "";
  const coName  = co?.name      || localStorage.getItem("fsCompanyName") || "FireSafe Pro";
  const coAddr  = [co?.address, co?.city, co?.state, co?.zip].filter(Boolean).join(", ");
  const coPhone = co?.phone   || "";
  const coEmail = co?.email   || "";
  const coWeb   = co?.website || "";
  const coRC    = co?.license_number || "";

  // ── Client ──
  const cust     = inv?.customer || {};
  const custAddr = [cust.address, cust.city, cust.state, cust.zip].filter(Boolean).join(" ");

  const statusCol = STATUS_COL[inv?.status] || "#888";

  return (
    <div style={{
      position:"fixed", inset:0, zIndex:9000,
      background:"rgba(0,0,0,0.88)",
      display:"flex", flexDirection:"column",
      fontFamily:"Arial,sans-serif",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap');
        .inv * { box-sizing:border-box; font-family:'DM Sans',Arial,sans-serif; }
        .inv-toolbar { display:flex; }
        @media print {
          .inv-toolbar { display:none !important; }
          html,body { margin:0 !important; padding:0 !important; background:#fff !important; }
          .inv-scroll { padding:0 !important; background:#fff !important; overflow:visible !important; }
          .inv-page   { box-shadow:none !important; margin:0 !important; }
          @page { margin:0; size:A4 portrait; }
        }
      `}</style>

      {/* ── TOOLBAR ── */}
      <div className="inv-toolbar" style={{
        background:"#1a1a1a", borderBottom:"1px solid #2a2a2a",
        padding:"10px 20px", alignItems:"center", gap:12, flexShrink:0,
      }}>
        <button onClick={onClose} style={{
          background:"none", border:"none", color:"#aaa",
          cursor:"pointer", fontSize:24, lineHeight:1, padding:"0 4px",
        }}>&#8592;</button>
        <span style={{ fontSize:14, fontWeight:600, color:"#fff" }}>
          Facture {inv?.invoice_number}
        </span>
        <span style={{
          padding:"2px 10px", borderRadius:20, fontSize:11, fontWeight:600,
          background:`${statusCol}25`, color:statusCol,
        }}>
          {STATUS_FR[inv?.status] || inv?.status}
        </span>
        <div style={{ flex:1 }}/>
        <button onClick={() => window.print()} style={{
          padding:"8px 20px", background:"#FF4500", color:"#fff",
          border:"none", borderRadius:6, fontSize:13, fontWeight:600,
          cursor:"pointer", display:"flex", alignItems:"center", gap:8,
        }}>
          &#128424; Imprimer / PDF
        </button>
      </div>

      {/* ── SCROLL AREA ── */}
      <div className="inv-scroll" style={{
        flex:1, overflowY:"auto",
        padding:"32px 20px", background:"#111",
        display:"flex", justifyContent:"center",
      }}>
        {loading ? (
          <div style={{ color:"#888", fontSize:14, marginTop:80 }}>Chargement...</div>
        ) : (

        /* ═══════════ A4 PAGE ═══════════ */
        <div className="inv inv-page" style={{
          width: A4W,
          minHeight: A4H,
          background: "#fff",
          color: "#1a1a1a",
          fontSize: 12,
          boxShadow: "0 8px 48px rgba(0,0,0,0.6)",
          display: "flex",
          flexDirection: "column",
          position: "relative",
        }}>

          {/* ═══ BODY (grows) ═══ */}
          <div style={{ flex:1, display:"flex", flexDirection:"column" }}>

            {/* ─── HEADER: logo left + FACTURE badge right ─── */}
            <div style={{
              display:"flex", justifyContent:"space-between", alignItems:"flex-start",
              padding:`28px ${PAD}px 20px`,
              borderBottom:"2px solid #1a1a1a",
            }}>
              {/* Logo + company details */}
              <div style={{ display:"flex", alignItems:"flex-start", gap:14 }}>
                {logo ? (
                  <img src={logo} alt={coName}
                    style={{ height:70, maxWidth:150, objectFit:"contain" }} />
                ) : (
                  <div style={{
                    width:70, height:70, borderRadius:10,
                    background:"linear-gradient(135deg,#FF4500,#FF8C00)",
                    display:"flex", alignItems:"center", justifyContent:"center",
                    fontSize:28, fontWeight:800, color:"#fff", flexShrink:0,
                  }}>{coName[0]||"F"}</div>
                )}
                <div style={{ paddingTop:4 }}>
                  <div style={{ fontSize:16, fontWeight:800 }}>{coName}</div>
                  {coAddr  && <div style={{ fontSize:10, color:"#666", marginTop:3, lineHeight:1.7 }}>{coAddr}</div>}
                  {coPhone && <div style={{ fontSize:10, color:"#666" }}>Tél : {coPhone}</div>}
                  {coEmail && <div style={{ fontSize:10, color:"#666" }}>E-mail : {coEmail}</div>}
                  {coWeb   && <div style={{ fontSize:10, color:"#666" }}>{coWeb}</div>}
                  {coRC    && <div style={{ fontSize:9,  color:"#999", marginTop:2 }}>Licence : {coRC}</div>}
                </div>
              </div>
              {/* FACTURE badge */}
              <div style={{
                background:"#1a1a1a", color:"#fff",
                fontWeight:700, fontSize:13, letterSpacing:"0.14em",
                padding:"7px 22px", borderRadius:3,
              }}>FACTURE</div>
            </div>

            {/* ─── INFO BOXES: Client | Facture ─── */}
            <div style={{
              display:"grid", gridTemplateColumns:"1fr 1fr", gap:20,
              padding:`20px ${PAD}px`,
            }}>
              {/* Client */}
              <div style={{ border:"1px solid #ddd", borderRadius:4, padding:"14px 16px" }}>
                <div style={{
                  fontSize:10, color:"#888", fontWeight:700,
                  textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:8,
                }}>Client</div>
                <div style={{ fontSize:14, fontWeight:800, marginBottom:4 }}>{cust.name || "—"}</div>
                {cust.contact_name && <div style={{ fontSize:11, color:"#555" }}>{cust.contact_name}</div>}
                {custAddr && <div style={{ fontSize:11, color:"#555", marginTop:3, lineHeight:1.6 }}>{custAddr}</div>}
                {cust.email && <div style={{ fontSize:11, color:"#555" }}>{cust.email}</div>}
                {cust.phone && <div style={{ fontSize:11, color:"#555" }}>{cust.phone}</div>}
              </div>

              {/* Facture details */}
              <div style={{ border:"1px solid #ddd", borderRadius:4, padding:"14px 16px" }}>
                <div style={{
                  fontSize:10, color:"#888", fontWeight:700,
                  textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:8,
                }}>Facture</div>
                <div style={{ fontSize:17, fontWeight:800, marginBottom:8 }}>
                  {inv?.invoice_number || "—"}
                </div>
                <div style={{ fontSize:11, color:"#555", lineHeight:1.9 }}>
                  <div>Date : {fmtDate(inv?.issue_date)}</div>
                  {inv?.due_date && <div>Échéance : {fmtDate(inv?.due_date)}</div>}
                  {cust.id && <div>Code client : {"CU" + cust.id.replace(/-/g,"").slice(0,12).toUpperCase()}</div>}
                </div>
              </div>
            </div>

            {/* ─── LINE ITEMS ─── */}
            <div style={{ padding:`0 ${PAD}px` }}>
              {/* Table header */}
              <div style={{
                display:"grid",
                gridTemplateColumns:"1fr 80px 100px 120px",
                background:"#1a1a1a",
                padding:"10px 14px",
                borderRadius:"4px 4px 0 0",
              }}>
                {[["Libellé","left"],["Qté","center"],["P.U","right"],["Total HT","right"]].map(([h,a],i) => (
                  <div key={i} style={{
                    fontSize:10, fontWeight:700, color:"#fff",
                    textTransform:"uppercase", letterSpacing:"0.08em", textAlign:a,
                  }}>{h}</div>
                ))}
              </div>

              {/* Rows */}
              {items.length === 0 ? (
                <div style={{
                  padding:"18px 14px", textAlign:"center", color:"#aaa",
                  border:"1px solid #e0e0e0", borderTop:"none", fontSize:12,
                }}>Aucun article</div>
              ) : items.map((item, i) => (
                <div key={i} style={{
                  display:"grid",
                  gridTemplateColumns:"1fr 80px 100px 120px",
                  padding:"10px 14px",
                  background: i % 2 === 1 ? "#fafafa" : "#fff",
                  borderLeft:"1px solid #e0e0e0",
                  borderRight:"1px solid #e0e0e0",
                  borderBottom:"1px solid #eee",
                }}>
                  <div style={{ fontSize:12, lineHeight:1.4 }}>{item.description || item.name || "—"}</div>
                  <div style={{ fontSize:12, textAlign:"center", color:"#444" }}>
                    {Number(item.quantity || 1).toLocaleString("fr-FR")}
                  </div>
                  <div style={{ fontSize:12, textAlign:"right", color:"#444" }}>
                    {Number(item.unit_price || 0).toLocaleString("fr-FR",{minimumFractionDigits:2})}
                  </div>
                  <div style={{ fontSize:12, textAlign:"right", fontWeight:600 }}>
                    {Number((item.quantity||1)*(item.unit_price||0)).toLocaleString("fr-FR",{minimumFractionDigits:2})}
                  </div>
                </div>
              ))}
              <div style={{
                height:4, background:"#fff",
                border:"1px solid #e0e0e0", borderTop:"none",
                borderRadius:"0 0 4px 4px",
              }}/>
            </div>

          </div>{/* end flex:1 body */}

          {/* ═══ PINNED BOTTOM SECTION ═══ */}
          <div style={{ padding:`16px ${PAD}px 0`, marginTop:"auto" }}>

            {/* ─── 3 BOXES: Paiement | Totaux | (balance) ─── */}
            <div style={{
              display:"grid", gridTemplateColumns:"1fr 1fr", gap:20,
              marginBottom:16,
            }}>
              {/* Paiement */}
              <div style={{ border:"1px solid #ddd", borderRadius:4, padding:"14px 16px" }}>
                <div style={{
                  fontSize:10, fontWeight:700, color:"#555",
                  textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:6,
                }}>Paiement</div>
                <div style={{ fontSize:10, color:"#888", marginBottom:4 }}>Conditions de règlement</div>
                <div style={{ fontSize:11, color:"#444", lineHeight:1.7 }}>
                  {inv?.terms || "Règlement à 30 jours fin de mois"}
                </div>
                {inv?.notes && (
                  <div style={{
                    marginTop:8, paddingTop:8,
                    borderTop:"1px solid #eee",
                    fontSize:11, color:"#666", lineHeight:1.6,
                  }}>{inv.notes}</div>
                )}
              </div>

              {/* Totaux */}
              <div style={{ border:"1px solid #ddd", borderRadius:4, padding:"14px 16px" }}>
                <div style={{
                  fontSize:10, fontWeight:700, color:"#555",
                  textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:8,
                }}>Totaux</div>
                <table style={{ width:"100%", borderCollapse:"collapse" }}>
                  <tbody>
                    <tr>
                      <td style={{ fontSize:12, color:"#666", padding:"4px 0" }}>Total HT</td>
                      <td style={{ fontSize:12, textAlign:"right", padding:"4px 0" }}>{fmt(subtotal)}</td>
                    </tr>
                    <tr>
                      <td style={{ fontSize:12, color:"#666", padding:"4px 0" }}>TVA ({taxPct}%)</td>
                      <td style={{ fontSize:12, textAlign:"right", padding:"4px 0" }}>{fmt(taxAmt)}</td>
                    </tr>
                    {discount > 0 && (
                      <tr>
                        <td style={{ fontSize:12, color:"#22C55E", padding:"4px 0" }}>Remise</td>
                        <td style={{ fontSize:12, textAlign:"right", color:"#22C55E", padding:"4px 0" }}>-{fmt(discount)}</td>
                      </tr>
                    )}
                    {paid > 0 && (
                      <tr>
                        <td style={{ fontSize:12, color:"#22C55E", padding:"4px 0" }}>Déjà réglé</td>
                        <td style={{ fontSize:12, textAlign:"right", color:"#22C55E", padding:"4px 0" }}>-{fmt(paid)}</td>
                      </tr>
                    )}
                    <tr><td colSpan={2}><div style={{ borderTop:"2px solid #1a1a1a", margin:"6px 0" }}/></td></tr>
                    <tr>
                      <td style={{ fontSize:14, fontWeight:800, padding:"3px 0" }}>Total TTC</td>
                      <td style={{ fontSize:14, fontWeight:800, textAlign:"right", padding:"3px 0" }}>{fmt(total)}</td>
                    </tr>
                    {paid > 0 && balance > 0 && (
                      <tr>
                        <td style={{ fontSize:12, fontWeight:700, color:"#EF4444", padding:"3px 0" }}>Solde dû</td>
                        <td style={{ fontSize:12, fontWeight:700, color:"#EF4444", textAlign:"right", padding:"3px 0" }}>{fmt(balance)}</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* ─── AMOUNT IN WORDS ─── */}
            <div style={{
              border:"1px solid #ddd", borderRadius:4,
              padding:"12px 16px", background:"#fafafa",
              marginBottom:16,
            }}>
              <div style={{ fontSize:10, color:"#888", marginBottom:4 }}>
                Arrêtée la présente facture à la somme de :
              </div>
              <div style={{ fontSize:12, fontWeight:700, lineHeight:1.5 }}>
                {toWords(total)} {getCurrency()}
              </div>
            </div>

            {/* ─── FOOTER ─── */}
            <div style={{
              borderTop:"1px solid #ddd",
              padding:"12px 0 20px",
              display:"flex", flexDirection:"column", alignItems:"center", gap:3,
            }}>
              {coAddr && (
                <div style={{ fontSize:10, color:"#aaa", textAlign:"center" }}>
                  {[coAddr, coPhone && `Tél : ${coPhone}`, coEmail && `E-mail : ${coEmail}`].filter(Boolean).join("  -  ")}
                </div>
              )}
              {coRC && <div style={{ fontSize:10, color:"#aaa" }}>Licence : {coRC}</div>}
              {coWeb && <div style={{ fontSize:10, color:"#aaa" }}>{coWeb}</div>}
              <div style={{ fontSize:9, color:"#ccc", marginTop:4 }}>
                Généré le {new Date().toLocaleDateString("fr-FR",{day:"numeric",month:"long",year:"numeric"})}
                &nbsp;·&nbsp;1/1
              </div>
            </div>

          </div>{/* end pinned bottom */}

        </div>
        /* ═══════════ END A4 ═══════════ */

        )}
      </div>
    </div>
  );
}