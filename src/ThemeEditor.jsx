// ============================================================
// FireSafe Pro — Éditeur de thème complet
// ThemeEditor.jsx
// ============================================================
// Provides a global theme context + a full visual editor.
// Usage in App.jsx:
//   import { ThemeProvider, useTheme } from "./ThemeEditor";
//   Wrap root: <ThemeProvider><App/></ThemeProvider>
//   In Settings: import ThemeEditor from "./ThemeEditor"; <ThemeEditor/>
// ============================================================

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";

// ─── DEFAULT THEME ────────────────────────────────────────────────────────────
export const DEFAULT_THEME = {
  // Backgrounds
  bgPage:        "#0D0D0D",
  bgSurface:     "#1A1A1A",
  bgCard:        "#1A1A1A",
  bgInput:       "#2A2A2A",
  bgNavbar:      "#1A1A1A",
  bgSidebar:     "#111111",
  bgHover:       "#2A2A2A",

  // Borders
  borderColor:   "#2A2A2A",
  borderStrong:  "#3A3A3A",

  // Text
  textPrimary:   "#FAFAFA",
  textSecondary: "#E8E8E8",
  textMuted:     "#8A8A8A",
  textDisabled:  "#555555",

  // Brand / Accent
  accentPrimary: "#FF4500",
  accentHover:   "#FF6A33",
  accentText:    "#FFFFFF",

  // Semantic
  colorSuccess:  "#22C55E",
  colorWarning:  "#F59E0B",
  colorDanger:   "#EF4444",
  colorInfo:     "#3B82F6",

  // Buttons
  btnPrimaryBg:  "#FF4500",
  btnPrimaryText:"#FFFFFF",
  btnSecBg:      "transparent",
  btnSecText:    "#E8E8E8",
  btnSecBorder:  "#3A3A3A",

  // Nav active state
  navActiveBg:   "#FF450018",
  navActiveText: "#FF4500",
  navText:       "#8A8A8A",

  // Table
  tableHeaderBg: "#111111",
  tableRowHover: "#2A2A2A",
  tableText:     "#FAFAFA",
};

const PRESETS = {
  "🔥 FireSafe (défaut)": DEFAULT_THEME,
  "🌙 Minuit": {
    ...DEFAULT_THEME,
    bgPage:"#050510", bgSurface:"#0D0D1A", bgCard:"#0D0D1A", bgInput:"#15152A",
    bgNavbar:"#0D0D1A", bgSidebar:"#08080F", bgHover:"#15152A",
    borderColor:"#1A1A30", borderStrong:"#252540",
    accentPrimary:"#6366F1", accentHover:"#818CF8", navActiveText:"#6366F1",
    navActiveBg:"#6366F118", btnPrimaryBg:"#6366F1",
  },
  "🌿 Forêt": {
    ...DEFAULT_THEME,
    bgPage:"#071208", bgSurface:"#0F1E10", bgCard:"#0F1E10", bgInput:"#162318",
    bgNavbar:"#0F1E10", bgSidebar:"#091509", bgHover:"#1A2E1C",
    borderColor:"#1A2E1C", borderStrong:"#243D26",
    accentPrimary:"#22C55E", accentHover:"#4ADE80", navActiveText:"#22C55E",
    navActiveBg:"#22C55E18", btnPrimaryBg:"#22C55E", btnPrimaryText:"#071208",
  },
  "☀️ Lumière": {
    ...DEFAULT_THEME,
    bgPage:"#F4F4F5", bgSurface:"#FFFFFF", bgCard:"#FFFFFF", bgInput:"#F4F4F5",
    bgNavbar:"#FFFFFF", bgSidebar:"#F4F4F5", bgHover:"#F0F0F0",
    borderColor:"#E4E4E7", borderStrong:"#D4D4D8",
    textPrimary:"#18181B", textSecondary:"#27272A", textMuted:"#71717A", textDisabled:"#A1A1AA",
    navText:"#71717A", tableText:"#18181B", tableHeaderBg:"#F4F4F5", tableRowHover:"#F0F0F0",
    accentPrimary:"#FF4500", accentHover:"#FF6A33", navActiveText:"#FF4500",
    navActiveBg:"#FF450015", btnPrimaryBg:"#FF4500",
    btnSecText:"#18181B", btnSecBorder:"#D4D4D8",
  },
  "🌊 Océan": {
    ...DEFAULT_THEME,
    bgPage:"#040D1A", bgSurface:"#071525", bgCard:"#071525", bgInput:"#0C1F35",
    bgNavbar:"#071525", bgSidebar:"#040D1A", bgHover:"#0C1F35",
    borderColor:"#0C1F35", borderStrong:"#122840",
    accentPrimary:"#0EA5E9", accentHover:"#38BDF8", navActiveText:"#0EA5E9",
    navActiveBg:"#0EA5E918", btnPrimaryBg:"#0EA5E9", btnPrimaryText:"#040D1A",
  },
  "🌸 Sakura": {
    ...DEFAULT_THEME,
    bgPage:"#1A0A10", bgSurface:"#2A1018", bgCard:"#2A1018", bgInput:"#351520",
    bgNavbar:"#2A1018", bgSidebar:"#150810", bgHover:"#351520",
    borderColor:"#3A1A25", borderStrong:"#4A2030",
    accentPrimary:"#EC4899", accentHover:"#F472B6", navActiveText:"#EC4899",
    navActiveBg:"#EC489918", btnPrimaryBg:"#EC4899",
  },
};

// ─── THEME CONTEXT ────────────────────────────────────────────────────────────
const ThemeContext = createContext({ theme: DEFAULT_THEME, setTheme: ()=>{} });

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(() => {
    try {
      const saved = localStorage.getItem("fsTheme");
      return saved ? {...DEFAULT_THEME, ...JSON.parse(saved)} : DEFAULT_THEME;
    } catch(e) { return DEFAULT_THEME; }
  });

  const setTheme = useCallback((t) => {
    const merged = {...DEFAULT_THEME, ...t};
    setThemeState(merged);
    localStorage.setItem("fsTheme", JSON.stringify(merged));
    applyThemeToCss(merged);
    // Notify app to re-render with new colors
    window.dispatchEvent(new Event("fsThemeChanged"));
  }, []);

  useEffect(() => { applyThemeToCss(theme); }, []);

  return <ThemeContext.Provider value={{theme, setTheme}}>{children}</ThemeContext.Provider>;
}

export function useTheme() { return useContext(ThemeContext); }

function applyThemeToCss(theme) {
  const root = document.documentElement;
  Object.entries(theme).forEach(([k, v]) => {
    root.style.setProperty(`--fs-${k}`, v);
  });
  // Also set body background immediately
  document.body.style.background = theme.bgPage;
}

// ─── MINI UI FOR EDITOR ───────────────────────────────────────────────────────
function Row({ children, style={} }) {
  return <div style={{display:"flex",gap:12,alignItems:"stretch",...style}}>{children}</div>;
}

function Grid({ children, cols=2 }) {
  return <div style={{display:"grid",gridTemplateColumns:`repeat(${cols},1fr)`,gap:10}}>{children}</div>;
}

function Swatch({ value, onChange, label, hint }) {
  return (
    <div style={{display:"flex",flexDirection:"column",gap:5}}>
      <label style={{fontSize:10,color:"#8A8A8A",textTransform:"uppercase",letterSpacing:"0.05em",fontWeight:600}}>{label}</label>
      <div style={{display:"flex",gap:8,alignItems:"center"}}>
        <div style={{position:"relative",flexShrink:0}}>
          <input type="color" value={value||"#000000"}
            onChange={e=>onChange(e.target.value)}
            style={{width:40,height:32,borderRadius:6,border:"1px solid #3A3A3A",
              background:"#2A2A2A",cursor:"pointer",padding:2}}/>
        </div>
        <input value={value||""} onChange={e=>onChange(e.target.value)}
          placeholder="#000000"
          style={{flex:1,padding:"6px 9px",background:"#2A2A2A",border:"1px solid #3A3A3A",
            borderRadius:6,color:"#FAFAFA",fontSize:12,fontFamily:"monospace"}}
        />
        <div style={{width:24,height:24,borderRadius:4,background:value||"#000",
          border:"1px solid #3A3A3A",flexShrink:0}}/>
      </div>
      {hint&&<span style={{fontSize:10,color:"#555"}}>{hint}</span>}
    </div>
  );
}

function Section({ title, children, collapsed=false }) {
  const [open, setOpen] = useState(!collapsed);
  return (
    <div style={{border:"1px solid #2A2A2A",borderRadius:8,overflow:"hidden",marginBottom:12}}>
      <button onClick={()=>setOpen(o=>!o)}
        style={{width:"100%",padding:"11px 14px",background:"#111",border:"none",
          color:"#E8E8E8",fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"inherit",
          display:"flex",justifyContent:"space-between",alignItems:"center",textAlign:"left"}}>
        {title}
        <span style={{color:"#555",fontSize:16,transform:open?"rotate(180deg)":"none",transition:"transform 0.2s"}}>&#9662;</span>
      </button>
      {open&&<div style={{padding:14,background:"#1A1A1A",display:"flex",flexDirection:"column",gap:12}}>{children}</div>}
    </div>
  );
}

// ─── LIVE PREVIEW ─────────────────────────────────────────────────────────────
function LivePreview({ theme: T }) {
  return (
    <div style={{borderRadius:10,overflow:"hidden",border:"1px solid #2A2A2A",flexShrink:0,width:260}}>
      <div style={{fontSize:10,color:"#8A8A8A",textTransform:"uppercase",letterSpacing:"0.05em",
        fontWeight:600,padding:"8px 12px",background:"#111",borderBottom:"1px solid #2A2A2A"}}>
        Aperçu en direct
      </div>
      {/* Mini app */}
      <div style={{display:"flex",height:340,background:T.bgPage}}>
        {/* Sidebar */}
        <div style={{width:80,background:T.bgSidebar,borderRight:`1px solid ${T.borderColor}`,padding:"12px 8px",display:"flex",flexDirection:"column",gap:4}}>
          {["🏠","📅","🔍","📋","👥"].map((icon,i)=>(
            <div key={i} style={{padding:"7px",borderRadius:6,background:i===0?T.navActiveBg:"transparent",
              color:i===0?T.navActiveText:T.navText,textAlign:"center",fontSize:16,cursor:"pointer"}}>
              {icon}
            </div>
          ))}
        </div>
        {/* Main */}
        <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>
          {/* Topbar */}
          <div style={{padding:"8px 12px",background:T.bgNavbar,borderBottom:`1px solid ${T.borderColor}`,
            display:"flex",alignItems:"center",justifyContent:"space-between"}}>
            <span style={{fontSize:11,fontWeight:700,color:T.accentPrimary}}>FireSafe Pro</span>
            <div style={{width:22,height:22,borderRadius:"50%",background:T.accentPrimary}}/>
          </div>
          {/* Content */}
          <div style={{flex:1,padding:10,overflow:"hidden",display:"flex",flexDirection:"column",gap:8}}>
            {/* Cards */}
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>
              {[{label:"Inspections",val:"12",col:T.colorInfo},{label:"Déficiences",val:"3",col:T.colorDanger}].map((c,i)=>(
                <div key={i} style={{background:T.bgCard,border:`1px solid ${T.borderColor}`,borderRadius:6,padding:"8px 10px"}}>
                  <div style={{fontSize:9,color:T.textMuted,marginBottom:3}}>{c.label}</div>
                  <div style={{fontSize:16,fontWeight:800,color:c.col}}>{c.val}</div>
                </div>
              ))}
            </div>
            {/* Table rows */}
            <div style={{background:T.bgCard,border:`1px solid ${T.borderColor}`,borderRadius:6,overflow:"hidden"}}>
              <div style={{padding:"6px 8px",background:T.tableHeaderBg,borderBottom:`1px solid ${T.borderColor}`,fontSize:9,color:T.textMuted,fontWeight:600,textTransform:"uppercase"}}>CLIENTS</div>
              {["Gold Corp","Acme Inc","Beta Ltd"].map((n,i)=>(
                <div key={i} style={{padding:"6px 8px",borderBottom:i<2?`1px solid ${T.borderColor}`:"none",
                  fontSize:10,color:T.tableText,background:i===1?T.tableRowHover:"transparent",
                  display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  {n}
                  <span style={{fontSize:9,color:T.colorSuccess,background:`${T.colorSuccess}20`,padding:"1px 6px",borderRadius:10}}>Actif</span>
                </div>
              ))}
            </div>
            {/* Buttons */}
            <div style={{display:"flex",gap:6}}>
              <button style={{padding:"5px 10px",borderRadius:5,border:"none",background:T.btnPrimaryBg,color:T.btnPrimaryText,fontSize:10,cursor:"pointer",fontFamily:"inherit",fontWeight:600}}>+ Créer</button>
              <button style={{padding:"5px 10px",borderRadius:5,border:`1px solid ${T.btnSecBorder}`,background:T.btnSecBg,color:T.btnSecText,fontSize:10,cursor:"pointer",fontFamily:"inherit"}}>Filtrer</button>
            </div>
            {/* Input */}
            <input placeholder="Rechercher..." style={{padding:"5px 8px",background:T.bgInput,border:`1px solid ${T.borderStrong}`,borderRadius:5,color:T.textPrimary,fontSize:10,fontFamily:"inherit",width:"100%"}}/>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── MAIN EDITOR ──────────────────────────────────────────────────────────────
export default function ThemeEditor() {
  const { theme, setTheme } = useTheme();
  const [local, setLocal] = useState({...theme});
  const [activePreset, setActivePreset] = useState(null);
  const [toast, setToast] = useState(null);

  const set = useCallback((k) => (v) => {
    setLocal(prev => {
      const next = {...prev, [k]:v};
      return next;
    });
    setActivePreset(null);
  }, []);

  // Live preview updates as you change
  useEffect(() => { applyThemeToCss(local); }, [local]);

  const applyPreset = (name) => {
    const p = PRESETS[name];
    setLocal({...p});
    setActivePreset(name);
  };

  const save = () => {
    setTheme(local);
    // Also apply immediately and notify app
    applyThemeToCss(local);
    localStorage.setItem("fsTheme", JSON.stringify({...DEFAULT_THEME,...local}));
    window.dispatchEvent(new Event("fsThemeChanged"));
    setToast("Thème enregistré !");
    setTimeout(()=>setToast(null),2500);
  };

  const reset = () => {
    setLocal({...DEFAULT_THEME});
    setActivePreset("🔥 FireSafe (défaut)");
  };

  const exportTheme = () => {
    const blob = new Blob([JSON.stringify(local, null, 2)], {type:"application/json"});
    const a = document.createElement("a"); a.href=URL.createObjectURL(blob);
    a.download="firesafe-theme.json"; a.click();
  };

  const importTheme = (e) => {
    const file = e.target.files[0]; if(!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try { setLocal({...DEFAULT_THEME,...JSON.parse(ev.target.result)}); setActivePreset(null); } catch(e) { alert("Fichier de thème invalide"); }
    };
    reader.readAsText(file);
  };

  return (
    <div style={{display:"flex",gap:16,alignItems:"flex-start",minHeight:0}}>
      {/* ── EDITOR PANEL ── */}
      <div style={{flex:1,overflowY:"auto",maxHeight:"calc(100vh - 160px)"}}>

        {/* Presets */}
        <div style={{marginBottom:14}}>
          <div style={{fontSize:11,color:"#8A8A8A",textTransform:"uppercase",letterSpacing:"0.05em",fontWeight:600,marginBottom:8}}>Thèmes prédéfinis</div>
          <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
            {Object.keys(PRESETS).map(name=>(
              <button key={name} onClick={()=>applyPreset(name)}
                style={{padding:"6px 12px",borderRadius:6,border:`1px solid ${activePreset===name?"#FF4500":"#3A3A3A"}`,
                  background:activePreset===name?"#FF450018":"#2A2A2A",
                  color:activePreset===name?"#FF4500":"#E8E8E8",
                  fontSize:12,cursor:"pointer",fontFamily:"inherit",transition:"all 0.15s"}}>
                {name}
              </button>
            ))}
          </div>
        </div>

        {/* ── BACKGROUNDS ── */}
        <Section title="🎨 Arrière-plans">
          <Grid>
            <Swatch label="Page principale"      value={local.bgPage}      onChange={set("bgPage")}      hint="Fond global de l'app"/>
            <Swatch label="Surface / Panneau"    value={local.bgSurface}   onChange={set("bgSurface")}   hint="Modales, drawers"/>
            <Swatch label="Cartes"               value={local.bgCard}      onChange={set("bgCard")}      hint="Cards, tableaux"/>
            <Swatch label="Champs de saisie"     value={local.bgInput}     onChange={set("bgInput")}     hint="Input, select, textarea"/>
            <Swatch label="Barre de navigation"  value={local.bgNavbar}    onChange={set("bgNavbar")}    hint="Header top"/>
            <Swatch label="Barre latérale"       value={local.bgSidebar}   onChange={set("bgSidebar")}   hint="Menu latéral"/>
            <Swatch label="Survol (hover)"       value={local.bgHover}     onChange={set("bgHover")}     hint="Lignes tableau au survol"/>
          </Grid>
        </Section>

        {/* ── BORDERS ── */}
        <Section title="📐 Bordures" collapsed>
          <Grid>
            <Swatch label="Bordure standard"     value={local.borderColor}  onChange={set("borderColor")}  hint="Séparateurs, cards"/>
            <Swatch label="Bordure accentuée"    value={local.borderStrong} onChange={set("borderStrong")} hint="Inputs, focus"/>
          </Grid>
        </Section>

        {/* ── TEXT ── */}
        <Section title="✍️ Textes">
          <Grid>
            <Swatch label="Texte principal"      value={local.textPrimary}   onChange={set("textPrimary")}   hint="Titres, contenus"/>
            <Swatch label="Texte secondaire"     value={local.textSecondary} onChange={set("textSecondary")} hint="Sous-titres"/>
            <Swatch label="Texte discret"        value={local.textMuted}     onChange={set("textMuted")}     hint="Labels, placeholders"/>
            <Swatch label="Texte désactivé"      value={local.textDisabled}  onChange={set("textDisabled")}  hint="Éléments inactifs"/>
          </Grid>
        </Section>

        {/* ── ACCENT ── */}
        <Section title="⚡ Couleur d'accentuation">
          <Grid>
            <Swatch label="Accent principal"     value={local.accentPrimary} onChange={set("accentPrimary")} hint="Couleur de marque"/>
            <Swatch label="Accent au survol"     value={local.accentHover}   onChange={set("accentHover")}   hint="Hover sur accent"/>
            <Swatch label="Texte sur accent"     value={local.accentText}    onChange={set("accentText")}    hint="Texte sur fond coloré"/>
          </Grid>
        </Section>

        {/* ── BUTTONS ── */}
        <Section title="🔘 Boutons">
          <div style={{fontSize:11,color:"#8A8A8A",marginBottom:8}}>Bouton principal</div>
          <Grid>
            <Swatch label="Fond principal"       value={local.btnPrimaryBg}   onChange={set("btnPrimaryBg")}   hint="Background du bouton"/>
            <Swatch label="Texte principal"      value={local.btnPrimaryText} onChange={set("btnPrimaryText")} hint="Texte/icône"/>
          </Grid>
          <div style={{fontSize:11,color:"#8A8A8A",margin:"12px 0 8px"}}>Bouton secondaire</div>
          <Grid cols={3}>
            <Swatch label="Fond secondaire"      value={local.btnSecBg}     onChange={set("btnSecBg")}     hint="Souvent transparent"/>
            <Swatch label="Texte secondaire"     value={local.btnSecText}   onChange={set("btnSecText")}   hint="Couleur du texte"/>
            <Swatch label="Bordure secondaire"   value={local.btnSecBorder} onChange={set("btnSecBorder")} hint="Contour"/>
          </Grid>
          {/* Button preview */}
          <div style={{padding:12,background:"#111",borderRadius:6,display:"flex",gap:10,marginTop:4}}>
            <button style={{padding:"7px 14px",borderRadius:6,border:"none",background:local.btnPrimaryBg,color:local.btnPrimaryText,fontSize:13,fontFamily:"inherit",fontWeight:500,cursor:"pointer"}}>Bouton principal</button>
            <button style={{padding:"7px 14px",borderRadius:6,border:`1px solid ${local.btnSecBorder}`,background:local.btnSecBg,color:local.btnSecText,fontSize:13,fontFamily:"inherit",fontWeight:500,cursor:"pointer"}}>Secondaire</button>
          </div>
        </Section>

        {/* ── NAV ── */}
        <Section title="🗂 Navigation latérale" collapsed>
          <Grid cols={3}>
            <Swatch label="Texte nav"            value={local.navText}       onChange={set("navText")}       hint="Items inactifs"/>
            <Swatch label="Fond item actif"      value={local.navActiveBg}   onChange={set("navActiveBg")}   hint="Item sélectionné"/>
            <Swatch label="Texte item actif"     value={local.navActiveText} onChange={set("navActiveText")} hint="Label sélectionné"/>
          </Grid>
        </Section>

        {/* ── TABLE ── */}
        <Section title="📊 Tableaux" collapsed>
          <Grid cols={3}>
            <Swatch label="En-tête tableau"      value={local.tableHeaderBg} onChange={set("tableHeaderBg")} hint="Fond des colonnes"/>
            <Swatch label="Ligne au survol"      value={local.tableRowHover} onChange={set("tableRowHover")} hint="Hover sur ligne"/>
            <Swatch label="Texte tableau"        value={local.tableText}     onChange={set("tableText")}     hint="Contenu des cellules"/>
          </Grid>
        </Section>

        {/* ── SEMANTIC ── */}
        <Section title="🚦 Couleurs sémantiques" collapsed>
          <Grid cols={2}>
            <Swatch label="Succès (vert)"        value={local.colorSuccess}  onChange={set("colorSuccess")}  hint="Badges, états positifs"/>
            <Swatch label="Avertissement (jaune)"value={local.colorWarning}  onChange={set("colorWarning")}  hint="Alertes modérées"/>
            <Swatch label="Danger (rouge)"       value={local.colorDanger}   onChange={set("colorDanger")}   hint="Erreurs, suppressions"/>
            <Swatch label="Info (bleu)"          value={local.colorInfo}     onChange={set("colorInfo")}     hint="Infos, liens"/>
          </Grid>
          {/* Semantic preview */}
          <div style={{display:"flex",gap:8,marginTop:4,flexWrap:"wrap"}}>
            {[["Succès","colorSuccess"],["Avertissement","colorWarning"],["Danger","colorDanger"],["Info","colorInfo"]].map(([l,k])=>(
              <div key={k} style={{padding:"4px 10px",borderRadius:20,fontSize:11,fontWeight:600,
                background:`${local[k]}20`,color:local[k]}}>
                {l}
              </div>
            ))}
          </div>
        </Section>

        {/* ── ACTIONS ── */}
        <div style={{display:"flex",gap:10,flexWrap:"wrap",paddingTop:8,borderTop:"1px solid #2A2A2A",marginTop:4}}>
          <button onClick={reset}
            style={{padding:"7px 14px",borderRadius:6,border:"1px solid #3A3A3A",background:"transparent",color:"#8A8A8A",fontSize:12,cursor:"pointer",fontFamily:"inherit"}}>
            Réinitialiser
          </button>
          <button onClick={exportTheme}
            style={{padding:"7px 14px",borderRadius:6,border:"1px solid #3A3A3A",background:"transparent",color:"#8A8A8A",fontSize:12,cursor:"pointer",fontFamily:"inherit"}}>
            Exporter JSON
          </button>
          <label style={{padding:"7px 14px",borderRadius:6,border:"1px solid #3A3A3A",background:"transparent",color:"#8A8A8A",fontSize:12,cursor:"pointer",fontFamily:"inherit"}}>
            Importer JSON
            <input type="file" accept=".json" onChange={importTheme} style={{display:"none"}}/>
          </label>
          <button onClick={save}
            style={{padding:"7px 20px",borderRadius:6,border:"none",background:local.btnPrimaryBg||"#FF4500",
              color:local.btnPrimaryText||"#fff",fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"inherit",marginLeft:"auto"}}>
            Enregistrer le thème
          </button>
        </div>
      </div>

      {/* ── LIVE PREVIEW PANEL ── */}
      <div style={{position:"sticky",top:0,flexShrink:0}}>
        <LivePreview theme={local}/>
      </div>

      {/* Toast */}
      {toast && (
        <div style={{position:"fixed",bottom:24,right:24,padding:"12px 18px",
          background:"#22C55E20",border:"1px solid #22C55E50",borderRadius:8,
          color:"#22C55E",fontSize:13,fontWeight:500,zIndex:9999}}>
          {toast}
        </div>
      )}
    </div>
  );
}