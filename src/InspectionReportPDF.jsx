// ============================================================
// FireSafe Pro — NFPA Inspection Report PDF
// InspectionReportPDF.jsx
// ============================================================
// Generates a professional NFPA-compliant inspection report.
// Rendered as a React component → window.print() for PDF export.
// Usage: <InspectionReportPDF inspectionId={id} supabase={sbConfig} onClose={fn}/>
// ============================================================
import React, { useState, useEffect, useRef } from "react";

// ─── API ──────────────────────────────────────────────────────────────────────
const get = async (url, anonKey, jwt, path) => {
  const r = await fetch(`${url}/rest/v1/${path}`, {
    headers: { apikey: anonKey, Authorization: `Bearer ${jwt}` },
  });
  const t = await r.text();
  if (!r.ok) throw new Error(t);
  return t ? JSON.parse(t) : [];
};

// ─── HELPERS ─────────────────────────────────────────────────────────────────
const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" }) : "—";

const fmtDateTime = (d) =>
  d ? new Date(d).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";

const TRADE_LABELS = {
  fire_alarm:     "Alarme incendie",
  sprinkler:      "Sprinkleur",
  extinguisher:   "Extincteurs",
  special_hazard: "Risques spéciaux",
  fire_door:      "Portes coupe-feu",
  backflow:       "Anti-retour",
  facilities:     "Installations générales",
};

const NFPA_STANDARDS = {
  fire_alarm:     "NFPA 72 — National Fire Alarm and Signaling Code",
  sprinkler:      "NFPA 25 — Standard for Inspection of Water-Based Fire Protection Systems",
  extinguisher:   "NFPA 10 — Standard for Portable Fire Extinguishers",
  special_hazard: "NFPA 11 / NFPA 12 — Special Hazard Suppression Systems",
  fire_door:      "NFPA 80 — Standard for Fire Doors and Other Opening Protectives",
  backflow:       "NFPA 25 — Water Supply Systems",
  facilities:     "NFPA 1 — Fire Code",
};

const STATUS_LABELS = {
  scheduled:   "Planifiée",
  in_progress: "En cours",
  completed:   "Complète",
  deficient:   "Déficiente",
  cancelled:   "Annulée",
};

const SEV_LABELS  = { critical:"Critique", high:"Élevée", medium:"Moyenne", low:"Faible" };
const ANS_LABELS  = { pass:"Conforme", fail:"Non conforme", na:"N/A", obs:"Observation" };

// ─── PRINT STYLES ─────────────────────────────────────────────────────────────
const PrintStyles = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');

    * { box-sizing: border-box; margin: 0; padding: 0; }

    body { font-family: 'Inter', 'Helvetica Neue', Arial, sans-serif; background: #fff; color: #1a1a1a; }

    @media screen {
      .pdf-backdrop {
        position: fixed; inset: 0; background: rgba(0,0,0,0.85);
        z-index: 9999; display: flex; align-items: flex-start;
        justify-content: center; overflow-y: auto; padding: 24px 16px;
      }
      .pdf-shell {
        background: #fff; width: 210mm; min-height: 297mm;
        box-shadow: 0 8px 40px rgba(0,0,0,0.5);
        border-radius: 4px; position: relative;
      }
      .no-print { display: flex; }
    }

    @media print {
      html, body { width: 210mm; height: 297mm; margin: 0; padding: 0; background: #fff; }
      .pdf-backdrop { position: static; background: none; padding: 0; overflow: visible; }
      .pdf-shell    { box-shadow: none; border-radius: 0; width: 100%; }
      .no-print     { display: none !important; }
      .page-break   { page-break-before: always; }
      @page { size: A4; margin: 0; }
    }

    .pdf-page {
      width: 210mm; min-height: 297mm;
      padding: 14mm 16mm 14mm 16mm;
      position: relative;
    }

    /* ── HEADER ── */
    .rpt-header {
      display: flex; justify-content: space-between; align-items: flex-start;
      padding-bottom: 10px; border-bottom: 3px solid #CC2200; margin-bottom: 14px;
    }
    .rpt-company-name { font-size: 18px; font-weight: 800; color: #1a1a1a; letter-spacing: -0.02em; }
    .rpt-company-sub  { font-size: 10px; color: #666; margin-top: 2px; }
    .rpt-doc-badge {
      text-align: right;
    }
    .rpt-doc-type {
      font-size: 13px; font-weight: 700; color: #CC2200; text-transform: uppercase;
      letter-spacing: 0.08em;
    }
    .rpt-doc-num  { font-size: 11px; color: #444; margin-top: 3px; font-family: monospace; }
    .rpt-doc-date { font-size: 10px; color: #888; margin-top: 2px; }

    /* ── SECTION TITLES ── */
    .section-title {
      font-size: 10px; font-weight: 700; color: #CC2200;
      text-transform: uppercase; letter-spacing: 0.1em;
      padding: 4px 0; border-bottom: 1px solid #EEE;
      margin-bottom: 8px; margin-top: 14px;
    }

    /* ── INFO GRID ── */
    .info-grid {
      display: grid; grid-template-columns: 1fr 1fr; gap: 0;
      border: 1px solid #DDD; border-radius: 4px; overflow: hidden;
    }
    .info-grid-3 { grid-template-columns: 1fr 1fr 1fr; }
    .info-cell {
      padding: 7px 10px; border-right: 1px solid #EEE; border-bottom: 1px solid #EEE;
    }
    .info-cell:last-child { border-right: none; }
    .info-label { font-size: 9px; color: #888; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 2px; font-weight: 600; }
    .info-value { font-size: 11px; color: #1a1a1a; font-weight: 500; }

    /* ── SCORE BOX ── */
    .score-box {
      display: flex; align-items: center; gap: 14px;
      background: #F9F9F9; border: 1px solid #DDD;
      border-radius: 6px; padding: 12px 16px; margin-bottom: 12px;
    }
    .score-circle {
      width: 64px; height: 64px; border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0; flex-direction: column;
    }
    .score-num   { font-size: 22px; font-weight: 800; line-height: 1; }
    .score-pct   { font-size: 10px; font-weight: 600; }
    .score-label { font-size: 11px; font-weight: 600; margin-bottom: 4px; }
    .score-bar-bg { height: 7px; background: #E5E5E5; border-radius: 4px; width: 200px; margin-bottom: 4px; }
    .score-bar    { height: 100%; border-radius: 4px; }
    .score-meta   { font-size: 10px; color: #666; line-height: 1.6; }

    /* ── STATUS BADGE ── */
    .badge {
      display: inline-block; padding: 2px 8px; border-radius: 20px;
      font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em;
    }
    .badge-pass     { background: #DCFCE7; color: #166534; }
    .badge-fail     { background: #FEE2E2; color: #991B1B; }
    .badge-na       { background: #F3F4F6; color: #4B5563; }
    .badge-obs      { background: #FEF9C3; color: #854D0E; }
    .badge-complete { background: #DCFCE7; color: #166534; }
    .badge-deficient{ background: #FEE2E2; color: #991B1B; }
    .badge-critical { background: #FEE2E2; color: #991B1B; }
    .badge-high     { background: #FEF3C7; color: #92400E; }
    .badge-medium   { background: #DBEAFE; color: #1E40AF; }
    .badge-low      { background: #DCFCE7; color: #166534; }

    /* ── CHECKLIST TABLE ── */
    .check-table { width: 100%; border-collapse: collapse; font-size: 10px; margin-bottom: 8px; }
    .check-table th {
      background: #F3F4F6; padding: 6px 8px;
      text-align: left; font-size: 9px; font-weight: 700;
      text-transform: uppercase; letter-spacing: 0.06em; color: #555;
      border: 1px solid #DDD;
    }
    .check-table td { padding: 5px 8px; border: 1px solid #EEE; vertical-align: top; color: #111; }
    .check-table tr:nth-child(even) td { background: #FAFAFA; }
    .check-table tr.fail-row td { background: #FFF5F5; }

    /* ── DEFICIENCIES ── */
    .defi-card {
      border: 1px solid #EEE; border-radius: 4px;
      margin-bottom: 8px; overflow: hidden;
    }
    .defi-header {
      display: flex; align-items: center; gap: 10px;
      padding: 7px 10px; background: #F9F9F9;
      border-bottom: 1px solid #EEE;
    }
    .defi-num  { font-size: 10px; font-weight: 700; color: #888; }
    .defi-title{ font-size: 11px; font-weight: 600; color: #1a1a1a; flex: 1; }
    .defi-body { padding: 8px 10px; display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; }
    .defi-field-label { font-size: 9px; color: #888; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 2px; }
    .defi-field-value { font-size: 10px; color: #1a1a1a; }
    .defi-notes { padding: 0 10px 8px; font-size: 10px; color: #444; line-height: 1.5; border-top: 1px dashed #EEE; padding-top: 6px; }

    /* ── SIGNATURE BLOCK ── */
    .sig-grid {
      display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top: 16px;
    }
    .sig-box {
      border-top: 1px solid #1a1a1a; padding-top: 6px;
    }
    .sig-label { font-size: 9px; color: #666; text-transform: uppercase; letter-spacing: 0.06em; }

    /* ── FOOTER ── */
    .rpt-footer {
      position: absolute; bottom: 10mm; left: 16mm; right: 16mm;
      border-top: 1px solid #EEE; padding-top: 6px;
      display: flex; justify-content: space-between; align-items: center;
    }
    .rpt-footer-text { font-size: 8px; color: #AAA; }

    /* ── NFPA DISCLAIMER ── */
    .nfpa-box {
      background: #FFF8F0; border: 1px solid #FED7AA;
      border-radius: 4px; padding: 8px 12px; margin-top: 12px;
      font-size: 9px; color: #7C3A00; line-height: 1.6;
    }
  `}</style>
);

// ─── SCORE UTILITIES ─────────────────────────────────────────────────────────
function getScoreColor(score) {
  if (score == null) return "#999";
  if (score >= 90)  return "#16A34A";
  if (score >= 75)  return "#CA8A04";
  if (score >= 60)  return "#EA580C";
  return "#DC2626";
}
function getScoreLabel(score) {
  if (score == null) return "—";
  if (score >= 90)  return "Excellent";
  if (score >= 75)  return "Satisfaisant";
  if (score >= 60)  return "À améliorer";
  return "Non conforme";
}

// ─── ANSWER BADGE ────────────────────────────────────────────────────────────
const normalizeAns = (val) => {
  if (!val) return null;
  const v = String(val).toLowerCase().trim();
  if (v === "pass" || v === "oui" || v === "yes" || v === "conforme") return "pass";
  if (v === "fail" || v === "échec" || v === "non" || v === "no" || v === "non conforme") return "fail";
  if (v === "na" || v === "n/a" || v === "s/o") return "na";
  return v;
};

const AnsTag = ({ val }) => {
  const norm = normalizeAns(val);
  const map = { pass:"badge-pass", fail:"badge-fail", na:"badge-na", obs:"badge-obs" };
  const labels = { pass:"✓ Conforme", fail:"✗ Non conforme", na:"N/A", obs:"Observation" };
  if (!norm) return <span style={{color:"#9CA3AF"}}>—</span>;
  return <span className={`badge ${map[norm]||"badge-na"}`}>{labels[norm]||val}</span>;
};

// ─── MAIN COMPONENT ──────────────────────────────────────────────────────────
export default function InspectionReportPDF({ inspectionId, supabase, onClose }) {
  const { url, anonKey, jwt } = supabase;
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState("");
  const printRef = useRef();

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        // ── Load inspection + joins ──
        const [insp] = await get(url, anonKey, jwt,
          `inspections?id=eq.${inspectionId}&select=*,building:buildings(name,address,city),customer:customers(name),template:inspection_templates(name,nfpa_reference)`
        );
        if (!insp) throw new Error("Inspection introuvable");

        // ── Load company ──
        const [company] = await get(url, anonKey, jwt,
          `companies?id=eq.${insp.company_id}&select=name,logo_url,address,city,phone,email,license_number`
        );

        // ── Load checklist sections + questions + answers ──
        let sections = [], questions = [], answers = [];
        answers = await get(url, anonKey, jwt,
          `inspection_answers?inspection_id=eq.${inspectionId}&select=id,question_id,answer_value,answer_notes,passed`
        );
        if (insp.template_id) {
          sections = await get(url, anonKey, jwt,
            `template_sections?template_id=eq.${insp.template_id}&select=id,title,order_index&order=order_index`
          );
          if (sections.length > 0) {
            const sectionIds = sections.map(s => s.id).join(",");
            questions = await get(url, anonKey, jwt,
              `template_questions?section_id=in.(${sectionIds})&select=id,section_id,question_text,answer_type,is_required,nfpa_reference,order_index&order=order_index`
            );
          }
        }

        // ── Load technician separately ──
        let technician = null;
        if (insp.technician_id) {
          const techs = await get(url, anonKey, jwt,
            `profiles?id=eq.${insp.technician_id}&select=full_name,email,phone`
          );
          technician = techs?.[0] || null;
        }
        insp.technician = technician;

        // ── Load deficiencies linked to this inspection ──
        const deficiencies = await get(url, anonKey, jwt,
          `deficiencies?inspection_id=eq.${inspectionId}&select=id,title,description,severity,status,nfpa_reference,created_at&order=severity`
        );

        // Build answer map
        const ansMap = {};
        answers.forEach(a => { ansMap[a.question_id] = a; });

        // Build sections map
        const secMap = {};
        sections.forEach(s => { secMap[s.id] = s; });

        // Group questions by section
        const grouped = {};
        questions.forEach(q => {
          const sid = q.section_id || "default";
          if (!grouped[sid]) grouped[sid] = [];
          grouped[sid].push({ ...q, answer: ansMap[q.id] || null });
        });

        // Stats
        const answered  = answers.filter(a => a.answer_value && normalizeAns(a.answer_value) !== "na");
        const passed    = answers.filter(a => a.passed === true  || normalizeAns(a.answer_value) === "pass");
        const failed    = answers.filter(a => a.passed === false || normalizeAns(a.answer_value) === "fail");
        const total     = questions.length || 1;

        setData({
          insp, company,
          sections, questions, grouped, secMap,
          deficiencies, ansMap,
          stats: {
            total:    questions.length,
            answered: answered.length,
            passed:   passed.length,
            failed:   failed.length,
            na:       answers.filter(a => a.answer_value === "na").length,
          }
        });
      } catch(e) {
        console.error("InspectionReportPDF error:", e);
        setError(e.message || "Erreur inconnue lors du chargement");
      }
      finally { setLoading(false); }
    })();
  }, [inspectionId]);

  const handlePrint = () => window.print();

  // ── LOADING / ERROR ──
  if (loading || error || !data) return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.85)",zIndex:9999,
      display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:14}}>
      {loading && <>
        <div style={{width:40,height:40,border:"3px solid #CC220040",borderTop:"3px solid #CC2200",
          borderRadius:"50%",animation:"spin 0.8s linear infinite"}}/>
        <div style={{color:"#ccc",fontSize:13}}>Chargement du rapport…</div>
      </>}
      {error && <>
        <div style={{color:"#EF4444",fontSize:14}}>⚠ {error}</div>
        <button onClick={onClose} style={{padding:"8px 18px",borderRadius:6,background:"#3A3A3A",border:"none",color:"#fff",cursor:"pointer",fontSize:13}}>Fermer</button>
      </>}
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  const { insp, company, sections, grouped, secMap, deficiencies, ansMap, stats } = data;
  const score = insp.score;
  const scoreColor = getScoreColor(score);
  const reportNum = `RPT-${String(inspectionId).slice(0,8).toUpperCase()}`;
  const companyName = company?.name || "FireSafe Pro";
  const tradeLabel  = TRADE_LABELS[insp.trade] || insp.trade || "—";
  const nfpaStd     = NFPA_STANDARDS[insp.trade] || "NFPA";

  return (
    <div className="pdf-backdrop">
      <PrintStyles/>

      {/* ── TOOLBAR (screen only) ── */}
      <div className="no-print" style={{
        position:"fixed", top:0, left:0, right:0, zIndex:10001,
        background:"#1A1A1A", borderBottom:"1px solid #3A3A3A",
        padding:"10px 20px", display:"flex", alignItems:"center", gap:12,
      }}>
        <div style={{width:28,height:28,background:"#CC2200",borderRadius:6,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14}}>🔥</div>
        <span style={{color:"#FAFAFA",fontWeight:700,fontSize:14}}>Rapport d'inspection NFPA</span>
        <span style={{color:"#8A8A8A",fontSize:12}}>{reportNum}</span>
        <div style={{marginLeft:"auto",display:"flex",gap:10}}>
          <button onClick={onClose}
            style={{padding:"7px 16px",background:"transparent",border:"1px solid #3A3A3A",borderRadius:7,color:"#8A8A8A",cursor:"pointer",fontSize:13}}>
            ✕ Fermer
          </button>
          <button onClick={handlePrint}
            style={{padding:"7px 18px",background:"#CC2200",border:"none",borderRadius:7,color:"#fff",cursor:"pointer",fontSize:13,fontWeight:600}}>
            🖨 Imprimer / Exporter PDF
          </button>
        </div>
      </div>

      {/* ── PDF SHELL ── */}
      <div className="pdf-shell" style={{marginTop:56}} ref={printRef}>

        {/* ═══════════════════════════════════════════════════════
            PAGE 1 — COVER + SUMMARY
        ═══════════════════════════════════════════════════════ */}
        <div className="pdf-page">

          {/* Header */}
          <div className="rpt-header">
            <div>
              {company?.logo_url && (
                <img src={company.logo_url} alt="logo" style={{height:36,marginBottom:4,objectFit:"contain"}}/>
              )}
              <div className="rpt-company-name">{companyName}</div>
              <div className="rpt-company-sub">
                {[company?.address, company?.city].filter(Boolean).join(" · ")}
                {company?.phone && ` · ${company.phone}`}
                {company?.license_number && ` · Lic. ${company.license_number}`}
              </div>
            </div>
            <div className="rpt-doc-badge">
              <div className="rpt-doc-type">Rapport d'Inspection</div>
              <div className="rpt-doc-num">{reportNum}</div>
              <div className="rpt-doc-date">Généré le {fmtDate(new Date().toISOString())}</div>
            </div>
          </div>

          {/* NFPA standard banner */}
          <div style={{background:"#FFF0ED",border:"1px solid #FCA89A",borderRadius:4,padding:"6px 12px",
            display:"flex",alignItems:"center",gap:10,marginBottom:12}}>
            <span style={{fontSize:16}}>🔥</span>
            <div>
              <div style={{fontSize:10,fontWeight:700,color:"#CC2200",textTransform:"uppercase",letterSpacing:"0.06em"}}>{tradeLabel}</div>
              <div style={{fontSize:10,color:"#7C3A00"}}>{nfpaStd}</div>
            </div>
            <div style={{marginLeft:"auto",textAlign:"right"}}>
              <span className={`badge badge-${insp.status==="completed"?"complete":insp.status==="deficient"?"deficient":"na"}`}>
                {STATUS_LABELS[insp.status]||insp.status}
              </span>
            </div>
          </div>

          {/* Score summary */}
          {score != null && (
            <div className="score-box">
              <div className="score-circle" style={{background:`${scoreColor}15`,border:`3px solid ${scoreColor}`}}>
                <span className="score-num" style={{color:scoreColor}}>{score}</span>
                <span className="score-pct" style={{color:scoreColor}}>%</span>
              </div>
              <div style={{flex:1}}>
                <div className="score-label" style={{color:scoreColor}}>{getScoreLabel(score)}</div>
                <div className="score-bar-bg">
                  <div className="score-bar" style={{width:`${score}%`,background:scoreColor}}/>
                </div>
                <div className="score-meta">
                  ✓ {stats.passed} conformes &nbsp;·&nbsp;
                  ✗ {stats.failed} non conformes &nbsp;·&nbsp;
                  — {stats.na} N/A &nbsp;·&nbsp;
                  {stats.total} questions au total
                </div>
              </div>
            </div>
          )}

          {/* Section 1 — Inspection info */}
          <div className="section-title">1. Informations générales</div>
          <div className="info-grid info-grid-3">
            {[
              ["Bâtiment",          insp.building?.name || "—"],
              ["Client",            insp.customer?.name || "—"],
              ["Type d'inspection", tradeLabel],
              ["Date planifiée",    fmtDate(insp.scheduled_date)],
              ["Début",             fmtDateTime(insp.started_at)],
              ["Fin",               fmtDateTime(insp.completed_at)],
            ].map(([l,v]) => (
              <div key={l} className="info-cell">
                <div className="info-label">{l}</div>
                <div className="info-value">{v}</div>
              </div>
            ))}
          </div>

          {/* Section 2 — Building info */}
          <div className="section-title">2. Bâtiment inspecté</div>
          <div className="info-grid">
            {[
              ["Adresse", [insp.building?.address, insp.building?.city].filter(Boolean).join(", ") || "—"],
              ["Client",  insp.customer?.name || "—"],
            ].map(([l,v]) => (
              <div key={l} className="info-cell">
                <div className="info-label">{l}</div>
                <div className="info-value">{v}</div>
              </div>
            ))}
          </div>

          {/* Section 3 — Inspector */}
          <div className="section-title">3. Inspecteur</div>
          <div className="info-grid">
            {[
              ["Nom de l'inspecteur", insp.technician?.full_name || "—"],
              ["Email",               insp.technician?.email || "—"],
              ["Téléphone",           insp.technician?.phone || "—"],
              ["Référentiel",         insp.template?.name || "—"],
            ].map(([l,v]) => (
              <div key={l} className="info-cell">
                <div className="info-label">{l}</div>
                <div className="info-value">{v}</div>
              </div>
            ))}
          </div>

          {/* Deficiency summary */}
          {deficiencies.length > 0 && (
            <>
              <div className="section-title">4. Résumé des déficiences</div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8,marginBottom:8}}>
                {[
                  {label:"Critiques", key:"critical", cls:"badge-critical"},
                  {label:"Élevées",   key:"high",     cls:"badge-high"},
                  {label:"Moyennes",  key:"medium",   cls:"badge-medium"},
                  {label:"Faibles",   key:"low",      cls:"badge-low"},
                ].map(({label, key, cls}) => {
                  const count = deficiencies.filter(d=>d.severity===key).length;
                  return (
                    <div key={key} style={{border:"1px solid #EEE",borderRadius:4,padding:"8px",textAlign:"center"}}>
                      <div style={{fontSize:18,fontWeight:800,marginBottom:2}}>{count}</div>
                      <span className={`badge ${cls}`}>{label}</span>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {/* Footer page 1 */}
          <div className="rpt-footer">
            <span className="rpt-footer-text">{companyName} · {reportNum} · {nfpaStd}</span>
            <span className="rpt-footer-text">Page 1</span>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════
            PAGE 2 — CHECKLIST DETAILS
        ═══════════════════════════════════════════════════════ */}
        {sections.length > 0 && (
          <div className="pdf-page page-break">

            <div className="rpt-header">
              <div>
                <div className="rpt-company-name">{companyName}</div>
                <div className="rpt-company-sub">{reportNum} · {tradeLabel}</div>
              </div>
              <div className="rpt-doc-badge">
                <div className="rpt-doc-type">Liste de Contrôle</div>
                <div className="rpt-doc-date">{fmtDate(insp.scheduled_date)}</div>
              </div>
            </div>

            {sections.map((sec, si) => {
              const qs = grouped[sec.id] || [];
              if (qs.length === 0) return null;
              const secPassed = qs.filter(q => normalizeAns(q.answer?.answer_value) === "pass").length;
              const secFailed = qs.filter(q => normalizeAns(q.answer?.answer_value) === "fail").length;

              return (
                <div key={sec.id} style={{marginBottom:14}}>
                  <div className="section-title" style={{display:"flex",justifyContent:"space-between"}}>
                    <span>{si+1}. {sec.title}</span>
                    <span style={{color:"#555",fontWeight:400,fontSize:9,textTransform:"none",letterSpacing:0}}>
                      ✓ {secPassed} · ✗ {secFailed}
                    </span>
                  </div>

                  <table className="check-table">
                    <thead>
                      <tr>
                        <th style={{width:"4%"}}>#</th>
                        <th style={{width:"40%"}}>Point de contrôle</th>
                        <th style={{width:"12%"}}>Réf. NFPA</th>
                        <th style={{width:"12%"}}>Résultat</th>
                        <th style={{width:"32%"}}>Observations</th>
                      </tr>
                    </thead>
                    <tbody>
                      {qs.map((q, qi) => {
                        const ans = q.answer;
                        const isFail = normalizeAns(ans?.answer_value) === "fail" || ans?.passed === false;
                        return (
                          <tr key={q.id} className={isFail ? "fail-row" : ""}>
                            <td style={{color:"#888",fontSize:9}}>{qi+1}</td>
                            <td style={{fontWeight: q.is_required ? 500 : 400, color:"#111"}}>
                              {q.question_text}
                              {q.is_required && <span style={{color:"#CC2200",marginLeft:3}}>*</span>}
                            </td>
                            <td style={{fontFamily:"monospace",fontSize:9,color:"#555"}}>{q.nfpa_reference || "—"}</td>
                            <td><AnsTag val={ans?.answer_value}/></td>
                            <td style={{color:"#444",fontStyle: ans?.answer_notes ? "normal":"italic",color: ans?.answer_notes ? "#1a1a1a":"#BBB"}}>
                              {ans?.answer_notes || "—"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              );
            })}

            {/* If no sections but questions exist (flat template) */}
            {sections.length === 0 && grouped["default"] && (
              <div>
                <div className="section-title">Points de contrôle</div>
                <table className="check-table">
                  <thead>
                    <tr>
                      <th style={{width:"4%"}}>#</th>
                      <th style={{width:"44%"}}>Point de contrôle</th>
                      <th style={{width:"12%"}}>Réf. NFPA</th>
                      <th style={{width:"12%"}}>Résultat</th>
                      <th style={{width:"28%"}}>Observations</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(grouped["default"]||[]).map((q, qi) => {
                      const ans = q.answer;
                      const isFail = normalizeAns(ans?.answer_value) === "fail";
                      return (
                        <tr key={q.id} className={isFail ? "fail-row" : ""}>
                          <td style={{color:"#888",fontSize:9}}>{qi+1}</td>
                          <td>{q.question_text}{q.is_required && <span style={{color:"#CC2200",marginLeft:3}}>*</span>}</td>
                          <td style={{fontFamily:"monospace",fontSize:9,color:"#555"}}>{q.nfpa_reference || "—"}</td>
                          <td><AnsTag val={ans?.answer_value}/></td>
                          <td style={{color: ans?.answer_notes ? "#1a1a1a":"#BBB",fontStyle: ans?.answer_notes?"normal":"italic"}}>
                            {ans?.answer_notes || "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            <div className="rpt-footer">
              <span className="rpt-footer-text">{companyName} · {reportNum} · {nfpaStd}</span>
              <span className="rpt-footer-text">Page 2</span>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════
            PAGE 3 — DEFICIENCIES DETAIL + SIGNATURES
        ═══════════════════════════════════════════════════════ */}
        <div className="pdf-page page-break">

          <div className="rpt-header">
            <div>
              <div className="rpt-company-name">{companyName}</div>
              <div className="rpt-company-sub">{reportNum} · {tradeLabel}</div>
            </div>
            <div className="rpt-doc-badge">
              <div className="rpt-doc-type">Déficiences & Signatures</div>
              <div className="rpt-doc-date">{fmtDate(insp.scheduled_date)}</div>
            </div>
          </div>

          {/* Deficiencies list */}
          <div className="section-title">Déficiences détaillées ({deficiencies.length})</div>

          {deficiencies.length === 0 ? (
            <div style={{padding:"16px",textAlign:"center",background:"#F0FFF4",border:"1px solid #BBF7D0",borderRadius:4,color:"#166534",fontSize:11,marginBottom:12}}>
              ✓ Aucune déficience relevée lors de cette inspection — tous les points sont conformes.
            </div>
          ) : (
            deficiencies.map((d, di) => (
              <div key={d.id} className="defi-card">
                <div className="defi-header">
                  <span className="defi-num">DEF-{di+1}</span>
                  <span className="defi-title">{d.title}</span>
                  <span className={`badge badge-${d.severity}`}>{SEV_LABELS[d.severity]||d.severity}</span>
                </div>
                <div className="defi-body">
                  <div>
                    <div className="defi-field-label">Sévérité</div>
                    <div className="defi-field-value"><span className={`badge badge-${d.severity}`}>{SEV_LABELS[d.severity]||d.severity}</span></div>
                  </div>
                  <div>
                    <div className="defi-field-label">Référence NFPA</div>
                    <div className="defi-field-value" style={{fontFamily:"monospace",fontSize:10}}>{d.nfpa_reference || "—"}</div>
                  </div>
                  <div>
                    <div className="defi-field-label">Date relevée</div>
                    <div className="defi-field-value">{fmtDate(d.created_at)}</div>
                  </div>
                </div>
                {d.description && (
                  <div className="defi-notes"><strong>Description :</strong> {d.description}</div>
                )}
              </div>
            ))
          )}

          {/* Corrective actions table */}
          {deficiencies.length > 0 && (
            <>
              <div className="section-title" style={{marginTop:16}}>Plan d'actions correctives</div>
              <table className="check-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Déficience</th>
                    <th>Sévérité</th>
                    <th>Action requise</th>
                    <th>Délai recommandé</th>
                    <th>Responsable</th>
                  </tr>
                </thead>
                <tbody>
                  {deficiencies.map((d, di) => {
                    const delay = d.severity === "critical" ? "Immédiat (24h)"
                                : d.severity === "high"     ? "Sous 7 jours"
                                : d.severity === "medium"   ? "Sous 30 jours"
                                : "Sous 90 jours";
                    return (
                      <tr key={d.id} className={d.severity==="critical"?"fail-row":""}>
                        <td style={{color:"#888",fontSize:9}}>{di+1}</td>
                        <td style={{fontWeight:500}}>{d.title}</td>
                        <td><span className={`badge badge-${d.severity}`}>{SEV_LABELS[d.severity]}</span></td>
                        <td style={{color:"#444",fontStyle:"italic",fontSize:9}}>À définir par le responsable</td>
                        <td style={{fontWeight:600,color:d.severity==="critical"?"#DC2626":d.severity==="high"?"#EA580C":"#1a1a1a",fontSize:10}}>{delay}</td>
                        <td style={{color:"#888",fontSize:9}}>—</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </>
          )}

          {/* NFPA disclaimer */}
          <div className="nfpa-box">
            <strong>Avis de conformité NFPA :</strong> Ce rapport a été réalisé conformément aux exigences du {nfpaStd}.
            Les résultats reflètent l'état du système au moment de l'inspection et ne constituent pas une garantie permanente de conformité.
            Toute déficience identifiée doit être corrigée dans les délais prescrits par la réglementation applicable.
            Ce rapport doit être conservé pendant une durée minimale de 3 ans.
          </div>

          {/* Signature block */}
          <div className="section-title" style={{marginTop:18}}>Signatures</div>
          <div className="sig-grid">
            <div>
              <div style={{height:36,borderBottom:"1px solid #1a1a1a",marginBottom:6}}/>
              <div className="sig-label">Inspecteur : {insp.technician?.full_name || "—"}</div>
              <div className="sig-label" style={{marginTop:2}}>Date : {fmtDate(insp.completed_at || insp.scheduled_date)}</div>
            </div>
            <div>
              <div style={{height:36,borderBottom:"1px solid #1a1a1a",marginBottom:6}}/>
              <div className="sig-label">Représentant du client : {insp.customer?.name || "—"}</div>
              <div className="sig-label" style={{marginTop:2}}>Date : ______________________</div>
            </div>
          </div>

          {/* Final footer */}
          <div className="rpt-footer">
            <span className="rpt-footer-text">{companyName} · {reportNum} · {nfpaStd} · Confidentiel</span>
            <span className="rpt-footer-text">Page 3 / 3</span>
          </div>
        </div>

      </div>{/* /pdf-shell */}
    </div>
  );
}