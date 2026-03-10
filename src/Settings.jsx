// ============================================================
// FireSafe Pro — Paramètres (Settings)
// Settings.jsx
// ============================================================
import React, { useState, useEffect, useRef, useCallback } from "react";
import ThemeEditor from "./ThemeEditor";

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const ROLES_FR = { owner:"Propriétaire", admin:"Administrateur", office_staff:"Personnel de bureau", technician:"Technicien" };
const ROLE_COL  = { owner:"#FF4500", admin:"#3B82F6", office_staff:"#F59E0B", technician:"#22C55E" };

const CURRENCIES = [
  {value:"EUR",label:"€ Euro"},        {value:"USD",label:"$ Dollar US"},
  {value:"GBP",label:"£ Livre sterling"},{value:"CAD",label:"$ Dollar canadien"},
  {value:"MAD",label:"MAD Dirham marocain"},{value:"CHF",label:"CHF Franc suisse"},
  {value:"DZD",label:"DZD Dinar algérien"},{value:"TND",label:"TND Dinar tunisien"},
];
const LANGUAGES = [
  {value:"fr",label:"🇫🇷 Français"},{value:"en",label:"🇬🇧 English"},
  {value:"ar",label:"🇲🇦 العربية"},{value:"es",label:"🇪🇸 Español"},
];
const PRESET_COLORS = [
  "#FF4500","#EF4444","#F97316","#F59E0B","#22C55E",
  "#10B981","#3B82F6","#6366F1","#8B5CF6","#EC4899","#1a1a1a",
];
const TIMEZONES = [
  "Africa/Casablanca","Europe/Paris","Europe/London","America/New_York",
  "America/Chicago","America/Denver","America/Los_Angeles","Asia/Dubai",
];

// ─── API ──────────────────────────────────────────────────────────────────────
const api = async (url, anonKey, jwt, path, opts={}) => {
  const res = await fetch(`${url}/rest/v1/${path}`, {
    headers:{ "apikey":anonKey, "Authorization":`Bearer ${jwt}`,
      "Content-Type":"application/json", "Prefer":"return=representation" },
    ...opts,
  });
  const text = await res.text();
  if(!res.ok) throw new Error(text);
  return text ? JSON.parse(text) : null;
};

// ─── SHARED UI ────────────────────────────────────────────────────────────────
const C = (primaryColor="#FF4500") => ({
  flame: primaryColor, ash:"#1A1A1A", smoke:"#2A2A2A", steel:"#3A3A3A",
  mist:"#8A8A8A", frost:"#E8E8E8", white:"#FAFAFA",
  safe:"#22C55E", warn:"#F59E0B", danger:"#EF4444", info:"#3B82F6",
});

function Btn({children, onClick, variant="primary", size="md", disabled=false, full=false, col="#FF4500", style={}}) {
  const bg   = variant==="primary"?col:variant==="danger"?`#EF444420`:"transparent";
  const clr  = variant==="primary"?"#fff":variant==="danger"?"#EF4444":"#E8E8E8";
  const bdr  = variant==="primary"?"none":variant==="danger"?`1px solid #EF444450`:`1px solid #3A3A3A`;
  const pad  = size==="sm"?"4px 10px":size==="lg"?"11px 22px":"7px 14px";
  return (
    <button onClick={onClick} disabled={disabled}
      style={{display:"inline-flex",alignItems:"center",gap:6,padding:pad,fontSize:size==="sm"?11:13,
        fontWeight:500,background:bg,color:clr,border:bdr,borderRadius:6,
        cursor:disabled?"not-allowed":"pointer",opacity:disabled?0.45:1,
        fontFamily:"inherit",transition:"opacity 0.15s",width:full?"100%":"auto",...style}}>
      {children}
    </button>
  );
}

function Input({value, onChange, type="text", placeholder, disabled}) {
  return (
    <input type={type} value={value||""} onChange={e=>onChange(e.target.value)}
      placeholder={placeholder} disabled={disabled}
      style={{width:"100%",padding:"8px 11px",background:"#2A2A2A",border:"1px solid #3A3A3A",
        borderRadius:6,color:disabled?"#8A8A8A":"#FAFAFA",fontSize:13,fontFamily:"inherit"}}
      onFocus={e=>e.target.style.borderColor="#FF4500"}
      onBlur={e=>e.target.style.borderColor="#3A3A3A"}
    />
  );
}

function Select({value, onChange, options, placeholder}) {
  return (
    <select value={value||""} onChange={e=>onChange(e.target.value)}
      style={{width:"100%",padding:"8px 11px",background:"#2A2A2A",border:"1px solid #3A3A3A",
        borderRadius:6,color:value?"#FAFAFA":"#8A8A8A",fontSize:13,fontFamily:"inherit"}}>
      {placeholder&&<option value="">{placeholder}</option>}
      {options.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

function Field({label, children, hint}) {
  return (
    <div style={{display:"flex",flexDirection:"column",gap:5}}>
      {label&&<label style={{fontSize:11,color:"#8A8A8A",textTransform:"uppercase",letterSpacing:"0.05em",fontWeight:500}}>{label}</label>}
      {children}
      {hint&&<span style={{fontSize:11,color:"#8A8A8A"}}>{hint}</span>}
    </div>
  );
}

function Section({title, icon, children}) {
  return (
    <div style={{background:"#1A1A1A",border:"1px solid #2A2A2A",borderRadius:10,overflow:"hidden",marginBottom:16}}>
      <div style={{padding:"13px 18px",borderBottom:"1px solid #2A2A2A",display:"flex",alignItems:"center",gap:10}}>
        {icon&&<span style={{fontSize:18}}>{icon}</span>}
        <span style={{fontSize:14,fontWeight:700,color:"#FAFAFA"}}>{title}</span>
      </div>
      <div style={{padding:18}}>{children}</div>
    </div>
  );
}

function Toast({msg, type="success"}) {
  return (
    <div style={{position:"fixed",bottom:24,right:24,padding:"12px 18px",
      background:type==="success"?"#22C55E20":"#EF444420",
      border:`1px solid ${type==="success"?"#22C55E50":"#EF444450"}`,
      borderRadius:8,color:type==="success"?"#22C55E":"#EF4444",
      fontSize:13,fontWeight:500,zIndex:9999,animation:"fadeIn 0.2s ease",
      display:"flex",alignItems:"center",gap:8}}>
      {type==="success"?"✓":"⚠"} {msg}
    </div>
  );
}

function Badge({children, color}) {
  return <span style={{display:"inline-flex",alignItems:"center",padding:"2px 8px",borderRadius:20,fontSize:10,fontWeight:600,background:`${color}20`,color,whiteSpace:"nowrap"}}>{children}</span>;
}

// ─── USER INVITE MODAL ────────────────────────────────────────────────────────
// Uses Supabase Admin API (service_role key) to create a real auth user,
// then inserts the profile row. The service_role key is entered by the admin
// in the form — it's never stored, just used for this single call.
function InviteModal({companyId, sbConfig, onClose, onSaved}) {
  const {url, anonKey, jwt} = sbConfig;

  const [step, setStep]     = useState(1); // 1=form, 2=success
  const [form, setForm]     = useState({
    full_name: "", email: "", password: "", confirmPassword: "",
    phone: "", role: "technician", serviceKey: ""
  });
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState("");
  const [created,setCreated]= useState(null); // { name, email, role }
  const [showPwd, setShowPwd]= useState(false);
  const [showSvc, setShowSvc]= useState(false);
  const set = k => v => setForm(f => ({...f, [k]: v}));

  const ROLE_COL_LOCAL = {owner:"#FF4500",admin:"#3B82F6",office_staff:"#F59E0B",technician:"#22C55E"};
  const ROLES_LOCAL    = {owner:"Propriétaire",admin:"Administrateur",office_staff:"Bureau",technician:"Technicien"};
  const ROLE_DESC      = {
    owner:       "Accès complet — facturation, suppression du compte, tous les modules",
    admin:       "Gestion complète sauf facturation et suppression du compte",
    office_staff:"Clients, devis, factures et paiements — sans accès aux paramètres",
    technician:  "Planning, inspections, déficiences et bons de travail assignés",
  };

  const validate = () => {
    if (!form.full_name.trim())           return "Le nom complet est obligatoire.";
    if (!form.email.trim())               return "L'email est obligatoire.";
    if (!/\S+@\S+\.\S+/.test(form.email)) return "Format d'email invalide.";
    if (!form.password)                   return "Le mot de passe est obligatoire.";
    if (form.password.length < 6)         return "Le mot de passe doit faire au moins 6 caractères.";
    if (form.password !== form.confirmPassword) return "Les mots de passe ne correspondent pas.";
    if (!form.serviceKey.trim())          return "La clé service_role est requise pour créer un compte.";
    return null;
  };

  const save = async () => {
    const err = validate();
    if (err) return setError(err);
    setSaving(true); setError("");

    try {
      // ── Step 1: Create auth user via Admin API (requires service_role key) ──
      const adminRes = await fetch(`${url}/auth/v1/admin/users`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey":        form.serviceKey.trim(),
          "Authorization": `Bearer ${form.serviceKey.trim()}`,
        },
        body: JSON.stringify({
          email:              form.email.trim(),
          password:           form.password,
          email_confirm:      true,          // skip email verification
          user_metadata: { full_name: form.full_name.trim() },
        })
      });

      const adminData = await adminRes.json();
      if (!adminRes.ok) {
        const msg = adminData?.msg || adminData?.message || adminData?.error_description || JSON.stringify(adminData);
        throw new Error(`Auth: ${msg}`);
      }

      const authId = adminData?.id || adminData?.user?.id;
      if (!authId) throw new Error("ID utilisateur non reçu — vérifiez la clé service_role.");

      // ── Step 2: Upsert profile (handles case where a trigger already created the row) ──
      const profileRes = await fetch(`${url}/rest/v1/profiles`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey":        form.serviceKey.trim(),
          "Authorization": `Bearer ${form.serviceKey.trim()}`,
          // on-conflict=merge-duplicates → UPDATE if id already exists
          "Prefer":        "return=representation,resolution=merge-duplicates",
        },
        body: JSON.stringify({
          id:         authId,
          company_id: companyId,
          full_name:  form.full_name.trim(),
          email:      form.email.trim(),
          phone:      form.phone.trim() || null,
          role:       form.role,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
      });

      if (!profileRes.ok) {
        const pe = await profileRes.json();
        throw new Error(`Profil: ${pe?.message || "Erreur création profil"}`);
      }

      setCreated({ name: form.full_name.trim(), email: form.email.trim(), role: form.role });
      setStep(2);
      setTimeout(() => { onSaved(); onClose(); }, 3000);

    } catch(e) { setError(e.message); }
    finally { setSaving(false); }
  };

  const roleColor = ROLE_COL_LOCAL[form.role] || "#8A8A8A";
  const pwdStrength = !form.password ? null
    : form.password.length < 6 ? {label:"Faible",color:"#EF4444"}
    : form.password.length < 10 ? {label:"Moyen",color:"#F59E0B"}
    : {label:"Fort",color:"#22C55E"};

  const inputStyle = {
    width:"100%", padding:"9px 12px", background:"#111", border:"1px solid #3A3A3A",
    borderRadius:7, color:"#FAFAFA", fontSize:13, fontFamily:"inherit", outline:"none",
    boxSizing:"border-box",
  };
  const labelStyle = { fontSize:11, color:"#8A8A8A", fontWeight:600, textTransform:"uppercase", letterSpacing:"0.04em", marginBottom:5, display:"block" };

  return (
    <div onClick={e => e.target===e.currentTarget && onClose()}
      style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.88)",zIndex:9999,display:"flex",alignItems:"center",justifyContent:"center",padding:16,overflowY:"auto"}}>
      <div style={{background:"#1A1A1A",border:"1px solid #3A3A3A",borderRadius:14,width:"100%",maxWidth:520,padding:28,position:"relative"}}>

        {/* Header */}
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:22}}>
          <div>
            <div style={{fontSize:16,fontWeight:700,color:"#FAFAFA"}}>Ajouter un membre</div>
            <div style={{fontSize:12,color:"#8A8A8A",marginTop:3}}>Crée un compte Auth + profil dans FireSafe Pro</div>
          </div>
          <button onClick={onClose} style={{background:"none",border:"none",color:"#8A8A8A",fontSize:24,cursor:"pointer",lineHeight:1,padding:0}}>×</button>
        </div>

        {/* Success state */}
        {step === 2 && created && (
          <div style={{textAlign:"center",padding:"24px 0"}}>
            <div style={{fontSize:48,marginBottom:12}}>✅</div>
            <div style={{fontSize:15,fontWeight:700,color:"#FAFAFA",marginBottom:6}}>{created.name} a rejoint l'équipe !</div>
            <div style={{fontSize:12,color:"#8A8A8A",marginBottom:12}}>{created.email}</div>
            <div style={{display:"inline-flex",alignItems:"center",gap:6,padding:"4px 14px",borderRadius:20,
              background:`${ROLE_COL_LOCAL[created.role]}18`,border:`1px solid ${ROLE_COL_LOCAL[created.role]}40`,
              color:ROLE_COL_LOCAL[created.role],fontSize:12,fontWeight:600}}>
              {ROLES_LOCAL[created.role]}
            </div>
            <div style={{fontSize:11,color:"#6A6A6A",marginTop:16}}>Fermeture automatique dans 3 secondes…</div>
          </div>
        )}

        {/* Form */}
        {step === 1 && (
          <div style={{display:"flex",flexDirection:"column",gap:14}}>

            {error && (
              <div style={{padding:"10px 14px",background:"#EF444415",border:"1px solid #EF444440",borderRadius:8,fontSize:12,color:"#EF4444",display:"flex",gap:8,alignItems:"flex-start"}}>
                <span style={{flexShrink:0}}>⚠</span><span>{error}</span>
              </div>
            )}

            {/* Name + Role */}
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
              <div>
                <label style={labelStyle}>Nom complet *</label>
                <input value={form.full_name} onChange={e=>set("full_name")(e.target.value)}
                  placeholder="Prénom Nom" style={inputStyle}
                  onFocus={e=>e.target.style.borderColor="#FF4500"} onBlur={e=>e.target.style.borderColor="#3A3A3A"}/>
              </div>
              <div>
                <label style={labelStyle}>Rôle</label>
                <select value={form.role} onChange={e=>set("role")(e.target.value)}
                  style={{...inputStyle, color:roleColor, borderColor:`${roleColor}60`}}>
                  {Object.entries(ROLES_LOCAL).map(([v,l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
            </div>

            {/* Role description */}
            <div style={{padding:"8px 12px",background:`${roleColor}10`,border:`1px solid ${roleColor}30`,borderRadius:6,fontSize:11,color:roleColor,lineHeight:1.5}}>
              ℹ️ {ROLE_DESC[form.role]}
            </div>

            {/* Email */}
            <div>
              <label style={labelStyle}>Email *</label>
              <input type="email" value={form.email} onChange={e=>set("email")(e.target.value)}
                placeholder="prenom@entreprise.com" style={inputStyle}
                onFocus={e=>e.target.style.borderColor="#FF4500"} onBlur={e=>e.target.style.borderColor="#3A3A3A"}/>
            </div>

            {/* Phone */}
            <div>
              <label style={labelStyle}>Téléphone</label>
              <input value={form.phone} onChange={e=>set("phone")(e.target.value)}
                placeholder="+212 6 00 00 00 00" style={inputStyle}
                onFocus={e=>e.target.style.borderColor="#FF4500"} onBlur={e=>e.target.style.borderColor="#3A3A3A"}/>
            </div>

            {/* Password */}
            <div>
              <label style={labelStyle}>Mot de passe *</label>
              <div style={{position:"relative"}}>
                <input type={showPwd?"text":"password"} value={form.password} onChange={e=>set("password")(e.target.value)}
                  placeholder="Min. 6 caractères" style={{...inputStyle,paddingRight:40}}
                  onFocus={e=>e.target.style.borderColor="#FF4500"} onBlur={e=>e.target.style.borderColor="#3A3A3A"}/>
                <button onClick={()=>setShowPwd(p=>!p)} type="button"
                  style={{position:"absolute",right:10,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",color:"#8A8A8A",cursor:"pointer",fontSize:14,padding:0}}>
                  {showPwd?"🙈":"👁"}
                </button>
              </div>
              {pwdStrength && (
                <div style={{display:"flex",alignItems:"center",gap:6,marginTop:5}}>
                  <div style={{flex:1,height:3,background:"#2A2A2A",borderRadius:2,overflow:"hidden"}}>
                    <div style={{height:"100%",width:form.password.length<6?"33%":form.password.length<10?"66%":"100%",background:pwdStrength.color,transition:"width 0.3s,background 0.3s"}}/>
                  </div>
                  <span style={{fontSize:10,color:pwdStrength.color,fontWeight:600}}>{pwdStrength.label}</span>
                </div>
              )}
            </div>

            {/* Confirm password */}
            <div>
              <label style={labelStyle}>Confirmer le mot de passe *</label>
              <input type={showPwd?"text":"password"} value={form.confirmPassword} onChange={e=>set("confirmPassword")(e.target.value)}
                placeholder="Répéter le mot de passe"
                style={{...inputStyle, borderColor: form.confirmPassword && form.confirmPassword!==form.password?"#EF444460":form.confirmPassword&&form.confirmPassword===form.password?"#22C55E60":"#3A3A3A"}}
                onFocus={e=>e.target.style.borderColor=form.confirmPassword!==form.password?"#EF4444":"#22C55E"}
                onBlur={e=>e.target.style.borderColor=form.confirmPassword&&form.confirmPassword!==form.password?"#EF444460":"#3A3A3A"}/>
              {form.confirmPassword && form.confirmPassword!==form.password && (
                <div style={{fontSize:11,color:"#EF4444",marginTop:4}}>⚠ Les mots de passe ne correspondent pas</div>
              )}
              {form.confirmPassword && form.confirmPassword===form.password && (
                <div style={{fontSize:11,color:"#22C55E",marginTop:4}}>✓ Mots de passe identiques</div>
              )}
            </div>

            {/* Service Role Key */}
            <div style={{padding:14,background:"#111",border:"1px solid #2A2A2A",borderRadius:8}}>
              <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:8}}>
                <span style={{fontSize:13}}>🔑</span>
                <label style={{...labelStyle,marginBottom:0,textTransform:"none",fontSize:12,color:"#E8E8E8",fontWeight:600}}>Clé service_role Supabase *</label>
              </div>
              <div style={{fontSize:11,color:"#8A8A8A",marginBottom:10,lineHeight:1.6}}>
                Requise pour créer des comptes Auth. Trouvez-la dans :<br/>
                <span style={{color:"#FF4500",fontFamily:"monospace"}}>Supabase Dashboard → Project Settings → API → service_role</span>
              </div>
              <div style={{position:"relative"}}>
                <input type={showSvc?"text":"password"} value={form.serviceKey} onChange={e=>set("serviceKey")(e.target.value)}
                  placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." style={{...inputStyle,paddingRight:40,fontFamily:"monospace",fontSize:11}}
                  onFocus={e=>e.target.style.borderColor="#FF4500"} onBlur={e=>e.target.style.borderColor="#3A3A3A"}/>
                <button onClick={()=>setShowSvc(p=>!p)} type="button"
                  style={{position:"absolute",right:10,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",color:"#8A8A8A",cursor:"pointer",fontSize:14,padding:0}}>
                  {showSvc?"🙈":"👁"}
                </button>
              </div>
              <div style={{fontSize:10,color:"#6A6A6A",marginTop:8}}>
                ⚠ La clé n'est jamais stockée — elle est utilisée uniquement pour cette requête.
              </div>
            </div>

            {/* Actions */}
            <div style={{display:"flex",gap:10,paddingTop:6,borderTop:"1px solid #2A2A2A"}}>
              <button onClick={onClose} style={{flex:1,padding:"10px",background:"transparent",border:"1px solid #3A3A3A",borderRadius:7,color:"#8A8A8A",fontSize:13,cursor:"pointer",fontFamily:"inherit"}}>
                Annuler
              </button>
              <button onClick={save} disabled={saving}
                style={{flex:2,padding:"10px",background:saving?"#3A3A3A":"#FF4500",border:"none",borderRadius:7,
                  color:"#fff",fontSize:13,fontWeight:600,cursor:saving?"not-allowed":"pointer",fontFamily:"inherit",
                  transition:"background 0.15s",opacity:saving?0.7:1}}>
                {saving ? "⏳ Création du compte…" : "✅ Créer le compte"}
              </button>
            </div>

          </div>
        )}
      </div>
    </div>
  );
}

// ─── LOGO UPLOADER ────────────────────────────────────────────────────────────
function LogoUploader({currentLogo, primaryColor, onChange}) {
  const fileRef = useRef();
  const [preview, setPreview] = useState(currentLogo||"");

  const handleFile = (e) => {
    const file = e.target.files[0];
    if(!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      setPreview(ev.target.result);
      onChange(ev.target.result);
    };
    reader.readAsDataURL(file);
  };

  return (
    <div style={{display:"flex",alignItems:"center",gap:16}}>
      <div style={{width:80,height:80,borderRadius:10,border:`2px dashed #3A3A3A`,
        background:"#2A2A2A",display:"flex",alignItems:"center",justifyContent:"center",
        overflow:"hidden",flexShrink:0,cursor:"pointer"}}
        onClick={()=>fileRef.current.click()}>
        {preview
          ? <img src={preview} alt="Logo" style={{width:"100%",height:"100%",objectFit:"contain"}}/>
          : <span style={{fontSize:28}}>🏢</span>
        }
      </div>
      <div>
        <input ref={fileRef} type="file" accept="image/*" style={{display:"none"}} onChange={handleFile}/>
        <button onClick={()=>fileRef.current.click()}
          style={{padding:"7px 14px",borderRadius:6,border:`1px solid #3A3A3A`,background:"transparent",
            color:"#E8E8E8",fontSize:12,cursor:"pointer",fontFamily:"inherit",marginBottom:6,display:"block"}}>
          📁 Choisir un logo
        </button>
        <div style={{fontSize:11,color:"#8A8A8A"}}>PNG, JPG, SVG — max 2 Mo</div>
        {preview&&<button onClick={()=>{setPreview("");onChange("");}}
          style={{marginTop:6,background:"none",border:"none",color:"#EF4444",fontSize:11,cursor:"pointer",fontFamily:"inherit",padding:0}}>
          Supprimer le logo
        </button>}
      </div>
    </div>
  );
}

// ─── COLOR PICKER ─────────────────────────────────────────────────────────────
function ColorPicker({value, onChange, label}) {
  const [custom, setCustom] = useState(value||"#FF4500");
  return (
    <div style={{display:"flex",flexDirection:"column",gap:8}}>
      {label&&<label style={{fontSize:11,color:"#8A8A8A",textTransform:"uppercase",letterSpacing:"0.05em",fontWeight:500}}>{label}</label>}
      <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center"}}>
        {PRESET_COLORS.map(c=>(
          <button key={c} onClick={()=>{setCustom(c);onChange(c);}}
            style={{width:28,height:28,borderRadius:6,background:c,border:`2px solid ${value===c?"#fff":"transparent"}`,
              cursor:"pointer",transition:"transform 0.1s",flexShrink:0}}
            title={c}/>
        ))}
        <div style={{display:"flex",alignItems:"center",gap:6}}>
          <input type="color" value={custom} onChange={e=>{setCustom(e.target.value);onChange(e.target.value);}}
            style={{width:32,height:32,borderRadius:6,border:"1px solid #3A3A3A",background:"#2A2A2A",cursor:"pointer",padding:2}}/>
          <span style={{fontSize:11,color:"#8A8A8A",fontFamily:"monospace"}}>{custom}</span>
        </div>
      </div>
      {/* Live preview */}
      <div style={{padding:"10px 14px",borderRadius:6,background:`${value||"#FF4500"}15`,
        border:`1px solid ${value||"#FF4500"}40`,fontSize:12,color:value||"#FF4500",fontWeight:500}}>
        ● Aperçu de la couleur principale
      </div>
    </div>
  );
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
export default function Settings({user, supabase:sbConfig}) {
  const {url, anonKey, jwt} = sbConfig;

  const [tab, setTab]         = useState("company");
  const [toast, setToast]     = useState(null);
  const [company, setCompany] = useState(null);
  const [members, setMembers] = useState([]);
  const [loadingCo, setLoadingCo] = useState(true);
  const [loadingMb, setLoadingMb] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [showInvite, setShowInvite] = useState(false);

  // UI prefs stored in localStorage
  const [primaryColor, setPrimaryColor] = useState(()=>localStorage.getItem("fsColor")||"#FF4500");
  const [currency, setCurrency]         = useState(()=>localStorage.getItem("fsCurrency")||"EUR");
  const [language, setLanguage]         = useState(()=>localStorage.getItem("fsLanguage")||"fr");

  const showToast = (msg, type="success") => {
    setToast({msg,type});
    setTimeout(()=>setToast(null),3000);
  };

  // Load company
  useEffect(()=>{
    api(url,anonKey,jwt,`companies?id=eq.${user.company_id}&select=*`)
      .then(d=>setCompany(d?.[0]||{}))
      .catch(e=>console.error(e))
      .finally(()=>setLoadingCo(false));
  },[]);

  // Load members
  const loadMembers = useCallback(()=>{
    setLoadingMb(true);
    api(url,anonKey,jwt,`profiles?company_id=eq.${user.company_id}&select=id,full_name,email,phone,role,avatar_url,created_at&order=role.asc,full_name.asc`)
      .then(d=>setMembers(d||[]))
      .catch(e=>console.error(e))
      .finally(()=>setLoadingMb(false));
  },[user.company_id]);

  useEffect(()=>{ loadMembers(); },[loadMembers]);

  // Save company
  const saveCompany = async () => {
    setSaving(true);
    try {
      await api(url,anonKey,jwt,`companies?id=eq.${user.company_id}`,{
        method:"PATCH",
        body:JSON.stringify({...company, updated_at:new Date().toISOString()}),
      });
      // Cache logo & name so sidebar updates instantly
      if (company.logo_url !== undefined) localStorage.setItem("fsCompanyLogo", company.logo_url || "");
      if (company.name)                   localStorage.setItem("fsCompanyName",  company.name);
      window.dispatchEvent(new Event("fsCompanyUpdated"));
      showToast("Informations enregistrées !");
    } catch(e){ showToast(e.message,"error"); }
    finally{ setSaving(false); }
  };

  // Save UI prefs
  const savePreferences = () => {
    localStorage.setItem("fsColor", primaryColor);
    localStorage.setItem("fsCurrency", currency);
    localStorage.setItem("fsLanguage", language);
    // Apply color immediately
    document.documentElement.style.setProperty("--fs-primary", primaryColor);
    // Trigger language change immediately (no reload needed)
    window.dispatchEvent(new StorageEvent("storage", { key:"fsLanguage", newValue:language }));
    showToast("Préférences enregistrées !");
  };

  // Update member role
  const updateRole = async (memberId, newRole) => {
    try {
      await api(url,anonKey,jwt,`profiles?id=eq.${memberId}`,{
        method:"PATCH",
        body:JSON.stringify({role:newRole, updated_at:new Date().toISOString()}),
      });
      setMembers(prev=>prev.map(m=>m.id===memberId?{...m,role:newRole}:m));
      showToast("Rôle mis à jour !");
    } catch(e){ showToast(e.message,"error"); }
  };

  // Remove member
  const removeMember = async (memberId) => {
    if(!confirm("Retirer ce membre de l'équipe ?")) return;
    try {
      await api(url,anonKey,jwt,`profiles?id=eq.${memberId}`,{method:"DELETE"});
      setMembers(prev=>prev.filter(m=>m.id!==memberId));
      showToast("Membre retiré.");
    } catch(e){ showToast(e.message,"error"); }
  };

  const setField = k => v => setCompany(c=>({...c,[k]:v}));

  const TABS = [
    {id:"company",  icon:"🏢", label:"Entreprise"},
    {id:"appearance",icon:"🎨",label:"Apparence"},
    {id:"team",     icon:"👥", label:"Équipe"},
    {id:"preferences",icon:"⚙️",label:"Préférences"},
    {id:"theme",      icon:"🎨", label:"Thème & Couleurs"},
  ];

  return (
    <div style={{display:"flex",height:"100%",minHeight:0,background:"#0D0D0D"}}>
      <style>{`@keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}`}</style>

      {/* ── SIDEBAR ── */}
      <div style={{width:200,borderRight:"1px solid #2A2A2A",padding:"16px 0",flexShrink:0,background:"#1A1A1A"}}>
        <div style={{padding:"0 12px 12px",fontSize:11,color:"#8A8A8A",textTransform:"uppercase",letterSpacing:"0.06em",fontWeight:600}}>Paramètres</div>
        {TABS.map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)}
            style={{width:"100%",padding:"9px 16px",border:"none",background:tab===t.id?`${primaryColor}18`:"transparent",
              color:tab===t.id?primaryColor:"#8A8A8A",fontSize:13,fontWeight:tab===t.id?600:400,
              cursor:"pointer",fontFamily:"inherit",textAlign:"left",
              borderLeft:tab===t.id?`3px solid ${primaryColor}`:"3px solid transparent",
              display:"flex",alignItems:"center",gap:10}}>
            <span>{t.icon}</span>{t.label}
          </button>
        ))}
      </div>

      {/* ── CONTENT ── */}
      <div style={{flex:1,overflowY:"auto",padding:24}}>

        {/* ══ COMPANY TAB ══ */}
        {tab==="company"&&(
          <>
            <Section title="Logo de l'entreprise" icon="🖼">
              <LogoUploader
                currentLogo={company?.logo_url}
                primaryColor={primaryColor}
                onChange={v=>setField("logo_url")(v)}
              />
            </Section>

            <Section title="Informations générales" icon="🏢">
              {loadingCo
                ? <div style={{color:"#8A8A8A",fontSize:13}}>Chargement...</div>
                : <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
                    <Field label="Nom de l'entreprise">
                      <Input value={company?.name} onChange={setField("name")} placeholder="FireSafe SARL"/>
                    </Field>
                    <Field label="Email">
                      <Input type="email" value={company?.email} onChange={setField("email")} placeholder="contact@firesafe.fr"/>
                    </Field>
                    <Field label="Téléphone">
                      <Input value={company?.phone} onChange={setField("phone")} placeholder="+33 1 00 00 00 00"/>
                    </Field>
                    <Field label="Site web">
                      <Input value={company?.website} onChange={setField("website")} placeholder="https://firesafe.fr"/>
                    </Field>
                    <Field label="N° de licence">
                      <Input value={company?.license_number} onChange={setField("license_number")} placeholder="LIC-XXXXXX"/>
                    </Field>
                    <Field label="Fuseau horaire">
                      <Select value={company?.timezone} onChange={setField("timezone")}
                        options={TIMEZONES.map(t=>({value:t,label:t}))}/>
                    </Field>
                    <div style={{gridColumn:"1/-1"}}>
                      <Field label="Adresse">
                        <Input value={company?.address} onChange={setField("address")} placeholder="123 rue de la Paix"/>
                      </Field>
                    </div>
                    <Field label="Ville">
                      <Input value={company?.city} onChange={setField("city")} placeholder="Paris"/>
                    </Field>
                    <Field label="Région / État">
                      <Input value={company?.state} onChange={setField("state")} placeholder="Île-de-France"/>
                    </Field>
                    <Field label="Code postal">
                      <Input value={company?.zip} onChange={setField("zip")} placeholder="75001"/>
                    </Field>
                    <Field label="Pays">
                      <Input value={company?.country} onChange={setField("country")} placeholder="FR"/>
                    </Field>
                  </div>
              }
            </Section>

            <Section title="Numérotation des documents" icon="📄">
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
                <Field label="Préfixe des devis" hint="Ex: DEV → DEV-000123">
                  <Input value={company?.proposal_prefix} onChange={setField("proposal_prefix")} placeholder="DEV"/>
                </Field>
                <Field label="Préfixe des factures" hint="Ex: FAC → FAC-000123">
                  <Input value={company?.invoice_prefix} onChange={setField("invoice_prefix")} placeholder="FAC"/>
                </Field>
              </div>
            </Section>

            <Btn onClick={saveCompany} disabled={saving} size="lg">
              {saving?"Enregistrement...":"💾 Enregistrer les modifications"}
            </Btn>
          </>
        )}

        {/* ══ APPEARANCE TAB ══ */}
        {tab==="appearance"&&(
          <>
            <Section title="Couleur principale" icon="🎨">
              <ColorPicker
                value={primaryColor}
                onChange={setPrimaryColor}
                label="Couleur d'accentuation"
              />
              <div style={{marginTop:16,fontSize:12,color:"#8A8A8A",lineHeight:1.6}}>
                Cette couleur est utilisée pour les boutons, les badges actifs, la barre de navigation et tous les éléments d'accentuation de l'interface.
              </div>
            </Section>

            <Section title="Aperçu en temps réel" icon="👁">
              <div style={{display:"flex",gap:12,flexWrap:"wrap",alignItems:"flex-start"}}>
                {/* Mini nav preview */}
                <div style={{background:"#1A1A1A",border:"1px solid #2A2A2A",borderRadius:8,padding:12,width:160}}>
                  <div style={{fontSize:11,color:"#8A8A8A",marginBottom:10,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.05em"}}>Navigation</div>
                  {["Tableau de bord","Planification","Inspections"].map((item,i)=>(
                    <div key={i} style={{padding:"6px 10px",borderRadius:5,marginBottom:4,
                      background:i===0?`${primaryColor}18`:"transparent",
                      color:i===0?primaryColor:"#8A8A8A",fontSize:12,
                      borderLeft:i===0?`3px solid ${primaryColor}`:"3px solid transparent"}}>
                      {item}
                    </div>
                  ))}
                </div>
                {/* Button preview */}
                <div style={{display:"flex",flexDirection:"column",gap:8}}>
                  <div style={{fontSize:11,color:"#8A8A8A",fontWeight:600,textTransform:"uppercase",letterSpacing:"0.05em",marginBottom:4}}>Boutons</div>
                  <button style={{padding:"8px 16px",borderRadius:6,border:"none",background:primaryColor,color:"#fff",fontSize:13,cursor:"pointer",fontFamily:"inherit"}}>Bouton principal</button>
                  <button style={{padding:"8px 16px",borderRadius:6,border:`1px solid ${primaryColor}`,background:`${primaryColor}15`,color:primaryColor,fontSize:13,cursor:"pointer",fontFamily:"inherit"}}>Bouton secondaire</button>
                  <div style={{padding:"10px 14px",borderRadius:6,background:`${primaryColor}15`,border:`1px solid ${primaryColor}40`,fontSize:12,color:primaryColor}}>
                    ● Badge / Alerte
                  </div>
                </div>
              </div>
            </Section>

            <Btn onClick={savePreferences} size="lg">💾 Appliquer l'apparence</Btn>
          </>
        )}

        {/* ══ TEAM TAB ══ */}
        {tab==="team"&&(
          <>
            {/* Header bar */}
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
              <div>
                <div style={{fontSize:15,fontWeight:700,color:"#FAFAFA"}}>👥 Membres de l'équipe</div>
                <div style={{fontSize:12,color:"#8A8A8A",marginTop:3}}>
                  {loadingMb ? "Chargement…" : `${members.length} membre${members.length>1?"s":""} · ${members.filter(m=>m.role==="technician").length} technicien${members.filter(m=>m.role==="technician").length>1?"s":""}`}
                </div>
              </div>
              <Btn onClick={()=>setShowInvite(true)} icon="plus">+ Ajouter un membre</Btn>
            </div>

            {/* Role summary pills */}
            {!loadingMb && members.length > 0 && (
              <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:16}}>
                {Object.entries(ROLES_FR).map(([role, label])=>{
                  const count = members.filter(m=>m.role===role).length;
                  if (!count) return null;
                  return (
                    <div key={role} style={{display:"flex",alignItems:"center",gap:6,padding:"5px 12px",borderRadius:20,
                      background:`${ROLE_COL[role]}15`,border:`1px solid ${ROLE_COL[role]}35`,fontSize:12}}>
                      <div style={{width:8,height:8,borderRadius:"50%",background:ROLE_COL[role]}}/>
                      <span style={{color:ROLE_COL[role],fontWeight:600}}>{label}</span>
                      <span style={{color:"#8A8A8A"}}>{count}</span>
                    </div>
                  );
                })}
              </div>
            )}

            {/* User cards */}
            {loadingMb ? (
              <div style={{padding:40,textAlign:"center",color:"#8A8A8A",fontSize:13}}>Chargement des membres…</div>
            ) : members.length===0 ? (
              <div style={{padding:48,textAlign:"center",background:"#1A1A1A",border:"1px solid #2A2A2A",borderRadius:10}}>
                <div style={{fontSize:32,marginBottom:12}}>👥</div>
                <div style={{fontSize:14,color:"#E8E8E8",marginBottom:6}}>Aucun membre</div>
                <div style={{fontSize:12,color:"#8A8A8A",marginBottom:16}}>Ajoutez des collaborateurs pour commencer</div>
                <Btn onClick={()=>setShowInvite(true)}>+ Ajouter le premier membre</Btn>
              </div>
            ) : (
              <div style={{display:"flex",flexDirection:"column",gap:10}}>
                {members.map((m)=>{
                  const isCurrentUser = m.id === user.id;
                  const initials = (m.full_name||"?").split(" ").map(n=>n[0]).join("").slice(0,2).toUpperCase();
                  const hue = (m.full_name||"X").split("").reduce((a,c)=>a+c.charCodeAt(0),0) % 360;
                  const roleColor = ROLE_COL[m.role] || "#8A8A8A";
                  const joinDate  = m.created_at ? new Date(m.created_at).toLocaleDateString("fr-FR",{day:"2-digit",month:"short",year:"numeric"}) : null;

                  return (
                    <div key={m.id} style={{background:"#1A1A1A",border:`1px solid #2A2A2A`,borderRadius:10,
                      padding:"14px 18px",display:"flex",alignItems:"center",gap:16,
                      transition:"border-color 0.15s", borderLeft:`3px solid ${roleColor}`}}
                      onMouseEnter={e=>e.currentTarget.style.borderColor=`${roleColor}60`}
                      onMouseLeave={e=>e.currentTarget.style.borderColor="#2A2A2A"}>

                      {/* Avatar */}
                      <div style={{width:42,height:42,borderRadius:"50%",background:`hsl(${hue},50%,30%)`,
                        display:"flex",alignItems:"center",justifyContent:"center",
                        fontSize:14,fontWeight:700,color:"#fff",flexShrink:0,border:`2px solid ${roleColor}40`}}>
                        {m.avatar_url
                          ? <img src={m.avatar_url} style={{width:"100%",height:"100%",borderRadius:"50%",objectFit:"cover"}} alt=""/>
                          : initials}
                      </div>

                      {/* Name + contact info */}
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                          <span style={{fontSize:14,fontWeight:700,color:"#FAFAFA"}}>{m.full_name}</span>
                          {isCurrentUser && <span style={{fontSize:10,color:"#8A8A8A",padding:"1px 7px",borderRadius:10,background:"#2A2A2A"}}>vous</span>}
                        </div>
                        <div style={{display:"flex",gap:14,marginTop:4,flexWrap:"wrap"}}>
                          {m.email && (
                            <span style={{fontSize:12,color:"#8A8A8A",display:"flex",alignItems:"center",gap:4}}>
                              📧 {m.email}
                            </span>
                          )}
                          {m.phone && (
                            <span style={{fontSize:12,color:"#8A8A8A",display:"flex",alignItems:"center",gap:4}}>
                              📱 {m.phone}
                            </span>
                          )}
                          {joinDate && (
                            <span style={{fontSize:11,color:"#6A6A6A",display:"flex",alignItems:"center",gap:4}}>
                              🗓 Depuis le {joinDate}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Role selector / badge */}
                      <div style={{flexShrink:0}}>
                        {isCurrentUser ? (
                          <Badge color={roleColor}>{ROLES_FR[m.role]||m.role}</Badge>
                        ) : (
                          <select value={m.role} onChange={e=>updateRole(m.id,e.target.value)}
                            style={{padding:"5px 10px",background:"#2A2A2A",
                              border:`1px solid ${roleColor}50`,borderRadius:6,
                              color:roleColor,fontSize:12,fontFamily:"inherit",
                              cursor:"pointer",fontWeight:600}}>
                            {Object.entries(ROLES_FR).map(([v,l])=>(
                              <option key={v} value={v}>{l}</option>
                            ))}
                          </select>
                        )}
                      </div>

                      {/* Remove button */}
                      <div style={{flexShrink:0,width:70,textAlign:"right"}}>
                        {!isCurrentUser && (
                          <button onClick={()=>removeMember(m.id)}
                            style={{padding:"5px 10px",borderRadius:6,border:"1px solid #EF444430",
                              background:"#EF444410",color:"#EF4444",fontSize:11,
                              cursor:"pointer",fontFamily:"inherit",transition:"all 0.12s"}}
                            onMouseEnter={e=>{e.currentTarget.style.background="#EF444425";}}
                            onMouseLeave={e=>{e.currentTarget.style.background="#EF444410";}}>
                            Retirer
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Role legend */}
            <div style={{marginTop:20,background:"#1A1A1A",border:"1px solid #2A2A2A",borderRadius:8,padding:16}}>
              <div style={{fontSize:11,fontWeight:700,color:"#8A8A8A",textTransform:"uppercase",letterSpacing:"0.05em",marginBottom:12}}>Description des rôles</div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                {[
                  {role:"owner",       desc:"Accès complet, facturation, suppression du compte"},
                  {role:"admin",       desc:"Gestion complète sauf facturation et suppression"},
                  {role:"office_staff",desc:"Clients, devis, factures — sans accès aux paramètres"},
                  {role:"technician",  desc:"Planning, inspections, déficiences et bons de travail"},
                ].map(({role,desc})=>(
                  <div key={role} style={{display:"flex",gap:10,alignItems:"flex-start",padding:"8px 10px",borderRadius:6,background:"#2A2A2A"}}>
                    <Badge color={ROLE_COL[role]}>{ROLES_FR[role]}</Badge>
                    <span style={{fontSize:11,color:"#8A8A8A",lineHeight:1.5}}>{desc}</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* ══ THEME TAB ══ */}
        {tab==="theme"&&(
          <ThemeEditor/>
        )}

        {/* ══ PREFERENCES TAB ══ */}
        {tab==="preferences"&&(
          <>
            <Section title="Devise" icon="💰">
              <Field label="Devise utilisée dans les devis et factures">
                <Select value={currency} onChange={setCurrency} options={CURRENCIES}/>
              </Field>
              <div style={{marginTop:12,padding:"10px 14px",background:"#2A2A2A",borderRadius:6,fontSize:12,color:"#8A8A8A"}}>
                Aperçu : <strong style={{color:"#FAFAFA"}}>1 234,56 {CURRENCIES.find(c=>c.value===currency)?.value||"EUR"}</strong>
              </div>
            </Section>

            <Section title="Langue de l'interface" icon="🌐">
              <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:10}}>
                {LANGUAGES.map(l=>(
                  <button key={l.value} onClick={()=>{
                    setLanguage(l.value);
                    localStorage.setItem("fsLanguage", l.value);
                    window.dispatchEvent(new StorageEvent("storage", { key:"fsLanguage", newValue:l.value }));
                  }}
                    style={{padding:"12px 16px",borderRadius:8,border:`2px solid ${language===l.value?primaryColor:"#3A3A3A"}`,
                      background:language===l.value?`${primaryColor}12`:"#2A2A2A",
                      color:language===l.value?primaryColor:"#8A8A8A",fontSize:14,cursor:"pointer",
                      fontFamily:"inherit",fontWeight:language===l.value?600:400,transition:"all 0.15s",
                      textAlign:"left"}}>
                    {l.label}
                    {language===l.value&&<span style={{float:"right"}}>✓</span>}
                  </button>
                ))}
              </div>
              <div style={{marginTop:12,fontSize:12,color:"#6BCB77",lineHeight:1.5}}>
                ✓ La langue change instantanément dans toute l'application.
              </div>
            </Section>

            <Section title="Format des dates" icon="📅">
              <Field label="Format">
                <Select value={company?.date_format||"DD/MM/YYYY"} onChange={setField("date_format")}
                  options={[
                    {value:"DD/MM/YYYY",label:"JJ/MM/AAAA (03/01/2026)"},
                    {value:"MM/DD/YYYY",label:"MM/JJ/AAAA (01/03/2026)"},
                    {value:"YYYY-MM-DD",label:"AAAA-MM-JJ (2026-01-03)"},
                  ]}/>
              </Field>
            </Section>

            <Btn onClick={savePreferences} size="lg">💾 Enregistrer les préférences</Btn>
          </>
        )}
      </div>

      {/* TOAST */}
      {toast && <Toast msg={toast.msg} type={toast.type}/>}

      {/* INVITE MODAL */}
      {showInvite && (
        <InviteModal
          companyId={user.company_id}
          sbConfig={sbConfig}
          onClose={()=>setShowInvite(false)}
          onSaved={()=>{ setShowInvite(false); loadMembers(); showToast("Membre ajouté !"); }}
        />
      )}
    </div>
  );
}