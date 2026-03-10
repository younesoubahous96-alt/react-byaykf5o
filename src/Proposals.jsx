// ============================================================
// FireSafe Pro — Module Devis (Proposals)
// Proposals.jsx
// ============================================================
// Usage in App.jsx:
//   import Proposals from './Proposals';
//   proposals: { component: <Proposals user={user} supabase={{ url, anonKey, jwt }} /> }
// ============================================================

import React, { useState, useEffect, useCallback, useRef } from "react";

const C = {
  flame:"#FF4500", flameLight:"#FF6A33", flameDark:"#CC3700",
  ember:"#FF8C00", coal:"#0D0D0D", ash:"#1A1A1A", smoke:"#2A2A2A",
  steel:"#3A3A3A", mist:"#8A8A8A", frost:"#E8E8E8", white:"#FAFAFA",
  safe:"#22C55E", warn:"#F59E0B", danger:"#EF4444", info:"#3B82F6",
};

// ─── DB CLIENT ────────────────────────────────────────────────────────────────
const makeDB = ({ url, anonKey, jwt }) => {
  let _token = jwt;
  const h = (extra={}) => ({
    "Content-Type":"application/json",
    "apikey": anonKey,
    "Authorization":`Bearer ${_token||jwt}`,
    "Prefer":"return=representation",
    ...extra,
  });
  const from = (table) => {
    const params = new URLSearchParams();
    const headers = h();
    const b = {
      select:(c="*")=>{ params.set("select",c); return b; },
      eq:(c,v)=>{ params.append(c,`eq.${v}`); return b; },
      neq:(c,v)=>{ params.append(c,`neq.${v}`); return b; },
      order:(c,asc=true)=>{ params.append("order",`${c}.${asc?"asc":"desc"}`); return b; },
      limit:(n)=>{ params.set("limit",n); return b; },
      single:()=>{ headers["Accept"]="application/vnd.pgrst.object+json"; return b; },
      async get(){
        const qs=params.toString();
        const res=await fetch(`${url}/rest/v1/${table}${qs?"?"+qs:""}`,{headers});
        const data=await res.json();
        if(!res.ok) throw new Error(data.message||data.hint||JSON.stringify(data));
        return data;
      },
      async insert(body){
        const res=await fetch(`${url}/rest/v1/${table}`,{method:"POST",headers:h(),body:JSON.stringify(body)});
        const data=await res.json();
        if(!res.ok) throw new Error(data.message||JSON.stringify(data));
        return Array.isArray(data)?data[0]:data;
      },
      async patch(body){
        const qs=params.toString();
        const res=await fetch(`${url}/rest/v1/${table}${qs?"?"+qs:""}`,{method:"PATCH",headers:h(),body:JSON.stringify(body)});
        const data=await res.json();
        if(!res.ok) throw new Error(data.message||JSON.stringify(data));
        return Array.isArray(data)?data[0]:data;
      },
      async del(){
        const qs=params.toString();
        const res=await fetch(`${url}/rest/v1/${table}${qs?"?"+qs:""}`,{method:"DELETE",headers:h()});
        if(!res.ok){const data=await res.json();throw new Error(data.message||JSON.stringify(data));}
        return true;
      },
    };
    return b;
  };
  return { from };
};

// ─── SHARED UI ────────────────────────────────────────────────────────────────
const Spinner = ({size=16})=>(
  <span style={{width:size,height:size,border:"2px solid rgba(255,255,255,0.15)",borderTopColor:"#fff",borderRadius:"50%",display:"inline-block",animation:"propSpin 0.7s linear infinite"}}/>
);

const Btn = ({children,variant="primary",size="md",icon,onClick,disabled=false,full=false,style={}})=>{
  const vs={
    primary:{bg:C.flame,color:"#fff",hov:C.flameLight,border:"none"},
    secondary:{bg:"transparent",color:C.frost,hov:C.smoke,border:`1px solid ${C.steel}`},
    ghost:{bg:"transparent",color:C.mist,hov:C.smoke,border:"none"},
    success:{bg:`${C.safe}18`,color:C.safe,hov:`${C.safe}28`,border:`1px solid ${C.safe}40`},
    danger:{bg:`${C.danger}18`,color:C.danger,hov:`${C.danger}28`,border:`1px solid ${C.danger}40`},
    warning:{bg:`${C.warn}18`,color:C.warn,hov:`${C.warn}28`,border:`1px solid ${C.warn}40`},
  };
  const v=vs[variant]||vs.primary;
  const pad=size==="sm"?"5px 12px":size==="lg"?"12px 24px":"8px 16px";
  return(
    <button disabled={disabled} onClick={onClick}
      style={{display:"inline-flex",alignItems:"center",justifyContent:"center",gap:6,padding:pad,
        fontSize:size==="sm"?12:13,fontWeight:500,background:v.bg,color:v.color,
        border:v.border||"none",borderRadius:6,transition:"all 0.15s",
        opacity:disabled?0.45:1,cursor:disabled?"not-allowed":"pointer",
        width:full?"100%":"auto",fontFamily:"inherit",...style}}
      onMouseEnter={e=>{if(!disabled)e.currentTarget.style.background=v.hov;}}
      onMouseLeave={e=>{if(!disabled)e.currentTarget.style.background=v.bg;}}>
      {icon&&<span style={{fontSize:size==="sm"?13:15}}>{icon}</span>}
      {children}
    </button>
  );
};

const Badge=({children,type="default"})=>{
  const m={default:{bg:`${C.mist}18`,color:C.mist},success:{bg:`${C.safe}18`,color:C.safe},danger:{bg:`${C.danger}18`,color:C.danger},warning:{bg:`${C.warn}18`,color:C.warn},info:{bg:`${C.info}18`,color:C.info},flame:{bg:`${C.flame}18`,color:C.flame}};
  const s=m[type]||m.default;
  return <span style={{display:"inline-flex",alignItems:"center",padding:"2px 8px",borderRadius:20,fontSize:11,fontWeight:500,background:s.bg,color:s.color,whiteSpace:"nowrap"}}>{children}</span>;
};

const Card=({children,style={},onClick})=>(
  <div onClick={onClick} style={{background:C.ash,border:`1px solid ${C.smoke}`,borderRadius:8,...style,cursor:onClick?"pointer":"default"}}
    onMouseEnter={e=>{if(onClick)e.currentTarget.style.borderColor=C.steel;}}
    onMouseLeave={e=>{if(onClick)e.currentTarget.style.borderColor=C.smoke;}}>
    {children}
  </div>
);

const Modal=({title,onClose,children,width=620})=>(
  <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.75)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000,padding:20}}
    onClick={e=>e.target===e.currentTarget&&onClose()}>
    <div style={{background:C.ash,border:`1px solid ${C.smoke}`,borderRadius:12,width:"100%",maxWidth:width,maxHeight:"92vh",display:"flex",flexDirection:"column",animation:"propSlideUp 0.2s ease"}}>
      <div style={{padding:"16px 20px",borderBottom:`1px solid ${C.smoke}`,display:"flex",alignItems:"center",justifyContent:"space-between",flexShrink:0}}>
        <h2 style={{fontSize:15,fontWeight:700,color:C.white}}>{title}</h2>
        <button onClick={onClose} style={{background:"none",border:"none",color:C.mist,cursor:"pointer",fontSize:22,lineHeight:1,padding:4}}>×</button>
      </div>
      <div style={{overflowY:"auto",flex:1}}>{children}</div>
    </div>
  </div>
);

const Field=({label,required,error,children,hint})=>(
  <div style={{display:"flex",flexDirection:"column",gap:6}}>
    {label&&<label style={{fontSize:11,fontWeight:500,color:C.mist,textTransform:"uppercase",letterSpacing:"0.05em"}}>
      {label}{required&&<span style={{color:C.flame}}> *</span>}
    </label>}
    {children}
    {error&&<span style={{fontSize:11,color:C.danger}}>{error}</span>}
    {hint&&<span style={{fontSize:11,color:C.mist}}>{hint}</span>}
  </div>
);

const Input=({value,onChange,placeholder,type="text",error,disabled})=>(
  <input type={type} value={value||""} onChange={e=>onChange(e.target.value)} placeholder={placeholder} disabled={disabled}
    style={{width:"100%",padding:"9px 12px",background:disabled?C.smoke:C.smoke,border:`1px solid ${error?C.danger:C.steel}`,
      borderRadius:6,color:disabled?C.mist:C.white,fontSize:13,fontFamily:"inherit",transition:"border-color 0.15s"}}
    onFocus={e=>{if(!disabled)e.target.style.borderColor=C.flame;}}
    onBlur={e=>e.target.style.borderColor=error?C.danger:C.steel}
  />
);

const Textarea=({value,onChange,placeholder,rows=3})=>(
  <textarea value={value||""} onChange={e=>onChange(e.target.value)} placeholder={placeholder} rows={rows}
    style={{width:"100%",padding:"9px 12px",background:C.smoke,border:`1px solid ${C.steel}`,
      borderRadius:6,color:C.white,fontSize:13,fontFamily:"inherit",resize:"vertical",lineHeight:1.5}}
    onFocus={e=>e.target.style.borderColor=C.flame}
    onBlur={e=>e.target.style.borderColor=C.steel}
  />
);

const Select=({value,onChange,options,placeholder="Sélectionner..."})=>(
  <select value={value||""} onChange={e=>onChange(e.target.value)}
    style={{width:"100%",padding:"9px 12px",background:C.smoke,border:`1px solid ${C.steel}`,
      borderRadius:6,color:value?C.white:C.mist,fontSize:13,fontFamily:"inherit"}}>
    <option value="">{placeholder}</option>
    {options.map(o=><option key={o.value||o} value={o.value||o}>{o.label||o}</option>)}
  </select>
);

const Divider=({label})=>(
  <div style={{display:"flex",alignItems:"center",gap:12,margin:"4px 0"}}>
    {label&&<span style={{fontSize:11,color:C.mist,textTransform:"uppercase",letterSpacing:"0.06em",whiteSpace:"nowrap"}}>{label}</span>}
    <div style={{flex:1,height:1,background:C.smoke}}/>
  </div>
);

const ErrorBanner=({msg})=>(
  <div style={{padding:"10px 14px",background:`${C.danger}12`,border:`1px solid ${C.danger}30`,borderRadius:8,fontSize:13,color:C.danger}}>
    ⚠ {msg}
  </div>
);

const fmt=(n)=>`${Number(n||0).toLocaleString("fr-FR",{minimumFractionDigits:2,maximumFractionDigits:2})} €`;

const STATUS_FR={ draft:"Brouillon", sent:"Envoyé", approved:"Approuvé", declined:"Refusé", expired:"Expiré", invoiced:"Facturé" };
const STATUS_COLOR={ draft:"default", sent:"info", approved:"success", declined:"danger", expired:"warning", invoiced:"flame" };

// ─── SIGNATURE PAD ────────────────────────────────────────────────────────────
const SignaturePad=({onSign})=>{
  const canvasRef=useRef();
  const drawing=useRef(false);
  const [signed,setSigned]=useState(false);

  const getPos=(e,canvas)=>{
    const rect=canvas.getBoundingClientRect();
    const src=e.touches?e.touches[0]:e;
    return{x:(src.clientX-rect.left)*(canvas.width/rect.width),y:(src.clientY-rect.top)*(canvas.height/rect.height)};
  };

  const start=(e)=>{
    e.preventDefault();
    drawing.current=true;
    const canvas=canvasRef.current;
    const ctx=canvas.getContext("2d");
    const{x,y}=getPos(e,canvas);
    ctx.beginPath(); ctx.moveTo(x,y);
  };
  const draw=(e)=>{
    e.preventDefault();
    if(!drawing.current) return;
    const canvas=canvasRef.current;
    const ctx=canvas.getContext("2d");
    const{x,y}=getPos(e,canvas);
    ctx.lineWidth=2; ctx.strokeStyle="#fff"; ctx.lineCap="round";
    ctx.lineTo(x,y); ctx.stroke();
    setSigned(true);
  };
  const stop=()=>{ drawing.current=false; };

  const clear=()=>{
    const canvas=canvasRef.current;
    canvas.getContext("2d").clearRect(0,0,canvas.width,canvas.height);
    setSigned(false);
  };

  const save=()=>{
    const dataUrl=canvasRef.current.toDataURL("image/png");
    onSign(dataUrl);
  };

  return(
    <div style={{display:"flex",flexDirection:"column",gap:12}}>
      <div style={{border:`1px solid ${C.steel}`,borderRadius:8,overflow:"hidden",background:"#111",touchAction:"none"}}>
        <canvas ref={canvasRef} width={560} height={160}
          style={{display:"block",width:"100%",cursor:"crosshair"}}
          onMouseDown={start} onMouseMove={draw} onMouseUp={stop} onMouseLeave={stop}
          onTouchStart={start} onTouchMove={draw} onTouchEnd={stop}
        />
      </div>
      <div style={{display:"flex",gap:8,justifyContent:"space-between",alignItems:"center"}}>
        <span style={{fontSize:11,color:C.mist}}>Signez dans la zone ci-dessus</span>
        <div style={{display:"flex",gap:8}}>
          <Btn variant="secondary" size="sm" onClick={clear}>Effacer</Btn>
          <Btn size="sm" disabled={!signed} onClick={save}>✓ Confirmer la signature</Btn>
        </div>
      </div>
    </div>
  );
};

// ─── LINE ITEM ROW ────────────────────────────────────────────────────────────
const LineItemRow=({item,index,onChange,onRemove,pricebook=[]})=>{
  const total=Number(item.quantity||0)*Number(item.unit_price||0);
  return(
    <div style={{display:"grid",gridTemplateColumns:"1fr 80px 110px 100px 36px",gap:8,alignItems:"center",padding:"8px 0",borderBottom:`1px solid ${C.smoke}20`}}>
      {/* Description */}
      <div>
        <input value={item.description||""} onChange={e=>onChange({...item,description:e.target.value})}
          placeholder="Description de la prestation..."
          style={{width:"100%",padding:"7px 10px",background:C.smoke,border:`1px solid ${C.steel}`,borderRadius:6,color:C.white,fontSize:12,fontFamily:"inherit"}}
          onFocus={e=>e.target.style.borderColor=C.flame} onBlur={e=>e.target.style.borderColor=C.steel}
        />
        {item.deficiency_title&&<div style={{fontSize:10,color:C.mist,marginTop:3}}>↳ Déficience: {item.deficiency_title}</div>}
      </div>
      {/* Qty */}
      <input type="number" value={item.quantity||1} min="0.01" step="0.01"
        onChange={e=>onChange({...item,quantity:e.target.value})}
        style={{padding:"7px 8px",background:C.smoke,border:`1px solid ${C.steel}`,borderRadius:6,color:C.white,fontSize:12,textAlign:"center",fontFamily:"inherit",width:"100%"}}
        onFocus={e=>e.target.style.borderColor=C.flame} onBlur={e=>e.target.style.borderColor=C.steel}
      />
      {/* Unit price */}
      <div style={{position:"relative"}}>
        <input type="number" value={item.unit_price||""} min="0" step="0.01"
          onChange={e=>onChange({...item,unit_price:e.target.value})}
          placeholder="0.00"
          style={{width:"100%",padding:"7px 10px 7px 20px",background:C.smoke,border:`1px solid ${C.steel}`,borderRadius:6,color:C.white,fontSize:12,fontFamily:"inherit"}}
          onFocus={e=>e.target.style.borderColor=C.flame} onBlur={e=>e.target.style.borderColor=C.steel}
        />
        <span style={{position:"absolute",left:8,top:"50%",transform:"translateY(-50%)",color:C.mist,fontSize:11,pointerEvents:"none"}}>€</span>
      </div>
      {/* Total */}
      <div style={{fontSize:13,fontWeight:600,color:C.white,textAlign:"right",paddingRight:4}}>
        {fmt(total)}
      </div>
      {/* Remove */}
      <button onClick={onRemove}
        style={{width:28,height:28,borderRadius:6,border:"none",background:`${C.danger}20`,color:C.danger,cursor:"pointer",fontSize:16,display:"flex",alignItems:"center",justifyContent:"center"}}>×</button>
    </div>
  );
};

// ─── PROPOSAL FORM MODAL ──────────────────────────────────────────────────────
const ProposalFormModal=({proposal,companyId,db,onSave,onClose})=>{
  const isEdit=!!proposal?.id;
  const [form,setForm]=useState({
    title:"",intro_text:"",terms_text:"",tax_rate:0,discount:0,
    issued_date:new Date().toISOString().split("T")[0],
    expiry_date:new Date(Date.now()+30*864e5).toISOString().split("T")[0],
    customer_id:"",building_id:"",
    ...(proposal||{}),
    // Convert stored decimal tax_rate (0.2) back to percentage (20) for the input
    tax_rate: proposal?.tax_rate != null ? Number(proposal.tax_rate) * 100 : 0,
  });
  const [items,setItems]=useState([]);
  const [customers,setCustomers]=useState([]);
  const [buildings,setBuildings]=useState([]);
  const [deficiencies,setDeficiencies]=useState([]);
  const [pricebook,setPricebook]=useState([]);
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState(null);
  const [tab,setTab]=useState("info"); // info | items | terms

  const set=(k)=>(v)=>setForm(f=>({...f,[k]:v}));

  useEffect(()=>{
    (async()=>{
      try{
        const[custs,pb]=await Promise.all([
          db.from("customers").select("id,name").eq("company_id",companyId).eq("is_active",true).order("name").get(),
          db.from("pricebook_items").select("id,name,description,unit_price,trade").eq("company_id",companyId).eq("is_active",true).order("name").get(),
        ]);
        setCustomers(custs||[]);
        setPricebook(pb||[]);
        // Load existing line items if editing
        if(isEdit&&proposal.id){
          const its=await db.from("proposal_line_items").select("*").eq("proposal_id",proposal.id).order("order_index").get();
          setItems((its||[]).map(i=>({...i,_key:i.id})));
        }
      }catch(e){setError(e.message);}
    })();
  },[]);

  // Load buildings when customer changes
  useEffect(()=>{
    if(!form.customer_id){setBuildings([]); return;}
    db.from("buildings").select("id,name,address").eq("customer_id",form.customer_id).order("name").get()
      .then(b=>setBuildings(b||[])).catch(()=>{});
    // Load open deficiencies for this customer
    db.from("deficiencies").select("id,title,severity,nfpa_reference").eq("customer_id",form.customer_id).eq("status","open").order("identified_at",false).get()
      .then(d=>setDeficiencies(d||[])).catch(()=>{});
  },[form.customer_id]);

  const addItem=(deficiency=null)=>{
    const newItem={
      _key:Date.now(),
      description:deficiency?`Correction: ${deficiency.title}`:"",
      quantity:1,
      unit_price:"",
      deficiency_id:deficiency?.id||null,
      deficiency_title:deficiency?.title||null,
      order_index:items.length,
    };
    setItems(prev=>[...prev,newItem]);
  };

  const addFromPricebook=(pb)=>{
    setItems(prev=>[...prev,{
      _key:Date.now(),
      description:pb.name+(pb.description?` — ${pb.description}`:""),
      quantity:1,
      unit_price:pb.unit_price,
      pricebook_item_id:pb.id,
      order_index:prev.length,
    }]);
  };

  const subtotal=items.reduce((s,i)=>s+Number(i.quantity||0)*Number(i.unit_price||0),0);
  const taxAmt=subtotal*(Number(form.tax_rate)||0)/100;
  const discountAmt=Number(form.discount)||0;
  const formTotal=subtotal+taxAmt-discountAmt;

  const handleSave=async(statusOverride)=>{
    if(!form.customer_id){setError("Veuillez sélectionner un client."); setTab("info"); return;}
    if(!form.title?.trim()){setError("Le titre est obligatoire."); setTab("info"); return;}
    if(items.length===0){setError("Ajoutez au moins une ligne."); setTab("items"); return;}
    setSaving(true); setError(null);
    try{
      const payload={
        ...form,
        company_id:companyId,
        status:statusOverride||form.status||"draft",
        subtotal,tax_amount:taxAmt,total:formTotal,
        tax_rate:(Number(form.tax_rate)||0)/100,
        discount:discountAmt,
        sent_at:statusOverride==="sent"?new Date().toISOString():form.sent_at||null,
        updated_at:new Date().toISOString(),
      };
      delete payload._key;

      let saved;
      if(isEdit){
        saved=await db.from("proposals").eq("id",proposal.id).patch(payload);
      }else{
        // Generate proposal number
        const num=`DEV-${Date.now().toString().slice(-6)}`;
        saved=await db.from("proposals").insert({...payload,proposal_number:num,created_by:null});
      }

      // Save line items — delete old, insert new
      if(isEdit){
        await db.from("proposal_line_items").eq("proposal_id",saved.id||proposal.id).del().catch(()=>{});
      }
      const pid=saved?.id||proposal?.id;
      await Promise.all(items.map((item,idx)=>{
        const{_key,deficiency_title,...rest}=item;
        return db.from("proposal_line_items").insert({...rest,proposal_id:pid,order_index:idx,quantity:Number(item.quantity)||1,unit_price:Number(item.unit_price)||0});
      }));

      onSave({...saved,id:pid});
    }catch(e){
      setError(e.message);
    }finally{
      setSaving(false);
    }
  };

  const TABS=[{id:"info",label:"Informations"},{id:"items",label:`Lignes (${items.length})`},{id:"terms",label:"Conditions"}];

  return(
    <Modal title={isEdit?"Modifier le devis":"Nouveau devis"} onClose={onClose} width={680}>
      {/* Tab nav */}
      <div style={{display:"flex",borderBottom:`1px solid ${C.smoke}`,padding:"0 20px",flexShrink:0}}>
        {TABS.map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)}
            style={{padding:"10px 16px",border:"none",borderBottom:`2px solid ${tab===t.id?C.flame:"transparent"}`,
              background:"transparent",color:tab===t.id?C.flame:C.mist,fontSize:12,fontWeight:tab===t.id?600:400,cursor:"pointer",fontFamily:"inherit"}}>
            {t.label}
          </button>
        ))}
      </div>

      <div style={{padding:20,display:"flex",flexDirection:"column",gap:16}}>
        {error&&<ErrorBanner msg={error}/>}

        {/* ── INFO TAB ── */}
        {tab==="info"&&<>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <Field label="Client" required>
              <Select value={form.customer_id} onChange={v=>{set("customer_id")(v);set("building_id")("");}}
                options={customers.map(c=>({value:c.id,label:c.name}))} placeholder="Sélectionner un client..."/>
            </Field>
            <Field label="Bâtiment">
              <Select value={form.building_id} onChange={set("building_id")}
                options={buildings.map(b=>({value:b.id,label:b.name}))} placeholder="Sélectionner un bâtiment..."/>
            </Field>
          </div>
          <Field label="Titre du devis" required>
            <Input value={form.title} onChange={set("title")} placeholder="Travaux de mise en conformité NFPA 72 — Bâtiment A"/>
          </Field>
          <Field label="Introduction (visible par le client)">
            <Textarea value={form.intro_text} onChange={set("intro_text")} rows={3}
              placeholder="Suite à l'inspection du {date}, nous vous proposons les travaux suivants..."/>
          </Field>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12}}>
            <Field label="Date d'émission">
              <Input type="date" value={form.issued_date} onChange={set("issued_date")}/>
            </Field>
            <Field label="Date d'expiration">
              <Input type="date" value={form.expiry_date} onChange={set("expiry_date")}/>
            </Field>
            <Field label="Remise (€)">
              <Input type="number" value={form.discount} onChange={set("discount")} placeholder="0"/>
            </Field>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <Field label="TVA (%)" hint="Ex: 20 pour 20%">
              <Input type="number" value={form.tax_rate} onChange={set("tax_rate")} placeholder="20"/>
            </Field>
          </div>
        </>}

        {/* ── ITEMS TAB ── */}
        {tab==="items"&&<>
          {/* Add from deficiencies */}
          {deficiencies.length>0&&(
            <div>
              <div style={{fontSize:11,color:C.mist,textTransform:"uppercase",letterSpacing:"0.05em",marginBottom:8}}>
                Ajouter depuis les déficiences ouvertes
              </div>
              <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                {deficiencies.map(d=>(
                  <button key={d.id} onClick={()=>addItem(d)}
                    style={{padding:"5px 12px",borderRadius:6,border:`1px solid ${C.steel}`,background:"transparent",
                      color:C.mist,fontSize:11,cursor:"pointer",fontFamily:"inherit",transition:"all 0.12s"}}
                    onMouseEnter={e=>{e.currentTarget.style.borderColor=C.flame;e.currentTarget.style.color=C.flame;}}
                    onMouseLeave={e=>{e.currentTarget.style.borderColor=C.steel;e.currentTarget.style.color=C.mist;}}>
                    + {d.title.slice(0,40)}{d.title.length>40?"...":""}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Add from pricebook */}
          {pricebook.length>0&&(
            <div>
              <div style={{fontSize:11,color:C.mist,textTransform:"uppercase",letterSpacing:"0.05em",marginBottom:8}}>
                Ajouter depuis le catalogue
              </div>
              <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                {pricebook.slice(0,12).map(pb=>(
                  <button key={pb.id} onClick={()=>addFromPricebook(pb)}
                    style={{padding:"5px 12px",borderRadius:6,border:`1px solid ${C.steel}`,background:"transparent",
                      color:C.mist,fontSize:11,cursor:"pointer",fontFamily:"inherit",transition:"all 0.12s"}}
                    onMouseEnter={e=>{e.currentTarget.style.borderColor=C.info;e.currentTarget.style.color=C.info;}}
                    onMouseLeave={e=>{e.currentTarget.style.borderColor=C.steel;e.currentTarget.style.color=C.mist;}}>
                    📦 {pb.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          <Divider label="Lignes du devis"/>

          {/* Column headers */}
          {items.length>0&&(
            <div style={{display:"grid",gridTemplateColumns:"1fr 80px 110px 100px 36px",gap:8,padding:"4px 0"}}>
              {["Description","Qté","Prix unit.","Total",""].map((h,i)=>(
                <div key={i} style={{fontSize:10,color:C.mist,textTransform:"uppercase",letterSpacing:"0.05em",textAlign:i>=2?"right":"left"}}>{h}</div>
              ))}
            </div>
          )}

          {items.map((item,i)=>(
            <LineItemRow key={item._key||i} item={item} index={i}
              onChange={updated=>setItems(prev=>prev.map((it,idx)=>idx===i?updated:it))}
              onRemove={()=>setItems(prev=>prev.filter((_,idx)=>idx!==i))}
              pricebook={pricebook}
            />
          ))}

          <Btn variant="secondary" icon="+" onClick={()=>addItem()} style={{alignSelf:"flex-start"}}>
            Ajouter une ligne
          </Btn>

          {/* Totals */}
          {items.length>0&&(
            <div style={{background:C.smoke,borderRadius:8,padding:16,display:"flex",flexDirection:"column",gap:8,marginTop:8}}>
              {[
                {label:"Sous-total",value:fmt(subtotal)},
                {label:`TVA (${form.tax_rate||0}%)`,value:fmt(taxAmt)},
                ...(discountAmt>0?[{label:"Remise",value:`-${fmt(discountAmt)}`,color:C.safe}]:[]),
              ].map((row,i)=>(
                <div key={i} style={{display:"flex",justifyContent:"space-between",fontSize:13,color:row.color||C.mist}}>
                  <span>{row.label}</span><span>{row.value}</span>
                </div>
              ))}
              <div style={{display:"flex",justifyContent:"space-between",fontSize:16,fontWeight:800,color:C.white,borderTop:`1px solid ${C.steel}`,paddingTop:8,marginTop:4}}>
                <span>Total TTC</span><span>{fmt(formTotal)}</span>
              </div>
            </div>
          )}
        </>}

        {/* ── TERMS TAB ── */}
        {tab==="terms"&&(
          <Field label="Conditions générales">
            <Textarea value={form.terms_text} onChange={set("terms_text")} rows={10}
              placeholder={`Conditions de paiement : paiement à 30 jours\nGarantie : 1 an sur les pièces et la main d'œuvre\nValidité du devis : 30 jours\n\nTout travail supplémentaire non prévu dans ce devis fera l'objet d'un avenant.`}/>
          </Field>
        )}

        {/* Action buttons */}
        <div style={{display:"flex",gap:10,paddingTop:8,borderTop:`1px solid ${C.smoke}`,marginTop:4}}>
          <Btn variant="secondary" onClick={onClose}>Annuler</Btn>
          <Btn variant="secondary" onClick={()=>handleSave("draft")} disabled={saving}>
            {saving?<><Spinner/> ...</>:"💾 Brouillon"}
          </Btn>
          <Btn onClick={()=>handleSave("sent")} disabled={saving} style={{marginLeft:"auto"}}>
            {saving?<><Spinner/> Envoi...</>:"📤 Enregistrer & Envoyer"}
          </Btn>
        </div>
      </div>
    </Modal>
  );
};

// ─── PROPOSAL DETAIL VIEW ─────────────────────────────────────────────────────
const ProposalDetail=({proposal:initialProposal,db,companyId,onBack,onEdit,onStatusChange})=>{
  const [proposal,setProposal]=useState(initialProposal);
  const [items,setItems]=useState([]);
  const [loading,setLoading]=useState(true);
  const [showSignature,setShowSignature]=useState(false);
  const [signerName,setSignerName]=useState("");
  const [signing,setSigning]=useState(false);
  const [error,setError]=useState(null);

  useEffect(()=>{
    (async()=>{
      try{
        const[p,its]=await Promise.all([
          db.from("proposals").select("*,customer:customers(name,email,address,city,state),building:buildings(name,address)").eq("id",proposal.id).single().get(),
          db.from("proposal_line_items").select("*").eq("proposal_id",proposal.id).order("order_index").get(),
        ]);
        setProposal(p);
        setItems(its||[]);
      }catch(e){setError(e.message);}
      finally{setLoading(false);}
    })();
  },[proposal.id]);

  const handleSign=async(signatureDataUrl)=>{
    if(!signerName.trim()){alert("Veuillez entrer votre nom."); return;}
    setSigning(true);
    try{
      const updated=await db.from("proposals").eq("id",proposal.id).patch({
        status:"approved",
        approved_at:new Date().toISOString(),
        approved_by:signerName,
        signature_url:signatureDataUrl,
        signature_ip:"client",
      });
      setProposal(prev=>({...prev,status:"approved",approved_at:new Date().toISOString(),approved_by:signerName}));
      setShowSignature(false);
      onStatusChange&&onStatusChange("approved");
    }catch(e){
      alert("Erreur lors de la signature: "+e.message);
    }finally{
      setSigning(false);
    }
  };

  const handleDecline=async()=>{
    if(!window.confirm("Confirmer le refus de ce devis ?")) return;
    try{
      await db.from("proposals").eq("id",proposal.id).patch({status:"declined",updated_at:new Date().toISOString()});
      setProposal(prev=>({...prev,status:"declined"}));
      onStatusChange&&onStatusChange("declined");
    }catch(e){alert(e.message);}
  };

  const handleConvertToInvoice=async()=>{
    if(!window.confirm("Convertir ce devis en facture ?")) return;
    try{
      const invNum=`FAC-${Date.now().toString().slice(-6)}`;
      await db.from("invoices").insert({
        company_id:companyId,
        customer_id:proposal.customer_id,
        building_id:proposal.building_id,
        proposal_id:proposal.id,
        invoice_number:invNum,
        status:"draft",
        subtotal:subtotal,
        tax_rate:taxRatePct/100,
        tax_amount:taxAmt,
        discount:discountAmt,
        total:detailTotal,
        amount_paid:0,
      });
      await db.from("proposals").eq("id",proposal.id).patch({status:"invoiced",updated_at:new Date().toISOString()});
      setProposal(prev=>({...prev,status:"invoiced"}));
      alert(`Facture ${invNum} créée avec succès !`);
    }catch(e){alert("Erreur: "+e.message);}
  };

  if(loading) return <div style={{padding:40,textAlign:"center",color:C.mist}}><Spinner size={20}/></div>;

  // Recalculate totals from actual line items (don't rely on stale DB fields)
  const subtotal=items.reduce((s,i)=>s+Number(i.quantity||0)*Number(i.unit_price||0),0);
  const taxRate=Number(proposal.tax_rate||0);
  const taxRatePct=taxRate>1?taxRate:taxRate*100; // handle stored as 0.20 or 20
  const taxAmt=subtotal*(taxRatePct/100);
  const discountAmt=Number(proposal.discount||0);
  const detailTotal=subtotal+taxAmt-discountAmt;

  const isApproved=proposal.status==="approved";
  const canSign=proposal.status==="sent";
  const canEdit=["draft","sent"].includes(proposal.status);

  return(
    <div style={{display:"flex",flexDirection:"column",height:"100%"}}>
      {/* Header */}
      <div style={{padding:"14px 20px",borderBottom:`1px solid ${C.smoke}`,display:"flex",alignItems:"center",gap:12,flexShrink:0}}>
        <button onClick={onBack} style={{background:"none",border:"none",color:C.mist,cursor:"pointer",fontSize:20,padding:"0 4px"}}>←</button>
        <div style={{flex:1}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <span style={{fontSize:15,fontWeight:700,color:C.white}}>{proposal.title}</span>
            <Badge type={STATUS_COLOR[proposal.status]||"default"}>{STATUS_FR[proposal.status]||proposal.status}</Badge>
          </div>
          <div style={{fontSize:11,color:C.mist,marginTop:2}}>
            {proposal.proposal_number} · {proposal.customer?.name}
            {proposal.building?.name&&` · ${proposal.building.name}`}
          </div>
        </div>
        <div style={{display:"flex",gap:8}}>
          {canEdit&&<Btn variant="secondary" size="sm" onClick={onEdit}>✏ Modifier</Btn>}
          {canSign&&(
            <>
              <Btn variant="danger" size="sm" onClick={handleDecline}>✗ Refuser</Btn>
              <Btn variant="success" size="sm" onClick={()=>setShowSignature(true)}>✓ Approuver & Signer</Btn>
            </>
          )}
          {isApproved&&<Btn size="sm" onClick={handleConvertToInvoice}>📄 Créer la facture</Btn>}
        </div>
      </div>

      {/* Content */}
      <div style={{flex:1,overflowY:"auto",padding:24}}>
        {error&&<ErrorBanner msg={error}/>}

        {/* Approval banner */}
        {isApproved&&(
          <div style={{padding:"14px 18px",background:`${C.safe}12`,border:`1px solid ${C.safe}30`,borderRadius:8,marginBottom:20,display:"flex",alignItems:"center",gap:12}}>
            <span style={{fontSize:22}}>✅</span>
            <div>
              <div style={{fontSize:13,fontWeight:600,color:C.safe}}>Devis approuvé</div>
              <div style={{fontSize:11,color:C.mist}}>
                Signé par {proposal.approved_by} le {new Date(proposal.approved_at).toLocaleDateString("fr-FR",{day:"numeric",month:"long",year:"numeric"})}
              </div>
            </div>
          </div>
        )}

        {proposal.status==="declined"&&(
          <div style={{padding:"14px 18px",background:`${C.danger}12`,border:`1px solid ${C.danger}30`,borderRadius:8,marginBottom:20}}>
            <div style={{fontSize:13,fontWeight:600,color:C.danger}}>Devis refusé</div>
          </div>
        )}

        {/* Proposal document */}
        <Card style={{padding:0,overflow:"hidden"}}>
          {/* Doc header */}
          <div style={{background:`linear-gradient(135deg,${C.flame}15,${C.ember}10)`,padding:28,borderBottom:`1px solid ${C.smoke}`}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
              <div>
                <div style={{fontFamily:"Syne,sans-serif",fontSize:22,fontWeight:800,color:C.white}}>DEVIS</div>
                <div style={{fontSize:13,color:C.mist,marginTop:4}}>{proposal.proposal_number}</div>
              </div>
              <div style={{textAlign:"right"}}>
                <div style={{fontFamily:"Syne,sans-serif",fontSize:18,fontWeight:700,color:C.flame}}>FireSafe Pro</div>
                <div style={{fontSize:11,color:C.mist,marginTop:4}}>
                  Émis le {new Date(proposal.issued_date||proposal.created_at).toLocaleDateString("fr-FR")}<br/>
                  Expire le {new Date(proposal.expiry_date||Date.now()+30*864e5).toLocaleDateString("fr-FR")}
                </div>
              </div>
            </div>
          </div>

          {/* Client info */}
          <div style={{padding:"16px 28px",borderBottom:`1px solid ${C.smoke}`,display:"flex",gap:40}}>
            <div>
              <div style={{fontSize:10,color:C.mist,textTransform:"uppercase",letterSpacing:"0.05em",marginBottom:6}}>Destinataire</div>
              <div style={{fontSize:13,fontWeight:600,color:C.white}}>{proposal.customer?.name}</div>
              {proposal.building&&<div style={{fontSize:12,color:C.mist}}>{proposal.building.name}</div>}
              {proposal.customer?.address&&<div style={{fontSize:12,color:C.mist}}>{proposal.customer.address}</div>}
            </div>
          </div>

          {/* Intro */}
          {proposal.intro_text&&(
            <div style={{padding:"16px 28px",borderBottom:`1px solid ${C.smoke}`,fontSize:13,color:C.frost,lineHeight:1.6}}>
              {proposal.intro_text}
            </div>
          )}

          {/* Line items */}
          <div style={{padding:"0 28px"}}>
            <div style={{display:"grid",gridTemplateColumns:"1fr 80px 110px 110px",gap:8,padding:"12px 0",borderBottom:`1px solid ${C.smoke}`}}>
              {["Description","Qté","Prix unit.","Total"].map((h,i)=>(
                <div key={i} style={{fontSize:10,color:C.mist,textTransform:"uppercase",letterSpacing:"0.05em",textAlign:i>0?"right":"left",fontWeight:600}}>{h}</div>
              ))}
            </div>
            {items.map((item,i)=>(
              <div key={i} style={{display:"grid",gridTemplateColumns:"1fr 80px 110px 110px",gap:8,padding:"12px 0",borderBottom:`1px solid ${C.smoke}20`}}>
                <div style={{fontSize:13,color:C.frost}}>{item.description}</div>
                <div style={{fontSize:13,color:C.mist,textAlign:"right"}}>{item.quantity}</div>
                <div style={{fontSize:13,color:C.mist,textAlign:"right"}}>{fmt(item.unit_price)}</div>
                <div style={{fontSize:13,fontWeight:600,color:C.white,textAlign:"right"}}>{fmt(item.total||Number(item.quantity)*Number(item.unit_price))}</div>
              </div>
            ))}
          </div>

          {/* Totals */}
          <div style={{padding:"16px 28px",borderTop:`1px solid ${C.smoke}`,display:"flex",justifyContent:"flex-end"}}>
            <div style={{width:260,display:"flex",flexDirection:"column",gap:8}}>
              {[
                {label:"Sous-total HT",value:fmt(subtotal)},
                {label:`TVA (${taxRatePct}%)`,value:fmt(taxAmt)},
                ...(discountAmt>0?[{label:"Remise",value:`-${fmt(discountAmt)}`,color:C.safe}]:[]),
              ].map((r,i)=>(
                <div key={i} style={{display:"flex",justifyContent:"space-between",fontSize:13,color:r.color||C.mist}}>
                  <span>{r.label}</span><span>{r.value}</span>
                </div>
              ))}
              <div style={{display:"flex",justifyContent:"space-between",fontSize:18,fontWeight:800,color:C.white,borderTop:`1px solid ${C.steel}`,paddingTop:10,marginTop:4}}>
                <span>Total TTC</span><span style={{color:C.flame}}>{fmt(detailTotal)}</span>
              </div>
            </div>
          </div>

          {/* Terms */}
          {proposal.terms_text&&(
            <div style={{padding:"16px 28px",borderTop:`1px solid ${C.smoke}`,fontSize:11,color:C.mist,lineHeight:1.7,whiteSpace:"pre-line"}}>
              <div style={{fontWeight:600,marginBottom:6,textTransform:"uppercase",letterSpacing:"0.05em"}}>Conditions générales</div>
              {proposal.terms_text}
            </div>
          )}

          {/* Signature area */}
          {isApproved&&(
            <div style={{padding:"16px 28px",borderTop:`1px solid ${C.smoke}`,display:"flex",gap:40}}>
              <div>
                <div style={{fontSize:10,color:C.mist,textTransform:"uppercase",letterSpacing:"0.05em",marginBottom:6}}>Signature client</div>
                <div style={{fontSize:13,color:C.safe}}>✓ Approuvé par {proposal.approved_by}</div>
                <div style={{fontSize:11,color:C.mist}}>le {new Date(proposal.approved_at).toLocaleDateString("fr-FR",{day:"numeric",month:"long",year:"numeric"})}</div>
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* Signature modal */}
      {showSignature&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.8)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:2000,padding:20}}>
          <div style={{background:C.ash,border:`1px solid ${C.smoke}`,borderRadius:12,width:"100%",maxWidth:620,padding:28,animation:"propSlideUp 0.2s ease"}}>
            <h2 style={{fontSize:16,fontWeight:700,color:C.white,marginBottom:4}}>Approuver le devis</h2>
            <p style={{fontSize:13,color:C.mist,marginBottom:20}}>En signant, vous acceptez les conditions du devis <strong style={{color:C.white}}>{proposal.proposal_number}</strong> pour un montant de <strong style={{color:C.flame}}>{fmt(detailTotal)}</strong>.</p>

            <Field label="Nom complet du signataire" required>
              <Input value={signerName} onChange={setSignerName} placeholder="Prénom Nom"/>
            </Field>

            <div style={{marginTop:16}}>
              <div style={{fontSize:11,color:C.mist,textTransform:"uppercase",letterSpacing:"0.05em",marginBottom:8}}>Signature</div>
              <SignaturePad onSign={handleSign}/>
            </div>

            <div style={{marginTop:16,display:"flex",gap:10}}>
              <Btn variant="secondary" full onClick={()=>setShowSignature(false)} disabled={signing}>Annuler</Btn>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── PROPOSALS LIST ───────────────────────────────────────────────────────────
const ProposalsList=({db,companyId,onSelect,onAdd})=>{
  const [proposals,setProposals]=useState([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState(null);
  const [filter,setFilter]=useState("all");

  const load=useCallback(async()=>{
    setLoading(true); setError(null);
    try{
      const q=db.from("proposals")
        .select("id,proposal_number,title,status,total,issued_date,expiry_date,created_at,customer:customers(name),building:buildings(name)")
        .eq("company_id",companyId)
        .order("created_at",false);
      if(filter!=="all") q.eq("status",filter);
      const data=await q.get();
      setProposals(data||[]);
    }catch(e){setError(e.message);}
    finally{setLoading(false);}
  },[companyId,filter]);

  useEffect(()=>{load();},[load]);

  const filters=[
    {id:"all",label:"Tous"},
    {id:"draft",label:"Brouillons"},
    {id:"sent",label:"Envoyés"},
    {id:"approved",label:"Approuvés"},
    {id:"declined",label:"Refusés"},
    {id:"invoiced",label:"Facturés"},
  ];

  const totalApproved=proposals.filter(p=>p.status==="approved").reduce((s,p)=>s+Number(p.total||0),0);
  const totalPending=proposals.filter(p=>p.status==="sent").reduce((s,p)=>s+Number(p.total||0),0);

  return(
    <div style={{display:"flex",flexDirection:"column",height:"100%"}}>
      {/* Toolbar */}
      <div style={{padding:"14px 20px",borderBottom:`1px solid ${C.smoke}`,display:"flex",gap:12,alignItems:"center",flexShrink:0,flexWrap:"wrap"}}>
        <div style={{display:"flex",gap:2,background:C.smoke,borderRadius:6,padding:3}}>
          {filters.map(f=>(
            <button key={f.id} onClick={()=>setFilter(f.id)}
              style={{padding:"5px 12px",borderRadius:4,border:"none",background:filter===f.id?C.flame:"transparent",
                color:filter===f.id?"#fff":C.mist,fontSize:12,fontWeight:filter===f.id?600:400,cursor:"pointer",fontFamily:"inherit",transition:"all 0.12s"}}>
              {f.label}
            </button>
          ))}
        </div>
        <Btn icon="+" onClick={onAdd} style={{marginLeft:"auto"}}>Nouveau devis</Btn>
      </div>

      {/* Stats */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,padding:"14px 20px",borderBottom:`1px solid ${C.smoke}`,flexShrink:0}}>
        {[
          {label:"Total devis",value:proposals.length,color:C.mist},
          {label:"En attente",value:proposals.filter(p=>p.status==="sent").length,color:C.info},
          {label:"Montant approuvé",value:fmt(totalApproved),color:C.safe},
          {label:"Montant en attente",value:fmt(totalPending),color:C.warn},
        ].map((s,i)=>(
          <Card key={i} style={{padding:14}}>
            <div style={{fontSize:11,color:C.mist,marginBottom:6}}>{s.label}</div>
            <div style={{fontSize:16,fontWeight:800,fontFamily:"Syne,sans-serif",color:s.color}}>{loading?"—":s.value}</div>
          </Card>
        ))}
      </div>

      {/* List */}
      <div style={{flex:1,overflowY:"auto"}}>
        {loading&&<div style={{padding:40,textAlign:"center",color:C.mist}}><Spinner size={20}/><div style={{marginTop:10,fontSize:13}}>Chargement...</div></div>}
        {!loading&&error&&<div style={{padding:20}}><ErrorBanner msg={error}/></div>}
        {!loading&&proposals.length===0&&(
          <div style={{padding:60,textAlign:"center"}}>
            <div style={{fontSize:48,marginBottom:12}}>📋</div>
            <div style={{fontSize:15,fontWeight:600,color:C.frost,marginBottom:8}}>Aucun devis</div>
            <div style={{fontSize:13,color:C.mist,marginBottom:20}}>Créez votre premier devis pour un client</div>
            <Btn icon="+" onClick={onAdd}>Nouveau devis</Btn>
          </div>
        )}
        {!loading&&proposals.map(p=>{
          const isExpired=p.expiry_date&&new Date(p.expiry_date)<new Date()&&p.status==="sent";
          return(
            <div key={p.id} onClick={()=>onSelect(p)}
              style={{padding:"14px 20px",borderBottom:`1px solid ${C.smoke}20`,display:"flex",alignItems:"center",gap:14,cursor:"pointer",transition:"background 0.12s"}}
              onMouseEnter={e=>e.currentTarget.style.background=C.smoke}
              onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
              {/* Icon */}
              <div style={{width:40,height:40,borderRadius:8,background:`${STATUS_COLOR[p.status]==="success"?C.safe:STATUS_COLOR[p.status]==="info"?C.info:C.flame}15`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0}}>
                {p.status==="approved"?"✅":p.status==="declined"?"❌":p.status==="invoiced"?"🧾":"📋"}
              </div>
              {/* Info */}
              <div style={{flex:1,minWidth:0}}>
                <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:3}}>
                  <span style={{fontSize:13,fontWeight:600,color:C.white,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.title}</span>
                  <Badge type={STATUS_COLOR[p.status]||"default"}>{STATUS_FR[p.status]||p.status}</Badge>
                  {isExpired&&<Badge type="warning">Expiré</Badge>}
                </div>
                <div style={{fontSize:11,color:C.mist}}>
                  {p.proposal_number} · {p.customer?.name}
                  {p.building?.name&&` · ${p.building.name}`}
                  {p.issued_date&&` · ${new Date(p.issued_date).toLocaleDateString("fr-FR")}`}
                </div>
              </div>
              {/* Amount */}
              <div style={{textAlign:"right",flexShrink:0}}>
                <div style={{fontSize:15,fontWeight:700,color:p.status==="approved"?C.safe:C.white}}>{fmt(p.total)}</div>
                {p.expiry_date&&p.status==="sent"&&(
                  <div style={{fontSize:10,color:isExpired?C.danger:C.mist}}>
                    Expire {new Date(p.expiry_date).toLocaleDateString("fr-FR")}
                  </div>
                )}
              </div>
              <span style={{color:C.steel,fontSize:18}}>›</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ─── MAIN EXPORT ──────────────────────────────────────────────────────────────
export default function Proposals({user,supabase:sbConfig}){
  const db=React.useMemo(()=>makeDB(sbConfig),[]);
  const [view,setView]=useState("list");   // list | detail
  const [selected,setSelected]=useState(null);
  const [modal,setModal]=useState(null);   // null | "add" | proposal (edit)
  const [listKey,setListKey]=useState(0);  // force list refresh

  const handleSelect=(p)=>{setSelected(p);setView("detail");};
  const handleBack=()=>{setView("list");setSelected(null);};
  const handleAdd=()=>setModal("add");
  const handleEdit=()=>setModal(selected);

  const handleSave=(saved)=>{
    setModal(null);
    setListKey(k=>k+1);
    if(saved?.id){setSelected(saved);setView("detail");}
  };

  return(
    <div style={{height:"100%",minHeight:0,display:"flex",flexDirection:"column"}}>
      <style>{`
        @keyframes propSlideUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}
        @keyframes propSpin{to{transform:rotate(360deg)}}
      `}</style>

      {view==="list"&&(
        <ProposalsList key={listKey} db={db} companyId={user.company_id} onSelect={handleSelect} onAdd={handleAdd}/>
      )}
      {view==="detail"&&selected&&(
        <ProposalDetail proposal={selected} db={db} companyId={user.company_id}
          onBack={handleBack} onEdit={handleEdit}
          onStatusChange={()=>setListKey(k=>k+1)}/>
      )}

      {modal&&(
        <ProposalFormModal
          proposal={modal==="add"?null:modal}
          companyId={user.company_id}
          db={db}
          onSave={handleSave}
          onClose={()=>setModal(null)}
        />
      )}
    </div>
  );
}