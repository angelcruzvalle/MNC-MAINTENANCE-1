import React, { useEffect, useMemo, useReducer, useRef, useState } from "react";
import { supabase } from "./supabase";

/*
 MaintForge Rebuild v1
 - Single-site: Morovis National Cemetery
 - Compatible with existing MaintForge ncaState/user_state JSON shape
 - No background Inspection WO generator. Inspection WOs are explicit transactions only.
 - Closing an Inspection WO atomically completes the occurrence + advances schedule.
 - Local-first persistence; cloud sync never replaces newer in-memory state after load.
*/

const SITE = { id:"morovis", name:"Morovis National Cemetery" };
const TODAY = () => new Date().toISOString().slice(0,10);
const uid = (p="ID") => `${p}-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
const money = n => Number(n||0).toLocaleString(undefined,{style:"currency",currency:"USD"});
const num = n => Number(n||0);
const clone = v => JSON.parse(JSON.stringify(v));

const emptyState = {
  schemaVersion:2, site:SITE, organizationName:"MaintForge", setupComplete:true,
  equipment:[], workOrders:[], workOrderRequests:[], parts:[], inventoryItems:[], usageLogs:[],
  pmTasks:[], pmSchedules:[], inspectionTasks:[], inspectionSchedules:[],
  fuelContainers:[], fuelReadings:[], technicians:[], notifications:[], settings:{},
};

function normalizeState(raw={}) {
  const s = { ...emptyState, ...(raw||{}) };
  const arrays = ["equipment","workOrders","workOrderRequests","parts","inventoryItems","usageLogs","pmTasks","pmSchedules","inspectionTasks","inspectionSchedules","fuelContainers","fuelReadings","technicians","notifications"];
  arrays.forEach(k=>{ if(!Array.isArray(s[k])) s[k]=[]; });
  s.site = SITE;
  s.schemaVersion = 2;
  // Preserve all old records, but collapse location/facility semantics into Morovis.
  for(const k of arrays) s[k] = s[k].map(x => x && typeof x==="object" ? {...x, locationId:SITE.id, facilityId:SITE.id, facilityName:SITE.name} : x);
  // Make legacy inspection schedules stable and deterministic.
  s.inspectionSchedules = s.inspectionSchedules.map(x=>({
    completedDueOccurrences:[], skippedDueOccurrences:[], ...x,
    completedDueOccurrences:Array.isArray(x.completedDueOccurrences)?x.completedDueOccurrences.map(String):[],
    skippedDueOccurrences:Array.isArray(x.skippedDueOccurrences)?x.skippedDueOccurrences.map(String):[],
  }));
  return s;
}

function addInterval(date, interval=1, unit="months") {
  const d = new Date(`${date||TODAY()}T12:00:00`); const n=Math.max(1,num(interval)||1);
  if(unit==="days") d.setDate(d.getDate()+n);
  else if(unit==="weeks") d.setDate(d.getDate()+n*7);
  else if(unit==="years") d.setFullYear(d.getFullYear()+n);
  else d.setMonth(d.getMonth()+n);
  return d.toISOString().slice(0,10);
}
function inspectionOccurrence(s){ return String(s?.nextDueDate||""); }
function inspectionKey(s){ return `${s?.equipmentId||s?.equipment||""}|${s?.inspectionTaskId||s?.taskId||s?.inspectionId||s?.name||""}|${inspectionOccurrence(s)}`; }
function woInspectionKey(w){ return `${w?.equipment||w?.equipmentId||""}|${w?.inspectionTaskId||w?.taskId||w?.inspectionId||w?.inspectionName||w?.taskName||""}|${w?.inspectionDueOccurrence||w?.due||""}`; }
function taskForSchedule(state,s){ return state.inspectionTasks.find(t=>String(t.id)===String(s.inspectionTaskId||s.taskId||s.inspectionId)) || null; }
function eqFor(state,id){ return state.equipment.find(e=>String(e.id)===String(id)); }
function intervalForInspection(state,s){
  const t=taskForSchedule(state,s)||{};
  return { interval:num(s.timeInterval||t.timeInterval||t.interval||1)||1, unit:s.timeUnit||t.timeUnit||t.intervalUnit||"months" };
}
function advanceInspectionSchedule(state,s,doneDate,occurrence,woId,kind="completed"){
  const {interval,unit}=intervalForInspection(state,s);
  const next=addInterval(doneDate,interval,unit);
  const completed = new Set((s.completedDueOccurrences||[]).map(String));
  const skipped = new Set((s.skippedDueOccurrences||[]).map(String));
  if(occurrence){ if(kind==="completed") completed.add(String(occurrence)); else skipped.add(String(occurrence)); }
  return {...s,lastDoneDate:doneDate,lastInspectionDate:doneDate,lastTriggered:doneDate,nextDueDate:next,lastGeneratedDueDate:String(occurrence||""),lastGeneratedWorkOrderId:woId||"",completedDueOccurrences:[...completed],skippedDueOccurrences:[...skipped]};
}

function reducer(state, action){
  const {type,payload}=action;
  switch(type){
    case "LOAD": return normalizeState(payload);
    case "ADD_EQ": return {...state,equipment:[{...payload,locationId:SITE.id,facilityId:SITE.id},...state.equipment]};
    case "UPDATE_EQ": return {...state,equipment:state.equipment.map(x=>x.id===payload.id?{...x,...payload}:x)};
    case "DELETE_EQ": return {...state,equipment:state.equipment.filter(x=>x.id!==payload)};
    case "ADD_PART": return {...state,parts:[payload,...state.parts]};
    case "UPDATE_PART": return {...state,parts:state.parts.map(x=>x.id===payload.id?{...x,...payload}:x)};
    case "ADD_USAGE": return {...state,usageLogs:[payload,...state.usageLogs],equipment:state.equipment.map(e=>String(e.id)===String(payload.equipmentId)?{...e,currentUsage:payload.value,usage:payload.value}:e)};
    case "ADD_PM_TASK": return {...state,pmTasks:[payload,...state.pmTasks]};
    case "ADD_PM_SCHEDULE": return {...state,pmSchedules:[payload,...state.pmSchedules]};
    case "UPDATE_PM_SCHEDULE": return {...state,pmSchedules:state.pmSchedules.map(x=>x.id===payload.id?{...x,...payload}:x)};
    case "ADD_INSPECTION_TASK": return {...state,inspectionTasks:[payload,...state.inspectionTasks]};
    case "ADD_INSPECTION_SCHEDULE": return {...state,inspectionSchedules:[payload,...state.inspectionSchedules]};
    case "UPDATE_INSPECTION_SCHEDULE": return {...state,inspectionSchedules:state.inspectionSchedules.map(x=>x.id===payload.id?{...x,...payload}:x)};
    case "TRIGGER_INSPECTION": {
      const sid=String(payload.scheduleId); const s=state.inspectionSchedules.find(x=>String(x.id)===sid); if(!s) return state;
      const occurrence=inspectionOccurrence(s); if(!occurrence) return state;
      const key=inspectionKey(s);
      const already=state.workOrders.some(w=>w.woType==="Inspection" && woInspectionKey(w)===key);
      if(already || (s.completedDueOccurrences||[]).map(String).includes(occurrence) || (s.skippedDueOccurrences||[]).map(String).includes(occurrence)) return state;
      const task=taskForSchedule(state,s)||{}; const eq=eqFor(state,s.equipmentId||s.equipment)||{};
      const wo={id:payload.woId||uid("IWO"),woType:"Inspection",status:"Open",created:TODAY(),due:occurrence,equipment:s.equipmentId||s.equipment||"",equipmentName:eq.nomenclature||eq.name||"",description:task.name||s.name||"Inspection",inspectionName:task.name||s.name||"Inspection",inspectionTaskId:task.id||s.inspectionTaskId||s.taskId||"",inspectionScheduleId:s.id,inspectionDueOccurrence:occurrence,inspectionSteps:clone(task.steps||[]),partsUsed:[],labor:[],additionalCosts:[],locationId:SITE.id,facilityId:SITE.id};
      const schedules=state.inspectionSchedules.map(x=>String(x.id)===sid?{...x,lastGeneratedDueDate:occurrence,lastGeneratedWorkOrderId:wo.id}:x);
      return {...state,workOrders:[wo,...state.workOrders],inspectionSchedules:schedules};
    }
    case "ADD_WO": return {...state,workOrders:[{...payload,locationId:SITE.id,facilityId:SITE.id},...state.workOrders]};
    case "UPDATE_WO": {
      const old=state.workOrders.find(w=>String(w.id)===String(payload.id)); if(!old) return state;
      const merged={...old,...payload}; let schedules=state.inspectionSchedules;
      if(old.woType==="Inspection" && old.status!=="Completed" && merged.status==="Completed"){
        const occurrence=String(old.inspectionDueOccurrence||old.due||"");
        let s=schedules.find(x=>String(x.id)===String(old.inspectionScheduleId));
        if(!s){ const keyPrefix=`${old.equipment||old.equipmentId||""}|${old.inspectionTaskId||old.taskId||old.inspectionId||old.inspectionName||old.taskName||""}|`; s=schedules.find(x=>inspectionKey(x)===keyPrefix+occurrence); }
        if(s){ const advanced=advanceInspectionSchedule(state,s,merged.completed||TODAY(),occurrence,old.id,"completed"); schedules=schedules.map(x=>String(x.id)===String(s.id)?advanced:x); }
      }
      return {...state,workOrders:state.workOrders.map(w=>String(w.id)===String(payload.id)?merged:w),inspectionSchedules:schedules};
    }
    case "DELETE_WO": {
      const old=state.workOrders.find(w=>String(w.id)===String(payload)); let schedules=state.inspectionSchedules;
      if(old?.woType==="Inspection"){
        const occurrence=String(old.inspectionDueOccurrence||old.due||""); const s=schedules.find(x=>String(x.id)===String(old.inspectionScheduleId));
        if(s){ const advanced=advanceInspectionSchedule(state,s,TODAY(),occurrence,old.id,"skipped"); schedules=schedules.map(x=>String(x.id)===String(s.id)?advanced:x); }
      }
      return {...state,workOrders:state.workOrders.filter(w=>String(w.id)!==String(payload)),inspectionSchedules:schedules};
    }
    case "ADD_FUEL_CONTAINER": return {...state,fuelContainers:[payload,...state.fuelContainers]};
    case "ADD_FUEL_READING": return {...state,fuelReadings:[payload,...state.fuelReadings]};
    case "REPLACE": return normalizeState(payload);
    default:return state;
  }
}

const C={bg:"#f4f6f8",card:"#fff",ink:"#18212b",muted:"#667085",line:"#dfe4ea",blue:"#155eef",green:"#067647",red:"#b42318",amber:"#b54708"};
const css=`*{box-sizing:border-box}body{margin:0;font-family:Inter,system-ui,-apple-system,sans-serif;background:${C.bg};color:${C.ink}}button,input,select,textarea{font:inherit}.app{min-height:100vh}.top{position:sticky;top:0;z-index:20;background:#101828;color:white;padding:12px 18px;display:flex;gap:12px;align-items:center;justify-content:space-between}.brand{font-weight:850;font-size:20px}.site{font-size:12px;opacity:.75}.nav{display:flex;gap:6px;overflow:auto;background:white;border-bottom:1px solid ${C.line};padding:8px 12px;position:sticky;top:60px;z-index:19}.nav button,.btn{border:1px solid ${C.line};background:white;border-radius:8px;padding:8px 11px;cursor:pointer}.nav button.active,.btn.primary{background:${C.blue};color:white;border-color:${C.blue}}.btn.danger{color:${C.red};border-color:#f3b5af}.wrap{max-width:1450px;margin:auto;padding:18px}.grid{display:grid;grid-template-columns:repeat(12,1fr);gap:12px}.card{background:white;border:1px solid ${C.line};border-radius:12px;padding:15px;box-shadow:0 1px 2px #1018280d}.span3{grid-column:span 3}.span4{grid-column:span 4}.span6{grid-column:span 6}.span12{grid-column:span 12}.metric{font-size:28px;font-weight:850}.muted{color:${C.muted};font-size:13px}.row{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.between{justify-content:space-between}.field{display:flex;flex-direction:column;gap:5px;min-width:150px;flex:1}.field input,.field select,.field textarea{border:1px solid ${C.line};border-radius:8px;padding:9px;background:white}.table{width:100%;border-collapse:collapse}.table th,.table td{text-align:left;border-bottom:1px solid ${C.line};padding:9px 7px;font-size:13px}.pill{display:inline-block;padding:3px 7px;border-radius:99px;background:#eef4ff;font-size:12px}.modal{position:fixed;inset:0;background:#10182899;z-index:50;display:grid;place-items:center;padding:15px}.modalbox{background:white;border-radius:14px;width:min(760px,100%);max-height:92vh;overflow:auto;padding:18px}.sync{font-size:12px;padding:5px 8px;border-radius:99px;background:#344054}.sync.err{background:#7a271a}.sync.ok{background:#05603a}@media(max-width:800px){.top{align-items:flex-start}.nav{top:72px}.wrap{padding:10px}.span3,.span4,.span6{grid-column:span 12}.table{display:block;overflow:auto}.modal{padding:0;place-items:stretch}.modalbox{border-radius:0;max-height:none;height:100vh;width:100%}.btn{min-height:42px}}`;

function Button({children,onClick,kind="",type="button",disabled=false}){return <button type={type} disabled={disabled} onClick={onClick} className={`btn ${kind}`}>{children}</button>}
function Field({label,children}){return <label className="field"><span className="muted">{label}</span>{children}</label>}
function Modal({title,onClose,children}){return <div className="modal"><div className="modalbox"><div className="row between"><h2>{title}</h2><Button onClick={onClose}>Close</Button></div>{children}</div></div>}
function Table({headers,children}){return <table className="table"><thead><tr>{headers.map(h=><th key={h}>{h}</th>)}</tr></thead><tbody>{children}</tbody></table>}

function Dashboard({state}){
 const open=state.workOrders.filter(w=>w.status!=="Completed"); const due=state.inspectionSchedules.filter(s=>s.nextDueDate&&s.nextDueDate<=TODAY());
 const spend=state.workOrders.filter(w=>w.status==="Completed").reduce((a,w)=>a+(w.partsUsed||[]).reduce((x,p)=>x+num(p.qty||p.quantity)*num(p.cost||p.unitCost),0)+(w.additionalCosts||[]).reduce((x,c)=>x+num(c.amount||c.cost),0),0);
 return <div className="grid"><div className="card span3"><div className="muted">Equipment</div><div className="metric">{state.equipment.length}</div></div><div className="card span3"><div className="muted">Open Work Orders</div><div className="metric">{open.length}</div></div><div className="card span3"><div className="muted">Inspections Due</div><div className="metric">{due.length}</div></div><div className="card span3"><div className="muted">Recorded Spend</div><div className="metric">{money(spend)}</div></div><div className="card span12"><h3>Due inspections</h3>{due.length?due.slice(0,12).map(s=><div className="row between" key={s.id}><span>{eqFor(state,s.equipmentId||s.equipment)?.nomenclature||s.equipmentId} — {taskForSchedule(state,s)?.name||s.name||"Inspection"}</span><span className="pill">Due {s.nextDueDate}</span></div>):<p className="muted">No inspections currently due.</p>}</div></div>
}

function Equipment({state,dispatch}){const [edit,setEdit]=useState(null); const save=e=>{e.preventDefault();const f=new FormData(e.currentTarget);const p={id:edit?.id||uid("EQ"),nomenclature:f.get("name"),equipmentNumber:f.get("number"),make:f.get("make"),model:f.get("model"),status:f.get("status"),usageType:f.get("usageType")};dispatch({type:edit?"UPDATE_EQ":"ADD_EQ",payload:p});setEdit(null)};return <><div className="row between"><h2>Equipment</h2><Button kind="primary" onClick={()=>setEdit({})}>Add Equipment</Button></div><div className="card"><Table headers={["Equipment","Number","Make / Model","Status","Action"]}>{state.equipment.map(e=><tr key={e.id}><td>{e.nomenclature||e.name||e.id}</td><td>{e.equipmentNumber||e.eil||"—"}</td><td>{e.make||""} {e.model||""}</td><td>{e.status||"Fully Operational"}</td><td><Button onClick={()=>setEdit(e)}>Edit</Button></td></tr>)}</Table></div>{edit&&<Modal title={edit.id?"Edit Equipment":"Add Equipment"} onClose={()=>setEdit(null)}><form onSubmit={save} className="grid"><Field label="Nomenclature"><input name="name" defaultValue={edit.nomenclature||edit.name||""} required/></Field><Field label="Equipment #"><input name="number" defaultValue={edit.equipmentNumber||edit.eil||""}/></Field><Field label="Make"><input name="make" defaultValue={edit.make||""}/></Field><Field label="Model"><input name="model" defaultValue={edit.model||""}/></Field><Field label="Status"><select name="status" defaultValue={edit.status||"Fully Operational"}><option>Fully Operational</option><option>Operational With Deficiencies</option><option>Deadline</option></select></Field><Field label="Usage"><select name="usageType" defaultValue={edit.usageType||"hours"}><option value="hours">Hours</option><option value="mileage">Miles</option><option value="na">N/A</option></select></Field><div className="span12"><Button type="submit" kind="primary">Save Equipment</Button></div></form></Modal>}</>}

function WorkOrders({state,dispatch}){const [edit,setEdit]=useState(null);const save=e=>{e.preventDefault();const f=new FormData(e.currentTarget);const old=edit||{};dispatch({type:old.id?"UPDATE_WO":"ADD_WO",payload:{...old,id:old.id||uid("WO"),woType:f.get("type"),equipment:f.get("equipment"),description:f.get("description"),status:f.get("status"),created:f.get("created"),due:f.get("due"),completed:f.get("status")==="Completed"?(f.get("completed")||TODAY()):old.completed||""}});setEdit(null)};return <><div className="row between"><h2>Work Orders</h2><Button kind="primary" onClick={()=>setEdit({created:TODAY(),status:"Open",woType:"Repair"})}>New Work Order</Button></div><div className="card"><Table headers={["WO","Type","Equipment","Description","Status","Due","Action"]}>{state.workOrders.map(w=><tr key={w.id}><td>{w.id}</td><td>{w.woType||w.type}</td><td>{eqFor(state,w.equipment)?.nomenclature||w.equipment}</td><td>{w.description}</td><td><span className="pill">{w.status}</span></td><td>{w.due||"—"}</td><td className="row"><Button onClick={()=>setEdit(w)}>Edit</Button><Button kind="danger" onClick={()=>confirm("Delete this work order?")&&dispatch({type:"DELETE_WO",payload:w.id})}>Delete</Button></td></tr>)}</Table></div>{edit&&<Modal title={edit.id?`Work Order ${edit.id}`:"New Work Order"} onClose={()=>setEdit(null)}><form onSubmit={save} className="grid"><Field label="Type"><select name="type" defaultValue={edit.woType||"Repair"}><option>Repair</option><option>Service</option><option>Inspection</option></select></Field><Field label="Equipment"><select name="equipment" defaultValue={edit.equipment||""} required><option value="">Choose...</option>{state.equipment.map(x=><option key={x.id} value={x.id}>{x.nomenclature||x.name||x.id}</option>)}</select></Field><Field label="Status"><select name="status" defaultValue={edit.status||"Open"}><option>Open</option><option>In Progress</option><option>Completed</option></select></Field><Field label="Created"><input type="date" name="created" defaultValue={edit.created||TODAY()}/></Field><Field label="Due"><input type="date" name="due" defaultValue={edit.due||""}/></Field><Field label="Completed"><input type="date" name="completed" defaultValue={edit.completed||""}/></Field><div className="span12"><Field label="Description"><textarea name="description" rows="4" defaultValue={edit.description||""}/></Field></div><div className="span12"><Button type="submit" kind="primary">Save Work Order</Button></div></form></Modal>}</>}

function Inspections({state,dispatch}){const [task,setTask]=useState(false),[assign,setAssign]=useState(false);const due=state.inspectionSchedules.filter(s=>s.nextDueDate&&s.nextDueDate<=TODAY());const trigger=s=>{const before=state.workOrders.length;dispatch({type:"TRIGGER_INSPECTION",payload:{scheduleId:s.id}});};return <><div className="row between"><div><h2>Inspections</h2><div className="muted">No background WO generation. A WO exists only after you press Trigger WO.</div></div><div className="row"><Button onClick={()=>setTask(true)}>New Inspection</Button><Button kind="primary" onClick={()=>setAssign(true)}>Assign Inspection</Button></div></div><div className="card"><h3>Assigned inspections</h3><Table headers={["Equipment","Inspection","Next Due","State","Action"]}>{state.inspectionSchedules.map(s=>{const occurrence=inspectionOccurrence(s);const key=inspectionKey(s);const existing=state.workOrders.find(w=>w.woType==="Inspection"&&woInspectionKey(w)===key);return <tr key={s.id}><td>{eqFor(state,s.equipmentId||s.equipment)?.nomenclature||s.equipmentId}</td><td>{taskForSchedule(state,s)?.name||s.name||"Inspection"}</td><td>{s.nextDueDate||"—"}</td><td>{existing?<span className="pill">WO {existing.status}</span>:occurrence&&occurrence<=TODAY()?<span className="pill">Due</span>:"Scheduled"}</td><td><Button disabled={!!existing||!occurrence} onClick={()=>trigger(s)}>Trigger WO</Button></td></tr>})}</Table></div>{task&&<Modal title="New Inspection Task" onClose={()=>setTask(false)}><form onSubmit={e=>{e.preventDefault();const f=new FormData(e.currentTarget);dispatch({type:"ADD_INSPECTION_TASK",payload:{id:uid("IT"),name:f.get("name"),timeInterval:num(f.get("interval")),timeUnit:f.get("unit"),steps:f.get("steps").split("\n").filter(Boolean).map((x,i)=>({id:i+1,text:x}))}});setTask(false)}}><Field label="Name"><input name="name" required/></Field><div className="row"><Field label="Every"><input name="interval" type="number" min="1" defaultValue="1"/></Field><Field label="Unit"><select name="unit"><option value="days">Days</option><option value="weeks">Weeks</option><option value="months">Months</option><option value="years">Years</option></select></Field></div><Field label="Steps (one per line)"><textarea name="steps" rows="8"/></Field><Button type="submit" kind="primary">Save Inspection</Button></form></Modal>}{assign&&<Modal title="Assign Inspection" onClose={()=>setAssign(false)}><form onSubmit={e=>{e.preventDefault();const f=new FormData(e.currentTarget);const task=state.inspectionTasks.find(t=>String(t.id)===String(f.get("task")))||{};dispatch({type:"ADD_INSPECTION_SCHEDULE",payload:{id:uid("IS"),equipmentId:f.get("equipment"),inspectionTaskId:f.get("task"),nextDueDate:f.get("due"),timeInterval:num(task.timeInterval||1),timeUnit:task.timeUnit||"months",completedDueOccurrences:[],skippedDueOccurrences:[]}});setAssign(false)}}><Field label="Equipment"><select name="equipment" required><option value="">Choose...</option>{state.equipment.map(x=><option key={x.id} value={x.id}>{x.nomenclature||x.name||x.id}</option>)}</select></Field><Field label="Inspection"><select name="task" required><option value="">Choose...</option>{state.inspectionTasks.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></Field><Field label="Next Due"><input name="due" type="date" required defaultValue={TODAY()}/></Field><Button type="submit" kind="primary">Assign</Button></form></Modal>}</>}

function PM({state,dispatch}){return <><div className="row between"><h2>Preventive Maintenance</h2></div><div className="card"><p className="muted">Existing PM tasks and schedules are preserved from your current data. This rebuild intentionally does not create PM work orders in a background effect; scheduled work should be explicitly triggered so state changes cannot create duplicate work orders.</p><Table headers={["Equipment","Task","Next Due"]}>{state.pmSchedules.map(s=><tr key={s.id}><td>{eqFor(state,s.equipmentId)?.nomenclature||s.equipmentId}</td><td>{state.pmTasks.find(t=>String(t.id)===String(s.pmTaskId||s.taskId))?.name||s.name||"PM"}</td><td>{s.nextDueDate||"—"}</td></tr>)}</Table></div></>}
function Inventory({state}){const items=state.parts.length?state.parts:state.inventoryItems;return <><h2>Parts & Inventory</h2><div className="card"><Table headers={["Part","Part #","Qty","Unit","Cost"]}>{items.map((p,i)=><tr key={p.id||i}><td>{p.name||p.partName}</td><td>{p.partNumber||p.number||"—"}</td><td>{p.qty??p.quantity??p.stock??0}</td><td>{p.unit||"ea"}</td><td>{money(p.cost||p.unitCost)}</td></tr>)}</Table></div></>}
function Fuel({state,dispatch}){const [add,setAdd]=useState(false);return <><div className="row between"><h2>Fuel Tracking</h2><Button kind="primary" onClick={()=>setAdd(true)}>Add Reading</Button></div><div className="grid">{state.fuelContainers.map(c=>{const r=state.fuelReadings.filter(x=>String(x.containerId)===String(c.id)).sort((a,b)=>String(b.date).localeCompare(String(a.date)))[0];return <div className="card span4" key={c.id}><h3>{c.name||c.fuelType||"Fuel"}</h3><div className="metric">{num(r?.gallons||r?.levelGallons||c.currentGallons).toFixed(0)} gal</div><div className="muted">Capacity {num(c.capacityGallons||c.capacity||0).toFixed(0)} gal</div></div>})}</div>{add&&<Modal title="Fuel Reading" onClose={()=>setAdd(false)}><form onSubmit={e=>{e.preventDefault();const f=new FormData(e.currentTarget);dispatch({type:"ADD_FUEL_READING",payload:{id:uid("FR"),containerId:f.get("container"),date:f.get("date"),gallons:num(f.get("gallons"))}});setAdd(false)}}><Field label="Container"><select name="container" required>{state.fuelContainers.map(c=><option key={c.id} value={c.id}>{c.name||c.fuelType}</option>)}</select></Field><Field label="Date"><input name="date" type="date" defaultValue={TODAY()}/></Field><Field label="Gallons"><input name="gallons" type="number" step="0.01"/></Field><Button type="submit" kind="primary">Save Reading</Button></form></Modal>}</>}
function Reports({state}){const completed=state.workOrders.filter(w=>w.status==="Completed");return <><h2>Reports</h2><div className="grid"><div className="card span4"><div className="muted">Completed WOs</div><div className="metric">{completed.length}</div></div><div className="card span4"><div className="muted">Repair WOs</div><div className="metric">{completed.filter(w=>w.woType==="Repair").length}</div></div><div className="card span4"><div className="muted">Inspection WOs</div><div className="metric">{completed.filter(w=>w.woType==="Inspection").length}</div></div></div></>}
function Settings({state,dispatch}){const file=useRef();const download=()=>{const b=new Blob([JSON.stringify(state,null,2)],{type:"application/json"});const a=document.createElement("a");a.href=URL.createObjectURL(b);a.download=`MaintForge_Morovis_Backup_${TODAY()}.json`;a.click();URL.revokeObjectURL(a.href)};const load=async e=>{const f=e.target.files?.[0];if(!f)return;try{const data=JSON.parse(await f.text());if(confirm("Replace the current workspace with this backup?"))dispatch({type:"REPLACE",payload:data})}catch(err){alert("That file is not a valid MaintForge JSON backup.")}};return <><h2>Settings</h2><div className="card"><h3>Foundation</h3><p><b>Site:</b> {SITE.name}</p><p className="muted">This rebuild is intentionally single-site. Organization/facility switching and Puerto Rico National Cemetery complexity are not used.</p></div><div className="card" style={{marginTop:12}}><h3>Data</h3><div className="row"><Button onClick={download}>Download Data</Button><Button onClick={()=>file.current?.click()}>Restore JSON Backup</Button><input ref={file} type="file" accept="application/json" hidden onChange={load}/></div></div></>}

export default function App(){
 const [state,dispatch]=useReducer(reducer,emptyState); const [page,setPage]=useState("Dashboard"); const [loaded,setLoaded]=useState(false); const [sync,setSync]=useState("loading"); const [syncError,setSyncError]=useState(""); const [userId,setUserId]=useState(""); const saveSeq=useRef(0);
 useEffect(()=>{let dead=false;(async()=>{let local=null;try{local=JSON.parse(localStorage.getItem("ncaState")||"null")}catch{};let uid="";try{const {data}=await supabase.auth.getSession();uid=data?.session?.user?.id||""}catch{};if(dead)return;setUserId(uid);let cloud=null;if(uid){try{const {data,error}=await supabase.from("user_state").select("data").eq("user_id",uid).maybeSingle();if(!error)cloud=data?.data||null}catch{}}const chosen=cloud&&Object.keys(cloud).length?cloud:local||emptyState;dispatch({type:"LOAD",payload:chosen});setLoaded(true);setSync("idle")})();return()=>{dead=true}},[]);
 useEffect(()=>{if(!loaded)return;const seq=++saveSeq.current;try{localStorage.setItem("ncaState",JSON.stringify(state));if(userId)localStorage.setItem("ncaState:lastUserId",userId)}catch{};setSync("saving");const t=setTimeout(async()=>{if(seq!==saveSeq.current)return;if(!userId){setSync("local");return}try{const {error}=await supabase.from("user_state").upsert({user_id:userId,data:state,updated_at:new Date().toISOString()},{onConflict:"user_id"});if(error)throw error;if(seq===saveSeq.current){setSyncError("");setSync("saved");setTimeout(()=>setSync(x=>x==="saved"?"idle":x),1200)}}catch(e){if(seq===saveSeq.current){setSyncError(`${e?.message||e}${e?.code?` [${e.code}]`:""}`);setSync("error")}}},700);return()=>clearTimeout(t)},[state,loaded,userId]);
 const pages=["Dashboard","Equipment","Work Orders","PM","Inspections","Inventory","Fuel","Reports","Settings"];
 if(!loaded)return <><style>{css}</style><div className="wrap"><div className="card">Loading MaintForge data…</div></div></>;
 const content={Dashboard:<Dashboard state={state}/>,Equipment:<Equipment state={state} dispatch={dispatch}/>,"Work Orders":<WorkOrders state={state} dispatch={dispatch}/>,PM:<PM state={state} dispatch={dispatch}/>,Inspections:<Inspections state={state} dispatch={dispatch}/>,Inventory:<Inventory state={state}/>,Fuel:<Fuel state={state} dispatch={dispatch}/>,Reports:<Reports state={state}/>,Settings:<Settings state={state} dispatch={dispatch}/>}[page];
 return <div className="app"><style>{css}</style><header className="top"><div><div className="brand">MaintForge</div><div className="site">{SITE.name}</div></div><button className={`sync ${sync==="error"?"err":sync==="saved"?"ok":""}`} onClick={()=>syncError&&alert(syncError)}>{sync==="saving"?"Saving…":sync==="saved"?"Saved":sync==="error"?"Save failed — tap":sync==="local"?"Saved locally":"Ready"}</button></header><nav className="nav">{pages.map(p=><button key={p} className={page===p?"active":""} onClick={()=>setPage(p)}>{p}</button>)}</nav><main className="wrap">{content}</main></div>
}
