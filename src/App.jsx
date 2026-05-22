import { useState, useReducer, useEffect, useRef } from "react";
import React from "react";

const fontLink = document.createElement("link");
fontLink.rel = "stylesheet";
fontLink.href = "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap";
document.head.appendChild(fontLink);

const T = {
  bg:       "#f4f5f7",
  surface:  "#ffffff",
  card:     "#ffffff",
  border:   "#e1e4e8",
  borderHi: "#c1c7d0",
  accent:   "#0052cc",
  accentLt: "#e8f0fe",
  red:      "#c0392b",
  redLt:    "#fdf3f2",
  green:    "#1a7f4b",
  greenLt:  "#edfaf3",
  amber:    "#b45309",
  amberLt:  "#fffbeb",
  gray:     "#6b7280",
  grayLt:   "#f9fafb",
  text:     "#111827",
  subtext:  "#4b5563",
  muted:    "#9ca3af",
  sans:     "'Inter', sans-serif",
  mono:     "'JetBrains Mono', monospace",
  shadow:   "0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)",
  shadowMd: "0 4px 6px rgba(0,0,0,0.06), 0 2px 4px rgba(0,0,0,0.04)",
};

const INIT = {
  notifications: [],
  technicians: [],
  categories: ["Mowers","Vehicles","Tractors","Irrigation","Tools","Trailers"],
  usageLogs: [],
  workOrders: [],
  equipment: [],
  preventiveMaintenance: [],
  parts: [],
  pmSchedules: [],
  pmTasks: [],
  inventoryItems: [],
  profile: null,
  settings: null,
  woSettings: null,
  setupComplete: false,
};

function reducer(state, { type, payload }) {
  switch(type) {
    case "READ_NOTIF":    return { ...state, notifications: state.notifications.map(n => n.id===payload ? {...n,read:true} : n) };
    case "READ_ALL":      return { ...state, notifications: state.notifications.map(n => ({...n,read:true})) };
    case "ADD_WO":        return { ...state, workOrders: [payload,...state.workOrders], notifications:[{id:`N${Date.now()}`,type:"wo",msg:`Work Order ${payload.id} created`,time:"Just now",read:false},...state.notifications] };
    case "UPDATE_WO": {
      const updated = state.workOrders.map(w => w.id===payload.id ? payload : w);
      /* If WO is being completed and is linked to a PM schedule, advance the schedule */
      if(payload.status==="Completed" && payload.scheduleId) {
        const sch = (state.pmSchedules||[]).find(s=>s.id===payload.scheduleId);
        if(sch) {
          const logs = (state.usageLogs||[]).filter(l=>l.equipmentId===sch.equipmentId);
          const curU  = sch.usageType==="mileage"
            ? Math.max(...logs.map(l=>+(l.mileage||0)), 0)
            : Math.max(...logs.map(l=>+(l.hours||0)), 0);
          const advancedSch = { ...sch, lastDoneDate:payload.completed||new Date().toISOString().split("T")[0], lastDoneUsage:curU,
            nextDueDate: sch.timeInterval ? (() => { const d=new Date(payload.completed||new Date()); if(sch.timeUnit==="days")d.setDate(d.getDate()+(+sch.timeInterval)); if(sch.timeUnit==="weeks")d.setDate(d.getDate()+(+sch.timeInterval)*7); if(sch.timeUnit==="months")d.setMonth(d.getMonth()+(+sch.timeInterval)); if(sch.timeUnit==="years")d.setFullYear(d.getFullYear()+(+sch.timeInterval)); return d.toISOString().split("T")[0]; })() : sch.nextDueDate,
            nextDueUsage: sch.usageInterval ? curU+(+sch.usageInterval) : sch.nextDueUsage,
          };
          return { ...state, workOrders:updated, pmSchedules:(state.pmSchedules||[]).map(s=>s.id===sch.id?advancedSch:s) };
        }
      }
      return { ...state, workOrders: updated };
    }
    case "DELETE_WO":     return { ...state, workOrders: state.workOrders.filter(w => w.id!==payload) };
    case "ADD_EQ":        return { ...state, equipment: [payload,...state.equipment] };
    case "UPDATE_EQ":     return { ...state, equipment: state.equipment.map(e => e.id===payload.id ? payload : e) };
    case "DELETE_EQ":     return { ...state, equipment: state.equipment.filter(e => e.id!==payload) };
    case "ADD_PART":      return { ...state, parts: [payload,...state.parts] };
    case "UPDATE_PART":   return { ...state, parts: state.parts.map(p => p.id===payload.id ? payload : p) };
    case "DELETE_PART":   return { ...state, parts: state.parts.filter(p => p.id!==payload) };
    case "CONSUME_PARTS": {
      let parts = [...state.parts];
      (payload||[]).forEach(({partId,qty})=>{ parts = parts.map(p => p.id===partId ? {...p,qty:Math.max(0,(p.qty||0)-(+qty||0))} : p); });
      return { ...state, parts };
    }
    case "UPDATE_PM":     return { ...state, preventiveMaintenance: state.preventiveMaintenance.map(p => p.id===payload.id ? payload : p) };
    case "ADD_PM":        return { ...state, preventiveMaintenance: [...state.preventiveMaintenance, payload] };
    case "ADD_PM_SCHEDULE":   return { ...state, pmSchedules: [...(state.pmSchedules||[]), payload] };
    case "UPDATE_PM_SCHEDULE":return { ...state, pmSchedules: (state.pmSchedules||[]).map(s=>s.id===payload.id?payload:s) };
    case "DELETE_PM_SCHEDULE":return { ...state, pmSchedules: (state.pmSchedules||[]).filter(s=>s.id!==payload) };
    case "ADD_PM_TASK":       return { ...state, pmTasks: [...(state.pmTasks||[]), payload] };
    case "UPDATE_PM_TASK":    return { ...state, pmTasks: (state.pmTasks||[]).map(t=>t.id===payload.id?payload:t) };
    case "DELETE_PM_TASK":    return { ...state, pmTasks: (state.pmTasks||[]).filter(t=>t.id!==payload) };
    case "ADD_INV":       return { ...state, inventoryItems: [...(state.inventoryItems||[]), payload] };
    case "DELETE_INV":    return { ...state, inventoryItems: (state.inventoryItems||[]).filter(i => i.id!==payload) };
    case "UPDATE_PROFILE":return { ...state, profile: payload };
    case "UPDATE_WO_SETTINGS": return { ...state, woSettings: payload };
    case "ADD_TECH":      return { ...state, technicians: [...(state.technicians||[]), payload] };
    case "UPDATE_TECH":   return { ...state, technicians: (state.technicians||[]).map(t => t.id===payload.id ? payload : t) };
    case "ADD_CATEGORY":  return { ...state, categories: [...new Set([...(state.categories||[]), payload])] };
    case "ADD_USAGE_LOG": return { ...state, usageLogs: [...(state.usageLogs||[]), payload] };
    case "DELETE_USAGE_LOG": return { ...state, usageLogs: (state.usageLogs||[]).filter(u=>u.id!==payload) };
    case "UPDATE_SETTINGS": return { ...state, settings: payload };
    case "COMPLETE_SETUP":  return { ...state, settings: payload.settings, profile: payload.profile, technicians: payload.technicians, categories: payload.categories, setupComplete: true };
    case "RESET_SETUP":     return { ...state, setupComplete: false };
    default: return state;
  }
}

const genId = p => `${p}-${String(Date.now()).slice(-5)}`;
const today = () => new Date().toISOString().split("T")[0];


const csvEscape = v => `"${String(v ?? "").replace(/"/g, '""')}"`;
const downloadCSV = (filename, rows=[]) => {
  if(!rows.length){ alert("No data available to export."); return; }
  const headers = Object.keys(rows[0]);
  const csv = [headers.map(csvEscape).join(","), ...rows.map(r=>headers.map(h=>csvEscape(r[h])).join(","))].join("\n");
  const blob = new Blob([csv], { type:"text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
};
const rowsToDataUri = rows => {
  if(!rows?.length) return "";
  const headers = Object.keys(rows[0]);
  const csv = [headers.map(csvEscape).join(","), ...rows.map(r=>headers.map(h=>csvEscape(r[h])).join(","))].join("\n");
  return `data:text/csv;charset=utf-8,${encodeURIComponent(csv)}`;
};
const reportButtonsHtml = rows => {
  const dataUri = rowsToDataUri(rows);
  return `<br><button onclick="window.print()" style="padding:8px 20px;background:#1a1a2e;color:#fff;border:none;border-radius:6px;cursor:pointer;margin-right:8px">Print / Save PDF</button>${dataUri ? `<a href="${dataUri}" download="report.csv" style="padding:8px 20px;background:#fff;color:#1a1a2e;border:1px solid #1a1a2e;border-radius:6px;text-decoration:none;font-family:Arial,sans-serif;font-size:13px">Download Excel CSV</a>` : ""}`;
};

/* -- STATUS STYLES -- */
const statusStyle = {
  "Open":                          { color:"#1e40af", bg:"#eff6ff",  border:"#bfdbfe" },
  "In Progress":                   { color:"#92400e", bg:"#fffbeb",  border:"#fcd34d" },
  "Completed":                     { color:"#065f46", bg:"#ecfdf5",  border:"#6ee7b7" },
  "Awaiting Parts":                { color:"#6b21a8", bg:"#faf5ff",  border:"#e9d5ff" },
  "On Hold":                       { color:"#7f1d1d", bg:"#fef2f2",  border:"#fca5a5" },
  "Fully Operational":             { color:"#065f46", bg:"#ecfdf5",  border:"#6ee7b7" },
  "Operational with Deficiencies": { color:"#92400e", bg:"#fffbeb",  border:"#fcd34d" },
  "Out of Service / Deadline":     { color:"#7f1d1d", bg:"#fef2f2",  border:"#fca5a5" },
  "No Status":                     { color:"#374151", bg:"#f3f4f6",  border:"#d1d5db" },
  "Active":                        { color:"#065f46", bg:"#ecfdf5",  border:"#6ee7b7" },
  "Inactive":                      { color:"#374151", bg:"#f3f4f6",  border:"#d1d5db" },
  "Out of Service":                { color:"#7f1d1d", bg:"#fef2f2",  border:"#fca5a5" },
  "OK":                            { color:"#065f46", bg:"#ecfdf5",  border:"#6ee7b7" },
  "Due Soon":                      { color:"#92400e", bg:"#fffbeb",  border:"#fcd34d" },
  "Overdue":                       { color:"#7f1d1d", bg:"#fef2f2",  border:"#fca5a5" },
};
const priorityStyle = {
  "High":   { color:"#7f1d1d", bg:"#fef2f2", border:"#fca5a5" },
  "Medium": { color:"#78350f", bg:"#fff7ed", border:"#fdba74" },
  "Low":    { color:"#374151", bg:"#f3f4f6", border:"#d1d5db" },
};
const notifColor = { wo:"#1e40af", pm:"#92400e", insp:"#065f46", stock:"#7f1d1d" };
const notifIcon  = { wo:"📋", pm:"🔧", insp:"🔍", stock:"📦" };

/* -- SHARED UI -- */
const Badge = ({ label, type="status" }) => {
  const s = type==="priority" ? priorityStyle[label] : statusStyle[label];
  if(!s) return <span style={{ fontFamily:T.mono, fontSize:11, color:T.muted }}>{label}</span>;
  return (
    <span style={{ background:"transparent", color:s.color, border:`1.5px solid ${s.color}`, borderRadius:4, padding:"2px 8px", fontSize:11, fontWeight:600, fontFamily:T.mono, whiteSpace:"nowrap" }}>
      {label}
    </span>
  );
};

const Card = ({ children, style={} }) => (
  <div style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:8, padding:"20px 22px", boxShadow:T.shadow, ...style }}>
    {children}
  </div>
);

const SectionHeading = ({ children, sub, action }) => (
  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:16, flexWrap:"wrap", gap:8 }}>
    <div>
      <h3 style={{ margin:0, fontFamily:T.sans, fontSize:15, fontWeight:700, color:T.text, letterSpacing:-.2 }}>{children}</h3>
      {sub && <p style={{ margin:"2px 0 0", fontFamily:T.sans, fontSize:12, color:T.muted }}>{sub}</p>}
    </div>
    {action}
  </div>
);

const inp = { width:"100%", background:"#fff", border:`1px solid ${T.border}`, borderRadius:6, padding:"8px 11px", color:T.text, fontSize:13, fontFamily:T.sans, boxSizing:"border-box", outline:"none", transition:"border-color .15s" };
const sel = { ...inp };

const Btn = ({ children, onClick, variant="primary", small, style={} }) => {
  const styles = {
    primary: { background:T.accent, color:"#fff", border:"none" },
    secondary: { background:"#fff", color:T.text, border:`1px solid ${T.border}` },
    danger: { background:"#fff", color:T.red, border:`1px solid #fca5a5` },
    ghost: { background:"transparent", color:T.subtext, border:"none" },
  };
  return (
    <button onClick={onClick} style={{ ...styles[variant], padding:small?"5px 12px":"8px 16px", borderRadius:6, cursor:"pointer", fontSize:small?12:13, fontWeight:600, fontFamily:T.sans, display:"inline-flex", alignItems:"center", gap:5, ...style }}>
      {children}
    </button>
  );
};

const Field = ({ label, children, half }) => (
  <div style={{ marginBottom:14, gridColumn:half?"span 1":"span 2" }}>
    <label style={{ display:"block", fontFamily:T.sans, fontSize:12, fontWeight:600, color:T.subtext, marginBottom:5 }}>{label}</label>
    {children}
  </div>
);

function Modal({ title, onClose, children }) {
  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.4)", zIndex:2000, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
      <div style={{ background:"#fff", borderRadius:10, border:`1px solid ${T.border}`, width:"100%", maxWidth:560, maxHeight:"92vh", overflowY:"auto", boxShadow:"0 20px 60px rgba(0,0,0,.15)" }}>
        <div style={{ padding:"18px 22px", borderBottom:`1px solid ${T.border}`, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <h3 style={{ margin:0, fontFamily:T.sans, fontSize:16, fontWeight:700, color:T.text }}>{title}</h3>
          <button onClick={onClose} style={{ background:"none", border:"none", color:T.muted, fontSize:22, cursor:"pointer", lineHeight:1, padding:0 }}>×</button>
        </div>
        <div style={{ padding:"20px 22px" }}>{children}</div>
      </div>
    </div>
  );
}

/* Reusable Document Uploader - handles attachments (PDF, images, etc.) stored as base64 */
function DocUploader({ documents=[], onChange, label="Documents", category }) {
  const fileInput = useRef(null);
  const handleUpload = (e) => {
    const files = Array.from(e.target.files || []);
    if(files.length===0) return;
    Promise.all(files.map(f => new Promise((res,rej) => {
      const reader = new FileReader();
      reader.onload = () => res({
        id: `DOC${Date.now()}${Math.random().toString(36).substr(2,5)}`,
        name: f.name,
        type: f.type,
        size: f.size,
        data: reader.result,
        category: category||"General",
        uploaded: new Date().toISOString().split("T")[0],
      });
      reader.onerror = rej;
      reader.readAsDataURL(f);
    }))).then(newDocs => {
      onChange([...(documents||[]), ...newDocs]);
      if(fileInput.current) fileInput.current.value = "";
    });
  };
  const removeDoc = (id) => onChange(documents.filter(d=>d.id!==id));
  const openDoc = (doc) => { const w = window.open(); if(w) w.document.write(`<iframe src="${doc.data}" style="border:none;width:100%;height:100vh"></iframe>`); };
  const fmtSize = (b) => b<1024?`${b}B`:b<1024*1024?`${(b/1024).toFixed(1)}KB`:`${(b/1024/1024).toFixed(1)}MB`;
  return (
    <div>
      <label style={{ display:"block", fontFamily:T.sans, fontSize:12, fontWeight:600, color:T.subtext, marginBottom:8 }}>{label}</label>
      <input ref={fileInput} type="file" multiple onChange={handleUpload} style={{ display:"none" }} accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx" />
      <button type="button" onClick={()=>fileInput.current?.click()} style={{ background:T.grayLt, border:`1px dashed ${T.border}`, borderRadius:6, padding:"10px 16px", color:T.accent, cursor:"pointer", fontFamily:T.sans, fontSize:12, fontWeight:600, width:"100%", textAlign:"center" }}>
        📎 Click to upload files (PDF, images, Office docs)
      </button>
      {(documents||[]).length > 0 && (
        <div style={{ marginTop:10, display:"flex", flexDirection:"column", gap:6 }}>
          {documents.map(doc=>(
            <div key={doc.id} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"7px 12px", background:T.grayLt, borderRadius:6, border:`1px solid ${T.border}` }}>
              <div style={{ display:"flex", alignItems:"center", gap:8, flex:1, minWidth:0 }}>
                <span style={{ fontSize:18 }}>{doc.type?.startsWith("image")?"🖼️":doc.type?.includes("pdf")?"📄":"📎"}</span>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontFamily:T.sans, fontSize:12, fontWeight:600, color:T.text, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{doc.name}</div>
                  <div style={{ fontFamily:T.mono, fontSize:10, color:T.muted }}>{doc.category} · {fmtSize(doc.size)} · {doc.uploaded}</div>
                </div>
              </div>
              <div style={{ display:"flex", gap:4 }}>
                <button type="button" onClick={()=>openDoc(doc)} style={{ background:"none", border:`1px solid ${T.border}`, borderRadius:5, padding:"3px 8px", color:T.accent, cursor:"pointer", fontFamily:T.sans, fontSize:11, fontWeight:600 }}>View</button>
                <button type="button" onClick={()=>removeDoc(doc.id)} style={{ background:"none", border:"none", color:T.red, cursor:"pointer", fontSize:18, lineHeight:1, padding:"0 4px" }}>×</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}


/* -- NOTIFICATION PANEL -- */
function NotifPanel({ notifications, dispatch, onClose }) {
  const unread = notifications.filter(n=>!n.read).length;
  return (
    <div style={{ position:"fixed", top:56, right:16, width:360, background:"#fff", border:`1px solid ${T.border}`, borderRadius:10, zIndex:1500, boxShadow:T.shadowMd, overflow:"hidden" }}>
      <div style={{ padding:"12px 16px", borderBottom:`1px solid ${T.border}`, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <span style={{ fontFamily:T.sans, fontSize:14, fontWeight:700, color:T.text }}>Notifications {unread>0 && <span style={{ background:T.accent, color:"#fff", borderRadius:10, padding:"1px 7px", fontSize:11, marginLeft:4 }}>{unread}</span>}</span>
        <div style={{ display:"flex", gap:8 }}>
          {unread>0 && <Btn small variant="ghost" onClick={()=>dispatch({type:"READ_ALL"})}>Mark all read</Btn>}
          <button onClick={onClose} style={{ background:"none", border:"none", color:T.muted, fontSize:18, cursor:"pointer" }}>×</button>
        </div>
      </div>
      <div style={{ maxHeight:380, overflowY:"auto" }}>
        {notifications.length===0 && <div style={{ padding:24, color:T.muted, textAlign:"center", fontFamily:T.sans, fontSize:13 }}>No notifications</div>}
        {notifications.map(n=>(
          <div key={n.id} onClick={()=>dispatch({type:"READ_NOTIF",payload:n.id})} style={{ padding:"12px 16px", borderBottom:`1px solid ${T.border}`, display:"flex", gap:10, cursor:"pointer", background:n.read?"#fff":"#f8faff" }}>
            <span style={{ fontSize:18, marginTop:1 }}>{notifIcon[n.type]}</span>
            <div style={{ flex:1 }}>
              <p style={{ margin:0, fontFamily:T.sans, fontSize:13, color:n.read?T.subtext:T.text, fontWeight:n.read?400:600, lineHeight:1.4 }}>{n.msg}</p>
              <p style={{ margin:"3px 0 0", fontFamily:T.mono, fontSize:11, color:T.muted }}>{n.time}</p>
            </div>
            {!n.read && <span style={{ width:7, height:7, borderRadius:"50%", background:T.accent, display:"block", marginTop:5, flexShrink:0 }}/>}
          </div>
        ))}
      </div>
    </div>
  );
}

/* -- HEADER -- */
function Header({ notifications, dispatch, currentPage, onMenuToggle }) {
  const [showNotif, setShowNotif] = useState(false);
  const unread = notifications.filter(n=>!n.read).length;
  return (
    <>
      <header style={{ position:"sticky", top:0, zIndex:1000, background:"#fff", borderBottom:`1px solid ${T.border}`, padding:"0 20px", height:56, display:"flex", alignItems:"center", justifyContent:"space-between", boxShadow:"0 1px 0 #e1e4e8" }}>
        <div style={{ display:"flex", alignItems:"center", gap:14 }}>
          {/* Hamburger */}
          <button onClick={onMenuToggle} style={{ background:"none", border:`1px solid ${T.border}`, borderRadius:7, padding:"7px 9px", cursor:"pointer", display:"flex", flexDirection:"column", gap:4, alignItems:"center", justifyContent:"center" }}>
            <span style={{ display:"block", width:18, height:2, background:T.subtext, borderRadius:1 }}/>
            <span style={{ display:"block", width:18, height:2, background:T.subtext, borderRadius:1 }}/>
            <span style={{ display:"block", width:18, height:2, background:T.subtext, borderRadius:1 }}/>
          </button>
          <div style={{ width:1, height:28, background:T.border }} />
          <div>
            <div style={{ fontFamily:T.sans, fontSize:14, fontWeight:700, color:T.text, letterSpacing:-.3, lineHeight:1.2 }}>NCA Maintenance</div>
            <div style={{ fontFamily:T.sans, fontSize:10, color:T.muted, letterSpacing:.3 }}>National Cemetery Administration</div>
          </div>
          {currentPage && (
            <>
              <span style={{ color:T.border, fontSize:18 }}>›</span>
              <span style={{ fontFamily:T.sans, fontSize:13, color:T.subtext, fontWeight:500 }}>{currentPage}</span>
            </>
          )}
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <button onClick={()=>setShowNotif(v=>!v)} style={{ position:"relative", background:"none", border:`1px solid ${T.border}`, borderRadius:7, cursor:"pointer", padding:"6px 8px", color:T.subtext, fontSize:16, display:"flex", alignItems:"center" }}>
            🔔
            {unread>0 && <span style={{ position:"absolute", top:-4, right:-4, minWidth:16, height:16, background:T.red, borderRadius:8, fontSize:10, color:"#fff", fontWeight:700, display:"flex", alignItems:"center", justifyContent:"center", fontFamily:T.mono, border:"2px solid #fff" }}>{unread}</span>}
          </button>
          <div style={{ display:"flex", alignItems:"center", gap:8, padding:"5px 10px", border:`1px solid ${T.border}`, borderRadius:7 }}>
            <div style={{ width:24, height:24, borderRadius:"50%", background:T.accent, display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, color:"#fff", fontWeight:700, fontFamily:T.mono }}>JM</div>
            <span style={{ fontFamily:T.sans, fontSize:13, fontWeight:500, color:T.text }}>J. Martinez</span>
          </div>
        </div>
      </header>
      {showNotif && <NotifPanel notifications={notifications} dispatch={dispatch} onClose={()=>setShowNotif(false)} />}
    </>
  );
}

/* -- NAV -- */
const NAV = [
  { id:"dashboard",  icon:"▦",  label:"Dashboard" },
  { id:"workorders", icon:"📋", label:"Work Orders" },
  { id:"equipment",  icon:"🚜", label:"Equipment" },
  { id:"inventory",  icon:"📋", label:"Equipment Inventory" },
  { id:"parts",      icon:"📦", label:"Parts Inventory" },
  { id:"pm",         icon:"🔧", label:"Preventive Maint." },
  { id:"usage",      icon:"📊", label:"Usage Tracking" },
  { id:"spending",   icon:"💰", label:"Spending & Costs" },
];

const NAV_REPORTS = [
  { id:"reports_deadline",    icon:"🚨", label:"Deadline Equipment" },
  { id:"reports_parts_inv",   icon:"📦", label:"Parts Inventory Report" },
  { id:"reports_pm",          icon:"🔧", label:"PM Report" },
  { id:"reports_usage",       icon:"📊", label:"Usage Report" },
  { id:"reports_spending",    icon:"💰", label:"Spending Reports" },
  { id:"reports_combined",    icon:"📑", label:"Combined Report" },
];

function SlideMenu({ tab, setTab, open, onClose, onSettings, companyName, profile }) {
  return (
    <>
      {/* Backdrop */}
      {open && (
        <div onClick={onClose} style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.35)", zIndex:1100, transition:"opacity .2s" }} />
      )}
      {/* Drawer */}
      <div style={{
        position:"fixed", top:0, left:0, bottom:0, width:260,
        background:"#fff", boxShadow:"4px 0 24px rgba(0,0,0,.12)",
        zIndex:1200, display:"flex", flexDirection:"column",
        transform: open?"translateX(0)":"translateX(-100%)",
        transition:"transform .25s cubic-bezier(.4,0,.2,1)",
      }}>
        {/* Drawer header — click to open Settings */}
        <div style={{ padding:"18px 20px 14px", borderBottom:`1px solid ${T.border}`, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <button onClick={()=>{ onSettings(); onClose(); }} style={{ display:"flex", alignItems:"center", gap:10, background:"none", border:"none", cursor:"pointer", padding:0, textAlign:"left", flex:1 }}
            title="Click to open System Settings">
            <div style={{ width:34, height:34, background:T.accent, borderRadius:8, display:"flex", alignItems:"center", justifyContent:"center", fontSize:16, flexShrink:0 }}>⚙</div>
            <div>
              <div style={{ fontFamily:T.sans, fontSize:13, fontWeight:700, color:T.text, lineHeight:1.2 }}>{companyName||"NCA Maintenance"}</div>
              <div style={{ fontFamily:T.sans, fontSize:10, color:T.accent }}>Tap to open Settings</div>
            </div>
          </button>
          <button onClick={onClose} style={{ background:"none", border:"none", fontSize:22, color:T.muted, cursor:"pointer", lineHeight:1, padding:0 }}>×</button>
        </div>

        {/* Nav items */}
        <div style={{ flex:1, overflowY:"auto", padding:"10px 0" }}>
          <p style={{ margin:"0 0 4px", padding:"0 16px", fontFamily:T.sans, fontSize:10, fontWeight:700, color:T.muted, textTransform:"uppercase", letterSpacing:.8 }}>Main Menu</p>
          {NAV.map(n=>{
            const active = tab===n.id;
            return (
              <button key={n.id} onClick={()=>{ setTab(n.id); onClose(); }} style={{ display:"flex", alignItems:"center", gap:11, padding:"10px 20px", margin:"1px 8px", borderRadius:7, background:active?T.accentLt:"transparent", border:"none", color:active?T.accent:T.subtext, cursor:"pointer", fontFamily:T.sans, fontSize:14, fontWeight:active?600:400, textAlign:"left", width:"calc(100% - 16px)", transition:"background .12s" }}>
                <span style={{ fontSize:16 }}>{n.icon}</span> {n.label}
              </button>
            );
          })}

          <p style={{ margin:"14px 0 4px", padding:"0 16px", fontFamily:T.sans, fontSize:10, fontWeight:700, color:T.muted, textTransform:"uppercase", letterSpacing:.8 }}>Reports</p>
          {NAV_REPORTS.map(n=>{
            const active = tab===n.id;
            return (
              <button key={n.id} onClick={()=>{ setTab(n.id); onClose(); }} style={{ display:"flex", alignItems:"center", gap:11, padding:"10px 20px", margin:"1px 8px", borderRadius:7, background:active?T.accentLt:"transparent", border:"none", color:active?T.accent:T.subtext, cursor:"pointer", fontFamily:T.sans, fontSize:14, fontWeight:active?600:400, textAlign:"left", width:"calc(100% - 16px)", transition:"background .12s" }}>
                <span style={{ fontSize:16 }}>{n.icon}</span> {n.label}
              </button>
            );
          })}
        </div>

        {/* Footer — user info */}
        <div style={{ padding:"12px 20px", borderTop:`1px solid ${T.border}` }}>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <div style={{ width:32, height:32, borderRadius:"50%", background:T.accent, display:"flex", alignItems:"center", justifyContent:"center", fontFamily:T.mono, fontSize:12, color:"#fff", fontWeight:700, overflow:"hidden" }}>
              {profile?.photo ? <img src={profile.photo} alt="me" style={{ width:"100%", height:"100%", objectFit:"cover" }} /> : (profile?.firstName?`${profile.firstName[0]}${profile.lastName?.[0]||""}`.toUpperCase():"JM")}
            </div>
            <div>
              <div style={{ fontFamily:T.sans, fontSize:13, fontWeight:600, color:T.text }}>{profile?.firstName?`${profile.firstName} ${profile.lastName||""}`.trim():"J. Martinez"}</div>
              <div style={{ fontFamily:T.sans, fontSize:11, color:T.muted }}>{profile?.position||"Mechanic"}</div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}


/* DASHBOARD */

function Dashboard({ state, dispatch, setTab }) {
  const { workOrders:wos=[], equipment:eqs=[], preventiveMaintenance:pms=[], parts=[] } = state;
  const settings = state.settings || {};
  const today_s = today();
  const monthKey = today_s.slice(0,7);
  const openWOs = wos.filter(w=>w.status==="Open").length;
  const inProgWOs = wos.filter(w=>w.status==="In Progress").length;
  const awaitParts = wos.filter(w=>w.status==="Awaiting Parts").length;
  const activeWOs = wos.filter(w=>w.status!=="Completed").length;
  const highPriority = wos.filter(w=>w.status!=="Completed" && w.priority==="High").length;
  const completedMo = wos.filter(w=>w.status==="Completed" && (w.completed||"").slice(0,7)===monthKey).length;
  const outOfSvc = eqs.filter(e=>e.status==="Out of Service / Deadline").length;
  const withDefic = eqs.filter(e=>e.status==="Operational with Deficiencies").length;
  const pmOverdue = pms.filter(p=>p.status==="Overdue").length;
  const pmDueSoon = pms.filter(p=>p.status==="Due Soon").length;
  const lowStock = parts.filter(p=>p.lowStockAlert!==false && (+p.qty||0)<=(+p.minQty||0)).length;
  const totalCost = w => (+w.laborCost||0)+(+(w.partsUsed||[]).reduce((s,p)=>s+(+(p.qty||1))*(+(p.unitCost||0)),0))+(+w.partsCost||0);
  const spendMo = wos.filter(w=>w.status==="Completed" && (w.completed||"").slice(0,7)===monthKey).reduce((s,w)=>s+totalCost(w),0);
  const activeWOCost = wos.filter(w=>w.status!=="Completed").reduce((s,w)=>s+totalCost(w),0);
  const urgentWOs = wos.filter(w=>w.status!=="Completed").sort((a,b)=>({High:0,Medium:1,Low:2}[a.priority]??3)-({High:0,Medium:1,Low:2}[b.priority]??3)).slice(0,7);
  const servicesDue = pms.filter(p=>p.status==="Overdue"||p.status==="Due Soon").map(pm=>({...pm, eqName:eqs.find(e=>e.id===pm.equipment)?.name||pm.equipment})).sort((a,b)=>(a.nextDue||"").localeCompare(b.nextDue||"")).slice(0,7);
  const deadlineEqs = eqs.filter(e=>e.status==="Out of Service / Deadline"||e.status==="Operational with Deficiencies").slice(0,7);
  const criticalParts = parts.filter(p=>p.lowStockAlert!==false && (+p.qty||0)<=(+p.minQty||0)).slice(0,7);

  const [customize, setCustomize] = useState(false);
  const defaultLayout = ["command","actions","workorders","pm","equipment","parts","planner","spending"];
  const layout = (settings.dashboardLayout?.length ? settings.dashboardLayout : defaultLayout).filter(id=>defaultLayout.includes(id));
  const fullLayout = [...layout, ...defaultLayout.filter(id=>!layout.includes(id))];
  const hidden = settings.dashboardHidden || [];
  const sizes = settings.dashboardWidgetSizes || {};
  const density = settings.dashboardDensity || "comfortable";
  const theme = settings.dashboardTheme || "mission";
  const saveDash = patch => dispatch({ type:"UPDATE_SETTINGS", payload:{ ...settings, ...patch } });
  const compact = density==="compact";
  const comfyPad = compact ? "12px" : "18px";

  const lockIfEditing = e => {
    if(!customize) return;
    if(e.target.closest?.("[data-dash-control]")) return;
    e.preventDefault();
    e.stopPropagation();
  };
  const go = tab => { if(!customize && tab) setTab(tab); };
  const moveWidget = (id, dir) => {
    const arr = [...fullLayout];
    const i = arr.indexOf(id), j = i + dir;
    if(i<0 || j<0 || j>=arr.length) return;
    [arr[i], arr[j]] = [arr[j], arr[i]];
    saveDash({ dashboardLayout:arr });
  };
  const setWidgetSize = (id, size) => saveDash({ dashboardWidgetSizes:{ ...sizes, [id]:size } });
  const toggleWidget = id => saveDash({ dashboardHidden:hidden.includes(id) ? hidden.filter(x=>x!==id) : [...hidden, id] });
  const resetDash = () => saveDash({ dashboardLayout:defaultLayout, dashboardHidden:[], dashboardWidgetSizes:{}, dashboardDensity:"comfortable", dashboardTheme:"mission" });
  const applyPreset = preset => {
    const presets = {
      mission:{ dashboardTheme:"mission", dashboardDensity:"comfortable", dashboardLayout:["command","actions","workorders","pm","equipment","parts","planner","spending"], dashboardHidden:[], dashboardWidgetSizes:{ command:"hero", actions:"wide", workorders:"large", pm:"large", equipment:"large", parts:"medium", planner:"wide", spending:"medium" } },
      mechanic:{ dashboardTheme:"shop", dashboardDensity:"comfortable", dashboardLayout:["actions","planner","workorders","pm","equipment","parts","command","spending"], dashboardHidden:["spending"], dashboardWidgetSizes:{ actions:"wide", planner:"hero", workorders:"large", pm:"large", equipment:"medium", parts:"medium", command:"wide" } },
      manager:{ dashboardTheme:"executive", dashboardDensity:"compact", dashboardLayout:["command","spending","workorders","pm","equipment","parts","planner","actions"], dashboardHidden:[], dashboardWidgetSizes:{ command:"wide", spending:"large", workorders:"medium", pm:"medium", equipment:"medium", parts:"medium", planner:"large", actions:"medium" } },
      simple:{ dashboardTheme:"clean", dashboardDensity:"comfortable", dashboardLayout:["actions","workorders","pm","equipment","parts","planner","command","spending"], dashboardHidden:[], dashboardWidgetSizes:{ actions:"wide", workorders:"wide", pm:"wide", equipment:"wide", parts:"wide", planner:"wide", command:"wide", spending:"wide" } }
    };
    saveDash(presets[preset] || presets.mission);
  };

  const sizeStyle = id => {
    const size = sizes[id] || (id==="command"?"hero":id==="actions"?"wide":"large");
    if(size==="small") return { gridColumn:"span 1", minHeight:140 };
    if(size==="medium") return { gridColumn:"span 2", minHeight:180 };
    if(size==="large") return { gridColumn:"span 3", minHeight:220 };
    if(size==="wide") return { gridColumn:"span 6", minHeight:190 };
    return { gridColumn:"1 / -1", minHeight:250 };
  };
  const cardBg = theme==="executive" ? "#fbfcff" : theme==="shop" ? "#fffaf0" : theme==="clean" ? "#ffffff" : "linear-gradient(180deg,#ffffff 0%,#fbfdff 100%)";
  const pageBg = theme==="shop" ? "linear-gradient(135deg,#fff7ed,#f8fafc)" : theme==="executive" ? "linear-gradient(135deg,#f8fafc,#eef2ff)" : theme==="clean" ? T.bg : "linear-gradient(135deg,#eef6ff,#f8fafc 45%,#fff7ed)";

  const Metric = ({label,value,color=T.accent,sub}) => <div style={{ background:"rgba(255,255,255,.74)", border:`1px solid ${T.border}`, borderRadius:14, padding:compact?10:14 }}>
    <div style={{ fontSize:11, color:T.muted, fontWeight:800, textTransform:"uppercase", letterSpacing:.45 }}>{label}</div>
    <div style={{ fontFamily:T.mono, fontSize:compact?22:30, color, fontWeight:900, marginTop:4 }}>{value}</div>
    {sub && <div style={{ fontSize:11, color:T.subtext }}>{sub}</div>}
  </div>;
  const Pill = ({children,color=T.accent}) => <span style={{ display:"inline-flex", alignItems:"center", gap:6, border:`1px solid ${color}33`, color, background:`${color}12`, borderRadius:999, padding:"5px 9px", fontSize:11, fontWeight:800 }}>{children}</span>;
  const Row = ({title,sub,badge,badgeColor=T.accent,onClick}) => <div onClick={customize?undefined:onClick} style={{ display:"grid", gridTemplateColumns:"1fr auto", gap:10, alignItems:"center", padding:compact?"8px 0":"10px 0", borderBottom:`1px solid ${T.border}`, cursor:customize||!onClick?"default":"pointer" }}>
    <div><div style={{ fontSize:13, fontWeight:800, color:T.text }}>{title}</div>{sub && <div style={{ fontSize:11, color:T.muted, marginTop:2 }}>{sub}</div>}</div>
    {badge && <Pill color={badgeColor}>{badge}</Pill>}
  </div>;

  const Widget = ({id,title,tab,children,accent=T.accent,subtitle}) => <section
    key={id}
    onClickCapture={lockIfEditing}
    onMouseDownCapture={lockIfEditing}
    style={{ ...sizeStyle(id), background:cardBg, border:`1px solid ${customize?accent:T.border}`, borderRadius:20, padding:comfyPad, boxShadow:customize?`0 0 0 3px ${accent}18, ${T.shadowMd}`:T.shadow, position:"relative", overflow:"hidden" }}>
    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:12, marginBottom:12 }}>
      <div>
        <div style={{ display:"flex", gap:8, alignItems:"center" }}><span style={{ width:10, height:10, borderRadius:999, background:accent, display:"inline-block" }}/><h3 style={{ margin:0, fontSize:compact?14:16, color:T.text }}>{title}</h3></div>
        {subtitle && <div style={{ fontSize:11, color:T.muted, marginTop:4 }}>{subtitle}</div>}
      </div>
      {customize ? <div data-dash-control="true" style={{ display:"flex", gap:6, alignItems:"center", flexWrap:"wrap", justifyContent:"flex-end" }}>
        <Btn small variant="secondary" onClick={()=>moveWidget(id,-1)}>Move left</Btn>
        <Btn small variant="secondary" onClick={()=>moveWidget(id,1)}>Move right</Btn>
        <select value={sizes[id] || (id==="command"?"hero":id==="actions"?"wide":"large")} onChange={e=>setWidgetSize(id,e.target.value)} style={{ height:28, border:`1px solid ${T.border}`, borderRadius:8, padding:"0 8px", fontSize:11, fontWeight:700, background:"#fff" }}>
          <option value="small">Small</option><option value="medium">Medium</option><option value="large">Large</option><option value="wide">Wide</option><option value="hero">Full Width</option>
        </select>
        <Btn small variant="danger" onClick={()=>toggleWidget(id)}>Hide</Btn>
      </div> : tab ? <Btn small variant="secondary" onClick={()=>go(tab)}>Open</Btn> : null}
    </div>
    <div style={{ pointerEvents:customize?"none":"auto" }}>{children}</div>
  </section>;

  const widgets = {
    command:<Widget id="command" title="Maintenance Command Center" subtitle="One glance status of the whole shop" accent={highPriority||pmOverdue||outOfSvc?T.red:T.green}>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))", gap:10 }}>
        <Metric label="Active work" value={activeWOs} color={activeWOs?T.accent:T.green} sub={`${completedMo} completed this month`} />
        <Metric label="High priority" value={highPriority} color={highPriority?T.red:T.green} sub="needs attention" />
        <Metric label="PM due" value={pmOverdue+pmDueSoon} color={pmOverdue?T.red:T.amber} sub={`${pmOverdue} overdue`} />
        <Metric label="Asset issues" value={outOfSvc+withDefic} color={outOfSvc?T.red:T.amber} sub={`${outOfSvc} deadline`} />
        <Metric label="Low stock" value={lowStock} color={lowStock?T.amber:T.green} sub="parts to review" />
      </div>
      <div style={{ marginTop:14, padding:12, borderRadius:14, background:(highPriority||pmOverdue||outOfSvc)?T.redLt:T.greenLt, border:`1px solid ${(highPriority||pmOverdue||outOfSvc)?"#fecaca":"#bbf7d0"}`, fontSize:13, fontWeight:800, color:(highPriority||pmOverdue||outOfSvc)?T.red:T.green }}>
        {(highPriority||pmOverdue||outOfSvc) ? "Focus today: clear high-priority work, overdue PM, and deadline equipment first." : "Shop status looks stable. Keep preventive maintenance moving and update records."}
      </div>
    </Widget>,
    actions:<Widget id="actions" title="Quick Launch" subtitle="Fast access without hunting through menus" accent="#7c3aed">
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))", gap:10 }}>
        {[ ["➕ Work Order","workorders","Create / review jobs"], ["🛡 PM Board","pm","Service schedule"], ["🚜 Equipment","equipment","Assets and records"], ["📦 Parts","parts","Inventory status"], ["📊 Reports","reports","PDF / Excel outputs"], ["⚙ Settings","settings","Locations and setup"] ].map(([label,tab,sub])=><button key={tab} onClick={()=>go(tab)} disabled={customize} style={{ border:`1px solid ${T.border}`, background:"#fff", borderRadius:16, padding:14, textAlign:"left", cursor:customize?"default":"pointer", boxShadow:T.shadow }}>
          <div style={{ fontSize:15, fontWeight:900, color:T.text }}>{label}</div><div style={{ fontSize:11, color:T.muted, marginTop:4 }}>{sub}</div>
        </button>)}
      </div>
    </Widget>,
    workorders:<Widget id="workorders" title="Work Order Flow" tab="workorders" subtitle="Open, active, waiting, and completed work" accent={highPriority?T.red:T.accent}>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:8, marginBottom:10 }}>
        <Metric label="Open" value={openWOs} /><Metric label="In progress" value={inProgWOs} color={T.amber}/><Metric label="Parts" value={awaitParts} color="#7c3aed"/><Metric label="Done/mo" value={completedMo} color={T.green}/>
      </div>
      {urgentWOs.length ? urgentWOs.map(w=><Row key={w.id} title={`${w.id} — ${w.title||"Work Order"}`} sub={`${w.equipmentLabel||w.equipment||"No equipment"} • ${w.status}`} badge={w.priority||"Priority"} badgeColor={w.priority==="High"?T.red:w.priority==="Medium"?T.amber:T.green} onClick={()=>go("workorders")}/>) : <div style={{ color:T.muted, fontSize:13 }}>No active work orders.</div>}
    </Widget>,
    pm:<Widget id="pm" title="Preventive Maintenance Lane" tab="pm" subtitle="What is overdue or coming due soon" accent={pmOverdue?T.red:T.amber}>
      <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginBottom:8 }}><Pill color={T.red}>{pmOverdue} overdue</Pill><Pill color={T.amber}>{pmDueSoon} due soon</Pill></div>
      {servicesDue.length ? servicesDue.map(p=><Row key={p.id} title={p.eqName||"Equipment"} sub={`${p.service||p.title||"PM"} • Due ${p.nextDue||"—"}`} badge={p.status} badgeColor={p.status==="Overdue"?T.red:T.amber} onClick={()=>go("pm")}/>) : <div style={{ color:T.muted, fontSize:13 }}>No PM items due soon.</div>}
    </Widget>,
    equipment:<Widget id="equipment" title="Asset Health" tab="equipment" subtitle="Deadline equipment and deficiencies" accent={outOfSvc?T.red:T.green}>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:8, marginBottom:10 }}><Metric label="Total" value={eqs.length} /><Metric label="Deadline" value={outOfSvc} color={outOfSvc?T.red:T.green}/><Metric label="Deficient" value={withDefic} color={withDefic?T.amber:T.green}/></div>
      {deadlineEqs.length ? deadlineEqs.map(e=><Row key={e.id} title={`${e.id} — ${e.name}`} sub={`${e.make||""} ${e.model||""} • ${e.location||"No location"}`} badge={e.status?.replace("Out of Service / ","")} badgeColor={e.status==="Out of Service / Deadline"?T.red:T.amber} onClick={()=>go("equipment")}/>) : <div style={{ color:T.muted, fontSize:13 }}>All equipment is clear of deadline/deficiency status.</div>}
    </Widget>,
    parts:<Widget id="parts" title="Parts & Inventory Watch" tab="parts" subtitle="Low stock items that can delay repairs" accent={lowStock?T.amber:T.green}>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(2,1fr)", gap:8, marginBottom:10 }}><Metric label="Parts tracked" value={parts.length}/><Metric label="Low stock" value={lowStock} color={lowStock?T.amber:T.green}/></div>
      {criticalParts.length ? criticalParts.map(p=><Row key={p.id} title={p.name||p.partNumber||"Part"} sub={`${p.partNumber||"No part #"} • Qty ${p.qty??0} / Min ${p.minQty??0}`} badge="Reorder" badgeColor={T.amber} onClick={()=>go("parts")}/>) : <div style={{ color:T.muted, fontSize:13 }}>No low stock alerts.</div>}
    </Widget>,
    planner:<Widget id="planner" title="Today’s Battle Rhythm" subtitle="Recommended order of work" accent="#0f766e">
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))", gap:10 }}>
        <div style={{ border:`1px solid ${T.border}`, borderRadius:16, padding:14, background:"#fff" }}><div style={{ fontWeight:900 }}>1. Safety / Deadline</div><div style={{ color:T.muted, fontSize:12, marginTop:4 }}>Check {outOfSvc} deadline assets and {highPriority} high priority WOs.</div></div>
        <div style={{ border:`1px solid ${T.border}`, borderRadius:16, padding:14, background:"#fff" }}><div style={{ fontWeight:900 }}>2. PM Due</div><div style={{ color:T.muted, fontSize:12, marginTop:4 }}>Complete overdue service before it turns into repairs.</div></div>
        <div style={{ border:`1px solid ${T.border}`, borderRadius:16, padding:14, background:"#fff" }}><div style={{ fontWeight:900 }}>3. Parts Blockers</div><div style={{ color:T.muted, fontSize:12, marginTop:4 }}>Review {awaitParts} awaiting-parts work orders and {lowStock} low stock items.</div></div>
        <div style={{ border:`1px solid ${T.border}`, borderRadius:16, padding:14, background:"#fff" }}><div style={{ fontWeight:900 }}>4. Documentation</div><div style={{ color:T.muted, fontSize:12, marginTop:4 }}>Close completed WOs and update equipment records.</div></div>
      </div>
    </Widget>,
    spending:<Widget id="spending" title="Cost Snapshot" tab="reports" subtitle="Maintenance cost awareness" accent="#2563eb">
      <div style={{ display:"grid", gridTemplateColumns:"repeat(2,1fr)", gap:10 }}><Metric label="Month spend" value={`$${spendMo.toFixed(2)}`} color="#2563eb"/><Metric label="Active estimate" value={`$${activeWOCost.toFixed(2)}`} color={T.amber}/></div>
      <div style={{ marginTop:12, fontSize:12, color:T.muted }}>Use Reports for printable PDF and Excel/CSV exports.</div>
    </Widget>
  };

  return <div style={{ display:"flex", flexDirection:"column", gap:14, background:pageBg, margin:-4, padding:customize?14:4, borderRadius:22 }}>
    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", gap:12, flexWrap:"wrap" }}>
      <div><h2 style={{ margin:"0 0 4px", fontSize:28, letterSpacing:-.6 }}>Dashboard</h2><div style={{ color:T.muted, fontSize:13 }}>Your maintenance home base: find work, act fast, and see what needs attention.</div></div>
      <div data-dash-control="true" style={{ display:"flex", gap:8, alignItems:"center", flexWrap:"wrap" }}>
        <select value={theme} onChange={e=>saveDash({ dashboardTheme:e.target.value })} style={{ height:36, border:`1px solid ${T.border}`, borderRadius:10, padding:"0 10px", background:"#fff", fontWeight:800 }}>
          <option value="mission">Mission Control</option><option value="shop">Shop Board</option><option value="executive">Manager Console</option><option value="clean">Clean Simple</option>
        </select>
        <select value={density} onChange={e=>saveDash({ dashboardDensity:e.target.value })} style={{ height:36, border:`1px solid ${T.border}`, borderRadius:10, padding:"0 10px", background:"#fff", fontWeight:800 }}>
          <option value="comfortable">Comfortable</option><option value="compact">Compact</option>
        </select>
        <Btn onClick={()=>setCustomize(v=>!v)}>{customize?"Done Customizing":"Customize Dashboard"}</Btn>
      </div>
    </div>

    {customize && <Card style={{ padding:16, border:`2px dashed ${T.accent}`, background:"#fff" }}>
      <div style={{ fontSize:16, fontWeight:900, marginBottom:4 }}>Dashboard edit mode</div>
      <div style={{ fontSize:12, color:T.muted, marginBottom:12 }}>Cards are locked while editing. Use presets, size controls, move buttons, and show/hide options. The dashboard is now built around action, not decoration.</div>
      <div data-dash-control="true" style={{ display:"flex", flexWrap:"wrap", gap:8, marginBottom:12 }}>
        <Btn small onClick={()=>applyPreset("mission")}>Mission Control</Btn>
        <Btn small variant="secondary" onClick={()=>applyPreset("mechanic")}>Mechanic Daily Board</Btn>
        <Btn small variant="secondary" onClick={()=>applyPreset("manager")}>Manager Console</Btn>
        <Btn small variant="secondary" onClick={()=>applyPreset("simple")}>Clean Simple</Btn>
        <Btn small variant="danger" onClick={resetDash}>Reset</Btn>
      </div>
      <div data-dash-control="true" style={{ display:"flex", flexWrap:"wrap", gap:8 }}>{fullLayout.map(id=><Btn key={id} small variant={hidden.includes(id)?"secondary":"primary"} onClick={()=>toggleWidget(id)}>{hidden.includes(id)?"Show":"Hide"} {id}</Btn>)}</div>
    </Card>}

    <div style={{ display:"grid", gridTemplateColumns:"repeat(6,minmax(120px,1fr))", gap:12, alignItems:"stretch" }}>
      {fullLayout.filter(id=>!hidden.includes(id)).map(id=>widgets[id])}
    </div>
  </div>;
}

function WorkOrders({ state, dispatch, woSettings, onWOSettings }) {
  const [modal, setModal]     = useState(null); // null|"type"|"pick"|"form"|"detail"|"edit"
  const [form, setForm]       = useState({});
  const [filter, setFilter]     = useState("Active"); // "Active" = Open+InProgress default
  const [typeFilter, setTypeFilter] = useState("All");
  const [sortBy, setSortBy]         = useState("created");
  const [sortDir, setSortDir]       = useState("desc");
  const [priorityFilter, setPriorityFilter] = useState("All");
  const [mechFilter, setMechFilter] = useState("All");
  const [completedDateFilter, setCompletedDateFilter] = useState("all");
  const [eqSearch, setEqSearch] = useState("");
  const [showNewTech, setShowNewTech] = useState(false);
  const [newTech, setNewTech] = useState({ name:"", position:"", laborRate:"" });
  const [showNewPart, setShowNewPart] = useState(null); // index of part row adding new part
  const [newPartForm, setNewPartForm] = useState({});
  const [detailWO, setDetailWO] = useState(null);
  const [editMode, setEditMode] = useState(false);

  const WO_TYPES = [
    { id:"Service",    label:"Service Work Order",    icon:"🔧", desc:"Scheduled maintenance and service tasks", color:"#1e40af", bg:"#eff6ff" },
    { id:"Inspection", label:"Inspection Work Order", icon:"🔍", desc:"Safety checks and equipment inspections",  color:"#065f46", bg:"#ecfdf5" },
    { id:"Repair",     label:"Repair Work Order",     icon:"🛠", desc:"Fault repairs and breakdown response",     color:"#7f1d1d", bg:"#fef2f2" },
  ];

  /* Intervals shown for Service and Inspection types */
  const SERVICE_INTERVALS   = ["New Equipment Service","Weekly","Bi-Weekly","Monthly","Bi-Monthly","Quarterly","Bi-Annual","Annual"];
  const INSPECT_INTERVALS   = ["New Equipment Inspection","Weekly","Bi-Weekly","Monthly","Bi-Monthly","Quarterly","Bi-Annual","Annual"];
  const getIntervals = (woType) => woType==="Inspection" ? INSPECT_INTERVALS : SERVICE_INTERVALS;

  const STATUS_TABS = ["Active","Open","In Progress","Awaiting Parts","On Hold","Completed","All"];
  const PRIO_ORDER  = {"High":0,"Medium":1,"Low":2};

  /* Date range filter for completed WOs */
  const matchCompletedDate = (w) => {
    if(filter!=="Completed" || completedDateFilter==="all") return true;
    if(!w.completed) return false;
    const d = new Date(w.completed);
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek  = new Date(startOfToday); startOfWeek.setDate(startOfToday.getDate() - startOfToday.getDay());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastWeekStart = new Date(startOfWeek); lastWeekStart.setDate(startOfWeek.getDate()-7);
    const lastMonthStart= new Date(now.getFullYear(), now.getMonth()-1, 1);
    const lastMonthEnd  = new Date(now.getFullYear(), now.getMonth(), 0, 23,59,59);
    if(completedDateFilter==="today")     return d >= startOfToday;
    if(completedDateFilter==="thisweek")  return d >= startOfWeek;
    if(completedDateFilter==="thismonth") return d >= startOfMonth;
    if(completedDateFilter==="lastweek")  return d >= lastWeekStart && d < startOfWeek;
    if(completedDateFilter==="lastmonth") return d >= lastMonthStart && d <= lastMonthEnd;
    return true;
  };

  const filtered = state.workOrders.filter(w=>{
    const matchStatus   = filter==="Active"?(w.status!=="Completed"):filter==="All"?true:w.status===filter;
    const matchType     = typeFilter==="All"     || w.woType===typeFilter;
    const matchPriority = priorityFilter==="All" || w.priority===priorityFilter;
    const matchMech     = mechFilter==="All"     || w.tech===mechFilter;
    return matchStatus && matchType && matchPriority && matchMech && matchCompletedDate(w);
  }).sort((a,b)=>{
    let cmp = 0;
    if(sortBy==="priority") cmp = (PRIO_ORDER[a.priority]??9)-(PRIO_ORDER[b.priority]??9);
    else if(sortBy==="due")     cmp = (a.due||"").localeCompare(b.due||"");
    else if(sortBy==="created") cmp = (a.created||"").localeCompare(b.created||"");
    else if(sortBy==="status")  cmp = (a.status||"").localeCompare(b.status||"");
    else if(sortBy==="cost")    cmp = ((+a.laborCost||0)+(+a.partsCost||0))-((+b.laborCost||0)+(+b.partsCost||0));
    return sortDir==="asc" ? cmp : -cmp;
  });
  const allMechanics = [...new Set(state.workOrders.map(w=>w.tech).filter(Boolean))];
  const technicians = state.technicians || [];

  /* Smart WO ID: EQ-001-01 */
  const genWOId = (eqId) => {
    const id = eqId || "GEN";
    const existing = state.workOrders.filter(w=>w.id.startsWith(id+"-"));
    const nums = existing.map(w=>parseInt(w.id.slice(id.length+1),10)||0);
    return `${id}-${String(nums.length>0?Math.max(...nums)+1:1).padStart(2,"0")}`;
  };

  const buildTitle = (woType, interval) => {
    if (!woType) return "";
    if ((woType==="Service"||woType==="Inspection") && interval) return `${interval} ${woType}`;
    return woType;
  };

  /* Equipment picker list */
  const allPickable = [
    ...state.equipment.map(eq=>({ id:eq.id, label:eq.name, sub:`${eq.id} | ${eq.make||""} ${eq.model||""} | Serial: ${eq.serial||"—"} | EIL: ${eq.eilNumber||"—"}`, type:"Equipment", typeColor:"#1e40af", typeBg:"#eff6ff", parentName:null, parentId:null })),
    ...state.equipment.flatMap(eq=>(eq.attachments||[]).map(at=>({ id:at.id, label:at.name, sub:`${at.id} | ${at.make||""} ${at.model||""} | Serial: ${at.serial||"—"} | EIL: ${at.eilNumber||"—"} | on: ${eq.name} (${eq.id})`, type:"Attachment", typeColor:"#065f46", typeBg:"#ecfdf5", parentName:eq.name, parentId:eq.id }))),
  ];
  const filteredPickable = allPickable.filter(i=>`${i.label} ${i.sub}`.toLowerCase().includes(eqSearch.toLowerCase()));

  const openAdd = () => {
    setEqSearch("");
    setForm({ status:"Open", priority:"Medium", created:today(), due:today(), tech:"", techId:"", laborHours:0, laborCost:0, partsCost:0, partsUsed:[], mechanicNotes:"" });
    setModal("pick"); /* Go straight to equipment — type chosen in the form */
  };

  const pickType = (typeId) => { setForm(f=>({...f, woType:typeId, title:buildTitle(typeId,"")})); setModal("pick"); };
  const pickEquipment = (item) => { setForm(f=>({...f, equipment:item.id, equipmentLabel:item.label, equipmentSub:item.sub, equipmentType:item.type, parentName:item.parentName||null, parentId:item.parentId||null})); setModal("form"); };

  /* Click row to open detail */
  const openDetail = (wo) => { setDetailWO(wo); setForm({...wo, partsUsed:wo.partsUsed||[]}); setEditMode(false); setModal("detail"); };
  const openEdit   = (wo) => { setForm({...wo, partsUsed:wo.partsUsed||[]}); setModal("edit"); };

  /* Mechanic selection - auto-calc labor cost */
  const selectTech = (techId) => {
    const tech = technicians.find(t=>t.id===techId);
    setForm(f=>({
      ...f,
      techId,
      tech: tech?.name||"",
      laborCost: tech && f.laborHours ? +(f.laborHours)*(+(tech.laborRate||0)) : f.laborCost,
    }));
  };

  const addNewTech = () => {
    if(!newTech.name) return alert("Name required.");
    const payload = { ...newTech, id:`TECH-${Date.now()}`, laborRate:+newTech.laborRate||0 };
    dispatch({ type:"ADD_TECH", payload });
    setForm(f=>({ ...f, techId:payload.id, tech:payload.name, laborCost: f.laborHours?(+f.laborHours)*(+(payload.laborRate||0)):f.laborCost }));
    setNewTech({ name:"", position:"", laborRate:"" });
    setShowNewTech(false);
  };

  /* Parts: pick from inventory or add new */
  const addPartFromInventory = (invPart, rowIdx) => {
    setForm(f=>{
      const arr = [...(f.partsUsed||[])];
      arr[rowIdx] = { name:invPart.name, qty:1, unitCost:invPart.unitCost, partId:invPart.id };
      return {...f, partsUsed:arr};
    });
  };

  const addNewPartToInventory = (rowIdx) => {
    if(!newPartForm.name) return alert("Part name required.");
    const newPart = { ...newPartForm, id:genId("PT"), qty:+(newPartForm.qty||0), unitCost:+(newPartForm.unitCost||0), minQty:+(newPartForm.minQty||1) };
    dispatch({ type:"ADD_PART", payload:newPart });
    setForm(f=>{ const arr=[...(f.partsUsed||[])]; arr[rowIdx]={name:newPart.name,qty:1,unitCost:newPart.unitCost,partId:newPart.id}; return {...f,partsUsed:arr}; });
    setNewPartForm({});
    setShowNewPart(null);
  };

  const save = (isEdit) => {
    if(!form.title)     return alert("Title required.");
    if(!form.equipment) return alert("Equipment required.");
    const prevWO = isEdit ? state.workOrders.find(w=>w.id===form.id) : null;

    /* Figure out inventory consumption delta */
    const prevParts = (prevWO?.partsUsed||[]);
    const newParts  = (form.partsUsed||[]);
    const consumeDeltas = [];
    newParts.forEach(np=>{
      if(!np.partId) return;
      const prev = prevParts.find(p=>p.partId===np.partId);
      const delta = (+(np.qty||0)) - (+(prev?.qty||0));
      if(delta>0) consumeDeltas.push({partId:np.partId, qty:delta});
    });
    if(consumeDeltas.length>0) dispatch({type:"CONSUME_PARTS", payload:consumeDeltas});

    const partsTotal = newParts.reduce((s,p)=>s+(+(p.qty||1))*(+(p.unitCost||0)),0);
    if(isEdit) {
      dispatch({type:"UPDATE_WO", payload:{...form, partsCost:partsTotal}});
    } else {
      dispatch({type:"ADD_WO", payload:{...form, id:genWOId(form.equipment), partsCost:partsTotal}});
    }
    setModal(null);
    setDetailWO(null);
  };

  const del = id => { if(confirm("Delete this work order?")){ dispatch({type:"DELETE_WO",payload:id}); setModal(null); setDetailWO(null); }};

  /* ---- Print Work Order ---- */
  const printWO = (wo) => {
    const ws = woSettings || {};
    const gs = state.settings || {};
    const eq = state.equipment.find(e=>e.id===wo.equipment);
    /* Pull company info from WO settings first, then global settings */
    const companyName = ws.companyName || gs.companyName || "Maintenance Department";
    const companyLogo = ws.logo || gs.logo || "";
    const companyDept = ws.department || gs.department || "";
    const companyPhone = ws.phone || gs.phone || "";
    const companyEmail = ws.email || gs.email || "";
    const companyAddr  = `${gs.address||""} ${gs.cityState||""}`.trim();
    const woTypeLabel = wo.woType ? `${wo.woType} Work Order` : (ws.headerText || "MAINTENANCE WORK ORDER");
    const partsUsed  = wo.partsUsed || [];
    const partsTotal = partsUsed.reduce((s,p)=>s+(+(p.qty||1))*(+(p.unitCost||0)),0);
    const laborTotal = +(wo.laborCost||0);
    const grandTotal = laborTotal + partsTotal + (+(wo.partsCost||0));
    const woRows = [{"WO #":wo.id, Title:wo.title||"", Status:wo.status||"", Priority:wo.priority||"", Equipment:eq?`${eq.name} (${eq.id})`:wo.equipment||"", Mechanic:wo.tech||"", Created:wo.created||"", Due:wo.due||"", Completed:wo.completed||"", Labor:laborTotal.toFixed(2), Parts:partsTotal.toFixed(2), Total:grandTotal.toFixed(2), Problem:wo.problem||wo.description||"", Notes:wo.mechanicNotes||""}];
    const woCsv = rowsToDataUri(woRows);

    const win = window.open("","_blank","width=900,height=700");
    if(!win){ alert("Please allow pop-ups to print work orders."); return; }

    win.document.write(`<!DOCTYPE html><html><head><title>Work Order ${wo.id}</title><style>
      *{box-sizing:border-box;margin:0;padding:0}
      body{font-family:Arial,sans-serif;background:#fff;color:#111;font-size:11px;line-height:1.3}
      .page{width:8.5in;min-height:11in;margin:0 auto;padding:.35in .45in;display:flex;flex-direction:column;gap:6px}
      .hdr{display:flex;align-items:stretch;border:2px solid #1a1a2e;border-radius:3px;overflow:hidden}
      .hdr-logo{width:130px;min-width:130px;background:#fff;display:flex;align-items:center;justify-content:center;padding:6px 10px;border-right:2px solid #1a1a2e}
      .hdr-logo img{max-width:110px;max-height:55px;object-fit:contain}
      .hdr-logo-text{font-size:11px;font-weight:700;color:#1a1a2e;text-align:center;line-height:1.3}
      .hdr-center{flex:1;background:#1a1a2e;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:6px}
      .hdr-company{font-size:14px;font-weight:700;color:#fff;letter-spacing:1px;text-transform:uppercase}
      .hdr-type{font-size:9px;color:#94a3b8;letter-spacing:2px;text-transform:uppercase;margin-top:2px}
      .hdr-right{width:155px;min-width:155px;background:#f0f4ff;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:6px;border-left:2px solid #1a1a2e;text-align:center}
      .hdr-wol{font-size:8px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#666}
      .hdr-won{font-size:18px;font-weight:700;color:#1a1a2e;font-family:monospace;letter-spacing:1px}
      .hdr-status{margin-top:3px;display:inline-block;padding:2px 8px;border-radius:3px;font-size:9px;font-weight:700;letter-spacing:.5px;text-transform:uppercase}
      .st-open{background:#dbeafe;color:#1e3a8a}.st-in{background:#fef9c3;color:#713f12}
      .st-completed{background:#dcfce7;color:#14532d}.st-on{background:#fee2e2;color:#7f1d1d}
      .row{display:grid;border:1.5px solid #1a1a2e;border-radius:3px;overflow:hidden}
      .row.c3{grid-template-columns:1fr 1fr 1fr}.row.c2{grid-template-columns:2fr 1fr}.row.c22{grid-template-columns:1fr 1fr}
      .cell{padding:4px 8px;border-right:1px solid #c8d0e0}.cell:last-child{border-right:none}.cell.s2{grid-column:span 2}
      .lbl{font-size:7.5px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;color:#666;margin-bottom:1px}
      .val{font-size:11px;font-weight:600;color:#111;min-height:14px}.val.mn{font-family:monospace}
      .sec{border:1.5px solid #1a1a2e;border-radius:3px;overflow:hidden}
      .sh{background:#1a1a2e;color:#fff;font-size:8px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;padding:3px 8px}
      .sb{padding:7px 8px;font-size:11px;color:#111;line-height:1.5;white-space:pre-wrap;min-height:55px}
      .bg{display:grid;grid-template-columns:1fr 1fr;gap:6px}
      .pt{width:100%;border-collapse:collapse;font-size:10px}
      .pt th{background:#f3f4f6;padding:3px 6px;text-align:left;font-size:8px;text-transform:uppercase;color:#555;font-weight:700}
      .pt td{padding:3px 6px;border-bottom:1px solid #e5e7eb}
      .pt .sub{font-weight:700;background:#f8faff}
      .cs{border-top:2px solid #1a1a2e}
      .cr{display:flex;justify-content:space-between;padding:3px 8px;border-bottom:1px solid #e5e7eb;font-size:10px}
      .ct{display:flex;justify-content:space-between;padding:4px 8px;background:#1a1a2e;color:#fff;font-size:11px;font-weight:700}
      .phi{color:#991b1b;background:#fee2e2;border:1px solid #fca5a5;padding:1px 6px;border-radius:3px;font-size:8px;font-weight:700;text-transform:uppercase}
      .pmd{color:#92400e;background:#fef3c7;border:1px solid #fcd34d;padding:1px 6px;border-radius:3px;font-size:8px;font-weight:700;text-transform:uppercase}
      .plo{color:#374151;background:#f3f4f6;border:1px solid #d1d5db;padding:1px 6px;border-radius:3px;font-size:8px;font-weight:700;text-transform:uppercase}
      .sigs{display:grid;grid-template-columns:2fr 1fr;gap:20px;border:1.5px solid #1a1a2e;border-radius:3px;padding:10px 14px;margin-top:auto}
      .sc{display:flex;flex-direction:column;gap:10px}.sw{display:flex;flex-direction:column;gap:3px}
      .sl{border-bottom:1.5px solid #333;height:24px}
      .slb{font-size:7.5px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;color:#555}
      .ftr{background:#1a1a2e;color:#fff;padding:4px 12px;border-radius:3px;display:flex;justify-content:space-between;font-size:8px}
      .pbtn{margin-top:14px;display:flex;gap:10px;justify-content:center}
      .pbtn button{padding:9px 24px;font-size:13px;font-weight:700;border:none;border-radius:6px;cursor:pointer}
      .bpr{background:#1a1a2e;color:#fff}.bpdf{background:#0052cc;color:#fff}
      @media print{.pbtn{display:none}.page{padding:.3in .4in;gap:5px}body{font-size:10.5px}}
    </style></head><body>
    <div class="page">
      <div class="hdr">
        <div class="hdr-logo">${companyLogo?`<img src="${companyLogo}" alt="logo">`:`<div class="hdr-logo-text">${companyName}</div>`}</div>
        <div class="hdr-center"><div class="hdr-company">${companyName}</div><div class="hdr-type">${woTypeLabel}</div></div>
        <div class="hdr-right"><div class="hdr-wol">Work Order No.</div><div class="hdr-won">${wo.id}</div>
          <div class="hdr-status st-${(wo.status||"open").toLowerCase().slice(0,2)}">${wo.status||"Open"}</div>
        </div>
      </div>
      <div class="row c3">
        <div class="cell"><div class="lbl">Date Created</div><div class="val">${wo.created||"&nbsp;"}</div></div>
        <div class="cell"><div class="lbl">Due Date</div><div class="val">${wo.due||"&nbsp;"}</div></div>
        <div class="cell"><div class="lbl">Date Completed</div><div class="val">${wo.completed||"&nbsp;"}</div></div>
      </div>
      <div class="row c3">
        <div class="cell s2"><div class="lbl">Assigned Mechanic</div><div class="val">${wo.tech||"&nbsp;"}</div></div>
        <div class="cell"><div class="lbl">Priority</div><div class="val"><span class="${wo.priority==="High"?"phi":wo.priority==="Medium"?"pmd":"plo"}">${wo.priority||"Low"}</span></div></div>
      </div>
      ${wo.woType||wo.serviceInterval?`<div class="row c22"><div class="cell"><div class="lbl">Work Order Type</div><div class="val">${wo.woType||"Service"} Work Order</div></div><div class="cell"><div class="lbl">Service Interval</div><div class="val">${wo.serviceInterval||"N/A"}</div></div></div>`:""}
      <div class="sec">
        <div class="sh">Equipment Information</div>
        <div style="display:grid;grid-template-columns:auto 1fr 1fr 1fr;border:none">
          <div class="cell"><div class="lbl">Equipment #</div><div class="val mn" style="font-weight:700">${wo.equipment||"&nbsp;"}</div></div>
          <div class="cell s2"><div class="lbl">Equipment Name</div><div class="val">${eq?.name||wo.equipmentLabel||"&nbsp;"}</div></div>
          <div class="cell"><div class="lbl">Make / Model</div><div class="val">${eq?`${eq.make||""} ${eq.model||""}`.trim():"&nbsp;"}</div></div>
          <div class="cell"><div class="lbl">Serial # / EIL #</div><div class="val mn">${eq?.serial||"&nbsp;"} / ${eq?.eilNumber||"&nbsp;"}</div></div>
        </div>
      </div>
      <div class="sec"><div class="sh">Work Description &amp; Work Performed</div><div class="sb">${wo.description||"&nbsp;"}</div></div>
      <div class="bg">
        <div class="sec"><div class="sh">Mechanic Notes (Write-In)</div><div class="sb" style="min-height:80px">${wo.mechanicNotes||"&nbsp;"}</div></div>
        <div class="sec">
          <div class="sh">Parts &amp; Labor Summary</div>
          <table class="pt">
            <thead><tr><th style="width:40%">Part / Material</th><th style="width:12%;text-align:center">Qty</th><th style="width:22%;text-align:right">Unit $</th><th style="width:26%;text-align:right">Total</th></tr></thead>
            <tbody>
              ${partsUsed.length>0
                ? partsUsed.map(p=>{ const q=+(p.qty||1),u=+(p.unitCost||0); return `<tr><td>${p.name||"&mdash;"}</td><td style="text-align:center">${q}</td><td style="text-align:right">$${u.toFixed(2)}</td><td style="text-align:right">$${(q*u).toFixed(2)}</td></tr>`; }).join("")
                  +`<tr class="sub"><td colspan="3">Parts Subtotal</td><td style="text-align:right">$${partsTotal.toFixed(2)}</td></tr>`
                : `<tr><td colspan="4" style="color:#999;font-style:italic;padding:4px 6px">No parts listed</td></tr>`
              }
            </tbody>
          </table>
          <div class="cs">
            <div class="cr"><span>Labor (${wo.laborHours||0} hrs)</span><span>$${laborTotal.toFixed(2)}</span></div>
            ${!partsUsed.length&&wo.partsCost?`<div class="cr"><span>Parts Cost</span><span>$${(+wo.partsCost).toFixed(2)}</span></div>`:""}
            <div class="ct"><span>GRAND TOTAL</span><span>$${grandTotal.toFixed(2)}</span></div>
          </div>
        </div>
      </div>
      ${ws.footerText?`<div class="sec"><div class="sh">Remarks</div><div class="sb" style="min-height:28px;font-size:10px">${ws.footerText}</div></div>`:""}
      <div class="sigs">
        <div class="sc"><div class="sw"><div class="sl"></div><div class="slb">Mechanic / Supervisor Signature</div></div><div class="sw"><div class="sl"></div><div class="slb">Print Name</div></div></div>
        <div class="sc"><div class="sw"><div class="sl"></div><div class="slb">Date</div></div></div>
      </div>
      <div class="ftr"><span>${companyName} - Maintenance Dept.</span><span>WO# ${wo.id} | ${new Date().toLocaleDateString()}</span></div>
    </div>
    <div class="pbtn">
      <button class="bpr" onclick="window.print()">Print / Save PDF</button>
      <a href="${woCsv}" download="work-order-${wo.id}.csv" style="padding:9px 24px;font-size:13px;font-weight:700;border-radius:6px;background:#fff;color:#1a1a2e;border:1px solid #1a1a2e;text-decoration:none;font-family:Arial,sans-serif">Download Excel CSV</a>
    </div>
    </body></html>`);
    win.document.close();
  };

  /* ---- Tech dropdown ---- */
  /* ---- WO form fields ---- */
  const renderWOForm = () => {
    const needsInterval = form.woType==="Service" || form.woType==="Inspection";
    const techObj = technicians.find(t=>t.id===form.techId);
    return (
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"0 16px" }}>

        {/* Work Order Type — select right in the form */}
        <div style={{ gridColumn:"span 2", marginBottom:12 }}>
          <label style={{ display:"block", fontFamily:T.sans, fontSize:12, fontWeight:600, color:T.subtext, marginBottom:8 }}>Work Order Type <span style={{ color:T.red }}>*</span></label>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8 }}>
            {WO_TYPES.map(t=>{
              const active = form.woType===t.id;
              return (
                <button key={t.id} type="button"
                  onClick={()=>setForm(f=>({ ...f, woType:t.id, serviceInterval:"", title:buildTitle(t.id,"") }))}
                  style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:6, padding:"12px 8px", borderRadius:8, border:`2px solid ${active?t.color:T.border}`, background:active?t.bg:"#fff", cursor:"pointer", transition:"all .15s" }}>
                  <span style={{ fontSize:22 }}>{t.icon}</span>
                  <span style={{ fontFamily:T.sans, fontSize:12, fontWeight:active?700:500, color:active?t.color:T.subtext, textAlign:"center", lineHeight:1.3 }}>{t.id}</span>
                </button>
              );
            })}
          </div>
        </div>

        {needsInterval && (
          <div style={{ gridColumn:"span 2", marginBottom:10 }}>
            <label style={{ display:"block", fontFamily:T.sans, fontSize:12, fontWeight:600, color:T.subtext, marginBottom:6 }}>
              {form.woType==="Inspection" ? "Inspection Interval" : "Service Interval"} <span style={{ color:T.red }}>*</span>
            </label>
            <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
              {getIntervals(form.woType).map(interval => {
                const active = form.serviceInterval===interval;
                const isSpecial = interval.startsWith("New Equipment");
                return (
                  <button key={interval} type="button"
                    onClick={()=>setForm(f=>({...f, serviceInterval:interval, title:buildTitle(f.woType,interval)}))}
                    style={{ padding:"6px 13px", borderRadius:6, border:`1px solid ${active?(isSpecial?"#7c3aed":T.accent):T.border}`, background:active?(isSpecial?"#f5f3ff":T.accentLt):"#fff", color:active?(isSpecial?"#7c3aed":T.accent):T.subtext, cursor:"pointer", fontFamily:T.sans, fontSize:12, fontWeight:active?700:400 }}>
                    {isSpecial ? "★ " : ""}{interval}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <Field label="Work Order Title">
          <input style={inp} value={form.title||""} onChange={e=>setForm(f=>({...f,title:e.target.value}))} placeholder={needsInterval?"Select interval above to auto-fill...":"e.g. Repair hydraulic leak..."} />
        </Field>

        {/* Mechanic inline */}
        <div style={{ gridColumn:"span 2", marginBottom:0 }}>
          <label style={{ display:"block", fontFamily:T.sans, fontSize:12, fontWeight:600, color:T.subtext, marginBottom:5 }}>Mechanic</label>
          <div style={{ display:"flex", gap:8, alignItems:"flex-start", flexWrap:"wrap" }}>
            <select style={{ ...sel, flex:1, minWidth:180 }} value={form.techId||""} onChange={e=>{ if(e.target.value==="__new__"){ setShowNewTech(true); } else { selectTech(e.target.value); setShowNewTech(false); } }}>
              <option value="">-- Select Mechanic --</option>
              {technicians.map(t=><option key={t.id} value={t.id}>{t.name}{t.laborRate?` ($${t.laborRate}/hr)`:""}</option>)}
              <option value="__new__">+ Add New Mechanic...</option>
            </select>
            {form.techId && <div style={{ fontFamily:T.mono, fontSize:11, color:T.muted, paddingTop:8 }}>Rate: ${technicians.find(t=>t.id===form.techId)?.laborRate||0}/hr</div>}
          </div>
          {showNewTech && (
            <div style={{ marginTop:10, background:T.grayLt, border:`1px solid ${T.border}`, borderRadius:8, padding:"12px 14px", display:"grid", gridTemplateColumns:"1fr 1fr 1fr auto", gap:8, alignItems:"flex-end" }}>
              <div>
                <label style={{ fontFamily:T.sans, fontSize:11, fontWeight:600, color:T.muted, display:"block", marginBottom:4 }}>Full Name</label>
                <input style={inp} value={newTech.name} onChange={e=>setNewTech(n=>({...n,name:e.target.value}))} placeholder="First Last" />
              </div>
              <div>
                <label style={{ fontFamily:T.sans, fontSize:11, fontWeight:600, color:T.muted, display:"block", marginBottom:4 }}>Position</label>
                <input style={inp} value={newTech.position} onChange={e=>setNewTech(n=>({...n,position:e.target.value}))} placeholder="Mechanic" />
              </div>
              <div>
                <label style={{ fontFamily:T.sans, fontSize:11, fontWeight:600, color:T.muted, display:"block", marginBottom:4 }}>Labor Rate ($/hr)</label>
                <input style={inp} type="number" value={newTech.laborRate} onChange={e=>setNewTech(n=>({...n,laborRate:e.target.value}))} placeholder="45" />
              </div>
              <div style={{ display:"flex", gap:6 }}>
                <Btn small onClick={addNewTech}>Save</Btn>
                <Btn small variant="secondary" onClick={()=>setShowNewTech(false)}>X</Btn>
              </div>
            </div>
          )}
        </div>

        <Field label="Labor Hours" half>
          <input style={inp} type="number" value={form.laborHours||0} onChange={e=>{ const hrs=+e.target.value; const rate=techObj?.laborRate||0; setForm(f=>({...f,laborHours:hrs,laborCost:rate?hrs*rate:f.laborCost})); }} />
        </Field>
        <Field label="Labor Cost ($)" half>
          <input style={inp} type="number" value={form.laborCost||0} onChange={e=>setForm(f=>({...f,laborCost:e.target.value}))} />
        </Field>

        <Field label="Status" half>
          <select style={sel} value={form.status||"Open"} onChange={e=>setForm(f=>({...f,status:e.target.value}))}>
            {["Open","In Progress","Awaiting Parts","On Hold","Completed"].map(s=><option key={s}>{s}</option>)}
          </select>
        </Field>
        <Field label="Priority" half>
          <select style={sel} value={form.priority||"Medium"} onChange={e=>setForm(f=>({...f,priority:e.target.value}))}>
            {["High","Medium","Low"].map(p=><option key={p}>{p}</option>)}
          </select>
        </Field>
        <Field label="Date Created" half>
          <input style={inp} type="date" value={form.created||""} onChange={e=>setForm(f=>({...f,created:e.target.value}))} />
        </Field>
        <Field label="Due Date" half>
          <input style={inp} type="date" value={form.due||""} onChange={e=>setForm(f=>({...f,due:e.target.value}))} />
        </Field>
        <Field label="Date Completed" half>
          <input style={inp} type="date" value={form.completed||""} onChange={e=>setForm(f=>({...f,completed:e.target.value}))} />
        </Field>

        <Field label="Work Description / Problem Reported">
          <textarea style={{ ...inp, minHeight:60, resize:"vertical" }} value={form.description||""} onChange={e=>setForm(f=>({...f,description:e.target.value}))} />
        </Field>

        <Field label="Mechanic Notes">
          <textarea style={{ ...inp, minHeight:60, resize:"vertical" }} value={form.mechanicNotes||""} onChange={e=>setForm(f=>({...f,mechanicNotes:e.target.value}))} placeholder="Mechanic observations, steps taken, findings..." />
        </Field>

        {/* Parts inline */}
        <div style={{ gridColumn:"span 2", marginBottom:14 }}>
          <label style={{ display:"block", fontFamily:T.sans, fontSize:12, fontWeight:600, color:T.subtext, marginBottom:8 }}>Parts Used</label>
          {(form.partsUsed||[]).map((p,idx)=>(
            <div key={idx}>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 64px 90px auto auto", gap:8, marginBottom:4, alignItems:"center" }}>
                <div style={{ position:"relative" }}>
                  <input style={inp} placeholder="Part name or pick from inventory..." value={p.name||""} onChange={e=>setForm(f=>{ const arr=[...(f.partsUsed||[])]; arr[idx]={...arr[idx],name:e.target.value,partId:undefined}; return {...f,partsUsed:arr}; })} />
                  {p.partId && <span style={{ position:"absolute", right:8, top:"50%", transform:"translateY(-50%)", fontFamily:T.mono, fontSize:9, color:T.green }}>inv</span>}
                </div>
                <input style={{ ...inp, textAlign:"center" }} type="number" min="1" placeholder="Qty" value={p.qty||""} onChange={e=>setForm(f=>{ const arr=[...(f.partsUsed||[])]; arr[idx]={...arr[idx],qty:e.target.value}; return {...f,partsUsed:arr}; })} />
                <input style={inp} type="number" min="0" step="0.01" placeholder="Unit $" value={p.unitCost||""} onChange={e=>setForm(f=>{ const arr=[...(f.partsUsed||[])]; arr[idx]={...arr[idx],unitCost:e.target.value}; return {...f,partsUsed:arr}; })} />
                <button onClick={()=>setShowNewPart(showNewPart===idx?null:idx)} style={{ padding:"6px 8px", border:`1px solid ${T.border}`, borderRadius:6, background:T.grayLt, cursor:"pointer", fontFamily:T.sans, fontSize:11, fontWeight:600, color:T.accent, whiteSpace:"nowrap" }}>
                  {showNewPart===idx?"Close":"Inv"}
                </button>
                <button onClick={()=>setForm(f=>{ const arr=[...(f.partsUsed||[])]; arr.splice(idx,1); return {...f,partsUsed:arr}; })} style={{ padding:"6px 10px", border:"1px solid #fca5a5", borderRadius:6, background:"none", color:T.red, cursor:"pointer", fontFamily:T.sans, fontSize:12, fontWeight:600 }}>X</button>
              </div>
              {showNewPart===idx && (
                <div style={{ background:T.grayLt, border:`1px solid ${T.border}`, borderRadius:8, padding:"10px 12px", marginBottom:8 }}>
                  <div style={{ fontFamily:T.sans, fontSize:12, fontWeight:700, color:T.text, marginBottom:8 }}>Pick from Inventory</div>
                  <div style={{ display:"flex", flexDirection:"column", gap:4, maxHeight:160, overflowY:"auto", marginBottom:10 }}>
                    {/* Model-matched parts first */}
                    {(() => {
                      const eq = state.equipment.find(e=>e.id===form.equipment);
                      const eqKey = `${eq?.make||""} ${eq?.model||""}`.trim().toLowerCase();
                      const matched = state.parts.filter(pt=>pt.qty>0&&pt.modelFit&&eqKey&&pt.modelFit.toLowerCase().split(",").some(m=>eqKey.includes(m.trim().toLowerCase())||m.trim().toLowerCase().includes(eqKey)));
                      const other   = state.parts.filter(pt=>pt.qty>0&&!matched.find(m=>m.id===pt.id));
                      const renderRow = (pt, highlight) => (
                        <button key={pt.id} onClick={()=>{ addPartFromInventory(pt,idx); setShowNewPart(null); }} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"6px 10px", background:highlight?"#f0fdf4":"#fff", border:`1px solid ${highlight?"#86efac":T.border}`, borderRadius:6, cursor:"pointer", textAlign:"left", fontFamily:T.sans, fontSize:12 }}>
                          <span><b>{pt.name}</b> <span style={{ color:T.muted, fontSize:11 }}>#{pt.partNumber}</span> {highlight&&<span style={{ color:T.green, fontSize:10, fontWeight:700 }}>Model Match</span>}</span>
                          <span style={{ color:T.green, fontFamily:T.mono, fontSize:11, marginLeft:8, flexShrink:0 }}>Qty:{pt.qty} | ${pt.unitCost}</span>
                        </button>
                      );
                      return (<>
                        {matched.length>0&&<div style={{ fontFamily:T.sans, fontSize:10, fontWeight:700, color:T.green, textTransform:"uppercase", letterSpacing:.5, padding:"2px 0" }}>Model-Specific Parts</div>}
                        {matched.map(pt=>renderRow(pt,true))}
                        {other.length>0&&matched.length>0&&<div style={{ fontFamily:T.sans, fontSize:10, fontWeight:700, color:T.muted, textTransform:"uppercase", letterSpacing:.5, padding:"4px 0 2px" }}>All Other Parts</div>}
                        {other.map(pt=>renderRow(pt,false))}
                        {state.parts.filter(pt=>pt.qty>0).length===0&&<div style={{ color:T.muted, fontSize:12, fontFamily:T.sans }}>No parts in stock.</div>}
                      </>);
                    })()}
                  </div>
                  <div style={{ fontFamily:T.sans, fontSize:12, fontWeight:700, color:T.text, marginBottom:6 }}>Or Add New Part to Inventory</div>
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 80px 80px 80px", gap:6, marginBottom:6 }}>
                    <input style={inp} placeholder="Part name*" value={newPartForm.name||""} onChange={e=>setNewPartForm(f=>({...f,name:e.target.value}))} />
                    <input style={inp} placeholder="Part number" value={newPartForm.partNumber||""} onChange={e=>setNewPartForm(f=>({...f,partNumber:e.target.value}))} />
                    <input style={inp} placeholder="Stock" type="number" value={newPartForm.qty||""} onChange={e=>setNewPartForm(f=>({...f,qty:e.target.value}))} />
                    <input style={inp} placeholder="Min" type="number" value={newPartForm.minQty||""} onChange={e=>setNewPartForm(f=>({...f,minQty:e.target.value}))} />
                    <input style={inp} placeholder="$/unit" type="number" step="0.01" value={newPartForm.unitCost||""} onChange={e=>setNewPartForm(f=>({...f,unitCost:e.target.value}))} />
                  </div>
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr auto", gap:6 }}>
                    <input style={inp} placeholder="Category" value={newPartForm.category||""} onChange={e=>setNewPartForm(f=>({...f,category:e.target.value}))} />
                    <input style={inp} placeholder="Vendor" value={newPartForm.vendor||""} onChange={e=>setNewPartForm(f=>({...f,vendor:e.target.value}))} />
                    <select style={sel} value={newPartForm.equipmentId||""} onChange={e=>{ const eq=state.equipment.find(q=>q.id===e.target.value); setNewPartForm(f=>({...f,equipmentId:e.target.value,modelFit:eq?`${eq.make||""} ${eq.model||""}`.trim():f.modelFit})); }}>
                      <option value="">Link to equipment (optional)</option>
                      {state.equipment.map(e=><option key={e.id} value={e.id}>{e.name} ({e.id})</option>)}
                    </select>
                    <Btn small onClick={()=>addNewPartToInventory(idx)}>Add & Use</Btn>
                  </div>
                </div>
              )}
            </div>
          ))}
          <button onClick={()=>setForm(f=>({...f,partsUsed:[...(f.partsUsed||[]),{name:"",qty:1,unitCost:""}]}))} style={{ background:"none", border:"1px dashed #c8d0e0", borderRadius:6, padding:"7px 16px", color:T.accent, cursor:"pointer", fontFamily:T.sans, fontSize:12, fontWeight:600, width:"100%" }}>
            + Add Part
          </button>
        </div>

      </div>
    );
  };

  /* WO Detail render function - avoids remount */
  const renderWODetail = (wo) => {
    if(!wo) return null;
    const eq = state.equipment.find(e=>e.id===wo.equipment);
    const typeInfo = WO_TYPES.find(t=>t.id===wo.woType);
    const partsUsed = wo.partsUsed||[];
    const partsTotal = partsUsed.reduce((s,p)=>s+(+(p.qty||1))*(+(p.unitCost||0)),0);
    const total = (+wo.laborCost||0)+partsTotal+(+wo.partsCost||0);
    const isCompleted = wo.status==="Completed";

    const completeWO = () => {
      const completedDate = today();
      const updated = { ...wo, status:"Completed", completed:completedDate };
      dispatch({ type:"UPDATE_WO", payload:updated });
      setModal(null); setDetailWO(null);
      if(confirm("Work order completed. Would you like to print it?")) printWO(updated);
    };

    const updateWO = () => {
      dispatch({ type:"UPDATE_WO", payload:{ ...wo, ...form } });
      setModal(null); setDetailWO(null);
    };

    return (
      <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
        {/* Header */}
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", flexWrap:"wrap", gap:10 }}>
          <div>
            <div style={{ display:"flex", gap:8, alignItems:"center", flexWrap:"wrap", marginBottom:4 }}>
              <span style={{ fontFamily:T.mono, fontSize:11, color:T.muted }}>{wo.id}</span>
              <Badge label={wo.status} />
              <Badge label={wo.priority} type="priority" />
              {typeInfo && <span style={{ padding:"2px 8px", borderRadius:4, background:typeInfo.bg, color:typeInfo.color, fontSize:11, fontWeight:600 }}>{typeInfo.icon} {typeInfo.id}</span>}
              {wo.autoGenerated && <span style={{ padding:"2px 8px", borderRadius:4, background:"#f5f3ff", color:"#7c3aed", fontSize:11, fontWeight:600 }}>AUTO</span>}
            </div>
            <h3 style={{ margin:0, fontFamily:T.sans, fontSize:18, fontWeight:700, color:T.text }}>{wo.title}</h3>
            {wo.serviceInterval && <div style={{ fontFamily:T.mono, fontSize:11, color:T.accent, marginTop:2 }}>{wo.serviceInterval}</div>}
          </div>
          <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
            <Btn small variant="secondary" onClick={()=>printWO(wo)}>Print</Btn>
            {!isCompleted && !editMode && <Btn small onClick={()=>setEditMode(true)} style={{ background:"#1e40af", borderColor:"#1e40af" }}>Update Work Order</Btn>}
            {!isCompleted && editMode && <Btn small onClick={()=>{ dispatch({ type:"UPDATE_WO", payload:{ ...wo, ...form } }); setEditMode(false); setDetailWO({ ...wo, ...form }); }} style={{ background:T.green, borderColor:T.green }}>Save Changes</Btn>}
            {!isCompleted && editMode && <Btn small variant="secondary" onClick={()=>{ setEditMode(false); setForm({...wo, partsUsed:wo.partsUsed||[]}); }}>Cancel Edit</Btn>}
            {!isCompleted && !editMode && <Btn small onClick={completeWO} style={{ background:T.green, borderColor:T.green }}>Complete Work Order</Btn>}
            <Btn small variant="danger" onClick={()=>del(wo.id)}>Delete</Btn>
          </div>
        </div>

        {/* Info grid */}
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:12 }}>
          {[["Equipment", eq?.name||wo.equipmentLabel||wo.equipment],["Mechanic",wo.tech],["Created",wo.created],["Due",wo.due],["Completed",wo.completed||"—"],["Labor Hours",`${wo.laborHours||0} hrs`]].map(([k,v])=>(
            <div key={k} style={{ background:T.grayLt, borderRadius:6, padding:"8px 12px", border:`1px solid ${T.border}` }}>
              <div style={{ fontFamily:T.sans, fontSize:10, fontWeight:600, color:T.muted, textTransform:"uppercase", letterSpacing:.4 }}>{k}</div>
              <div style={{ fontFamily:T.sans, fontSize:13, color:T.text, marginTop:3 }}>{v||"—"}</div>
            </div>
          ))}
        </div>

        {/* Description */}
        {wo.description && (
          <div style={{ background:T.grayLt, borderRadius:6, padding:"10px 12px", border:`1px solid ${T.border}` }}>
            <div style={{ fontFamily:T.sans, fontSize:10, fontWeight:600, color:T.muted, textTransform:"uppercase", letterSpacing:.4, marginBottom:4 }}>Work Description</div>
            <div style={{ fontFamily:T.sans, fontSize:13, color:T.text, lineHeight:1.6 }}>{wo.description}</div>
          </div>
        )}

        {/* Mechanic Notes */}
        <div style={{ background:T.grayLt, borderRadius:6, padding:"10px 12px", border:`1px solid ${T.border}` }}>
          <div style={{ fontFamily:T.sans, fontSize:10, fontWeight:600, color:T.muted, textTransform:"uppercase", letterSpacing:.4, marginBottom:4 }}>Mechanic Notes</div>
          <div style={{ fontFamily:T.sans, fontSize:13, color:wo.mechanicNotes?T.text:T.muted, lineHeight:1.6, fontStyle:wo.mechanicNotes?"normal":"italic" }}>{wo.mechanicNotes||"No notes recorded."}</div>
        </div>

        {/* Parts & Labor Summary — below mechanic notes */}
        <div style={{ border:`1px solid ${T.border}`, borderRadius:8, overflow:"hidden" }}>
          <div style={{ background:T.text, color:"#fff", padding:"7px 12px", fontFamily:T.sans, fontSize:11, fontWeight:700, textTransform:"uppercase", letterSpacing:.6 }}>Parts &amp; Labor Summary</div>
          {partsUsed.length>0 && (
            <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13, fontFamily:T.sans }}>
              <thead><tr style={{ background:T.grayLt, borderBottom:`1px solid ${T.border}` }}>
                {["Part / Material","Qty","Unit Price","Total"].map(h=><th key={h} style={{ padding:"6px 12px", textAlign:"left", fontSize:11, fontWeight:600, color:T.muted, textTransform:"uppercase" }}>{h}</th>)}
              </tr></thead>
              <tbody>
                {partsUsed.map((p,i)=>(
                  <tr key={i} style={{ borderBottom:`1px solid ${T.border}`, background:i%2===0?"#fff":T.grayLt }}>
                    <td style={{ padding:"8px 12px", color:T.text, fontWeight:500 }}>{p.name}</td>
                    <td style={{ padding:"8px 12px", fontFamily:T.mono, fontSize:12, color:T.subtext }}>{p.qty}</td>
                    <td style={{ padding:"8px 12px", fontFamily:T.mono, fontSize:12, color:T.subtext }}>${(+(p.unitCost||0)).toFixed(2)}</td>
                    <td style={{ padding:"8px 12px", fontFamily:T.mono, fontSize:12, fontWeight:600 }}>${((+(p.qty||1))*(+(p.unitCost||0))).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {partsUsed.length===0 && <div style={{ padding:"10px 12px", fontFamily:T.sans, fontSize:13, color:T.muted, fontStyle:"italic" }}>No parts recorded.</div>}
          <div style={{ background:T.grayLt, borderTop:`2px solid ${T.border}`, padding:"10px 14px", display:"flex", gap:24, flexWrap:"wrap" }}>
            {[["Labor ("+wo.laborHours+"hrs)",`$${(+wo.laborCost||0).toFixed(2)}`],["Parts",`$${partsTotal.toFixed(2)}`],["GRAND TOTAL",`$${total.toFixed(2)}`]].map(([k,v])=>(
              <div key={k}><div style={{ fontFamily:T.sans, fontSize:10, fontWeight:600, color:T.muted, textTransform:"uppercase" }}>{k}</div><div style={{ fontFamily:T.sans, fontSize:k==="GRAND TOTAL"?18:14, fontWeight:700, color:k==="GRAND TOTAL"?T.accent:T.text, marginTop:2 }}>{v}</div></div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div>
      {/* Toolbar */}
      <div style={{ display:"flex", flexDirection:"column", gap:10, marginBottom:16 }}>
        {/* Row 1: Status tabs + New WO */}
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:8 }}>
          <div style={{ display:"flex", gap:0, background:"#fff", border:`1px solid ${T.border}`, borderRadius:7, overflow:"hidden", flexWrap:"wrap" }}>
            {STATUS_TABS.map((s,i)=>(
              <button key={s} onClick={()=>setFilter(s)} style={{ padding:"7px 12px", border:"none", borderLeft:i>0?`1px solid ${T.border}`:"none", background:filter===s?T.accent:"#fff", color:filter===s?"#fff":T.subtext, cursor:"pointer", fontFamily:T.sans, fontSize:11, fontWeight:filter===s?600:400 }}>{s}</button>
            ))}
          </div>
          <Btn onClick={openAdd}>+ New Work Order</Btn>
          <Btn variant="secondary" onClick={onWOSettings}>⚙ WO Settings</Btn>
        </div>

        {/* Row 2: Filters + Sort */}
        <div style={{ display:"flex", gap:8, flexWrap:"wrap", alignItems:"center" }}>
          {/* Type */}
          <select style={{ ...sel, width:140 }} value={typeFilter} onChange={e=>setTypeFilter(e.target.value)}>
            <option value="All">All Types</option>
            {["Service","Inspection","Repair"].map(t=><option key={t}>{t}</option>)}
          </select>
          {/* Priority */}
          <select style={{ ...sel, width:130 }} value={priorityFilter} onChange={e=>setPriorityFilter(e.target.value)}>
            <option value="All">All Priorities</option>
            {["High","Medium","Low"].map(p=><option key={p}>{p}</option>)}
          </select>
          {/* Mechanic */}
          <select style={{ ...sel, width:150 }} value={mechFilter} onChange={e=>setMechFilter(e.target.value)}>
            <option value="All">All Mechanics</option>
            {allMechanics.map(m=><option key={m}>{m}</option>)}
          </select>
          {/* Date range — only when viewing Completed */}
          {filter==="Completed" && (
            <select style={{ ...sel, width:150 }} value={completedDateFilter} onChange={e=>setCompletedDateFilter(e.target.value)}>
              <option value="all">All Time</option>
              <option value="today">Today</option>
              <option value="thisweek">This Week</option>
              <option value="lastweek">Previous Week</option>
              <option value="thismonth">This Month</option>
              <option value="lastmonth">Previous Month</option>
            </select>
          )}
          {/* Sort by */}
          <div style={{ display:"flex", gap:0, border:`1px solid ${T.border}`, borderRadius:6, overflow:"hidden" }}>
            <select style={{ ...sel, border:"none", borderRadius:0, width:120 }} value={sortBy} onChange={e=>setSortBy(e.target.value)}>
              <option value="created">Date Created</option>
              <option value="due">Due Date</option>
              <option value="priority">Priority</option>
              <option value="status">Status</option>
              <option value="cost">Cost</option>
            </select>
            <button onClick={()=>setSortDir(d=>d==="asc"?"desc":"asc")} style={{ padding:"0 10px", border:"none", borderLeft:`1px solid ${T.border}`, background:T.grayLt, cursor:"pointer", fontFamily:T.mono, fontSize:13, color:T.subtext }}>
              {sortDir==="asc"?"↑":"↓"}
            </button>
          </div>
          {/* Clear filters */}
          {(typeFilter!=="All"||priorityFilter!=="All"||mechFilter!=="All") && (
            <button onClick={()=>{ setTypeFilter("All"); setPriorityFilter("All"); setMechFilter("All"); }} style={{ background:"none", border:"none", color:T.accent, fontFamily:T.sans, fontSize:12, fontWeight:600, cursor:"pointer" }}>✕ Clear</button>
          )}
          <span style={{ fontFamily:T.sans, fontSize:12, color:T.muted, marginLeft:"auto" }}>
            {filtered.length} work order{filtered.length!==1?"s":""}
          </span>
        </div>
      </div>

      {/* WO Table — click anywhere on row to open detail */}
      <Card style={{ padding:0, overflow:"hidden" }}>
        <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13, fontFamily:T.sans }}>
          <thead>
            <tr style={{ background:T.grayLt, borderBottom:`1px solid ${T.border}` }}>
              {["WO #","Type","Title","Equipment","Mechanic","Priority","Status","Due","Cost",""].map(h=>(
                <th key={h} style={{ padding:"10px 14px", textAlign:"left", fontWeight:600, fontSize:11, color:T.muted, textTransform:"uppercase", letterSpacing:.4, whiteSpace:"nowrap" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((wo,i)=>{
              const eq = state.equipment.find(e=>e.id===wo.equipment);
              const eqLabel = eq?.name || wo.equipmentLabel || wo.equipment || "—";
              const partsTotal = (wo.partsUsed||[]).reduce((s,p)=>s+(+(p.qty||1))*(+(p.unitCost||0)),0);
              const total = (+wo.laborCost||0)+partsTotal+(+wo.partsCost||0);
              const typeInfo = WO_TYPES.find(t=>t.id===wo.woType);
              return (
                <tr key={wo.id} onClick={()=>openDetail(wo)} style={{ borderBottom:`1px solid ${T.border}`, background:i%2===0?"#fff":T.grayLt, cursor:"pointer", transition:"background .12s" }}
                  onMouseEnter={e=>e.currentTarget.style.background=T.accentLt}
                  onMouseLeave={e=>e.currentTarget.style.background=i%2===0?"#fff":T.grayLt}>
                  <td style={{ padding:"11px 14px", fontFamily:T.mono, fontSize:11, color:T.muted, whiteSpace:"nowrap" }}>{wo.id}</td>
                  <td style={{ padding:"11px 14px" }}>
                    {typeInfo ? <span style={{ display:"inline-flex", alignItems:"center", gap:4, padding:"2px 8px", borderRadius:4, background:typeInfo.bg, color:typeInfo.color, fontSize:11, fontWeight:600 }}>{typeInfo.icon} {typeInfo.id}</span> : <span style={{ color:T.muted }}>—</span>}
                  </td>
                  <td style={{ padding:"11px 14px" }}>
                    <div style={{ fontWeight:500, color:T.text }}>{wo.title}</div>
                    {wo.serviceInterval && <div style={{ fontSize:11, color:T.accent, marginTop:1 }}>{wo.serviceInterval}</div>}
                  </td>
                  <td style={{ padding:"11px 14px", color:T.subtext, whiteSpace:"nowrap" }}>
                    <div>{eqLabel}</div>
                    {wo.parentName && <div style={{ fontSize:11, color:T.muted }}>on: {wo.parentName}</div>}
                  </td>
                  <td style={{ padding:"11px 14px", color:T.subtext, whiteSpace:"nowrap" }}>{wo.tech||"—"}</td>
                  <td style={{ padding:"11px 14px" }}><Badge label={wo.priority} type="priority" /></td>
                  <td style={{ padding:"11px 14px" }}><Badge label={wo.status} /></td>
                  <td style={{ padding:"11px 14px", fontFamily:T.mono, fontSize:12, color:wo.due&&wo.due<today()&&wo.status!=="Completed"?T.red:T.subtext, whiteSpace:"nowrap" }}>{wo.due}</td>
                  <td style={{ padding:"11px 14px", fontFamily:T.mono, fontSize:12, color:T.subtext, whiteSpace:"nowrap" }}>{total>0?`$${total.toFixed(0)}`:"—"}</td>
                  <td style={{ padding:"4px 10px", whiteSpace:"nowrap" }} onClick={e=>e.stopPropagation()}>
                    <button
                      title="Print Work Order"
                      onClick={e=>{ e.stopPropagation(); printWO(wo); }}
                      style={{ background:"none", border:`1px solid ${T.border}`, borderRadius:6, padding:"5px 9px", cursor:"pointer", fontSize:14, color:T.subtext, display:"inline-flex", alignItems:"center", justifyContent:"center" }}>
                      🖨
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filtered.length===0 && <div style={{ padding:40, textAlign:"center", color:T.muted, fontFamily:T.sans, fontSize:13 }}>No work orders. Click "New Work Order" to create one.</div>}
      </Card>

      {/* Detail modal — read-only by default, editable when Update clicked */}
      {modal==="detail" && detailWO && (
        <Modal title={`Work Order — ${detailWO.id}`} onClose={()=>{ setModal(null); setDetailWO(null); setEditMode(false); }}>
          {renderWODetail(state.workOrders.find(w=>w.id===detailWO.id)||detailWO)}
          {editMode && (
            <div style={{ borderTop:`2px solid ${T.accent}`, marginTop:16, paddingTop:16 }}>
              <div style={{ fontFamily:T.sans, fontSize:12, fontWeight:700, color:T.accent, textTransform:"uppercase", letterSpacing:.5, marginBottom:12 }}>✎ Editing Work Order</div>
              {renderWOForm()}
            </div>
          )}
        </Modal>
      )}

      {/* Edit modal */}
      {modal==="edit" && (
        <Modal title={`Edit ${form.id}`} onClose={()=>setModal(null)}>
          <div style={{ background:T.grayLt, border:`1px solid ${T.border}`, borderRadius:8, padding:"10px 14px", marginBottom:14 }}>
            <div style={{ fontFamily:T.sans, fontSize:11, fontWeight:600, color:T.muted, textTransform:"uppercase", letterSpacing:.4, marginBottom:3 }}>Equipment</div>
            <div style={{ fontFamily:T.sans, fontSize:13, fontWeight:600, color:T.text }}>{state.equipment.find(e=>e.id===form.equipment)?.name||form.equipmentLabel||form.equipment||"—"}</div>
          </div>
          {renderWOForm()}
          <div style={{ display:"flex", gap:8, justifyContent:"flex-end", marginTop:8 }}>
            <Btn variant="secondary" onClick={()=>setModal(null)}>Cancel</Btn>
            <Btn onClick={()=>save(true)}>Save Changes</Btn>
          </div>
        </Modal>
      )}

      {/* Equipment picker */}
      {modal==="pick" && (
        <Modal title="Select Equipment or Attachment" onClose={()=>setModal(null)}>
          <p style={{ margin:"0 0 14px", fontFamily:T.sans, fontSize:13, color:T.subtext }}>Choose the equipment or attachment this work order is for.</p>
          <input style={{ ...inp, marginBottom:14 }} placeholder="Search by name, serial, EIL #..." value={eqSearch} onChange={e=>setEqSearch(e.target.value)} autoFocus />
          <div style={{ display:"flex", flexDirection:"column", gap:6, maxHeight:400, overflowY:"auto" }}>
            {filteredPickable.length===0 && (
              <div style={{ padding:32, textAlign:"center", color:T.muted, fontFamily:T.sans, fontSize:13 }}>
                <div style={{ fontSize:28, marginBottom:8 }}>🔍</div>
                No equipment found. Add equipment in the Equipment tab first.
              </div>
            )}
            {filteredPickable.map(item=>(
              <button key={item.id} onClick={()=>pickEquipment(item)} style={{ display:"flex", alignItems:"center", gap:14, padding:"12px 14px", background:T.grayLt, border:`1px solid ${T.border}`, borderRadius:8, cursor:"pointer", textAlign:"left", width:"100%", transition:"all .15s" }}
                onMouseEnter={e=>{ e.currentTarget.style.borderColor=T.accent; e.currentTarget.style.background=T.accentLt; }}
                onMouseLeave={e=>{ e.currentTarget.style.borderColor=T.border; e.currentTarget.style.background=T.grayLt; }}>
                <span style={{ flexShrink:0, padding:"3px 9px", borderRadius:4, fontSize:10, fontWeight:700, fontFamily:T.mono, background:item.typeBg, color:item.typeColor, border:`1px solid ${item.typeColor}33`, minWidth:72, textAlign:"center" }}>{item.type}</span>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"nowrap" }}>
                    <span style={{ fontFamily:T.sans, fontSize:14, fontWeight:700, color:T.text, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{item.label}</span>
                    <span style={{ fontFamily:T.mono, fontSize:10, color:item.typeColor, background:item.typeBg, border:`1px solid ${item.typeColor}44`, borderRadius:4, padding:"1px 7px", flexShrink:0 }}>{item.id}</span>
                  </div>
                  <div style={{ fontFamily:T.mono, fontSize:11, color:T.muted, marginTop:2, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{item.sub}</div>
                  {item.parentName && <div style={{ fontFamily:T.sans, fontSize:11, color:T.accent, marginTop:2 }}>Attachment on: {item.parentName} ({item.parentId})</div>}
                </div>
                <span style={{ color:T.accent, fontSize:20 }}>›</span>
              </button>
            ))}
          </div>
          <div style={{ display:"flex", justifyContent:"flex-end", marginTop:14 }}>
            <Btn variant="secondary" onClick={()=>setModal(null)}>Cancel</Btn>
          </div>
        </Modal>
      )}

      {/* Step 2: WO Form */}
      {modal==="form" && (
        <Modal title="Work Order Details" onClose={()=>setModal(null)}>
          <div style={{ background:T.accentLt, border:`1px solid ${T.accent}44`, borderRadius:8, padding:"10px 14px", marginBottom:14, display:"flex", alignItems:"center", gap:12 }}>
            <span style={{ fontSize:20 }}>🚜</span>
            <div>
              <div style={{ fontFamily:T.sans, fontSize:13, fontWeight:700, color:T.accent }}>{form.equipmentLabel}</div>
              <div style={{ fontFamily:T.mono, fontSize:11, color:T.muted }}>{form.equipmentSub}</div>
            </div>
            <button onClick={()=>setModal("pick")} style={{ marginLeft:"auto", background:"none", border:`1px solid ${T.accent}`, borderRadius:6, padding:"4px 10px", color:T.accent, fontFamily:T.sans, fontSize:11, fontWeight:600, cursor:"pointer" }}>Change</button>
          </div>
          {renderWOForm()}
          <div style={{ display:"flex", gap:8, justifyContent:"flex-end", marginTop:8 }}>
            <Btn variant="secondary" onClick={()=>setModal("pick")}>Back to Equipment</Btn>
            <Btn variant="secondary" onClick={()=>setModal(null)}>Cancel</Btn>
            <Btn onClick={()=>save(false)}>Save Work Order</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ATTACHMENTS CARD - used inside Equipment detail view */

function AttachmentsCard({ eq, dispatch }) {
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId]     = useState(null);
  const [form, setForm]         = useState({});
  const F = k => e => setForm(f=>({...f,[k]:e.target.value}));

  const attachments = eq.attachments || [];

  const blankForm = () => ({ name:"", make:"", model:"", serial:"", eilNumber:"", acquisitionDate:"", acquisitionCost:"", notes:"" });

  const openAdd = () => { setForm(blankForm()); setEditId(null); setShowForm(true); };
  const openEdit = (at) => { setForm({...at}); setEditId(at.id); setShowForm(true); };
  const cancel = () => { setShowForm(false); setEditId(null); setForm({}); };

  const save = () => {
    if(!form.name) return alert("Attachment name is required.");
    const updated = editId
      ? attachments.map(a => a.id===editId ? {...form, id:editId} : a)
      : [...attachments, { ...form, id:`AT-${String(Date.now()).slice(-5)}` }];
    dispatch({ type:"UPDATE_EQ", payload:{ ...eq, attachments:updated } });
    cancel();
  };

  const remove = (id) => {
    if(!confirm("Remove this attachment?")) return;
    dispatch({ type:"UPDATE_EQ", payload:{ ...eq, attachments: attachments.filter(a=>a.id!==id) } });
  };

  return (
    <Card style={{ gridColumn:"span 2" }}>
      {/* Header */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14, flexWrap:"wrap", gap:8 }}>
        <div>
          <h4 style={{ margin:0, fontFamily:T.sans, fontSize:12, fontWeight:700, color:T.muted, textTransform:"uppercase", letterSpacing:.4 }}>
            Attachments / Implements
          </h4>
          <p style={{ margin:"3px 0 0", fontFamily:T.sans, fontSize:12, color:T.muted }}>
            Tools and implements that belong to this equipment (e.g. broom, plow, forks)
          </p>
        </div>
        {!showForm && <Btn small onClick={openAdd}>+ Add Attachment</Btn>}
      </div>

      {/* Inline add / edit form */}
      {showForm && (
        <div style={{ background:T.grayLt, border:`1px solid ${T.border}`, borderRadius:8, padding:"16px 18px", marginBottom:16 }}>
          <h5 style={{ margin:"0 0 14px", fontFamily:T.sans, fontSize:13, fontWeight:700, color:T.text }}>
            {editId ? "Edit Attachment" : "New Attachment"}
          </h5>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"0 16px" }}>
            <div style={{ marginBottom:12, gridColumn:"span 2" }}>
              <label style={{ display:"block", fontFamily:T.sans, fontSize:12, fontWeight:600, color:T.subtext, marginBottom:5 }}>Attachment Name *</label>
              <input style={inp} value={form.name||""} onChange={F("name")} placeholder="e.g. Sweeper Broom, Snow Plow, Pallet Forks" />
            </div>
            {[["EIL #","eilNumber","EE#"],["Make","make",""],["Model","model",""],["Serial Number","serial",""]].map(([label,key,ph])=>(
              <div key={key} style={{ marginBottom:12 }}>
                <label style={{ display:"block", fontFamily:T.sans, fontSize:12, fontWeight:600, color:T.subtext, marginBottom:5 }}>{label}</label>
                <input style={inp} value={form[key]||""} onChange={F(key)} placeholder={ph} />
              </div>
            ))}
            <div style={{ marginBottom:12 }}>
              <label style={{ display:"block", fontFamily:T.sans, fontSize:12, fontWeight:600, color:T.subtext, marginBottom:5 }}>Acquisition Date</label>
              <input style={inp} type="date" value={form.acquisitionDate||""} onChange={F("acquisitionDate")} />
            </div>
            <div style={{ marginBottom:12 }}>
              <label style={{ display:"block", fontFamily:T.sans, fontSize:12, fontWeight:600, color:T.subtext, marginBottom:5 }}>Purchase Price ($)</label>
              <input style={inp} type="number" value={form.acquisitionCost||""} onChange={F("acquisitionCost")} placeholder="0.00" />
            </div>
            <div style={{ marginBottom:12, gridColumn:"span 2" }}>
              <label style={{ display:"block", fontFamily:T.sans, fontSize:12, fontWeight:600, color:T.subtext, marginBottom:5 }}>Notes</label>
              <textarea style={{ ...inp, minHeight:56, resize:"vertical" }} value={form.notes||""} onChange={F("notes")} placeholder="Size, capacity, condition, etc." />
            </div>
          </div>
          <div style={{ display:"flex", gap:8, justifyContent:"flex-end" }}>
            <Btn variant="secondary" small onClick={cancel}>Cancel</Btn>
            <Btn small onClick={save}>{editId ? "Save Changes" : "Add Attachment"}</Btn>
          </div>
        </div>
      )}

      {/* Attachment list */}
      {attachments.length===0 && !showForm && (
        <div style={{ padding:"20px 0", textAlign:"center", color:T.muted, fontFamily:T.sans, fontSize:13, borderTop:`1px solid ${T.border}` }}>
          No attachments recorded for this equipment.
          <br />
          <button onClick={openAdd} style={{ background:"none", border:"none", color:T.accent, fontFamily:T.sans, fontSize:13, fontWeight:600, cursor:"pointer", marginTop:6, padding:0 }}>
            + Add the first attachment
          </button>
        </div>
      )}

      {attachments.length>0 && (
        <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13, fontFamily:T.sans }}>
          <thead>
            <tr style={{ background:T.grayLt, borderBottom:`1px solid ${T.border}` }}>
              {["Attachment Name","EIL #","Make / Model","Serial #","Acquired","Purchase Price","Notes",""].map(h=>(
                <th key={h} style={{ padding:"8px 12px", textAlign:"left", fontWeight:600, fontSize:11, color:T.muted, textTransform:"uppercase", letterSpacing:.4, whiteSpace:"nowrap" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {attachments.map((at,i)=>(
              <tr key={at.id} style={{ borderBottom:`1px solid ${T.border}`, background:i%2===0?"#fff":T.grayLt }}>
                <td style={{ padding:"10px 12px", fontWeight:600, color:T.text }}>{at.name}</td>
                <td style={{ padding:"10px 12px", fontFamily:T.mono, fontSize:12, color:T.muted }}>{at.eilNumber||"—"}</td>
                <td style={{ padding:"10px 12px", color:T.subtext }}>{[at.make,at.model].filter(Boolean).join(" ")||"—"}</td>
                <td style={{ padding:"10px 12px", fontFamily:T.mono, fontSize:12, color:T.subtext }}>{at.serial||"—"}</td>
                <td style={{ padding:"10px 12px", fontFamily:T.mono, fontSize:12, color:T.subtext }}>{at.acquisitionDate||"—"}</td>
                <td style={{ padding:"10px 12px", fontFamily:T.mono, fontSize:12, color:T.subtext }}>{at.acquisitionCost?`$${Number(at.acquisitionCost).toLocaleString()}`:"—"}</td>
                <td style={{ padding:"10px 12px", color:T.muted, fontSize:12, maxWidth:200 }}>{at.notes||"—"}</td>
                <td style={{ padding:"10px 12px", whiteSpace:"nowrap" }}>
                  <Btn small variant="secondary" onClick={()=>openEdit(at)} style={{ marginRight:4 }}>Edit</Btn>
                  <Btn small variant="danger" onClick={()=>remove(at.id)}>Remove</Btn>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  );
}


/* EQUIPMENT */

function Equipment({ state, dispatch }) {
  const [modal, setModal]       = useState(null);
  const [detail, setDetail]     = useState(null);
  const [attachDetail, setAttachDetail] = useState(null);
  const [expandedAt, setExpandedAt]     = useState({});
  const [form, setForm]         = useState({});
  const [search, setSearch]     = useState("");
  const [statusF, setStatusF]   = useState("All");
  const [typeF, setTypeF]       = useState("All");
  const [locationF, setLocationF] = useState("All");
  const [showNewCat, setShowNewCat] = useState(false);
  const [newCat, setNewCat]     = useState("");
  const F = k => e => setForm(f=>({...f,[k]:e.target.value}));

  const toggleAttachments = (eqId, e) => {
    e.stopPropagation();
    setExpandedAt(prev=>({...prev,[eqId]:!prev[eqId]}));
  };

  const EQ_STATUSES = ["Fully Operational","Operational with Deficiencies","Out of Service / Deadline","No Status"];
  const types     = [...new Set(state.equipment.map(e=>e.type).filter(Boolean))];
  const locations = [...new Set(state.equipment.map(e=>e.location).filter(Boolean))];

  const STATUS_SORT = { "Out of Service / Deadline":0, "Operational with Deficiencies":1, "Fully Operational":2, "No Status":3 };

  const filtered = state.equipment.filter(e=>{
    /* Hide equipment that's been turned in or disposed - they live in Equipment Inventory only */
    if(["Turned-in","Disposed"].includes(e.turnInStatus)) return false;
    const ms  = `${e.name} ${e.type} ${e.make} ${e.model} ${e.serial} ${e.eilNumber||""} ${e.location}`.toLowerCase().includes(search.toLowerCase());
    const mst = statusF==="All" || e.status===statusF;
    const mt  = typeF==="All"   || e.type===typeF;
    const ml  = locationF==="All" || e.location===locationF;
    return ms&&mst&&mt&&ml;
  }).sort((a,b)=>(STATUS_SORT[a.status]??99)-(STATUS_SORT[b.status]??99));

  const woForEq  = eq => state.workOrders.filter(w=>w.equipment===eq.id);
  const openAdd  = () => { setForm({ status:"Fully Operational", faultDescription:"", faultDate:"" }); setModal("add"); };
  const openEdit = eq => { setForm({...eq}); setModal("editing"); };
  const save = () => {
    if(!form.name) return alert("Name required.");
    if(modal==="add") {
      const newId = form.id && form.id.trim() ? form.id.trim() : genId("EQ");
      dispatch({type:"ADD_EQ", payload:{...form, id:newId}});
    } else {
      dispatch({type:"UPDATE_EQ", payload:form});
    }
    setModal(null);
  };
  const del = id => { if(confirm("Delete this equipment record?")){ dispatch({type:"DELETE_EQ",payload:id}); setDetail(null); }};

  /* Fixed rowStyle - correct colors per status */
  const rowStyle = (status) => {
    if(status==="Out of Service / Deadline")     return { bg:"#fff5f5", borderColor:"#ef4444", leftBorder:"4px solid #ef4444" };
    if(status==="Operational with Deficiencies") return { bg:"#fffdf0", borderColor:"#f59e0b", leftBorder:"4px solid #f59e0b" };
    if(status==="No Status")                     return { bg:"#f9fafb", borderColor:"#d1d5db", leftBorder:"4px solid #d1d5db" };
    return { bg:"#f0fdf4", borderColor:"#86efac", leftBorder:"4px solid #22c55e" };
  };

  /* EqForm as a render function (NOT a component) to fix the typing/remount bug */
  const addCategory = () => {
    if(!newCat.trim()) return;
    dispatch({ type:"ADD_CATEGORY", payload:newCat.trim() });
    setForm(f=>({...f, category:newCat.trim()}));
    setNewCat("");
    setShowNewCat(false);
  };

  const renderEqForm = () => {
    const categories = state.categories || [];
    return (
    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"0 16px" }}>
      <Field label="Equipment Name">
        <input style={inp} value={form.name||""} onChange={e=>setForm(f=>({...f,name:e.target.value}))} placeholder="e.g. John Deere Zero-Turn" />
      </Field>
      <Field label="Equipment #" half>
        <input style={inp} value={form.id||""} onChange={e=>setForm(f=>({...f,id:e.target.value}))} placeholder="e.g. EQ-005" />
      </Field>
      <Field label="EIL #" half>
        <input style={inp} value={form.eilNumber||""} onChange={e=>setForm(f=>({...f,eilNumber:e.target.value}))} placeholder="EE#" />
      </Field>

      {/* Category dropdown with Create New */}
      <div style={{ marginBottom:14, gridColumn:"span 1" }}>
        <label style={{ display:"block", fontFamily:T.sans, fontSize:12, fontWeight:600, color:T.subtext, marginBottom:5 }}>Category</label>
        <select style={sel} value={form.category||""} onChange={e=>{ if(e.target.value==="__new__"){ setShowNewCat(true); } else { setForm(f=>({...f,category:e.target.value})); }}}>
          <option value="">-- Select Category --</option>
          {categories.map(c=><option key={c} value={c}>{c}</option>)}
          <option value="__new__">+ Create New Category...</option>
        </select>
        {showNewCat && (
          <div style={{ display:"flex", gap:6, marginTop:6 }}>
            <input style={{ ...inp, flex:1 }} placeholder="New category name..." value={newCat} onChange={e=>setNewCat(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addCategory()} autoFocus />
            <Btn small onClick={addCategory}>Add</Btn>
            <Btn small variant="secondary" onClick={()=>{ setShowNewCat(false); setNewCat(""); }}>Cancel</Btn>
          </div>
        )}
      </div>

      <Field label="Status" half>
        <select style={sel} value={form.status||"Fully Operational"} onChange={e=>setForm(f=>({...f,status:e.target.value}))}>
          {EQ_STATUSES.map(s=><option key={s}>{s}</option>)}
        </select>
      </Field>
      <Field label="Make" half>
        <input style={inp} value={form.make||""} onChange={e=>setForm(f=>({...f,make:e.target.value}))} />
      </Field>
      <Field label="Model" half>
        <input style={inp} value={form.model||""} onChange={e=>setForm(f=>({...f,model:e.target.value}))} />
      </Field>
      <Field label="Year" half>
        <input style={inp} type="number" value={form.year||""} onChange={e=>setForm(f=>({...f,year:e.target.value}))} />
      </Field>
      <Field label="Serial Number" half>
        <input style={inp} value={form.serial||""} onChange={e=>setForm(f=>({...f,serial:e.target.value}))} />
      </Field>
      <Field label="Location" half>
        <input style={inp} list="equipment-location-list" value={form.location||""} onChange={e=>setForm(f=>({...f,location:e.target.value}))} placeholder="Select or type location..." />
        <datalist id="equipment-location-list">
          {[...new Set([...(state.settings?.locations||[]), ...(state.equipment||[]).map(e=>e.location).filter(Boolean)])].map(l=><option key={l} value={l} />)}
        </datalist>
      </Field>
      <Field label="Acquisition Date" half>
        <input style={inp} type="date" value={form.acquisitionDate||""} onChange={e=>setForm(f=>({...f,acquisitionDate:e.target.value}))} />
      </Field>
      <Field label="Purchase Price ($)" half>
        <input style={inp} type="number" value={form.acquisitionCost||""} onChange={e=>setForm(f=>({...f,acquisitionCost:e.target.value}))} placeholder="0.00" />
      </Field>
      <Field label="Warranty Start Date" half>
        <input style={inp} type="date" value={form.warrantyStart||""} onChange={e=>setForm(f=>({...f,warrantyStart:e.target.value}))} />
      </Field>
      <Field label="Warranty End Date" half>
        <input style={inp} type="date" value={form.warrantyEnd||""} onChange={e=>setForm(f=>({...f,warrantyEnd:e.target.value}))} />
      </Field>

      {/* Usage Tracking Toggle */}
      <div style={{ gridColumn:"span 2", marginBottom:14, background:T.grayLt, borderRadius:8, padding:"12px 14px", border:`1px solid ${T.border}` }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom: form.trackUsage ? 10 : 0 }}>
          <div>
            <div style={{ fontFamily:T.sans, fontSize:13, fontWeight:600, color:T.text }}>Usage Tracking</div>
            <div style={{ fontFamily:T.sans, fontSize:11, color:T.muted, marginTop:2 }}>Track hours, mileage, and fuel for this equipment</div>
          </div>
          <button type="button" onClick={()=>setForm(f=>({...f,trackUsage:!f.trackUsage}))} style={{ width:44, height:24, borderRadius:12, border:"none", background:form.trackUsage?T.accent:"#d1d5db", cursor:"pointer", position:"relative", transition:"background .2s", flexShrink:0 }}>
            <span style={{ position:"absolute", top:3, left:form.trackUsage?22:3, width:18, height:18, borderRadius:"50%", background:"#fff", transition:"left .2s", display:"block", boxShadow:"0 1px 3px rgba(0,0,0,.2)" }}/>
          </button>
        </div>
        {form.trackUsage && (
          <div>
            <label style={{ fontFamily:T.sans, fontSize:12, fontWeight:600, color:T.subtext, marginBottom:6, display:"block" }}>Track by</label>
            <div style={{ display:"flex", gap:8 }}>
              {[["hours","Engine Hours"],["mileage","Mileage (Odometer)"],["both","Hours & Mileage"]].map(([v,l])=>(
                <button key={v} type="button" onClick={()=>setForm(f=>({...f,usageType:v}))} style={{ padding:"5px 12px", borderRadius:6, border:`1px solid ${form.usageType===v?T.accent:T.border}`, background:form.usageType===v?T.accentLt:"#fff", color:form.usageType===v?T.accent:T.subtext, cursor:"pointer", fontFamily:T.sans, fontSize:12, fontWeight:form.usageType===v?600:400 }}>{l}</button>
              ))}
            </div>
          </div>
        )}
      </div>

      {(form.status==="Operational with Deficiencies"||form.status==="Out of Service / Deadline") && (<>
        <Field label="Fault Date" half>
          <input style={inp} type="date" value={form.faultDate||""} onChange={e=>setForm(f=>({...f,faultDate:e.target.value}))} />
        </Field>
        <Field label="Fault Description">
          <textarea style={{ ...inp, minHeight:70, resize:"vertical" }} value={form.faultDescription||""} onChange={e=>setForm(f=>({...f,faultDescription:e.target.value}))} placeholder="Describe the fault or deficiency..." />
        </Field>
      </>)}
      <Field label="Notes">
        <textarea style={{ ...inp, minHeight:60, resize:"vertical" }} value={form.notes||""} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} />
      </Field>
      <div style={{ gridColumn:"span 2", marginBottom:14 }}>
        <DocUploader label="Documents Folder (purchase receipts, inspections, manuals, repairs, etc.)" category="General" documents={form.documents||[]} onChange={docs=>setForm(f=>({...f,documents:docs}))} />
      </div>
    </div>
    );
  };

  /* -- Detail view -- */
  if(detail) {
    const eq  = state.equipment.find(e=>e.id===detail);
    if(!eq){ setDetail(null); return null; }
    const wos    = woForEq(eq);
    const rs     = rowStyle(eq.status);
    const isOOS  = eq.status==="Out of Service / Deadline";
    const isDef  = eq.status==="Operational with Deficiencies";
    const editing = modal==="editing";

    return (
      <div>
        {/* Back button */}
        <button onClick={()=>{ setDetail(null); setModal(null); }} style={{ background:"none", border:"none", color:T.accent, cursor:"pointer", fontFamily:T.sans, fontSize:13, fontWeight:500, marginBottom:16, padding:0, display:"flex", alignItems:"center", gap:4 }}>
          ← Back to Equipment List
        </button>

        {/* -- EDIT MODE — fields open inline -- */}
        {editing ? (
          <Card style={{ borderLeft:rs.leftBorder }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20, flexWrap:"wrap", gap:8 }}>
              <div>
                <h3 style={{ margin:0, fontFamily:T.sans, fontSize:18, fontWeight:700, color:T.text }}>Editing: {eq.name}</h3>
                <p style={{ margin:"3px 0 0", fontFamily:T.mono, fontSize:11, color:T.muted }}>{eq.id}</p>
              </div>
              <div style={{ display:"flex", gap:8 }}>
                <Btn variant="secondary" small onClick={()=>setModal(null)}>Cancel</Btn>
                <Btn small onClick={save}>Save Changes</Btn>
              </div>
            </div>
            { renderEqForm() }
            <div style={{ display:"flex", gap:8, justifyContent:"flex-end", marginTop:8, paddingTop:16, borderTop:`1px solid ${T.border}` }}>
              <Btn variant="secondary" onClick={()=>setModal(null)}>Cancel</Btn>
              <Btn onClick={save}>Save Changes</Btn>
            </div>
          </Card>
        ) : (

        /* -- VIEW MODE -- */
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }}>

          {/* Header card */}
          <Card style={{ gridColumn:"span 2", borderLeft:rs.leftBorder }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", flexWrap:"wrap", gap:12 }}>
              <div>
                <div style={{ display:"flex", gap:8, alignItems:"center", marginBottom:6, flexWrap:"wrap" }}>
                  <span style={{ fontFamily:T.mono, fontSize:11, color:T.muted }}>{eq.id}</span>
                  {eq.eilNumber && <span style={{ fontFamily:T.mono, fontSize:11, color:T.muted }}>· EIL: {eq.eilNumber}</span>}
                  <Badge label={eq.status} />
                </div>
                <h2 style={{ margin:0, fontFamily:T.sans, fontSize:22, fontWeight:700, color:T.text }}>{eq.name}</h2>
                <p style={{ margin:"4px 0 0", fontFamily:T.sans, fontSize:14, color:T.subtext }}>{eq.year} {eq.make} {eq.model} · Serial: {eq.serial}</p>
              </div>
              <div style={{ display:"flex", gap:8 }}>
                <Btn small onClick={()=>openEdit(eq)}>✏ Edit</Btn>
                <Btn small variant="danger" onClick={()=>del(eq.id)}>Delete</Btn>
              </div>
            </div>

            {/* Fault banner */}
            {(isOOS||isDef) && (
              <div style={{ marginTop:14, padding:"12px 14px", background:isOOS?"#fef2f2":"#fffbeb", border:`1px solid ${isOOS?"#fca5a5":"#fcd34d"}`, borderRadius:7 }}>
                <div style={{ display:"flex", gap:24, flexWrap:"wrap", alignItems:"flex-start" }}>
                  <div>
                    <div style={{ fontFamily:T.sans, fontSize:11, fontWeight:600, color:T.muted, textTransform:"uppercase", letterSpacing:.4, marginBottom:3 }}>Fault Date</div>
                    <div style={{ fontFamily:T.mono, fontSize:14, fontWeight:700, color:isOOS?T.red:T.amber }}>{eq.faultDate||"—"}</div>
                  </div>
                  <div style={{ flex:1 }}>
                    <div style={{ fontFamily:T.sans, fontSize:11, fontWeight:600, color:T.muted, textTransform:"uppercase", letterSpacing:.4, marginBottom:3 }}>Fault Description</div>
                    <div style={{ fontFamily:T.sans, fontSize:13, color:T.text }}>{eq.faultDescription||"No description provided."}</div>
                  </div>
                </div>
              </div>
            )}
          </Card>

          {/* Details */}
          <Card>
            <h4 style={{ margin:"0 0 14px", fontFamily:T.sans, fontSize:12, fontWeight:700, color:T.muted, textTransform:"uppercase", letterSpacing:.4 }}>Equipment Details</h4>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"12px 20px" }}>
              {[["Type",eq.type],["Location",eq.location],["Serial Number",eq.serial],["EIL #",eq.eilNumber],["Year",eq.year],["Make",eq.make],["Model",eq.model],["Acquisition Date",eq.acquisitionDate],["Purchase Price",eq.acquisitionCost?`$${Number(eq.acquisitionCost).toLocaleString()}`:"—"],["Warranty Start",eq.warrantyStart],["Warranty End",eq.warrantyEnd]].map(([k,v])=>(
                <div key={k}>
                  <div style={{ fontFamily:T.sans, fontSize:11, fontWeight:600, color:T.muted, textTransform:"uppercase", letterSpacing:.4 }}>{k}</div>
                  <div style={{ fontFamily:T.sans, fontSize:13, color:T.text, marginTop:3 }}>{v||"—"}</div>
                </div>
              ))}
            </div>
            {eq.notes && (
              <div style={{ marginTop:14, paddingTop:12, borderTop:`1px solid ${T.border}` }}>
                <div style={{ fontFamily:T.sans, fontSize:11, fontWeight:600, color:T.muted, textTransform:"uppercase", letterSpacing:.4, marginBottom:5 }}>Notes</div>
                <div style={{ fontFamily:T.sans, fontSize:13, color:T.subtext }}>{eq.notes}</div>
              </div>
            )}
          </Card>

          {/* Stats */}
          <Card>
            <h4 style={{ margin:"0 0 14px", fontFamily:T.sans, fontSize:12, fontWeight:700, color:T.muted, textTransform:"uppercase", letterSpacing:.4 }}>Service Stats</h4>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
              {[
                ["Total WOs",    wos.length, T.text],
                ["Open WOs",     wos.filter(w=>w.status==="Open").length, T.amber],
                ["Total Spent",  "$"+wos.reduce((s,w)=>s+(+w.laborCost||0)+(+w.partsCost||0),0).toLocaleString(), T.accent],
                ["Labor Hours",  wos.reduce((s,w)=>s+(+w.laborHours||0),0)+"h", T.text],
              ].map(([k,v,c])=>(
                <div key={k} style={{ background:T.grayLt, borderRadius:7, padding:"12px 14px", border:`1px solid ${T.border}` }}>
                  <div style={{ fontFamily:T.sans, fontSize:22, fontWeight:700, color:c }}>{v}</div>
                  <div style={{ fontFamily:T.sans, fontSize:11, color:T.muted, marginTop:3 }}>{k}</div>
                </div>
              ))}
            </div>
          </Card>

          {/* Work Order History */}
          <Card style={{ gridColumn:"span 2" }}>
            <h4 style={{ margin:"0 0 14px", fontFamily:T.sans, fontSize:12, fontWeight:700, color:T.muted, textTransform:"uppercase", letterSpacing:.4 }}>Work Order History</h4>
            {wos.length===0
              ? <p style={{ margin:0, fontFamily:T.sans, fontSize:13, color:T.muted }}>No work orders for this equipment.</p>
              : <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13, fontFamily:T.sans }}>
                  <thead>
                    <tr style={{ background:T.grayLt, borderBottom:`1px solid ${T.border}` }}>
                      {["WO #","Title","Status","Priority","Date","Cost"].map(h=>(
                        <th key={h} style={{ padding:"8px 12px", textAlign:"left", fontWeight:600, fontSize:11, color:T.muted, textTransform:"uppercase", letterSpacing:.4 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {wos.map((wo,i)=>(
                      <tr key={wo.id} style={{ borderBottom:`1px solid ${T.border}`, background:i%2===0?"#fff":T.grayLt }}>
                        <td style={{ padding:"9px 12px", fontFamily:T.mono, fontSize:11, color:T.muted }}>{wo.id}</td>
                        <td style={{ padding:"9px 12px", fontWeight:500, color:T.text }}>{wo.title}</td>
                        <td style={{ padding:"9px 12px" }}><Badge label={wo.status} /></td>
                        <td style={{ padding:"9px 12px" }}><Badge label={wo.priority} type="priority" /></td>
                        <td style={{ padding:"9px 12px", fontFamily:T.mono, fontSize:12, color:T.subtext }}>{wo.created}</td>
                        <td style={{ padding:"9px 12px", fontFamily:T.mono, fontSize:12, color:T.subtext }}>${(+wo.laborCost||0)+(+wo.partsCost||0)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
            }
          </Card>

          {/* Attachments / Implements */}
          <AttachmentsCard eq={eq} dispatch={dispatch} />

          {/* Documents Folder */}
          <Card style={{ marginTop:16 }}>
            <h4 style={{ margin:"0 0 14px", fontFamily:T.sans, fontSize:12, fontWeight:700, color:T.muted, textTransform:"uppercase", letterSpacing:.4 }}>📁 Documents Folder ({(eq.documents||[]).length})</h4>
            <DocUploader
              label=""
              category="General"
              documents={eq.documents||[]}
              onChange={docs=>dispatch({type:"UPDATE_EQ",payload:{...eq,documents:docs}})}
            />
          </Card>

        </div>
        )}
      </div>
    );
  }

  /* -- List view -- */
  return (
    <div>
      <Card style={{ marginBottom:16 }}>
        <div style={{ display:"flex", gap:10, marginBottom:14, flexWrap:"wrap" }}>
          <input style={{ ...inp, flex:1, minWidth:200 }} placeholder="Search by name, make, model, serial, EIL #, location…" value={search} onChange={e=>setSearch(e.target.value)} />
          <Btn variant="secondary" onClick={()=>{
            const reportEqs = state.equipment.filter(e=>e.status==="Out of Service / Deadline"||e.status==="Operational with Deficiencies");
            const exportRows = reportEqs.map(e=>({Status:e.status||"", Name:e.name||"", "Make/Model":`${e.make||""} ${e.model||""}`.trim(), "Serial #":e.serial||"", "EIL #":e.eilNumber||"", "Fault Date":e.faultDate||"", "Fault Description":e.faultDescription||""}));
            const win = window.open("","_blank");
            win.document.write(`<html><head><title>Equipment Status Report</title><style>body{font-family:Arial,sans-serif;padding:24px;color:#111}h1{font-size:20px;margin-bottom:4px}p{font-size:12px;color:#666;margin:0 0 20px}.section{margin-bottom:28px}h2{font-size:14px;margin-bottom:8px;padding:6px 10px;border-radius:4px}table{width:100%;border-collapse:collapse;font-size:12px}th{background:#f3f4f6;padding:7px 10px;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:.4px}td{padding:7px 10px;border-bottom:1px solid #e5e7eb}.red{background:#fef2f2;color:#7f1d1d}.yellow{background:#fffbeb;color:#92400e}@media print{button{display:none}}</style></head><body>`);
            win.document.write(`<h1>Equipment Status Report</h1><p>Generated: ${new Date().toLocaleDateString()} — NCA Maintenance Manager</p>`);
            const oos = reportEqs.filter(e=>e.status==="Out of Service / Deadline");
            const def = reportEqs.filter(e=>e.status==="Operational with Deficiencies");
            if(oos.length){
              win.document.write(`<div class="section"><h2 class="red">🚨 Out of Service / Deadline (${oos.length})</h2><table><tr><th>Name</th><th>Make/Model</th><th>Serial #</th><th>EIL #</th><th>Fault Date</th><th>Fault Description</th></tr>`);
              oos.forEach(e=>win.document.write(`<tr><td><b>${e.name}</b></td><td>${e.make||""} ${e.model||""}</td><td>${e.serial||"—"}</td><td>${e.eilNumber||"—"}</td><td>${e.faultDate||"—"}</td><td>${e.faultDescription||"—"}</td></tr>`));
              win.document.write(`</table></div>`);
            }
            if(def.length){
              win.document.write(`<div class="section"><h2 class="yellow">⚠️ Operational with Deficiencies (${def.length})</h2><table><tr><th>Name</th><th>Make/Model</th><th>Serial #</th><th>EIL #</th><th>Fault Date</th><th>Fault Description</th></tr>`);
              def.forEach(e=>win.document.write(`<tr><td><b>${e.name}</b></td><td>${e.make||""} ${e.model||""}</td><td>${e.serial||"—"}</td><td>${e.eilNumber||"—"}</td><td>${e.faultDate||"—"}</td><td>${e.faultDescription||"—"}</td></tr>`));
              win.document.write(`</table></div>`);
            }
            if(!oos.length&&!def.length) win.document.write(`<p>No equipment in deadline or deficiency status.</p>`);
            win.document.write(reportButtonsHtml(exportRows)+`</body></html>`);
            win.document.close();
          }}>🖨 Deadline Report</Btn>
          <Btn onClick={openAdd}>+ Add New Equipment</Btn>
        </div>
        <div style={{ display:"flex", gap:16, flexWrap:"wrap", alignItems:"flex-end" }}>
          <span style={{ fontFamily:T.sans, fontSize:12, fontWeight:600, color:T.muted, paddingBottom:6 }}>Filter by:</span>
          {[
            ["Status",  EQ_STATUSES, statusF,   setStatusF,   230],
            ["Type",    types,        typeF,     setTypeF,     160],
            ["Location",locations,    locationF, setLocationF, 160],
          ].map(([label, opts, val, set, width])=>(
            <div key={label} style={{ display:"flex", flexDirection:"column", gap:4 }}>
              <label style={{ fontFamily:T.sans, fontSize:11, fontWeight:600, color:T.muted, textTransform:"uppercase", letterSpacing:.4 }}>{label}</label>
              <select style={{ ...sel, width }} value={val} onChange={e=>set(e.target.value)}>
                <option value="All">— Select —</option>
                {opts.map(o=><option key={o} value={o}>{o}</option>)}
              </select>
            </div>
          ))}
          {(statusF!=="All"||typeF!=="All"||locationF!=="All") && (
            <button onClick={()=>{setStatusF("All");setTypeF("All");setLocationF("All");}} style={{ background:"none", border:"none", color:T.accent, fontFamily:T.sans, fontSize:12, fontWeight:600, cursor:"pointer", padding:"0 0 6px", alignSelf:"flex-end" }}>
              ✕ Clear filters
            </button>
          )}
        </div>
      </Card>

      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10, flexWrap:"wrap", gap:8 }}>
        <div style={{ fontFamily:T.sans, fontSize:12, color:T.muted }}>
          Showing <strong style={{ color:T.text }}>{filtered.length}</strong> of <strong style={{ color:T.text }}>{state.equipment.length}</strong> equipment
        </div>
        <div style={{ display:"flex", gap:16, flexWrap:"wrap" }}>
          {[["#22c55e","Fully Operational"],["#f59e0b","Operational w/ Deficiencies"],["#ef4444","Out of Service / Deadline"],["#d1d5db","No Status"]].map(([c,l])=>(
            <div key={l} style={{ display:"flex", alignItems:"center", gap:5 }}>
              <span style={{ width:10, height:10, borderRadius:2, background:c, flexShrink:0, display:"inline-block" }}/>
              <span style={{ fontFamily:T.sans, fontSize:11, color:T.subtext }}>{l}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
        {filtered.map(eq=>{
          const rs    = rowStyle(eq.status);
          const isOOS = eq.status==="Out of Service / Deadline";
          const isDef = eq.status==="Operational with Deficiencies";
          const hasFault     = isOOS||isDef;
          const attachments  = eq.attachments||[];
          const hasAttach    = attachments.length>0;
          const isExpanded   = !!expandedAt[eq.id];

          return (
            <div key={eq.id} style={{ display:"flex", flexDirection:"column", gap:0 }}>
              {/* ── Main Equipment Row ── */}
              <div onClick={()=>setDetail(eq.id)} style={{ background:rs.bg, border:`1px solid ${hasFault?rs.borderColor:T.border}`, borderLeft:rs.leftBorder, borderRadius:isExpanded&&hasAttach?"8px 8px 0 0":8, cursor:"pointer", overflow:"hidden", boxShadow:T.shadow }}>

                <div style={{ overflowX:"auto" }}>
                  <div style={{ display:"flex", alignItems:"center", padding:"14px 18px", gap:0, minWidth:720 }}>

                    <div style={{ width:90, flexShrink:0, marginRight:20 }}>
                      <div style={{ fontFamily:T.sans, fontSize:10, fontWeight:600, color:T.muted, textTransform:"uppercase", letterSpacing:.4 }}>Equip #</div>
                      <div style={{ fontFamily:T.mono, fontSize:12, color:T.subtext, marginTop:3 }}>{eq.id}</div>
                    </div>

                    <div style={{ flex:1, minWidth:180, marginRight:20 }}>
                      <div style={{ fontFamily:T.sans, fontSize:10, fontWeight:600, color:T.muted, textTransform:"uppercase", letterSpacing:.4 }}>Equipment Name</div>
                      <div style={{ fontFamily:T.sans, fontSize:14, fontWeight:700, color:T.text, marginTop:3 }}>{eq.name}</div>
                      <div style={{ fontFamily:T.sans, fontSize:11, color:T.muted, marginTop:1 }}>{eq.type||""}</div>
                    </div>

                    <div style={{ width:120, flexShrink:0, marginRight:20 }}>
                      <div style={{ fontFamily:T.sans, fontSize:10, fontWeight:600, color:T.muted, textTransform:"uppercase", letterSpacing:.4 }}>Make</div>
                      <div style={{ fontFamily:T.sans, fontSize:13, color:T.subtext, marginTop:3 }}>{eq.make||"—"}</div>
                    </div>

                    <div style={{ width:120, flexShrink:0, marginRight:20 }}>
                      <div style={{ fontFamily:T.sans, fontSize:10, fontWeight:600, color:T.muted, textTransform:"uppercase", letterSpacing:.4 }}>Model</div>
                      <div style={{ fontFamily:T.sans, fontSize:13, color:T.subtext, marginTop:3 }}>{eq.model||"—"}</div>
                    </div>

                    <div style={{ width:160, flexShrink:0, marginRight:20 }}>
                      <div style={{ fontFamily:T.sans, fontSize:10, fontWeight:600, color:T.muted, textTransform:"uppercase", letterSpacing:.4 }}>Serial #</div>
                      <div style={{ fontFamily:T.mono, fontSize:12, color:T.subtext, marginTop:3 }}>{eq.serial||"—"}</div>
                    </div>

                    <div style={{ width:110, flexShrink:0, marginRight:20 }}>
                      <div style={{ fontFamily:T.sans, fontSize:10, fontWeight:600, color:T.muted, textTransform:"uppercase", letterSpacing:.4 }}>EIL #</div>
                      <div style={{ fontFamily:T.mono, fontSize:12, color:T.subtext, marginTop:3 }}>{eq.eilNumber||"—"}</div>
                    </div>

                    <div style={{ flexShrink:0, display:"flex", alignItems:"center", gap:8, marginLeft:"auto" }}>
                      <Badge label={eq.status} />
                      {/* Attachment toggle button */}
                      {hasAttach && (
                        <button onClick={e=>toggleAttachments(eq.id,e)} style={{ display:"flex", alignItems:"center", gap:4, padding:"4px 10px", borderRadius:6, border:`1px solid ${T.border}`, background:isExpanded?T.accentLt:"#fff", color:isExpanded?T.accent:T.subtext, fontFamily:T.sans, fontSize:11, fontWeight:600, cursor:"pointer" }}>
                          {isExpanded?"▲":"▼"} {attachments.length} Attach.
                        </button>
                      )}
                      <span style={{ color:T.muted, fontSize:18, lineHeight:1 }}>›</span>
                    </div>
                  </div>
                </div>

                {/* Fault bar */}
                {hasFault && (
                  <div style={{ borderTop:`1px solid ${isOOS?"#fca5a5":"#fcd34d"}`, background:isOOS?"#fef2f2":"#fffbeb", padding:"10px 18px", display:"flex", gap:24, flexWrap:"wrap", alignItems:"center" }}>
                    <div style={{ display:"flex", alignItems:"center", gap:10, flexShrink:0 }}>
                      <span style={{ fontSize:16 }}>{isOOS?"🚨":"⚠️"}</span>
                      <div>
                        <div style={{ fontFamily:T.sans, fontSize:10, fontWeight:600, color:isOOS?T.red:T.amber, textTransform:"uppercase", letterSpacing:.4 }}>Fault Date</div>
                        <div style={{ fontFamily:T.mono, fontSize:13, fontWeight:700, color:isOOS?T.red:T.amber, marginTop:2 }}>{eq.faultDate||"Not recorded"}</div>
                      </div>
                    </div>
                    {eq.faultDescription && (
                      <div style={{ flex:1, minWidth:180 }}>
                        <div style={{ fontFamily:T.sans, fontSize:10, fontWeight:600, color:T.muted, textTransform:"uppercase", letterSpacing:.4 }}>Fault Description</div>
                        <div style={{ fontFamily:T.sans, fontSize:12, color:T.text, marginTop:2, lineHeight:1.5 }}>{eq.faultDescription}</div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* ── Attachment Sub-Rows (dropdown) ── */}
              {isExpanded && hasAttach && (
                <div style={{ border:`1px solid ${T.accent}44`, borderTop:"none", borderRadius:"0 0 8px 8px", overflow:"hidden", background:"#f8fbff" }}>
                  {/* Header */}
                  <div style={{ padding:"6px 18px 6px 108px", background:T.accentLt, borderBottom:`1px solid ${T.accent}22`, display:"flex", alignItems:"center", gap:8 }}>
                    <span style={{ fontFamily:T.sans, fontSize:10, fontWeight:700, color:T.accent, textTransform:"uppercase", letterSpacing:.8 }}>Attachments / Implements</span>
                    <span style={{ fontFamily:T.mono, fontSize:10, color:T.muted }}>({attachments.length})</span>
                  </div>

                  {attachments.map((at, atIdx)=>(
                    <div key={at.id} onClick={e=>{ e.stopPropagation(); setAttachDetail({eq, at}); }} style={{ display:"flex", alignItems:"center", padding:"10px 18px 10px 108px", borderBottom:atIdx<attachments.length-1?`1px solid ${T.border}`:"none", cursor:"pointer", gap:0, transition:"background .12s" }}
                      onMouseEnter={e=>e.currentTarget.style.background=T.accentLt}
                      onMouseLeave={e=>e.currentTarget.style.background="transparent"}>

                      {/* Attach icon */}
                      <div style={{ width:28, flexShrink:0, marginRight:16, color:T.accent, fontSize:16 }}>🔗</div>

                      <div style={{ width:90, flexShrink:0, marginRight:20 }}>
                        <div style={{ fontFamily:T.sans, fontSize:9, fontWeight:600, color:T.muted, textTransform:"uppercase", letterSpacing:.4 }}>Attach #</div>
                        <div style={{ fontFamily:T.mono, fontSize:11, color:T.subtext, marginTop:2 }}>{at.id}</div>
                      </div>

                      <div style={{ flex:1, minWidth:160, marginRight:20 }}>
                        <div style={{ fontFamily:T.sans, fontSize:9, fontWeight:600, color:T.muted, textTransform:"uppercase", letterSpacing:.4 }}>Name</div>
                        <div style={{ fontFamily:T.sans, fontSize:13, fontWeight:600, color:T.text, marginTop:2 }}>{at.name}</div>
                      </div>

                      <div style={{ width:120, flexShrink:0, marginRight:20 }}>
                        <div style={{ fontFamily:T.sans, fontSize:9, fontWeight:600, color:T.muted, textTransform:"uppercase", letterSpacing:.4 }}>Make</div>
                        <div style={{ fontFamily:T.sans, fontSize:12, color:T.subtext, marginTop:2 }}>{at.make||"—"}</div>
                      </div>

                      <div style={{ width:120, flexShrink:0, marginRight:20 }}>
                        <div style={{ fontFamily:T.sans, fontSize:9, fontWeight:600, color:T.muted, textTransform:"uppercase", letterSpacing:.4 }}>Model</div>
                        <div style={{ fontFamily:T.sans, fontSize:12, color:T.subtext, marginTop:2 }}>{at.model||"—"}</div>
                      </div>

                      <div style={{ width:160, flexShrink:0, marginRight:20 }}>
                        <div style={{ fontFamily:T.sans, fontSize:9, fontWeight:600, color:T.muted, textTransform:"uppercase", letterSpacing:.4 }}>Serial #</div>
                        <div style={{ fontFamily:T.mono, fontSize:11, color:T.subtext, marginTop:2 }}>{at.serial||"—"}</div>
                      </div>

                      <div style={{ width:110, flexShrink:0, marginRight:20 }}>
                        <div style={{ fontFamily:T.sans, fontSize:9, fontWeight:600, color:T.muted, textTransform:"uppercase", letterSpacing:.4 }}>EIL #</div>
                        <div style={{ fontFamily:T.mono, fontSize:11, color:T.subtext, marginTop:2 }}>{at.eilNumber||"—"}</div>
                      </div>

                      <span style={{ color:T.accent, fontSize:16, marginLeft:"auto" }}>›</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
        {filtered.length===0 && (
          <div style={{ padding:48, textAlign:"center", color:T.muted, fontFamily:T.sans, fontSize:13, background:"#fff", borderRadius:8, border:`1px solid ${T.border}` }}>
            No equipment matches your filters.
          </div>
        )}
      </div>

      {/* ── Attachment Detail Modal ── */}
      {attachDetail && (
        <Modal title={`Attachment — ${attachDetail.at.name}`} onClose={()=>setAttachDetail(null)}>
          <div style={{ background:T.accentLt, border:`1px solid ${T.accent}44`, borderRadius:8, padding:"8px 14px", marginBottom:14 }}>
            <div style={{ fontFamily:T.sans, fontSize:11, color:T.accent, fontWeight:600 }}>
              🔗 Attached to: {attachDetail.eq.name} ({attachDetail.eq.id})
            </div>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"10px 20px" }}>
            {[
              ["Attachment #",   attachDetail.at.id],
              ["EIL #",          attachDetail.at.eilNumber],
              ["Make",           attachDetail.at.make],
              ["Model",          attachDetail.at.model],
              ["Serial Number",  attachDetail.at.serial],
              ["Acquisition Date", attachDetail.at.acquisitionDate],
              ["Purchase Price", attachDetail.at.acquisitionCost ? `$${Number(attachDetail.at.acquisitionCost).toLocaleString()}` : "—"],
            ].map(([k,v])=>(
              <div key={k}>
                <div style={{ fontFamily:T.sans, fontSize:11, fontWeight:600, color:T.muted, textTransform:"uppercase", letterSpacing:.4 }}>{k}</div>
                <div style={{ fontFamily:T.sans, fontSize:14, color:T.text, marginTop:4, fontWeight:500 }}>{v||"—"}</div>
              </div>
            ))}
          </div>
          {attachDetail.at.notes && (
            <div style={{ marginTop:14, paddingTop:12, borderTop:`1px solid ${T.border}` }}>
              <div style={{ fontFamily:T.sans, fontSize:11, fontWeight:600, color:T.muted, textTransform:"uppercase", letterSpacing:.4, marginBottom:5 }}>Notes</div>
              <div style={{ fontFamily:T.sans, fontSize:13, color:T.subtext }}>{attachDetail.at.notes}</div>
            </div>
          )}
          <div style={{ display:"flex", justifyContent:"flex-end", marginTop:16 }}>
            <Btn variant="secondary" onClick={()=>setAttachDetail(null)}>Close</Btn>
          </div>
        </Modal>
      )}

      {modal==="add" && (
        <Modal title="Add New Equipment" onClose={()=>setModal(null)}>
          { renderEqForm() }
          <div style={{ display:"flex", gap:8, justifyContent:"flex-end", marginTop:4 }}>
            <Btn variant="secondary" onClick={()=>setModal(null)}>Cancel</Btn>
            <Btn onClick={save}>Save Equipment</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}


function Parts({ state, dispatch }) {
  const [modal, setModal]       = useState(null);
  const [form, setForm]         = useState({});
  const [search, setSearch]     = useState("");
  const [catF, setCatF]         = useState("All");
  const [expanded, setExpanded] = useState(null);
  const [invUpdate, setInvUpdate] = useState(null);
  const [poForm, setPoForm]     = useState({ poNumber:"", vendor:"", date:today(), parts:[{name:"",partNumber:"",category:"",qty:"",unitCost:"",location:"",equipmentId:"",modelFit:""}] });
  const F = k => e => setForm(f=>({...f,[k]:e.target.value}));

  const cats     = ["All",...new Set(state.parts.map(p=>p.category).filter(Boolean))];
  const filtered = state.parts.filter(p=>{
    const mc = catF==="All"||p.category===catF;
    const ms = `${p.name} ${p.partNumber||""} ${p.vendor||""} ${p.modelFit||""} ${p.equipmentId||""}`.toLowerCase().includes(search.toLowerCase());
    return mc&&ms;
  }).sort((a,b)=>(a.partNumber||"").localeCompare(b.partNumber||""));

  const totalVal = state.parts.reduce((s,p)=>s+(+p.qty*(+p.unitCost||0)),0);
  const openAdd  = () => { setForm({qty:0,minQty:1,unitCost:0,lowStockAlert:true}); setModal("add"); };
  const openEdit = p  => { setForm({...p}); setModal(p); };
  const save = () => {
    if(!form.name) return alert("Name required.");
    modal==="add"
      ? dispatch({type:"ADD_PART",  payload:{...form,id:genId("PT")}})
      : dispatch({type:"UPDATE_PART",payload:form});
    setModal(null);
  };
  const del = id => { if(confirm("Delete part?")) dispatch({type:"DELETE_PART",payload:id}); };

  const openInvUpdate = () => {
    const map = {};
    state.parts.forEach(p=>{ map[p.id]=String(p.qty); });
    setInvUpdate(map);
  };
  const saveInvUpdate = () => {
    state.parts.forEach(p=>{
      if(invUpdate[p.id]!==undefined && +invUpdate[p.id]!==p.qty)
        dispatch({type:"UPDATE_PART",payload:{...p,qty:+invUpdate[p.id]}});
    });
    setInvUpdate(null);
  };

  const printInventory = () => {
    const win = window.open("","_blank","width=900,height=700");
    if(!win) return;
    win.document.write(`<!DOCTYPE html><html><head><title>Parts Inventory Report</title>
      <style>body{font-family:Arial,sans-serif;padding:24px}h1{font-size:18px;margin-bottom:4px}p{font-size:12px;color:#666;margin:0 0 16px}table{width:100%;border-collapse:collapse;font-size:12px}th{background:#1a1a2e;color:#fff;padding:6px 10px;text-align:left;font-size:10px;text-transform:uppercase}td{padding:6px 10px;border-bottom:1px solid #e5e7eb}.low{background:#fff5f5}.total-row{font-weight:700;background:#f3f4f6}@media print{button{display:none}}</style>
      </head><body>
      ${reportHeaderHTML(state, "Parts Inventory Report")}
      <p style="font-size:12px;color:#666;margin-bottom:12px">SKUs: ${state.parts.length} | Total Value: $${totalVal.toFixed(2)} | Low Stock: ${lowParts.length}</p>
      <table>
        <tr><th>Part #</th><th>Name</th><th>Category</th><th>Location</th><th>Equipment / Model</th><th style="text-align:right">Unit $</th><th style="text-align:right">Qty</th><th style="text-align:right">Total $</th><th>New Count</th></tr>
        ${state.parts.sort((a,b)=>(a.partNumber||"").localeCompare(b.partNumber||"")).map(p=>{
          const eq = p.equipmentId ? state.equipment.find(e=>e.id===p.equipmentId) : null;
          return `<tr class="${p.qty<=(p.minQty||0)?"low":""}"><td>${p.partNumber||"—"}</td><td>${p.name}</td><td>${p.category||"—"}</td><td>${p.location||"—"}</td><td>${eq?`${eq.name} (${eq.id})`:p.modelFit||"—"}</td><td style="text-align:right">$${(+p.unitCost||0).toFixed(2)}</td><td style="text-align:right">${p.qty}</td><td style="text-align:right">$${(p.qty*(+p.unitCost||0)).toFixed(2)}</td><td style="border-bottom:1px solid #bbb;min-width:80px">&nbsp;</td></tr>`;
        }).join("")}
        <tr class="total-row"><td colspan="7" style="text-align:right;padding:8px 10px">TOTAL INVENTORY VALUE</td><td style="text-align:right;padding:8px 10px">$${totalVal.toFixed(2)}</td><td></td></tr>
      </table>
      ${reportButtonsHtml(exportRows)}
      </body></html>`);
    win.document.close();
  };

  const savePO = () => {
    const valid = poForm.parts.filter(p=>p.name.trim());
    if(!valid.length) return alert("Add at least one part.");
    valid.forEach(p=>{
      const eq = state.equipment.find(e=>e.id===p.equipmentId);
      dispatch({type:"ADD_PART",payload:{...p,id:genId("PT"),qty:+p.qty||0,unitCost:+p.unitCost||0,minQty:1,lowStockAlert:true,vendor:poForm.vendor,poNumber:poForm.poNumber,dateReceived:poForm.date,modelFit:eq?`${eq.make||""} ${eq.model||""}`.trim():p.modelFit}});
    });
    setModal(null);
    setPoForm({poNumber:"",vendor:"",date:today(),parts:[{name:"",partNumber:"",category:"",qty:"",unitCost:"",location:"",equipmentId:"",modelFit:""}]});
  };
  const addPoRow = () => setPoForm(f=>({...f,parts:[...f.parts,{name:"",partNumber:"",category:"",qty:"",unitCost:"",location:"",equipmentId:"",modelFit:""}]}));
  const setPoRow = (i,k,v) => setPoForm(f=>{ const pts=[...f.parts]; pts[i]={...pts[i],[k]:v}; return {...f,parts:pts}; });
  const delPoRow = i => setPoForm(f=>{ const pts=[...f.parts]; pts.splice(i,1); return {...f,parts:pts}; });

  return (
    <div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(160px,1fr))", gap:12, marginBottom:16 }}>
        {[["Inventory Value","$"+totalVal.toLocaleString("en-US",{minimumFractionDigits:2}),T.accent],["Total SKUs",state.parts.length,T.text],["Low Stock",state.parts.filter(p=>p.lowStockAlert!==false&&p.qty<=(p.minQty||0)).length,T.red]].map(([l,v,c])=>(
          <Card key={l} style={{ padding:"14px 16px" }}>
            <div style={{ fontFamily:T.sans, fontSize:22, fontWeight:700, color:c }}>{v}</div>
            <div style={{ fontFamily:T.sans, fontSize:12, color:T.muted, marginTop:3 }}>{l}</div>
          </Card>
        ))}
      </div>
      <div style={{ display:"flex", justifyContent:"space-between", marginBottom:12, gap:8, flexWrap:"wrap" }}>
        <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
          <input style={{ ...inp, maxWidth:240 }} placeholder="Search parts..." value={search} onChange={e=>setSearch(e.target.value)} />
          <select style={{ ...sel, maxWidth:160 }} value={catF} onChange={e=>setCatF(e.target.value)}>{cats.map(c=><option key={c}>{c}</option>)}</select>
        </div>
        <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
          <Btn variant="secondary" onClick={printInventory}>Inventory Report</Btn>
          <Btn variant="secondary" onClick={openInvUpdate}>Inventory Update</Btn>
          <Btn variant="secondary" onClick={()=>setModal("po")}>+ Add Purchase (PO)</Btn>
          <Btn onClick={openAdd}>+ Add Part</Btn>
        </div>
      </div>

      {invUpdate && (
        <Card style={{ marginBottom:14, padding:0, overflow:"hidden" }}>
          <div style={{ background:T.accent, padding:"10px 16px", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
            <span style={{ fontFamily:T.sans, fontSize:13, fontWeight:700, color:"#fff" }}>Inventory Update — Enter current quantities on hand</span>
            <div style={{ display:"flex", gap:8 }}>
              <button onClick={()=>setInvUpdate(null)} style={{ background:"none", border:"1px solid #ffffff66", borderRadius:6, padding:"5px 12px", color:"#fff", cursor:"pointer", fontFamily:T.sans, fontSize:12, fontWeight:600 }}>Cancel</button>
              <button onClick={saveInvUpdate} style={{ background:"#fff", border:"none", borderRadius:6, padding:"5px 14px", color:T.accent, cursor:"pointer", fontFamily:T.sans, fontSize:12, fontWeight:700 }}>Save All</button>
            </div>
          </div>
          <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13, fontFamily:T.sans }}>
            <thead><tr style={{ background:T.grayLt, borderBottom:`1px solid ${T.border}` }}>
              {["Part #","Name","Location","System Qty","New Qty (on hand)"].map(h=><th key={h} style={{ padding:"8px 12px", textAlign:"left", fontSize:11, fontWeight:600, color:T.muted, textTransform:"uppercase", letterSpacing:.4 }}>{h}</th>)}
            </tr></thead>
            <tbody>
              {state.parts.map((p,i)=>(
                <tr key={p.id} style={{ borderBottom:`1px solid ${T.border}`, background:i%2===0?"#fff":T.grayLt }}>
                  <td style={{ padding:"8px 12px", fontFamily:T.mono, fontSize:12, color:T.muted }}>{p.partNumber||"—"}</td>
                  <td style={{ padding:"8px 12px", fontWeight:500 }}>{p.name}</td>
                  <td style={{ padding:"8px 12px", color:T.muted }}>{p.location||"—"}</td>
                  <td style={{ padding:"8px 12px", fontFamily:T.mono, fontSize:12 }}>{p.qty}</td>
                  <td style={{ padding:"8px 12px" }}>
                    <input style={{ ...inp, width:100, fontFamily:T.mono }} type="number" min="0"
                      value={invUpdate[p.id]??p.qty}
                      onChange={e=>setInvUpdate(prev=>({...prev,[p.id]:e.target.value}))} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <Card style={{ padding:0, overflow:"hidden" }}>
        <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13, fontFamily:T.sans }}>
          <thead>
            <tr style={{ background:T.grayLt, borderBottom:`1px solid ${T.border}` }}>
              {["Part Number","Name","Category","Unit Cost","Qty","Total Value",""].map(h=>(
                <th key={h} style={{ padding:"10px 12px", textAlign:"left", fontWeight:600, fontSize:11, color:T.muted, textTransform:"uppercase", letterSpacing:.4, whiteSpace:"nowrap" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((p,i)=>{
              const linkedEq = p.equipmentId ? state.equipment.find(e=>e.id===p.equipmentId) : null;
              const isLow = p.lowStockAlert!==false && p.qty<=(p.minQty||0);
              return (
                <React.Fragment key={p.id}>
                  <tr onClick={()=>setExpanded(expanded===p.id?null:p.id)}
                    style={{ borderBottom:expanded===p.id?"none":`1px solid ${T.border}`, background:isLow?"#fff8f8":i%2===0?"#fff":T.grayLt, cursor:"pointer" }}
                    onMouseEnter={e=>e.currentTarget.style.background=T.accentLt}
                    onMouseLeave={e=>e.currentTarget.style.background=isLow?"#fff8f8":i%2===0?"#fff":T.grayLt}>
                    <td style={{ padding:"10px 12px", fontFamily:T.mono, fontSize:12, color:T.accent }}>{p.partNumber||"—"}</td>
                    <td style={{ padding:"10px 12px", fontWeight:600, color:T.text }}>
                      {p.name}{isLow&&<span style={{ color:T.red, marginLeft:6, fontSize:11 }}>⚠ Low</span>}
                      {linkedEq&&<div style={{ fontSize:10, color:T.accent, fontWeight:500, marginTop:1 }}>For: {linkedEq.name} ({linkedEq.id})</div>}
                      {!linkedEq&&p.modelFit&&<div style={{ fontSize:10, color:T.muted, marginTop:1 }}>Fits: {p.modelFit}</div>}
                    </td>
                    <td style={{ padding:"10px 12px", color:T.subtext }}>{p.category||"—"}</td>
                    <td style={{ padding:"10px 12px", fontFamily:T.mono, fontSize:12 }}>${(+p.unitCost||0).toFixed(2)}</td>
                    <td style={{ padding:"10px 12px", fontFamily:T.mono, fontSize:13, fontWeight:700, color:isLow?T.red:T.green }}>{p.qty}</td>
                    <td style={{ padding:"10px 12px", fontFamily:T.mono, fontSize:12, color:T.subtext }}>${(p.qty*(+p.unitCost||0)).toFixed(2)}</td>
                    <td style={{ padding:"10px 12px" }} onClick={e=>e.stopPropagation()}>
                      <Btn small variant="secondary" onClick={()=>openEdit(p)} style={{ marginRight:4 }}>Edit</Btn>
                      <Btn small variant="danger" onClick={()=>del(p.id)}>Del</Btn>
                    </td>
                  </tr>
                  {expanded===p.id && (
                    <tr style={{ borderBottom:`1px solid ${T.border}` }}>
                      <td colSpan={7} style={{ padding:"12px 20px", background:"#f8fbff" }}>
                        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(180px,1fr))", gap:"10px 24px", marginBottom:12 }}>
                          {[["Vendor",p.vendor],["Location",p.location],["Min Qty",p.minQty],["PO Number",p.poNumber],["Date Received",p.dateReceived],["Fits Model",p.modelFit],["Linked Equipment",linkedEq?`${linkedEq.name} (${linkedEq.id})`:null]].filter(([,v])=>v).map(([k,v])=>(
                            <div key={k}><div style={{ fontFamily:T.sans, fontSize:10, fontWeight:700, color:T.muted, textTransform:"uppercase", letterSpacing:.4 }}>{k}</div><div style={{ fontFamily:T.sans, fontSize:13, color:T.text, marginTop:3 }}>{v}</div></div>
                          ))}
                        </div>
                        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                          <span style={{ fontFamily:T.sans, fontSize:12, fontWeight:600, color:T.subtext }}>Low Stock Alert:</span>
                          <button type="button" onClick={()=>dispatch({type:"UPDATE_PART",payload:{...p,lowStockAlert:!(p.lowStockAlert!==false)}})}
                            style={{ width:44, height:24, borderRadius:12, border:"none", background:p.lowStockAlert!==false?T.accent:"#d1d5db", cursor:"pointer", position:"relative", transition:"background .2s" }}>
                            <span style={{ position:"absolute", top:3, left:p.lowStockAlert!==false?22:3, width:18, height:18, borderRadius:"50%", background:"#fff", transition:"left .2s", display:"block" }}/>
                          </button>
                          <span style={{ fontFamily:T.sans, fontSize:12, color:T.muted }}>{p.lowStockAlert!==false?"On":"Off"}</span>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
        {filtered.length===0&&<div style={{ padding:40, textAlign:"center", color:T.muted, fontFamily:T.sans, fontSize:13 }}>No parts found.</div>}
      </Card>

      {(modal==="add"||typeof modal==="object"&&modal!==null&&modal.id)&&(
        <Modal title={modal==="add"?"Add Part":`Edit — ${form.partNumber||form.name}`} onClose={()=>setModal(null)}>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"0 16px" }}>
            <Field label="Part Number" half><input style={inp} value={form.partNumber||""} onChange={F("partNumber")} /></Field>
            <Field label="Part Name"><input style={inp} value={form.name||""} onChange={F("name")} /></Field>
            <Field label="Category" half><input style={inp} value={form.category||""} onChange={F("category")} /></Field>
            <div style={{ marginBottom:14, gridColumn:"span 2" }}>
              <label style={{ display:"block", fontFamily:T.sans, fontSize:12, fontWeight:600, color:T.subtext, marginBottom:5 }}>
                Linked Equipment <span style={{ fontFamily:T.sans, fontSize:11, fontWeight:400, color:T.muted }}>(optional)</span>
              </label>
              <select style={sel} value={form.equipmentId||""} onChange={e=>{ const eq=state.equipment.find(q=>q.id===e.target.value); setForm(f=>({...f,equipmentId:e.target.value,modelFit:eq?`${eq.make||""} ${eq.model||""}`.trim():f.modelFit})); }}>
                <option value="">-- None (generic part) --</option>
                {state.equipment.map(e=><option key={e.id} value={e.id}>{e.name} ({e.id})</option>)}
              </select>
            </div>
            <Field label="Fits Model (manual)" half><input style={inp} value={form.modelFit||""} onChange={F("modelFit")} placeholder="e.g. JD 5075E" /></Field>
            <Field label="Vendor" half><input style={inp} value={form.vendor||""} onChange={F("vendor")} /></Field>
            <Field label="PO Number" half><input style={inp} value={form.poNumber||""} onChange={F("poNumber")} /></Field>
            <Field label="Location" half><input style={inp} value={form.location||""} onChange={F("location")} /></Field>
            <Field label="Date Received" half><input style={inp} type="date" value={form.dateReceived||""} onChange={F("dateReceived")} /></Field>
            <Field label="Unit Cost ($)" half><input style={inp} type="number" value={form.unitCost||0} onChange={F("unitCost")} /></Field>
            <Field label="Qty on Hand" half><input style={inp} type="number" value={form.qty||0} onChange={F("qty")} /></Field>
            <Field label="Min Qty (Low Stock)" half><input style={inp} type="number" value={form.minQty||1} onChange={F("minQty")} /></Field>
            <div style={{ marginBottom:14, gridColumn:"span 2", display:"flex", alignItems:"center", gap:12 }}>
              <label style={{ fontFamily:T.sans, fontSize:12, fontWeight:600, color:T.subtext }}>Low Stock Alert:</label>
              <button type="button" onClick={()=>setForm(f=>({...f,lowStockAlert:!(f.lowStockAlert!==false)}))}
                style={{ width:44, height:24, borderRadius:12, border:"none", background:form.lowStockAlert!==false?T.accent:"#d1d5db", cursor:"pointer", position:"relative", transition:"background .2s" }}>
                <span style={{ position:"absolute", top:3, left:form.lowStockAlert!==false?22:3, width:18, height:18, borderRadius:"50%", background:"#fff", transition:"left .2s", display:"block" }}/>
              </button>
              <span style={{ fontFamily:T.sans, fontSize:12, color:T.muted }}>{form.lowStockAlert!==false?"Alert ON":"Alert OFF"}</span>
            </div>
          </div>
          <div style={{ display:"flex", gap:8, justifyContent:"flex-end", marginTop:8 }}>
            <Btn variant="secondary" onClick={()=>setModal(null)}>Cancel</Btn>
            <Btn onClick={save}>Save Part</Btn>
          </div>
        </Modal>
      )}

      {modal==="po"&&(
        <Modal title="Add Purchase Order" onClose={()=>setModal(null)}>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:"0 14px", marginBottom:16 }}>
            <Field label="PO Number"><input style={inp} value={poForm.poNumber} onChange={e=>setPoForm(f=>({...f,poNumber:e.target.value}))} placeholder="PO-2026-001" /></Field>
            <Field label="Vendor"><input style={inp} value={poForm.vendor} onChange={e=>setPoForm(f=>({...f,vendor:e.target.value}))} /></Field>
            <Field label="Date Received"><input style={inp} type="date" value={poForm.date} onChange={e=>setPoForm(f=>({...f,date:e.target.value}))} /></Field>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"2fr 1fr 1fr 55px 65px 1fr 1fr auto", gap:6, marginBottom:6, background:T.grayLt, padding:"6px 8px", borderRadius:6 }}>
            {["Name*","Part #","Category","Qty","$/Unit","Location","Equipment",""].map(h=><div key={h} style={{ fontFamily:T.sans, fontSize:10, fontWeight:700, color:T.muted, textTransform:"uppercase", letterSpacing:.4 }}>{h}</div>)}
          </div>
          {poForm.parts.map((p,i)=>(
            <div key={i} style={{ display:"grid", gridTemplateColumns:"2fr 1fr 1fr 55px 65px 1fr 1fr auto", gap:6, marginBottom:6, alignItems:"center" }}>
              <input style={inp} placeholder="Part name*" value={p.name} onChange={e=>setPoRow(i,"name",e.target.value)} />
              <input style={inp} placeholder="Part #" value={p.partNumber} onChange={e=>setPoRow(i,"partNumber",e.target.value)} />
              <input style={inp} placeholder="Category" value={p.category} onChange={e=>setPoRow(i,"category",e.target.value)} />
              <input style={inp} type="number" placeholder="Qty" value={p.qty} onChange={e=>setPoRow(i,"qty",e.target.value)} />
              <input style={inp} type="number" step="0.01" placeholder="0.00" value={p.unitCost} onChange={e=>setPoRow(i,"unitCost",e.target.value)} />
              <input style={inp} placeholder="Location" value={p.location} onChange={e=>setPoRow(i,"location",e.target.value)} />
              <select style={sel} value={p.equipmentId||""} onChange={e=>{ const eq=state.equipment.find(q=>q.id===e.target.value); setPoRow(i,"equipmentId",e.target.value); if(eq)setPoRow(i,"modelFit",`${eq.make||""} ${eq.model||""}`.trim()); }}>
                <option value="">Generic</option>
                {state.equipment.map(e=><option key={e.id} value={e.id}>{e.name} ({e.id})</option>)}
              </select>
              {poForm.parts.length>1?<button onClick={()=>delPoRow(i)} style={{ background:"none", border:"1px solid #fca5a5", borderRadius:5, color:T.red, cursor:"pointer", padding:"6px 8px", fontFamily:T.sans, fontSize:12, fontWeight:600 }}>X</button>:<div/>}
            </div>
          ))}
          <button onClick={addPoRow} style={{ background:"none", border:"1px dashed #c8d0e0", borderRadius:6, padding:"7px 14px", color:T.accent, cursor:"pointer", fontFamily:T.sans, fontSize:12, fontWeight:600, width:"100%", marginBottom:12 }}>+ Add Another Part</button>
          <div style={{ display:"flex", gap:8, justifyContent:"flex-end" }}>
            <Btn variant="secondary" onClick={()=>setModal(null)}>Cancel</Btn>
            <Btn onClick={savePO}>Save All Parts</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}


/* PM */

function PM({ state, dispatch }) {
  const [modal, setModal]         = useState(null); /* null | "edit" | "schedule" */
  const [form, setForm]           = useState({});
  const [schForm, setSchForm]     = useState({ equipmentId:"", taskId:"", task:"", triggerType:"time", timeInterval:"", timeUnit:"months", usageInterval:"", usageType:"hours", lastDoneDate:today(), lastDoneUsage:"" });
  const [taskModal, setTaskModal] = useState(false);
  const [editTaskId, setEditTaskId] = useState(null);
  const blankTaskForm = () => ({ name:"", description:"", steps:[""], parts:[{name:"",qty:"",unit:"ea"}], triggers:[{type:"time",timeInterval:"",timeUnit:"months",usageInterval:"",usageType:"hours",usageMode:"every"}] });
  const [taskForm, setTaskForm]   = useState(blankTaskForm());
  const [showTaskLib, setShowTaskLib] = useState(false);
  const [autoFired, setAutoFired]     = useState(false);

  const F  = k => e => setForm(f=>({...f,[k]:e.target.value}));
  const SF = k => e => setSchForm(f=>({...f,[k]:e.target.value}));

  const pmTasks  = state.pmTasks    || [];
  const schedules = state.pmSchedules || [];

  /* Compute next due date */
  const nextDueDate = (lastDate, intervalVal, unit) => {
    if(!lastDate||!intervalVal) return "";
    const d = new Date(lastDate);
    const n = +intervalVal;
    if(unit==="days")   d.setDate(d.getDate()+n);
    if(unit==="weeks")  d.setDate(d.getDate()+n*7);
    if(unit==="months") d.setMonth(d.getMonth()+n);
    if(unit==="years")  d.setFullYear(d.getFullYear()+n);
    return d.toISOString().split("T")[0];
  };

  /* Check if a schedule should trigger - pure computation */
  const shouldTrigger = (sch) => {
    try {
      if(!sch.equipmentId) return false;
      const alreadyOpen = state.workOrders.some(w=>
        w.equipment===sch.equipmentId &&
        w.scheduleId===sch.id &&
        (w.status==="Open"||w.status==="In Progress")
      );
      if(alreadyOpen) return false;
      if((sch.triggerType==="time"||sch.triggerType==="both") && sch.nextDueDate) {
        if(today() >= sch.nextDueDate) return true;
      }
      if((sch.triggerType==="usage"||sch.triggerType==="both") && sch.nextDueUsage) {
        const logs   = (state.usageLogs||[]).filter(l=>l.equipmentId===sch.equipmentId);
        const totalH  = logs.reduce((s,l)=>s+(+(l.hours||0)),0);
        const totalMi = logs.reduce((s,l)=>s+(+(l.mileage||0)),0);
        const usage   = sch.usageType==="mileage" ? totalMi : totalH;
        if(usage >= +sch.nextDueUsage) return true;
      }
    } catch(e) { /* swallow any errors in trigger check */ }
    return false;
  };

  const triggered = schedules.filter(shouldTrigger);

  /* Fire auto-WOs once per mount (not on every render) */
  useEffect(()=>{
    if(autoFired || triggered.length===0) return;
    setAutoFired(true);
    triggered.forEach(sch=>{
      const existing = state.workOrders.filter(w=>w.id.startsWith(sch.equipmentId+"-"));
      const nums = existing.map(w=>parseInt(w.id.split("-").pop(),10)||0);
      const next = nums.length>0 ? Math.max(...nums)+1 : 1;
      const woId = `${sch.equipmentId}-${String(next).padStart(2,"0")}`;
      dispatch({type:"ADD_WO", payload:{
        id:woId, title:sch.task, equipment:sch.equipmentId,
        status:"Open", priority:"Medium", woType:"Service",
        created:today(), due:sch.nextDueDate||today(),
        tech:"", laborHours:0, laborCost:0, partsCost:0,
        description:`Auto-generated: ${sch.task}`,
        mechanicNotes:"", partsUsed:[], scheduleId:sch.id,
      }});
      const logs    = (state.usageLogs||[]).filter(l=>l.equipmentId===sch.equipmentId);
      const curUsage = sch.usageType==="mileage"
        ? logs.reduce((s,l)=>s+(+(l.mileage||0)),0)
        : logs.reduce((s,l)=>s+(+(l.hours||0)),0);
      dispatch({type:"UPDATE_PM_SCHEDULE", payload:{
        ...sch,
        lastDoneDate:today(), lastDoneUsage:curUsage,
        nextDueDate:  nextDueDate(today(), sch.timeInterval, sch.timeUnit),
        nextDueUsage: sch.usageInterval ? curUsage+(+sch.usageInterval) : sch.nextDueUsage,
      }});
    });
  }, []); /* run once on mount only */

  /* PM status buckets */
  const byStatus = { Overdue:[], "Due Soon":[], OK:[] };
  state.preventiveMaintenance.forEach(pm=>{
    const eq = state.equipment.find(e=>e.id===pm.equipment);
    (byStatus[pm.status]||byStatus.OK).push({...pm, eqName:eq?.name||pm.equipment});
  });

  const markDone = pm => {
    dispatch({type:"UPDATE_PM", payload:{...pm, lastDone:today(), status:"OK"}});
    /* If this PM item is linked to a schedule, advance the schedule */
    if(pm.scheduleId) {
      const sch = schedules.find(s=>s.id===pm.scheduleId);
      if(sch) {
        const logs    = (state.usageLogs||[]).filter(l=>l.equipmentId===sch.equipmentId);
        const curUsage = sch.usageType==="mileage"
          ? Math.max(...logs.map(l=>+(l.mileage||0)), 0)
          : Math.max(...logs.map(l=>+(l.hours||0)), 0);
        dispatch({type:"UPDATE_PM_SCHEDULE", payload:{
          ...sch,
          lastDoneDate:today(), lastDoneUsage:curUsage,
          nextDueDate:  nextDueDate(today(), sch.timeInterval, sch.timeUnit),
          nextDueUsage: sch.usageInterval ? curUsage+(+sch.usageInterval) : sch.nextDueUsage,
        }});
      }
    }
  };
  const openEdit = pm => { setForm({...pm}); setModal("edit"); };
  const save = () => { dispatch({type:"UPDATE_PM", payload:form}); setModal(null); };

  const saveSchedule = () => {
    if(!schForm.equipmentId) return alert("Select equipment.");
    if(!schForm.task)        return alert("Enter task name.");
    const nextDate  = schForm.triggerType!=="usage" ? nextDueDate(schForm.lastDoneDate, schForm.timeInterval, schForm.timeUnit) : "";
    const nextUsage = schForm.triggerType!=="time"  ? (+(schForm.lastDoneUsage||0))+(+(schForm.usageInterval||0)) : "";
    dispatch({type:"ADD_PM_SCHEDULE", payload:{
      ...schForm, id:genId("SCH"),
      nextDueDate:nextDate, nextDueUsage:nextUsage,
      created:today(),
    }});
    setModal(null);
    setSchForm({equipmentId:"",taskId:"",task:"",triggerType:"time",timeInterval:"",timeUnit:"months",usageInterval:"",usageType:"hours",lastDoneDate:today(),lastDoneUsage:""});
  };

  const delSchedule = id => { if(confirm("Delete this maintenance schedule?")) dispatch({type:"DELETE_PM_SCHEDULE",payload:id}); };

  /* Task library */
  const openNewTask = () => { setEditTaskId(null); setTaskForm(blankTaskForm()); setTaskModal(true); };
  const openEditTask = (t) => { setEditTaskId(t.id); setTaskForm({...t, triggers:t.triggers||[{type:"time",timeInterval:t.timeInterval||"",timeUnit:t.timeUnit||"months",usageInterval:"",usageType:"hours",usageMode:"every"}]}); setTaskModal(true); };
  const saveTask = () => {
    if(!taskForm.name) return alert("Task name required.");
    if(editTaskId) {
      dispatch({type:"UPDATE_PM_TASK", payload:{...taskForm, id:editTaskId}});
    } else {
      dispatch({type:"ADD_PM_TASK", payload:{...taskForm, id:genId("PMT")}});
    }
    setTaskModal(false); setEditTaskId(null); setTaskForm(blankTaskForm());
  };
  /* Trigger helpers */
  const addTrigger   = () => setTaskForm(f=>({...f,triggers:[...(f.triggers||[]),{type:"time",timeInterval:"",timeUnit:"months",usageInterval:"",usageType:"hours",usageMode:"every"}]}));
  const setTrigger   = (i,k,v) => setTaskForm(f=>{ const tr=[...(f.triggers||[])]; tr[i]={...tr[i],[k]:v}; return {...f,triggers:tr}; });
  const delTrigger   = i => setTaskForm(f=>{ const tr=[...(f.triggers||[])]; tr.splice(i,1); return {...f,triggers:tr}; });
  const addTaskStep  = () => setTaskForm(f=>({...f,steps:[...(f.steps||[]),""] }));
  const setStep      = (i,v) => setTaskForm(f=>{ const s=[...(f.steps||[])]; s[i]=v; return {...f,steps:s}; });
  const delStep      = i => setTaskForm(f=>{ const s=[...(f.steps||[])]; s.splice(i,1); return {...f,steps:s}; });
  const addTaskPart  = () => setTaskForm(f=>({...f,parts:[...(f.parts||[]),{name:"",qty:"",unit:"ea"}]}));
  const setTaskPart  = (i,k,v) => setTaskForm(f=>{ const p=[...(f.parts||[])]; p[i]={...p[i],[k]:v}; return {...f,parts:p}; });
  const delTaskPart  = i => setTaskForm(f=>{ const p=[...(f.parts||[])]; p.splice(i,1); return {...f,parts:p}; });

  const [pmSort, setPmSort]   = useState({ Overdue:"asc", "Due Soon":"asc", OK:"asc" });
  const toggleSort = (section) => setPmSort(s=>({...s,[section]:s[section]==="asc"?"desc":"asc"}));

  const Section = ({title, items, borderColor}) => {
    const sort = pmSort[title] || "asc";
    const sorted = [...items].sort((a,b)=>{
      const da = a.nextDue||"9999", db = b.nextDue||"9999";
      return sort==="asc" ? da.localeCompare(db) : db.localeCompare(da);
    });
    return sorted.length===0 ? null : (
      <div style={{ marginBottom:20 }}>
      <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:10, paddingBottom:8, borderBottom:`1px solid ${T.border}` }}>
        <h4 style={{ margin:0, fontFamily:T.sans, fontSize:13, fontWeight:700, color:T.text }}>{title}</h4>
        <span style={{ background:T.grayLt, color:T.subtext, border:`1px solid ${T.border}`, borderRadius:10, padding:"1px 8px", fontSize:11, fontWeight:600 }}>{sorted.length}</span>
        <button onClick={()=>toggleSort(title)} style={{ marginLeft:"auto", background:"none", border:`1px solid ${T.border}`, borderRadius:5, padding:"3px 8px", cursor:"pointer", fontFamily:T.mono, fontSize:11, color:T.subtext }}>
          Due Date {sort==="asc"?"↑":"↓"}
        </button>
      </div>
      <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13, fontFamily:T.sans }}>
        <thead><tr style={{ background:T.grayLt, borderBottom:`1px solid ${T.border}` }}>
          {["Task","Equipment","Interval","Last Done","Due Date",""].map(h=>(
            <th key={h} style={{ padding:"8px 12px", textAlign:"left", fontWeight:600, fontSize:11, color:T.muted, textTransform:"uppercase", letterSpacing:.4 }}>{h}</th>
          ))}
        </tr></thead>
        <tbody>
          {sorted.map(pm=>(
            <tr key={pm.id} onClick={()=>openEdit(pm)} style={{ borderBottom:`1px solid ${T.border}`, borderLeft:`3px solid ${borderColor}`, cursor:"pointer", transition:"background .1s" }}
              onMouseEnter={e=>e.currentTarget.style.background=T.accentLt}
              onMouseLeave={e=>e.currentTarget.style.background=""}>
              <td style={{ padding:"10px 12px", fontWeight:500 }}>{pm.task}</td>
              <td style={{ padding:"10px 12px", color:T.subtext }}>{pm.eqName}</td>
              <td style={{ padding:"10px 12px", color:T.muted, fontFamily:T.mono, fontSize:12 }}>{pm.interval}</td>
              <td style={{ padding:"10px 12px", fontFamily:T.mono, fontSize:12 }}>{pm.lastDone||"—"}</td>
              <td style={{ padding:"10px 12px", fontFamily:T.mono, fontSize:12, fontWeight:600, color:pm.status==="Overdue"?T.red:T.amber }}>{pm.nextDue||"—"}</td>
              <td style={{ padding:"10px 12px", whiteSpace:"nowrap" }} onClick={e=>e.stopPropagation()}>
                {pm.scheduleId && (
                  <span title="Linked to PM Schedule" style={{ fontFamily:T.mono, fontSize:10, color:T.accent, marginRight:6 }}>AUTO</span>
                )}
                <Btn small onClick={(e)=>{ e.stopPropagation(); markDone(pm); }} style={{ marginRight:4 }}>Done</Btn>
                <Btn small variant="secondary" onClick={(e)=>{ e.stopPropagation(); openEdit(pm); }}>Edit</Btn>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
    );
  };

  return (
    <div>
      {/* Auto-trigger banner */}
      {triggered.length>0 && (
        <div style={{ background:"#fef2f2", border:"1px solid #fca5a5", borderRadius:8, padding:"12px 16px", marginBottom:16, display:"flex", gap:10, alignItems:"center" }}>
          <span style={{ fontSize:20 }}>🚨</span>
          <div style={{ fontFamily:T.sans, fontSize:13, color:T.red, fontWeight:600 }}>
            {triggered.length} PM schedule{triggered.length>1?"s":""} triggered — work orders auto-generated.
          </div>
        </div>
      )}

      <div style={{ display:"flex", gap:8, justifyContent:"flex-end", marginBottom:16 }}>
        <Btn variant="secondary" onClick={()=>setShowTaskLib(true)}>
          Named Tasks Library ({pmTasks.length})
        </Btn>
        <Btn variant="secondary" onClick={openNewTask}>+ Create New Task</Btn>
        <Btn onClick={()=>setModal("schedule")}>Task-to-Equipment</Btn>
      </div>

      {/* Named Tasks Library Modal */}
      {showTaskLib && (
        <Modal title={`Named Tasks Library (${pmTasks.length})`} onClose={()=>setShowTaskLib(false)}>
          {pmTasks.length===0 ? (
            <div style={{ textAlign:"center", padding:"24px 0", color:T.muted, fontFamily:T.sans, fontSize:13 }}>
              No tasks yet. Click "+ Create New Task" to add one.
            </div>
          ) : pmTasks.map((t,i)=>{
            /* Find schedules using this task */
            const activeScheds = schedules.filter(s=>s.taskId===t.id);
            return (
              <div key={t.id} style={{ borderBottom:`1px solid ${T.border}`, padding:"14px 0", marginBottom:0 }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:8 }}>
                  <div>
                    <div style={{ fontFamily:T.sans, fontSize:14, fontWeight:700, color:T.text }}>{t.name}</div>
                    {t.description&&<div style={{ fontFamily:T.sans, fontSize:12, color:T.muted, marginTop:2 }}>{t.description}</div>}
                  </div>
                  <div style={{ display:"flex", gap:6 }}>
                    <Btn small variant="secondary" onClick={()=>{ setShowTaskLib(false); openEditTask(t); }}>Edit</Btn>
                    <Btn small variant="danger" onClick={()=>{ if(confirm(`Delete task "${t.name}"? This will not delete active schedules.`)) dispatch({type:"DELETE_PM_TASK",payload:t.id}); }}>Del</Btn>
                  </div>
                </div>
                {/* Steps */}
                {(t.steps||[]).filter(Boolean).length>0 && (
                  <div style={{ marginBottom:8 }}>
                    <div style={{ fontFamily:T.sans, fontSize:11, fontWeight:600, color:T.muted, textTransform:"uppercase", letterSpacing:.4, marginBottom:4 }}>Steps</div>
                    {t.steps.filter(Boolean).map((s,j)=>(
                      <div key={j} style={{ fontFamily:T.sans, fontSize:12, color:T.subtext, marginBottom:2 }}>{j+1}. {s}</div>
                    ))}
                  </div>
                )}
                {/* Parts */}
                {(t.parts||[]).filter(p=>p.name).length>0 && (
                  <div style={{ marginBottom:8 }}>
                    <div style={{ fontFamily:T.sans, fontSize:11, fontWeight:600, color:T.muted, textTransform:"uppercase", letterSpacing:.4, marginBottom:4 }}>Parts & Fluids</div>
                    <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                      {t.parts.filter(p=>p.name).map((p,j)=>(
                        <span key={j} style={{ fontFamily:T.mono, fontSize:11, padding:"2px 8px", borderRadius:4, background:T.grayLt, border:`1px solid ${T.border}`, color:T.subtext }}>{p.qty} {p.unit} {p.name}</span>
                      ))}
                    </div>
                  </div>
                )}
                {/* Active schedules using this task */}
                <div>
                  <div style={{ fontFamily:T.sans, fontSize:11, fontWeight:600, color:T.muted, textTransform:"uppercase", letterSpacing:.4, marginBottom:4 }}>Active On</div>
                  {activeScheds.length===0 ? (
                    <div style={{ fontFamily:T.sans, fontSize:12, color:T.muted, fontStyle:"italic" }}>Not assigned to any equipment</div>
                  ) : (
                    <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
                      {activeScheds.map(sch=>{
                        const eq = state.equipment.find(e=>e.id===sch.equipmentId);
                        return (
                          <div key={sch.id} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", background:T.accentLt, border:`1px solid ${T.accent}44`, borderRadius:6, padding:"6px 10px" }}>
                            <span style={{ fontFamily:T.sans, fontSize:12, color:T.text }}>{eq?.name||sch.equipmentId} — Next: {sch.nextDueDate||sch.nextDueUsage||"—"}</span>
                            <Btn small variant="danger" onClick={()=>{ if(confirm(`Remove schedule for ${eq?.name}?`)) delSchedule(sch.id); }}>Remove</Btn>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          <div style={{ display:"flex", justifyContent:"flex-end", marginTop:14 }}>
            <Btn variant="secondary" onClick={()=>setShowTaskLib(false)}>Close</Btn>
          </div>
        </Modal>
      )}

      <Section title="Overdue"    items={byStatus.Overdue}    borderColor={T.red} />
      <Section title="Due Soon"   items={byStatus["Due Soon"]} borderColor={T.amber} />
      <Section title="Up to Date" items={byStatus.OK}         borderColor={T.green} />

      {/* Create New Task Modal */}
      {taskModal&&(
        <Modal title={editTaskId?"Edit Task":"Create PM Task"} onClose={()=>{ setTaskModal(false); setEditTaskId(null); setTaskForm(blankTaskForm()); }}>
          <p style={{ margin:"0 0 14px", fontFamily:T.sans, fontSize:13, color:T.subtext }}>Create a reusable service task with steps and parts. Attach it to equipment using Task-to-Equipment.</p>
          <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
            <Field label="Task Name"><input style={inp} value={taskForm.name} onChange={e=>setTaskForm(f=>({...f,name:e.target.value}))} placeholder="e.g. 500-Hour Service, Annual Inspection" /></Field>
            <Field label="Description"><textarea style={{ ...inp, minHeight:50, resize:"vertical" }} value={taskForm.description} onChange={e=>setTaskForm(f=>({...f,description:e.target.value}))} placeholder="Brief description..." /></Field>
            <div>
              <label style={{ display:"block", fontFamily:T.sans, fontSize:12, fontWeight:600, color:T.subtext, marginBottom:8 }}>Service Steps</label>
              {(taskForm.steps||[""]).map((step,i)=>(
                <div key={i} style={{ display:"flex", gap:6, marginBottom:6, alignItems:"center" }}>
                  <span style={{ fontFamily:T.mono, fontSize:11, color:T.muted, minWidth:20 }}>{i+1}.</span>
                  <input style={{ ...inp, flex:1 }} value={step} onChange={e=>setStep(i,e.target.value)} placeholder={`Step ${i+1}...`} />
                  {(taskForm.steps||[]).length>1&&<button onClick={()=>delStep(i)} style={{ background:"none", border:"none", color:T.red, cursor:"pointer", fontSize:18, lineHeight:1 }}>×</button>}
                </div>
              ))}
              <button onClick={addTaskStep} style={{ background:"none", border:"1px dashed #c8d0e0", borderRadius:6, padding:"5px 12px", color:T.accent, cursor:"pointer", fontFamily:T.sans, fontSize:12, fontWeight:600 }}>+ Add Step</button>
            </div>
            <div>
              <label style={{ display:"block", fontFamily:T.sans, fontSize:12, fontWeight:600, color:T.subtext, marginBottom:8 }}>Parts & Lubricants Required</label>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 80px 80px auto", gap:6, marginBottom:6, background:T.grayLt, padding:"5px 8px", borderRadius:5 }}>
                {["Part / Fluid Name","Qty","Unit",""].map(h=><div key={h} style={{ fontFamily:T.sans, fontSize:10, fontWeight:700, color:T.muted, textTransform:"uppercase", letterSpacing:.4 }}>{h}</div>)}
              </div>
              {(taskForm.parts||[]).map((p,i)=>(
                <div key={i} style={{ display:"grid", gridTemplateColumns:"1fr 80px 80px auto", gap:6, marginBottom:6, alignItems:"center" }}>
                  <input style={inp} placeholder="e.g. Engine Oil, Air Filter..." value={p.name} onChange={e=>setTaskPart(i,"name",e.target.value)} />
                  <input style={inp} type="number" placeholder="5" value={p.qty} onChange={e=>setTaskPart(i,"qty",e.target.value)} />
                  <select style={sel} value={p.unit||"ea"} onChange={e=>setTaskPart(i,"unit",e.target.value)}>
                    {["ea","qt","gal","L","oz","lbs","ft","m","set","pk"].map(u=><option key={u} value={u}>{u}</option>)}
                  </select>
                  {(taskForm.parts||[]).length>1?<button onClick={()=>delTaskPart(i)} style={{ background:"none", border:"none", color:T.red, cursor:"pointer", fontSize:18, lineHeight:1 }}>×</button>:<div/>}
                </div>
              ))}
              <button onClick={addTaskPart} style={{ background:"none", border:"1px dashed #c8d0e0", borderRadius:6, padding:"5px 12px", color:T.accent, cursor:"pointer", fontFamily:T.sans, fontSize:12, fontWeight:600 }}>+ Add Part / Lubricant</button>
            </div>

            {/* Multi-trigger section */}
            <div style={{ background:T.grayLt, borderRadius:8, padding:"12px 14px", border:`1px solid ${T.border}` }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
                <label style={{ fontFamily:T.sans, fontSize:12, fontWeight:600, color:T.subtext }}>Service Triggers</label>
                <button onClick={addTrigger} style={{ background:"none", border:`1px solid ${T.accent}`, borderRadius:5, padding:"3px 10px", color:T.accent, cursor:"pointer", fontFamily:T.sans, fontSize:11, fontWeight:600 }}>+ Add Trigger</button>
              </div>
              {(taskForm.triggers||[]).map((tr,i)=>(
                <div key={i} style={{ background:"#fff", border:`1px solid ${T.border}`, borderRadius:7, padding:"10px 12px", marginBottom:8 }}>
                  <div style={{ display:"flex", gap:6, marginBottom:8, alignItems:"center" }}>
                    <span style={{ fontFamily:T.sans, fontSize:11, fontWeight:700, color:T.muted }}>Trigger {i+1}</span>
                    <div style={{ display:"flex", gap:4, marginLeft:4 }}>
                      {[["time","By Time"],["hours","By Hours"],["mileage","By Mileage"]].map(([v,l])=>(
                        <button key={v} type="button" onClick={()=>setTrigger(i,"type",v)} style={{ padding:"3px 9px", borderRadius:5, border:`1px solid ${tr.type===v?T.accent:T.border}`, background:tr.type===v?T.accentLt:"#fff", color:tr.type===v?T.accent:T.subtext, cursor:"pointer", fontFamily:T.sans, fontSize:11, fontWeight:tr.type===v?700:400 }}>{l}</button>
                      ))}
                    </div>
                    {(taskForm.triggers||[]).length>1&&<button onClick={()=>delTrigger(i)} style={{ marginLeft:"auto", background:"none", border:"none", color:T.red, cursor:"pointer", fontSize:16 }}>×</button>}
                  </div>
                  {tr.type==="time" && (
                    <div style={{ display:"grid", gridTemplateColumns:"80px 1fr", gap:8 }}>
                      <div><label style={{ fontFamily:T.sans, fontSize:10, color:T.muted, display:"block", marginBottom:3 }}>Every</label><input style={inp} type="number" value={tr.timeInterval} onChange={e=>setTrigger(i,"timeInterval",e.target.value)} placeholder="6" /></div>
                      <div><label style={{ fontFamily:T.sans, fontSize:10, color:T.muted, display:"block", marginBottom:3 }}>Unit</label><select style={sel} value={tr.timeUnit} onChange={e=>setTrigger(i,"timeUnit",e.target.value)}>{["days","weeks","months","years"].map(u=><option key={u}>{u}</option>)}</select></div>
                    </div>
                  )}
                  {(tr.type==="hours"||tr.type==="mileage") && (
                    <div style={{ display:"grid", gridTemplateColumns:"1fr 100px 1fr", gap:8 }}>
                      <div><label style={{ fontFamily:T.sans, fontSize:10, color:T.muted, display:"block", marginBottom:3 }}>Mode</label>
                        <select style={sel} value={tr.usageMode||"every"} onChange={e=>setTrigger(i,"usageMode",e.target.value)}>
                          <option value="every">Every X {tr.type}</option>
                          <option value="at">At specific {tr.type}</option>
                        </select>
                      </div>
                      <div><label style={{ fontFamily:T.sans, fontSize:10, color:T.muted, display:"block", marginBottom:3 }}>Value</label><input style={inp} type="number" value={tr.usageInterval||""} onChange={e=>setTrigger(i,"usageInterval",e.target.value)} placeholder="100" /></div>
                      <div style={{ display:"flex", alignItems:"flex-end", paddingBottom:2 }}><span style={{ fontFamily:T.sans, fontSize:11, color:T.muted }}>{tr.type==="hours"?"engine hours":"miles"}</span></div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
          <div style={{ display:"flex", gap:8, justifyContent:"flex-end", marginTop:14 }}>
            <Btn variant="secondary" onClick={()=>{ setTaskModal(false); setEditTaskId(null); setTaskForm(blankTaskForm()); }}>Cancel</Btn>
            <Btn onClick={saveTask}>{editTaskId?"Update Task":"Save Task to Library"}</Btn>
          </div>
        </Modal>
      )}

      {/* Create Maintenance Schedule */}
      {modal==="schedule"&&(
        <Modal title="Task-to-Equipment" onClose={()=>setModal(null)}>
          <p style={{ margin:"0 0 14px", fontFamily:T.sans, fontSize:13, color:T.subtext }}>
            Define a recurring service. Work orders auto-generate when the threshold is reached.
          </p>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"0 16px" }}>
            <div style={{ gridColumn:"span 2", marginBottom:14 }}>
              <label style={{ display:"block", fontFamily:T.sans, fontSize:12, fontWeight:600, color:T.subtext, marginBottom:5 }}>Equipment *</label>
              <select style={sel} value={schForm.equipmentId} onChange={SF("equipmentId")}>
                <option value="">-- Select Equipment --</option>
                {state.equipment.map(e=><option key={e.id} value={e.id}>{e.name} ({e.id})</option>)}
              </select>
            </div>
            <div style={{ gridColumn:"span 2", marginBottom:14 }}>
              <label style={{ display:"block", fontFamily:T.sans, fontSize:12, fontWeight:600, color:T.subtext, marginBottom:5 }}>Service Task</label>
              <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                <select style={{ ...sel, flex:1 }} value={schForm.taskId||""} onChange={e=>{
                  const t = pmTasks.find(t=>t.id===e.target.value);
                  if(t) setSchForm(f=>({...f,taskId:t.id,task:t.name,timeInterval:t.timeInterval||f.timeInterval,timeUnit:t.timeUnit||f.timeUnit,triggerType:t.triggerType||f.triggerType}));
                  else  setSchForm(f=>({...f,taskId:""}));
                }}>
                  <option value="">-- Pick from Named Tasks Library --</option>
                  {pmTasks.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
                <span style={{ fontFamily:T.sans, fontSize:12, color:T.muted }}>or</span>
                <input style={{ ...inp, flex:1 }} placeholder="Custom task name..." value={schForm.task} onChange={SF("task")} />
              </div>
            </div>
            <div style={{ gridColumn:"span 2", marginBottom:14 }}>
              <label style={{ display:"block", fontFamily:T.sans, fontSize:12, fontWeight:600, color:T.subtext, marginBottom:6 }}>Trigger Type</label>
              <div style={{ display:"flex", gap:6 }}>
                {[["time","By Time"],["usage","By Usage"],["both","Both"]].map(([v,l])=>(
                  <button key={v} type="button" onClick={()=>setSchForm(f=>({...f,triggerType:v}))} style={{ flex:1, padding:"7px 0", borderRadius:6, border:`1px solid ${schForm.triggerType===v?T.accent:T.border}`, background:schForm.triggerType===v?T.accentLt:"#fff", color:schForm.triggerType===v?T.accent:T.subtext, cursor:"pointer", fontFamily:T.sans, fontSize:12, fontWeight:schForm.triggerType===v?700:400 }}>{l}</button>
                ))}
              </div>
            </div>
            {(schForm.triggerType==="time"||schForm.triggerType==="both")&&(<>
              <Field label="Time Interval" half><input style={inp} type="number" min="1" value={schForm.timeInterval} onChange={SF("timeInterval")} placeholder="e.g. 6" /></Field>
              <Field label="Unit" half><select style={sel} value={schForm.timeUnit} onChange={SF("timeUnit")}>{["days","weeks","months","years"].map(u=><option key={u}>{u}</option>)}</select></Field>
            </>)}
            {(schForm.triggerType==="usage"||schForm.triggerType==="both")&&(<>
              <Field label="Usage Interval" half><input style={inp} type="number" min="1" value={schForm.usageInterval} onChange={SF("usageInterval")} placeholder="e.g. 100" /></Field>
              <Field label="Usage Type" half><select style={sel} value={schForm.usageType} onChange={SF("usageType")}><option value="hours">Engine Hours</option><option value="mileage">Mileage</option></select></Field>
            </>)}
            <Field label="Last Service Date" half><input style={inp} type="date" value={schForm.lastDoneDate} onChange={SF("lastDoneDate")} /></Field>
            {(schForm.triggerType==="usage"||schForm.triggerType==="both")&&(
              <Field label={`Usage at Last Service (${schForm.usageType})`} half><input style={inp} type="number" value={schForm.lastDoneUsage} onChange={SF("lastDoneUsage")} placeholder="e.g. 100" /></Field>
            )}
          </div>
          {schForm.equipmentId&&schForm.task&&(
            <div style={{ background:T.accentLt, border:`1px solid ${T.accent}44`, borderRadius:8, padding:"12px 14px", marginTop:8 }}>
              <div style={{ fontFamily:T.sans, fontSize:12, fontWeight:700, color:T.accent, marginBottom:6 }}>Preview</div>
              {(schForm.triggerType==="time"||schForm.triggerType==="both")&&schForm.timeInterval&&(
                <div style={{ fontFamily:T.sans, fontSize:13, color:T.text, marginBottom:4 }}>Next due date: <b>{nextDueDate(schForm.lastDoneDate,schForm.timeInterval,schForm.timeUnit)||"—"}</b></div>
              )}
              {(schForm.triggerType==="usage"||schForm.triggerType==="both")&&schForm.usageInterval&&(
                <div style={{ fontFamily:T.sans, fontSize:13, color:T.text }}>Next due at: <b>{(+(schForm.lastDoneUsage||0))+(+(schForm.usageInterval||0))} {schForm.usageType}</b></div>
              )}
            </div>
          )}
          <div style={{ display:"flex", gap:8, justifyContent:"flex-end", marginTop:14 }}>
            <Btn variant="secondary" onClick={()=>setModal(null)}>Cancel</Btn>
            <Btn onClick={saveSchedule}>Create Schedule</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* SPENDING */

function Spending({ state }) {
  const [period, setPeriod] = useState("all");

  /* Period filtering */
  const now = new Date();
  const filterByPeriod = (w) => {
    const d = new Date(w.completed || w.created || "2000-01-01");
    if(period==="monthly") {
      return d.getFullYear()===now.getFullYear() && d.getMonth()===now.getMonth();
    }
    if(period==="biannual") {
      const sixMonthsAgo = new Date(now); sixMonthsAgo.setMonth(now.getMonth()-6);
      return d >= sixMonthsAgo;
    }
    if(period==="fy") {
      const fyStart = new Date(now.getFullYear(), 9, 1); /* Oct 1 */
      const fyEnd   = new Date(now.getFullYear()+1, 8, 30);
      if(now.getMonth()<9) { fyStart.setFullYear(now.getFullYear()-1); fyEnd.setFullYear(now.getFullYear()); }
      return d >= fyStart && d <= fyEnd;
    }
    if(period==="annual") {
      const yearAgo = new Date(now); yearAgo.setFullYear(now.getFullYear()-1);
      return d >= yearAgo;
    }
    return true;
  };

  const PERIODS = [["all","All Time"],["monthly","This Month"],["biannual","Last 6 Months"],["fy","Fiscal Year"],["annual","Last 12 Months"]];

  const wos = state.workOrders.filter(filterByPeriod);
  const totalCost = w => (+w.laborCost||0)+(+(w.partsUsed||[]).reduce((s,p)=>s+(+(p.qty||1))*(+(p.unitCost||0)),0))+(+w.partsCost||0);
  const totLabor  = wos.reduce((s,w)=>s+(+w.laborCost||0),0);
  const totParts  = wos.reduce((s,w)=>s+totalCost(w)-(+w.laborCost||0),0);
  const grand     = totLabor+totParts;

  /* By Equipment */
  const byEq = {};
  wos.forEach(w=>{ if(!byEq[w.equipment])byEq[w.equipment]={labor:0,parts:0,count:0}; byEq[w.equipment].labor+=(+w.laborCost||0); byEq[w.equipment].parts+=totalCost(w)-(+w.laborCost||0); byEq[w.equipment].count++; });

  /* By Category (equipment category) */
  const byCat = {};
  wos.forEach(w=>{ const eq=state.equipment.find(e=>e.id===w.equipment); const cat=eq?.category||eq?.type||"Uncategorized"; if(!byCat[cat])byCat[cat]={total:0,count:0}; byCat[cat].total+=totalCost(w); byCat[cat].count++; });

  /* By Month */
  const byMonth = {};
  wos.forEach(w=>{ const m=(w.completed||w.created||"").slice(0,7); if(m){ if(!byMonth[m])byMonth[m]={labor:0,parts:0}; byMonth[m].labor+=(+w.laborCost||0); byMonth[m].parts+=totalCost(w)-(+w.laborCost||0); }});

  /* By WO Type */
  const byType = {};
  wos.forEach(w=>{ const t=w.woType||"Other"; if(!byType[t])byType[t]=0; byType[t]+=totalCost(w); });

  const Bar = ({pct, color}) => (
    <div style={{ background:T.border, borderRadius:3, height:8, flex:1 }}>
      <div style={{ background:color||T.accent, height:"100%", width:`${Math.min(pct,100)}%`, borderRadius:3, transition:"width .5s" }} />
    </div>
  );

  return (
    <div>
      {/* Period filter */}
      <div style={{ display:"flex", gap:6, marginBottom:18, flexWrap:"wrap" }}>
        {PERIODS.map(([v,l])=>(
          <button key={v} onClick={()=>setPeriod(v)} style={{ padding:"7px 16px", borderRadius:7, border:`1px solid ${period===v?T.accent:T.border}`, background:period===v?T.accentLt:"#fff", color:period===v?T.accent:T.subtext, cursor:"pointer", fontFamily:T.sans, fontSize:12, fontWeight:period===v?700:400 }}>{l}</button>
        ))}
      </div>

      {/* Summary cards */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(160px,1fr))", gap:12, marginBottom:20 }}>
        {[["Total Labor","$"+totLabor.toLocaleString(),T.accent],["Total Parts","$"+totParts.toLocaleString(),"#7c3aed"],["Grand Total","$"+grand.toLocaleString(),T.text],["Work Orders",wos.length,T.muted]].map(([l,v,c])=>(
          <Card key={l} style={{ padding:"14px 16px" }}>
            <div style={{ fontFamily:T.sans, fontSize:22, fontWeight:700, color:c }}>{v}</div>
            <div style={{ fontFamily:T.sans, fontSize:12, color:T.muted, marginTop:3 }}>{l}</div>
          </Card>
        ))}
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16, marginBottom:16 }}>
        {/* By Equipment */}
        <Card>
          <div style={{ fontFamily:T.sans, fontSize:14, fontWeight:700, color:T.text, marginBottom:14 }}>By Equipment</div>
          {Object.entries(byEq).sort((a,b)=>(b[1].labor+b[1].parts)-(a[1].labor+a[1].parts)).slice(0,8).map(([eqId,d])=>{
            const eq=state.equipment.find(e=>e.id===eqId);
            const tot=d.labor+d.parts;
            const pct=grand>0?tot/grand*100:0;
            return (
              <div key={eqId} style={{ marginBottom:12 }}>
                <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                  <span style={{ fontFamily:T.sans, fontSize:12, fontWeight:500, color:T.text, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", maxWidth:"65%" }}>{eq?.name||eqId}</span>
                  <span style={{ fontFamily:T.mono, fontSize:12, color:T.subtext }}>${tot.toLocaleString()}</span>
                </div>
                <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                  <Bar pct={pct} />
                  <span style={{ fontFamily:T.mono, fontSize:10, color:T.muted, minWidth:28 }}>{Math.round(pct)}%</span>
                </div>
                <div style={{ fontFamily:T.sans, fontSize:10, color:T.muted, marginTop:2 }}>{d.count} WOs · Labor ${d.labor.toFixed(0)} · Parts ${d.parts.toFixed(0)}</div>
              </div>
            );
          })}
          {Object.keys(byEq).length===0&&<div style={{ fontFamily:T.sans, fontSize:13, color:T.muted }}>No data for period.</div>}
        </Card>

        {/* By Category */}
        <Card>
          <div style={{ fontFamily:T.sans, fontSize:14, fontWeight:700, color:T.text, marginBottom:14 }}>By Category</div>
          {Object.entries(byCat).sort((a,b)=>b[1].total-a[1].total).map(([cat,d])=>{
            const pct=grand>0?d.total/grand*100:0;
            return (
              <div key={cat} style={{ marginBottom:12 }}>
                <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                  <span style={{ fontFamily:T.sans, fontSize:12, fontWeight:500, color:T.text }}>{cat}</span>
                  <span style={{ fontFamily:T.mono, fontSize:12, color:T.subtext }}>${d.total.toFixed(0)}</span>
                </div>
                <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                  <Bar pct={pct} color="#7c3aed" />
                  <span style={{ fontFamily:T.mono, fontSize:10, color:T.muted, minWidth:28 }}>{Math.round(pct)}%</span>
                </div>
                <div style={{ fontFamily:T.sans, fontSize:10, color:T.muted, marginTop:2 }}>{d.count} WOs</div>
              </div>
            );
          })}
          {Object.keys(byCat).length===0&&<div style={{ fontFamily:T.sans, fontSize:13, color:T.muted }}>No data for period.</div>}
        </Card>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }}>
        {/* By Month */}
        <Card>
          <div style={{ fontFamily:T.sans, fontSize:14, fontWeight:700, color:T.text, marginBottom:14 }}>Monthly Trend</div>
          {Object.entries(byMonth).sort().reverse().slice(0,12).map(([m,d])=>{
            const tot=d.labor+d.parts;
            const pct=grand>0?tot/grand*100:0;
            return (
              <div key={m} style={{ marginBottom:12 }}>
                <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                  <span style={{ fontFamily:T.sans, fontSize:12, color:T.text }}>{m}</span>
                  <span style={{ fontFamily:T.mono, fontSize:12, color:T.subtext }}>${tot.toFixed(0)}</span>
                </div>
                <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                  <Bar pct={pct} color={T.green} />
                  <span style={{ fontFamily:T.mono, fontSize:10, color:T.muted, minWidth:28 }}>{Math.round(pct)}%</span>
                </div>
              </div>
            );
          })}
          {Object.keys(byMonth).length===0&&<div style={{ fontFamily:T.sans, fontSize:13, color:T.muted }}>No data for period.</div>}
        </Card>

        {/* By WO Type */}
        <Card>
          <div style={{ fontFamily:T.sans, fontSize:14, fontWeight:700, color:T.text, marginBottom:14 }}>By Work Order Type</div>
          {Object.entries(byType).sort((a,b)=>b[1]-a[1]).map(([type,tot])=>{
            const pct=grand>0?tot/grand*100:0;
            const typeColors={"Service":"#1e40af","Inspection":T.green,"Repair":T.red,"Other":T.muted};
            return (
              <div key={type} style={{ marginBottom:12 }}>
                <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                  <span style={{ fontFamily:T.sans, fontSize:12, fontWeight:500, color:typeColors[type]||T.text }}>{type}</span>
                  <span style={{ fontFamily:T.mono, fontSize:12, color:T.subtext }}>${tot.toFixed(0)}</span>
                </div>
                <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                  <Bar pct={pct} color={typeColors[type]||T.accent} />
                  <span style={{ fontFamily:T.mono, fontSize:10, color:T.muted, minWidth:28 }}>{Math.round(pct)}%</span>
                </div>
              </div>
            );
          })}
          {Object.keys(byType).length===0&&<div style={{ fontFamily:T.sans, fontSize:13, color:T.muted }}>No data for period.</div>}
        </Card>
      </div>
    </div>
  );
}



/* USER PROFILE */

function UserProfile({ state, dispatch, onClose }) {
  const p = state.profile || {};
  const [form, setForm] = useState({ firstName:p.firstName||"", lastName:p.lastName||"", position:p.position||"", workLocation:p.workLocation||"", photo:p.photo||"" });
  const F = k => e => setForm(f=>({...f,[k]:e.target.value}));

  const handlePhoto = e => {
    const file = e.target.files[0];
    if(!file) return;
    const reader = new FileReader();
    reader.onload = ev => setForm(f=>({...f, photo:ev.target.result}));
    reader.readAsDataURL(file);
  };

  const save = () => { dispatch({ type:"UPDATE_PROFILE", payload:form }); onClose(); };

  return (
    <Modal title="My Profile" onClose={onClose}>
      <div style={{ display:"flex", flexDirection:"column", alignItems:"center", marginBottom:20 }}>
        <div style={{ width:80, height:80, borderRadius:"50%", background:T.accentLt, border:`2px solid ${T.accent}`, overflow:"hidden", display:"flex", alignItems:"center", justifyContent:"center", marginBottom:10 }}>
          {form.photo ? <img src={form.photo} alt="profile" style={{ width:"100%", height:"100%", objectFit:"cover" }} /> : <span style={{ fontFamily:T.mono, fontSize:28, color:T.accent, fontWeight:700 }}>{form.firstName?form.firstName[0]:"?"}</span>}
        </div>
        <label style={{ fontFamily:T.sans, fontSize:12, fontWeight:600, color:T.accent, cursor:"pointer" }}>
          📷 Upload Photo
          <input type="file" accept="image/*" onChange={handlePhoto} style={{ display:"none" }} />
        </label>
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"0 16px" }}>
        <Field label="First Name" half><input style={inp} value={form.firstName} onChange={F("firstName")} placeholder="Juan" /></Field>
        <Field label="Last Name"  half><input style={inp} value={form.lastName}  onChange={F("lastName")}  placeholder="Martinez" /></Field>
        <Field label="Position"><input style={inp} value={form.position} onChange={F("position")} placeholder="Mechanic, Supervisor..." /></Field>
        <Field label="Work Location"><input style={inp} value={form.workLocation} onChange={F("workLocation")} placeholder="Main Shop, Section C..." /></Field>
        <Field label="Labor Rate ($/hr)" half><input style={inp} type="number" value={form.laborRate||""} onChange={F("laborRate")} placeholder="45.00" /></Field>
      </div>
      <div style={{ display:"flex", gap:8, justifyContent:"flex-end", marginTop:8 }}>
        <Btn variant="secondary" onClick={onClose}>Cancel</Btn>
        <Btn onClick={save}>Save Profile</Btn>
      </div>
    </Modal>
  );
}


/* WORK ORDER SETTINGS */

function WOSettings({ state, dispatch, onClose }) {
  const s = state.woSettings || {};
  const [form, setForm] = useState({
    companyName: s.companyName||"National Cemetery Administration",
    headerText:  s.headerText||"Maintenance Work Order",
    logo:        s.logo||"",
    showEquipment: s.showEquipment!==false,
    showTech:      s.showTech!==false,
    showDates:     s.showDates!==false,
    showCosts:     s.showCosts!==false,
    showPriority:  s.showPriority!==false,
    showDescription: s.showDescription!==false,
    showParts:     s.showParts!==false,
    showLaborHours: s.showLaborHours!==false,
    footerText:  s.footerText||"",
  });
  const F = k => e => setForm(f=>({...f,[k]:e.target.value}));
  const Toggle = ({label,k}) => (
    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"8px 0", borderBottom:`1px solid ${T.border}` }}>
      <span style={{ fontFamily:T.sans, fontSize:13, color:T.text }}>{label}</span>
      <button onClick={()=>setForm(f=>({...f,[k]:!f[k]}))} style={{ width:40, height:22, borderRadius:11, border:"none", background:form[k]?T.accent:"#d1d5db", cursor:"pointer", position:"relative", transition:"background .2s" }}>
        <span style={{ position:"absolute", top:2, left:form[k]?18:2, width:18, height:18, borderRadius:"50%", background:"#fff", transition:"left .2s", display:"block" }}/>
      </button>
    </div>
  );

  const handleLogo = e => {
    const file = e.target.files[0]; if(!file) return;
    const reader = new FileReader();
    reader.onload = ev => setForm(f=>({...f,logo:ev.target.result}));
    reader.readAsDataURL(file);
  };

  const save = () => { dispatch({ type:"UPDATE_WO_SETTINGS", payload:form }); onClose(); };

  return (
    <Modal title="Work Order Settings" onClose={onClose}>
      <div style={{ display:"flex", flexDirection:"column", gap:14, marginBottom:14 }}>
        <Field label="Company / Organization Name">
          <input style={inp} value={form.companyName} onChange={F("companyName")} />
        </Field>
        <Field label="Work Order Header Title">
          <input style={inp} value={form.headerText} onChange={F("headerText")} />
        </Field>
        <Field label="Footer / Notes Text">
          <textarea style={{ ...inp, minHeight:56, resize:"vertical" }} value={form.footerText} onChange={F("footerText")} placeholder="e.g. Authorized signatures required…" />
        </Field>
        <div>
          <label style={{ display:"block", fontFamily:T.sans, fontSize:12, fontWeight:600, color:T.subtext, marginBottom:6 }}>Logo</label>
          <div style={{ display:"flex", gap:12, alignItems:"center" }}>
            {form.logo && <img src={form.logo} alt="logo" style={{ height:48, objectFit:"contain", border:`1px solid ${T.border}`, borderRadius:6, padding:4 }} />}
            <label style={{ fontFamily:T.sans, fontSize:12, fontWeight:600, color:T.accent, cursor:"pointer", padding:"7px 14px", border:`1px solid ${T.accent}`, borderRadius:6 }}>
              📁 Upload Logo
              <input type="file" accept="image/*" onChange={handleLogo} style={{ display:"none" }} />
            </label>
            {form.logo && <button onClick={()=>setForm(f=>({...f,logo:""}))} style={{ background:"none", border:"none", color:T.red, cursor:"pointer", fontFamily:T.sans, fontSize:12 }}>Remove</button>}
          </div>
        </div>
      </div>
      <div style={{ fontFamily:T.sans, fontSize:12, fontWeight:700, color:T.muted, textTransform:"uppercase", letterSpacing:.4, marginBottom:8 }}>Fields to show on printed Work Order</div>
      <Toggle label="Equipment" k="showEquipment" />
      <Toggle label="Mechanic" k="showTech" />
      <Toggle label="Dates (Created / Due / Completed)" k="showDates" />
      <Toggle label="Priority" k="showPriority" />
      <Toggle label="Description" k="showDescription" />
      <Toggle label="Parts Cost" k="showParts" />
      <Toggle label="Labor Hours & Cost" k="showLaborHours" />
      <Toggle label="Total Cost" k="showCosts" />
      <div style={{ display:"flex", gap:8, justifyContent:"flex-end", marginTop:16 }}>
        <Btn variant="secondary" onClick={onClose}>Cancel</Btn>
        <Btn onClick={save}>Save Settings</Btn>
      </div>
    </Modal>
  );
}


/* USAGE TRACKING */

function UsageTracking({ state, dispatch }) {
  const [detailEq, setDetailEq]    = useState(null); /* equipment id for detail modal */
  const [entry, setEntry]          = useState({});   /* {[eqId]: {hours, mileage, fuel, notes, date}} */

  const trackableEq = state.equipment.filter(e=>e.trackUsage);
  const allLogs     = state.usageLogs || [];

  const logsFor  = (eqId) => allLogs.filter(l=>l.equipmentId===eqId).sort((a,b)=>b.date.localeCompare(a.date));
  /* Current reading = most recent log entry value (not cumulative) */
  const currentOf = (eqId, field) => {
    const logs = logsFor(eqId);
    const latest = logs.find(l=>l[field]);
    return latest ? +(latest[field]||0) : 0;
  };
  /* Fuel IS cumulative (gallons added each fill-up) */
  const totalFuelOf = (eqId) => logsFor(eqId).reduce((s,l)=>s+(+(l.fuel||0)),0);

  const eqEntry  = (eqId) => entry[eqId] || { date:today(), hours:"", mileage:"", fuel:"", notes:"" };
  const setEqEntry = (eqId, k, v) => setEntry(prev=>({...prev,[eqId]:{...eqEntry(eqId),[k]:v}}));

  const save = (eq) => {
    const e = eqEntry(eq.id);
    if(!e.hours && !e.mileage && !e.fuel) { alert("Enter at least one value."); return; }
    dispatch({ type:"ADD_USAGE_LOG", payload:{ ...e, equipmentId:eq.id, id:genId("UL") }});
    setEntry(prev=>({...prev,[eq.id]:{ date:today(), hours:"", mileage:"", fuel:"", notes:"" }}));
  };

  const del = id => { if(confirm("Delete this entry?")) dispatch({type:"DELETE_USAGE_LOG", payload:id}); };

  /* Detail modal for an equipment */
  const renderDetailModal = (eqId) => {
    const eq   = state.equipment.find(e=>e.id===eqId);
    if(!eq) return null;
    const logs = logsFor(eqId);
    const mode = eq.usageType||"hours";
    const showH = mode==="hours"||mode==="both";
    const showM = mode==="mileage"||mode==="both";
    const totH  = currentOf(eqId,"hours");
    const totM  = currentOf(eqId,"mileage");
    const totF  = totalFuelOf(eqId);
    return (
      <Modal title={eq.name+" — Usage Report"} onClose={()=>setDetailEq(null)}>
        <div style={{ display:"flex", gap:10, marginBottom:16, flexWrap:"wrap" }}>
          {showH&&<div style={{ flex:1, background:"#eff6ff", borderRadius:8, padding:"12px 16px", border:"1px solid #bfdbfe", minWidth:120 }}>
            <div style={{ fontFamily:T.sans, fontSize:10, fontWeight:700, color:"#1e40af", textTransform:"uppercase", letterSpacing:.5 }}>Total Hours</div>
            <div style={{ fontFamily:T.sans, fontSize:28, fontWeight:800, color:"#1e40af" }}>{totH.toFixed(1)}</div>
          </div>}
          {showM&&<div style={{ flex:1, background:"#f0fdf4", borderRadius:8, padding:"12px 16px", border:"1px solid #86efac", minWidth:120 }}>
            <div style={{ fontFamily:T.sans, fontSize:10, fontWeight:700, color:T.green, textTransform:"uppercase", letterSpacing:.5 }}>Total Mileage</div>
            <div style={{ fontFamily:T.sans, fontSize:28, fontWeight:800, color:T.green }}>{totM.toLocaleString()}</div>
          </div>}
          <div style={{ flex:1, background:"#faf5ff", borderRadius:8, padding:"12px 16px", border:"1px solid #e9d5ff", minWidth:120 }}>
            <div style={{ fontFamily:T.sans, fontSize:10, fontWeight:700, color:"#7c3aed", textTransform:"uppercase", letterSpacing:.5 }}>Total Fuel (gal)</div>
            <div style={{ fontFamily:T.sans, fontSize:28, fontWeight:800, color:"#7c3aed" }}>{totF.toFixed(1)}</div>
          </div>
          <div style={{ flex:1, background:T.grayLt, borderRadius:8, padding:"12px 16px", border:`1px solid ${T.border}`, minWidth:120 }}>
            <div style={{ fontFamily:T.sans, fontSize:10, fontWeight:700, color:T.muted, textTransform:"uppercase", letterSpacing:.5 }}>Log Entries</div>
            <div style={{ fontFamily:T.sans, fontSize:28, fontWeight:800, color:T.text }}>{logs.length}</div>
          </div>
        </div>
        <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13, fontFamily:T.sans }}>
          <thead>
            <tr style={{ background:T.grayLt, borderBottom:`1px solid ${T.border}` }}>
              {["Date", showH&&"Hours", showM&&"Mileage","Fuel (gal)","Notes",""].filter(Boolean).map(h=>(
                <th key={h} style={{ padding:"7px 12px", textAlign:"left", fontSize:11, fontWeight:700, color:T.muted, textTransform:"uppercase", letterSpacing:.4 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {logs.map((l,i)=>(
              <tr key={l.id} style={{ borderBottom:`1px solid ${T.border}`, background:i%2===0?"#fff":T.grayLt }}>
                <td style={{ padding:"8px 12px", fontFamily:T.mono, fontSize:12 }}>{l.date}</td>
                {showH&&<td style={{ padding:"8px 12px", fontFamily:T.mono, fontSize:12, color:l.hours?"#1e40af":T.muted }}>{l.hours||"—"}</td>}
                {showM&&<td style={{ padding:"8px 12px", fontFamily:T.mono, fontSize:12, color:l.mileage?T.green:T.muted }}>{l.mileage?Number(l.mileage).toLocaleString():"—"}</td>}
                <td style={{ padding:"8px 12px", fontFamily:T.mono, fontSize:12, color:l.fuel?"#7c3aed":T.muted }}>{l.fuel||"—"}</td>
                <td style={{ padding:"8px 12px", color:T.subtext, fontSize:12 }}>{l.notes||""}</td>
                <td style={{ padding:"8px 12px" }}>
                  <button onClick={()=>del(l.id)} style={{ background:"none", border:"none", color:T.red, cursor:"pointer", fontFamily:T.sans, fontSize:12, fontWeight:600 }}>Del</button>
                </td>
              </tr>
            ))}
            {logs.length===0&&<tr><td colSpan={6} style={{ padding:28, textAlign:"center", color:T.muted, fontFamily:T.sans, fontSize:13 }}>No entries yet.</td></tr>}
          </tbody>
        </table>
      </Modal>
    );
  };

  if(trackableEq.length===0) return (
    <Card>
      <div style={{ textAlign:"center", padding:"48px 0", color:T.muted, fontFamily:T.sans }}>
        <div style={{ fontSize:48, marginBottom:12 }}>📊</div>
        <div style={{ fontSize:15, fontWeight:600, color:T.text, marginBottom:6 }}>No equipment has usage tracking enabled</div>
        <div style={{ fontSize:13 }}>Go to Equipment, edit a record, and turn on Usage Tracking.</div>
      </div>
    </Card>
  );

  return (
    <div>
      {detailEq && renderDetailModal(detailEq)}

      <Card style={{ padding:0, overflow:"hidden" }}>
        {/* Table header */}
        <div style={{ display:"grid", gridTemplateColumns:"220px 80px 120px 120px 80px 1fr 110px 110px 40px", background:T.grayLt, borderBottom:`2px solid ${T.borderHi}`, padding:"9px 16px", gap:8, alignItems:"center" }}>
          {["Equipment","Equip #","Current Hours","Current Miles","Fuel (gal)","Notes","Date","Track by",""].map(h=>(
            <div key={h} style={{ fontFamily:T.sans, fontSize:10, fontWeight:700, color:T.muted, textTransform:"uppercase", letterSpacing:.5 }}>{h}</div>
          ))}
        </div>

        {trackableEq.map((eq,idx)=>{
          const mode  = eq.usageType||"hours";
          const showH = mode==="hours"||mode==="both";
          const showM = mode==="mileage"||mode==="both";
          const totH  = currentOf(eq.id,"hours");
          const totM  = currentOf(eq.id,"mileage");
          const totF  = totalFuelOf(eq.id);
          const e     = eqEntry(eq.id);
          const rs    = eq.status==="Out of Service / Deadline" ? {bg:"#fff5f5",left:"3px solid #ef4444"} :
                        eq.status==="Operational with Deficiencies" ? {bg:"#fffdf0",left:"3px solid #f59e0b"} :
                        {bg:"#fff",left:"3px solid #22c55e"};

          return (
            <div key={eq.id} style={{ borderBottom:`1px solid ${T.border}`, background:idx%2===0?rs.bg:"#fafbfc", borderLeft:rs.left }}>

              {/* Data row */}
              <div style={{ display:"grid", gridTemplateColumns:"220px 80px 120px 120px 80px 1fr 110px 110px 40px", padding:"10px 16px", gap:8, alignItems:"center" }}>

                {/* Equipment name — click to open detail */}
                <button onClick={()=>setDetailEq(eq.id)} style={{ background:"none", border:"none", cursor:"pointer", textAlign:"left", padding:0 }}>
                  <div style={{ fontFamily:T.sans, fontSize:13, fontWeight:700, color:T.accent, textDecoration:"underline", textDecorationStyle:"dotted" }}>{eq.name}</div>
                  <div style={{ fontFamily:T.sans, fontSize:11, color:T.muted, marginTop:1 }}>{eq.category||eq.type||""}</div>
                </button>

                {/* Equip # */}
                <div style={{ fontFamily:T.mono, fontSize:11, color:T.subtext }}>{eq.id}</div>

                {/* Current Hours */}
                <div>
                  {showH
                    ? <div style={{ fontFamily:T.sans, fontSize:18, fontWeight:700, color:"#1e40af" }}>{totH.toFixed(1)} <span style={{ fontSize:11, fontWeight:400, color:"#1e40af" }}>hrs</span></div>
                    : <div style={{ fontFamily:T.sans, fontSize:12, color:T.muted }}>—</div>
                  }
                </div>

                {/* Current Mileage */}
                <div>
                  {showM
                    ? <div style={{ fontFamily:T.sans, fontSize:18, fontWeight:700, color:T.green }}>{totM.toLocaleString()} <span style={{ fontSize:11, fontWeight:400, color:T.green }}>mi</span></div>
                    : <div style={{ fontFamily:T.sans, fontSize:12, color:T.muted }}>—</div>
                  }
                </div>

                {/* Fuel */}
                <div style={{ fontFamily:T.sans, fontSize:18, fontWeight:700, color:"#7c3aed" }}>{totF.toFixed(1)} <span style={{ fontSize:11, fontWeight:400 }}>gal</span></div>

                {/* Notes input */}
                <input style={{ ...inp, fontSize:12 }} placeholder="Notes..." value={e.notes} onChange={ev=>setEqEntry(eq.id,"notes",ev.target.value)} onKeyDown={ev=>ev.key==="Enter"&&save(eq)} />

                {/* Date input */}
                <input style={{ ...inp, fontSize:12 }} type="date" value={e.date} onChange={ev=>setEqEntry(eq.id,"date",ev.target.value)} />

                {/* Track mode pills */}
                <div style={{ display:"flex", gap:3, flexWrap:"wrap" }}>
                  {[["H","hours"],["Mi","mileage"],["Both","both"]].map(([lbl,v])=>(
                    <button key={v} onClick={()=>dispatch({type:"UPDATE_EQ",payload:{...eq,usageType:v}})} style={{ padding:"2px 6px", borderRadius:4, border:`1px solid ${mode===v?T.accent:T.border}`, background:mode===v?T.accentLt:"#fff", color:mode===v?T.accent:T.muted, cursor:"pointer", fontFamily:T.mono, fontSize:10, fontWeight:mode===v?700:400 }}>{lbl}</button>
                  ))}
                </div>

                {/* Log entry count */}
                <div style={{ fontFamily:T.mono, fontSize:11, color:T.muted, textAlign:"center" }}>{logsFor(eq.id).length} logs</div>
              </div>

              {/* New entry input row */}
              <div style={{ display:"grid", gridTemplateColumns:"220px 80px 120px 120px 80px 1fr 110px 110px 40px", padding:"6px 16px 10px", gap:8, alignItems:"center", background:"#f0f8ff", borderTop:`1px dashed ${T.border}` }}>
                <div style={{ fontFamily:T.sans, fontSize:10, fontWeight:700, color:T.accent, textTransform:"uppercase", letterSpacing:.5 }}>New Entry</div>
                <div/>
                {/* Hours input */}
                <input
                  style={{ ...inp, fontSize:12, border:`1px solid ${showH?"#bfdbfe":T.border}`, background:showH?"#fff":"#f3f4f6", color:showH?T.text:T.muted }}
                  type="number" step="0.1" min="0"
                  placeholder={showH?"e.g. 523.5":"N/A"}
                  disabled={!showH}
                  value={e.hours}
                  onChange={ev=>setEqEntry(eq.id,"hours",ev.target.value)}
                  onKeyDown={ev=>ev.key==="Enter"&&save(eq)}
                />
                {/* Mileage input */}
                <input
                  style={{ ...inp, fontSize:12, border:`1px solid ${showM?"#86efac":T.border}`, background:showM?"#fff":"#f3f4f6", color:showM?T.text:T.muted }}
                  type="number" min="0"
                  placeholder={showM?"e.g. 24580":"N/A"}
                  disabled={!showM}
                  value={e.mileage}
                  onChange={ev=>setEqEntry(eq.id,"mileage",ev.target.value)}
                  onKeyDown={ev=>ev.key==="Enter"&&save(eq)}
                />
                {/* Fuel input */}
                <input
                  style={{ ...inp, fontSize:12, border:"1px solid #e9d5ff" }}
                  type="number" step="0.1" min="0"
                  placeholder="e.g. 18.5"
                  value={e.fuel}
                  onChange={ev=>setEqEntry(eq.id,"fuel",ev.target.value)}
                  onKeyDown={ev=>ev.key==="Enter"&&save(eq)}
                />
                <div/><div/>
                {/* Save button */}
                <div style={{ display:"flex", gap:6, alignItems:"center" }}>
                  <Btn small onClick={()=>save(eq)} style={{ whiteSpace:"nowrap" }}>+ Log</Btn>
                  <span style={{ fontFamily:T.sans, fontSize:9, color:T.muted }}>or Enter</span>
                </div>
                <div/>
              </div>
            </div>
          );
        })}
      </Card>
    </div>
  );
}


function EquipmentInventory({ state, dispatch }) {
  const [tab, setInvTab]    = useState("active"); /* "active" | "turnedin" */
  const [modal, setModal]   = useState(null); /* "add" | "turnin" | item-object */
  const [form, setForm]     = useState({});
  const [turnInForm, setTurnInForm] = useState({ equipmentId:"", reason:"", date:today(), paperwork:"" });
  const [search, setSearch] = useState("");
  const F = k => e => setForm(f=>({...f,[k]:e.target.value}));

  /* Combine equipment from Equipment tab with inventory-only items */
  const eqAsInventory = (state.equipment||[]).map(e=>({
    id: e.id, name: e.name, eilNumber: e.eilNumber, serial: e.serial,
    category: e.category, location: e.location, make: e.make, model: e.model, year: e.year,
    acquisitionDate: e.acquisitionDate, acquisitionCost: e.acquisitionCost,
    notes: e.notes, condition: e.condition||"Good",
    turnInStatus: e.turnInStatus||"Active",
    turnInReason: e.turnInReason, turnInDate: e.turnInDate, turnInPaperwork: e.turnInPaperwork,
    _source: "equipment",
  }));
  const invOnly = (state.inventoryItems||[]).map(i=>({...i, _source:"inventory"}));
  const items    = [...eqAsInventory, ...invOnly];
  const active   = items.filter(i=>!["Turned-in","Disposed"].includes(i.turnInStatus));
  const archived = items.filter(i=>["Turned-in","Disposed"].includes(i.turnInStatus));

  const filtered = (tab==="active"?active:archived).filter(i=>
    `${i.name} ${i.eilNumber||""} ${i.serial||""} ${i.location||""}`.toLowerCase().includes(search.toLowerCase())
  );

  const CONDITIONS = ["New","Good","Poor","Damaged"];
  const TURNIN_STATUSES = ["Pending Turn-in","Turn-in Initiated","Turned-in","Disposed"];

  const openAdd = () => { setForm({ condition:"Good", date:today() }); setModal("add"); };
  const openTurnIn = () => { setTurnInForm({ equipmentId:"", reason:"", date:today(), paperwork:"" }); setModal("turnin"); };
  const openItem = item => { setForm({...item}); setModal(item); };

  const save = () => {
    if(!form.name) return alert("Name required.");
    if(modal==="add") {
      dispatch({type:"ADD_INV", payload:{...form, id:genId("INV"), turnInStatus:"Active"}});
    } else {
      /* Route to equipment vs inventoryItems based on source */
      if(form._source==="equipment") {
        const orig = state.equipment.find(e=>e.id===form.id);
        dispatch({type:"UPDATE_EQ", payload:{...orig, ...form}});
      } else {
        dispatch({type:"UPDATE_INV", payload:form});
      }
    }
    setModal(null);
  };

  const saveTurnIn = () => {
    if(!turnInForm.equipmentId) return alert("Select equipment.");
    if(!turnInForm.reason)      return alert("Enter turn-in reason.");
    const item = items.find(i=>i.id===turnInForm.equipmentId);
    if(!item) return;
    /* Merge turn-in docs into the item's documents folder so they show under the equipment */
    const tiDocs = (turnInForm.documents||[]).map(d=>({...d, category:"Turn-in"}));
    const mergedDocs = [...(item.documents||[]), ...tiDocs];
    const payloadBase = { turnInStatus:"Pending Turn-in", turnInReason:turnInForm.reason, turnInDate:turnInForm.date, turnInPaperwork:turnInForm.paperwork, turnInDocuments:tiDocs, documents:mergedDocs };
    if(item._source==="equipment") {
      const orig = state.equipment.find(e=>e.id===item.id);
      dispatch({type:"UPDATE_EQ", payload:{...orig, ...payloadBase}});
    } else {
      dispatch({type:"UPDATE_INV", payload:{...item, ...payloadBase}});
    }
    setModal(null);
  };

  const updateStatus = (item, status) => {
    if(item._source==="equipment") {
      const orig = state.equipment.find(e=>e.id===item.id);
      dispatch({type:"UPDATE_EQ", payload:{...orig, turnInStatus:status}});
    } else {
      dispatch({type:"UPDATE_INV", payload:{...item, turnInStatus:status}});
    }
    setModal(null);
  };

  const del = id => {
    if(!confirm("Permanently delete this inventory item?")) return;
    const item = items.find(i=>i.id===id);
    if(item?._source==="equipment") {
      dispatch({type:"DELETE_EQ", payload:id});
    } else {
      dispatch({type:"DELETE_INV", payload:id});
    }
  };

  const statusColor = s => s==="Turned-in"?T.red:s==="Disposed"?"#6b7280":s==="Pending Turn-in"?T.amber:s==="Turn-in Initiated"?"#7c3aed":T.green;

  return (
    <div>
      {/* Tabs */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14, flexWrap:"wrap", gap:8 }}>
        <div style={{ display:"flex", gap:0, border:`1px solid ${T.border}`, borderRadius:7, overflow:"hidden" }}>
          {[["active","Active Equipment",""],["turnedin","Turned-in / Disposed",""]].map(([v,l],i)=>(
            <button key={v} onClick={()=>setInvTab(v)} style={{ padding:"7px 18px", border:"none", borderLeft:i>0?`1px solid ${T.border}`:"none", background:tab===v?T.accent:"#fff", color:tab===v?"#fff":T.subtext, cursor:"pointer", fontFamily:T.sans, fontSize:12, fontWeight:tab===v?600:400 }}>{l} ({v==="active"?active.length:archived.length})</button>
          ))}
        </div>
        <div style={{ display:"flex", gap:8 }}>
          <input style={{ ...inp, maxWidth:220 }} placeholder="Search inventory..." value={search} onChange={e=>setSearch(e.target.value)} />
          {tab==="active" && <Btn variant="secondary" onClick={openTurnIn}>Turn In Equipment</Btn>}
          {tab==="active" && <Btn onClick={openAdd}>+ Add Item</Btn>}
        </div>
      </div>

      {/* Inventory Table */}
      <Card style={{ padding:0, overflow:"hidden" }}>
        <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13, fontFamily:T.sans }}>
          <thead>
            <tr style={{ background:T.grayLt, borderBottom:`1px solid ${T.border}` }}>
              {["EIL #","Name","Category","Serial #","Location","Condition","Status","Value",""].map(h=>(
                <th key={h} style={{ padding:"9px 12px", textAlign:"left", fontWeight:600, fontSize:11, color:T.muted, textTransform:"uppercase", letterSpacing:.4, whiteSpace:"nowrap" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((item,i)=>(
              <tr key={item.id} onClick={()=>openItem(item)} style={{ borderBottom:`1px solid ${T.border}`, background:i%2===0?"#fff":T.grayLt, cursor:"pointer" }}
                onMouseEnter={e=>e.currentTarget.style.background=T.accentLt}
                onMouseLeave={e=>e.currentTarget.style.background=i%2===0?"#fff":T.grayLt}>
                <td style={{ padding:"10px 12px", fontFamily:T.mono, fontSize:11, color:T.muted }}>{item.eilNumber||"—"}</td>
                <td style={{ padding:"10px 12px", fontWeight:600, color:T.text }}>{item.name}</td>
                <td style={{ padding:"10px 12px", color:T.subtext }}>{item.category||"—"}</td>
                <td style={{ padding:"10px 12px", fontFamily:T.mono, fontSize:11, color:T.muted }}>{item.serial||"—"}</td>
                <td style={{ padding:"10px 12px", color:T.subtext }}>{item.location||"—"}</td>
                <td style={{ padding:"10px 12px" }}>
                  <span style={{ fontFamily:T.sans, fontSize:11, fontWeight:600, padding:"2px 8px", borderRadius:4, border:`1px solid ${item.condition==="New"?"#22c55e":item.condition==="Good"?T.accent:item.condition==="Poor"?T.amber:T.red}`, color:item.condition==="New"?"#22c55e":item.condition==="Good"?T.accent:item.condition==="Poor"?T.amber:T.red }}>{item.condition||"—"}</span>
                </td>
                <td style={{ padding:"10px 12px" }}>
                  <span style={{ fontFamily:T.sans, fontSize:11, fontWeight:600, color:statusColor(item.turnInStatus||"Active") }}>{item.turnInStatus||"Active"}</span>
                </td>
                <td style={{ padding:"10px 12px", fontFamily:T.mono, fontSize:12 }}>${(+(item.acquisitionCost||0)).toLocaleString()}</td>
                <td style={{ padding:"10px 12px" }} onClick={e=>e.stopPropagation()}>
                  <Btn small variant="danger" onClick={()=>del(item.id)}>Del</Btn>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length===0 && <div style={{ padding:40, textAlign:"center", color:T.muted, fontFamily:T.sans, fontSize:13 }}>{tab==="active"?"No active inventory items.":"No turned-in equipment."}</div>}
      </Card>

      {/* Add / Edit Item modal */}
      {(modal==="add"||typeof modal==="object"&&modal?.id)&&(
        <Modal title={modal==="add"?"Add Inventory Item":`Edit — ${form.name}`} onClose={()=>setModal(null)}>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"0 16px" }}>
            <Field label="EIL #" half><input style={inp} value={form.eilNumber||""} onChange={F("eilNumber")} placeholder="EIL-0001" /></Field>
            <Field label="Item Name"><input style={inp} value={form.name||""} onChange={F("name")} /></Field>
            <Field label="Category" half><input style={inp} value={form.category||""} onChange={F("category")} /></Field>
            <Field label="Serial Number" half><input style={inp} value={form.serial||""} onChange={F("serial")} /></Field>
            <div style={{ marginBottom:14 }}>
              <label style={{ display:"block", fontFamily:T.sans, fontSize:12, fontWeight:600, color:T.subtext, marginBottom:5 }}>Condition</label>
              <div style={{ display:"flex", gap:6 }}>
                {CONDITIONS.map(c=>(
                  <button key={c} type="button" onClick={()=>setForm(f=>({...f,condition:c}))} style={{ flex:1, padding:"6px 0", borderRadius:6, border:`1px solid ${form.condition===c?T.accent:T.border}`, background:form.condition===c?T.accentLt:"#fff", color:form.condition===c?T.accent:T.subtext, cursor:"pointer", fontFamily:T.sans, fontSize:12, fontWeight:form.condition===c?700:400 }}>{c}</button>
                ))}
              </div>
            </div>
            <Field label="Location" half>
              <select style={sel} value={form.location||""} onChange={F("location")}>
                <option value="">-- Select Location --</option>
                {(state.settings?.locations||[]).map(l=><option key={l}>{l}</option>)}
                {!(state.settings?.locations?.length) && ["Main Shop","Motor Pool","Storage"].map(l=><option key={l}>{l}</option>)}
              </select>
            </Field>
            <Field label="Make / Manufacturer" half><input style={inp} value={form.make||""} onChange={F("make")} /></Field>
            <Field label="Model" half><input style={inp} value={form.model||""} onChange={F("model")} /></Field>
            <Field label="Year" half><input style={inp} type="number" value={form.year||""} onChange={F("year")} /></Field>
            <Field label="Acquisition Date" half><input style={inp} type="date" value={form.acquisitionDate||""} onChange={F("acquisitionDate")} /></Field>
            <Field label="Acquisition Cost ($)" half><input style={inp} type="number" value={form.acquisitionCost||""} onChange={F("acquisitionCost")} /></Field>
            <Field label="Notes"><textarea style={{ ...inp, minHeight:60, resize:"vertical" }} value={form.notes||""} onChange={F("notes")} /></Field>
            <div style={{ gridColumn:"span 2", marginBottom:14 }}>
              <DocUploader label="Documents Folder (receipts, manuals, inspections, repairs, etc.)" category="General" documents={form.documents||[]} onChange={docs=>setForm(f=>({...f,documents:docs}))} />
            </div>
            {typeof modal==="object"&&modal?.id&&(
              <div style={{ gridColumn:"span 2", marginBottom:14 }}>
                <label style={{ display:"block", fontFamily:T.sans, fontSize:12, fontWeight:600, color:T.subtext, marginBottom:6 }}>Turn-in Status</label>
                <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                  {["Active",...TURNIN_STATUSES].map(s=>(
                    <button key={s} type="button" onClick={()=>setForm(f=>({...f,turnInStatus:s}))} style={{ padding:"5px 12px", borderRadius:6, border:`1px solid ${form.turnInStatus===s?T.accent:T.border}`, background:form.turnInStatus===s?T.accentLt:"#fff", color:form.turnInStatus===s?T.accent:T.subtext, cursor:"pointer", fontFamily:T.sans, fontSize:11, fontWeight:form.turnInStatus===s?700:400 }}>{s}</button>
                  ))}
                </div>
              </div>
            )}
          </div>
          <div style={{ display:"flex", gap:8, justifyContent:"flex-end", marginTop:8 }}>
            <Btn variant="secondary" onClick={()=>setModal(null)}>Cancel</Btn>
            <Btn onClick={save}>Save</Btn>
          </div>
        </Modal>
      )}

      {/* Turn-in modal */}
      {modal==="turnin"&&(
        <Modal title="Equipment Turn-in" onClose={()=>setModal(null)}>
          <p style={{ margin:"0 0 14px", fontFamily:T.sans, fontSize:13, color:T.subtext }}>Initiate a turn-in for an equipment item. It will move to the Turned-in tab once completed.</p>
          <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
            <div>
              <label style={{ display:"block", fontFamily:T.sans, fontSize:12, fontWeight:600, color:T.subtext, marginBottom:5 }}>Select Equipment *</label>
              <select style={sel} value={turnInForm.equipmentId} onChange={e=>setTurnInForm(f=>({...f,equipmentId:e.target.value}))}>
                <option value="">-- Select Item --</option>
                {active.map(i=><option key={i.id} value={i.id}>{i.name} ({i.eilNumber||i.id})</option>)}
              </select>
            </div>
            <Field label="Turn-in Date"><input style={inp} type="date" value={turnInForm.date} onChange={e=>setTurnInForm(f=>({...f,date:e.target.value}))} /></Field>
            <Field label="Reason for Turn-in *"><textarea style={{ ...inp, minHeight:70, resize:"vertical" }} value={turnInForm.reason} onChange={e=>setTurnInForm(f=>({...f,reason:e.target.value}))} placeholder="Describe the reason for turn-in..." /></Field>
            <div>
              <label style={{ display:"block", fontFamily:T.sans, fontSize:12, fontWeight:600, color:T.subtext, marginBottom:5 }}>Reference Notes</label>
              <textarea style={{ ...inp, minHeight:50, resize:"vertical" }} value={turnInForm.paperwork} onChange={e=>setTurnInForm(f=>({...f,paperwork:e.target.value}))} placeholder="DA forms, document numbers, additional notes..." />
            </div>
            <DocUploader label="Turn-in Documentation" category="Turn-in" documents={turnInForm.documents||[]} onChange={docs=>setTurnInForm(f=>({...f,documents:docs}))} />
          </div>
          <div style={{ display:"flex", gap:8, justifyContent:"flex-end", marginTop:14 }}>
            <Btn variant="secondary" onClick={()=>setModal(null)}>Cancel</Btn>
            <Btn onClick={saveTurnIn}>Initiate Turn-in</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}


function reportHeaderHTML(state, title) {
  const s = state.settings || {};
  const companyName = s.companyName || "National Cemetery Administration";
  const dept = s.department || "Maintenance Department";
  const logo = s.logo || "";
  return `<div style="display:flex;align-items:center;gap:16px;border-bottom:3px solid #1a1a2e;padding-bottom:14px;margin-bottom:16px">
    ${logo?`<img src="${logo}" style="height:60px;max-width:120px;object-fit:contain" alt="logo">`:""}
    <div>
      <div style="font-size:18px;font-weight:700;color:#1a1a2e">${companyName}</div>
      <div style="font-size:12px;color:#666;margin-top:2px">${dept}</div>
      <div style="font-size:16px;font-weight:700;color:#333;margin-top:4px">${title}</div>
    </div>
    <div style="margin-left:auto;text-align:right;font-size:11px;color:#888">
      Generated: ${new Date().toLocaleDateString()}<br>
      ${s.location||""}${s.phone?`<br>${s.phone}`:""}
    </div>
  </div>`;
}

function ReportPartsInv({ state }) {
  const totalVal = state.parts.reduce((s,p)=>s+(+p.qty*(+p.unitCost||0)),0);
  const lowParts = state.parts.filter(p=>p.lowStockAlert!==false&&p.qty<=(p.minQty||0));
  const sorted = [...state.parts].sort((a,b)=>(a.partNumber||"").localeCompare(b.partNumber||""));
  const exportRows = sorted.map(p=>{ const eq = p.equipmentId?state.equipment.find(e=>e.id===p.equipmentId):null; return {"Part #":p.partNumber||"", Name:p.name||"", Category:p.category||"", Location:p.location||"", "Equipment / Model":eq?`${eq.name} (${eq.id})`:(p.modelFit||""), "Unit $":(+p.unitCost||0).toFixed(2), Qty:p.qty||0, "Total $":(p.qty*(+p.unitCost||0)).toFixed(2)}; });

  const print = () => {
    const win = window.open("","_blank","width=900,height=700");
    if(!win) return;
    win.document.write(`<!DOCTYPE html><html><head><title>Parts Inventory Report</title>
      <style>body{font-family:Arial,sans-serif;padding:24px}h1{font-size:18px;margin-bottom:2px}p{font-size:12px;color:#666;margin:0 0 14px}table{width:100%;border-collapse:collapse;font-size:12px}th{background:#1a1a2e;color:#fff;padding:6px 10px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:.5px}td{padding:6px 10px;border-bottom:1px solid #e5e7eb}.low{background:#fff5f5}.total-row td{font-weight:700;background:#f3f4f6;font-size:13px;border-top:2px solid #1a1a2e}@media print{button{display:none}}</style>
      </head><body>
      <h1>Parts Inventory Report</h1>
      <p>Generated: ${new Date().toLocaleDateString()} | Total SKUs: ${state.parts.length} | Total Value: $${totalVal.toFixed(2)} | Low Stock Items: ${lowParts.length}</p>
      <table>
        <tr><th>Part #</th><th>Name</th><th>Category</th><th>Location</th><th>Equipment / Model</th><th style="text-align:right">Unit $</th><th style="text-align:right">Qty</th><th style="text-align:right">Total $</th><th>New Count</th></tr>
        ${sorted.map(p=>{
          const eq = p.equipmentId?state.equipment.find(e=>e.id===p.equipmentId):null;
          const low = p.qty<=(p.minQty||0)&&p.lowStockAlert!==false;
          return `<tr class="${low?"low":""}"><td>${p.partNumber||"—"}</td><td>${p.name}${low?" &#9888;":""}</td><td>${p.category||"—"}</td><td>${p.location||"—"}</td><td>${eq?`${eq.name} (${eq.id})`:p.modelFit||"—"}</td><td style="text-align:right">$${(+p.unitCost||0).toFixed(2)}</td><td style="text-align:right">${p.qty}</td><td style="text-align:right">$${(p.qty*(+p.unitCost||0)).toFixed(2)}</td><td style="border-bottom:1px solid #999;min-width:80px">&nbsp;</td></tr>`;
        }).join("")}
        <tr class="total-row"><td colspan="7" style="text-align:right;padding:8px 10px">TOTAL INVENTORY VALUE</td><td style="text-align:right;padding:8px 10px">$${totalVal.toFixed(2)}</td><td></td></tr>
      </table>
      ${reportButtonsHtml(exportRows)}
      </body></html>`);
    win.document.close();
  };

  return (
    <div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(160px,1fr))", gap:12, marginBottom:16 }}>
        {[["Total SKUs",state.parts.length,T.text],["Total Value","$"+totalVal.toFixed(2),T.accent],["Low Stock",lowParts.length,T.red]].map(([l,v,c])=>(
          <Card key={l} style={{ padding:"14px 16px" }}><div style={{ fontFamily:T.sans, fontSize:22, fontWeight:700, color:c }}>{v}</div><div style={{ fontFamily:T.sans, fontSize:12, color:T.muted, marginTop:3 }}>{l}</div></Card>
        ))}
      </div>
      <div style={{ display:"flex", justifyContent:"flex-end", gap:8, marginBottom:12 }}><Btn onClick={print}>Print / PDF</Btn><Btn variant="secondary" onClick={()=>downloadCSV("parts-inventory-report.csv", exportRows)}>Excel CSV</Btn></div>
      <Card style={{ padding:0, overflow:"hidden" }}>
        <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13, fontFamily:T.sans }}>
          <thead><tr style={{ background:T.grayLt, borderBottom:`1px solid ${T.border}` }}>
            {["Part #","Name","Category","Location","Equipment / Model","Unit $","Qty","Total $"].map(h=>(
              <th key={h} style={{ padding:"9px 12px", textAlign:"left", fontWeight:600, fontSize:11, color:T.muted, textTransform:"uppercase", letterSpacing:.4 }}>{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {sorted.map((p,i)=>{
              const eq = p.equipmentId?state.equipment.find(e=>e.id===p.equipmentId):null;
              const isLow = p.lowStockAlert!==false&&p.qty<=(p.minQty||0);
              return (
                <tr key={p.id} style={{ borderBottom:`1px solid ${T.border}`, background:isLow?"#fff8f8":i%2===0?"#fff":T.grayLt }}>
                  <td style={{ padding:"9px 12px", fontFamily:T.mono, fontSize:12, color:T.accent }}>{p.partNumber||"—"}</td>
                  <td style={{ padding:"9px 12px", fontWeight:500 }}>{p.name}{isLow&&<span style={{ color:T.red, marginLeft:6, fontSize:11 }}>⚠</span>}</td>
                  <td style={{ padding:"9px 12px", color:T.subtext }}>{p.category||"—"}</td>
                  <td style={{ padding:"9px 12px", color:T.muted }}>{p.location||"—"}</td>
                  <td style={{ padding:"9px 12px", color:T.subtext }}>{eq?`${eq.name} (${eq.id})`:p.modelFit||"—"}</td>
                  <td style={{ padding:"9px 12px", fontFamily:T.mono, fontSize:12 }}>${(+p.unitCost||0).toFixed(2)}</td>
                  <td style={{ padding:"9px 12px", fontFamily:T.mono, fontSize:13, fontWeight:700, color:isLow?T.red:T.green }}>{p.qty}</td>
                  <td style={{ padding:"9px 12px", fontFamily:T.mono, fontSize:12 }}>${(p.qty*(+p.unitCost||0)).toFixed(2)}</td>
                </tr>
              );
            })}
            <tr style={{ background:T.grayLt, borderTop:`2px solid ${T.border}` }}>
              <td colSpan={7} style={{ padding:"10px 12px", fontFamily:T.sans, fontSize:13, fontWeight:700, textAlign:"right" }}>TOTAL VALUE</td>
              <td style={{ padding:"10px 12px", fontFamily:T.mono, fontSize:14, fontWeight:700, color:T.accent }}>${totalVal.toFixed(2)}</td>
            </tr>
          </tbody>
        </table>
      </Card>
    </div>
  );
}

function ReportUsage({ state }) {
  const [selEq, setSelEq]       = useState("all");
  const [viewMode, setViewMode] = useState("all"); /* "all" | "monthly" | "annual" */

  const trackableEq = state.equipment.filter(e=>e.trackUsage);
  const allLogs     = state.usageLogs || [];
  const logsFor     = (eqId) => allLogs.filter(l=>l.equipmentId===eqId).sort((a,b)=>a.date.localeCompare(b.date));

  const currentHours   = (eqId) => { const l=logsFor(eqId).filter(x=>x.hours).pop(); return l?+(l.hours||0):0; };
  const currentMileage = (eqId) => { const l=logsFor(eqId).filter(x=>x.mileage).pop(); return l?+(l.mileage||0):0; };
  const totalFuel      = (eqId) => logsFor(eqId).reduce((s,l)=>s+(+(l.fuel||0)),0);

  /* Monthly breakdown */
  const byMonth = (eqId) => {
    const result = {};
    logsFor(eqId).forEach(l=>{
      const m = l.date.slice(0,7);
      if(!result[m]) result[m] = {hours:0,mileage:0,fuel:0,count:0,lastHours:0,lastMileage:0};
      if(l.hours)   { result[m].lastHours   = +(l.hours||0); }
      if(l.mileage) { result[m].lastMileage = +(l.mileage||0); }
      result[m].fuel   += +(l.fuel||0);
      result[m].count  += 1;
    });
    return result;
  };

  const printUsageReport = () => {
    const win = window.open("","_blank","width=900,height=700");
    if(!win) return;
    const eqList = selEq==="all" ? trackableEq : trackableEq.filter(e=>e.id===selEq);
    let body = `<!DOCTYPE html><html><head><title>Usage Report</title>
      <style>body{font-family:Arial;padding:24px}h2{font-size:14px;margin:20px 0 6px;color:#1a1a2e}table{width:100%;border-collapse:collapse;font-size:12px;margin-bottom:16px}th{background:#1a1a2e;color:#fff;padding:6px 10px;text-align:left;font-size:11px}td{padding:6px 10px;border-bottom:1px solid #e5e7eb}.total{font-weight:700;background:#f3f4f6}@media print{button{display:none}}</style>
      </head><body>${reportHeaderHTML(state,"Usage Report")}`;

    eqList.forEach(eq=>{
      const mode=eq.usageType||"hours";
      const months=byMonth(eq.id);
      body += `<h2>${eq.name} (${eq.id}) — ${eq.category||""}</h2>`;
      body += `<p style="font-size:11px;color:#666">Current Hours: <b>${currentHours(eq.id)}</b> | Current Mileage: <b>${currentMileage(eq.id).toLocaleString()}</b> | Total Fuel: <b>${totalFuel(eq.id).toFixed(1)} gal</b> | Log Entries: <b>${logsFor(eq.id).length}</b></p>`;
      body += `<table><tr><th>Month</th><th>Entries</th>${mode!=="mileage"?`<th>Hours (end of month)</th>`:""}${mode!=="hours"?`<th>Mileage (end of month)</th>`:""}${`<th>Fuel Added (gal)</th>`}</tr>`;
      Object.entries(months).sort().forEach(([m,d])=>{
        body+=`<tr><td>${m}</td><td>${d.count}</td>${mode!=="mileage"?`<td>${d.lastHours||"—"}</td>`:""}${mode!=="hours"?`<td>${d.lastMileage?d.lastMileage.toLocaleString():"—"}</td>`:""}${`<td>${d.fuel.toFixed(1)}</td>`}</tr>`;
      });
      if(Object.keys(months).length===0) body+=`<tr><td colspan="5" style="color:#999;font-style:italic">No logs recorded</td></tr>`;
      body+=`</table>`;
    });
    body+=`${reportButtonsHtml(exportRows)}</body></html>`;
    win.document.write(body); win.document.close();
  };

  const eqList = selEq==="all" ? trackableEq : trackableEq.filter(e=>e.id===selEq);
  const exportRows = eqList.flatMap(eq=>logsFor(eq.id).map(l=>({ Equipment:eq.name, "Equip #":eq.id, Date:l.date, Hours:l.hours||"", Mileage:l.mileage||"", "Fuel gal":l.fuel||"", Notes:l.notes||"" })));

  return (
    <div>
      {/* Controls */}
      <Card style={{ marginBottom:16, padding:"14px 18px" }}>
        <div style={{ display:"flex", gap:12, flexWrap:"wrap", alignItems:"center" }}>
          <select style={{ ...sel, width:220 }} value={selEq} onChange={e=>setSelEq(e.target.value)}>
            <option value="all">All Tracked Equipment</option>
            {trackableEq.map(e=><option key={e.id} value={e.id}>{e.name} ({e.id})</option>)}
          </select>
          <div style={{ display:"flex", gap:0, border:`1px solid ${T.border}`, borderRadius:6, overflow:"hidden" }}>
            {[["all","Lifetime"],["monthly","By Month"],["annual","By Year"]].map(([v,l],i)=>(
              <button key={v} onClick={()=>setViewMode(v)} style={{ padding:"6px 14px", border:"none", borderLeft:i>0?`1px solid ${T.border}`:"none", background:viewMode===v?T.accent:"#fff", color:viewMode===v?"#fff":T.subtext, cursor:"pointer", fontFamily:T.sans, fontSize:12, fontWeight:viewMode===v?600:400 }}>{l}</button>
            ))}
          </div>
          <Btn small onClick={printUsageReport}>Print / PDF</Btn>
          <Btn small variant="secondary" onClick={()=>downloadCSV("usage-report.csv", exportRows)}>Excel CSV</Btn>
        </div>
      </Card>

      {/* Current Usage Summary */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(220px,1fr))", gap:12, marginBottom:16 }}>
        {eqList.map(eq=>{
          const mode=eq.usageType||"hours";
          const showH=mode==="hours"||mode==="both";
          const showM=mode==="mileage"||mode==="both";
          return (
            <Card key={eq.id} style={{ padding:"14px 16px" }}>
              <div style={{ fontFamily:T.sans, fontSize:13, fontWeight:700, color:T.text, marginBottom:4 }}>{eq.name}</div>
              <div style={{ fontFamily:T.mono, fontSize:10, color:T.muted, marginBottom:10 }}>{eq.id}</div>
              <div style={{ display:"flex", gap:10, flexWrap:"wrap" }}>
                {showH&&<div><div style={{ fontFamily:T.sans, fontSize:9, color:"#1e40af", fontWeight:700, textTransform:"uppercase" }}>Hours</div><div style={{ fontFamily:T.sans, fontSize:20, fontWeight:800, color:"#1e40af" }}>{currentHours(eq.id).toFixed(1)}</div></div>}
                {showM&&<div><div style={{ fontFamily:T.sans, fontSize:9, color:T.green, fontWeight:700, textTransform:"uppercase" }}>Mileage</div><div style={{ fontFamily:T.sans, fontSize:20, fontWeight:800, color:T.green }}>{currentMileage(eq.id).toLocaleString()}</div></div>}
                <div><div style={{ fontFamily:T.sans, fontSize:9, color:"#7c3aed", fontWeight:700, textTransform:"uppercase" }}>Fuel (gal)</div><div style={{ fontFamily:T.sans, fontSize:20, fontWeight:800, color:"#7c3aed" }}>{totalFuel(eq.id).toFixed(1)}</div></div>
              </div>
              <div style={{ fontFamily:T.sans, fontSize:10, color:T.muted, marginTop:6 }}>{logsFor(eq.id).length} log entries</div>
            </Card>
          );
        })}
        {eqList.length===0&&<Card><div style={{ fontFamily:T.sans, fontSize:13, color:T.muted, padding:"16px 0" }}>No tracked equipment selected.</div></Card>}
      </div>

      {/* Monthly / Annual Detail Tables */}
      {(viewMode==="monthly"||viewMode==="annual") && eqList.map(eq=>{
        const mode=eq.usageType||"hours";
        const months=byMonth(eq.id);
        const showH=mode==="hours"||mode==="both";
        const showM=mode==="mileage"||mode==="both";
        /* Group by year for annual view */
        const annualData = {};
        Object.entries(months).forEach(([m,d])=>{ const yr=m.slice(0,4); if(!annualData[yr])annualData[yr]={fuel:0,count:0,lastH:0,lastM:0}; annualData[yr].fuel+=d.fuel; annualData[yr].count+=d.count; if(d.lastHours)annualData[yr].lastH=d.lastHours; if(d.lastMileage)annualData[yr].lastM=d.lastMileage; });
        const rows = viewMode==="annual" ? Object.entries(annualData).sort() : Object.entries(months).sort();
        return (
          <Card key={eq.id} style={{ padding:0, overflow:"hidden", marginBottom:14 }}>
            <div style={{ background:T.accent, padding:"8px 16px", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <span style={{ fontFamily:T.sans, fontSize:13, fontWeight:700, color:"#fff" }}>{eq.name} ({eq.id}) — {viewMode==="annual"?"Annual":"Monthly"} Log</span>
              <span style={{ fontFamily:T.mono, fontSize:11, color:"#fff9" }}>{rows.length} periods</span>
            </div>
            <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13, fontFamily:T.sans }}>
              <thead><tr style={{ background:T.grayLt, borderBottom:`1px solid ${T.border}` }}>
                <th style={{ padding:"8px 12px", textAlign:"left", fontSize:11, fontWeight:600, color:T.muted, textTransform:"uppercase" }}>{viewMode==="annual"?"Year":"Month"}</th>
                <th style={{ padding:"8px 12px", textAlign:"left", fontSize:11, fontWeight:600, color:T.muted, textTransform:"uppercase" }}>Entries</th>
                {showH&&<th style={{ padding:"8px 12px", textAlign:"left", fontSize:11, fontWeight:600, color:"#1e40af", textTransform:"uppercase" }}>Hours (end)</th>}
                {showM&&<th style={{ padding:"8px 12px", textAlign:"left", fontSize:11, fontWeight:600, color:T.green, textTransform:"uppercase" }}>Mileage (end)</th>}
                <th style={{ padding:"8px 12px", textAlign:"left", fontSize:11, fontWeight:600, color:"#7c3aed", textTransform:"uppercase" }}>Fuel Added (gal)</th>
              </tr></thead>
              <tbody>
                {rows.map(([period,d],i)=>(
                  <tr key={period} style={{ borderBottom:`1px solid ${T.border}`, background:i%2===0?"#fff":T.grayLt }}>
                    <td style={{ padding:"9px 12px", fontFamily:T.mono, fontSize:12 }}>{period}</td>
                    <td style={{ padding:"9px 12px", fontFamily:T.mono, fontSize:12, color:T.muted }}>{d.count}</td>
                    {showH&&<td style={{ padding:"9px 12px", fontFamily:T.mono, fontSize:12, color:"#1e40af" }}>{(d.lastH||d.lastHours||0)>0?(d.lastH||d.lastHours||0).toFixed?.(1):"—"}</td>}
                    {showM&&<td style={{ padding:"9px 12px", fontFamily:T.mono, fontSize:12, color:T.green }}>{(d.lastM||d.lastMileage||0)>0?(d.lastM||d.lastMileage||0).toLocaleString():"—"}</td>}
                    <td style={{ padding:"9px 12px", fontFamily:T.mono, fontSize:12, color:"#7c3aed" }}>{d.fuel.toFixed(1)}</td>
                  </tr>
                ))}
                {rows.length===0&&<tr><td colSpan={5} style={{ padding:24, textAlign:"center", color:T.muted, fontFamily:T.sans, fontSize:13 }}>No log entries recorded.</td></tr>}
              </tbody>
            </table>
          </Card>
        );
      })}
    </div>
  );
}

function ReportDeadline({ state }) {
  const oos  = state.equipment.filter(e=>e.status==="Out of Service / Deadline");
  const def  = state.equipment.filter(e=>e.status==="Operational with Deficiencies");
  const openWO = (eqId) => state.workOrders.filter(w=>w.equipment===eqId && w.status!=="Completed");
  const exportRows = [...oos.map(eq=>({Status:"Out of Service / Deadline", "Equip #":eq.id, Name:eq.name, "Fault Date":eq.faultDate||"", "Fault Description":eq.faultDescription||"", "Open Work Orders":openWO(eq.id).map(w=>`${w.id} (${w.status})`).join(", ")})), ...def.map(eq=>({Status:"Operational with Deficiencies", "Equip #":eq.id, Name:eq.name, "Fault Date":eq.faultDate||"", "Fault Description":eq.faultDescription||"", "Open Work Orders":openWO(eq.id).map(w=>`${w.id} (${w.status})`).join(", ")}))];

  const printReport = () => {
    const win = window.open("","_blank","width=900,height=700");
    if(!win) return;
    const rows = (list,color,title) => list.map(eq=>{
      const wos = openWO(eq.id);
      return `<tr style="background:${color}">
        <td>${eq.id}</td><td><b>${eq.name}</b></td>
        <td>${eq.faultDate||"—"}</td>
        <td>${eq.faultDescription||"—"}</td>
        <td>${wos.length>0?wos.map(w=>`${w.id} (${w.status})`).join(", "):"No open WOs"}</td>
      </tr>`;
    }).join("");
    win.document.write(`<!DOCTYPE html><html><head><title>Deadline Report</title>
      <style>body{font-family:Arial,sans-serif;padding:24px}h1{font-size:18px;margin-bottom:4px}h2{font-size:13px;margin:16px 0 6px}table{width:100%;border-collapse:collapse;font-size:12px}th{background:#1a1a2e;color:#fff;padding:6px 10px;text-align:left;font-size:11px;text-transform:uppercase}td{padding:6px 10px;border-bottom:1px solid #e5e7eb}@media print{button{display:none}}</style>
      </head><body>
      ${reportHeaderHTML(state, "Deadline & Deficiency Report")}
      ${oos.length?`<h2 style="color:#dc2626">Out of Service / Deadline (${oos.length})</h2>
      <table><tr><th>Equip #</th><th>Name</th><th>Fault Date</th><th>Fault Description</th><th>Work Orders</th></tr>${rows(oos,"#fff5f5","")}</table>`:""}
      ${def.length?`<h2 style="color:#d97706">Operational w/ Deficiencies (${def.length})</h2>
      <table><tr><th>Equip #</th><th>Name</th><th>Fault Date</th><th>Fault Description</th><th>Work Orders</th></tr>${rows(def,"#fffdf0","")}</table>`:""}
      ${!oos.length&&!def.length?`<p>No equipment in deadline or deficiency status.</p>`:""}
      ${reportButtonsHtml(exportRows)}
      </body></html>`);
    win.document.close();
  };

  return (
    <div>
      <div style={{ display:"flex", justifyContent:"flex-end", gap:8, marginBottom:14 }}>
        <Btn onClick={printReport}>Print / PDF</Btn>
        <Btn variant="secondary" onClick={()=>downloadCSV("deadline-deficiency-report.csv", exportRows)}>Excel CSV</Btn>
      </div>
      {[{list:oos,label:"Out of Service / Deadline",color:T.red,bg:"#fff5f5",leftBorder:"4px solid #ef4444"},
        {list:def,label:"Operational with Deficiencies",color:T.amber,bg:"#fffdf0",leftBorder:"4px solid #f59e0b"}].map(({list,label,color,bg,leftBorder})=>(
        <div key={label} style={{ marginBottom:20 }}>
          <div style={{ fontFamily:T.sans, fontSize:13, fontWeight:700, color, marginBottom:8 }}>{label} ({list.length})</div>
          {list.length===0 ? <Card><div style={{ padding:"16px 0", textAlign:"center", color:T.muted, fontFamily:T.sans, fontSize:13 }}>None</div></Card> :
          list.map(eq=>{
            const wos = openWO(eq.id);
            return (
              <div key={eq.id} style={{ background:bg, border:`1px solid ${T.border}`, borderLeft:leftBorder, borderRadius:8, padding:"12px 18px", marginBottom:8, boxShadow:T.shadow }}>
                <div style={{ display:"grid", gridTemplateColumns:"90px 1fr 130px 1fr", gap:16, flexWrap:"wrap" }}>
                  <div><div style={{ fontFamily:T.sans, fontSize:9, fontWeight:700, color:T.muted, textTransform:"uppercase", letterSpacing:.5 }}>Equip #</div><div style={{ fontFamily:T.mono, fontSize:12, fontWeight:700, color:T.text, marginTop:2 }}>{eq.id}</div></div>
                  <div><div style={{ fontFamily:T.sans, fontSize:9, fontWeight:700, color:T.muted, textTransform:"uppercase", letterSpacing:.5 }}>Equipment Name</div><div style={{ fontFamily:T.sans, fontSize:14, fontWeight:700, color:T.text, marginTop:2 }}>{eq.name}</div></div>
                  <div><div style={{ fontFamily:T.sans, fontSize:9, fontWeight:700, color:T.muted, textTransform:"uppercase", letterSpacing:.5 }}>Fault Date</div><div style={{ fontFamily:T.mono, fontSize:12, color, fontWeight:700, marginTop:2 }}>{eq.faultDate||"—"}</div></div>
                  <div><div style={{ fontFamily:T.sans, fontSize:9, fontWeight:700, color:T.muted, textTransform:"uppercase", letterSpacing:.5 }}>Fault Description</div><div style={{ fontFamily:T.sans, fontSize:12, color:T.text, marginTop:2 }}>{eq.faultDescription||"—"}</div></div>
                </div>
                {wos.length>0 && (
                  <div style={{ marginTop:10, paddingTop:10, borderTop:`1px solid ${T.border}` }}>
                    <div style={{ fontFamily:T.sans, fontSize:9, fontWeight:700, color:T.muted, textTransform:"uppercase", letterSpacing:.5, marginBottom:5 }}>Open Work Orders</div>
                    <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                      {wos.map(w=><span key={w.id} style={{ fontFamily:T.mono, fontSize:11, padding:"2px 8px", borderRadius:4, background:"#fff", border:`1px solid ${T.border}` }}>{w.id} <Badge label={w.status} /></span>)}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

function ReportPM({ state }) {
  const [lookAheadDays, setLookAheadDays] = useState(30);
  const [mileageLookAhead, setMileageLookAhead] = useState(25);
  const today_str = today();
  const futureDate = (days) => { const d=new Date(); d.setDate(d.getDate()+days); return d.toISOString().split("T")[0]; };
  const cutoff = futureDate(lookAheadDays);

  const overdue   = state.preventiveMaintenance.filter(p=>p.status==="Overdue");
  const dueSoon   = state.preventiveMaintenance.filter(p=>p.status==="Due Soon"||p.nextDue<=cutoff);
  const completed = state.preventiveMaintenance.filter(p=>{
    if(!p.lastDone) return false;
    const d = new Date(p.lastDone);
    const m = new Date(); m.setDate(1);
    return d >= m;
  });
  const eqName = (id) => state.equipment.find(e=>e.id===id)?.name||id;
  const exportRows = [...overdue.map(p=>({Group:"Overdue", Equipment:eqName(p.equipment), Task:p.task, Interval:p.interval, "Last Done":p.lastDone||"", "Next Due":p.nextDue||"", Status:p.status})), ...dueSoon.map(p=>({Group:"Due Soon", Equipment:eqName(p.equipment), Task:p.task, Interval:p.interval, "Last Done":p.lastDone||"", "Next Due":p.nextDue||"", Status:p.status})), ...completed.map(p=>({Group:"Completed This Month", Equipment:eqName(p.equipment), Task:p.task, Interval:p.interval, "Last Done":p.lastDone||"", "Next Due":p.nextDue||"", Status:p.status}))];

  const printPMReport = () => {
    const win = window.open("","_blank","width=900,height=700");
    if(!win) return;
    const pmRows = (list) => list.map(p=>`<tr><td>${eqName(p.equipment)}</td><td>${p.task}</td><td>${p.interval}</td><td>${p.lastDone||"—"}</td><td>${p.nextDue||"—"}</td><td>${p.status}</td></tr>`).join("");
    win.document.write(`<!DOCTYPE html><html><head><title>PM Report</title>
      <style>body{font-family:Arial,sans-serif;padding:24px}h2{font-size:14px;margin:16px 0 6px}table{width:100%;border-collapse:collapse;font-size:12px}th{background:#1a1a2e;color:#fff;padding:6px 10px;text-align:left;font-size:11px;text-transform:uppercase}td{padding:6px 10px;border-bottom:1px solid #e5e7eb}@media print{button{display:none}}</style>
      </head><body>
      ${reportHeaderHTML(state, "Preventive Maintenance Report")}
      <p style="color:#666;font-size:12px">Look-ahead: ${lookAheadDays} days</p>
      ${overdue.length?`<h2 style="color:#dc2626">OVERDUE (${overdue.length})</h2><table><tr><th>Equipment</th><th>Task</th><th>Interval</th><th>Last Done</th><th>Due</th><th>Status</th></tr>${pmRows(overdue)}</table>`:""}
      ${dueSoon.length?`<h2 style="color:#d97706">DUE WITHIN ${lookAheadDays} DAYS (${dueSoon.length})</h2><table><tr><th>Equipment</th><th>Task</th><th>Interval</th><th>Last Done</th><th>Due</th><th>Status</th></tr>${pmRows(dueSoon)}</table>`:""}
      ${completed.length?`<h2 style="color:#059669">COMPLETED THIS MONTH (${completed.length})</h2><table><tr><th>Equipment</th><th>Task</th><th>Interval</th><th>Last Done</th><th>Due</th><th>Status</th></tr>${pmRows(completed)}</table>`:""}
      <br><button onclick="window.print()" style="padding:8px 20px;background:#1a1a2e;color:#fff;border:none;border-radius:6px;cursor:pointer">Print / Save PDF</button>
      </body></html>`);
    win.document.close();
  };

  return (
    <div>
      <Card style={{ marginBottom:16, padding:"14px 18px" }}>
        <div style={{ display:"flex", gap:16, alignItems:"center", flexWrap:"wrap" }}>
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            <label style={{ fontFamily:T.sans, fontSize:12, fontWeight:600, color:T.subtext }}>Look-ahead days:</label>
            <input type="number" style={{ ...inp, width:70 }} value={lookAheadDays} onChange={e=>setLookAheadDays(+e.target.value)} min={1} max={365} />
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            <label style={{ fontFamily:T.sans, fontSize:12, fontWeight:600, color:T.subtext }}>Miles/hrs before service:</label>
            <input type="number" style={{ ...inp, width:70 }} value={mileageLookAhead} onChange={e=>setMileageLookAhead(+e.target.value)} min={1} />
          </div>
          <Btn small onClick={printPMReport}>Print / PDF</Btn>
          <Btn small variant="secondary" onClick={()=>downloadCSV("pm-report.csv", exportRows)}>Excel CSV</Btn>
        </div>
      </Card>
      {[{list:overdue,label:"Overdue",color:T.red},{list:dueSoon,label:`Due within ${lookAheadDays} days`,color:T.amber},{list:completed,label:"Completed This Month",color:T.green}].map(({list,label,color})=>(
        <div key={label} style={{ marginBottom:16 }}>
          <div style={{ fontFamily:T.sans, fontSize:13, fontWeight:700, color, marginBottom:8 }}>{label} ({list.length})</div>
          <Card style={{ padding:0, overflow:"hidden" }}>
            <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13, fontFamily:T.sans }}>
              <thead><tr style={{ background:T.grayLt, borderBottom:`1px solid ${T.border}` }}>
                {["Equipment","Task","Interval","Last Done","Next Due","Status"].map(h=><th key={h} style={{ padding:"8px 12px", textAlign:"left", fontSize:11, fontWeight:600, color:T.muted, textTransform:"uppercase", letterSpacing:.4 }}>{h}</th>)}
              </tr></thead>
              <tbody>
                {list.map((p,i)=>{
                  const eq = state.equipment.find(e=>e.id===p.equipment);
                  return <tr key={p.id} style={{ borderBottom:`1px solid ${T.border}`, background:i%2===0?"#fff":T.grayLt }}>
                    <td style={{ padding:"9px 12px", fontWeight:500 }}>{eq?.name||p.equipment}</td>
                    <td style={{ padding:"9px 12px" }}>{p.task}</td>
                    <td style={{ padding:"9px 12px", color:T.muted }}>{p.interval}</td>
                    <td style={{ padding:"9px 12px", fontFamily:T.mono, fontSize:12 }}>{p.lastDone||"—"}</td>
                    <td style={{ padding:"9px 12px", fontFamily:T.mono, fontSize:12, color }}>{p.nextDue||"—"}</td>
                    <td style={{ padding:"9px 12px" }}><Badge label={p.status} /></td>
                  </tr>;
                })}
                {list.length===0&&<tr><td colSpan={6} style={{ padding:20, textAlign:"center", color:T.muted, fontFamily:T.sans, fontSize:13 }}>None</td></tr>}
              </tbody>
            </table>
          </Card>
        </div>
      ))}
    </div>
  );
}

function ReportSpending({ state }) {
  const fy_start = new Date(new Date().getFullYear(), 9, 1); // Oct 1
  const month_start = new Date(); month_start.setDate(1);
  const wos = state.workOrders;
  const totalCost = (w) => (+w.laborCost||0)+(+(w.partsUsed||[]).reduce((s,p)=>s+(+(p.qty||1))*(+(p.unitCost||0)),0))+(+w.partsCost||0);
  const monthly = wos.filter(w=>w.completed&&new Date(w.completed)>=month_start);
  const annual  = wos.filter(w=>w.completed&&new Date(w.completed)>=fy_start);
  const monthTotal = monthly.reduce((s,w)=>s+totalCost(w),0);
  const fyTotal    = annual.reduce((s,w)=>s+totalCost(w),0);

  const spendingRows = (list) => list.map(w=>({"WO #":w.id, Title:w.title||"", Equipment:state.equipment.find(e=>e.id===w.equipment)?.name||w.equipment, Mechanic:w.tech||"", Date:w.completed||w.created||"", Labor:(+w.laborCost||0).toFixed(2), Parts:(+(w.partsUsed||[]).reduce((s,p)=>s+(+(p.qty||1))*(+(p.unitCost||0)),0)).toFixed(2), Total:totalCost(w).toFixed(2)}));
  const printSpending = (list, title) => {
    const rows = spendingRows(list);
    const win = window.open("","_blank","width=900,height=700");
    if(!win) return;
    win.document.write(`<!DOCTYPE html><html><head><title>${title}</title>
      <style>body{font-family:Arial,sans-serif;padding:24px}h1{font-size:18px;margin:0}table{width:100%;border-collapse:collapse;font-size:12px}th{background:#1a1a2e;color:#fff;padding:6px 10px;text-align:left;font-size:11px;text-transform:uppercase}td{padding:6px 10px;border-bottom:1px solid #e5e7eb}@media print{button{display:none}}</style>
      </head><body>${reportHeaderHTML(state, title)}
      <table><tr><th>WO #</th><th>Title</th><th>Equipment</th><th>Mechanic</th><th>Date</th><th>Labor</th><th>Parts</th><th>Total</th></tr>
      ${list.map(w=>`<tr><td>${w.id}</td><td>${w.title}</td><td>${state.equipment.find(e=>e.id===w.equipment)?.name||w.equipment}</td><td>${w.tech||"—"}</td><td>${w.completed||w.created||"—"}</td><td>$${(+w.laborCost||0).toFixed(2)}</td><td>$${(+(w.partsUsed||[]).reduce((s,p)=>s+(+(p.qty||1))*(+(p.unitCost||0)),0)).toFixed(2)}</td><td><b>$${totalCost(w).toFixed(2)}</b></td></tr>`).join("")}
      <tr style="font-weight:700;background:#f3f4f6"><td colspan="7">TOTAL</td><td>$${list.reduce((s,w)=>s+totalCost(w),0).toFixed(2)}</td></tr>
      </table>${reportButtonsHtml(rows)}</body></html>`);
    win.document.close();
  };

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
        <Card style={{ padding:"16px 20px" }}>
          <div style={{ fontFamily:T.sans, fontSize:11, fontWeight:700, color:T.muted, textTransform:"uppercase", letterSpacing:.5 }}>This Month</div>
          <div style={{ fontFamily:T.sans, fontSize:32, fontWeight:800, color:T.accent, margin:"6px 0" }}>${monthTotal.toFixed(2)}</div>
          <div style={{ fontFamily:T.sans, fontSize:12, color:T.muted }}>{monthly.length} completed WOs</div>
          <div style={{ display:"flex", gap:8, marginTop:10 }}><Btn small onClick={()=>printSpending(monthly,"Monthly Spending Report")}>Print / PDF</Btn><Btn small variant="secondary" onClick={()=>downloadCSV("monthly-spending-report.csv", spendingRows(monthly))}>Excel CSV</Btn></div>
        </Card>
        <Card style={{ padding:"16px 20px" }}>
          <div style={{ fontFamily:T.sans, fontSize:11, fontWeight:700, color:T.muted, textTransform:"uppercase", letterSpacing:.5 }}>Fiscal Year (Oct-Sep)</div>
          <div style={{ fontFamily:T.sans, fontSize:32, fontWeight:800, color:T.accent, margin:"6px 0" }}>${fyTotal.toFixed(2)}</div>
          <div style={{ fontFamily:T.sans, fontSize:12, color:T.muted }}>{annual.length} completed WOs</div>
          <div style={{ display:"flex", gap:8, marginTop:10 }}><Btn small onClick={()=>printSpending(annual,"FY Spending Report")}>Print / PDF</Btn><Btn small variant="secondary" onClick={()=>downloadCSV("fy-spending-report.csv", spendingRows(annual))}>Excel CSV</Btn></div>
        </Card>
      </div>
    </div>
  );
}

function ReportCombined({ state }) {
  const [selected, setSelected] = useState({ deadline:true, pm:true, spending:false, parts:false, usage:false, equipment:false, workorders:false });
  const [lookAhead, setLookAhead] = useState(30);
  const toggle = k => setSelected(s=>({...s,[k]:!s[k]}));

  const printCombined = () => {
    const win = window.open("","_blank","width=900,height=700");
    if(!win) return;
    const eqName = id => state.equipment.find(e=>e.id===id)?.name||id;
    const totalCost = w => (+w.laborCost||0)+(+(w.partsUsed||[]).reduce((s,p)=>s+(+(p.qty||1))*(+(p.unitCost||0)),0))+(+w.partsCost||0);
    const allLogs = state.usageLogs || [];
    const currentReading = (eqId, field) => { const l = allLogs.filter(x=>x.equipmentId===eqId&&x[field]).sort((a,b)=>b.date.localeCompare(a.date))[0]; return l?+(l[field]||0):0; };

    let body = `<!DOCTYPE html><html><head><title>Combined Report</title>
      <style>body{font-family:Arial,sans-serif;padding:24px}h2{font-size:14px;margin:20px 0 6px;color:#1a1a2e;border-bottom:1px solid #ddd;padding-bottom:4px}table{width:100%;border-collapse:collapse;font-size:12px;margin-bottom:16px}th{background:#1a1a2e;color:#fff;padding:6px 10px;text-align:left;font-size:11px}td{padding:6px 10px;border-bottom:1px solid #e5e7eb}@media print{button{display:none}}</style>
      </head><body>${reportHeaderHTML(state, 'Combined Maintenance Report')}`;

    if(selected.deadline) {
      const bad = state.equipment.filter(e=>e.status==="Out of Service / Deadline"||e.status==="Operational with Deficiencies");
      body += `<h2>Deadline / Deficiency Equipment (${bad.length})</h2><table><tr><th>Equip #</th><th>Name</th><th>Status</th><th>Fault Date</th><th>Description</th></tr>${bad.map(e=>`<tr><td>${e.id}</td><td>${e.name}</td><td>${e.status}</td><td>${e.faultDate||"—"}</td><td>${e.faultDescription||"—"}</td></tr>`).join("")}</table>`;
    }
    if(selected.pm) {
      const pmBad = state.preventiveMaintenance.filter(p=>p.status==="Overdue"||p.status==="Due Soon");
      body += `<h2>PM Overdue / Due Soon (${pmBad.length})</h2><table><tr><th>Equipment</th><th>Task</th><th>Last Done</th><th>Due</th><th>Status</th></tr>${pmBad.map(p=>`<tr><td>${eqName(p.equipment)}</td><td>${p.task}</td><td>${p.lastDone||"—"}</td><td>${p.nextDue||"—"}</td><td>${p.status}</td></tr>`).join("")}</table>`;
    }
    if(selected.spending) {
      const wos = state.workOrders.filter(w=>w.completed);
      const total = wos.reduce((s,w)=>s+totalCost(w),0);
      body += `<h2>Completed Work Orders — Total $${total.toFixed(2)}</h2><table><tr><th>WO#</th><th>Title</th><th>Equipment</th><th>Mechanic</th><th>Completed</th><th>Total</th></tr>${wos.map(w=>`<tr><td>${w.id}</td><td>${w.title}</td><td>${eqName(w.equipment)}</td><td>${w.tech||"—"}</td><td>${w.completed||"—"}</td><td>$${totalCost(w).toFixed(2)}</td></tr>`).join("")}</table>`;
    }
    if(selected.parts) {
      const lowStock = state.parts.filter(p=>p.lowStockAlert!==false&&(+(p.qty||0))<=(+(p.minQty||0)));
      const totalVal = state.parts.reduce((s,p)=>s+(+(p.qty||0))*(+(p.unitCost||0)),0);
      body += `<h2>Parts Inventory — ${state.parts.length} SKUs, Total Value $${totalVal.toFixed(2)}</h2>`;
      if(lowStock.length>0) body += `<p style="color:#b91c1c;font-size:12px"><b>⚠ Low stock alerts: ${lowStock.length} items</b></p>`;
      body += `<table><tr><th>Part #</th><th>Name</th><th>Category</th><th>Qty</th><th>Min</th><th>Unit $</th><th>Total $</th></tr>${state.parts.map(p=>`<tr style="${(+(p.qty||0))<=(+(p.minQty||0))?'background:#fee2e2':''}"><td>${p.partNumber||"—"}</td><td>${p.name}</td><td>${p.category||"—"}</td><td>${p.qty||0}</td><td>${p.minQty||0}</td><td>$${(+(p.unitCost||0)).toFixed(2)}</td><td>$${((+(p.qty||0))*(+(p.unitCost||0))).toFixed(2)}</td></tr>`).join("")}</table>`;
    }
    if(selected.usage) {
      const trackable = state.equipment.filter(e=>e.trackUsage);
      body += `<h2>Current Usage Readings (${trackable.length} tracked units)</h2><table><tr><th>Equip #</th><th>Name</th><th>Hours</th><th>Mileage</th><th>Last Entry</th></tr>${trackable.map(e=>{ const logs = allLogs.filter(l=>l.equipmentId===e.id); const last = logs.sort((a,b)=>b.date.localeCompare(a.date))[0]; return `<tr><td>${e.id}</td><td>${e.name}</td><td>${currentReading(e.id,"hours").toFixed(1)}</td><td>${currentReading(e.id,"mileage").toLocaleString()}</td><td>${last?.date||"—"}</td></tr>`; }).join("")}</table>`;
    }
    if(selected.equipment) {
      body += `<h2>Equipment Roster (${state.equipment.length})</h2><table><tr><th>Equip #</th><th>Name</th><th>Make/Model</th><th>Serial #</th><th>Location</th><th>Status</th></tr>${state.equipment.map(e=>`<tr><td>${e.id}</td><td>${e.name}</td><td>${e.make||""} ${e.model||""}</td><td>${e.serial||"—"}</td><td>${e.location||"—"}</td><td>${e.status}</td></tr>`).join("")}</table>`;
    }
    if(selected.workorders) {
      const active = state.workOrders.filter(w=>w.status!=="Completed");
      body += `<h2>Active Work Orders (${active.length})</h2><table><tr><th>WO#</th><th>Title</th><th>Equipment</th><th>Mechanic</th><th>Priority</th><th>Status</th><th>Due</th></tr>${active.map(w=>`<tr><td>${w.id}</td><td>${w.title}</td><td>${eqName(w.equipment)}</td><td>${w.tech||"—"}</td><td>${w.priority}</td><td>${w.status}</td><td>${w.due||"—"}</td></tr>`).join("")}</table>`;
    }
    body += `<br><button onclick="window.print()" style="padding:8px 20px;background:#1a1a2e;color:#fff;border:none;border-radius:6px;cursor:pointer">Print / Save PDF</button></body></html>`;
    win.document.write(body);
    win.document.close();
  };

  const sections = [
    ["workorders","📋 Active Work Orders","All non-completed work orders"],
    ["deadline","🚨 Deadline Equipment","OOS and equipment with deficiencies"],
    ["pm","🔧 PM Overdue / Due Soon","Services that need attention"],
    ["spending","💰 Work Order Spending","Completed WOs with costs"],
    ["parts","📦 Parts Inventory","All parts with stock levels"],
    ["usage","📊 Equipment Usage","Current readings for tracked equipment"],
    ["equipment","🚜 Equipment Roster","Complete equipment list"],
  ];

  const allOn  = () => setSelected(Object.fromEntries(sections.map(([k])=>[k,true])));
  const allOff = () => setSelected({});
  const selectedCount = Object.values(selected).filter(Boolean).length;

  return (
    <div>
      <Card style={{ marginBottom:16 }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
          <div style={{ fontFamily:T.sans, fontSize:14, fontWeight:700, color:T.text }}>Build Your Combined Report</div>
          <div style={{ display:"flex", gap:6 }}>
            <Btn small variant="secondary" onClick={allOn}>Select All</Btn>
            <Btn small variant="secondary" onClick={allOff}>Clear</Btn>
          </div>
        </div>
        <div style={{ fontFamily:T.sans, fontSize:12, color:T.muted, marginBottom:12 }}>Choose which sections to include. The report combines them into one printable document with your company header.</div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(280px, 1fr))", gap:10 }}>
          {sections.map(([k,l,desc])=>(
            <button key={k} onClick={()=>toggle(k)} style={{ padding:"12px 14px", borderRadius:8, border:`2px solid ${selected[k]?T.accent:T.border}`, background:selected[k]?T.accentLt:"#fff", color:selected[k]?T.accent:T.text, cursor:"pointer", fontFamily:T.sans, textAlign:"left", display:"flex", flexDirection:"column", gap:3 }}>
              <span style={{ fontSize:13, fontWeight:selected[k]?700:600 }}>{selected[k]?"☑ ":"☐ "}{l}</span>
              <span style={{ fontSize:11, color:T.muted }}>{desc}</span>
            </button>
          ))}
        </div>
        <div style={{ marginTop:18, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <span style={{ fontFamily:T.sans, fontSize:12, color:T.muted }}>{selectedCount} section{selectedCount!==1?"s":""} selected</span>
          <Btn onClick={printCombined} disabled={selectedCount===0}>Generate Combined Report</Btn>
        </div>
      </Card>
    </div>
  );
}



function SystemSettings({ state, dispatch, onClose }) {
  const s = state.settings || {};
  const [form, setForm] = useState({
    companyName:   s.companyName   || "National Cemetery Administration",
    department:    s.department    || "Maintenance Department",
    location:      s.location      || "",
    phone:         s.phone         || "",
    email:         s.email         || "",
    accentColor:   s.accentColor   || "#0052cc",
    dateFormat:    s.dateFormat    || "MM/DD/YYYY",
    currency:      s.currency      || "USD",
    defaultPriority: s.defaultPriority || "Medium",
    laborRateDefault: s.laborRateDefault || 45,
    logo:          s.logo          || "",
    showCostsOnWO: s.showCostsOnWO !== false,
    requireTech:   s.requireTech   || false,
  });
  const F = k => e => setForm(f=>({...f,[k]:e.target.value}));
  const Toggle = ({label, k, sub}) => (
    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"10px 0", borderBottom:`1px solid ${T.border}` }}>
      <div>
        <div style={{ fontFamily:T.sans, fontSize:13, color:T.text, fontWeight:500 }}>{label}</div>
        {sub && <div style={{ fontFamily:T.sans, fontSize:11, color:T.muted, marginTop:2 }}>{sub}</div>}
      </div>
      <button type="button" onClick={()=>setForm(f=>({...f,[k]:!f[k]}))} style={{ width:44, height:24, borderRadius:12, border:"none", background:form[k]?T.accent:"#d1d5db", cursor:"pointer", position:"relative", transition:"background .2s", flexShrink:0 }}>
        <span style={{ position:"absolute", top:3, left:form[k]?22:3, width:18, height:18, borderRadius:"50%", background:"#fff", transition:"left .2s", display:"block", boxShadow:"0 1px 3px rgba(0,0,0,.2)" }}/>
      </button>
    </div>
  );

  const handleLogo = e => {
    const file = e.target.files[0]; if(!file) return;
    const reader = new FileReader();
    reader.onload = ev => setForm(f=>({...f, logo:ev.target.result}));
    reader.readAsDataURL(file);
  };

  const save = () => { dispatch({type:"UPDATE_SETTINGS", payload:form}); onClose(); };

  return (
    <Modal title="System Settings" onClose={onClose}>
      <div style={{ display:"flex", flexDirection:"column", gap:0, maxHeight:"70vh", overflowY:"auto" }}>

        {/* Organization */}
        <div style={{ marginBottom:16 }}>
          <div style={{ fontFamily:T.sans, fontSize:11, fontWeight:700, color:T.muted, textTransform:"uppercase", letterSpacing:.6, marginBottom:10, paddingBottom:6, borderBottom:`2px solid ${T.border}` }}>Organization</div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"0 16px" }}>
            <Field label="Company / Organization Name">
              <input style={inp} value={form.companyName} onChange={F("companyName")} placeholder="National Cemetery Administration" />
            </Field>
            <Field label="Department" half>
              <input style={inp} value={form.department} onChange={F("department")} placeholder="Maintenance Department" />
            </Field>
            <Field label="Location / Site" half>
              <input style={inp} value={form.location} onChange={F("location")} placeholder="e.g. VA Cemetery - Miami" />
            </Field>
            <Field label="Phone" half>
              <input style={inp} value={form.phone} onChange={F("phone")} placeholder="(555) 000-0000" />
            </Field>
            <Field label="Email" half>
              <input style={inp} value={form.email} onChange={F("email")} placeholder="maintenance@example.gov" />
            </Field>
          </div>
          <div style={{ marginBottom:14 }}>
            <label style={{ display:"block", fontFamily:T.sans, fontSize:12, fontWeight:600, color:T.subtext, marginBottom:6 }}>Organization Logo</label>
            <div style={{ display:"flex", gap:12, alignItems:"center" }}>
              {form.logo && <img src={form.logo} alt="logo" style={{ height:48, objectFit:"contain", border:`1px solid ${T.border}`, borderRadius:6, padding:4, background:"#fff" }} />}
              <label style={{ fontFamily:T.sans, fontSize:12, fontWeight:600, color:T.accent, cursor:"pointer", padding:"7px 14px", border:`1px solid ${T.accent}`, borderRadius:6 }}>
                Upload Logo
                <input type="file" accept="image/*" onChange={handleLogo} style={{ display:"none" }} />
              </label>
              {form.logo && <button onClick={()=>setForm(f=>({...f,logo:""}))} style={{ background:"none", border:"none", color:T.red, cursor:"pointer", fontFamily:T.sans, fontSize:12, fontWeight:600 }}>Remove</button>}
            </div>
          </div>
        </div>

        {/* Preferences */}
        <div style={{ marginBottom:16 }}>
          <div style={{ fontFamily:T.sans, fontSize:11, fontWeight:700, color:T.muted, textTransform:"uppercase", letterSpacing:.6, marginBottom:10, paddingBottom:6, borderBottom:`2px solid ${T.border}` }}>Preferences</div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"0 16px" }}>
            <Field label="Default Work Order Priority" half>
              <select style={sel} value={form.defaultPriority} onChange={F("defaultPriority")}>
                {["High","Medium","Low"].map(p=><option key={p}>{p}</option>)}
              </select>
            </Field>
            <Field label="Default Labor Rate ($/hr)" half>
              <input style={inp} type="number" value={form.laborRateDefault} onChange={F("laborRateDefault")} />
            </Field>
            <Field label="Date Format" half>
              <select style={sel} value={form.dateFormat} onChange={F("dateFormat")}>
                {["MM/DD/YYYY","DD/MM/YYYY","YYYY-MM-DD"].map(d=><option key={d}>{d}</option>)}
              </select>
            </Field>
            <Field label="Currency" half>
              <select style={sel} value={form.currency} onChange={F("currency")}>
                {["USD","EUR","GBP","CAD"].map(c=><option key={c}>{c}</option>)}
              </select>
            </Field>
          </div>
          <Toggle label="Show costs on printed work order" k="showCostsOnWO" sub="Labor and parts costs visible on printed WOs" />
          <Toggle label="Require mechanic on work orders" k="requireTech" sub="Work orders cannot be saved without a mechanic assigned" />
        </div>

        {/* Accent color */}
        <div style={{ marginBottom:16 }}>
          <div style={{ fontFamily:T.sans, fontSize:11, fontWeight:700, color:T.muted, textTransform:"uppercase", letterSpacing:.6, marginBottom:10, paddingBottom:6, borderBottom:`2px solid ${T.border}` }}>Foundation — Location Management</div>
          <div style={{ fontFamily:T.sans, fontSize:12, color:T.muted, marginBottom:10 }}>Define available locations that appear in equipment assignment dropdowns.</div>
          <div style={{ display:"flex", gap:8, marginBottom:10 }}>
            <input style={{ ...inp, flex:1 }} placeholder="Add location (e.g. Main Shop, Motor Pool, Section A)..." value={form._newLoc||""} onChange={e=>setForm(f=>({...f,_newLoc:e.target.value}))} onKeyDown={e=>{ if(e.key==="Enter"&&form._newLoc?.trim()){ setForm(f=>({...f,locations:[...(f.locations||[]),f._newLoc.trim()],_newLoc:""})); }}} />
            <Btn small onClick={()=>{ if(form._newLoc?.trim()) setForm(f=>({...f,locations:[...(f.locations||[]),f._newLoc.trim()],_newLoc:""})); }}>Add</Btn>
          </div>
          {(form.locations||[]).length===0 ? (
            <div style={{ fontFamily:T.sans, fontSize:12, color:T.muted, fontStyle:"italic", padding:"8px 0" }}>No locations defined. Add one above.</div>
          ) : (
            <div style={{ display:"flex", flexDirection:"column", gap:4, maxHeight:200, overflowY:"auto" }}>
              {(form.locations||[]).map((loc,i)=>(
                <div key={i} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"7px 12px", background:T.grayLt, borderRadius:6, border:`1px solid ${T.border}` }}>
                  <span style={{ fontFamily:T.sans, fontSize:13, color:T.text }}>{loc}</span>
                  <button onClick={()=>setForm(f=>({...f,locations:f.locations.filter((_,j)=>j!==i)}))} style={{ background:"none", border:"none", color:T.red, cursor:"pointer", fontSize:16, lineHeight:1, padding:"0 4px" }}>×</button>
                </div>
              ))}
            </div>
          )}
          <div style={{ marginTop:14 }}>
            <div style={{ fontFamily:T.sans, fontSize:11, fontWeight:700, color:T.muted, textTransform:"uppercase", letterSpacing:.6, marginBottom:8, paddingBottom:6, borderBottom:`1px solid ${T.border}` }}>Site Info</div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"0 16px" }}>
              <Field label="Site / Facility Name">
                <input style={inp} value={form.siteName||""} onChange={e=>setForm(f=>({...f,siteName:e.target.value}))} placeholder="e.g. Miami National Cemetery" />
              </Field>
              <Field label="Region / District" half>
                <input style={inp} value={form.region||""} onChange={e=>setForm(f=>({...f,region:e.target.value}))} placeholder="e.g. Southeast Region" />
              </Field>
              <Field label="Address">
                <input style={inp} value={form.address||""} onChange={e=>setForm(f=>({...f,address:e.target.value}))} />
              </Field>
              <Field label="City, State" half>
                <input style={inp} value={form.cityState||""} onChange={e=>setForm(f=>({...f,cityState:e.target.value}))} placeholder="Miami, FL" />
              </Field>
            </div>
          </div>

          <div style={{ fontFamily:T.sans, fontSize:11, fontWeight:700, color:T.muted, textTransform:"uppercase", letterSpacing:.6, marginBottom:10, paddingBottom:6, borderBottom:`2px solid ${T.border}`, marginTop:8 }}>Appearance</div>
          <Field label="Accent Color">
            <div style={{ display:"flex", gap:10, alignItems:"center" }}>
              <input type="color" value={form.accentColor} onChange={F("accentColor")} style={{ width:44, height:36, border:`1px solid ${T.border}`, borderRadius:6, cursor:"pointer", padding:2 }} />
              <span style={{ fontFamily:T.mono, fontSize:12, color:T.muted }}>{form.accentColor}</span>
              <div style={{ flex:1, height:8, borderRadius:4, background:form.accentColor }}/>
            </div>
          </Field>
        </div>
      </div>

      <div style={{ display:"flex", gap:8, justifyContent:"space-between", alignItems:"center", marginTop:16, paddingTop:12, borderTop:`1px solid ${T.border}` }}>
        <div style={{ display:"flex", gap:8 }}>
          <Btn variant="danger" onClick={()=>{ if(confirm("⚠ This will permanently delete ALL data (work orders, equipment, parts, etc.) from this browser. Continue?")){ localStorage.removeItem("ncaState"); window.location.reload(); } }}>Reset All Data</Btn>
          <Btn variant="secondary" onClick={()=>{ if(confirm("Restart the setup wizard? Your data will be kept but you'll be taken through the introduction again.")){ dispatch({type:"RESET_SETUP"}); onClose(); }}}>Restart Setup Wizard</Btn>
        </div>
        <div style={{ display:"flex", gap:8 }}>
          <Btn variant="secondary" onClick={onClose}>Cancel</Btn>
          <Btn onClick={save}>Save Settings</Btn>
        </div>
      </div>
    </Modal>
  );
}

/* SETUP WIZARD - first-run onboarding */

function SetupWizard({ onComplete }) {
  const [step, setStep] = useState(1);
  const [data, setData] = useState({
    /* Organization */
    companyName: "",
    department: "",
    location: "",
    phone: "",
    email: "",
    logo: "",
    /* Address */
    siteName: "",
    region: "",
    address: "",
    cityState: "",
    /* Locations list */
    locations: [],
    _newLoc: "",
    /* Categories */
    categories: ["Mowers","Vehicles","Tractors","Irrigation","Tools","Trailers"],
    _newCat: "",
    /* User profile */
    firstName: "",
    lastName: "",
    position: "Mechanic",
    profilePhone: "",
    profileEmail: "",
    laborRate: 45,
    /* Additional mechanics */
    mechanics: [],
    _newMechName: "",
    _newMechRate: 45,
    /* Preferences */
    accentColor: "#0052cc",
    defaultPriority: "Medium",
    dateFormat: "MM/DD/YYYY",
    currency: "USD",
    showCostsOnWO: true,
    requireTech: false,
  });

  const F = k => e => setData(d=>({...d,[k]:e.target.value}));

  const handleLogo = e => {
    const file = e.target.files[0]; if(!file) return;
    const reader = new FileReader();
    reader.onload = ev => setData(d=>({...d, logo:ev.target.result}));
    reader.readAsDataURL(file);
  };

  const addLocation = () => { if(data._newLoc.trim()) setData(d=>({...d,locations:[...d.locations,d._newLoc.trim()],_newLoc:""})); };
  const removeLocation = i => setData(d=>({...d,locations:d.locations.filter((_,j)=>j!==i)}));
  const addCategory = () => { if(data._newCat.trim()) setData(d=>({...d,categories:[...d.categories,d._newCat.trim()],_newCat:""})); };
  const removeCategory = i => setData(d=>({...d,categories:d.categories.filter((_,j)=>j!==i)}));
  const addMechanic = () => { if(data._newMechName.trim()) setData(d=>({...d,mechanics:[...d.mechanics,{name:d._newMechName.trim(),laborRate:+d._newMechRate||45}],_newMechName:"",_newMechRate:45})); };
  const removeMechanic = i => setData(d=>({...d,mechanics:d.mechanics.filter((_,j)=>j!==i)}));

  const totalSteps = 5;
  const next = () => {
    if(step===1 && !data.companyName.trim()) { alert("Company name is required."); return; }
    if(step===4 && !data.firstName.trim()) { alert("Your first name is required."); return; }
    if(step<totalSteps) setStep(s=>s+1);
    else finish();
  };
  const back = () => step>1 && setStep(s=>s-1);

  const finish = () => {
    const settings = {
      companyName: data.companyName,
      department: data.department,
      location: data.location,
      phone: data.phone,
      email: data.email,
      logo: data.logo,
      siteName: data.siteName,
      region: data.region,
      address: data.address,
      cityState: data.cityState,
      locations: data.locations,
      accentColor: data.accentColor,
      defaultPriority: data.defaultPriority,
      laborRateDefault: data.laborRate,
      dateFormat: data.dateFormat,
      currency: data.currency,
      showCostsOnWO: data.showCostsOnWO,
      requireTech: data.requireTech,
    };
    const profile = {
      firstName: data.firstName,
      lastName: data.lastName,
      position: data.position,
      phone: data.profilePhone,
      email: data.profileEmail,
    };
    const allMechanics = [
      { id:"TECH-001", name:`${data.firstName} ${data.lastName}`.trim(), position:data.position, laborRate:+data.laborRate||45 },
      ...data.mechanics.map((m,i)=>({ id:`TECH-${String(i+2).padStart(3,"0")}`, name:m.name, position:"Mechanic", laborRate:+m.laborRate||45 })),
    ];
    onComplete({ settings, profile, technicians:allMechanics, categories:data.categories });
  };

  const StepIndicator = () => (
    <div style={{ display:"flex", gap:4, marginBottom:24, justifyContent:"center" }}>
      {Array.from({length:totalSteps}).map((_,i)=>(
        <div key={i} style={{ flex:1, maxWidth:60, height:4, borderRadius:2, background:i+1<=step?T.accent:T.border, transition:"background .3s" }}/>
      ))}
    </div>
  );

  return (
    <div style={{ position:"fixed", inset:0, background:"linear-gradient(135deg, #f8fafc 0%, #e0f2fe 100%)", zIndex:9999, overflow:"auto", padding:"24px 16px" }}>
      <div style={{ maxWidth:680, margin:"40px auto", background:"#fff", borderRadius:14, boxShadow:"0 10px 40px rgba(0,0,0,.12)", padding:"32px 36px" }}>
        <StepIndicator />

        {/* Step 1: Welcome + Company */}
        {step===1 && (
          <>
            <div style={{ textAlign:"center", marginBottom:24 }}>
              <div style={{ fontSize:48, marginBottom:8 }}>👋</div>
              <h2 style={{ margin:0, fontFamily:T.sans, fontSize:24, fontWeight:800, color:T.text }}>Welcome to your Maintenance Manager</h2>
              <p style={{ margin:"8px 0 0", fontFamily:T.sans, fontSize:14, color:T.muted }}>Let's set things up. This takes about 2 minutes.</p>
            </div>
            <div style={{ fontFamily:T.sans, fontSize:13, fontWeight:700, color:T.muted, textTransform:"uppercase", letterSpacing:.6, marginBottom:10, paddingBottom:6, borderBottom:`2px solid ${T.border}` }}>Step 1 of {totalSteps} — Your Organization</div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"0 16px" }}>
              <Field label="Company / Organization Name *"><input style={inp} value={data.companyName} onChange={F("companyName")} placeholder="e.g. National Cemetery Administration" autoFocus /></Field>
              <Field label="Department" half><input style={inp} value={data.department} onChange={F("department")} placeholder="e.g. Maintenance Department" /></Field>
              <Field label="Phone" half><input style={inp} value={data.phone} onChange={F("phone")} placeholder="(555) 000-0000" /></Field>
              <Field label="Email"><input style={inp} type="email" value={data.email} onChange={F("email")} placeholder="maintenance@example.gov" /></Field>
            </div>
            <div style={{ marginBottom:14 }}>
              <label style={{ display:"block", fontFamily:T.sans, fontSize:12, fontWeight:600, color:T.subtext, marginBottom:6 }}>Organization Logo (optional)</label>
              <div style={{ display:"flex", gap:12, alignItems:"center" }}>
                {data.logo && <img src={data.logo} alt="logo" style={{ height:64, maxWidth:120, objectFit:"contain", border:`1px solid ${T.border}`, borderRadius:6, padding:4, background:"#fff" }} />}
                <label style={{ fontFamily:T.sans, fontSize:13, fontWeight:600, color:T.accent, cursor:"pointer", padding:"8px 16px", border:`2px solid ${T.accent}`, borderRadius:7 }}>
                  {data.logo?"Change Logo":"Upload Logo"}
                  <input type="file" accept="image/*" onChange={handleLogo} style={{ display:"none" }} />
                </label>
                {data.logo && <button onClick={()=>setData(d=>({...d,logo:""}))} style={{ background:"none", border:"none", color:T.red, cursor:"pointer", fontFamily:T.sans, fontSize:12, fontWeight:600 }}>Remove</button>}
              </div>
            </div>
          </>
        )}

        {/* Step 2: Site / Foundation */}
        {step===2 && (
          <>
            <div style={{ fontFamily:T.sans, fontSize:13, fontWeight:700, color:T.muted, textTransform:"uppercase", letterSpacing:.6, marginBottom:10, paddingBottom:6, borderBottom:`2px solid ${T.border}` }}>Step 2 of {totalSteps} — Site Information</div>
            <p style={{ margin:"0 0 14px", fontFamily:T.sans, fontSize:13, color:T.muted }}>Tell us about where {data.companyName||"your organization"} operates.</p>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"0 16px" }}>
              <Field label="Region / District" half><input style={inp} value={data.region} onChange={F("region")} placeholder="e.g. Southeast Region" /></Field>
              <Field label="Address" half><input style={inp} value={data.address} onChange={F("address")} placeholder="Street address" /></Field>
              <Field label="City, State"><input style={inp} value={data.cityState} onChange={F("cityState")} placeholder="Miami, FL" /></Field>
            </div>
            <div style={{ marginBottom:14 }}>
              <label style={{ display:"block", fontFamily:T.sans, fontSize:12, fontWeight:600, color:T.subtext, marginBottom:5 }}>Equipment Locations (optional)</label>
              <p style={{ margin:"0 0 8px", fontFamily:T.sans, fontSize:12, color:T.muted }}>Add the locations where your equipment is stored (e.g. Main Shop, Motor Pool, Section A). You can add more later.</p>
              <div style={{ display:"flex", gap:8, marginBottom:8 }}>
                <input style={{ ...inp, flex:1 }} placeholder="Location name..." value={data._newLoc} onChange={F("_newLoc")} onKeyDown={e=>e.key==="Enter"&&addLocation()} />
                <Btn small onClick={addLocation}>Add</Btn>
              </div>
              {data.locations.length>0 && (
                <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
                  {data.locations.map((loc,i)=>(
                    <span key={i} style={{ display:"flex", alignItems:"center", gap:6, padding:"5px 10px", background:T.accentLt, border:`1px solid ${T.accent}44`, borderRadius:6, fontFamily:T.sans, fontSize:12, color:T.accent }}>
                      {loc} <button onClick={()=>removeLocation(i)} style={{ background:"none", border:"none", color:T.accent, cursor:"pointer", fontSize:14, lineHeight:1, padding:0 }}>×</button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {/* Step 3: Equipment Categories */}
        {step===3 && (
          <>
            <div style={{ fontFamily:T.sans, fontSize:13, fontWeight:700, color:T.muted, textTransform:"uppercase", letterSpacing:.6, marginBottom:10, paddingBottom:6, borderBottom:`2px solid ${T.border}` }}>Step 3 of {totalSteps} — Equipment Categories</div>
            <p style={{ margin:"0 0 14px", fontFamily:T.sans, fontSize:13, color:T.muted }}>What types of equipment will you manage? We've pre-loaded common categories — add or remove as needed.</p>
            <div style={{ display:"flex", gap:8, marginBottom:12 }}>
              <input style={{ ...inp, flex:1 }} placeholder="New category (e.g. Generators)..." value={data._newCat} onChange={F("_newCat")} onKeyDown={e=>e.key==="Enter"&&addCategory()} />
              <Btn small onClick={addCategory}>Add</Btn>
            </div>
            <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
              {data.categories.map((cat,i)=>(
                <span key={i} style={{ display:"flex", alignItems:"center", gap:6, padding:"6px 12px", background:"#fff", border:`1px solid ${T.border}`, borderRadius:7, fontFamily:T.sans, fontSize:13, color:T.text }}>
                  {cat} <button onClick={()=>removeCategory(i)} style={{ background:"none", border:"none", color:T.red, cursor:"pointer", fontSize:16, lineHeight:1, padding:0 }}>×</button>
                </span>
              ))}
              {data.categories.length===0 && <span style={{ fontFamily:T.sans, fontSize:12, color:T.muted, fontStyle:"italic" }}>No categories yet — add some above.</span>}
            </div>
          </>
        )}

        {/* Step 4: User Profile */}
        {step===4 && (
          <>
            <div style={{ fontFamily:T.sans, fontSize:13, fontWeight:700, color:T.muted, textTransform:"uppercase", letterSpacing:.6, marginBottom:10, paddingBottom:6, borderBottom:`2px solid ${T.border}` }}>Step 4 of {totalSteps} — Your Profile</div>
            <p style={{ margin:"0 0 14px", fontFamily:T.sans, fontSize:13, color:T.muted }}>Tell us about yourself. You'll be the first mechanic in the system.</p>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"0 16px" }}>
              <Field label="First Name *" half><input style={inp} value={data.firstName} onChange={F("firstName")} placeholder="John" autoFocus /></Field>
              <Field label="Last Name" half><input style={inp} value={data.lastName} onChange={F("lastName")} placeholder="Smith" /></Field>
              <Field label="Position" half><input style={inp} value={data.position} onChange={F("position")} placeholder="Mechanic, Supervisor..." /></Field>
              <Field label="Labor Rate ($/hr)" half><input style={inp} type="number" value={data.laborRate} onChange={F("laborRate")} placeholder="45" /></Field>
              <Field label="Phone" half><input style={inp} value={data.profilePhone} onChange={F("profilePhone")} /></Field>
              <Field label="Email" half><input style={inp} type="email" value={data.profileEmail} onChange={F("profileEmail")} /></Field>
            </div>

            <div style={{ marginTop:8 }}>
              <label style={{ display:"block", fontFamily:T.sans, fontSize:12, fontWeight:600, color:T.subtext, marginBottom:5 }}>Additional Mechanics (optional)</label>
              <p style={{ margin:"0 0 8px", fontFamily:T.sans, fontSize:12, color:T.muted }}>Add other mechanics in your shop. You can add more later.</p>
              <div style={{ display:"grid", gridTemplateColumns:"2fr 100px auto", gap:6, marginBottom:8 }}>
                <input style={inp} placeholder="Full name" value={data._newMechName} onChange={F("_newMechName")} onKeyDown={e=>e.key==="Enter"&&addMechanic()} />
                <input style={inp} type="number" placeholder="$/hr" value={data._newMechRate} onChange={F("_newMechRate")} />
                <Btn small onClick={addMechanic}>Add</Btn>
              </div>
              {data.mechanics.length>0 && (
                <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
                  {data.mechanics.map((m,i)=>(
                    <div key={i} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"7px 12px", background:T.grayLt, borderRadius:6, border:`1px solid ${T.border}` }}>
                      <span style={{ fontFamily:T.sans, fontSize:13 }}>{m.name} <span style={{ color:T.muted, fontSize:11, marginLeft:6 }}>${m.laborRate}/hr</span></span>
                      <button onClick={()=>removeMechanic(i)} style={{ background:"none", border:"none", color:T.red, cursor:"pointer", fontSize:16, lineHeight:1 }}>×</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {/* Step 5: Preferences + Review */}
        {step===5 && (
          <>
            <div style={{ fontFamily:T.sans, fontSize:13, fontWeight:700, color:T.muted, textTransform:"uppercase", letterSpacing:.6, marginBottom:10, paddingBottom:6, borderBottom:`2px solid ${T.border}` }}>Step 5 of {totalSteps} — Preferences</div>
            <p style={{ margin:"0 0 14px", fontFamily:T.sans, fontSize:13, color:T.muted }}>Final touches — these can all be changed later in Settings.</p>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"0 16px" }}>
              <Field label="Default Work Order Priority" half>
                <select style={sel} value={data.defaultPriority} onChange={F("defaultPriority")}>{["High","Medium","Low"].map(p=><option key={p}>{p}</option>)}</select>
              </Field>
              <Field label="Date Format" half>
                <select style={sel} value={data.dateFormat} onChange={F("dateFormat")}>{["MM/DD/YYYY","DD/MM/YYYY","YYYY-MM-DD"].map(d=><option key={d}>{d}</option>)}</select>
              </Field>
              <Field label="Currency" half>
                <select style={sel} value={data.currency} onChange={F("currency")}>{["USD","EUR","GBP","CAD"].map(c=><option key={c}>{c}</option>)}</select>
              </Field>
              <Field label="Accent Color" half>
                <div style={{ display:"flex", gap:10, alignItems:"center" }}>
                  <input type="color" value={data.accentColor} onChange={F("accentColor")} style={{ width:44, height:36, border:`1px solid ${T.border}`, borderRadius:6, cursor:"pointer", padding:2 }} />
                  <div style={{ flex:1, height:8, borderRadius:4, background:data.accentColor }}/>
                </div>
              </Field>
            </div>

            {/* Review summary */}
            <div style={{ background:T.accentLt, border:`1px solid ${T.accent}44`, borderRadius:10, padding:"16px 18px", marginTop:8 }}>
              <div style={{ fontFamily:T.sans, fontSize:13, fontWeight:700, color:T.accent, marginBottom:10 }}>✓ Review Your Setup</div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"6px 16px", fontFamily:T.sans, fontSize:12 }}>
                <div><span style={{ color:T.muted }}>Company:</span> <b style={{ color:T.text }}>{data.companyName||"—"}</b></div>
                <div><span style={{ color:T.muted }}>Region:</span> <b style={{ color:T.text }}>{data.region||"—"}</b></div>
                <div><span style={{ color:T.muted }}>Your Name:</span> <b style={{ color:T.text }}>{data.firstName} {data.lastName}</b></div>
                <div><span style={{ color:T.muted }}>Mechanics:</span> <b style={{ color:T.text }}>{1+data.mechanics.length}</b></div>
                <div><span style={{ color:T.muted }}>Locations:</span> <b style={{ color:T.text }}>{data.locations.length}</b></div>
                <div><span style={{ color:T.muted }}>Categories:</span> <b style={{ color:T.text }}>{data.categories.length}</b></div>
              </div>
            </div>
          </>
        )}

        {/* Nav buttons */}
        <div style={{ display:"flex", justifyContent:"space-between", marginTop:24, paddingTop:16, borderTop:`1px solid ${T.border}` }}>
          {step>1 ? <Btn variant="secondary" onClick={back}>← Back</Btn> : <div/>}
          <Btn onClick={next} style={{ minWidth:120, justifyContent:"center" }}>
            {step===totalSteps ? "Finish Setup →" : "Next →"}
          </Btn>
        </div>
      </div>
    </div>
  );
}

const PAGE_TITLES = {
  dashboard:        "Maintenance Dashboard",
  workorders:       "Work Orders",
  equipment:        "Equipment",
  parts:            "Parts Inventory",
  pm:               "Preventive Maintenance",
  usage:            "Usage Tracking",
  spending:         "Spending & Costs",
  inventory:        "Equipment Inventory List",
  reports_deadline: "Deadline Equipment Report",
  reports_parts_inv:"Parts Inventory Report",
  reports_pm:       "PM Reports",
  reports_usage:    "Usage Report",
  reports_spending: "Spending Reports",
  reports_combined: "Combined Report",
};

export default function App() {
  /* Load saved state from localStorage on first mount, fall back to INIT */
  const initialState = (() => {
    try {
      const saved = localStorage.getItem("ncaState");
      if(saved) {
        const parsed = JSON.parse(saved);
        const locs = [...new Set([...(parsed.settings?.locations||[]), parsed.settings?.location, ...(parsed.equipment||[]).map(e=>e.location)].filter(Boolean))];
        return { ...INIT, ...parsed, settings:{ ...(parsed.settings||{}), locations:locs } };
      }
    } catch(e) { console.warn("Failed to load saved state:", e); }
    return { ...INIT, inventoryItems:[], profile:null, woSettings:null };
  })();

  const [state, dispatch] = useReducer(reducer, initialState);

  /* Save state to localStorage on every change */
  useEffect(() => {
    try {
      localStorage.setItem("ncaState", JSON.stringify(state));
    } catch(e) {
      console.warn("Failed to save state:", e);
    }
  }, [state]);
  const [tab, setTab]       = useState("dashboard");
  const [menuOpen, setMenuOpen]           = useState(false);
  const [showProfile, setShowProfile]     = useState(false);
  const [showWOSettings, setShowWOSettings] = useState(false);
  const [showSettings, setShowSettings]   = useState(false);

  const profile      = state.profile || {};
  const settings     = state.settings || {};
  const companyName  = settings.companyName || "NCA Maintenance";

  const initials = profile.firstName&&profile.lastName ? `${profile.firstName[0]}${profile.lastName[0]}`.toUpperCase() : "JM";
  const displayName = profile.firstName ? `${profile.firstName} ${profile.lastName}` : "J. Martinez";

  const pages = {
    dashboard:        <Dashboard        state={state} dispatch={dispatch} setTab={setTab} />,
    workorders:       <WorkOrders       state={state} dispatch={dispatch} woSettings={state.woSettings} onWOSettings={()=>setShowWOSettings(true)} />,
    equipment:        <Equipment        state={state} dispatch={dispatch} />,
    parts:            <Parts            state={state} dispatch={dispatch} />,
    pm:               <PM               state={state} dispatch={dispatch} />,
    usage:            <UsageTracking    state={state} dispatch={dispatch} />,
    spending:         <Spending         state={state} />,
    inventory:        <EquipmentInventory state={state} dispatch={dispatch} />,
    reports_deadline: <ReportDeadline   state={state} />,
    reports_parts_inv:<ReportPartsInv   state={state} />,
    reports_pm:       <ReportPM         state={state} />,
    reports_usage:    <ReportUsage      state={state} />,
    reports_spending: <ReportSpending   state={state} />,
    reports_combined: <ReportCombined   state={state} />,
  };

  /* First-run setup wizard */
  if(!state.setupComplete) {
    return <SetupWizard onComplete={(setupData)=>dispatch({type:"COMPLETE_SETUP",payload:setupData})} />;
  }

  return (
    <div style={{ minHeight:"100vh", background:T.bg, fontFamily:T.sans }}>
      <style>{`
        * { box-sizing:border-box; }
        body { margin:0; }
        ::-webkit-scrollbar { width:6px; height:6px; }
        ::-webkit-scrollbar-track { background:#f1f1f1; }
        ::-webkit-scrollbar-thumb { background:#c1c7d0; border-radius:3px; }
        input:focus, select:focus, textarea:focus { border-color:${T.accent} !important; box-shadow:0 0 0 3px ${T.accentLt}; outline:none; }
        tr:hover { background:${T.accentLt} !important; }
        @media print { .no-print { display:none !important; } }
      `}</style>

      <SlideMenu tab={tab} setTab={setTab} open={menuOpen} onClose={()=>setMenuOpen(false)} onSettings={()=>setShowSettings(true)} companyName={companyName} profile={profile} />

      {/* Custom header with profile button */}
      <header className="no-print" style={{ position:"sticky", top:0, zIndex:1000, background:"#fff", borderBottom:`1px solid ${T.border}`, padding:"0 20px", height:56, display:"flex", alignItems:"center", justifyContent:"space-between", boxShadow:"0 1px 0 #e1e4e8" }}>
        <div style={{ display:"flex", alignItems:"center", gap:14 }}>
          <button onClick={()=>setMenuOpen(v=>!v)} style={{ background:"none", border:`1px solid ${T.border}`, borderRadius:7, padding:"7px 9px", cursor:"pointer", display:"flex", flexDirection:"column", gap:4, alignItems:"center" }}>
            <span style={{ display:"block", width:18, height:2, background:T.subtext, borderRadius:1 }}/>
            <span style={{ display:"block", width:18, height:2, background:T.subtext, borderRadius:1 }}/>
            <span style={{ display:"block", width:18, height:2, background:T.subtext, borderRadius:1 }}/>
          </button>
          <div style={{ width:1, height:28, background:T.border }} />
          {settings?.logo && (
            <img src={settings.logo} alt="logo" style={{ height:36, maxWidth:80, objectFit:"contain", borderRadius:4 }} />
          )}
          <button onClick={()=>setTab("dashboard")} title="Go to dashboard" style={{ background:"none", border:"none", padding:0, textAlign:"left", cursor:"pointer" }}>
            <div style={{ fontFamily:T.sans, fontSize:14, fontWeight:700, color:T.text, letterSpacing:-.3, lineHeight:1.2 }}>{companyName}</div>
            <div style={{ fontFamily:T.sans, fontSize:10, color:T.muted, letterSpacing:.3 }}>National Cemetery Administration</div>
          </button>
          <span style={{ color:T.border, fontSize:18 }}>›</span>
          <span style={{ fontFamily:T.sans, fontSize:13, color:T.subtext, fontWeight:500 }}>{PAGE_TITLES[tab]}</span>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          {/* Notification bell */}
          <NotifBell notifications={state.notifications} dispatch={dispatch} />
          {/* User profile button */}
          <button onClick={()=>setShowProfile(true)} style={{ display:"flex", alignItems:"center", gap:8, padding:"5px 10px", border:`1px solid ${T.border}`, borderRadius:7, background:"none", cursor:"pointer" }}>
            <div style={{ width:24, height:24, borderRadius:"50%", background:T.accent, display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, color:"#fff", fontWeight:700, fontFamily:T.mono, overflow:"hidden" }}>
              {profile.photo ? <img src={profile.photo} alt="me" style={{ width:"100%", height:"100%", objectFit:"cover" }} /> : initials}
            </div>
            <span style={{ fontFamily:T.sans, fontSize:13, fontWeight:500, color:T.text }}>{displayName}</span>
          </button>
        </div>
      </header>

      <main style={{ width:"100%", padding:"24px 32px", minHeight:"calc(100vh - 56px)" }}>
        <div style={{ marginBottom:20 }}>
          <h1 style={{ margin:0, fontFamily:T.sans, fontSize:24, fontWeight:700, color:T.text, letterSpacing:-.4 }}>{PAGE_TITLES[tab]}</h1>
          <div style={{ width:32, height:3, background:T.accent, borderRadius:2, marginTop:6 }} />
        </div>
        {pages[tab]}
      </main>

      {showProfile    && <UserProfile    state={state} dispatch={dispatch} onClose={()=>setShowProfile(false)} />}
      {showWOSettings && <WOSettings     state={state} dispatch={dispatch} onClose={()=>setShowWOSettings(false)} />}
      {showSettings   && <SystemSettings state={state} dispatch={dispatch} onClose={()=>setShowSettings(false)} />}
    </div>
  );
}

/* Separate notification bell so it doesn't cause full re-renders */
function NotifBell({ notifications, dispatch }) {
  const [show, setShow] = useState(false);
  const unread = notifications.filter(n=>!n.read).length;
  return (
    <>
      <button onClick={()=>setShow(v=>!v)} style={{ position:"relative", background:"none", border:`1px solid ${T.border}`, borderRadius:7, cursor:"pointer", padding:"6px 8px", color:T.subtext, fontSize:16, display:"flex", alignItems:"center" }}>
        🔔
        {unread>0 && <span style={{ position:"absolute", top:-4, right:-4, minWidth:16, height:16, background:T.red, borderRadius:8, fontSize:10, color:"#fff", fontWeight:700, display:"flex", alignItems:"center", justifyContent:"center", fontFamily:T.mono, border:"2px solid #fff" }}>{unread}</span>}
      </button>
      {show && <NotifPanel notifications={notifications} dispatch={dispatch} onClose={()=>setShow(false)} />}
    </>
  );
}
