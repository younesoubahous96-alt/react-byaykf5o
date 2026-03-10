// ============================================================
// FireSafe Pro — Full App with Real Supabase Auth + Live Data
// ============================================================
// SETUP: Before running, replace the two constants below with
// your actual values from Supabase → Settings → API
// ============================================================

const SUPABASE_URL = "https://mqgbedrmcxrqesuunkax.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_7-YkIw9NzkNjSB3jxyeBrw_x9r_66w1";
const SUPABASE_JWT = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1xZ2JlZHJtY3hycWVzdXVua2F4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIzODIxNDIsImV4cCI6MjA4Nzk1ODE0Mn0.t9LAe8W27d5iPkLW7-3QR0fO_C_FgGhQBSGNOIKYvP8";

import React, { useState, useEffect, useCallback, useRef } from "react";
import InspectionForms from "./InspectionForm";

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
  };
  return builder;
};

// ─── DESIGN TOKENS ────────────────────────────────────────────────────────────
const C = {
  flame: "#FF4500", flameLight: "#FF6A33", flameDark: "#CC3700",
  ember: "#FF8C00", coal: "#0D0D0D", ash: "#1A1A1A", smoke: "#2A2A2A",
  steel: "#3A3A3A", mist: "#8A8A8A", frost: "#E8E8E8", white: "#FAFAFA",
  safe: "#22C55E", warn: "#F59E0B", danger: "#EF4444", info: "#3B82F6",
};

// ─── GLOBAL STYLES ────────────────────────────────────────────────────────────
const GlobalStyles = () => (
  <style>{`
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
  `}</style>
);

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

const ErrorBanner = ({ msg, onRetry }) => (
  <div style={{ margin:24, padding:"12px 16px", background:`${C.danger}12`, border:`1px solid ${C.danger}30`, borderRadius:8, display:"flex", alignItems:"center", gap:12 }}>
    <Icon name="alert" size={16} color={C.danger}/>
    <span style={{ fontSize:13, color:C.frost, flex:1 }}>{msg}</span>
    {onRetry && <Btn variant="ghost" size="sm" onClick={onRetry}>Retry</Btn>}
  </div>
);

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
      setError(e.message || "Something went wrong");
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
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();

    const [insp, defi, inv, rev] = await Promise.all([
      sbFrom("inspections").select("id").eq("company_id", companyId).eq("scheduled_date", today).get().then(d => d.length).catch(() => 0),
      sbFrom("deficiencies").select("id").eq("company_id", companyId).eq("status", "open").get().then(d => d.length).catch(() => 0),
      sbFrom("invoices").select("id").eq("company_id", companyId).in("status", ["sent","pending","overdue"]).get().then(d => d.length).catch(() => 0),
      sbFrom("payments").select("amount").eq("company_id", companyId).eq("status", "completed").gte("paid_at", monthStart).get().catch(() => []),
    ]);
    const revenue = (Array.isArray(rev) ? rev : []).reduce((s, p) => s + Number(p.amount), 0);
    return { inspectionsToday: insp, openDeficiencies: defi, pendingInvoices: inv, revenueThisMonth: revenue };
  },

  async getRecentInspections(companyId) {
    return sbFrom("inspections")
      .select("id,status,trade,scheduled_date,score,building:buildings(name),customer:customers(name),technician:profiles(full_name)")
      .eq("company_id", companyId)
      .order("created_at")
      .limit(8)
      .get();
  },

  async getInspections(companyId, statusFilter) {
    const q = sbFrom("inspections")
      .select("id,status,trade,scheduled_date,score,building:buildings(name),customer:customers(name),technician:profiles(full_name)")
      .eq("company_id", companyId)
      .order("created_at");
    if (statusFilter && statusFilter !== "all") q.eq("status", statusFilter);
    return q.get();
  },

  async getDeficiencies(companyId, statusFilter) {
    const q = sbFrom("deficiencies")
      .select("id,title,severity,status,identified_at,nfpa_reference,building:buildings(name),customer:customers(name),assignee:profiles(full_name)")
      .eq("company_id", companyId)
      .order("identified_at");
    if (statusFilter && statusFilter !== "all") q.eq("status", statusFilter);
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
    return sbFrom("schedules")
      .select("id,title,trade,scheduled_date,scheduled_time,status,building:buildings(name),customer:customers(name),technician:profiles(full_name)")
      .eq("company_id", companyId)
      .gte("scheduled_date", from)
      .lte("scheduled_date", to)
      .order("scheduled_date")
      .get();
  },
};

// ─── AUTH ─────────────────────────────────────────────────────────────────────
const LoginScreen = ({ onLogin }) => {
  const [tab,      setTab]      = useState("login");
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [name,     setName]     = useState("");
  const [company,  setCompany]  = useState("");
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState("");
  const [message,  setMessage]  = useState("");

  const handleLogin = async () => {
    if (!email || !password) { setError("Email and password are required."); return; }
    setLoading(true); setError("");
    try {
      const session = await sbAuth.signIn(email, password);
      const profile = await DB.getProfile(session.user.id);
      onLogin(profile);
    } catch(e) {
      setError(e.message || "Sign in failed. Check your credentials.");
    } finally { setLoading(false); }
  };

  const handleRegister = async () => {
    if (!email || !password || !name || !company) { setError("All fields are required."); return; }
    if (password.length < 6) { setError("Password must be at least 6 characters."); return; }
    setLoading(true); setError("");
    try {
      await sbAuth.signUp(email, password, name, company);
      setMessage("✅ Account created! Check your email to confirm, then sign in.");
      setTab("login");
    } catch(e) {
      setError(e.message || "Registration failed.");
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
          <p style={{ fontSize:13, color:C.mist, marginTop:4 }}>Fire Safety Inspection Platform</p>
        </div>

        <div style={{ background:C.ash, border:`1px solid ${C.smoke}`, borderRadius:16, padding:28, boxShadow:"0 24px 60px rgba(0,0,0,0.5)" }}>
          {/* Tabs */}
          <div style={{ display:"flex", gap:4, background:C.smoke, borderRadius:8, padding:4, marginBottom:24 }}>
            {[["login","Sign In"],["register","Register"]].map(([t,l]) => (
              <button key={t} onClick={()=>{ setTab(t); setError(""); setMessage(""); }} style={{ flex:1, padding:"8px", borderRadius:6, border:"none", background:tab===t?C.flame:"transparent", color:tab===t?"#fff":C.mist, fontSize:13, fontWeight:500, cursor:"pointer", transition:"all 0.15s" }}>{l}</button>
            ))}
          </div>

          {message && <div style={{ padding:"10px 14px", background:`${C.safe}15`, border:`1px solid ${C.safe}30`, borderRadius:6, fontSize:13, color:C.safe, marginBottom:16 }}>{message}</div>}
          {error   && <div style={{ padding:"10px 14px", background:`${C.danger}15`, border:`1px solid ${C.danger}30`, borderRadius:6, fontSize:13, color:C.danger, marginBottom:16 }}>{error}</div>}

          <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
            {tab==="register" && <>
              <Field label="Your Name" placeholder="Alex Martinez" icon="users" value={name} onChange={e=>setName(e.target.value)} required/>
              <Field label="Company Name" placeholder="FireGuard Pro LLC" icon="building" value={company} onChange={e=>setCompany(e.target.value)} required/>
            </>}
            <Field label="Email" type="email" placeholder="alex@fireguardpro.com" icon="mail" value={email} onChange={e=>setEmail(e.target.value)} required/>
            <Field label="Password" type="password" placeholder="••••••••" icon="lock" value={password} onChange={e=>setPassword(e.target.value)} required
              hint={tab==="register"?"Minimum 6 characters":undefined}/>

            <Btn full size="lg" onClick={tab==="login"?handleLogin:handleRegister} disabled={loading}>
              {loading ? <><Spinner/> {tab==="login"?"Signing in...":"Creating account..."}</> : tab==="login"?"Sign In":"Create Account"}
            </Btn>
          </div>

          {tab==="login" && (
            <p style={{ textAlign:"center", fontSize:12, color:C.mist, marginTop:16 }}>
              Don't have an account?{" "}
              <span onClick={()=>setTab("register")} style={{ color:C.flame, cursor:"pointer" }}>Register here</span>
            </p>
          )}
        </div>
        <p style={{ textAlign:"center", fontSize:11, color:C.steel, marginTop:20 }}>By continuing you agree to our Terms of Service & Privacy Policy</p>
      </div>
    </div>
  );
};

// ─── SIDEBAR ──────────────────────────────────────────────────────────────────
const NAV = [
  { id:"dashboard",    label:"Dashboard",   icon:"dashboard"  },
  { id:"scheduling",   label:"Scheduling",  icon:"calendar"   },
  { id:"inspections",  label:"Inspections", icon:"clipboard"  },
  { id:"deficiencies", label:"Deficiencies",icon:"alert"      },
  { id:"proposals",    label:"Proposals",   icon:"fileText"   },
  { id:"workorders",   label:"Service",     icon:"wrench"     },
  { id:"invoices",     label:"Invoices",    icon:"invoice"    },
  { id:"payments",     label:"Payments",    icon:"creditCard" },
  { id:"customers",    label:"Customers",   icon:"users"      },
  { id:"ai",           label:"AI Assistant",icon:"robot"      },
  { id:"settings",     label:"Settings",    icon:"settings"   },
];

const Sidebar = ({ active, onNav, user, collapsed, onToggle, onLogout }) => (
  <aside style={{ width:collapsed?64:220, minHeight:"100vh", background:C.ash, borderRight:`1px solid ${C.smoke}`, display:"flex", flexDirection:"column", transition:"width 0.25s ease", position:"fixed", left:0, top:0, bottom:0, zIndex:100, flexShrink:0 }}>
    <div style={{ height:60, display:"flex", alignItems:"center", padding:collapsed?"0 16px":"0 14px", gap:10, borderBottom:`1px solid ${C.smoke}` }}>
      <div style={{ width:32, height:32, borderRadius:8, background:`linear-gradient(135deg,${C.flame},${C.ember})`, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, animation:"flamePulse 3s ease-in-out infinite" }}>
        <Icon name="flame" size={18} color="#fff"/>
      </div>
      {!collapsed && <span style={{ fontFamily:"Syne,sans-serif", fontWeight:800, fontSize:15, color:C.white, letterSpacing:"-0.01em" }}>FireSafe</span>}
      <button onClick={onToggle} style={{ marginLeft:"auto", background:"none", border:"none", color:C.mist, padding:4, borderRadius:4, cursor:"pointer", transition:"color 0.15s" }}
        onMouseEnter={e=>e.currentTarget.style.color=C.white} onMouseLeave={e=>e.currentTarget.style.color=C.mist}>
        <Icon name="menu" size={16}/>
      </button>
    </div>

    <nav style={{ flex:1, padding:"10px 8px", overflowY:"auto", display:"flex", flexDirection:"column", gap:2 }}>
      {NAV.map(item => {
        const on = active===item.id;
        return (
          <button key={item.id} onClick={()=>onNav(item.id)} data-tip={collapsed?item.label:undefined}
            style={{ display:"flex", alignItems:"center", gap:10, padding:collapsed?"10px":"9px 10px", borderRadius:6, border:"none", width:"100%", background:on?`${C.flame}20`:"transparent", color:on?C.flame:C.mist, fontSize:13, fontWeight:on?600:400, transition:"all 0.12s", cursor:"pointer", justifyContent:collapsed?"center":"flex-start", position:"relative" }}
            onMouseEnter={e=>{ if(!on){ e.currentTarget.style.background=C.smoke; e.currentTarget.style.color=C.frost; }}}
            onMouseLeave={e=>{ if(!on){ e.currentTarget.style.background="transparent"; e.currentTarget.style.color=C.mist; }}}>
            {on && <span style={{ position:"absolute", left:0, top:"25%", bottom:"25%", width:3, background:C.flame, borderRadius:"0 2px 2px 0" }}/>}
            <Icon name={item.icon} size={16}/>
            {!collapsed && <span>{item.label}</span>}
            {!collapsed && item.id==="ai" && <Badge type="flame" size="sm">AI</Badge>}
          </button>
        );
      })}
    </nav>

    <div style={{ padding:collapsed?"10px 8px":"12px", borderTop:`1px solid ${C.smoke}`, display:"flex", alignItems:"center", gap:10 }}>
      <Avatar name={user?.full_name||"?"} size={32}/>
      {!collapsed && <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:12, fontWeight:600, color:C.frost, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{user?.full_name}</div>
        <div style={{ fontSize:10, color:C.mist, textTransform:"capitalize" }}>{user?.role}</div>
      </div>}
      {!collapsed && (
        <button onClick={onLogout} data-tip="Sign out" style={{ background:"none", border:"none", color:C.mist, padding:4, cursor:"pointer", transition:"color 0.15s" }}
          onMouseEnter={e=>e.currentTarget.style.color=C.danger} onMouseLeave={e=>e.currentTarget.style.color=C.mist}>
          <Icon name="logout" size={15}/>
        </button>
      )}
    </div>
  </aside>
);

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
const DashboardPage = ({ user }) => {
  const companyId = user?.company_id;

  const { data: stats, loading: statsLoading, error: statsErr } = useQuery(
    () => DB.getDashboardStats(companyId), [companyId]
  );
  const { data: recent, loading: recentLoading, error: recentErr } = useQuery(
    () => DB.getRecentInspections(companyId), [companyId]
  );

  const statCfg = [
    { label:"Inspections Today",   key:"inspectionsToday", icon:"clipboard", color:C.flame  },
    { label:"Open Deficiencies",   key:"openDeficiencies", icon:"alert",     color:C.danger },
    { label:"Pending Invoices",    key:"pendingInvoices",  icon:"invoice",   color:C.warn   },
    { label:"Revenue This Month",  key:"revenueThisMonth", icon:"dollar",    color:C.safe, prefix:"$" },
  ];

  const statusColor = { scheduled:"default", in_progress:"info", completed:"success", deficient:"danger", cancelled:"default" };
  const tradeLabel  = { fire_alarm:"Fire Alarm", sprinkler:"Sprinkler", extinguisher:"Extinguisher", special_hazard:"Special Hazard", fire_door:"Fire Door", backflow:"Backflow", chemical_suppression:"Chem. Suppression", facilities:"Facilities" };

  return (
    <div className="fade-in" style={{ padding:24, display:"flex", flexDirection:"column", gap:24 }}>
      {/* Welcome */}
      <div style={{ background:`linear-gradient(135deg,${C.flameDark}25,${C.ash})`, border:`1px solid ${C.flame}25`, borderRadius:12, padding:"20px 24px", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <div>
          <h2 style={{ fontFamily:"Syne,sans-serif", fontSize:20, fontWeight:700, color:C.white }}>Good morning, {(user?.full_name||"").split(" ")[0]} 👋</h2>
          <p style={{ fontSize:13, color:C.mist, marginTop:4 }}>{user?.company?.name} · {new Date().toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric"})}</p>
        </div>
        <div style={{ display:"flex", gap:10 }}>
          <Btn variant="secondary" icon="calendar" size="sm">Schedule Job</Btn>
          <Btn icon="plus" size="sm">New Inspection</Btn>
        </div>
      </div>

      {statsErr && <ErrorBanner msg={`Could not load stats: ${statsErr}`}/>}

      {/* Stats */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))", gap:16 }}>
        {statCfg.map(s => (
          <StatCard key={s.key} label={s.label} value={stats?.[s.key]??0} icon={s.icon} color={s.color} prefix={s.prefix||""} loading={statsLoading}/>
        ))}
      </div>

      {/* Recent Inspections */}
      <Card style={{ padding:0 }}>
        <div style={{ padding:"16px 20px", borderBottom:`1px solid ${C.smoke}`, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <h3 style={{ fontFamily:"Syne,sans-serif", fontSize:14, fontWeight:700 }}>Recent Inspections</h3>
          <Btn variant="ghost" size="sm">View All</Btn>
        </div>
        {recentErr && <ErrorBanner msg={recentErr}/>}
        <Table
          loading={recentLoading}
          data={recent||[]}
          emptyIcon="clipboard" emptyTitle="No inspections yet" emptyText="Schedule your first inspection to get started."
          columns={[
            { key:"building",    label:"Building",     render:(_,r)=>r.building?.name||"—" },
            { key:"trade",       label:"Type",         render:v=><Badge type="default">{tradeLabel[v]||v}</Badge> },
            { key:"technician",  label:"Technician",   render:(_,r)=><div style={{display:"flex",alignItems:"center",gap:8}}><Avatar name={r.technician?.full_name||"?"} size={22}/><span style={{fontSize:12}}>{r.technician?.full_name||"—"}</span></div> },
            { key:"status",      label:"Status",       render:v=><Badge type={statusColor[v]||"default"}>{v?.replace("_"," ")}</Badge> },
            { key:"score",       label:"Score",        align:"center", render:v=>v!=null?<span style={{fontWeight:700,color:v>=80?C.safe:v>=60?C.warn:C.danger}}>{v}%</span>:<span style={{color:C.steel}}>—</span> },
            { key:"scheduled_date", label:"Date",      render:v=>v?<span style={{fontSize:11,color:C.mist}}>{new Date(v).toLocaleDateString()}</span>:<span style={{color:C.steel}}>—</span> },
          ]}
        />
      </Card>
    </div>
  );
};

// ─── INSPECTIONS ──────────────────────────────────────────────────────────────
const InspectionsPage = ({ user }) => {
  const [filter, setFilter] = useState("all");
  const { data, loading, error, refetch } = useQuery(() => DB.getInspections(user.company_id, filter), [user.company_id, filter]);

  const statusColor = { scheduled:"default", in_progress:"info", completed:"success", deficient:"danger", cancelled:"default" };
  const filters = ["all","scheduled","in_progress","completed","deficient"];

  const counts = (data||[]).reduce((acc,i) => { acc[i.status]=(acc[i.status]||0)+1; return acc; }, {});

  return (
    <div className="fade-in" style={{ padding:24, display:"flex", flexDirection:"column", gap:20 }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <div style={{ display:"flex", gap:4, background:C.ash, border:`1px solid ${C.smoke}`, borderRadius:8, padding:4 }}>
          {filters.map(f => (
            <button key={f} onClick={()=>setFilter(f)} style={{ padding:"6px 14px", borderRadius:6, border:"none", background:filter===f?C.flame:"transparent", color:filter===f?"#fff":C.mist, fontSize:12, fontWeight:500, cursor:"pointer", transition:"all 0.12s" }}>
              {f==="all"?"All":f.replace("_"," ").replace(/\b\w/g,l=>l.toUpperCase())}
            </button>
          ))}
        </div>
        <Btn icon="plus" size="sm">New Inspection</Btn>
      </div>

      {/* Count pills */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:12 }}>
        {[
          {label:"Completed", key:"completed", color:C.safe},
          {label:"In Progress",key:"in_progress",color:C.info},
          {label:"Scheduled", key:"scheduled",  color:C.mist},
          {label:"Deficient", key:"deficient",  color:C.danger},
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
          emptyIcon="clipboard" emptyTitle="No inspections found" emptyText="Try changing the filter or create a new inspection."
          columns={[
            { key:"building",   label:"Building",   render:(_,r)=>r.building?.name||"—" },
            { key:"customer",   label:"Customer",   render:(_,r)=><span style={{fontSize:12,color:C.mist}}>{r.customer?.name||"—"}</span> },
            { key:"trade",      label:"Trade",      render:v=><Badge type="default">{v?.replace(/_/g," ")}</Badge> },
            { key:"technician", label:"Technician", render:(_,r)=><div style={{display:"flex",alignItems:"center",gap:8}}><Avatar name={r.technician?.full_name||"?"} size={22}/><span style={{fontSize:12}}>{r.technician?.full_name||"—"}</span></div> },
            { key:"status",     label:"Status",     render:v=><Badge type={statusColor[v]||"default"}>{v?.replace("_"," ")}</Badge> },
            { key:"score",      label:"Score",      align:"center", render:v=>v!=null?<span style={{fontWeight:700,color:v>=80?C.safe:v>=60?C.warn:C.danger}}>{v}%</span>:<span style={{color:C.steel}}>—</span> },
            { key:"scheduled_date", label:"Date",   render:v=>v?<span style={{fontSize:11,color:C.mist}}>{new Date(v).toLocaleDateString()}</span>:<span style={{color:C.steel}}>—</span> },
          ]}
        />
      </Card>
    </div>
  );
};

// ─── DEFICIENCIES ─────────────────────────────────────────────────────────────
const DeficienciesPage = ({ user }) => {
  const [filter, setFilter] = useState("all");
  const { data, loading, error, refetch } = useQuery(() => DB.getDeficiencies(user.company_id, filter), [user.company_id, filter]);

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
              {f==="all"?"All":f.replace("_"," ").replace(/\b\w/g,l=>l.toUpperCase())}
            </button>
          ))}
        </div>
        <Btn icon="plus" size="sm">Log Deficiency</Btn>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:12 }}>
        {[{label:"Open",key:"open",color:C.danger},{label:"Quoted",key:"quoted",color:C.warn},{label:"Repaired",key:"repaired",color:C.safe},{label:"Verified",key:"verified",color:C.info}].map(s=>(
          <Card key={s.key} style={{padding:14,textAlign:"center"}}>
            <div style={{fontSize:24,fontWeight:800,fontFamily:"Syne,sans-serif",color:s.color}}>{loading?"—":counts[s.key]||0}</div>
            <div style={{fontSize:11,color:C.mist,marginTop:4}}>{s.label}</div>
          </Card>
        ))}
      </div>

      {error && <ErrorBanner msg={error} onRetry={refetch}/>}

      <Card style={{ padding:0 }}>
        <Table loading={loading} data={data||[]}
          emptyIcon="alert" emptyTitle="No deficiencies found" emptyText="All clear! No deficiencies match this filter."
          columns={[
            { key:"title",      label:"Issue",      render:v=><span style={{fontSize:12,color:C.frost}}>{v}</span> },
            { key:"building",   label:"Building",   render:(_,r)=>r.building?.name||"—" },
            { key:"severity",   label:"Severity",   render:v=><Badge type={sevColor[v]||"default"}>{v}</Badge> },
            { key:"status",     label:"Status",     render:v=><Badge type={statColor[v]||"default"}>{v?.replace("_"," ")}</Badge> },
            { key:"assignee",   label:"Assigned",   render:(_,r)=>r.assignee?<div style={{display:"flex",alignItems:"center",gap:6}}><Avatar name={r.assignee.full_name} size={20}/><span style={{fontSize:12}}>{r.assignee.full_name}</span></div>:<span style={{color:C.steel}}>Unassigned</span> },
            { key:"nfpa_reference", label:"NFPA",   render:v=>v?<span style={{fontSize:11,color:C.mist,fontFamily:"monospace"}}>{v}</span>:<span style={{color:C.steel}}>—</span> },
            { key:"identified_at",  label:"Logged", render:v=><span style={{fontSize:11,color:C.mist}}>{new Date(v).toLocaleDateString()}</span> },
          ]}
        />
      </Card>
    </div>
  );
};

// ─── CUSTOMERS ────────────────────────────────────────────────────────────────
const CustomersPage = ({ user }) => {
  const { data, loading, error, refetch } = useQuery(() => DB.getCustomers(user.company_id), [user.company_id]);
  const [search, setSearch] = useState("");
  const filtered = (data||[]).filter(c => c.name.toLowerCase().includes(search.toLowerCase()) || (c.contact_name||"").toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="fade-in" style={{ padding:24, display:"flex", flexDirection:"column", gap:20 }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <div style={{ position:"relative" }}>
          <Icon name="search" size={14} color={C.mist} style={{ position:"absolute", left:10, top:"50%", transform:"translateY(-50%)" }}/>
          <input placeholder="Search customers..." value={search} onChange={e=>setSearch(e.target.value)}
            style={{ background:C.smoke, border:`1px solid ${C.steel}`, borderRadius:6, padding:"8px 12px 8px 32px", fontSize:12, color:C.frost, width:260 }}
            onFocus={e=>e.target.style.borderColor=C.flame} onBlur={e=>e.target.style.borderColor=C.steel}/>
        </div>
        <Btn icon="plus">Add Customer</Btn>
      </div>

      {error && <ErrorBanner msg={error} onRetry={refetch}/>}

      <Card style={{ padding:0 }}>
        <Table loading={loading} data={filtered}
          emptyIcon="users" emptyTitle="No customers yet" emptyText="Add your first customer to get started."
          columns={[
            { key:"name", label:"Company", render:(v,r)=>(
              <div style={{display:"flex",alignItems:"center",gap:10}}>
                <div style={{width:32,height:32,borderRadius:8,background:`${C.flame}18`,display:"flex",alignItems:"center",justifyContent:"center"}}><Icon name="building" size={16} color={C.flame}/></div>
                <div>
                  <div style={{fontWeight:600,color:C.white,fontSize:13}}>{v}</div>
                  <div style={{fontSize:11,color:C.mist}}>{r.email||"—"}</div>
                </div>
              </div>
            )},
            { key:"contact_name",  label:"Contact",   render:v=>v||<span style={{color:C.steel}}>—</span> },
            { key:"buildings",     label:"Buildings", align:"center", render:v=><span style={{background:C.smoke,padding:"2px 10px",borderRadius:12,fontSize:12}}>{v?.length||0}</span> },
            { key:"is_active",     label:"Status",    render:v=><Badge type={v?"success":"default"}>{v?"Active":"Inactive"}</Badge> },
            { key:"id",            label:"",          render:()=><div style={{display:"flex",gap:6}}><Btn variant="ghost" size="sm" icon="eye">View</Btn><Btn variant="secondary" size="sm">Schedule</Btn></div> },
          ]}
        />
      </Card>
    </div>
  );
};

// ─── INVOICES ─────────────────────────────────────────────────────────────────
const InvoicesPage = ({ user }) => {
  const [filter, setFilter] = useState("all");
  const { data, loading, error, refetch } = useQuery(() => DB.getInvoices(user.company_id, filter), [user.company_id, filter]);

  const statColor = { draft:"default", sent:"info", pending:"warning", paid:"success", overdue:"danger", void:"default" };
  const all = data||[];
  const totalOutstanding = all.filter(i=>i.status!=="paid"&&i.status!=="void").reduce((s,i)=>s+Number(i.balance_due||0),0);
  const totalPaid        = all.filter(i=>i.status==="paid").reduce((s,i)=>s+Number(i.total||0),0);

  return (
    <div className="fade-in" style={{ padding:24, display:"flex", flexDirection:"column", gap:20 }}>
      <div style={{ display:"flex", gap:12, alignItems:"flex-start" }}>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:12, flex:1 }}>
          {[
            {label:"Outstanding",value:`$${totalOutstanding.toLocaleString()}`,color:C.warn},
            {label:"Paid (shown)",value:`$${totalPaid.toLocaleString()}`,color:C.safe},
            {label:"Overdue",value:all.filter(i=>i.status==="overdue").length,color:C.danger},
            {label:"Total Records",value:all.length,color:C.mist},
          ].map((s,i)=>(
            <Card key={i} style={{padding:14}}>
              <div style={{fontSize:11,color:C.mist,marginBottom:6}}>{s.label}</div>
              <div style={{fontSize:20,fontWeight:800,fontFamily:"Syne,sans-serif",color:s.color}}>{loading?"—":s.value}</div>
            </Card>
          ))}
        </div>
        <Btn icon="plus">Create Invoice</Btn>
      </div>

      <div style={{ display:"flex", gap:4, background:C.ash, border:`1px solid ${C.smoke}`, borderRadius:8, padding:4, alignSelf:"flex-start" }}>
        {["all","draft","pending","paid","overdue"].map(f=>(
          <button key={f} onClick={()=>setFilter(f)} style={{ padding:"6px 14px", borderRadius:6, border:"none", background:filter===f?C.flame:"transparent", color:filter===f?"#fff":C.mist, fontSize:12, fontWeight:500, cursor:"pointer", transition:"all 0.12s" }}>
            {f==="all"?"All":f.charAt(0).toUpperCase()+f.slice(1)}
          </button>
        ))}
      </div>

      {error && <ErrorBanner msg={error} onRetry={refetch}/>}

      <Card style={{ padding:0 }}>
        <Table loading={loading} data={all}
          emptyIcon="invoice" emptyTitle="No invoices yet" emptyText="Convert an inspection or proposal into an invoice."
          columns={[
            { key:"invoice_number", label:"Invoice #",  render:v=><span style={{fontFamily:"monospace",color:C.info,fontWeight:600}}>{v}</span> },
            { key:"customer",       label:"Customer",   render:(_,r)=>r.customer?.name||"—" },
            { key:"total",          label:"Total",      render:v=><span style={{fontWeight:600,color:C.white}}>${Number(v).toLocaleString()}</span> },
            { key:"balance_due",    label:"Balance Due",render:v=>Number(v)>0?<span style={{color:C.danger,fontWeight:600}}>${Number(v).toLocaleString()}</span>:<span style={{color:C.safe}}>$0</span> },
            { key:"status",         label:"Status",     render:v=><Badge type={statColor[v]||"default"}>{v}</Badge> },
            { key:"due_date",       label:"Due",        render:v=>v?<span style={{fontSize:11,color:C.mist}}>{new Date(v).toLocaleDateString()}</span>:<span style={{color:C.steel}}>—</span> },
            { key:"id",             label:"",           render:(_,r)=><div style={{display:"flex",gap:6}}><Btn variant="ghost" size="sm" icon="eye">View</Btn>{r.status!=="paid"&&<Btn size="sm" icon="mail">Send</Btn>}</div> },
          ]}
        />
      </Card>
    </div>
  );
};

// ─── SCHEDULING ───────────────────────────────────────────────────────────────
const SchedulingPage = ({ user }) => {
  const today = new Date();
  const dayOfWeek = today.getDay();
  const monday = new Date(today); monday.setDate(today.getDate() - (dayOfWeek===0?6:dayOfWeek-1));
  const sunday = new Date(monday); sunday.setDate(monday.getDate()+6);

  const fmt = d => d.toISOString().split("T")[0];
  const { data, loading, error, refetch } = useQuery(() => DB.getSchedules(user.company_id, fmt(monday), fmt(sunday)), [user.company_id]);

  const days = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
  const tradeColor = { fire_alarm:C.flame, sprinkler:C.info, extinguisher:C.safe, special_hazard:C.warn, fire_door:C.mist, facilities:C.ember };

  const jobsByDay = (data||[]).reduce((acc, job) => {
    const d = new Date(job.scheduled_date+"T12:00:00");
    let dow = d.getDay()-1; if(dow===-1) dow=6;
    acc[dow] = acc[dow]||[];
    acc[dow].push(job);
    return acc;
  }, {});

  const { data: techs } = useQuery(() => DB.getTechnicians(user.company_id), [user.company_id]);
  const statusDot = { available:C.safe, on_site:C.flame, en_route:C.info, break:C.warn, off_duty:C.steel };

  return (
    <div className="fade-in" style={{ padding:24, display:"flex", flexDirection:"column", gap:20 }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <div style={{ fontSize:14, fontWeight:600, color:C.frost }}>
          Week of {monday.toLocaleDateString("en-US",{month:"short",day:"numeric"})} – {sunday.toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})}
        </div>
        <Btn icon="plus" size="sm">Schedule Job</Btn>
      </div>

      {error && <ErrorBanner msg={error} onRetry={refetch}/>}

      {/* Calendar */}
      <Card style={{ padding:0 }}>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", borderBottom:`1px solid ${C.smoke}` }}>
          {days.map((d,i)=>{ const date=new Date(monday); date.setDate(monday.getDate()+i); const isToday=date.toDateString()===today.toDateString(); return (
            <div key={d} style={{ padding:"12px 10px", textAlign:"center", borderRight:i<6?`1px solid ${C.smoke}`:"none", background:isToday?`${C.flame}10`:"transparent" }}>
              <div style={{ fontSize:11, color:C.mist, fontWeight:500, marginBottom:4 }}>{d}</div>
              <div style={{ width:28, height:28, borderRadius:"50%", background:isToday?C.flame:"transparent", display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto", fontSize:13, fontWeight:isToday?700:400, color:isToday?"#fff":C.frost }}>{date.getDate()}</div>
            </div>
          );})}
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", minHeight:300 }}>
          {days.map((d,i)=>{
            const jobs = jobsByDay[i]||[];
            const isWeekend = i>=5;
            return (
              <div key={d} style={{ padding:"8px", borderRight:i<6?`1px solid ${C.smoke}`:"none", display:"flex", flexDirection:"column", gap:6, background:isWeekend?`${C.smoke}30`:"transparent" }}>
                {loading && i===0 && <div style={{fontSize:11,color:C.mist,padding:8}}>Loading...</div>}
                {jobs.map((job,j)=>{ const col=tradeColor[job.trade]||C.mist; return (
                  <div key={j} style={{ padding:8, borderRadius:6, background:`${col}15`, borderLeft:`3px solid ${col}`, cursor:"pointer", transition:"background 0.12s" }}
                    onMouseEnter={e=>e.currentTarget.style.background=`${col}28`} onMouseLeave={e=>e.currentTarget.style.background=`${col}15`}>
                    <div style={{ fontSize:11, fontWeight:600, color:C.white, lineHeight:1.3 }}>{job.building?.name||job.title}</div>
                    <div style={{ fontSize:10, color:C.mist, marginTop:3 }}>{job.scheduled_time?.slice(0,5)||"—"} · {job.technician?.full_name?.split(" ")[0]||"Unassigned"}</div>
                  </div>
                );})}
                {!loading && jobs.length===0 && !isWeekend && (
                  <div style={{ flex:1, border:`1px dashed ${C.smoke}`, borderRadius:6, display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, color:C.steel, cursor:"pointer", minHeight:60 }}
                    onMouseEnter={e=>{e.currentTarget.style.borderColor=C.flame;e.currentTarget.style.color=C.flame;}} onMouseLeave={e=>{e.currentTarget.style.borderColor=C.smoke;e.currentTarget.style.color=C.steel;}}>
                    + Add
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      {/* Technician Status */}
      {(techs||[]).length > 0 && (
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))", gap:12 }}>
          {(techs||[]).map((t,i)=>(
            <Card key={i} style={{ padding:14 }}>
              <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                <Avatar name={t.full_name} size={30}/>
                <div>
                  <div style={{ fontSize:12, fontWeight:600, color:C.white }}>{t.full_name}</div>
                  <div style={{ display:"flex", alignItems:"center", gap:4, marginTop:2 }}>
                    <span style={{ width:6, height:6, borderRadius:"50%", background:statusDot[t.status]||C.mist }}/>
                    <span style={{ fontSize:10, color:statusDot[t.status]||C.mist, textTransform:"capitalize" }}>{t.status?.replace("_"," ")||"—"}</span>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

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
    else if (lower.includes("draft")||lower.includes("note")) reply = "**Inspection Notes — Fire Alarm System**\n\nSystem: FACP — [Manufacturer/Model]\nDate: " + new Date().toLocaleDateString() + "\n\nFindings:\n— Visual inspection: PASS\n— Smoke detector functional test: FAIL (3 units in zones 2, 4, 7 unresponsive)\n— Manual pull station test: PASS\n— Horn/strobe activation: PASS\n— Battery backup (4hr load test): PASS\n\nDeficiencies logged: 3 smoke detectors require replacement per NFPA 72 §14.4.";
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
            placeholder="Ask about inspections, fire codes, deficiencies..."
            style={{ flex:1, background:C.smoke, border:`1px solid ${C.steel}`, borderRadius:8, padding:"10px 14px", fontSize:13, color:C.white }}
            onFocus={e=>e.target.style.borderColor=C.flame} onBlur={e=>e.target.style.borderColor=C.steel}/>
          <Btn onClick={()=>send()} icon="zap" disabled={!input.trim()||loading}>Send</Btn>
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
export default function App() {
  const [user,      setUser]      = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [page,      setPage]      = useState("dashboard");
  const [collapsed, setCollapsed] = useState(false);

  // Restore session on mount
  useEffect(() => {
    (async () => {
      try {
        const session = sbAuth.restoreSession();
        if (session?.access_token && session?.user) {
          const profile = await DB.getProfile(session.user.id);
          if (profile) setUser(profile);
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

  // Loading splash
  if (!authReady) return (
    <>
      <GlobalStyles/>
      <div style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", background:C.coal }}>
        <div style={{ textAlign:"center" }}>
          <div style={{ width:48,height:48,borderRadius:12,background:`linear-gradient(135deg,${C.flame},${C.ember})`,display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 16px",animation:"flamePulse 2s ease-in-out infinite" }}><Icon name="flame" size={24} color="#fff"/></div>
          <div style={{ fontSize:13, color:C.mist }}>Loading FireSafe Pro…</div>
        </div>
      </div>
    </>
  );

  if (!user) return (<><GlobalStyles/><LoginScreen onLogin={setUser}/></>);

  const sw = collapsed ? 64 : 220;
  const companyName = user?.company?.name || "";

  const PAGES = {
    dashboard:    { title:"Dashboard",       subtitle:companyName,                         component:<DashboardPage    user={user}/> },
    scheduling:   { title:"Scheduling",      subtitle:"Manage technician jobs & calendar", component:<SchedulingPage   user={user}/> },
    inspections:  { title:"Inspections",     subtitle:"View and manage all inspections",   component:<InspectionForms user={user} supabase={{ url:SUPABASE_URL, anonKey:SUPABASE_ANON_KEY, jwt:SUPABASE_JWT }}/> },
    deficiencies: { title:"Deficiencies",    subtitle:"Track and resolve safety issues",   component:<DeficienciesPage user={user}/> },
    proposals:    { title:"Proposals",       subtitle:"Create and manage client proposals",component:<Placeholder title="Proposals"    icon="fileText"   description="Create professional proposals tied to deficiencies. Clients can approve digitally." cta="Create Proposal"/> },
    workorders:   { title:"Service",         subtitle:"Work orders and service requests",  component:<Placeholder title="Work Orders" icon="wrench"     description="Manage repair work orders, emergency calls, and link to deficiencies." cta="Create Work Order"/> },
    invoices:     { title:"Invoices",        subtitle:"Billing and payment tracking",      component:<InvoicesPage     user={user}/> },
    payments:     { title:"Payments",        subtitle:"Collect payments from clients",     component:<Placeholder title="Payments"    icon="creditCard" description="Integrated Stripe payments. Send links, track collections, automate reminders." cta="Set Up Payments"/> },
    customers:    { title:"Customers",       subtitle:"Manage buildings and contacts",     component:<CustomersPage    user={user}/> },
    ai:           { title:"AI Assistant",    subtitle:"Powered by Claude AI",             component:<AIPage/> },
    settings:     { title:"Settings",        subtitle:"Account and system configuration", component:<Placeholder title="Settings"    icon="settings"   description="Configure company profile, team members, notifications, and integrations." cta="Open Settings"/> },
  };

  const current = PAGES[page] || PAGES.dashboard;

  return (
    <>
      <GlobalStyles/>
      <div style={{ display:"flex", minHeight:"100vh", background:C.coal }}>
        <Sidebar active={page} onNav={setPage} user={user} collapsed={collapsed} onToggle={()=>setCollapsed(c=>!c)} onLogout={handleLogout}/>
        <div style={{ marginLeft:sw, flex:1, display:"flex", flexDirection:"column", minWidth:0, transition:"margin-left 0.25s ease" }}>
          <Header title={current.title} subtitle={current.subtitle} user={user}
            actions={page==="dashboard"?<Btn variant="secondary" size="sm" icon="trendUp">Reports</Btn>:undefined}/>
          <main style={{ flex:1, overflowY:"auto" }}>{current.component}</main>
        </div>
      </div>
    </>
  );
}
