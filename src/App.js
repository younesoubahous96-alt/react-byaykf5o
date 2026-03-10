// ============================================================
// FireSafe Pro — Full App with Real Supabase Auth + Live Data
// ============================================================
// SETUP: Before running, replace the two constants below with
// your actual values from Supabase → Settings → API
// ============================================================

const SUPABASE_URL = "https://mqgbedrmcxrqesuunkax.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_7-YkIw9NzkNjSB3jxyeBrw_x9r_66w1";
const SUPABASE_JWT = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1xZ2JlZHJtY3hycWVzdXVua2F4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIzODIxNDIsImV4cCI6MjA4Nzk1ODE0Mn0.t9LAe8W27d5iPkLW7-3QR0fO_C_FgGhQBSGNOIKYvP8";

import React, { useState, useEffect, useCallback, useRef, useContext } from "react";
import { LangProvider, useT } from "./translations";
import InspectionForms from "./InspectionForm";
import Customers from "./Customers";
import Proposals from "./Proposals";
import Scheduling from "./Scheduling";
import Settings from "./Settings";
import { ThemeProvider } from "./ThemeEditor";
import Deficiencies from "./Deficiencies";
import WorkOrders from "./WorkOrders";
import Payments from "./Payments";
import InvoicePDF from "./InvoicePDF";
import InspectionReportPDF from "./InspectionReportPDF";

// ─── SUPABASE REST CLIENT (no SDK — pure fetch) ───────────────────────────────
// Uses Supabase's PostgREST + Auth REST APIs directly.
// This avoids any CDN/sandbox loading issues.

let _accessToken = null; // stored after login

const sbHeaders = (extra = {}) => ({
  "Content-Type": "application/json",
  "apikey": SUPABASE_ANON_KEY,
  "Authorization": `Bearer ${_accessToken || SUPABASE_JWT}`,
  ...extra,
});

// ── Auth ──────────────────────────────────────────────────────────────────────
const sbAuth = {
  async signIn(email, password) {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": SUPABASE_ANON_KEY,
        "Authorization": `Bearer ${SUPABASE_JWT}`,
      },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error_description || data.msg || data.message || "Sign in failed");
    _accessToken = data.access_token;
    try { localStorage.setItem("fs_session", JSON.stringify({ access_token: data.access_token, user: data.user })); } catch(e) {}
    return data;
  },

  async signUp(email, password, fullName, companyName) {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": SUPABASE_ANON_KEY,
        "Authorization": `Bearer ${SUPABASE_JWT}`,
      },
      body: JSON.stringify({ email, password, data: { full_name: fullName, company_name: companyName } }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error_description || data.msg || data.message || "Sign up failed");
    return data;
  },

  async signOut() {
    try {
      await fetch(`${SUPABASE_URL}/auth/v1/logout`, {
        method: "POST", headers: sbHeaders(),
      });
    } catch(e) {}
    _accessToken = null;
    try { localStorage.removeItem("fs_session"); } catch(e) {}
  },

  restoreSession() {
    try {
      const raw = localStorage.getItem("fs_session");
      if (raw) {
        const s = JSON.parse(raw);
        _accessToken = s.access_token;
        return s;
      }
    } catch(e) {}
    return null;
  },
};

// ── PostgREST query builder ───────────────────────────────────────────────────
const sbFrom = (table) => {
  let url = `${SUPABASE_URL}/rest/v1/${table}`;
  const params = new URLSearchParams();
  const headers = { ...sbHeaders(), "Prefer": "return=representation" };

  const builder = {
    select(cols = "*") { params.set("select", cols); return builder; },
    eq(col, val)        { params.append(col, `eq.${val}`); return builder; },
    in(col, vals)       { params.append(col, `in.(${vals.join(",")})`); return builder; },
    gte(col, val)       { params.append(col, `gte.${val}`); return builder; },
    lte(col, val)       { params.append(col, `lte.${val}`); return builder; },
    order(col, opts={}) { params.append("order", `${col}.${opts.ascending===false||opts.ascending===undefined&&col==="created_at"?"desc":"asc"}`); return builder; },
    limit(n)            { params.set("limit", n); return builder; },
    single()            { headers["Accept"] = "application/vnd.pgrst.object+json"; return builder; },

    async get() {
      const qs = params.toString();
      const res = await fetch(`${url}${qs?"?"+qs:""}`, { headers });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || data.hint || JSON.stringify(data));
      return data;
    },

    // Count only
    async count() {
      const countHeaders = { ...sbHeaders(), "Prefer": "count=exact", "Accept": "application/json" };
      params.set("select", "*");
      const qs = params.toString();
      const res = await fetch(`${url}${qs?"?"+qs:""}`, { method:"HEAD", headers: countHeaders });
      const range = res.headers.get("Content-Range") || "0/0";
      return parseInt(range.split("/")[1]) || 0;
    },

    async insert(body) {
      const res = await fetch(url, { method:"POST", headers, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || JSON.stringify(data));
      return data;
    },

    async update(body) {
      const qs = params.toString();
      const res = await fetch(`${url}${qs?"?"+qs:""}`, { method:"PATCH", headers, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || JSON.stringify(data));
      return data;
    },

    async patch(body) {
      const qs = params.toString();
      const res = await fetch(`${url}${qs?"?"+qs:""}`, { method:"PATCH", headers, body: JSON.stringify(body) });
      if (!res.ok) { const d = await res.json(); throw new Error(d.message || JSON.stringify(d)); }
      return res.status === 204 ? null : await res.json().catch(()=>null);
    },

    async delete() {
      const qs = params.toString();
      const res = await fetch(`${url}${qs?"?"+qs:""}`, { method:"DELETE", headers });
      if (!res.ok) { const d = await res.json(); throw new Error(d.message || JSON.stringify(d)); }
      return true;
    },
  };
  return builder;
};

// ─── DESIGN TOKENS ────────────────────────────────────────────────────────────
// ─── REACTIVE THEME ──────────────────────────────────────────────────────────
// Reads from localStorage on every render so theme changes apply immediately.
const DEFAULT_C = {
  flame:"#FF4500", flameLight:"#FF6A33", flameDark:"#CC3700",
  ember:"#FF8C00", coal:"#0D0D0D", ash:"#1A1A1A", smoke:"#2A2A2A",
  steel:"#3A3A3A", mist:"#8A8A8A", frost:"#E8E8E8", white:"#FAFAFA",
  safe:"#22C55E", warn:"#F59E0B", danger:"#EF4444", info:"#3B82F6",
};

function getThemeC() {
  try {
    const saved = localStorage.getItem("fsTheme");
    if (!saved) return DEFAULT_C;
    const t = JSON.parse(saved);
    return {
      flame:      t.accentPrimary   || DEFAULT_C.flame,
      flameLight: t.accentHover     || DEFAULT_C.flameLight,
      flameDark:  t.accentPrimary   || DEFAULT_C.flameDark,
      ember:      t.colorWarning    || DEFAULT_C.ember,
      coal:       t.bgPage          || DEFAULT_C.coal,
      ash:        t.bgSurface       || DEFAULT_C.ash,
      smoke:      t.bgInput         || DEFAULT_C.smoke,
      steel:      t.borderStrong    || DEFAULT_C.steel,
      mist:       t.textMuted       || DEFAULT_C.mist,
      frost:      t.textSecondary   || DEFAULT_C.frost,
      white:      t.textPrimary     || DEFAULT_C.white,
      safe:       t.colorSuccess    || DEFAULT_C.safe,
      warn:       t.colorWarning    || DEFAULT_C.warn,
      danger:     t.colorDanger     || DEFAULT_C.danger,
      info:       t.colorInfo       || DEFAULT_C.info,
      // Extra theme keys
      bgPage:     t.bgPage          || DEFAULT_C.coal,
      bgCard:     t.bgCard          || DEFAULT_C.ash,
      bgHover:    t.bgHover         || DEFAULT_C.smoke,
      navText:    t.navText         || DEFAULT_C.mist,
      navActiveBg:t.navActiveBg     || "#FF450018",
      navActiveText:t.navActiveText || DEFAULT_C.flame,
      btnPrimaryBg: t.btnPrimaryBg  || DEFAULT_C.flame,
      btnPrimaryText:t.btnPrimaryText|| "#FFFFFF",
      tableHeaderBg:t.tableHeaderBg || "#111111",
      tableRowHover:t.tableRowHover || DEFAULT_C.smoke,
    };
  } catch { return DEFAULT_C; }
}

// C is computed once per module load — ThemeReloader will force re-render on change
let C = getThemeC();

// ThemeReloader: invisible component that refreshes C and forces full re-render
function ThemeReloader({ children }) {
  const [, forceUpdate] = React.useReducer(x => x+1, 0);
  React.useEffect(() => {
    const handler = () => { C = getThemeC(); forceUpdate(); };
    window.addEventListener("fsThemeChanged", handler);
    return () => window.removeEventListener("fsThemeChanged", handler);
  }, []);
  return children;
}

// ─── GLOBAL STYLES ────────────────────────────────────────────────────────────
const GlobalStyles = () => {
  // Re-reads C fresh on every render (C is updated by ThemeReloader)
  return <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500&display=swap');
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    html, body, #root { height: 100%; font-family: 'DM Sans', sans-serif; background: ${C.coal}; color: ${C.white}; -webkit-font-smoothing: antialiased; }
    ::-webkit-scrollbar { width: 6px; } ::-webkit-scrollbar-track { background: ${C.ash}; } ::-webkit-scrollbar-thumb { background: ${C.steel}; border-radius: 3px; }
    @keyframes fadeIn { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
    @keyframes spin { to { transform: rotate(360deg); } }
    @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.4; } }
    @keyframes flamePulse { 0%,100% { box-shadow:0 0 20px rgba(255,69,0,0.4); } 50% { box-shadow:0 0 35px rgba(255,69,0,0.7); } }
    .fade-in { animation: fadeIn 0.3s ease forwards; }
    input, textarea, select, button { font-family: 'DM Sans', sans-serif; outline: none; }
    [data-tip] { position: relative; }
    [data-tip]:hover::after { content: attr(data-tip); position: absolute; bottom: calc(100% + 6px); left: 50%; transform: translateX(-50%); background: ${C.smoke}; border: 1px solid ${C.steel}; color: ${C.frost}; font-size: 11px; padding: 4px 8px; border-radius: 4px; white-space: nowrap; pointer-events: none; z-index: 9999; }
  `}</style>;
};

// ─── ICONS ────────────────────────────────────────────────────────────────────
const ICON_PATHS = {
  flame:      <><path d="M12 2s-4 5-4 9a4 4 0 008 0c0-4-4-9-4-9z" fill="currentColor"/><path d="M12 12c-1.1 0-2-.9-2-2 0-1 1-3 2-3s2 2 2 3c0 1.1-.9 2-2 2z" fill="rgba(255,140,0,0.9)"/></>,
  dashboard:  <><rect x="3" y="3" width="7" height="7" rx="1" fill="none" stroke="currentColor" strokeWidth="1.5"/><rect x="14" y="3" width="7" height="7" rx="1" fill="none" stroke="currentColor" strokeWidth="1.5"/><rect x="3" y="14" width="7" height="7" rx="1" fill="none" stroke="currentColor" strokeWidth="1.5"/><rect x="14" y="14" width="7" height="7" rx="1" fill="none" stroke="currentColor" strokeWidth="1.5"/></>,
  calendar:   <><rect x="3" y="4" width="18" height="18" rx="2" fill="none" stroke="currentColor" strokeWidth="1.5"/><path d="M16 2v4M8 2v4M3 10h18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></>,
  clipboard:  <><rect x="8" y="2" width="8" height="4" rx="1" fill="none" stroke="currentColor" strokeWidth="1.5"/><rect x="3" y="4" width="18" height="18" rx="2" fill="none" stroke="currentColor" strokeWidth="1.5"/><path d="M8 12h8M8 16h5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></>,
  alert:      <><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" fill="none" stroke="currentColor" strokeWidth="1.5"/><path d="M12 9v4M12 17h.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></>,
  fileText:   <><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" fill="none" stroke="currentColor" strokeWidth="1.5"/><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></>,
  invoice:    <><rect x="3" y="2" width="18" height="20" rx="2" fill="none" stroke="currentColor" strokeWidth="1.5"/><path d="M8 7h8M8 11h8M8 15h5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></>,
  creditCard: <><rect x="1" y="4" width="22" height="16" rx="2" fill="none" stroke="currentColor" strokeWidth="1.5"/><path d="M1 10h22" stroke="currentColor" strokeWidth="1.5"/></>,
  users:      <><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" fill="none" stroke="currentColor" strokeWidth="1.5"/><circle cx="9" cy="7" r="4" fill="none" stroke="currentColor" strokeWidth="1.5"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></>,
  settings:   <><circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" strokeWidth="1.5"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" fill="none" stroke="currentColor" strokeWidth="1.5"/></>,
  bell:       <><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0" fill="none" stroke="currentColor" strokeWidth="1.5"/></>,
  search:     <><circle cx="11" cy="11" r="8" fill="none" stroke="currentColor" strokeWidth="1.5"/><path d="m21 21-4.35-4.35" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></>,
  plus:       <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>,
  x:          <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>,
  chevronR:   <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>,
  menu:       <path d="M3 12h18M3 6h18M3 18h18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>,
  logout:     <><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></>,
  building:   <><rect x="3" y="9" width="18" height="13" fill="none" stroke="currentColor" strokeWidth="1.5"/><path d="M3 9l9-7 9 7" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><path d="M9 22V12h6v10" fill="none" stroke="currentColor" strokeWidth="1.5"/></>,
  wrench:     <path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z" fill="none" stroke="currentColor" strokeWidth="1.5"/>,
  trendUp:    <><polyline points="23 6 13.5 15.5 8.5 10.5 1 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><polyline points="17 6 23 6 23 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></>,
  robot:      <><rect x="3" y="8" width="18" height="13" rx="2" fill="none" stroke="currentColor" strokeWidth="1.5"/><circle cx="9" cy="14" r="1.5" fill="currentColor"/><circle cx="15" cy="14" r="1.5" fill="currentColor"/><path d="M12 3v5M9 22v-1M15 22v-1M8 8V6M16 8V6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></>,
  dollar:     <><line x1="12" y1="1" x2="12" y2="23" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></>,
  zap:        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>,
  mail:       <><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" fill="none" stroke="currentColor" strokeWidth="1.5"/><polyline points="22,6 12,13 2,6" fill="none" stroke="currentColor" strokeWidth="1.5"/></>,
  lock:       <><rect x="3" y="11" width="18" height="11" rx="2" fill="none" stroke="currentColor" strokeWidth="1.5"/><path d="M7 11V7a5 5 0 0110 0v4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></>,
  eye:        <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" fill="none" stroke="currentColor" strokeWidth="1.5"/><circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" strokeWidth="1.5"/></>,
  check:      <path d="M20 6L9 17l-5-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>,
};
const Icon = ({ name, size = 18, color, style = {} }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    style={{ color: color || "currentColor", flexShrink: 0, ...style }}>
    {ICON_PATHS[name]}
  </svg>
);

// ─── SHARED UI COMPONENTS ─────────────────────────────────────────────────────

const Spinner = ({ size = 16 }) => (
  <span style={{ width: size, height: size, border: `2px solid rgba(255,255,255,0.2)`, borderTopColor: "#fff", borderRadius: "50%", display: "inline-block", animation: "spin 0.7s linear infinite" }} />
);

const Badge = ({ children, type = "default", size = "sm" }) => {
  const map = {
    default: { bg: `${C.mist}18`, color: C.mist, border: `${C.mist}40` },
    success: { bg: `${C.safe}18`, color: C.safe, border: `${C.safe}40` },
    warning: { bg: `${C.warn}18`, color: C.warn, border: `${C.warn}40` },
    danger:  { bg: `${C.danger}18`, color: C.danger, border: `${C.danger}40` },
    info:    { bg: `${C.info}18`, color: C.info, border: `${C.info}40` },
    flame:   { bg: `${C.flame}18`, color: C.flame, border: `${C.flame}40` },
  };
  const s = map[type] || map.default;
  return <span style={{ display:"inline-flex", alignItems:"center", padding: size==="sm"?"2px 8px":"4px 12px", borderRadius:20, fontSize: size==="sm"?11:12, fontWeight:500, background:s.bg, color:s.color, border:`1px solid ${s.border}`, whiteSpace:"nowrap" }}>{children}</span>;
};

const Card = ({ children, style={}, onClick }) => (
  <div onClick={onClick} style={{ background:C.ash, border:`1px solid ${C.smoke}`, borderRadius:8, padding:20, transition:"all 0.15s", cursor:onClick?"pointer":"default", ...style }}
    onMouseEnter={e=>{ if(onClick){ e.currentTarget.style.borderColor=C.steel; e.currentTarget.style.transform="translateY(-1px)"; }}}
    onMouseLeave={e=>{ if(onClick){ e.currentTarget.style.borderColor=C.smoke; e.currentTarget.style.transform="translateY(0)"; }}}
  >{children}</div>
);

const Btn = ({ children, variant="primary", size="md", icon, onClick, disabled=false, full=false, style={} }) => {
  const vs = {
    primary:   { bg:C.flame,             color:"#fff",    hov:C.flameLight, border:"none" },
    secondary: { bg:"transparent",       color:C.frost,   hov:C.smoke,      border:`1px solid ${C.steel}` },
    ghost:     { bg:"transparent",       color:C.mist,    hov:C.smoke,      border:"none" },
    danger:    { bg:`${C.danger}18`,     color:C.danger,  hov:`${C.danger}28`, border:`1px solid ${C.danger}40` },
    success:   { bg:`${C.safe}18`,       color:C.safe,    hov:`${C.safe}28`, border:`1px solid ${C.safe}40` },
  };
  const v = vs[variant]||vs.primary;
  const pad = size==="sm"?"6px 12px":size==="lg"?"12px 24px":"8px 16px";
  const fs  = size==="sm"?12:size==="lg"?15:13;
  return (
    <button disabled={disabled} onClick={onClick} style={{ display:"inline-flex", alignItems:"center", justifyContent:"center", gap:6, padding:pad, fontSize:fs, fontWeight:500, background:v.bg, color:v.color, border:v.border||"none", borderRadius:6, transition:"all 0.15s", opacity:disabled?0.5:1, cursor:disabled?"not-allowed":"pointer", width:full?"100%":"auto", ...style }}
      onMouseEnter={e=>{ if(!disabled) e.currentTarget.style.background=v.hov; }}
      onMouseLeave={e=>{ if(!disabled) e.currentTarget.style.background=v.bg; }}
    >
      {icon && <Icon name={icon} size={size==="sm"?14:16}/>}
      {children}
    </button>
  );
};

const Field = ({ label, type="text", placeholder, value, onChange, icon, error, required, hint }) => (
  <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
    {label && <label style={{ fontSize:12, fontWeight:500, color:C.mist, letterSpacing:"0.04em", textTransform:"uppercase" }}>{label}{required&&<span style={{color:C.flame}}> *</span>}</label>}
    <div style={{ position:"relative" }}>
      {icon && <span style={{ position:"absolute", left:10, top:"50%", transform:"translateY(-50%)", color:C.mist, pointerEvents:"none" }}><Icon name={icon} size={15}/></span>}
      <input type={type} placeholder={placeholder} value={value} onChange={onChange} style={{ width:"100%", padding:icon?"10px 12px 10px 34px":"10px 12px", background:C.smoke, border:`1px solid ${error?C.danger:C.steel}`, borderRadius:6, color:C.white, fontSize:13, transition:"border-color 0.15s" }}
        onFocus={e=>e.target.style.borderColor=C.flame}
        onBlur={e=>e.target.style.borderColor=error?C.danger:C.steel}
      />
    </div>
    {error && <span style={{ fontSize:11, color:C.danger }}>{error}</span>}
    {hint  && <span style={{ fontSize:11, color:C.mist  }}>{hint}</span>}
  </div>
);

const Avatar = ({ name="?", size=32 }) => {
  const initials = name.split(" ").map(n=>n[0]).join("").slice(0,2).toUpperCase();
  const hue = (name.charCodeAt(0)*37)%360;
  return <div style={{ width:size, height:size, borderRadius:"50%", background:`hsl(${hue},55%,35%)`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:size*0.34, fontWeight:700, color:"#fff", flexShrink:0 }}>{initials}</div>;
};

const SkeletonRow = () => (
  <div style={{ display:"flex", gap:12, padding:"12px 16px", borderBottom:`1px solid ${C.smoke}20` }}>
    {[180,120,100,80].map((w,i) => (
      <div key={i} style={{ height:14, width:w, borderRadius:4, background:C.steel, animation:"pulse 1.5s ease-in-out infinite" }}/>
    ))}
  </div>
);

const EmptyState = ({ icon, title, sub, action }) => (
  <div style={{ padding:48, textAlign:"center" }}>
    <div style={{ width:56, height:56, borderRadius:14, background:`${C.flame}15`, display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 16px" }}>
      <Icon name={icon} size={26} color={C.flame}/>
    </div>
    <div style={{ fontSize:15, fontWeight:600, color:C.frost, marginBottom:6 }}>{title}</div>
    <div style={{ fontSize:13, color:C.mist, marginBottom:action?20:0 }}>{sub}</div>
    {action && <Btn icon="plus">{action}</Btn>}
  </div>
);

const ErrorBanner = ({ msg, onRetry }) => {
  const { t } = useT();
  return (
  <div style={{ margin:24, padding:"12px 16px", background:`${C.danger}12`, border:`1px solid ${C.danger}30`, borderRadius:8, display:"flex", alignItems:"center", gap:12 }}>
    <Icon name="alert" size={16} color={C.danger}/>
    <span style={{ fontSize:13, color:C.frost, flex:1 }}>{msg}</span>
    {onRetry && <Btn variant="ghost" size="sm" onClick={onRetry}>{t("retry")}</Btn>}
  </div>
  );
};

// ─── DATA HOOK ────────────────────────────────────────────────────────────────
// Generic hook: useQuery(asyncFn, deps)
const useQuery = (fn, deps = []) => {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  const run = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const result = await fn();
      setData(result);
    } catch(e) {
      setError(e.message || "Une erreur est survenue");
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => { run(); }, [run]);
  return { data, loading, error, refetch: run };
};

// ─── SUPABASE DATA LAYER ──────────────────────────────────────────────────────
const DB = {
  async getProfile(userId) {
    return sbFrom("profiles")
      .select("*, company:companies(*)")
      .eq("id", userId)
      .single()
      .get();
  },

  async getDashboardStats(companyId) {
    const today = new Date().toISOString().split("T")[0];
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split("T")[0];
    const h = { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${_accessToken||SUPABASE_JWT}`, "Prefer":"count=exact", "Accept":"application/json" };
    const countOf = (url) => fetch(url, { method:"HEAD", headers:h })
      .then(r => parseInt(r.headers.get("Content-Range")?.split("/")[1]||"0")||0).catch(()=>0);
    const [insp, defi, inv, rev] = await Promise.all([
      countOf(`${SUPABASE_URL}/rest/v1/inspections?company_id=eq.${companyId}&scheduled_date=eq.${today}&select=id`),
      countOf(`${SUPABASE_URL}/rest/v1/deficiencies?company_id=eq.${companyId}&status=eq.open&select=id`),
      countOf(`${SUPABASE_URL}/rest/v1/invoices?company_id=eq.${companyId}&status=in.(sent,pending,overdue)&select=id`),
      fetch(`${SUPABASE_URL}/rest/v1/payments?company_id=eq.${companyId}&status=eq.completed&paid_at=gte.${monthStart}&select=amount`,
        { headers:{ apikey:SUPABASE_ANON_KEY, Authorization:`Bearer ${_accessToken||SUPABASE_JWT}` }})
        .then(r=>r.json()).catch(()=>[]),
    ]);
    const revenue = (Array.isArray(rev) ? rev : []).reduce((s, p) => s + Number(p.amount||0), 0);
    return { inspectionsToday:insp, openDeficiencies:defi, pendingInvoices:inv, revenueThisMonth:revenue };
  },

  async getRecentInspections(companyId) {
    // Fetch raw then join profiles separately to avoid FK ambiguity
    const headers = { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${_accessToken||SUPABASE_JWT}` };
    const rows = await fetch(`${SUPABASE_URL}/rest/v1/inspections?company_id=eq.${companyId}&select=id,status,trade,scheduled_date,score,technician_id,building_id,customer_id&order=created_at.desc&limit=8`, {headers}).then(r=>r.json()).catch(()=>[]);
    if(!rows?.length) return [];
    const bldIds  = [...new Set(rows.map(r=>r.building_id).filter(Boolean))];
    const custIds = [...new Set(rows.map(r=>r.customer_id).filter(Boolean))];
    const profIds = [...new Set(rows.map(r=>r.technician_id).filter(Boolean))];
    const [blds,custs,profs] = await Promise.all([
      bldIds.length  ? fetch(`${SUPABASE_URL}/rest/v1/buildings?id=in.(${bldIds.join(",")})&select=id,name`,{headers}).then(r=>r.json()).catch(()=>[]) : [],
      custIds.length ? fetch(`${SUPABASE_URL}/rest/v1/customers?id=in.(${custIds.join(",")})&select=id,name`,{headers}).then(r=>r.json()).catch(()=>[]) : [],
      profIds.length ? fetch(`${SUPABASE_URL}/rest/v1/profiles?id=in.(${profIds.join(",")})&select=id,full_name`,{headers}).then(r=>r.json()).catch(()=>[]) : [],
    ]);
    const bm=Object.fromEntries((blds||[]).map(b=>[b.id,b]));
    const cm=Object.fromEntries((custs||[]).map(c=>[c.id,c]));
    const pm=Object.fromEntries((profs||[]).map(p=>[p.id,p]));
    return rows.map(r=>({...r, building:bm[r.building_id]||null, customer:cm[r.customer_id]||null, technician:pm[r.technician_id]||null}));
  },

  async getInspections(companyId, statusFilter, technicianId) {
    const headers = { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${_accessToken||SUPABASE_JWT}` };
    let qs = `company_id=eq.${companyId}&select=id,status,trade,scheduled_date,score,technician_id,building_id,customer_id&order=created_at.desc`;
    if (statusFilter && statusFilter !== "all") qs += `&status=eq.${statusFilter}`;
    if (technicianId) qs += `&technician_id=eq.${technicianId}`;
    const rows = await fetch(`${SUPABASE_URL}/rest/v1/inspections?${qs}`,{headers}).then(r=>r.json()).catch(()=>[]);
    if(!rows?.length) return [];
    const bldIds  = [...new Set(rows.map(r=>r.building_id).filter(Boolean))];
    const custIds = [...new Set(rows.map(r=>r.customer_id).filter(Boolean))];
    const profIds = [...new Set(rows.map(r=>r.technician_id).filter(Boolean))];
    const [blds,custs,profs] = await Promise.all([
      bldIds.length  ? fetch(`${SUPABASE_URL}/rest/v1/buildings?id=in.(${bldIds.join(",")})&select=id,name`,{headers}).then(r=>r.json()).catch(()=>[]) : [],
      custIds.length ? fetch(`${SUPABASE_URL}/rest/v1/customers?id=in.(${custIds.join(",")})&select=id,name`,{headers}).then(r=>r.json()).catch(()=>[]) : [],
      profIds.length ? fetch(`${SUPABASE_URL}/rest/v1/profiles?id=in.(${profIds.join(",")})&select=id,full_name`,{headers}).then(r=>r.json()).catch(()=>[]) : [],
    ]);
    const bm=Object.fromEntries((blds||[]).map(b=>[b.id,b]));
    const cm=Object.fromEntries((custs||[]).map(c=>[c.id,c]));
    const pm=Object.fromEntries((profs||[]).map(p=>[p.id,p]));
    return rows.map(r=>({...r, building:bm[r.building_id]||null, customer:cm[r.customer_id]||null, technician:pm[r.technician_id]||null}));
  },

  async getDeficiencies(companyId, statusFilter, technicianId) {
    const q = sbFrom("deficiencies")
      .select("id,title,severity,status,identified_at,nfpa_reference,building:buildings(name),customer:customers(name),assignee:profiles(full_name)")
      .eq("company_id", companyId)
      .order("identified_at");
    if (statusFilter && statusFilter !== "all") q.eq("status", statusFilter);
    if (technicianId) q.eq("assigned_to", technicianId);
    return q.get();
  },

  async getCustomers(companyId) {
    return sbFrom("customers")
      .select("*,buildings(id)")
      .eq("company_id", companyId)
      .eq("is_active", true)
      .order("name", { ascending: true })
      .get();
  },

  async getInvoices(companyId, statusFilter) {
    const q = sbFrom("invoices")
      .select("id,invoice_number,status,total,amount_paid,balance_due,issue_date,due_date,customer:customers(name)")
      .eq("company_id", companyId)
      .order("created_at");
    if (statusFilter && statusFilter !== "all") q.eq("status", statusFilter);
    return q.get();
  },

  async getTechnicians(companyId) {
    return sbFrom("profiles")
      .select("id,full_name,status,role")
      .eq("company_id", companyId)
      .eq("role", "technician")
      .get();
  },

  async getSchedules(companyId, from, to) {
    // Manual join to avoid FK ambiguity (assigned_to + created_by both ref profiles)
    const h = { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${_accessToken||SUPABASE_JWT}` };
    const rows = await fetch(
      `${SUPABASE_URL}/rest/v1/schedules?company_id=eq.${companyId}&scheduled_date=gte.${from}&scheduled_date=lte.${to}&select=id,title,trade,scheduled_date,scheduled_time,status,assigned_to,building_id,customer_id&order=scheduled_date.asc`,
      { headers: h }
    ).then(r=>r.json()).catch(()=>[]);
    if (!rows?.length) return [];
    const bldIds  = [...new Set(rows.map(r=>r.building_id).filter(Boolean))];
    const custIds = [...new Set(rows.map(r=>r.customer_id).filter(Boolean))];
    const profIds = [...new Set(rows.map(r=>r.assigned_to).filter(Boolean))];
    const [blds, custs, profs] = await Promise.all([
      bldIds.length  ? fetch(`${SUPABASE_URL}/rest/v1/buildings?id=in.(${bldIds.join(",")})&select=id,name`,{headers:h}).then(r=>r.json()).catch(()=>[]) : [],
      custIds.length ? fetch(`${SUPABASE_URL}/rest/v1/customers?id=in.(${custIds.join(",")})&select=id,name`,{headers:h}).then(r=>r.json()).catch(()=>[]) : [],
      profIds.length ? fetch(`${SUPABASE_URL}/rest/v1/profiles?id=in.(${profIds.join(",")})&select=id,full_name`,{headers:h}).then(r=>r.json()).catch(()=>[]) : [],
    ]);
    const bm = Object.fromEntries((blds||[]).map(b=>[b.id,b]));
    const cm = Object.fromEntries((custs||[]).map(c=>[c.id,c]));
    const pm = Object.fromEntries((profs||[]).map(p=>[p.id,p]));
    return rows.map(r=>({
      ...r,
      building:  bm[r.building_id]  || null,
      customer:  cm[r.customer_id]  || null,
      technician: pm[r.assigned_to] || null,
    }));
  },
};

// ─── AUTH ─────────────────────────────────────────────────────────────────────
const LoginScreen = ({ onLogin }) => {
  const { t } = useT();
  const [tab,      setTab]      = useState("login");
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [name,     setName]     = useState("");
  const [company,  setCompany]  = useState("");
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState("");
  const [message,  setMessage]  = useState("");

  const handleLogin = async () => {
    if (!email || !password) { setError("L'e-mail et le mot de passe sont obligatoires."); return; }
    setLoading(true); setError("");
    try {
      const session = await sbAuth.signIn(email, password);
      const profile = await DB.getProfile(session.user.id);
      onLogin(profile);
    } catch(e) {
      setError(e.message || "Échec de la connexion. Vérifiez vos identifiants.");
    } finally { setLoading(false); }
  };

  const handleInscription = async () => {
    if (!email || !password || !name || !company) { setError("Tous les champs sont obligatoires."); return; }
    if (password.length < 6) { setError("Password must be at least 6 characters."); return; }
    setLoading(true); setError("");
    try {
      await sbAuth.signUp(email, password, name, company);
      setMessage("✅ Compte créé ! Vérifiez votre e-mail pour confirmer, puis connectez-vous.");
      setTab("login");
    } catch(e) {
      setError(e.message || "Échec de l'inscription.");
    } finally { setLoading(false); }
  };

  return (
    <div style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", padding:20,
      background:`radial-gradient(ellipse at 20% 50%, ${C.flame}0d 0%, transparent 60%), ${C.coal}` }}>
      <div style={{ position:"fixed", inset:0, backgroundImage:`linear-gradient(${C.ash}40 1px, transparent 1px), linear-gradient(90deg, ${C.ash}40 1px, transparent 1px)`, backgroundSize:"40px 40px", opacity:0.4, pointerEvents:"none" }}/>
      <div className="fade-in" style={{ width:"100%", maxWidth:400, position:"relative", zIndex:1 }}>
        {/* Logo */}
        <div style={{ textAlign:"center", marginBottom:32 }}>
          <div style={{ width:56, height:56, borderRadius:14, background:`linear-gradient(135deg, ${C.flame}, ${C.ember})`, display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 16px", animation:"flamePulse 2s ease-in-out infinite" }}>
            <Icon name="flame" size={28} color="#fff"/>
          </div>
          <h1 style={{ fontFamily:"Syne, sans-serif", fontSize:26, fontWeight:800, color:C.white, letterSpacing:"-0.02em" }}>FireSafe Pro</h1>
          <p style={{ fontSize:13, color:C.mist, marginTop:4 }}>Plateforme d'inspection sécurité incendie</p>
        </div>

        <div style={{ background:C.ash, border:`1px solid ${C.smoke}`, borderRadius:16, padding:28, boxShadow:"0 24px 60px rgba(0,0,0,0.5)" }}>
          {/* Tabs */}
          <div style={{ display:"flex", gap:4, background:C.smoke, borderRadius:8, padding:4, marginBottom:24 }}>
            {[["login","Connexion"],["register","Inscription"]].map(([t,l]) => (
              <button key={t} onClick={()=>{ setTab(t); setError(""); setMessage(""); }} style={{ flex:1, padding:"8px", borderRadius:6, border:"none", background:tab===t?C.flame:"transparent", color:tab===t?"#fff":C.mist, fontSize:13, fontWeight:500, cursor:"pointer", transition:"all 0.15s" }}>{l}</button>
            ))}
          </div>

          {message && <div style={{ padding:"10px 14px", background:`${C.safe}15`, border:`1px solid ${C.safe}30`, borderRadius:6, fontSize:13, color:C.safe, marginBottom:16 }}>{message}</div>}
          {error   && <div style={{ padding:"10px 14px", background:`${C.danger}15`, border:`1px solid ${C.danger}30`, borderRadius:6, fontSize:13, color:C.danger, marginBottom:16 }}>{error}</div>}

          <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
            {tab==="register" && <>
              <Field label="Votre nom" placeholder="Alex Martin" icon="users" value={name} onChange={e=>setName(e.target.value)} required/>
              <Field label="Nom de l'entreprise" placeholder="FireGuard Pro SARL" icon="building" value={company} onChange={e=>setCompany(e.target.value)} required/>
            </>}
            <Field label="E-mail" type="email" placeholder="alex@fireguardpro.com" icon="mail" value={email} onChange={e=>setEmail(e.target.value)} required/>
            <Field label="Mot de passe" type="password" placeholder="••••••••" icon="lock" value={password} onChange={e=>setPassword(e.target.value)} required
              hint={tab==="register"?"Minimum 6 caractères":undefined}/>

            <Btn full size="lg" onClick={tab==="login"?handleLogin:handleInscription} disabled={loading}>
              {loading ? <><Spinner/> {tab==="login"?t("logging_in"):t("creating_account")}</> : tab==="login"?"Connexion":"Create Account"}
            </Btn>
          </div>

          {tab==="login" && (
            <p style={{ textAlign:"center", fontSize:12, color:C.mist, marginTop:16 }}>
              Pas encore de compte ?{" "}
              <span onClick={()=>setTab("register")} style={{ color:C.flame, cursor:"pointer" }}>Inscription here</span>
            </p>
          )}
        </div>
        <p style={{ textAlign:"center", fontSize:11, color:C.steel, marginTop:20 }}>En continuant, vous acceptez nos Conditions d'utilisation et notre Politique de confidentialité</p>
      </div>
    </div>
  );
};

// ─── SIDEBAR ──────────────────────────────────────────────────────────────────
const NAV = [
  { id:"dashboard",    labelKey:"dashboard",     icon:"dashboard"  },
  { id:"scheduling",   labelKey:"scheduling",    icon:"calendar"   },
  { id:"inspections",  labelKey:"inspections",   icon:"clipboard"  },
  { id:"deficiencies", labelKey:"deficiencies",  icon:"alert"      },
  { id:"proposals",    labelKey:"proposals",     icon:"fileText"   },
  { id:"workorders",   labelKey:"workorders",    icon:"wrench"     },
  { id:"invoices",     labelKey:"invoices",      icon:"invoice"    },
  { id:"payments",     labelKey:"payments",      icon:"creditCard" },
  { id:"customers",    labelKey:"customers",     icon:"users"      },
  { id:"settings",     labelKey:"settings",      icon:"settings"   },
];


// ─── ROLE PERMISSIONS ─────────────────────────────────────────────────────────
// Pages accessible per role
const ROLE_PAGES = {
  owner:        ["dashboard","scheduling","inspections","deficiencies","proposals","workorders","invoices","payments","customers","ai","settings","seeder"],
  admin:        ["dashboard","scheduling","inspections","deficiencies","proposals","workorders","invoices","payments","customers","ai","settings","seeder"],
  office_staff: ["dashboard","inspections","deficiencies","proposals","invoices","payments","customers","ai"],
  technician:   ["dashboard","scheduling","inspections","deficiencies","workorders","ai"],
};

// Default landing page per role
const ROLE_HOME = {
  owner:        "dashboard",
  admin:        "dashboard",
  office_staff: "dashboard",
  technician:   "dashboard",
};

const canAccess = (role, page) => (ROLE_PAGES[role] || ROLE_PAGES.owner).includes(page);


const Sidebar = ({ active, onNav, user, collapsed, onToggle, onLogout, companyLogo, companyName }) => {
  const { t } = useT();
  const roleLabels = { owner: t("owner")||"Propriétaire", admin: t("admin")||"Administrateur", office_staff: t("office_staff")||"Bureau", technician: t("technician")||"Technicien" };
  return (
  <aside style={{ width:collapsed?64:220, minHeight:"100vh", background:C.ash, borderRight:`1px solid ${C.smoke}`, display:"flex", flexDirection:"column", transition:"width 0.25s ease", position:"fixed", left:0, top:0, bottom:0, zIndex:100, flexShrink:0 }}>
    <div style={{ height:60, display:"flex", alignItems:"center", padding:collapsed?"0 16px":"0 14px", gap:10, borderBottom:`1px solid ${C.smoke}` }}>
      <div style={{ width:32, height:32, borderRadius:8, background:companyLogo?"transparent":`linear-gradient(135deg,${C.flame},${C.ember})`, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, overflow:"hidden", animation:companyLogo?"none":"flamePulse 3s ease-in-out infinite" }}>
        {companyLogo
          ? <img src={companyLogo} alt="logo" style={{ width:"100%", height:"100%", objectFit:"contain", borderRadius:8 }}/>
          : <Icon name="flame" size={18} color="#fff"/>
        }
      </div>
      {!collapsed && <span style={{ fontFamily:"Syne,sans-serif", fontWeight:800, fontSize:15, color:C.white, letterSpacing:"-0.01em", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", maxWidth:130 }}>{companyName||"FireSafe"}</span>}
      <button onClick={onToggle} style={{ marginLeft:"auto", background:"none", border:"none", color:C.mist, padding:4, borderRadius:4, cursor:"pointer", transition:"color 0.15s" }}
        onMouseEnter={e=>e.currentTarget.style.color=C.white} onMouseLeave={e=>e.currentTarget.style.color=C.mist}>
        <Icon name="menu" size={16}/>
      </button>
    </div>

    <nav style={{ flex:1, padding:"10px 8px", overflowY:"auto", display:"flex", flexDirection:"column", gap:2 }}>
      {NAV.filter(item => canAccess(user?.role, item.id)).map(item => {
        const on = active===item.id;
        const label = t(item.labelKey);
        return (
          <button key={item.id} onClick={()=>onNav(item.id)} data-tip={collapsed?label:undefined}
            style={{ display:"flex", alignItems:"center", gap:10, padding:collapsed?"10px":"9px 10px", borderRadius:6, border:"none", width:"100%", background:on?`${C.flame}20`:"transparent", color:on?C.flame:C.mist, fontSize:13, fontWeight:on?600:400, transition:"all 0.12s", cursor:"pointer", justifyContent:collapsed?"center":"flex-start", position:"relative" }}
            onMouseEnter={e=>{ if(!on){ e.currentTarget.style.background=C.smoke; e.currentTarget.style.color=C.frost; }}}
            onMouseLeave={e=>{ if(!on){ e.currentTarget.style.background="transparent"; e.currentTarget.style.color=C.mist; }}}>
            {on && <span style={{ position:"absolute", left:0, top:"25%", bottom:"25%", width:3, background:C.navActiveText||C.flame, borderRadius:"0 2px 2px 0" }}/>}
            <Icon name={item.icon} size={16}/>
            {!collapsed && <span>{label}</span>}
            {!collapsed && item.id==="ai" && <Badge type="flame" size="sm">AI</Badge>}
          </button>
        );
      })}
    </nav>

    <div style={{ padding:collapsed?"10px 8px":"12px", borderTop:`1px solid ${C.smoke}`, display:"flex", alignItems:"center", gap:10 }}>
      <Avatar name={user?.full_name||"?"} size={32}/>
      {!collapsed && <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:12, fontWeight:600, color:C.frost, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{user?.full_name}</div>
        <div style={{ display:"flex", alignItems:"center", gap:5, marginTop:2 }}>
          {(() => {
            const roleColors = { owner:"FF4500", admin:"3B82F6", office_staff:"F59E0B", technician:"22C55E" };
            const col = roleColors[user?.role] || "8A8A8A";
            return <span style={{ fontSize:9, fontWeight:700, padding:"1px 7px", borderRadius:10, background:`#${col}25`, color:`#${col}`, textTransform:"uppercase", letterSpacing:"0.05em" }}>{roleLabels[user?.role] || user?.role}</span>;
          })()}
        </div>
      </div>}
      {!collapsed && (
        <button onClick={onLogout} data-tip={t("logout")} style={{ background:"none", border:"none", color:C.mist, padding:4, cursor:"pointer", transition:"color 0.15s" }}
          onMouseEnter={e=>e.currentTarget.style.color=C.danger} onMouseLeave={e=>e.currentTarget.style.color=C.mist}>
          <Icon name="logout" size={15}/>
        </button>
      )}
    </div>
  </aside>
  );
};

// ─── HEADER ───────────────────────────────────────────────────────────────────
const Header = ({ title, subtitle, user, actions }) => (
  <header style={{ height:60, borderBottom:`1px solid ${C.smoke}`, background:`${C.coal}ee`, backdropFilter:"blur(8px)", display:"flex", alignItems:"center", padding:"0 24px", gap:16, position:"sticky", top:0, zIndex:50 }}>
    <div style={{ flex:1 }}>
      <h1 style={{ fontFamily:"Syne,sans-serif", fontSize:16, fontWeight:700, color:C.white, lineHeight:1 }}>{title}</h1>
      {subtitle && <p style={{ fontSize:11, color:C.mist, marginTop:2 }}>{subtitle}</p>}
    </div>
    <div style={{ position:"relative" }}>
      <Icon name="search" size={14} color={C.mist} style={{ position:"absolute", left:10, top:"50%", transform:"translateY(-50%)" }}/>
      <input placeholder="Search..." style={{ background:C.smoke, border:`1px solid ${C.steel}`, borderRadius:6, padding:"6px 12px 6px 30px", fontSize:12, color:C.frost, width:200 }}
        onFocus={e=>e.target.style.borderColor=C.flame} onBlur={e=>e.target.style.borderColor=C.steel}/>
    </div>
    <button style={{ position:"relative", background:"none", border:"none", color:C.mist, padding:6, cursor:"pointer", transition:"color 0.15s" }}
      onMouseEnter={e=>e.currentTarget.style.color=C.white} onMouseLeave={e=>e.currentTarget.style.color=C.mist}>
      <Icon name="bell" size={18}/>
    </button>
    {actions}
    <Avatar name={user?.full_name||"?"} size={30}/>
  </header>
);

// ─── STAT CARD ────────────────────────────────────────────────────────────────
const StatCard = ({ label, value, icon, color=C.flame, prefix="", loading }) => (
  <Card style={{ padding:20 }}>
    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:12 }}>
      <span style={{ fontSize:11, fontWeight:500, color:C.mist, textTransform:"uppercase", letterSpacing:"0.06em" }}>{label}</span>
      <div style={{ width:36, height:36, borderRadius:8, background:`${color}20`, display:"flex", alignItems:"center", justifyContent:"center" }}>
        <Icon name={icon} size={18} color={color}/>
      </div>
    </div>
    {loading
      ? <div style={{ height:28, width:80, borderRadius:4, background:C.steel, animation:"pulse 1.5s ease-in-out infinite" }}/>
      : <div style={{ fontSize:28, fontWeight:800, fontFamily:"Syne,sans-serif", color:C.white, lineHeight:1 }}>{prefix}{typeof value==="number"?value.toLocaleString():value}</div>
    }
  </Card>
);

// ─── TABLE ────────────────────────────────────────────────────────────────────
const Table = ({ columns, data, loading, emptyIcon, emptyTitle, emptyText }) => (
  <div style={{ overflowX:"auto" }}>
    <table style={{ width:"100%", borderCollapse:"collapse" }}>
      <thead>
        <tr>{columns.map(col=>(
          <th key={col.key} style={{ padding:"10px 16px", textAlign:col.align||"left", fontSize:11, fontWeight:600, color:C.mist, textTransform:"uppercase", letterSpacing:"0.06em", borderBottom:`1px solid ${C.smoke}` }}>{col.label}</th>
        ))}</tr>
      </thead>
      <tbody>
        {loading && [1,2,3,4,5].map(i=>(
          <tr key={i}><td colSpan={columns.length} style={{ padding:0 }}><SkeletonRow/></td></tr>
        ))}
        {!loading && data.length === 0 && (
          <tr><td colSpan={columns.length}>
            <EmptyState icon={emptyIcon||"clipboard"} title={emptyTitle||"No records"} sub={emptyText||"Nothing here yet."}/>
          </td></tr>
        )}
        {!loading && data.map((row,i)=>(
          <tr key={i} style={{ transition:"background 0.12s" }}
            onMouseEnter={e=>e.currentTarget.style.background=C.smoke}
            onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
            {columns.map(col=>(
              <td key={col.key} style={{ padding:"12px 16px", fontSize:13, color:C.frost, borderBottom:`1px solid ${C.smoke}20`, textAlign:col.align||"left" }}>
                {col.render ? col.render(row[col.key], row) : row[col.key]}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

// ─── DASHBOARD ────────────────────────────────────────────────────────────────
// ─── TECHNICIAN DASHBOARD ────────────────────────────────────────────────────
const TechnicianDashboard = ({ user }) => {
  const { t } = useT();
  const uid = user?.id;
  const cid = user?.company_id;
  const [jobs,   setJobs]   = useState([]);
  const [wos,    setWos]    = useState([]);
  const [defis,  setDefis]  = useState([]);
  const [loading,setLoading]= useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const h = { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_JWT}` };
      const today = new Date().toISOString().split("T")[0];
      try {
        const [rawJobs, rawWOs, rawDefis] = await Promise.all([
          // Today's scheduled inspections assigned to this tech
          fetch(`${SUPABASE_URL}/rest/v1/schedules?company_id=eq.${cid}&assigned_to=eq.${uid}&scheduled_date=eq.${today}&select=id,title,trade,scheduled_time,status,building_id,customer_id&order=scheduled_time.asc`, {headers:h}).then(r=>r.json()).catch(()=>[]),
          // Open work orders assigned to this tech
          fetch(`${SUPABASE_URL}/rest/v1/work_orders?company_id=eq.${cid}&assigned_to=eq.${uid}&status=not.in.(completed,cancelled)&select=id,title,priority,status,work_order_number,building_id,customer_id,scheduled_date&order=scheduled_date.asc&limit=10`, {headers:h}).then(r=>r.json()).catch(()=>[]),
          // Open deficiencies assigned to this tech
          fetch(`${SUPABASE_URL}/rest/v1/deficiencies?company_id=eq.${cid}&assigned_to=eq.${uid}&status=not.in.(closed,verified)&select=id,title,severity,status,due_date,building_id,customer_id&order=due_date.asc.nullslast&limit=10`, {headers:h}).then(r=>r.json()).catch(()=>[]),
        ]);

        // Collect all IDs for joint lookups
        const bldIds  = [...new Set([...(rawJobs||[]),...(rawWOs||[]),...(rawDefis||[])].map(r=>r.building_id).filter(Boolean))];
        const custIds = [...new Set([...(rawJobs||[]),...(rawWOs||[]),...(rawDefis||[])].map(r=>r.customer_id).filter(Boolean))];
        const [blds, custs] = await Promise.all([
          bldIds.length  ? fetch(`${SUPABASE_URL}/rest/v1/buildings?id=in.(${bldIds.join(",")})&select=id,name`,{headers:h}).then(r=>r.json()).catch(()=>[]) : [],
          custIds.length ? fetch(`${SUPABASE_URL}/rest/v1/customers?id=in.(${custIds.join(",")})&select=id,name`,{headers:h}).then(r=>r.json()).catch(()=>[]) : [],
        ]);
        const bm = Object.fromEntries((blds||[]).map(b=>[b.id,b]));
        const cm = Object.fromEntries((custs||[]).map(c=>[c.id,c]));
        const enrich = r => ({...r, building:bm[r.building_id]||null, customer:cm[r.customer_id]||null});

        setJobs((rawJobs||[]).map(enrich));
        setWos((rawWOs||[]).map(enrich));
        setDefis((rawDefis||[]).map(enrich));
      } catch(e) { console.error(e); }
      finally { setLoading(false); }
    })();
  }, [uid, cid]);

  const tradeColor  = { fire_alarm:"FF4500", sprinkler:"3B82F6", extinguisher:"22C55E", special_hazard:"F59E0B", fire_door:"8B5CF6", backflow:"06B6D4", facilities:"6B7280" };
  const sevColor    = { critical:"EF4444", high:"F59E0B", medium:"3B82F6", low:"22C55E" };
  const sevLabel    = { critical:t("sev_critical"), high:t("sev_high"), medium:t("sev_medium"), low:t("sev_low") };
  const statusColor = { open:"EF4444", assigned:"F59E0B", in_progress:"3B82F6", completed:"22C55E" };
  const statusLabel = { open:"Ouvert", assigned:"Assigné", in_progress:"En cours", completed:"Terminé", quoted:"Devis", in_repair:"En réparation", repaired:"Réparé", verified:"Vérifié", closed:"Fermé" };
  const prioColor   = { low:"22C55E", normal:"3B82F6", high:"F59E0B", emergency:"EF4444" };
  const today       = new Date().toLocaleDateString("fr-FR",{weekday:"long",day:"numeric",month:"long"});
  const now         = new Date().getHours();
  const greeting    = now < 12 ? t("greeting_morning") : now < 18 ? t("greeting_afternoon") : t("greeting_evening");

  const SectionHeader = ({icon, title, count, color="FF4500"}) => (
    <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}>
      <div style={{width:32,height:32,borderRadius:8,background:`#${color}18`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,flexShrink:0}}>{icon}</div>
      <div style={{fontSize:14,fontWeight:700,color:C.white}}>{title}</div>
      <div style={{marginLeft:"auto",background:`#${color}20`,color:`#${color}`,padding:"2px 10px",borderRadius:20,fontSize:11,fontWeight:700}}>{count}</div>
    </div>
  );

  const EmptyState = ({text}) => (
    <div style={{padding:"20px 0",textAlign:"center",color:C.steel,fontSize:13}}>✓ {text}</div>
  );

  return (
    <div className="fade-in" style={{padding:24,display:"flex",flexDirection:"column",gap:20}}>

      {/* Welcome banner */}
      <div style={{background:`linear-gradient(135deg,#FF450018,${C.ash})`,border:"1px solid #FF450025",borderRadius:12,padding:"20px 24px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <div>
          <h2 style={{fontFamily:"Syne,sans-serif",fontSize:22,fontWeight:700,color:C.white}}>
            {greeting}, {(user?.full_name||"").split(" ")[0]} 👷
          </h2>
          <div style={{fontSize:13,color:C.mist,marginTop:4,textTransform:"capitalize"}}>{today}</div>
          <div style={{marginTop:8,display:"flex",gap:8,flexWrap:"wrap"}}>
            {[
              {label:`${jobs.length} planifié${jobs.length>1?"s":""} aujourd'hui`, color:"3B82F6"},
              {label:`${wos.length} bon${wos.length>1?"s":""} actif${wos.length>1?"s":""}`, color:"F59E0B"},
              {label:`${defis.length} déficience${defis.length>1?"s":""} à traiter`, color:"EF4444"},
            ].map(s=>(
              <span key={s.label} style={{fontSize:11,fontWeight:600,padding:"3px 10px",borderRadius:20,background:`#${s.color}18`,color:`#${s.color}`,border:`1px solid #${s.color}30`}}>{s.label}</span>
            ))}
          </div>
        </div>
        <div style={{fontSize:56,opacity:.15,userSelect:"none"}}>🔥</div>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20,alignItems:"start"}}>

        {/* TODAY'S SCHEDULE */}
        <div style={{background:C.ash,borderRadius:12,padding:20,border:`1px solid ${C.smoke}`}}>
          <SectionHeader icon="📅" title={t("scheduled_today")} count={jobs.length} color="3B82F6"/>
          {loading ? <div style={{color:C.mist,fontSize:12,padding:"12px 0"}}>Chargement…</div> :
           jobs.length === 0 ? <EmptyState text={t("nothing_today")}/> :
           jobs.map(j => {
             const col = tradeColor[j.trade] || "8A8A8A";
             return (
               <div key={j.id} style={{display:"flex",alignItems:"center",gap:12,padding:"10px 12px",borderRadius:8,background:C.coal,border:`1px solid #${col}30`,marginBottom:8,borderLeft:`3px solid #${col}`}}>
                 <div style={{flex:1,minWidth:0}}>
                   <div style={{fontSize:13,fontWeight:600,color:C.white,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{j.building?.name || j.title}</div>
                   <div style={{fontSize:11,color:C.mist,marginTop:2}}>{j.customer?.name||"—"} · {j.trade}</div>
                 </div>
                 <div style={{textAlign:"right",flexShrink:0}}>
                   <div style={{fontSize:13,fontWeight:700,color:`#${col}`}}>{j.scheduled_time?.slice(0,5)||"—"}</div>
                   <div style={{fontSize:10,color:j.status==="completed"?"#22C55E":C.mist,marginTop:2}}>{statusLabel[j.status]||j.status}</div>
                 </div>
               </div>
             );
           })
          }
        </div>

        {/* WORK ORDERS */}
        <div style={{background:C.ash,borderRadius:12,padding:20,border:`1px solid ${C.smoke}`}}>
          <SectionHeader icon="🔧" title="Mes bons de travail" count={wos.length} color="F59E0B"/>
          {loading ? <div style={{color:C.mist,fontSize:12,padding:"12px 0"}}>Chargement…</div> :
           wos.length === 0 ? <EmptyState text="Aucun bon de travail actif"/> :
           wos.map(w => {
             const pc = prioColor[w.priority] || "8A8A8A";
             const sc = statusColor[w.status] || "8A8A8A";
             return (
               <div key={w.id} style={{padding:"10px 12px",borderRadius:8,background:C.coal,border:`1px solid ${C.smoke}`,marginBottom:8}}>
                 <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:8}}>
                   <div style={{flex:1,minWidth:0}}>
                     <div style={{fontSize:12,fontWeight:600,color:C.white,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{w.title}</div>
                     <div style={{fontSize:10,color:C.mist,marginTop:2}}>{w.building?.name||"—"} · {w.work_order_number}</div>
                   </div>
                   <div style={{display:"flex",gap:5,flexShrink:0}}>
                     <span style={{fontSize:9,fontWeight:700,padding:"2px 7px",borderRadius:10,background:`#${pc}18`,color:`#${pc}`}}>{w.priority}</span>
                     <span style={{fontSize:9,fontWeight:700,padding:"2px 7px",borderRadius:10,background:`#${sc}18`,color:`#${sc}`}}>{statusLabel[w.status]||w.status}</span>
                   </div>
                 </div>
                 {w.scheduled_date && <div style={{fontSize:10,color:C.steel,marginTop:5}}>📅 {new Date(w.scheduled_date).toLocaleDateString("fr-FR")}</div>}
               </div>
             );
           })
          }
        </div>

        {/* DEFICIENCIES */}
        <div style={{background:C.ash,borderRadius:12,padding:20,border:`1px solid ${C.smoke}`,gridColumn:"1/-1"}}>
          <SectionHeader icon="⚠️" title={t("my_deficiencies")} count={defis.length} color="EF4444"/>
          {loading ? <div style={{color:C.mist,fontSize:12,padding:"12px 0"}}>Chargement…</div> :
           defis.length === 0 ? <EmptyState text={t("no_deficiencies")}/> : (
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))",gap:10}}>
              {defis.map(d => {
                const sc = sevColor[d.severity]   || "8A8A8A";
                const stc = statusColor[d.status] || "8A8A8A";
                const overdue = d.due_date && new Date(d.due_date) < new Date();
                return (
                  <div key={d.id} style={{padding:"10px 14px",borderRadius:8,background:C.coal,border:`1px solid #${sc}30`,borderLeft:`3px solid #${sc}`}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8}}>
                      <div style={{fontSize:13,fontWeight:600,color:C.white,lineHeight:1.3,flex:1}}>{d.title}</div>
                      <span style={{fontSize:9,fontWeight:700,padding:"2px 7px",borderRadius:10,background:`#${sc}18`,color:`#${sc}`,flexShrink:0}}>{sevLabel[d.severity]||d.severity}</span>
                    </div>
                    <div style={{fontSize:11,color:C.mist,marginTop:4}}>{d.building?.name||"—"} · {d.customer?.name||"—"}</div>
                    <div style={{display:"flex",alignItems:"center",gap:8,marginTop:8}}>
                      <span style={{fontSize:10,fontWeight:600,padding:"2px 8px",borderRadius:10,background:`#${stc}18`,color:`#${stc}`}}>{statusLabel[d.status]||d.status}</span>
                      {d.due_date && <span style={{fontSize:10,color:overdue?"#EF4444":C.steel}}>📅 {overdue?"⚠ ":""}{new Date(d.due_date).toLocaleDateString("fr-FR")}</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

// ─── ADMIN / MANAGER DASHBOARD ────────────────────────────────────────────────
const AdminDashboard = ({ user }) => {
  const companyId = user?.company_id;
  const { t } = useT();
  const [stats,   setStats]   = useState(null);
  const [recent,  setRecent]  = useState([]);
  const [revenue, setRevenue] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState("");
  const [reportId,setReportId]= useState(null);
  const sb = { url:SUPABASE_URL, anonKey:SUPABASE_ANON_KEY, jwt:SUPABASE_JWT };

  useEffect(() => {
    (async () => {
      setLoading(true); setError("");
      try {
        const h = { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_JWT}` };
        const countOf = url => fetch(url,{method:"HEAD",headers:{...h,"Prefer":"count=exact","Accept":"application/json"}})
          .then(r=>parseInt(r.headers.get("Content-Range")?.split("/")[1]||"0")||0).catch(()=>0);
        const today      = new Date().toISOString().split("T")[0];
        const monthStart = new Date(new Date().getFullYear(),new Date().getMonth(),1).toISOString().split("T")[0];

        const [insp,defi,inv,payments,recentRows] = await Promise.all([
          countOf(`${SUPABASE_URL}/rest/v1/inspections?company_id=eq.${companyId}&scheduled_date=eq.${today}&select=id`),
          countOf(`${SUPABASE_URL}/rest/v1/deficiencies?company_id=eq.${companyId}&status=eq.open&select=id`),
          countOf(`${SUPABASE_URL}/rest/v1/invoices?company_id=eq.${companyId}&status=in.(sent,pending,overdue)&select=id`),
          fetch(`${SUPABASE_URL}/rest/v1/payments?company_id=eq.${companyId}&status=eq.completed&paid_at=gte.${monthStart}&select=amount,paid_at`,{headers:h}).then(r=>r.json()).catch(()=>[]),
          DB.getRecentInspections(companyId),
        ]);

        const revenueMonth = (payments||[]).reduce((s,p)=>s+Number(p.amount||0),0);
        setStats({ inspectionsToday:insp, openDeficiencies:defi, pendingInvoices:inv, revenueThisMonth:revenueMonth });
        setRecent(recentRows||[]);

        const revByMonth = {};
        const allPayments = await fetch(`${SUPABASE_URL}/rest/v1/payments?company_id=eq.${companyId}&status=eq.completed&select=amount,paid_at&order=paid_at.asc`,{headers:h}).then(r=>r.json()).catch(()=>[]);
        (allPayments||[]).forEach(p => {
          if (!p.paid_at) return;
          const d = new Date(p.paid_at);
          const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
          revByMonth[key] = (revByMonth[key]||0) + Number(p.amount||0);
        });
        const months = [];
        for (let i=5; i>=0; i--) {
          const d = new Date(); d.setMonth(d.getMonth()-i);
          const key  = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
          const label = d.toLocaleDateString("fr-FR",{month:"short"});
          months.push({ key, label, value: revByMonth[key]||0 });
        }
        setRevenue(months);
      } catch(e) { setError(e.message); } finally { setLoading(false); }
    })();
  }, [companyId]);

  const cur = localStorage.getItem("fsCurrency")||"MAD";
  const fmt = n => Number(n||0).toLocaleString("fr-FR",{minimumFractionDigits:0,maximumFractionDigits:0});
  const statusColor = { scheduled:"default", in_progress:"info", completed:"success", deficient:"danger", cancelled:"default" };
  const tradeLabel  = { fire_alarm:"Alarme", sprinkler:"Sprinkleur", extinguisher:"Extincteur", special_hazard:"Risque spécial", fire_door:"Porte CF", backflow:"Anti-retour", facilities:"Installations" };
  const maxRev = Math.max(...revenue.map(m=>m.value), 1);

  return (
    <div className="fade-in" style={{ padding:24, display:"flex", flexDirection:"column", gap:20 }}>

      <div style={{ background:`linear-gradient(135deg,${C.flame}22,${C.ash})`, border:`1px solid ${C.flame}25`, borderRadius:12, padding:"20px 24px", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <div>
          <h2 style={{ fontFamily:"Syne,sans-serif", fontSize:20, fontWeight:700, color:C.white }}>
            Bonjour, {(user?.full_name||"").split(" ")[0] || "—"} 👋
          </h2>
          <p style={{ fontSize:13, color:C.mist, marginTop:4 }}>
            {new Date().toLocaleDateString("fr-FR",{weekday:"long",day:"numeric",month:"long",year:"numeric"})}
          </p>
        </div>
        <div style={{ display:"flex", gap:10 }}>
          <Btn variant="secondary" icon="calendar" size="sm">Planifier</Btn>
          <Btn icon="plus" size="sm">{t("new_inspection")}</Btn>
        </div>
      </div>

      {error && <ErrorBanner msg={`Erreur de chargement: ${error}`}/>}

      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:16 }}>
        {[
          { label:t("todays_inspections"), value:stats?.inspectionsToday??0,   icon:"📋", color:C.flame  },
          { label:t("open_deficiencies"),    value:stats?.openDeficiencies??0,   icon:"🔴", color:C.danger },
          { label:t("pending_invoices"),     value:stats?.pendingInvoices??0,    icon:"📄", color:C.warn   },
          { label:`Revenus ce mois (${cur})`,value:fmt(stats?.revenueThisMonth), icon:"💰", color:C.safe   },
        ].map(s=>(
          <Card key={s.label} style={{ padding:18 }}>
            <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between" }}>
              <div>
                <div style={{ fontSize:11, color:C.mist, marginBottom:8 }}>{s.label}</div>
                <div style={{ fontSize:26, fontWeight:800, fontFamily:"Syne,sans-serif", color:s.color, lineHeight:1 }}>
                  {loading?"—":s.value}
                </div>
              </div>
              <div style={{ width:40, height:40, borderRadius:10, background:`${s.color}18`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:18 }}>{s.icon}</div>
            </div>
          </Card>
        ))}
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }}>
        <Card style={{ padding:0, overflow:"hidden" }}>
          <div style={{ padding:"16px 20px", borderBottom:`1px solid ${C.smoke}`, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
            <h3 style={{ fontFamily:"Syne,sans-serif", fontSize:14, fontWeight:700 }}>💰 Revenus — 6 derniers mois</h3>
            <span style={{ fontSize:11, color:C.mist }}>{cur}</span>
          </div>
          <div style={{ padding:"20px 20px 12px" }}>
            {revenue.length === 0 || loading ? (
              <div style={{ height:120, display:"flex", alignItems:"center", justifyContent:"center", color:C.steel, fontSize:12 }}>Chargement...</div>
            ) : (
              <>
                <div style={{ display:"flex", alignItems:"flex-end", gap:8, height:120, marginBottom:8 }}>
                  {revenue.map((m,i)=>{
                    const h = maxRev > 0 ? Math.max((m.value/maxRev)*110, m.value>0?8:2) : 2;
                    const isLast = i === revenue.length-1;
                    return (
                      <div key={m.key} style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:4 }}>
                        <div style={{ fontSize:9, color:m.value>0?C.frost:C.steel, fontWeight:600, marginBottom:2 }}>{m.value>0 ? fmt(m.value) : ""}</div>
                        <div style={{ width:"100%", height:h, background:isLast?C.flame:`${C.flame}50`, borderRadius:"4px 4px 0 0", transition:"height 0.5s ease", minHeight:2 }}/>
                      </div>
                    );
                  })}
                </div>
                <div style={{ display:"flex", gap:8 }}>
                  {revenue.map((m,i)=>(
                    <div key={m.key} style={{ flex:1, textAlign:"center", fontSize:10, color:i===revenue.length-1?C.frost:C.mist, fontWeight:i===revenue.length-1?600:400 }}>{m.label}</div>
                  ))}
                </div>
              </>
            )}
          </div>
        </Card>

        <Card style={{ padding:0, overflow:"hidden" }}>
          <div style={{ padding:"16px 20px", borderBottom:`1px solid ${C.smoke}` }}>
            <h3 style={{ fontFamily:"Syne,sans-serif", fontSize:14, fontWeight:700 }}>📊 Statut des inspections</h3>
          </div>
          <div style={{ padding:16 }}>
            {loading ? (
              <div style={{ height:120, display:"flex", alignItems:"center", justifyContent:"center", color:C.steel, fontSize:12 }}>Chargement...</div>
            ) : (() => {
              const counts = (recent||[]).reduce((acc,r) => { acc[r.status]=(acc[r.status]||0)+1; return acc; }, {});
              const items  = [
                { label:t("status_completed"), key:"completed",   color:C.safe   },
                { label:"En cours",    key:"in_progress", color:C.info   },
                { label:t("status_scheduled"), key:"scheduled",   color:C.mist   },
                { label:t("status_deficient"), key:"deficient",   color:C.danger },
              ];
              const total = Object.values(counts).reduce((s,n)=>s+n,0)||1;
              return (
                <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                  {items.map(it=>{
                    const n = counts[it.key]||0;
                    const pct = Math.round((n/total)*100);
                    return (
                      <div key={it.key} style={{ display:"flex", alignItems:"center", gap:10 }}>
                        <div style={{ width:10, height:10, borderRadius:2, background:it.color, flexShrink:0 }}/>
                        <div style={{ fontSize:12, color:C.frost, width:90 }}>{it.label}</div>
                        <div style={{ flex:1, height:6, background:C.smoke, borderRadius:3, overflow:"hidden" }}>
                          <div style={{ height:"100%", width:`${pct}%`, background:it.color, borderRadius:3, transition:"width 0.5s ease" }}/>
                        </div>
                        <div style={{ fontSize:11, color:C.mist, width:30, textAlign:"right" }}>{n}</div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        </Card>
      </div>

      {/* Report PDF overlay */}
      {reportId && (
        <InspectionReportPDF inspectionId={reportId} supabase={sb} onClose={()=>setReportId(null)}/>
      )}

      <Card style={{ padding:0 }}>
        <div style={{ padding:"16px 20px", borderBottom:`1px solid ${C.smoke}`, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <h3 style={{ fontFamily:"Syne,sans-serif", fontSize:14, fontWeight:700 }}>{t("recent_inspections")}</h3>
          <Btn variant="ghost" size="sm">Voir tout</Btn>
        </div>
        <Table
          loading={loading}
          data={recent||[]}
          emptyIcon="clipboard" emptyTitle={t("empty_inspections")} emptyText={t("empty_hint")}
          columns={[
            { key:"building",    label:t("col_building"),   render:(_,r)=>r.building?.name||"—" },
            { key:"trade",       label:"Type",        render:v=><Badge type="default">{tradeLabel[v]||v}</Badge> },
            { key:"technician",  label:t("col_technician"),  render:(_,r)=><div style={{display:"flex",alignItems:"center",gap:8}}><Avatar name={r.technician?.full_name||"?"} size={22}/><span style={{fontSize:12}}>{r.technician?.full_name||"—"}</span></div> },
            { key:"status",      label:t("col_status"),      render:v=><Badge type={statusColor[v]||"default"}>{({scheduled:t("status_scheduled"),in_progress:t("status_in_progress"),completed:t("status_completed"),deficient:t("status_deficient"),cancelled:t("status_cancelled")})[v]||v}</Badge> },
            { key:"score",       label:t("col_score"),       align:"center", render:v=>v!=null?<span style={{fontWeight:700,color:v>=80?C.safe:v>=60?C.warn:C.danger}}>{v}%</span>:<span style={{color:C.steel}}>—</span> },
            { key:"scheduled_date", label:t("col_date"),     render:v=>v?<span style={{fontSize:11,color:C.mist}}>{new Date(v).toLocaleDateString("fr-FR")}</span>:<span style={{color:C.steel}}>—</span> },
            { key:"id", label:t("col_report"), align:"center",
              render:(_,r) => (
                <button onClick={()=>setReportId(r.id)}
                  style={{padding:"3px 9px",borderRadius:5,border:`1px solid ${C.flame}40`,
                    background:`${C.flame}12`,color:C.flame,fontSize:11,fontWeight:600,
                    cursor:"pointer",fontFamily:"inherit",whiteSpace:"nowrap"}}
                  onMouseEnter={e=>e.currentTarget.style.background=`${C.flame}28`}
                  onMouseLeave={e=>e.currentTarget.style.background=`${C.flame}12`}>
                  🖨 PDF
                </button>
              )
            },
          ]}
        />
      </Card>
    </div>
  );
};

// ─── DASHBOARD ROUTER — switches by role ──────────────────────────────────────
const DashboardPage = ({ user }) => {
  if (user?.role === "technician") return <TechnicianDashboard user={user}/>;
  return <AdminDashboard user={user}/>;
};


// ─── INSPECTIONS ──────────────────────────────────────────────────────────────
const InspectionsPage = ({ user }) => {
  const { t } = useT();
  const [filter,    setFilter]    = useState("all");
  const [reportId,  setReportId]  = useState(null);
  const [editRow,   setEditRow]   = useState(null);   // inspection being edited
  const [deleteRow, setDeleteRow] = useState(null);   // inspection pending delete
  const [saving,    setSaving]    = useState(false);
  const [deleting,  setDeleting]  = useState(false);
  const [editForm,  setEditForm]  = useState({});

  const techId = user.role === "technician" ? user.id : null;
  const { data, loading, error, refetch } = useQuery(() => DB.getInspections(user.company_id, filter, techId), [user.company_id, filter, techId]);
  const statusColor = { scheduled:"default", in_progress:"info", completed:"success", deficient:"danger", cancelled:"default" };
  const filters = ["all","scheduled","in_progress","completed","deficient"];
  const counts  = (data||[]).reduce((acc,i) => { acc[i.status]=(acc[i.status]||0)+1; return acc; }, {});
  const sb      = { url:SUPABASE_URL, anonKey:SUPABASE_ANON_KEY, jwt:SUPABASE_JWT };

  const STATUS_OPTIONS = ["scheduled","in_progress","completed","deficient","cancelled"];
  const STATUS_FR = { scheduled:t("status_scheduled"), in_progress:t("status_in_progress"), completed:t("status_completed"), deficient:t("status_deficient"), cancelled:t("status_cancelled") };
  const TRADE_OPTIONS = ["fire_alarm","sprinkler","extinguisher","special_hazard","fire_door","backflow","facilities"];
  const TRADE_FR = { fire_alarm:"Alarme incendie", sprinkler:"Sprinkleur", extinguisher:"Extincteurs", special_hazard:"Risques spéciaux", fire_door:"Portes coupe-feu", backflow:"Anti-retour", facilities:"Installations" };

  const openEdit = (r) => {
    setEditForm({
      status:         r.status || "scheduled",
      scheduled_date: r.scheduled_date || "",
      trade:          r.trade || "fire_alarm",
      score:          r.score ?? "",
      notes:          r.notes || "",
    });
    setEditRow(r);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await fetch(`${SUPABASE_URL}/rest/v1/inspections?id=eq.${editRow.id}`, {
        method:"PATCH",
        headers:{ ...sbHeaders(), "Prefer":"return=representation" },
        body: JSON.stringify({
          status:         editForm.status,
          scheduled_date: editForm.scheduled_date || null,
          trade:          editForm.trade,
          score:          editForm.score !== "" ? Number(editForm.score) : null,
          notes:          editForm.notes || null,
        }),
      });
      setEditRow(null);
      refetch();
    } catch(e) { alert("Erreur: " + e.message); }
    setSaving(false);
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await fetch(`${SUPABASE_URL}/rest/v1/inspections?id=eq.${deleteRow.id}`, {
        method:"DELETE", headers: sbHeaders(),
      });
      setDeleteRow(null);
      refetch();
    } catch(e) { alert("Erreur: " + e.message); }
    setDeleting(false);
  };

  const inp = (field, type="text") => ({
    value: editForm[field] ?? "",
    onChange: e => setEditForm(f => ({ ...f, [field]: e.target.value })),
    type,
    style: { width:"100%", padding:"9px 12px", background:C.smoke, border:`1px solid ${C.steel}`,
      borderRadius:6, color:C.white, fontSize:13, fontFamily:"inherit", boxSizing:"border-box" },
  });

  return (
    <div className="fade-in" style={{ padding:24, display:"flex", flexDirection:"column", gap:20 }}>

      {/* PDF overlay */}
      {reportId && <InspectionReportPDF inspectionId={reportId} supabase={sb} onClose={()=>setReportId(null)}/>}

      {/* ── EDIT MODAL ── */}
      {editRow && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.7)", zIndex:9000, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
          <div style={{ background:C.ash, border:`1px solid ${C.smoke}`, borderRadius:12, width:"100%", maxWidth:480, padding:24, display:"flex", flexDirection:"column", gap:16 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <h3 style={{ fontFamily:"Syne,sans-serif", fontSize:16, fontWeight:700 }}>{t("edit_inspection")}</h3>
              <button onClick={()=>setEditRow(null)} style={{ background:"none", border:"none", color:C.mist, fontSize:20, cursor:"pointer" }}>×</button>
            </div>
            <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
              {/* Status */}
              <div>
                <div style={{ fontSize:11, color:C.mist, marginBottom:5, textTransform:"uppercase", letterSpacing:"0.05em" }}>Statut</div>
                <select value={editForm.status} onChange={e=>setEditForm(f=>({...f,status:e.target.value}))}
                  style={{ ...inp("status").style }}>
                  {STATUS_OPTIONS.map(s=><option key={s} value={s}>{STATUS_FR[s]}</option>)}
                </select>
              </div>
              {/* Trade */}
              <div>
                <div style={{ fontSize:11, color:C.mist, marginBottom:5, textTransform:"uppercase", letterSpacing:"0.05em" }}>{t("edit_trade")}</div>
                <select value={editForm.trade} onChange={e=>setEditForm(f=>({...f,trade:e.target.value}))}
                  style={{ ...inp("trade").style }}>
                  {TRADE_OPTIONS.map(t=><option key={t} value={t}>{TRADE_FR[t]||t}</option>)}
                </select>
              </div>
              {/* Date */}
              <div>
                <div style={{ fontSize:11, color:C.mist, marginBottom:5, textTransform:"uppercase", letterSpacing:"0.05em" }}>{t("edit_date")}</div>
                <input {...inp("scheduled_date","date")}/>
              </div>
              {/* Score */}
              <div>
                <div style={{ fontSize:11, color:C.mist, marginBottom:5, textTransform:"uppercase", letterSpacing:"0.05em" }}>{t("edit_score")}</div>
                <input {...inp("score","number")} placeholder="0–100"/>
              </div>
              {/* Notes */}
              <div>
                <div style={{ fontSize:11, color:C.mist, marginBottom:5, textTransform:"uppercase", letterSpacing:"0.05em" }}>Notes</div>
                <textarea value={editForm.notes} onChange={e=>setEditForm(f=>({...f,notes:e.target.value}))} rows={3}
                  style={{ ...inp("notes").style, resize:"vertical" }}/>
              </div>
            </div>
            <div style={{ display:"flex", gap:10, marginTop:4 }}>
              <Btn variant="secondary" onClick={()=>setEditRow(null)} style={{ flex:1 }}>{t("btn_cancel")}</Btn>
              <Btn onClick={handleSave} disabled={saving} style={{ flex:2 }}>
                {saving ? t("btn_saving") : t("btn_save")}
              </Btn>
            </div>
          </div>
        </div>
      )}

      {/* ── DELETE CONFIRM MODAL ── */}
      {deleteRow && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.7)", zIndex:9000, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
          <div style={{ background:C.ash, border:`1px solid ${C.danger}40`, borderRadius:12, width:"100%", maxWidth:400, padding:24, display:"flex", flexDirection:"column", gap:16 }}>
            <h3 style={{ fontFamily:"Syne,sans-serif", fontSize:16, fontWeight:700, color:C.danger }}>{t("delete_title")}</h3>
            <p style={{ color:C.mist, fontSize:13, lineHeight:1.6 }}>
              {t("delete_body")} L'inspection de{" "}
              <strong style={{color:C.white}}>{deleteRow.building?.name||"ce bâtiment"}</strong> du{" "}
              <strong style={{color:C.white}}>{deleteRow.scheduled_date ? new Date(deleteRow.scheduled_date).toLocaleDateString("fr-FR") : "—"}</strong>{" "}
              sera définitivement supprimée.
            </p>
            <div style={{ display:"flex", gap:10 }}>
              <Btn variant="secondary" onClick={()=>setDeleteRow(null)} style={{ flex:1 }}>{t("btn_cancel")}</Btn>
              <button onClick={handleDelete} disabled={deleting}
                style={{ flex:1, padding:"9px", borderRadius:6, border:"none", background:C.danger,
                  color:"#fff", fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:"inherit",
                  opacity:deleting?0.6:1 }}>
                {deleting ? t("btn_deleting") : t("btn_delete")}
              </button>
            </div>
          </div>
        </div>
      )}

      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <div style={{ display:"flex", gap:4, background:C.ash, border:`1px solid ${C.smoke}`, borderRadius:8, padding:4 }}>
          {filters.map(f => (
            <button key={f} onClick={()=>setFilter(f)} style={{ padding:"6px 14px", borderRadius:6, border:"none", background:filter===f?C.flame:"transparent", color:filter===f?"#fff":C.mist, fontSize:12, fontWeight:500, cursor:"pointer", transition:"all 0.12s" }}>
              {f==="all"?t("filter_all"):STATUS_FR[f]||f}
            </button>
          ))}
        </div>
        <Btn icon="plus" size="sm">{t("new_inspection")}</Btn>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:12 }}>
        {[
          {label:t("status_completed"),   key:"completed",   color:C.safe},
          {label:t("status_in_progress"),   key:"in_progress", color:C.info},
          {label:t("status_scheduled"),  key:"scheduled",   color:C.mist},
          {label:t("status_deficient"), key:"deficient",   color:C.danger},
        ].map(s=>(
          <Card key={s.key} style={{padding:14,textAlign:"center"}}>
            <div style={{fontSize:24,fontWeight:800,fontFamily:"Syne,sans-serif",color:s.color}}>{loading?"—":counts[s.key]||0}</div>
            <div style={{fontSize:11,color:C.mist,marginTop:4}}>{s.label}</div>
          </Card>
        ))}
      </div>

      {error && <ErrorBanner msg={error} onRetry={refetch}/>}

      <Card style={{ padding:0 }}>
        <Table loading={loading} data={data||[]}
          emptyIcon="clipboard" emptyTitle={t("empty_inspections")} emptyText={t("empty_hint")}
          columns={[
            { key:"building",       label:t("col_building"),   render:(_,r)=>r.building?.name||"—" },
            { key:"customer",       label:t("col_customer"),     render:(_,r)=><span style={{fontSize:12,color:C.mist}}>{r.customer?.name||"—"}</span> },
            { key:"trade",          label:t("col_trade"), render:v=><Badge type="default">{TRADE_FR[v]||v?.replace(/_/g," ")}</Badge> },
            { key:"technician",     label:t("col_technician"), render:(_,r)=><div style={{display:"flex",alignItems:"center",gap:8}}><Avatar name={r.technician?.full_name||"?"} size={22}/><span style={{fontSize:12}}>{r.technician?.full_name||"—"}</span></div> },
            { key:"status",         label:t("col_status"),     render:v=><Badge type={statusColor[v]||"default"}>{STATUS_FR[v]||v}</Badge> },
            { key:"score",          label:t("col_score"),      align:"center", render:v=>v!=null?<span style={{fontWeight:700,color:v>=80?C.safe:v>=60?C.warn:C.danger}}>{v}%</span>:<span style={{color:C.steel}}>—</span> },
            { key:"scheduled_date", label:t("col_date"),       render:v=>v?<span style={{fontSize:11,color:C.mist}}>{new Date(v).toLocaleDateString("fr-FR")}</span>:<span style={{color:C.steel}}>—</span> },
            { key:"id", label:t("col_actions"), align:"center",
              render:(_,r) => (
                <div style={{ display:"flex", gap:6, justifyContent:"center" }}>
                  {/* PDF */}
                  <button onClick={()=>setReportId(r.id)} title="Rapport PDF"
                    style={{ padding:"4px 8px", borderRadius:5, border:`1px solid ${C.flame}40`,
                      background:`${C.flame}12`, color:C.flame, fontSize:11, fontWeight:600,
                      cursor:"pointer", fontFamily:"inherit" }}>
                    🖨
                  </button>
                  {/* Edit — admin/owner/office_staff only */}
                  {user.role !== "technician" && <button onClick={()=>openEdit(r)} title="Modifier"
                    style={{ padding:"4px 8px", borderRadius:5, border:`1px solid ${C.info}40`,
                      background:`${C.info}12`, color:C.info, fontSize:11, fontWeight:600,
                      cursor:"pointer", fontFamily:"inherit" }}>
                    ✏️
                  </button>}
                  {/* Delete — admin/owner only */}
                  {(user.role === "owner" || user.role === "admin") && <button onClick={()=>setDeleteRow(r)} title="Supprimer"
                    style={{ padding:"4px 8px", borderRadius:5, border:`1px solid ${C.danger}40`,
                      background:`${C.danger}12`, color:C.danger, fontSize:11, fontWeight:600,
                      cursor:"pointer", fontFamily:"inherit" }}>
                    🗑
                  </button>}
                </div>
              )
            },
          ]}
        />
      </Card>
    </div>
  );
};

// ─── DEFICIENCIES ─────────────────────────────────────────────────────────────
const DeficienciesPage = ({ user }) => {
  const { t } = useT();
  const [filter, setFilter] = useState("all");
  const techId = user.role === "technician" ? user.id : null;
  const { data, loading, error, refetch } = useQuery(() => DB.getDeficiencies(user.company_id, filter, techId), [user.company_id, filter, techId]);

  const sevColor  = { critical:"danger", high:"warning", medium:"info", low:"default" };
  const statColor = { open:"danger", quoted:"warning", in_repair:"info", repaired:"success", verified:"success", closed:"default" };
  const filters   = ["all","open","quoted","in_repair","repaired","verified"];
  const counts    = (data||[]).reduce((acc,d) => { acc[d.status]=(acc[d.status]||0)+1; return acc; }, {});

  return (
    <div className="fade-in" style={{ padding:24, display:"flex", flexDirection:"column", gap:20 }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <div style={{ display:"flex", gap:4, background:C.ash, border:`1px solid ${C.smoke}`, borderRadius:8, padding:4 }}>
          {filters.map(f=>(
            <button key={f} onClick={()=>setFilter(f)} style={{ padding:"6px 14px", borderRadius:6, border:"none", background:filter===f?C.flame:"transparent", color:filter===f?"#fff":C.mist, fontSize:12, fontWeight:500, cursor:"pointer", transition:"all 0.12s" }}>
              {f==="all"?t("filter_all"):({scheduled:t("status_scheduled"),in_progress:t("status_in_progress"),completed:t("status_completed"),deficient:t("status_deficient")})[f]||f}
            </button>
          ))}
        </div>
        {user.role !== "technician" && <Btn icon="plus" size="sm">{t("report_deficiency")}</Btn>}
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:12 }}>
        {[{label:t("status_open"),key:"open",color:C.danger},{label:t("status_quoted"),key:"quoted",color:C.warn},{label:t("status_repaired"),key:"repaired",color:C.safe},{label:t("status_verified"),key:"verified",color:C.info}].map(s=>(
          <Card key={s.key} style={{padding:14,textAlign:"center"}}>
            <div style={{fontSize:24,fontWeight:800,fontFamily:"Syne,sans-serif",color:s.color}}>{loading?"—":counts[s.key]||0}</div>
            <div style={{fontSize:11,color:C.mist,marginTop:4}}>{s.label}</div>
          </Card>
        ))}
      </div>

      {error && <ErrorBanner msg={error} onRetry={refetch}/>}

      <Card style={{ padding:0 }}>
        <Table loading={loading} data={data||[]}
          emptyIcon="alert" emptyTitle={t("no_deficiencies_found")} emptyText={t("all_clear")}
          columns={[
            { key:"title",      label:"Problème",      render:v=><span style={{fontSize:12,color:C.frost}}>{v}</span> },
            { key:"building",   label:t("col_building"),   render:(_,r)=>r.building?.name||"—" },
            { key:"severity",   label:t("col_severity"),   render:v=><Badge type={sevColor[v]||"default"}>{v}</Badge> },
            { key:"status",     label:t("col_status"),     render:v=>{const fr={
  scheduled:t("status_scheduled"), in_progress:t("status_in_progress"), completed:t("status_completed"),
  deficient:"Déficiente", cancelled:"Annulée",
  open:t("status_open"), quoted:t("status_quoted"), in_repair:t("status_in_repair"), repaired:t("status_repaired"), verified:t("status_verified"), closed:"Clôturé",
  draft:"Brouillon", sent:"Envoyée", pending:"En attente", paid:"Payée", overdue:"En retard", void:"Annulée"
}; return <Badge type={statColor[v]||"default"}>{fr[v]||v?.replace("_"," ")}</Badge>;} },
            { key:"assignee",   label:"Assigné",   render:(_,r)=>r.assignee?<div style={{display:"flex",alignItems:"center",gap:6}}><Avatar name={r.assignee.full_name} size={20}/><span style={{fontSize:12}}>{r.assignee.full_name}</span></div>:<span style={{color:C.steel}}>Non assigné</span> },
            { key:"nfpa_reference", label:"NFPA",   render:v=>v?<span style={{fontSize:11,color:C.mist,fontFamily:"monospace"}}>{v}</span>:<span style={{color:C.steel}}>—</span> },
            { key:"identified_at",  label:"Signalé", render:v=><span style={{fontSize:11,color:C.mist}}>{new Date(v).toLocaleDateString()}</span> },
          ]}
        />
      </Card>
    </div>
  );
};

// ─── CUSTOMERS ────────────────────────────────────────────────────────────────
const CustomersPage = ({ user }) => {
  const { t } = useT();
  const { data, loading, error, refetch } = useQuery(() => DB.getCustomers(user.company_id), [user.company_id]);
  const [search, setSearch] = useState("");
  const filtered = (data||[]).filter(c => c.name.toLowerCase().includes(search.toLowerCase()) || (c.contact_name||"").toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="fade-in" style={{ padding:24, display:"flex", flexDirection:"column", gap:20 }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <div style={{ position:"relative" }}>
          <Icon name="search" size={14} color={C.mist} style={{ position:"absolute", left:10, top:"50%", transform:"translateY(-50%)" }}/>
          <input placeholder="Rechercher un client..." value={search} onChange={e=>setSearch(e.target.value)}
            style={{ background:C.smoke, border:`1px solid ${C.steel}`, borderRadius:6, padding:"8px 12px 8px 32px", fontSize:12, color:C.frost, width:260 }}
            onFocus={e=>e.target.style.borderColor=C.flame} onBlur={e=>e.target.style.borderColor=C.steel}/>
        </div>
        <Btn icon="plus">Ajouter un client</Btn>
      </div>

      {error && <ErrorBanner msg={error} onRetry={refetch}/>}

      <Card style={{ padding:0 }}>
        <Table loading={loading} data={filtered}
          emptyIcon="users" emptyTitle="Aucun client pour l'instant" emptyText="Ajoutez votre premier client pour commencer."
          columns={[
            { key:"name", label:"Entreprise", render:(v,r)=>(
              <div style={{display:"flex",alignItems:"center",gap:10}}>
                <div style={{width:32,height:32,borderRadius:8,background:`${C.flame}18`,display:"flex",alignItems:"center",justifyContent:"center"}}><Icon name="building" size={16} color={C.flame}/></div>
                <div>
                  <div style={{fontWeight:600,color:C.white,fontSize:13}}>{v}</div>
                  <div style={{fontSize:11,color:C.mist}}>{r.email||"—"}</div>
                </div>
              </div>
            )},
            { key:"contact_name",  label:"Contact",   render:v=>v||<span style={{color:C.steel}}>—</span> },
            { key:"buildings",     label:"Bâtiments", align:"center", render:v=><span style={{background:C.smoke,padding:"2px 10px",borderRadius:12,fontSize:12}}>{v?.length||0}</span> },
            { key:"is_active",     label:t("col_status"),    render:v=><Badge type={v?"success":"default"}>{v?"Actif":"Inactif"}</Badge> },
            { key:"id",            label:"",          render:()=><div style={{display:"flex",gap:6}}><Btn variant="ghost" size="sm" icon="eye">Voir</Btn><Btn variant="secondary" size="sm">Planifier</Btn></div> },
          ]}
        />
      </Card>
    </div>
  );
};

// ─── INVOICES ─────────────────────────────────────────────────────────────────
// ── Mini Create Invoice Modal ──────────────────────────────────────────────────
const CreateInvoiceModal = ({ user, onClose, onCreated }) => {
  const { t } = useT();
  const cid = user?.company_id;
  const [customers,  setCustomers]  = useState([]);
  const [buildings,  setBuildings]  = useState([]);
  const [lines,      setLines]      = useState([{ description:"", quantity:"1", unit_price:"" }]);
  const [form,       setForm]       = useState({ customer_id:"", building_id:"", status:"draft", tax_rate:"20", discount:"0", notes:"", terms:"", due_date:"", issue_date: new Date().toISOString().split("T")[0] });
  const [saving,     setSaving]     = useState(false);
  const [err,        setErr]        = useState("");

  useEffect(() => {
    const h = { apikey:SUPABASE_ANON_KEY, Authorization:`Bearer ${SUPABASE_JWT}` };
    Promise.all([
      fetch(`${SUPABASE_URL}/rest/v1/customers?company_id=eq.${cid}&is_active=eq.true&select=id,name&order=name.asc`,{headers:h}).then(r=>r.json()).catch(()=>[]),
      fetch(`${SUPABASE_URL}/rest/v1/buildings?company_id=eq.${cid}&select=id,name,customer_id&order=name.asc`,{headers:h}).then(r=>r.json()).catch(()=>[]),
    ]).then(([c,b]) => { setCustomers(c||[]); setBuildings(b||[]); });
  }, [cid]);

  const filteredBuildings = buildings.filter(b => !form.customer_id || b.customer_id === form.customer_id);
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value, ...(k==="customer_id"?{building_id:""}:{}) }));
  const setLine = (i,k) => e => setLines(ls => ls.map((l,idx) => idx===i ? {...l,[k]:e.target.value} : l));
  const addLine  = () => setLines(ls => [...ls, { description:"", quantity:"1", unit_price:"" }]);
  const removeLine = i => setLines(ls => ls.filter((_,idx)=>idx!==i));

  const subtotal = lines.reduce((s,l)=>s+Number(l.quantity||0)*Number(l.unit_price||0),0);
  const taxAmt   = subtotal * (Number(form.tax_rate||0)/100);
  const total    = subtotal + taxAmt - Number(form.discount||0);
  const cur      = localStorage.getItem("fsCurrency")||"MAD";
  const fmt      = n => Number(n||0).toLocaleString("fr-FR",{minimumFractionDigits:2}) + " " + cur;

  const genNumber = () => {
    const d = new Date();
    return `FA${String(d.getFullYear()).slice(2)}${String(d.getMonth()+1).padStart(2,"0")}-${String(Math.floor(Math.random()*9000)+1000)}`;
  };

  const handleSave = async () => {
    if (!form.customer_id)             return setErr("Sélectionnez un client");
    if (!form.building_id)             return setErr("Sélectionnez un bâtiment");
    if (lines.every(l=>!l.description)) return setErr("Ajoutez au moins une ligne");
    setSaving(true); setErr("");
    const h = { "Content-Type":"application/json", apikey:SUPABASE_ANON_KEY, Authorization:`Bearer ${SUPABASE_JWT}`, Prefer:"return=representation" };
    try {
      const invBody = { company_id:cid, customer_id:form.customer_id, building_id:form.building_id, invoice_number:genNumber(), status:form.status, issue_date:form.issue_date, due_date:form.due_date||null, subtotal, tax_rate:Number(form.tax_rate)/100, tax_amount:taxAmt, discount:Number(form.discount||0), total, notes:form.notes, terms:form.terms, created_by:user.id };
      const invRes  = await fetch(`${SUPABASE_URL}/rest/v1/invoices`, { method:"POST", headers:h, body:JSON.stringify(invBody) });
      const invData = await invRes.json();
      if (!invRes.ok) throw new Error(invData.message||JSON.stringify(invData));
      const invoice = Array.isArray(invData) ? invData[0] : invData;
      // Insert line items
      const validLines = lines.filter(l=>l.description&&l.unit_price);
      if (validLines.length>0) {
        await fetch(`${SUPABASE_URL}/rest/v1/invoice_line_items`, { method:"POST", headers:h, body:JSON.stringify(validLines.map((l,i)=>({ invoice_id:invoice.id, description:l.description, quantity:Number(l.quantity||1), unit_price:Number(l.unit_price), order_index:i }))) });
      }
      onCreated(); onClose();
    } catch(e) { setErr(e.message); setSaving(false); }
  };

  const inputStyle = { background:C.smoke, border:`1px solid ${C.steel}`, borderRadius:6, padding:"8px 12px", fontSize:12, color:C.white, fontFamily:"inherit" };
  const labelStyle = { fontSize:11, fontWeight:500, color:C.frost };

  return (
    <div style={{ position:"fixed", inset:0, zIndex:3000, background:"rgba(0,0,0,0.75)", display:"flex", alignItems:"center", justifyContent:"center", padding:20 }}>
      <div style={{ background:C.ash, borderRadius:12, width:"100%", maxWidth:680, border:`1px solid ${C.smoke}`, maxHeight:"94vh", overflow:"hidden", display:"flex", flexDirection:"column" }}>
        <div style={{ padding:"18px 24px", borderBottom:`1px solid ${C.smoke}`, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div style={{ fontSize:15, fontWeight:700, color:C.white }}>📄 Nouvelle facture</div>
          <button onClick={onClose} style={{ background:"none", border:"none", color:C.mist, fontSize:20, cursor:"pointer" }}>✕</button>
        </div>
        <div style={{ overflowY:"auto", padding:24, display:"flex", flexDirection:"column", gap:16 }}>
          {err && <div style={{ background:"#EF444418", border:"1px solid #EF444440", borderRadius:6, padding:"10px 14px", fontSize:12, color:"#EF4444" }}>⚠️ {err}</div>}

          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
            <div style={{ display:"flex", flexDirection:"column", gap:5 }}>
              <label style={labelStyle}>Client *</label>
              <select value={form.customer_id} onChange={set("customer_id")} style={inputStyle}>
                <option value="">{t("select_one")}</option>
                {customers.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div style={{ display:"flex", flexDirection:"column", gap:5 }}>
              <label style={labelStyle}>{t("lbl_building_req")}</label>
              <select value={form.building_id} onChange={set("building_id")} style={inputStyle}>
                <option value="">{t("select_one")}</option>
                {filteredBuildings.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
          </div>

          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:12 }}>
            <div style={{ display:"flex", flexDirection:"column", gap:5 }}>
              <label style={labelStyle}>{t("lbl_issue_date")}</label>
              <input type="date" value={form.issue_date} onChange={set("issue_date")} style={inputStyle}/>
            </div>
            <div style={{ display:"flex", flexDirection:"column", gap:5 }}>
              <label style={labelStyle}>{t("lbl_due_date")}</label>
              <input type="date" value={form.due_date} onChange={set("due_date")} style={inputStyle}/>
            </div>
            <div style={{ display:"flex", flexDirection:"column", gap:5 }}>
              <label style={labelStyle}>Statut</label>
              <select value={form.status} onChange={set("status")} style={inputStyle}>
                {[["draft","Brouillon"],["sent","Envoyée"],["pending","En attente"]].map(([v,l])=><option key={v} value={v}>{l}</option>)}
              </select>
            </div>
          </div>

          {/* Line items */}
          <div>
            <div style={{ fontSize:12, fontWeight:600, color:C.frost, marginBottom:10 }}>Articles</div>
            <div style={{ background:"#111", borderRadius:"6px 6px 0 0", display:"grid", gridTemplateColumns:"1fr 70px 100px 90px 24px", gap:0, padding:"8px 12px" }}>
              {["Description","Qté","Prix unit.","Total",""].map(h=><div key={h} style={{ fontSize:10, color:C.mist, fontWeight:600, textTransform:"uppercase" }}>{h}</div>)}
            </div>
            {lines.map((l,i)=>(
              <div key={i} style={{ display:"grid", gridTemplateColumns:"1fr 70px 100px 90px 24px", gap:6, padding:"8px 12px", background:i%2===0?C.smoke:"#1f1f1f", borderBottom:`1px solid ${C.steel}`, alignItems:"center" }}>
                <input value={l.description} onChange={setLine(i,"description")} placeholder="Description..." style={{ ...inputStyle, padding:"6px 10px" }}/>
                <input value={l.quantity}    onChange={setLine(i,"quantity")}    type="number" style={{ ...inputStyle, padding:"6px 8px" }}/>
                <input value={l.unit_price}  onChange={setLine(i,"unit_price")}  type="number" placeholder="0.00" style={{ ...inputStyle, padding:"6px 8px" }}/>
                <span style={{ fontSize:12, color:C.warn, fontWeight:600 }}>{fmt(Number(l.quantity||0)*Number(l.unit_price||0))}</span>
                {lines.length>1 && <button onClick={()=>removeLine(i)} style={{ background:"none", border:"none", color:"#EF4444", cursor:"pointer", fontSize:14 }}>✕</button>}
              </div>
            ))}
            <button onClick={addLine} style={{ width:"100%", padding:"8px", background:C.smoke, border:`1px dashed ${C.steel}`, borderTop:"none", borderRadius:"0 0 6px 6px", color:C.mist, fontSize:12, cursor:"pointer", fontFamily:"inherit" }}>
              ＋ Ajouter une ligne
            </button>
          </div>

          {/* Totals + options */}
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
            <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
              <div style={{ display:"flex", flexDirection:"column", gap:5 }}>
                <label style={labelStyle}>Notes client</label>
                <textarea value={form.notes} onChange={set("notes")} rows={2} placeholder="Visible sur la facture..." style={{ ...inputStyle, resize:"vertical" }}/>
              </div>
              <div style={{ display:"flex", flexDirection:"column", gap:5 }}>
                <label style={labelStyle}>Conditions de paiement</label>
                <input value={form.terms} onChange={set("terms")} placeholder="Ex: Règlement à 30 jours" style={inputStyle}/>
              </div>
            </div>
            <div style={{ background:C.coal, borderRadius:8, padding:16, border:`1px solid ${C.smoke}`, display:"flex", flexDirection:"column", gap:8 }}>
              {[["Sous-total HT",fmt(subtotal),false],[`TVA (${form.tax_rate}%)`,fmt(taxAmt),false],["Remise",fmt(Number(form.discount||0)),false]].map(([l,v,bold])=>(
                <div key={l} style={{ display:"flex", justifyContent:"space-between", fontSize:12 }}>
                  <span style={{ color:C.mist }}>{l}</span><span style={{ color:C.frost, fontWeight:bold?700:400 }}>{v}</span>
                </div>
              ))}
              <div style={{ borderTop:`1px solid ${C.smoke}`, marginTop:4, paddingTop:8, display:"flex", justifyContent:"space-between" }}>
                <span style={{ fontSize:14, fontWeight:700, color:C.white }}>Total TTC</span>
                <span style={{ fontSize:15, fontWeight:800, color:C.flame }}>{fmt(total)}</span>
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginTop:4 }}>
                <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
                  <label style={{ fontSize:10, color:C.mist }}>TVA %</label>
                  <input type="number" value={form.tax_rate} onChange={set("tax_rate")} style={{ ...inputStyle, padding:"5px 8px", fontSize:11 }}/>
                </div>
                <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
                  <label style={{ fontSize:10, color:C.mist }}>Remise ({cur})</label>
                  <input type="number" value={form.discount} onChange={set("discount")} style={{ ...inputStyle, padding:"5px 8px", fontSize:11 }}/>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div style={{ padding:"16px 24px", borderTop:`1px solid ${C.smoke}`, display:"flex", justifyContent:"flex-end", gap:10 }}>
          <Btn variant="secondary" onClick={onClose}>{t("btn_cancel")}</Btn>
          <Btn onClick={handleSave} disabled={saving}>{saving?t("btn_creating"):t("btn_create_invoice")}</Btn>
        </div>
      </div>
    </div>
  );
};

const InvoicesPage = ({ user }) => {
  const { t } = useT();
  const [filter,        setFilter]        = useState("all");
  const [viewingInvoice,setViewingInvoice]= useState(null);
  const [showCreate,    setShowCreate]    = useState(false);
  const { data, loading, error, refetch } = useQuery(() => DB.getInvoices(user.company_id, filter), [user.company_id, filter]);
  const cur = localStorage.getItem("fsCurrency")||"MAD";

  const statColor = { draft:"default", sent:"info", pending:"warning", paid:"success", overdue:"danger", void:"default" };
  const all = data||[];
  const totalOutstanding = all.filter(i=>i.status!=="paid"&&i.status!=="void").reduce((s,i)=>s+Number(i.balance_due||0),0);
  const totalPaid        = all.filter(i=>i.status==="paid").reduce((s,i)=>s+Number(i.total||0),0);
  const fmtC = n => `${Number(n||0).toLocaleString("fr-FR",{minimumFractionDigits:2})} ${cur}`;

  return (
    <>
    <div className="fade-in" style={{ padding:24, display:"flex", flexDirection:"column", gap:20 }}>
      <div style={{ display:"flex", gap:12, alignItems:"flex-start" }}>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:12, flex:1 }}>
          {[
            {label:"En suspens",          value:fmtC(totalOutstanding), color:C.warn },
            {label:"Encaissé (affiché)",  value:fmtC(totalPaid),        color:C.safe },
            {label:"En retard",           value:all.filter(i=>i.status==="overdue").length, color:C.danger },
            {label:"Total factures",      value:all.length,             color:C.mist },
          ].map((s,i)=>(
            <Card key={i} style={{padding:14}}>
              <div style={{fontSize:11,color:C.mist,marginBottom:6}}>{s.label}</div>
              <div style={{fontSize:20,fontWeight:800,fontFamily:"Syne,sans-serif",color:s.color}}>{loading?"—":s.value}</div>
            </Card>
          ))}
        </div>
        <Btn icon="plus" onClick={()=>setShowCreate(true)}>{t("create_invoice")}</Btn>
      </div>

      <div style={{ display:"flex", gap:4, background:C.ash, border:`1px solid ${C.smoke}`, borderRadius:8, padding:4, alignSelf:"flex-start" }}>
        {["all","draft","pending","sent","paid","overdue"].map(f=>(
          <button key={f} onClick={()=>setFilter(f)} style={{ padding:"6px 14px", borderRadius:6, border:"none", background:filter===f?C.flame:"transparent", color:filter===f?"#fff":C.mist, fontSize:12, fontWeight:500, cursor:"pointer", transition:"all 0.12s" }}>
            {{all:"Tous",draft:"Brouillon",pending:"En attente",sent:"Envoyée",paid:"Payée",overdue:"En retard"}[f]}
          </button>
        ))}
      </div>

      {error && <ErrorBanner msg={error} onRetry={refetch}/>}

      <Card style={{ padding:0 }}>
        <Table loading={loading} data={all}
          emptyIcon="invoice" emptyTitle={t("no_invoices")} emptyText="Créez une facture ou convertissez un devis."
          columns={[
            { key:"invoice_number", label:"N° facture",  render:v=><span style={{fontFamily:"monospace",color:C.info,fontWeight:600}}>{v}</span> },
            { key:"customer",       label:t("col_customer"),      render:(_,r)=>r.customer?.name||"—" },
            { key:"total",          label:"Total TTC",   render:v=><span style={{fontWeight:600,color:C.white}}>{fmtC(v)}</span> },
            { key:"balance_due",    label:"Solde dû",    render:v=>Number(v)>0?<span style={{color:C.danger,fontWeight:600}}>{fmtC(v)}</span>:<span style={{color:C.safe}}>Réglé</span> },
            { key:"status",         label:t("col_status"),      render:v=>{const fr={draft:"Brouillon",sent:"Envoyée",pending:"En attente",paid:"Payée",overdue:"En retard",void:"Annulée"}; return <Badge type={statColor[v]||"default"}>{fr[v]||v}</Badge>;} },
            { key:"due_date",       label:"Échéance",    render:v=>v?<span style={{fontSize:11,color:C.mist}}>{new Date(v).toLocaleDateString("fr-FR")}</span>:<span style={{color:C.steel}}>—</span> },
            { key:"id",             label:"",            render:(_,r)=><div style={{display:"flex",gap:6}}><Btn variant="ghost" size="sm" icon="eye" onClick={e=>{e.stopPropagation();setViewingInvoice(r);}}>PDF</Btn></div> },
          ]}
        />
      </Card>
    </div>

    {showCreate && (
      <CreateInvoiceModal user={user} onClose={()=>setShowCreate(false)} onCreated={refetch}/>
    )}
    {viewingInvoice && (
      <InvoicePDF invoice={viewingInvoice} onClose={()=>setViewingInvoice(null)} supabase={{ url:SUPABASE_URL, anonKey:SUPABASE_ANON_KEY, jwt:SUPABASE_JWT }}/>
    )}
    </>
  );
};


// ─── SCHEDULING — delegated to full Scheduling.jsx ──────────────────────────
const SchedulingPage = ({ user }) => (
  <Scheduling
    user={user}
    supabase={{ url:SUPABASE_URL, anonKey:SUPABASE_ANON_KEY, jwt:SUPABASE_JWT }}
  />
);


// ─── AI ASSISTANT ─────────────────────────────────────────────────────────────
const AIPage = () => {
  const [messages, setMessages] = useState([{ role:"ai", text:"Hello! I'm your FireSafe AI Assistant. I can help you draft inspection notes, identify deficiency patterns, generate compliance summaries, or answer fire code questions. What do you need?" }]);
  const [input, setInput]       = useState("");
  const [loading, setLoading]   = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior:"smooth" }); }, [messages, loading]);

  const send = async (text) => {
    const msg = text||input;
    if (!msg.trim()) return;
    setMessages(m=>[...m,{role:"user",text:msg}]);
    setInput(""); setLoading(true);

    // Simulated AI responses (replace with real Claude API call)
    await new Promise(r=>setTimeout(r,1200));
    const lower = msg.toLowerCase();
    let reply = "Based on NFPA standards, I'd recommend documenting this deficiency with the exact code section, location, and estimated repair timeline. Would you like me to draft a formal deficiency description?";
    if (lower.includes("nfpa 72")||lower.includes("fire alarm")) reply = "NFPA 72 (2022) covers fire alarm & signaling systems. Key inspection points include: control panel integrity (§10.6), smoke detector response time (§14.4), horn/strobe activation (§18.4), and battery backup testing (§10.5.6). Which section do you need help with?";
    else if (lower.includes("nfpa 25")||lower.includes("sprinkler")) reply = "NFPA 25 governs inspection, testing & maintenance of water-based fire protection systems. Annual sprinkler inspections require: checking for corrosion, physical damage, or loading on heads; verifying proper orientation; confirming 18-inch clearance below heads; and testing main drain and alarm valves.";
    else if (lower.includes("draft")||lower.includes("note")) reply = "**Notes d'inspection — Fire Alarm System**\n\nSystem: FACP — [Manufacturer/Model]\nDate: " + new Date().toLocaleDateString() + "\n\nFindings:\n— Visual inspection: PASS\n— Smoke detector functional test: FAIL (3 units in zones 2, 4, 7 unresponsive)\n— Manual pull station test: PASS\n— Horn/strobe activation: PASS\n— Battery backup (4hr load test): PASS\n\nDeficiencies logged: 3 smoke detectors require replacement per NFPA 72 §14.4.";
    else if (lower.includes("deficien")) reply = "To write a strong deficiency report:\n\n1. **Location** — Floor, zone, room number\n2. **Asset** — Device type, label/ID, manufacturer\n3. **Observation** — Exactly what was found\n4. **Code Reference** — NFPA section violated\n5. **Severity** — Critical/High/Medium/Low\n6. **Recommendation** — Specific corrective action\n\nWould you like me to fill in a template for a specific deficiency?";
    setMessages(m=>[...m,{role:"ai",text:reply}]);
    setLoading(false);
  };

  const suggestions = ["Draft fire alarm inspection notes","NFPA 72 horn/strobe requirements","How to write a deficiency report","NFPA 25 annual sprinkler checklist"];

  return (
    <div className="fade-in" style={{ padding:24, display:"flex", flexDirection:"column", gap:16, height:"calc(100vh - 60px)", overflow:"hidden" }}>
      <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
        {suggestions.map((s,i)=>(
          <button key={i} onClick={()=>send(s)} style={{ padding:"6px 12px", borderRadius:20, border:`1px solid ${C.steel}`, background:"transparent", color:C.mist, fontSize:12, cursor:"pointer", transition:"all 0.12s" }}
            onMouseEnter={e=>{e.currentTarget.style.borderColor=C.flame;e.currentTarget.style.color=C.flame;}} onMouseLeave={e=>{e.currentTarget.style.borderColor=C.steel;e.currentTarget.style.color=C.mist;}}>
            {s}
          </button>
        ))}
      </div>

      <Card style={{ flex:1, padding:0, display:"flex", flexDirection:"column", overflow:"hidden" }}>
        <div style={{ flex:1, overflowY:"auto", padding:20, display:"flex", flexDirection:"column", gap:16 }}>
          {messages.map((m,i)=>(
            <div key={i} style={{ display:"flex", gap:12, justifyContent:m.role==="user"?"flex-end":"flex-start" }}>
              {m.role==="ai" && <div style={{ width:32,height:32,borderRadius:8,background:`${C.flame}18`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0 }}><Icon name="robot" size={16} color={C.ember}/></div>}
              <div style={{ maxWidth:"75%", padding:"12px 14px", borderRadius:m.role==="user"?"12px 12px 4px 12px":"12px 12px 12px 4px", background:m.role==="user"?C.flame:C.smoke, fontSize:13, color:C.white, lineHeight:1.6, whiteSpace:"pre-line" }}>
                {m.text}
              </div>
              {m.role==="user" && <div style={{width:32,height:32,borderRadius:"50%",background:`${C.info}40`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,fontSize:14}}>👤</div>}
            </div>
          ))}
          {loading && (
            <div style={{ display:"flex", gap:12 }}>
              <div style={{ width:32,height:32,borderRadius:8,background:`${C.flame}18`,display:"flex",alignItems:"center",justifyContent:"center" }}><Icon name="robot" size={16} color={C.ember}/></div>
              <div style={{ padding:"12px 16px", background:C.smoke, borderRadius:"12px 12px 12px 4px", display:"flex", gap:4, alignItems:"center" }}>
                {[0,1,2].map(j=><span key={j} style={{ width:6,height:6,borderRadius:"50%",background:C.mist,animation:`pulse 1s ${j*0.2}s ease-in-out infinite` }}/>)}
              </div>
            </div>
          )}
          <div ref={bottomRef}/>
        </div>
        <div style={{ padding:16, borderTop:`1px solid ${C.smoke}`, display:"flex", gap:10 }}>
          <input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&!loading&&send()}
            placeholder="Posez vos questions sur les inspections, les codes incendie, les déficiences..."
            style={{ flex:1, background:C.smoke, border:`1px solid ${C.steel}`, borderRadius:8, padding:"10px 14px", fontSize:13, color:C.white }}
            onFocus={e=>e.target.style.borderColor=C.flame} onBlur={e=>e.target.style.borderColor=C.steel}/>
          <Btn onClick={()=>send()} icon="zap" disabled={!input.trim()||loading}>Envoyer</Btn>
        </div>
      </Card>
    </div>
  );
};

// ─── PLACEHOLDER ──────────────────────────────────────────────────────────────
const Placeholder = ({ title, icon, description, cta }) => (
  <div className="fade-in" style={{ padding:24, display:"flex", alignItems:"center", justifyContent:"center", minHeight:"60vh" }}>
    <div style={{ textAlign:"center", maxWidth:400 }}>
      <div style={{ width:64,height:64,borderRadius:16,background:`${C.flame}18`,display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 20px" }}><Icon name={icon} size={28} color={C.flame}/></div>
      <h2 style={{ fontFamily:"Syne,sans-serif", fontSize:22, fontWeight:700, color:C.white, marginBottom:10 }}>{title}</h2>
      <p style={{ color:C.mist, fontSize:13, lineHeight:1.7, marginBottom:20 }}>{description}</p>
      <Btn icon="plus" size="lg">{cta}</Btn>
    </div>
  </div>
);

// ─── MAIN APP ─────────────────────────────────────────────────────────────────

// ─── TEMPLATE SEEDER PAGE ────────────────────────────────────────────────────
const SEED_DATA = [
  {
    key:"nfpa10",
    template:{ name:"Fire Extinguisher Inspection – NFPA 10", trade:"extinguisher", nfpa_reference:"NFPA 10", is_active:true, is_system:true },
    sections:[
      { title:"Emplacement & Accessibilité", order_index:1, questions:[
        { question_text:"L'extincteur est-il visible et facilement accessible ?", answer_type:"pass_fail", is_required:true,  nfpa_reference:"NFPA 10 §6.1.3", order_index:1, creates_deficiency_on:"fail" },
        { question_text:"L'extincteur est-il correctement fixé au mur ou support ?", answer_type:"pass_fail", is_required:true,  nfpa_reference:"NFPA 10 §6.2.1", order_index:2, creates_deficiency_on:"fail" },
        { question_text:"La hauteur de montage est-elle conforme (≤ 1,5 m) ?", answer_type:"pass_fail", is_required:true,  nfpa_reference:"NFPA 10 §6.2.2", order_index:3, creates_deficiency_on:"fail" },
        { question_text:"Le chemin d'accès est-il dégagé (aucun obstacle) ?", answer_type:"pass_fail", is_required:true,  nfpa_reference:"NFPA 10 §6.1.3.1", order_index:4, creates_deficiency_on:"fail" },
        { question_text:"La signalétique est-elle présente et lisible ?", answer_type:"pass_fail", is_required:false, nfpa_reference:"NFPA 10 §6.1.4", order_index:5, creates_deficiency_on:"fail" },
      ]},
      { title:"État Physique & Étiquetage", order_index:2, questions:[
        { question_text:"L'extincteur est-il exempt de dommages visibles (bosses, corrosion) ?", answer_type:"pass_fail", is_required:true,  nfpa_reference:"NFPA 10 §7.3.2", order_index:1, creates_deficiency_on:"fail" },
        { question_text:"L'étiquette d'inspection annuelle est-elle présente et à jour ?", answer_type:"pass_fail", is_required:true,  nfpa_reference:"NFPA 10 §7.3.3", order_index:2, creates_deficiency_on:"fail" },
        { question_text:"Les instructions d'utilisation sont-elles lisibles sur l'appareil ?", answer_type:"pass_fail", is_required:true,  nfpa_reference:"NFPA 10 §6.3.1", order_index:3, creates_deficiency_on:"fail" },
        { question_text:"Le type d'agent extincteur est-il approprié au risque ambiant ?", answer_type:"pass_fail", is_required:true,  nfpa_reference:"NFPA 10 §5.2",   order_index:4, creates_deficiency_on:"fail" },
      ]},
      { title:"Mécanisme & Pression", order_index:3, questions:[
        { question_text:"La goupille de sécurité est-elle en place et intacte ?", answer_type:"pass_fail", is_required:true,  nfpa_reference:"NFPA 10 §7.3.2.1", order_index:1, creates_deficiency_on:"fail" },
        { question_text:"Le scellé (plomb) est-il intact et non altéré ?", answer_type:"pass_fail", is_required:true,  nfpa_reference:"NFPA 10 §7.3.2.2", order_index:2, creates_deficiency_on:"fail" },
        { question_text:"Le manomètre indique-t-il une pression dans la zone verte ?", answer_type:"pass_fail", is_required:true,  nfpa_reference:"NFPA 10 §7.3.2.3", order_index:3, creates_deficiency_on:"fail" },
        { question_text:"Le tuyau flexible est-il en bon état, sans fissure ni obstruction ?", answer_type:"pass_fail", is_required:true,  nfpa_reference:"NFPA 10 §7.3.2.4", order_index:4, creates_deficiency_on:"fail" },
      ]},
      { title:"Maintenance & Historique", order_index:4, questions:[
        { question_text:"La maintenance annuelle a-t-elle été effectuée dans les 12 derniers mois ?", answer_type:"pass_fail", is_required:true,  nfpa_reference:"NFPA 10 §7.3",   order_index:1, creates_deficiency_on:"fail" },
        { question_text:"L'épreuve hydraulique est-elle à jour selon le type d'appareil ?", answer_type:"pass_fail", is_required:true,  nfpa_reference:"NFPA 10 §8.3",   order_index:2, creates_deficiency_on:"fail" },
        { question_text:"Le registre de maintenance est-il disponible et complet ?", answer_type:"pass_fail", is_required:false, nfpa_reference:"NFPA 10 §7.3.4", order_index:3, creates_deficiency_on:"fail" },
        { question_text:"Notes / observations complémentaires", answer_type:"text", is_required:false, nfpa_reference:null, order_index:4, creates_deficiency_on:null },
      ]},
    ],
  },
  {
    key:"nfpa72",
    template:{ name:"Fire Alarm Inspection – NFPA 72", trade:"fire_alarm", nfpa_reference:"NFPA 72", is_active:true, is_system:true },
    sections:[
      { title:"Panneau de Contrôle (FACP)", order_index:1, questions:[
        { question_text:"Le panneau affiche-t-il un état normal (aucune alarme ni défaut actif) ?", answer_type:"pass_fail", is_required:true,  nfpa_reference:"NFPA 72 §14.4.3", order_index:1, creates_deficiency_on:"fail" },
        { question_text:"L'alimentation secteur (AC) est-elle présente et indiquée sur le panneau ?", answer_type:"pass_fail", is_required:true,  nfpa_reference:"NFPA 72 §14.4.4", order_index:2, creates_deficiency_on:"fail" },
        { question_text:"La batterie de secours est-elle chargée et fonctionnelle ?", answer_type:"pass_fail", is_required:true,  nfpa_reference:"NFPA 72 §14.4.5", order_index:3, creates_deficiency_on:"fail" },
        { question_text:"Le journal des événements est-il examiné et sans erreurs non résolues ?", answer_type:"pass_fail", is_required:true,  nfpa_reference:"NFPA 72 §14.2.2", order_index:4, creates_deficiency_on:"fail" },
      ]},
      { title:"Détecteurs de Fumée & Chaleur", order_index:2, questions:[
        { question_text:"Tous les détecteurs ont-ils été testés individuellement ?", answer_type:"pass_fail", is_required:true,  nfpa_reference:"NFPA 72 §14.4.4.1", order_index:1, creates_deficiency_on:"fail" },
        { question_text:"Les détecteurs sont-ils exempts de poussière, peinture ou obstruction ?", answer_type:"pass_fail", is_required:true,  nfpa_reference:"NFPA 72 §14.4.4.2", order_index:2, creates_deficiency_on:"fail" },
        { question_text:"L'espacement des détecteurs est-il conforme aux exigences NFPA 72 ?", answer_type:"pass_fail", is_required:true,  nfpa_reference:"NFPA 72 §17.6",     order_index:3, creates_deficiency_on:"fail" },
        { question_text:"Aucun détecteur ne dépasse son intervalle de remplacement (10 ans) ?", answer_type:"pass_fail", is_required:true,  nfpa_reference:"NFPA 72 §14.4.4.3", order_index:4, creates_deficiency_on:"fail" },
      ]},
      { title:"Déclencheurs Manuels & Avertisseurs", order_index:3, questions:[
        { question_text:"Tous les déclencheurs manuels ont-ils été testés ?", answer_type:"pass_fail", is_required:true,  nfpa_reference:"NFPA 72 §14.4.7", order_index:1, creates_deficiency_on:"fail" },
        { question_text:"Les avertisseurs sonores sont-ils fonctionnels et audibles dans toutes les zones ?", answer_type:"pass_fail", is_required:true,  nfpa_reference:"NFPA 72 §14.4.8", order_index:2, creates_deficiency_on:"fail" },
        { question_text:"Les avertisseurs visuels (stroboscopes) fonctionnent-ils correctement ?", answer_type:"pass_fail", is_required:true,  nfpa_reference:"NFPA 72 §14.4.9", order_index:3, creates_deficiency_on:"fail" },
      ]},
      { title:"Communication & Supervision", order_index:4, questions:[
        { question_text:"La transmission vers le centre de surveillance est-elle fonctionnelle ?", answer_type:"pass_fail", is_required:true,  nfpa_reference:"NFPA 72 §26.6",   order_index:1, creates_deficiency_on:"fail" },
        { question_text:"Le câblage de supervision est-il intact et sans coupure ?", answer_type:"pass_fail", is_required:true,  nfpa_reference:"NFPA 72 §12.3",   order_index:2, creates_deficiency_on:"fail" },
        { question_text:"Le système dispose-t-il d'une alimentation de secours ≥ 24h ?", answer_type:"pass_fail", is_required:true,  nfpa_reference:"NFPA 72 §10.6.7", order_index:3, creates_deficiency_on:"fail" },
        { question_text:"Notes / observations complémentaires", answer_type:"text", is_required:false, nfpa_reference:null, order_index:4, creates_deficiency_on:null },
      ]},
    ],
  },
];

const SeederPage = ({ user }) => {
  const [log,     setLog]     = useState([]);
  const [running, setRunning] = useState(false);
  const [done,    setDone]    = useState(false);

  const addLog = (msg, type="info") => setLog(l => [...l, { msg, type }]);

  const post = async (table, body) => {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
      method:"POST",
      headers:{ ...sbHeaders(), "Prefer":"return=representation" },
      body:JSON.stringify(body),
    });
    const d = await res.json();
    if (!res.ok) throw new Error(d.message || d.hint || JSON.stringify(d));
    return Array.isArray(d) ? d[0] : d;
  };

  const KNOWN_TEMPLATE_IDS = {
    extinguisher: "30000000-0000-0000-0000-000000000001",
    fire_alarm:   "30000000-0000-0000-0000-000000000002",
    sprinkler:    "30000000-0000-0000-0000-000000000003",
  };

  const patch = async (table, id, body) => {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}`, {
      method:"PATCH",
      headers:{ ...sbHeaders(), "Prefer":"return=representation" },
      body:JSON.stringify(body),
    });
    const d = await res.json();
    if (!res.ok) throw new Error(d.message || JSON.stringify(d));
    return Array.isArray(d) ? d[0] : d;
  };

  const getOrCreateTemplate = async (template) => {
    const knownId = KNOWN_TEMPLATE_IDS[template.trade];
    if (knownId) {
      // Check if this template exists
      const res = await fetch(`${SUPABASE_URL}/rest/v1/inspection_templates?id=eq.${knownId}&select=id`, {
        headers: sbHeaders(),
      });
      const d = await res.json();
      if (Array.isArray(d) && d.length > 0) {
        addLog(`  ℹ Template existant trouvé (id: ${knownId})`, "ok");
        return { id: knownId };
      }
    }
    // Create new
    return await post("inspection_templates", { ...template, company_id: user.company_id });
  };

  const seed = async () => {
    setRunning(true); setLog([]); setDone(false);
    for (const { key, template, sections } of SEED_DATA) {
      try {
        addLog(`📋 Template: ${template.name}`);
        const tpl = await getOrCreateTemplate(template);
        addLog(`  ✓ Template id: ${tpl.id}`, "ok");

        // Delete existing sections for this template to avoid duplicates
        await fetch(`${SUPABASE_URL}/rest/v1/template_sections?template_id=eq.${tpl.id}`, {
          method:"DELETE", headers: sbHeaders(),
        });
        addLog(`  ✓ Anciennes sections supprimées`, "ok");

        for (const sec of sections) {
          const sect = await post("template_sections", {
            template_id: tpl.id,
            title:       sec.title,
            order_index: sec.order_index,
          });
          addLog(`  ✓ Section: ${sec.title} (id: ${sect.id})`, "ok");

          for (const q of sec.questions) {
            await post("template_questions", {
              section_id:            sect.id,
              question_text:         q.question_text,
              answer_type:           q.answer_type,
              is_required:           q.is_required,
              nfpa_reference:        q.nfpa_reference,
              order_index:           q.order_index,
              creates_deficiency_on: q.creates_deficiency_on,
            });
            addLog(`    ✓ Q: ${q.question_text.slice(0,55)}…`, "ok");
          }
        }
        addLog(`✅ ${template.name} terminé !`, "ok");
      } catch(e) {
        addLog(`✗ Erreur (${key}): ${e.message}`, "error");
      }
    }
    setRunning(false); setDone(true);
  };

  const logColor = { ok:"#6BCB77", error:"#FF6B6B", info:"#8b949e" };

  return (
    <div style={{ padding:32, maxWidth:680, margin:"0 auto" }}>
      <h2 style={{ fontFamily:"Syne,sans-serif", fontSize:20, fontWeight:800, marginBottom:4 }}>🌱 Seed Templates NFPA</h2>
      <p style={{ color:C.mist, fontSize:13, marginBottom:20 }}>
        Peuple les templates d'inspection NFPA 10 (Extincteurs) et NFPA 72 (Alarme) dans votre base de données.
        À exécuter une seule fois.
      </p>

      <div style={{ background:C.ash, border:`1px solid ${C.smoke}`, borderRadius:8, padding:16, marginBottom:20 }}>
        {SEED_DATA.map(t => (
          <div key={t.key} style={{ marginBottom:12 }}>
            <div style={{ fontSize:13, fontWeight:600, color:C.frost }}>📋 {t.template.name}</div>
            <div style={{ fontSize:11, color:C.mist, marginTop:2 }}>
              {t.sections.length} sections · {t.sections.reduce((a,s)=>a+s.questions.length,0)} questions
            </div>
          </div>
        ))}
      </div>

      {done && (
        <div style={{ padding:14, background:`${C.safe}15`, border:`1px solid ${C.safe}40`, borderRadius:8, marginBottom:16, fontSize:13, color:C.safe, fontWeight:600 }}>
          ✅ Seed terminé ! Allez dans Inspections pour tester.
        </div>
      )}

      <Btn full size="lg" onClick={seed} disabled={running}>
        {running ? "⏳ En cours…" : "🚀 Lancer le Seed"}
      </Btn>

      {log.length > 0 && (
        <div style={{ marginTop:16, background:C.coal, border:`1px solid ${C.smoke}`, borderRadius:8, padding:16, maxHeight:400, overflowY:"auto" }}>
          {log.map((l,i) => (
            <div key={i} style={{ fontSize:11, fontFamily:"monospace", color:logColor[l.type]||C.frost, marginBottom:2 }}>
              {l.msg}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

function AppInner() {
  const { t, dir } = useT();
  const [user,        setUser]        = useState(null);
  const [authReady,   setAuthReady]   = useState(false);
  const [page,        setPage]        = useState("dashboard");
  const [collapsed,   setCollapsed]   = useState(false);
  const [companyLogo, setCompanyLogo] = useState(() => localStorage.getItem("fsCompanyLogo") || "");
  const [companyName, setCompanyName] = useState(() => localStorage.getItem("fsCompanyName") || "FireSafe");

  // Restore session on mount
  useEffect(() => {
    (async () => {
      try {
        const session = sbAuth.restoreSession();
        if (session?.access_token && session?.user) {
          const profile = await DB.getProfile(session.user.id);
          if (profile) {
            setUser(profile);
            // Load company logo & name
            try {
              const res = await fetch(`${SUPABASE_URL}/rest/v1/companies?id=eq.${profile.company_id}&select=logo_url,name`, {
                headers: { "apikey": SUPABASE_ANON_KEY, "Authorization": `Bearer ${session.access_token}` }
              });
              const [co] = await res.json();
              if (co?.logo_url) { setCompanyLogo(co.logo_url); localStorage.setItem("fsCompanyLogo", co.logo_url); }
              if (co?.name)     { setCompanyName(co.name);     localStorage.setItem("fsCompanyName", co.name); }
            } catch(e) {}
          }
        }
      } catch(e) {
        // Session expired or invalid — clear it
        sbAuth.signOut();
      } finally {
        setAuthReady(true);
      }
    })();
  }, []);

  const handleLogout = async () => {
    await sbAuth.signOut();
    setUser(null);
  };

  // Refresh logo/name when saved from Settings
  useEffect(() => {
    const handler = () => {
      const logo = localStorage.getItem("fsCompanyLogo") || "";
      const name = localStorage.getItem("fsCompanyName") || "FireSafe";
      setCompanyLogo(logo);
      setCompanyName(name);
    };
    window.addEventListener("fsCompanyUpdated", handler);
    return () => window.removeEventListener("fsCompanyUpdated", handler);
  }, []);

  // Loading splash
  if (!authReady) return (
    <>
      <GlobalStyles/>
      <div style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", background:C.coal }}>
        <div style={{ textAlign:"center" }}>
          <div style={{ width:48,height:48,borderRadius:12,background:`linear-gradient(135deg,${C.flame},${C.ember})`,display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 16px",animation:"flamePulse 2s ease-in-out infinite" }}><Icon name="flame" size={24} color="#fff"/></div>
          <div style={{ fontSize:13, color:C.mist }}>Chargement de FireSafe Pro…</div>
        </div>
      </div>
    </>
  );

  if (!user) return (<><GlobalStyles/><LoginScreen onLogin={setUser}/></>);

  const sw = collapsed ? 64 : 220;


  const PAGES = {
    dashboard:    { title:t("dashboard"),    subtitle:companyName,                  component:<DashboardPage    user={user}/> },
    scheduling:   { title:t("scheduling"),   subtitle:t("sub_scheduling"),          component:<SchedulingPage   user={user}/> },
    inspections:  { title:t("inspections"),  subtitle:t("sub_inspections"),         component:<InspectionForms user={user} supabase={{ url:SUPABASE_URL, anonKey:SUPABASE_ANON_KEY, jwt:SUPABASE_JWT }}/> },
    deficiencies: { title:t("deficiencies"), subtitle:t("sub_deficiencies"),        component:<Deficiencies user={user} supabase={{ url:SUPABASE_URL, anonKey:SUPABASE_ANON_KEY, jwt:SUPABASE_JWT }}/> },
    proposals:    { title:t("proposals"),    subtitle:t("sub_proposals"),           component:<Proposals user={user} supabase={{ url:SUPABASE_URL, anonKey:SUPABASE_ANON_KEY, jwt:SUPABASE_JWT }}/> },
    workorders:   { title:t("workorders"),   subtitle:t("sub_workorders"),          component:<WorkOrders user={user} supabase={{ url:SUPABASE_URL, anonKey:SUPABASE_ANON_KEY, jwt:SUPABASE_JWT }}/> },
    invoices:     { title:t("invoices"),     subtitle:t("sub_invoices"),            component:<InvoicesPage     user={user}/> },
    payments:     { title:t("payments"),     subtitle:t("sub_payments"),            component:<Payments user={user} supabase={{ url:SUPABASE_URL, anonKey:SUPABASE_ANON_KEY, jwt:SUPABASE_JWT }}/> },
    customers:    { title:t("customers"),    subtitle:t("sub_customers"),           component:<Customers user={user} supabase={{ url:SUPABASE_URL, anonKey:SUPABASE_ANON_KEY, jwt:SUPABASE_JWT }}/> },
    ai:           { title:t("ai_assistant"), subtitle:t("sub_ai"),                  component:<AIPage/> },
    settings:     { title:t("settings"),     subtitle:t("sub_settings"),            component:<Settings user={user} supabase={{ url:SUPABASE_URL, anonKey:SUPABASE_ANON_KEY, jwt:SUPABASE_JWT }}/> },
    seeder:       { title:t("seed_templates"),subtitle:t("sub_seeder"),             component:<SeederPage user={user}/> },
  };

  const current = PAGES[page] || PAGES.dashboard;

  return (
    <ThemeProvider>
    <ThemeReloader>
      <GlobalStyles/>
      <div style={{ display:"flex", minHeight:"100vh", background:C.coal }}>
        <Sidebar active={page} onNav={setPage} user={user} collapsed={collapsed} onToggle={()=>setCollapsed(c=>!c)} onLogout={handleLogout} companyLogo={companyLogo} companyName={companyName}/>
        <div style={{ marginLeft:sw, flex:1, display:"flex", flexDirection:"column", minWidth:0, transition:"margin-left 0.25s ease" }}>
          <Header title={current.title} subtitle={current.subtitle} user={user}
            actions={page==="dashboard"?<Btn variant="secondary" size="sm" icon="trendUp">Rapports</Btn>:undefined}/>
          <main style={{ flex:1, overflowY:"auto" }}>{current.component}</main>
        </div>
      </div>
    </ThemeReloader>
    </ThemeProvider>
  );
}

export default function App() {
  return (
    <LangProvider>
      <AppInner />
    </LangProvider>
  );
}