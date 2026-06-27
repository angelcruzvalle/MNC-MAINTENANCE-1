import { useState, useReducer, useEffect, useRef } from "react";
import { supabase } from "./supabase";
import React from "react";

const fontLink = document.createElement("link");
fontLink.rel = "stylesheet";
fontLink.href = "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap";
document.head.appendChild(fontLink);

const LIGHT_THEME = {
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

const DARK_THEME = {
  ...LIGHT_THEME,
  bg:       "#0b1120",
  surface:  "#111827",
  card:     "#182235",
  border:   "#334155",
  borderHi: "#64748b",
  accent:   "#60a5fa",
  accentLt: "#172554",
  red:      "#fca5a5",
  redLt:    "#3b1f25",
  green:    "#86efac",
  greenLt:  "#123524",
  amber:    "#fcd34d",
  amberLt:  "#3b2f12",
  gray:     "#cbd5e1",
  grayLt:   "#1e293b",
  text:     "#f8fafc",
  subtext:  "#e2e8f0",
  muted:    "#cbd5e1",
  shadow:   "0 1px 3px rgba(0,0,0,0.55), 0 1px 2px rgba(0,0,0,0.45)",
  shadowMd: "0 8px 20px rgba(0,0,0,0.50), 0 2px 6px rgba(0,0,0,0.45)",
};

const T = { ...LIGHT_THEME };

function applyThemeMode(mode="light") {
  Object.assign(T, mode === "dark" ? DARK_THEME : LIGHT_THEME);
}

function themedStatusStyle(style={}) {
  try {
    const isDark = T.bg === DARK_THEME.bg;
    if(!isDark) return style;
    return {
      ...style,
      bg: T.grayLt,
      border: T.borderHi,
      color: style.color === "#7f1d1d" ? T.red : style.color === "#065f46" ? T.green : style.color === "#92400e" || style.color === "#78350f" ? T.amber : T.subtext
    };
  } catch(e) { return style; }
}

function getEffectiveThemeMode(theme="light") {
  if(theme === "system") {
    try { return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"; } catch(e) { return "light"; }
  }
  return theme === "dark" ? "dark" : "light";
}


const DEFAULT_UNIT_TYPES = [
  "ea", "each", "numerous", "quart", "quarts", "qt", "gallon", "gallons", "gal",
  "liter", "liters", "L", "oz", "fl oz", "pint", "pints", "pt", "case", "box",
  "pack", "pk", "set", "pair", "roll", "tube", "can", "bottle", "bucket",
  "drum", "bag", "lb", "lbs", "ft", "in", "meter", "m"
];

function getUnitOptionsFromState(state={}) {
  const seen = new Set();
  const add = (u) => { const v = String(u||"").trim(); if(v) seen.add(v); };
  DEFAULT_UNIT_TYPES.forEach(add);
  (state.parts||[]).forEach(p=>add(p.unit||p.unitType));
  (state.pmTasks||[]).forEach(t=>(t.parts||[]).forEach(part=>add(part.unit||part.unitType)));
  (state.workOrders||[]).forEach(w=>(w.partsUsed||[]).forEach(part=>add(part.unit||part.unitType)));
  return Array.from(seen).sort((a,b)=>a.localeCompare(b, undefined, { numeric:true, sensitivity:"base" }));
}

const handleUnitSelectChange = (value, currentValue, setValue) => {
  if(value === "__new_unit__") {
    const custom = prompt("Enter new unit type:", currentValue && currentValue !== "__new_unit__" ? currentValue : "");
    if(custom && custom.trim()) setValue(custom.trim());
    return;
  }
  setValue(value);
};

const DEFAULT_PART_CATEGORIES = [
  "Spark Plug", "Belt", "Blade", "Filter", "Oil Filter", "Water Separator", "Fuel Filter",
  "Air Filter", "Hydraulic Filter", "Cabin Filter", "Battery", "Tire", "Tube", "Bearing",
  "Seal", "Gasket", "Hose", "Fitting", "Bulb", "Fuse", "Relay", "Switch", "Sensor",
  "Brake Pad", "Brake Shoe", "Cable", "Chain", "Sprocket", "Oil", "Hydraulic Oil",
  "Grease", "Coolant", "Urea/DEF", "Paint", "Hardware", "Other"
];

function getPartCategoryOptions(state={}) {
  const seen = new Set();
  const add = (c) => { const v = String(c||"").trim(); if(v) seen.add(v); };
  DEFAULT_PART_CATEGORIES.forEach(add);
  (state.parts||[]).forEach(p=>add(p.category));
  (state.pmTasks||[]).forEach(t=>(t.parts||[]).forEach(part=>add(part.category)));
  (state.workOrders||[]).forEach(w=>(w.partsUsed||[]).forEach(part=>add(part.category)));
  return Array.from(seen).sort((a,b)=>a.localeCompare(b, undefined, { numeric:true, sensitivity:"base" }));
}

function getEquipmentModelOptions(equipment=[]) {
  const seen = new Set();
  (equipment||[]).forEach(e=>{
    const model = `${e.make||""} ${e.model||""}`.replace(/\s+/g," ").trim() || String(e.model||"").trim();
    if(model) seen.add(model);
  });
  return Array.from(seen).sort((a,b)=>a.localeCompare(b, undefined, { numeric:true, sensitivity:"base" }));
}

function getPartStockStatus(part={}) {
  const qty = +(part.qty||0);
  const min = +(part.minQty||0);
  if(qty <= 0) return "Out of Stock";
  if(part.lowStockAlert !== false && qty <= min) return "Low Stock";
  return "In Stock";
}


const CONVAULT_2000_CALIBRATION = [
  { inches:0, gallons:0 }, { inches:0.125, gallons:5 }, { inches:0.25, gallons:11 }, { inches:0.375, gallons:16 }, { inches:0.5, gallons:22 }, { inches:0.625, gallons:27 }, { inches:0.75, gallons:33 }, { inches:0.875, gallons:38 },
  { inches:1, gallons:44 }, { inches:2, gallons:88 }, { inches:3, gallons:131 }, { inches:4, gallons:175 }, { inches:5, gallons:219 }, { inches:6, gallons:263 }, { inches:7, gallons:306 }, { inches:8, gallons:350 }, { inches:9, gallons:394 }, { inches:10, gallons:438 },
  { inches:11, gallons:481 }, { inches:12, gallons:525 }, { inches:13, gallons:569 }, { inches:14, gallons:613 }, { inches:15, gallons:656 }, { inches:16, gallons:700 }, { inches:17, gallons:744 }, { inches:18, gallons:788 }, { inches:19, gallons:832 }, { inches:20, gallons:875 },
  { inches:21, gallons:919 }, { inches:22, gallons:963 }, { inches:23, gallons:1007 }, { inches:24, gallons:1050 }, { inches:25, gallons:1094 }, { inches:26, gallons:1138 }, { inches:27, gallons:1182 }, { inches:28, gallons:1225 }, { inches:29, gallons:1269 }, { inches:30, gallons:1313 },
  { inches:31, gallons:1357 }, { inches:32, gallons:1401 }, { inches:33, gallons:1444 }, { inches:34, gallons:1488 }, { inches:35, gallons:1532 }, { inches:36, gallons:1576 }, { inches:37, gallons:1619 }, { inches:38, gallons:1663 }, { inches:39, gallons:1707 }, { inches:40, gallons:1751 },
  { inches:41, gallons:1794 }, { inches:42, gallons:1838 }, { inches:43, gallons:1882 }, { inches:44, gallons:1926 }, { inches:45, gallons:1969 }, { inches:46, gallons:2013 }, { inches:46.75, gallons:2046 }
];

function parseNumber(value, fallback=0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function parseInches(value, fallback=0) {
  if(typeof value === "number") return Number.isFinite(value) ? value : fallback;
  let text = String(value ?? "").trim();
  if(!text) return fallback;
  text = text.replace(/[″"]/g, "").replace(/\s*-\s*/g, " ").replace(/,/g, "").trim();
  const parts = text.split(/\s+/).filter(Boolean);
  let total = 0;
  let used = false;
  for(const part of parts) {
    if(part.includes("/")) {
      const [n,d] = part.split("/").map(Number);
      if(Number.isFinite(n) && Number.isFinite(d) && d !== 0) { total += n / d; used = true; continue; }
      return fallback;
    }
    const n = Number(part);
    if(Number.isFinite(n)) { total += n; used = true; continue; }
    return fallback;
  }
  return used ? total : fallback;
}

function fuelCalibrationRows(container={}) {
  const rows = Array.isArray(container.calibration) ? container.calibration : [];
  return rows.map(r=>({ inches:parseInches(r.inches, NaN), gallons:parseNumber(r.gallons, NaN) }))
    .filter(r=>Number.isFinite(r.inches) && Number.isFinite(r.gallons))
    .sort((a,b)=>a.inches-b.inches);
}

function calculateFuelGallons(container={}, inchesInput=0) {
  const inches = parseInches(inchesInput, 0);
  const rows = fuelCalibrationRows(container);
  if(rows.length) {
    if(inches <= rows[0].inches) return Math.max(0, rows[0].gallons);
    for(let i=1;i<rows.length;i++) {
      const prev = rows[i-1], next = rows[i];
      if(inches <= next.inches) {
        const span = next.inches - prev.inches;
        if(!span) return next.gallons;
        const ratio = (inches - prev.inches) / span;
        return Math.max(0, prev.gallons + ratio * (next.gallons - prev.gallons));
      }
    }
    return Math.max(0, rows[rows.length-1].gallons);
  }
  const gpi = parseNumber(container.gallonsPerInch, 0);
  const capacity = parseNumber(container.capacity, 0);
  const calc = gpi > 0 ? inches * gpi : (capacity && container.maxHeight ? (inches / parseNumber(container.maxHeight, 1)) * capacity : 0);
  return Math.max(0, capacity ? Math.min(calc, capacity) : calc);
}

function latestFuelReading(state={}, containerId) {
  return (state.fuelReadings || [])
    .filter(r=>r.containerId===containerId && (r.kind||"reading")==="reading")
    .sort((a,b)=>String(b.date||"").localeCompare(String(a.date||"")) || String(b.id||"").localeCompare(String(a.id||"")))[0] || null;
}

function fuelPercent(container={}, gallons=0) {
  const cap = parseNumber(container.capacity, 0);
  return cap > 0 ? Math.max(0, Math.min(100, (parseNumber(gallons,0) / cap) * 100)) : 0;
}

function fuelPeriodStart(period="month") {
  const d = new Date();
  const y = d.getFullYear();
  const m = d.getMonth();
  if(period==="quarter") return new Date(y, Math.floor(m/3)*3, 1).toISOString().split("T")[0];
  if(period==="year") return new Date(y, 0, 1).toISOString().split("T")[0];
  if(period==="fy") {
    const fyYear = m >= 9 ? y : y-1;
    return new Date(fyYear, 9, 1).toISOString().split("T")[0];
  }
  return new Date(y, m, 1).toISOString().split("T")[0];
}

function fuelEventsFor(state={}, containerId, period="month") {
  const start = fuelPeriodStart(period);
  return (state.fuelReadings || [])
    .filter(r=>r.containerId===containerId && String(r.date||"") >= start)
    .sort((a,b)=>String(a.date||"").localeCompare(String(b.date||"")) || String(a.id||"").localeCompare(String(b.id||"")));
}

function fuelReadingHistory(state={}, containerId) {
  return (state.fuelReadings || [])
    .filter(r=>r.containerId===containerId && (r.kind||"reading")==="reading")
    .sort((a,b)=>String(a.date||"").localeCompare(String(b.date||"")) || String(a.id||"").localeCompare(String(b.id||"")));
}

function fuelConsumedForPeriod(state={}, containerId, period="month") {
  const start = fuelPeriodStart(period);
  const all = fuelReadingHistory(state, containerId);
  let prev = all.filter(r=>String(r.date||"") < start).slice(-1)[0] || null;
  let used = 0;
  all.filter(r=>String(r.date||"") >= start).forEach(r=>{
    if(prev) {
      const drop = parseNumber(prev.gallons,0) - parseNumber(r.gallons,0);
      if(drop > 0) used += drop;
    }
    prev = r;
  });
  return Math.max(0, used);
}

function fuelRefilledForPeriod(state={}, containerId, period="month") {
  return fuelEventsFor(state, containerId, period)
    .filter(r=>(r.kind||"reading")==="refill")
    .reduce((sum,r)=>sum+parseNumber(r.gallonsAdded,0),0);
}


const INIT = {
  notifications: [],
  technicians: [],
  categories: ["Mowers","Vehicles","Tractors","Irrigation","Tools","Trailers"],
  usageLogs: [],
  workOrders: [],
  workOrderRequests: [],
  equipment: [],
  preventiveMaintenance: [],
  parts: [],
  pmSchedules: [],
  pmTasks: [],
  inspectionTasks: [],
  inspectionSchedules: [],
  inventoryItems: [],
  fuelContainers: [],
  fuelReadings: [],
  profile: null,
  settings: null,
  woSettings: null,
  setupComplete: false,
  organization: null,
  locations: [],
  activeLocationId: "__all",
  userRole: "owner",
  userInvites: [],
  areas: [],
};

function blankUserState(ownerUserId="") {
  return {
    ...INIT,
    notifications: [],
    technicians: [],
    usageLogs: [],
    workOrders: [],
    workOrderRequests: [],
    equipment: [],
    preventiveMaintenance: [],
    parts: [],
    pmSchedules: [],
    pmTasks: [],
    inspectionTasks: [],
    inspectionSchedules: [],
    inventoryItems: [],
    fuelContainers: [],
    fuelReadings: [],
    profile: null,
    settings: null,
    woSettings: null,
    setupComplete: false,
    organization: { id:`ORG-${ownerUserId || Date.now()}`, name:"" },
    locations: [],
    activeLocationId: "__all",
    userRole: "owner",
    userInvites: [],
    areas: [],
    ownerUserId: ownerUserId || "",
  };
}

function normalizeLoadedUserState(data={}, ownerUserId="") {
  if(!data || typeof data !== "object" || Array.isArray(data)) return blankUserState(ownerUserId);
  if(data.ownerUserId && ownerUserId && data.ownerUserId !== ownerUserId) return blankUserState(ownerUserId);
  return { ...blankUserState(ownerUserId), ...data, ownerUserId: ownerUserId || data.ownerUserId || "" };
}


function normalizeMaintForgeLocations(state={}) {
  const settings = state.settings || {};
  const names = [
    ...(Array.isArray(state.locations) ? state.locations.map(l => typeof l === "string" ? { name:l } : l) : []),
    ...(Array.isArray(settings.locations) ? settings.locations.map(name => ({ name })) : []),
    settings.location ? { name:settings.location } : null,
    settings.siteName ? { name:settings.siteName } : null,
  ].filter(Boolean);
  const seen = new Set();
  const list = [];
  names.forEach((loc, idx) => {
    const name = String(loc.name || loc.location || loc.title || "").trim();
    if(!name) return;
    const key = name.toLowerCase();
    if(seen.has(key)) return;
    seen.add(key);
    list.push({ id:loc.id || `LOC-${idx+1}-${slugifyFacility(name)}`, name, address:loc.address||"", manager:loc.manager||"", active:loc.active !== false });
  });
  return list;
}

function normalizeMaintForgeAreas(state={}, facilityId="") {
  const settings = state.settings || {};
  const rawAreas = [
    ...(Array.isArray(state.areas) ? state.areas : []),
    ...(Array.isArray(settings.areas) ? settings.areas : []),
  ];
  const seen = new Set();
  const list = [];
  rawAreas.forEach((area, idx) => {
    const item = typeof area === "string" ? { name:area } : (area || {});
    const name = String(item.name || item.area || item.title || "").trim();
    if(!name) return;
    const facId = item.facilityId || item.locationId || "";
    if(facilityId && facId && facId !== facilityId) return;
    const key = `${facilityId||facId||"global"}::${name.toLowerCase()}`;
    if(seen.has(key)) return;
    seen.add(key);
    list.push({ id:item.id || `AREA-${idx+1}-${slugifyFacility(name)}`, name, facilityId:facId, active:item.active !== false });
  });
  return list;
}

function activeMaintForgeLocation(state={}) {
  const locations = normalizeMaintForgeLocations(state);
  const id = state.activeLocationId || "__all";
  if(id === "__all") return null;
  return locations.find(l => l.id === id || l.name === id) || null;
}
function locationNameForId(state={}, id="") {
  if(!id || id === "__all") return "All Facilities";
  const loc = normalizeMaintForgeLocations(state).find(l => l.id === id || l.name === id);
  return loc?.name || id;
}
function recordLocationName(record={}, state={}) {
  return String(record.locationName || record.location || record.facility || record.site || locationNameForId(state, record.locationId) || "").trim();
}
function recordMatchesActiveLocation(record={}, state={}) {
  const loc = activeMaintForgeLocation(state);
  if(!loc) return true;
  return record.locationId === loc.id || recordLocationName(record, state).toLowerCase() === loc.name.toLowerCase();
}
function stampLocation(payload={}, state={}) {
  const loc = activeMaintForgeLocation(state);
  if(!loc) return payload;
  return { ...payload, locationId:payload.locationId || loc.id, locationName:payload.locationName || loc.name, location:payload.location || loc.name };
}

function deepClonePlain(value) {
  try { return JSON.parse(JSON.stringify(value || {})); }
  catch(e) { return { ...(value || {}) }; }
}
function scopedStateForActiveLocation(state={}) {
  const loc = activeMaintForgeLocation(state);
  if(!loc) return state;
  const equipmentIds = new Set((state.equipment||[]).filter(e=>recordMatchesActiveLocation(e,state)).map(e=>String(e.id)));
  const eqLinked = (r={}) => !r.equipment && !r.equipmentId ? recordMatchesActiveLocation(r,state) : equipmentIds.has(String(r.equipment || r.equipmentId));
  return {
    ...state,
    equipment:(state.equipment||[]).filter(e=>recordMatchesActiveLocation(e,state)),
    parts:(state.parts||[]).filter(p=>recordMatchesActiveLocation(p,state)),
    technicians:(state.technicians||[]).filter(t=>recordMatchesActiveLocation(t,state)),
    inventoryItems:(state.inventoryItems||[]).filter(i=>eqLinked(i)),
    workOrders:(state.workOrders||[]).filter(w=>eqLinked(w)),
    workOrderRequests:(state.workOrderRequests||[]).filter(r=>recordMatchesActiveLocation(r,state)),
    usageLogs:(state.usageLogs||[]).filter(u=>eqLinked(u)),
    pmTasks:(state.pmTasks||[]).filter(t=>recordMatchesActiveLocation(t,state) || (!t.locationId && !recordLocationName(t,state))),
    inspectionTasks:(state.inspectionTasks||[]).filter(t=>recordMatchesActiveLocation(t,state) || (!t.locationId && !recordLocationName(t,state))),
    preventiveMaintenance:(state.preventiveMaintenance||[]).filter(t=>recordMatchesActiveLocation(t,state) || (!t.locationId && !recordLocationName(t,state))),
    pmSchedules:(state.pmSchedules||[]).filter(s=>eqLinked(s)),
    inspectionSchedules:(state.inspectionSchedules||[]).filter(s=>eqLinked(s)),
    fuelContainers:(state.fuelContainers||[]).filter(c=>recordMatchesActiveLocation(c,state)),
    fuelReadings:(state.fuelReadings||[]).filter(r=>recordMatchesActiveLocation(r,state)),
  };
}

function adjustInventoryForWO(parts=[], partsUsed=[], direction=-1) {
  // direction -1 consumes inventory, +1 restores inventory
  let next = [...(parts||[])];
  (partsUsed||[]).forEach(item => {
    if(!item?.partId) return;
    const qty = +(item.qty||0);
    if(!qty) return;
    next = next.map(p => p.id===item.partId ? { ...p, qty:Math.max(0, +(p.qty||0) + (direction * qty)) } : p);
  });
  return next;
}


function makeNotification(payload={}) {
  const now = new Date().toISOString();
  return {
    ...payload,
    id: payload.id || `N${Date.now()}`,
    createdAt: payload.createdAt || payload.timestamp || now,
    time: payload.time && payload.time !== "Just now" ? payload.time : now,
    read: !!payload.read,
  };
}


function lineItemTotal(item={}) {
  const qty = +(item.qty || 1);
  const unitCost = +(item.unitCost ?? item.cost ?? 0);
  return qty * unitCost;
}

function outsideServicesTotal(outsideServices=[]) {
  return (Array.isArray(outsideServices) ? outsideServices : []).reduce((sum, item) => sum + lineItemTotal(item), 0);
}

function woPartsTotal(wo={}) {
  const partsUsed = Array.isArray(wo.partsUsed) ? wo.partsUsed : [];
  return partsUsed.length ? partsUsed.reduce((sum, item) => sum + lineItemTotal(item), 0) : (+wo.partsCost || 0);
}

function woTotalCost(wo={}) {
  return (+wo.laborCost || 0) + woPartsTotal(wo) + outsideServicesTotal(wo.outsideServices);
}

function moneyFmt(value=0) {
  return `$${Number(value || 0).toLocaleString(undefined, { minimumFractionDigits:2, maximumFractionDigits:2 })}`;
}

function fiscalYearStartDate(now=new Date()) {
  return new Date(now.getMonth() >= 9 ? now.getFullYear() : now.getFullYear() - 1, 9, 1);
}

function dateValue(raw) {
  const d = raw ? new Date(String(raw) + (String(raw).includes('T') ? '' : 'T00:00:00')) : null;
  return d && !Number.isNaN(d.getTime()) ? d : null;
}

function workOrderDate(wo={}) {
  return wo.completed || wo.closedDate || wo.created || wo.date || wo.due || '';
}

function equipmentUsageSummary(state={}, eq={}) {
  const eqId = String(eq.id || "");
  const logs = (state.usageLogs || []).filter(l => String(l.equipmentId || l.equipment || l.eqId || "") === eqId);
  const latestHours = Math.max(0, ...logs.map(l => +(l.hours || l.usageHours || 0)).filter(Number.isFinite));
  const latestMiles = Math.max(0, ...logs.map(l => +(l.mileage || l.miles || l.usageMileage || 0)).filter(Number.isFinite));
  const eqWos = (state.workOrders || []).filter(w => String(workOrderEquipmentId(w) || w.equipment || "") === eqId);
  const woHours = Math.max(0, ...eqWos.map(w => +(w.usageHours || 0)).filter(Number.isFinite));
  const woMiles = Math.max(0, ...eqWos.map(w => +(w.usageMileage || 0)).filter(Number.isFinite));
  const currentHours = Math.max(latestHours, woHours, +(eq.currentHours || eq.hours || 0));
  const currentMiles = Math.max(latestMiles, woMiles, +(eq.currentMileage || eq.mileage || 0));
  const type = eq.usageType || (currentMiles > 0 && currentHours === 0 ? 'mileage' : 'hours');
  return {
    type,
    value: type === 'mileage' ? currentMiles : currentHours,
    label: type === 'mileage' ? 'Miles' : 'Hours',
    hours: currentHours,
    miles: currentMiles,
  };
}

function equipmentFinancialSummary(state={}, eq={}) {
  const fyStart = fiscalYearStartDate();
  const eqId = String(eq.id || "");
  const wos = (state.workOrders || []).filter(w => String(workOrderEquipmentId(w) || w.equipment || "") === eqId);
  const byDate = wos.map(w => ({ wo:w, date:dateValue(workOrderDate(w)) }));
  const fyWos = byDate.filter(x => x.date && x.date >= fyStart).map(x => x.wo);
  const sumCost = rows => rows.reduce((sum,w) => sum + woTotalCost(w), 0);
  const sumLabor = rows => rows.reduce((sum,w) => sum + (+w.laborHours || 0), 0);
  const countType = (rows, name) => rows.filter(w => String(w.woType || w.type || '').toLowerCase().includes(name)).length;
  return {
    wos,
    totalWOs: wos.length,
    openWOs: wos.filter(w => w.status !== 'Completed').length,
    completedWOs: wos.filter(w => w.status === 'Completed').length,
    lifetimeSpent: sumCost(wos),
    fySpent: sumCost(fyWos),
    lifetimeLaborHours: sumLabor(wos),
    fyLaborHours: sumLabor(fyWos),
    repairWOs: countType(wos, 'repair'),
    serviceWOs: wos.filter(w => /service|prevent/i.test(String(w.woType || w.type || ''))).length,
    inspectionWOs: countType(wos, 'inspection'),
  };
}

function formatNotificationTime(notification) {
  const raw = notification?.createdAt || notification?.timestamp || notification?.time;
  const date = raw ? new Date(raw) : null;
  if(!date || Number.isNaN(date.getTime())) return notification?.time || "";
  const diffMs = Date.now() - date.getTime();
  if(diffMs < 0) return date.toLocaleString();
  const sec = Math.floor(diffMs / 1000);
  if(sec < 10) return "Just now";
  if(sec < 60) return `${sec} sec ago`;
  const min = Math.floor(sec / 60);
  if(min < 60) return `${min} min ago`;
  const hr = Math.floor(min / 60);
  if(hr < 24) return `${hr} hr${hr===1?"":"s"} ago`;
  const day = Math.floor(hr / 24);
  if(day < 7) return `${day} day${day===1?"":"s"} ago`;
  return date.toLocaleString(undefined, { month:"short", day:"numeric", year:"numeric", hour:"numeric", minute:"2-digit" });
}

function reducer(state, { type, payload }) {
  const locationStampedTypes = new Set(["ADD_EQ","ADD_PART","ADD_INV","ADD_FUEL_CONTAINER","ADD_FUEL_READING","ADD_WO_REQUEST","ADD_PM_SCHEDULE","ADD_INSPECTION_SCHEDULE","ADD_PM_TASK","ADD_INSPECTION_TASK","ADD_PM","ADD_TECH","ADD_USAGE_LOG"]);
  if(locationStampedTypes.has(type)) payload = stampLocation(payload || {}, state);
  if(type === "ADD_WO") payload = stampLocation(payload || {}, state);
  switch(type) {
    case "REPLACE_STATE":   return { ...state, ...payload };
    case "READ_NOTIF":    return { ...state, notifications: state.notifications.map(n => n.id===payload ? {...n,read:true} : n) };
    case "READ_ALL":      return { ...state, notifications: state.notifications.map(n => ({...n,read:true})) };
    case "ADD_NOTIFICATION": return { ...state, notifications:[makeNotification(payload), ...(state.notifications||[])] };
    case "ADD_WO": {
      const shouldConsume = payload.status === "Completed" && !payload.inventoryConsumed;
      const savedWO = shouldConsume ? { ...payload, inventoryConsumed:true } : payload;
      const equipmentStatus = savedWO.status==="Completed" ? "Fully Operational" : (savedWO.equipmentStatus || null);
      const equipment = equipmentStatus
        ? state.equipment.map(e => e.id===savedWO.equipment ? { ...e, status:equipmentStatus } : e)
        : state.equipment;
      const parts = shouldConsume ? adjustInventoryForWO(state.parts, savedWO.partsUsed, -1) : state.parts;
      return { ...state, parts, equipment, workOrders: [savedWO,...state.workOrders], notifications:[makeNotification({id:`N${Date.now()}`,type:"wo",msg:`Work Order ${savedWO.id} created`,read:false}),...state.notifications] };
    }
    case "UPDATE_WO": {
      const prevWO = (state.workOrders||[]).find(w => w.id === payload.id);
      const wasConsumed = !!prevWO?.inventoryConsumed;
      const willBeCompleted = payload.status === "Completed";
      let parts = state.parts;
      let payloadWithStatus = payload;

      // Inventory is consumed only when the WO closes/completes.
      // If a completed WO is reopened, restore those parts. If closed again, consume again.
      if(prevWO) {
        if(!wasConsumed && willBeCompleted) {
          parts = adjustInventoryForWO(parts, payload.partsUsed, -1);
          payloadWithStatus = { ...payloadWithStatus, inventoryConsumed:true };
        } else if(wasConsumed && !willBeCompleted) {
          parts = adjustInventoryForWO(parts, prevWO.partsUsed, +1);
          payloadWithStatus = { ...payloadWithStatus, inventoryConsumed:false };
        } else if(wasConsumed && willBeCompleted) {
          // If a closed WO is edited while still completed, restore old parts then consume the updated list.
          parts = adjustInventoryForWO(parts, prevWO.partsUsed, +1);
          parts = adjustInventoryForWO(parts, payload.partsUsed, -1);
          payloadWithStatus = { ...payloadWithStatus, inventoryConsumed:true };
        }
      }

      payloadWithStatus = payloadWithStatus.status==="Completed" ? { ...payloadWithStatus, equipmentStatus:"Fully Operational" } : payloadWithStatus;
      const updated = state.workOrders.map(w => w.id===payload.id ? payloadWithStatus : w);
      const equipmentStatus = payloadWithStatus.equipmentStatus || null;
      const equipment = equipmentStatus
        ? state.equipment.map(e => e.id===payloadWithStatus.equipment ? { ...e, status:equipmentStatus } : e)
        : state.equipment;
      /* If WO is being completed and is linked to a PM schedule, advance the schedule */
      if(payload.status==="Completed" && payload.scheduleId) {
        const sch = (state.pmSchedules||[]).find(s=>s.id===payload.scheduleId);
        if(sch) {
          const logs = (state.usageLogs||[]).filter(l=>l.equipmentId===sch.equipmentId);
          const curU  = sch.usageType==="mileage"
            ? Math.max(...logs.map(l=>+(l.mileage||0)), 0)
            : Math.max(...logs.map(l=>+(l.hours||0)), 0);
          const doneDate = payload.completed||new Date().toISOString().split("T")[0];
          const sourceTriggers = Array.isArray(sch.triggers) && sch.triggers.length ? sch.triggers : [{type:sch.triggerType==="usage"?(sch.usageType||"hours"):"time",timeInterval:sch.timeInterval,timeUnit:sch.timeUnit||"months",usageInterval:sch.usageInterval,usageMode:"every"}];
          const advancedTriggers = sourceTriggers.map(t=>{
            if((t.type||"time")==="time") {
              const d=new Date(doneDate);
              const n=+(t.timeInterval||sch.timeInterval||0);
              const unit=t.timeUnit||sch.timeUnit||"months";
              if(n){ if(unit==="days")d.setDate(d.getDate()+n); if(unit==="weeks")d.setDate(d.getDate()+n*7); if(unit==="months")d.setMonth(d.getMonth()+n); if(unit==="years")d.setFullYear(d.getFullYear()+n); }
              return {...t,nextDueDate:n?d.toISOString().split("T")[0]:"",nextDueUsage:""};
            }
            return {...t,nextDueDate:"",nextDueUsage:(t.usageMode==="at" ? +(t.usageInterval||0) : curU+(+(t.usageInterval||sch.usageInterval||0)))};
          });
          const advancedSch = { ...sch, triggers:advancedTriggers, lastDoneDate:doneDate, lastDoneUsage:curU,
            nextDueDate: advancedTriggers.find(t=>(t.type||"time")==="time")?.nextDueDate || "",
            nextDueUsage: advancedTriggers.find(t=>t.type==="hours"||t.type==="mileage")?.nextDueUsage || "",
          };
          return { ...state, parts, equipment, workOrders:updated, pmSchedules:(state.pmSchedules||[]).map(s=>s.id===sch.id?advancedSch:s) };
        }
      }
      /* If Inspection WO is completed, advance the linked inspection schedule. */
      if(payload.status==="Completed" && payload.inspectionScheduleId) {
        const sch = (state.inspectionSchedules||[]).find(s=>s.id===payload.inspectionScheduleId);
        if(sch) {
          const doneDate = payload.completed || new Date().toISOString().split("T")[0];
          const d = new Date(doneDate);
          const n = +(sch.timeInterval || 1);
          const unit = sch.timeUnit || "months";
          if(unit==="days") d.setDate(d.getDate()+n);
          if(unit==="weeks") d.setDate(d.getDate()+n*7);
          if(unit==="months") d.setMonth(d.getMonth()+n);
          if(unit==="years") d.setFullYear(d.getFullYear()+n);
          const advancedSch = { ...sch, lastTriggered:doneDate, lastDoneDate:doneDate, lastInspectionDate:doneDate, nextDueDate:d.toISOString().split("T")[0] };
          return { ...state, parts, equipment, workOrders:updated, inspectionSchedules:(state.inspectionSchedules||[]).map(s=>s.id===sch.id?advancedSch:s) };
        }
      }
      return { ...state, parts, equipment, workOrders: updated };
    }
    case "DELETE_WO":     return { ...state, workOrders: state.workOrders.filter(w => w.id!==payload) };
    case "ADD_WO_REQUEST": return { ...state, workOrderRequests:[payload, ...(state.workOrderRequests||[])], notifications:[makeNotification({id:`N${Date.now()}`,type:"wo",msg:`New work order request submitted for ${payload.equipment || "equipment"}`,read:false}), ...(state.notifications||[])] };
    case "UPDATE_WO_REQUEST": return { ...state, workOrderRequests:(state.workOrderRequests||[]).map(r=>r.id===payload.id?{...r,...payload}:r) };
    case "DELETE_WO_REQUEST": return { ...state, workOrderRequests:(state.workOrderRequests||[]).filter(r=>r.id!==payload) };
    case "ADD_EQ":        return { ...state, equipment: [payload,...state.equipment] };
    case "UPDATE_EQ": {
      const originalId = payload._originalId || payload.id;
      const cleanPayload = { ...payload };
      delete cleanPayload._originalId;
      const newId = cleanPayload.id || originalId;
      return {
        ...state,
        equipment: state.equipment.map(e => e.id===originalId ? cleanPayload : e),
        workOrders: (state.workOrders||[]).map(w => String(w.equipment)===String(originalId) ? { ...w, equipment:newId } : w),
        usageLogs: (state.usageLogs||[]).map(l => String(l.equipmentId)===String(originalId) ? { ...l, equipmentId:newId } : l),
        pmSchedules: (state.pmSchedules||[]).map(s => String(s.equipmentId)===String(originalId) ? { ...s, equipmentId:newId } : s),
        inspectionSchedules: (state.inspectionSchedules||[]).map(s => String(s.equipmentId)===String(originalId) ? { ...s, equipmentId:newId } : s),
        inventoryItems: (state.inventoryItems||[]).map(i => String(i.equipmentId)===String(originalId) ? { ...i, equipmentId:newId } : i),
      };
    }
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
    case "ADD_INSPECTION_TASK":       return { ...state, inspectionTasks: [...(state.inspectionTasks||[]), payload] };
    case "UPDATE_INSPECTION_TASK":    return { ...state, inspectionTasks: (state.inspectionTasks||[]).map(t=>t.id===payload.id?payload:t) };
    case "DELETE_INSPECTION_TASK":    return { ...state, inspectionTasks: (state.inspectionTasks||[]).filter(t=>t.id!==payload) };
    case "ADD_INSPECTION_SCHEDULE":   return { ...state, inspectionSchedules: [...(state.inspectionSchedules||[]), payload] };
    case "UPDATE_INSPECTION_SCHEDULE":return { ...state, inspectionSchedules: (state.inspectionSchedules||[]).map(s=>s.id===payload.id?payload:s) };
    case "DELETE_INSPECTION_SCHEDULE":return { ...state, inspectionSchedules: (state.inspectionSchedules||[]).filter(s=>s.id!==payload) };
    case "ADD_INV":       return { ...state, inventoryItems: [...(state.inventoryItems||[]), payload] };
    case "UPDATE_INV":    return { ...state, inventoryItems: (state.inventoryItems||[]).map(i => i.id===payload.id ? payload : i) };
    case "DELETE_INV":    return { ...state, inventoryItems: (state.inventoryItems||[]).filter(i => i.id!==payload) };
    case "ADD_FUEL_CONTAINER": return { ...state, fuelContainers:[payload, ...(state.fuelContainers||[])] };
    case "UPDATE_FUEL_CONTAINER": return { ...state, fuelContainers:(state.fuelContainers||[]).map(c=>c.id===payload.id?payload:c) };
    case "DELETE_FUEL_CONTAINER": return { ...state, fuelContainers:(state.fuelContainers||[]).filter(c=>c.id!==payload), fuelReadings:(state.fuelReadings||[]).filter(r=>r.containerId!==payload) };
    case "ADD_FUEL_READING": return { ...state, fuelReadings:[payload, ...(state.fuelReadings||[])] };
    case "UPDATE_FUEL_READING": return { ...state, fuelReadings:(state.fuelReadings||[]).map(r=>r.id===payload.id?payload:r) };
    case "DELETE_FUEL_READING": return { ...state, fuelReadings:(state.fuelReadings||[]).filter(r=>r.id!==payload) };
    case "UPDATE_PROFILE":return { ...state, profile: payload };
    case "UPDATE_WO_SETTINGS": return { ...state, woSettings: payload };
    case "ADD_TECH":      return { ...state, technicians: [...(state.technicians||[]), payload] };
    case "UPDATE_TECH":   return { ...state, technicians: (state.technicians||[]).map(t => t.id===payload.id ? payload : t) };
    case "ADD_CATEGORY":  return { ...state, categories: [...new Set([...(state.categories||[]), payload])] };
    case "ADD_USAGE_LOG": return { ...state, usageLogs: [...(state.usageLogs||[]), payload] };
    case "UPDATE_USAGE_LOG": return { ...state, usageLogs: (state.usageLogs||[]).map(u=>u.id===payload.id?{...u,...payload}:u) };
    case "DELETE_USAGE_LOG": return { ...state, usageLogs: (state.usageLogs||[]).filter(u=>u.id!==payload) };
    case "SET_ACTIVE_LOCATION": return { ...state, activeLocationId: payload || "__all" };
    case "ADD_AREA": {
      const name = String(payload?.name || payload || "").trim();
      if(!name) return state;
      const facilityId = payload?.facilityId || state.activeLocationId || "";
      const existing = normalizeMaintForgeAreas(state, facilityId);
      if(existing.some(a=>a.name.toLowerCase()===name.toLowerCase())) return state;
      const area = { id: payload?.id || `AREA-${Date.now()}`, name, facilityId, active:true };
      const nextAreas = [...(state.areas||[]), area];
      return { ...state, areas:nextAreas, settings:{ ...(state.settings||{}), areas:nextAreas } };
    }
    case "ADD_LOCATION": {
      const name = String(payload?.name || payload || "").trim();
      if(!name) return state;
      const existing = normalizeMaintForgeLocations(state);
      if(existing.some(l=>l.name.toLowerCase()===name.toLowerCase())) return state;
      const loc = { id: payload?.id || `FAC-${Date.now()}`, name, address:payload?.address||"", manager:payload?.manager||"", active:true };
      const nextLocations = [...existing, loc];
      return { ...state, locations:nextLocations, settings:{ ...(state.settings||{}), locations:nextLocations.map(l=>l.name) } };
    }
    case "ADD_USER_INVITE": {
      const invite = { id:`INV-${Date.now()}`, status:"Pending", created:today(), ...payload };
      return { ...state, userInvites:[invite, ...(state.userInvites||[])] };
    }
    case "MIGRATE_TEMPLATES": {
      const fromId = payload?.fromId; const toId = payload?.toId;
      if(!fromId || !toId || fromId===toId) return state;
      const toName = locationNameForId(state, toId);
      const fromName = locationNameForId(state, fromId);
      const migrationStamp = Date.now();
      const copyList = (list=[]) => list
        .filter(item => item.locationId===fromId || recordLocationName(item,state).toLowerCase()===fromName.toLowerCase() || (!item.locationId && !recordLocationName(item,state)))
        .map(item => {
          const copy = deepClonePlain(item);
          return {
            ...copy,
            id:`${item.id || genId("TPL")}-COPY-${migrationStamp}-${Math.random().toString(36).slice(2,6)}`,
            locationId:toId,
            locationName:toName,
            location:toName,
            copiedFrom:item.id||"",
            copiedFromLocationId:fromId,
            copiedFromLocationName:fromName,
            copiedDate:today(),
            independentCopy:true,
            assignedEquipmentIds:[],
            equipmentId:"",
            equipmentIds:[],
          };
        });
      return {
        ...state,
        pmTasks: payload.pmTasks ? [...(state.pmTasks||[]), ...copyList(state.pmTasks)] : state.pmTasks,
        inspectionTasks: payload.inspectionTasks ? [...(state.inspectionTasks||[]), ...copyList(state.inspectionTasks)] : state.inspectionTasks,
        preventiveMaintenance: payload.tasks ? [...(state.preventiveMaintenance||[]), ...copyList(state.preventiveMaintenance)] : state.preventiveMaintenance,
      };
    }
    case "UPDATE_SETTINGS": return { ...state, settings: payload, locations: normalizeMaintForgeLocations({ ...state, settings:payload }) };
    case "COMPLETE_SETUP": {
      const base = { ...state, settings: payload.settings, profile: payload.profile, technicians: payload.technicians, categories: payload.categories, setupComplete: true, organization:{ ...(state.organization||{}), name:payload.settings?.companyName||"" } };
      const locs = normalizeMaintForgeLocations(base);
      return { ...base, locations:locs, activeLocationId:locs[0]?.id || "__all" };
    }
    case "RESET_SETUP":     return { ...state, setupComplete: false };
    default: return state;
  }
}

const genId = p => `${p}-${String(Date.now()).slice(-5)}`;
const today = () => new Date().toISOString().split("T")[0];

function normalizeStepLines(value) {
  if(Array.isArray(value)) {
    return value
      .map(item => typeof item === "string" ? item : (item?.step || item?.text || item?.name || ""))
      .map(x => String(x || "").trim())
      .filter(Boolean);
  }
  return String(value || "")
    .split(/\r?\n|\s*,\s*(?=\S)/)
    .map(x => x.trim())
    .filter(Boolean);
}

function buildNumberedStepsText(value) {
  return normalizeStepLines(value).map((step, i) => `${i + 1}. ${step}`).join("\n");
}

function genNextWOId(workOrders, equipmentId, prefix="") {
  const base = String(equipmentId || "EQ").trim() || "EQ";
  const escapedBase = base.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const tag = prefix ? `${prefix}` : "";
  const re = new RegExp(`^${escapedBase}-${tag}(\\d+)$`, "i");
  const used = (workOrders || []).map(w => {
    const m = String(w.id || "").match(re);
    return m ? parseInt(m[1], 10) : 0;
  }).filter(n => Number.isFinite(n) && n > 0);
  const next = used.length ? Math.max(...used) + 1 : 1;
  return `${base}-${tag}${String(next).padStart(2, "0")}`;
}


const CLOSED_WO_STATUSES = new Set(["Completed", "Closed", "Cancelled", "Canceled"]);
const isOpenWOStatus = (status) => !CLOSED_WO_STATUSES.has(String(status || "Open"));
const firstText = (...vals) => vals.map(v => String(v ?? "").trim()).find(Boolean) || "";
const workOrderDescription = (w={}) => firstText(
  w.faultDescription,
  w.repairComplaint,
  w.description,
  w.problem,
  w.issue,
  w.complaint,
  w.findings,
  w.inspectionFindings,
  w.correctiveAction,
  w.serviceChecklist,
  w.title,
  w.notes,
  w.mechanicNotes
);
const workOrderFaultDate = (w={}) => firstText(w.faultDate, w.date, w.created, w.opened, w.reportedDate, w.due);
const workOrderNumber = (w={}) => firstText(w.id, w.woNumber, w.number, "WO");
const workOrderEquipmentId = (w={}) => firstText(w.equipment, w.equipmentId, w.eqId, w.assetId);
const openWorkOrdersForEquipment = (state={}, eqId="") => (state.workOrders || [])
  .filter(w => workOrderEquipmentId(w) === String(eqId) && isOpenWOStatus(w.status))
  .sort((a,b)=>String(workOrderFaultDate(b)).localeCompare(String(workOrderFaultDate(a))));
const equipmentFaultInfo = (state={}, eq={}) => {
  const wos = openWorkOrdersForEquipment(state, eq.id);
  const primary = wos.find(w => workOrderDescription(w) || workOrderFaultDate(w)) || {};
  const faultDate = firstText(eq.faultDate, eq.deadlineDate, eq.deficiencyDate, eq.statusDate, workOrderFaultDate(primary));
  const description = firstText(eq.faultDescription, eq.deficiencyDescription, eq.statusDescription, eq.fault, eq.issue, eq.problem, eq.description, workOrderDescription(primary));
  return {
    faultDate,
    description,
    openWOs: wos.map(w => `${workOrderNumber(w)} (${w.status || "Open"})`).join(", "),
    openWOCount: wos.length,
    primaryWO: primary
  };
};
const equipmentLabel = (state={}, id="") => {
  const eq = (state.equipment || []).find(e => String(e.id) === String(id));
  return eq ? `${eq.name || eq.nomenclature || "Equipment"} (${eq.id})` : (id || "—");
};
const equipmentNumber = (item={}, fallback="") => firstText(item.id, item.equipment, item.equipmentId, item.eqId, fallback, "—");
const equipmentNameById = (state={}, id="") => {
  const eq = (state.equipment || []).find(e => String(e.id) === String(id));
  return eq ? (eq.name || eq.nomenclature || "") : "";
};
const equipmentReportLabel = (state={}, id="") => {
  const num = firstText(id, "—");
  const name = equipmentNameById(state, num);
  return name ? `${num} - ${name}` : num;
};
const htmlEscape = v => String(v ?? "").replace(/[&<>\"]/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[ch]));


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

function printCustomizePanelHtml(layoutType="Report") {
  const safeLayoutType = String(layoutType || "Report").replace(/[^a-z0-9_-]/gi, "_");
  return `<details class="print-customize" open style="margin:14px auto;max-width:900px;border:1px solid #cbd5e1;border-radius:10px;padding:10px 12px;background:#f8fafc;font-family:Arial,sans-serif">
    <summary style="cursor:pointer;font-weight:800;color:#111827">Choose What To Print</summary>
    <div style="font-size:12px;color:#475569;margin:6px 0 10px">Turn any section or table column on/off before printing or saving as PDF. This layout is saved for ${safeLayoutType} work orders.</div>
    <div style="font-size:11px;font-weight:800;color:#334155;text-transform:uppercase;letter-spacing:.4px;margin:8px 0 5px">Work Order Components</div>
    <div id="printComponentToggles" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:6px;margin-bottom:10px"></div>
    <div style="font-size:11px;font-weight:800;color:#334155;text-transform:uppercase;letter-spacing:.4px;margin:8px 0 5px">Sections</div>
    <div id="printSectionToggles" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:6px;margin-bottom:10px"></div>
    <div style="font-size:11px;font-weight:800;color:#334155;text-transform:uppercase;letter-spacing:.4px;margin:8px 0 5px">Table Columns</div>
    <div id="printColumnToggles" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:6px"></div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px"><button onclick="window.print()" style="padding:8px 18px;background:#1a1a2e;color:#fff;border:none;border-radius:6px;font-weight:700;cursor:pointer">Print Selected Layout</button><button onclick="localStorage.removeItem(\'ncaPrintLayout_${safeLayoutType}\');location.reload()" style="padding:8px 14px;background:#fff;color:#1a1a2e;border:1px solid #1a1a2e;border-radius:6px;font-weight:700;cursor:pointer">Reset Saved Layout</button></div>
  </details>
  <style>@media print{.print-customize,.pbtn{display:none!important}}</style>
  <script>
  (function(){
    var layoutKey = 'ncaPrintLayout_${safeLayoutType}';
    var savedLayout = {};
    try { savedLayout = JSON.parse(localStorage.getItem(layoutKey) || '{}') || {}; } catch(e) { savedLayout = {}; }
    function saveLayout(){ try { localStorage.setItem(layoutKey, JSON.stringify(savedLayout)); } catch(e) {} }
    function clean(txt){ return (txt||'').replace(/\s+/g,' ').trim(); }
    function addToggle(container, label, checked, onChange, key){
      if(!container || !label) return;
      key = key || label;
      var initial = Object.prototype.hasOwnProperty.call(savedLayout, key) ? savedLayout[key] !== false : checked !== false;
      var wrap=document.createElement('label');
      wrap.style.cssText='display:flex;align-items:center;gap:7px;font-size:12px;background:#fff;border:1px solid #e2e8f0;border-radius:8px;padding:7px 9px;cursor:pointer';
      var cb=document.createElement('input'); cb.type='checkbox'; cb.checked=initial;
      cb.onchange=function(){ savedLayout[key]=cb.checked; saveLayout(); onChange(cb.checked); };
      var span=document.createElement('span'); span.textContent=label; span.style.fontWeight='700';
      wrap.appendChild(cb); wrap.appendChild(span); container.appendChild(wrap);
      onChange(initial);
    }
    function sectionLabel(el, i){
      if(el.classList.contains('hdr') || el.classList.contains('top')) return 'Header';
      if(el.classList.contains('sigs') || el.classList.contains('signatureGrid')) return 'Signature Block';
      if(el.classList.contains('ftr') || el.classList.contains('footerBar')) return 'Footer Bar';
      if(el.classList.contains('row') || el.classList.contains('dateGrid')) return 'Dates / Status Row';
      if(el.classList.contains('infoGrid')) return 'Equipment and Work Order Details';
      var h=el.querySelector('.sh,.section-title,.summaryTitle,h1,h2,h3');
      return clean(h && h.textContent) || ('Section '+(i+1));
    }
    function setup(){
      var compBox=document.getElementById('printComponentToggles');
      var secBox=document.getElementById('printSectionToggles');
      var colBox=document.getElementById('printColumnToggles');

      function addGroupedComponent(label, nodes, defaultShow){
        nodes = Array.from(nodes || []).filter(function(el){ return el && !el.closest('.print-customize,.pbtn'); });
        if(!nodes.length) return;
        addToggle(compBox, label, defaultShow !== false, function(show){
          nodes.forEach(function(el){ el.style.display = show ? '' : 'none'; });
        }, 'component:'+label);
      }

      var componentGroups = {};
      Array.from(document.querySelectorAll('[data-print-item]')).forEach(function(el){
        var label = clean(el.getAttribute('data-print-item'));
        if(!label) return;
        (componentGroups[label] = componentGroups[label] || []).push(el);
      });
      Object.keys(componentGroups).sort().forEach(function(label){ addGroupedComponent(label, componentGroups[label], true); });

      var fieldGroups = {};
      Array.from(document.querySelectorAll('.cell')).forEach(function(cell){
        if(cell.closest('.print-customize,.pbtn')) return;
        var labelNode = cell.querySelector('.fieldLabel');
        var label = clean(labelNode && labelNode.textContent);
        if(!label) return;
        (fieldGroups['Field: '+label] = fieldGroups['Field: '+label] || []).push(cell);
      });
      Object.keys(fieldGroups).sort().forEach(function(label){ addGroupedComponent(label, fieldGroups[label], true); });

      addGroupedComponent('Parts Subtotal Row', document.querySelectorAll('.subRow'), true);
      addGroupedComponent('Grand Total Bar', document.querySelectorAll('.grandTotal'), true);
      addGroupedComponent('Signature Lines', document.querySelectorAll('.signatureGrid,.sigs'), true);
      addGroupedComponent('WO Status Bar', document.querySelectorAll('.status'), true);
      addGroupedComponent('WO Type Badge', document.querySelectorAll('.typePill'), true);
      addGroupedComponent('Logo Box', document.querySelectorAll('.logoBox'), true);

      var sections=Array.from(document.querySelectorAll('.page .hdr,.page .top,.page .row,.page .dateGrid,.page .infoGrid,.page .sec,.page .section,.page .sigs,.page .signatureGrid,.page .ftr,.page .footerBar, body > h1, body > h2')).filter(function(el){ return !el.closest('.print-customize,.pbtn'); });
      var seen={};
      sections.forEach(function(el,i){
        var label=sectionLabel(el,i);
        var key=label+'-'+i;
        if(seen[key]) return; seen[key]=true;
        addToggle(secBox,label,true,function(show){ el.style.display=show?'':'none'; }, 'section:'+label+':'+i);
      });
      var tables=Array.from(document.querySelectorAll('table')).filter(function(t){ return !t.closest('.print-customize'); });
      tables.forEach(function(table,tIndex){
        var headers=Array.from(table.querySelectorAll('thead th'));
        if(!headers.length){ headers=Array.from(table.querySelectorAll('tr:first-child th, tr:first-child td')); }
        var tableName='Table '+(tIndex+1);
        var prev=table.previousElementSibling;
        if(prev && clean(prev.textContent)) tableName=clean(prev.textContent);
        else {
          var section=table.closest('.section,.sec');
          var title=section && section.querySelector('.summaryTitle,.section-title,.sh,h2,h3');
          if(title && clean(title.textContent)) tableName=clean(title.textContent);
        }
        headers.forEach(function(th,idx){
          var label=clean(th.textContent) || ('Column '+(idx+1));
          addToggle(colBox,tableName+': '+label,true,function(show){
            Array.from(table.rows).forEach(function(row){ if(row.cells[idx]) row.cells[idx].style.display=show?'':'none'; });
          }, 'table:'+tableName+':column:'+idx+':'+label);
        });
      });
      if(compBox && !compBox.children.length) compBox.innerHTML='<div style="font-size:12px;color:#64748b">No separate components detected.</div>';
      if(secBox && !secBox.children.length) secBox.innerHTML='<div style="font-size:12px;color:#64748b">No separate sections detected.</div>';
      if(colBox && !colBox.children.length) colBox.innerHTML='<div style="font-size:12px;color:#64748b">No table columns detected.</div>';
    }
    if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', setup); else setup();
  })();
  <\/script>`;
}

const reportButtonsHtml = (rows=[], title="report") => {
  const dataUri = rowsToDataUri(rows);
  const safeTitle = String(title || "report").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"") || "report";
  const wordHtml = `<!doctype html><html><head><meta charset="utf-8"><title>${safeTitle}</title></head><body>${document?.body?.innerHTML || ""}</body></html>`;
  const wordUri = `data:application/msword;charset=utf-8,${encodeURIComponent(wordHtml)}`;
  return `<br><div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px">
    <button onclick="window.print()" style="padding:8px 20px;background:#1a1a2e;color:#fff;border:none;border-radius:6px;cursor:pointer">Print / Save PDF</button>
    ${dataUri ? `<a href="${dataUri}" download="${safeTitle}.csv" style="padding:8px 20px;background:#fff;color:#1a1a2e;border:1px solid #1a1a2e;border-radius:6px;text-decoration:none;font-family:Arial,sans-serif;font-size:13px">Download Excel CSV</a>` : ""}
    <a href="${wordUri}" download="${safeTitle}.doc" style="padding:8px 20px;background:#fff;color:#1a1a2e;border:1px solid #1a1a2e;border-radius:6px;text-decoration:none;font-family:Arial,sans-serif;font-size:13px">Download Word</a>
  </div>${printCustomizePanelHtml()}`;
};


const getInputHistory = (fieldKey) => {
  try { return JSON.parse(localStorage.getItem(`winMaintInputHistory:${fieldKey}`) || "[]"); }
  catch { return []; }
};
const saveInputHistory = (fieldKey, value) => {
  const v = String(value || "").trim();
  if(!v) return;
  try {
    const existing = getInputHistory(fieldKey).filter(x => x.toLowerCase() !== v.toLowerCase());
    localStorage.setItem(`winMaintInputHistory:${fieldKey}`, JSON.stringify([v, ...existing].slice(0, 30)));
  } catch {}
};
function SmartInput({ historyKey, value, onChange, onBlur, listId, extraOptions=[], ...props }) {
  const key = historyKey || props.name || props.placeholder || "general";
  const dlId = listId || `history-${key.replace(/[^a-z0-9_-]/gi, "-")}`;
  const [history, setHistory] = useState(()=>getInputHistory(key));
  const remember = (val) => {
    saveInputHistory(key, val);
    setHistory(getInputHistory(key));
  };
  return (
    <>
      <input
        {...props}
        list={dlId}
        value={value || ""}
        onChange={onChange}
        onBlur={(e)=>{ remember(e.target.value); onBlur?.(e); }}
        onKeyDown={(e)=>{ if(e.key === "Enter") remember(e.currentTarget.value); props.onKeyDown?.(e); }}
      />
      <datalist id={dlId}>{[...new Set([...(extraOptions||[]), ...history])].map(v=><option key={v} value={v} />)}</datalist>
    </>
  );
}

/* -- STATUS STYLES -- */
const statusStyle = {
  "Open":                          { color:T.accent, bg:"#eff6ff",  border:"#bfdbfe" },
  "In Progress":                   { color:T.amber, bg:"#fffbeb",  border:"#fcd34d" },
  "Completed":                     { color:T.green, bg:"#ecfdf5",  border:"#6ee7b7" },
  "Awaiting Parts":                { color:"#6b21a8", bg:"#faf5ff",  border:"#e9d5ff" },
  "On Hold":                       { color:"#7f1d1d", bg:"#fef2f2",  border:"#fca5a5" },
  "Pending Diagnostic":            { color:"#0f766e", bg:"#f0fdfa",  border:"#99f6e4" },
  "Fully Operational":             { color:T.green, bg:"#ecfdf5",  border:"#6ee7b7" },
  "Operational with Deficiencies": { color:T.amber, bg:"#fffbeb",  border:"#fcd34d" },
  "Out of Service / Deadline":     { color:"#7f1d1d", bg:"#fef2f2",  border:"#fca5a5" },
  "No Status":                     { color:T.subtext, bg:"#f3f4f6",  border:"#d1d5db" },
  "Active":                        { color:T.green, bg:"#ecfdf5",  border:"#6ee7b7" },
  "Inactive":                      { color:T.subtext, bg:"#f3f4f6",  border:"#d1d5db" },
  "Out of Service":                { color:"#7f1d1d", bg:"#fef2f2",  border:"#fca5a5" },
  "OK":                            { color:T.green, bg:"#ecfdf5",  border:"#6ee7b7" },
  "Due Soon":                      { color:T.amber, bg:"#fffbeb",  border:"#fcd34d" },
  "Overdue":                       { color:"#7f1d1d", bg:"#fef2f2",  border:"#fca5a5" },
};
const priorityStyle = {
  "High":   { color:"#7f1d1d", bg:"#fef2f2", border:"#fca5a5" },
  "Medium": { color:"#78350f", bg:"#fff7ed", border:"#fdba74" },
  "Low":    { color:T.subtext, bg:"#f3f4f6", border:"#d1d5db" },
};
const notifColor = { wo:"#1e40af", pm:"#92400e", insp:"#065f46", stock:"#7f1d1d" };
const notifIcon  = { wo:"📋", pm:"🔧", insp:"🔍", stock:"📦" };

/* -- SHARED UI -- */
const Badge = ({ label, type="status" }) => {
  const raw = type==="priority" ? priorityStyle[label] : statusStyle[label];
  const isDark = T.bg === DARK_THEME.bg;
  const s = raw ? themedStatusStyle(raw) : null;
  if(!s) return <span style={{ fontFamily:T.mono, fontSize:11, color:T.muted }}>{label}</span>;
  return (
    <span style={{ background:isDark ? s.bg : "transparent", color:s.color, border:`1.5px solid ${isDark ? s.border : s.color}`, borderRadius:4, padding:"2px 8px", fontSize:11, fontWeight:700, fontFamily:T.mono, whiteSpace:"nowrap" }}>
      {label}
    </span>
  );
};

const Card = ({ children, style={} }) => (
  <div style={{ background:T.card, color:T.text, border:`1px solid ${T.border}`, borderRadius:8, padding:"20px 22px", boxShadow:T.shadow, ...style }}>
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

const inp = { width:"100%", background:T.card, border:`1px solid ${T.border}`, borderRadius:6, padding:"8px 11px", color:T.text, fontSize:13, fontFamily:T.sans, boxSizing:"border-box", outline:"none", transition:"border-color .15s" };
const sel = { ...inp };

const Btn = ({ children, onClick, variant="primary", small, style={}, type="button" }) => {
  const styles = {
    primary: { background:T.accent, color:"#fff", border:"none" },
    secondary: { background:T.card, color:T.text, border:`1px solid ${T.border}` },
    danger: { background:T.card, color:T.red, border:`1px solid #fca5a5` },
    ghost: { background:"transparent", color:T.subtext, border:"none" },
  };
  return (
    <button type={type} onClick={onClick} style={{ ...styles[variant], padding:small?"5px 12px":"8px 16px", borderRadius:6, cursor:"pointer", fontSize:small?12:13, fontWeight:600, fontFamily:T.sans, display:"inline-flex", alignItems:"center", gap:5, ...style }}>
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
      <div style={{ background:T.card, borderRadius:10, border:`1px solid ${T.border}`, width:"100%", maxWidth:560, maxHeight:"92vh", overflowY:"auto", boxShadow:"0 20px 60px rgba(0,0,0,.15)" }}>
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
  const [nowTick, setNowTick] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNowTick(Date.now()), 30000);
    return () => clearInterval(id);
  }, []);
  void nowTick;
  return (
    <div style={{ position:"fixed", top:56, right:16, width:360, background:T.card, border:`1px solid ${T.border}`, borderRadius:10, zIndex:1500, boxShadow:T.shadowMd, overflow:"hidden" }}>
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
              <p style={{ margin:"3px 0 0", fontFamily:T.mono, fontSize:11, color:T.muted }}>{formatNotificationTime(n)}</p>
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
      <header style={{ position:"sticky", top:0, zIndex:1000, background:T.card, borderBottom:`1px solid ${T.border}`, padding:"0 20px", height:56, display:"flex", alignItems:"center", justifyContent:"space-between", boxShadow:"0 1px 0 #e1e4e8" }}>
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
  { id:"wo_requests", icon:"📲", label:"Work Order Requests" },
  { id:"inspections", icon:"🔍", label:"Inspections" },
  { id:"equipment",  icon:"🚜", label:"Equipment" },
  { id:"inventory",  icon:"📋", label:"Equipment Inventory" },
  { id:"parts",      icon:"📦", label:"Parts Inventory" },
  { id:"pm",         icon:"🔧", label:"Preventive Maint." },
  { id:"usage",      icon:"📊", label:"Usage Tracking" },
  { id:"fuel",       icon:"⛽", label:"Fuel Tracking" },
  { id:"spending",   icon:"💰", label:"Spending & Costs" },
];

const NAV_REPORTS = [
  { id:"reports_deadline",    icon:"🚨", label:"Deadline Equipment" },
  { id:"reports_parts_inv",   icon:"📦", label:"Parts Inventory Report" },
  { id:"reports_pm",          icon:"🔧", label:"PM Report" },
  { id:"reports_usage",       icon:"📊", label:"Usage Report" },
  { id:"reports_fuel",        icon:"⛽", label:"Fuel Report" },
  { id:"reports_spending",    icon:"💰", label:"Spending Reports" },
  { id:"reports_combined",    icon:"📑", label:"Combined Report" },
];

function SlideMenu({ tab, setTab, open, onClose, onSettings, companyName, profile }) {
  const defaultMenuGroups = [
    { key:"main", title:"Main Menu", items:NAV },
    { key:"reports", title:"Reports", items:NAV_REPORTS },
  ];
  const defaultOrder = defaultMenuGroups.flatMap(g=>g.items.map(n=>`${g.key}:${n.id}`));
  const [editMenu, setEditMenu] = useState(false);
  const [dragKey, setDragKey] = useState(null);
  const [menuOrder, setMenuOrder] = useState(()=>{
    try {
      const saved = JSON.parse(localStorage.getItem("winmaint_menu_order") || "null");
      if (Array.isArray(saved) && saved.length) return saved;
    } catch {}
    return defaultOrder;
  });

  useEffect(()=>{
    const valid = new Set(defaultOrder);
    setMenuOrder(prev=>{
      const kept = (Array.isArray(prev)?prev:[]).filter(k=>valid.has(k));
      const missing = defaultOrder.filter(k=>!kept.includes(k));
      const next = [...kept, ...missing];
      try { localStorage.setItem("winmaint_menu_order", JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

  const itemByKey = Object.fromEntries(defaultMenuGroups.flatMap(g=>g.items.map(item=>[`${g.key}:${item.id}`, { ...item, group:g.key, groupTitle:g.title }])));
  const orderedItems = menuOrder.map(k=>itemByKey[k]).filter(Boolean);

  const saveOrder = (next) => {
    setMenuOrder(next);
    try { localStorage.setItem("winmaint_menu_order", JSON.stringify(next)); } catch {}
  };
  const moveMenuItem = (key, direction) => {
    const idx = menuOrder.indexOf(key);
    const nextIdx = idx + direction;
    if (idx < 0 || nextIdx < 0 || nextIdx >= menuOrder.length) return;
    const next = [...menuOrder];
    [next[idx], next[nextIdx]] = [next[nextIdx], next[idx]];
    saveOrder(next);
  };
  const resetMenuOrder = () => saveOrder(defaultOrder);
  const handleDrop = (targetKey) => {
    if (!dragKey || dragKey === targetKey) return;
    const next = [...menuOrder];
    const from = next.indexOf(dragKey);
    const to = next.indexOf(targetKey);
    if (from < 0 || to < 0) return;
    next.splice(from, 1);
    next.splice(to, 0, dragKey);
    saveOrder(next);
    setDragKey(null);
  };

  const renderMenuButton = (n, idx) => {
    const active = tab===n.id;
    const key = `${n.group}:${n.id}`;
    return (
      <div key={key}
        draggable={editMenu}
        onDragStart={()=>editMenu && setDragKey(key)}
        onDragOver={(e)=>{ if(editMenu) e.preventDefault(); }}
        onDrop={()=>editMenu && handleDrop(key)}
        style={{ margin:"1px 8px", borderRadius:8, outline:editMenu && dragKey===key?`2px dashed ${T.accent}`:"none" }}>
        <button
          onClick={()=> editMenu ? null : (setTab(n.id), onClose())}
          style={{ display:"flex", alignItems:"center", gap:11, padding:"10px 12px", borderRadius:7, background:active?T.accentLt:(editMenu?"#f8fafc":"transparent"), border:editMenu?`1px dashed ${T.borderHi}`:"none", color:active?T.accent:T.subtext, cursor:editMenu?"grab":"pointer", fontFamily:T.sans, fontSize:14, fontWeight:active?600:400, textAlign:"left", width:"100%", transition:"background .12s" }}>
          {editMenu && <span style={{ fontSize:15, color:T.muted, cursor:"grab" }}>☰</span>}
          <span style={{ fontSize:16 }}>{n.icon}</span>
          <span style={{ flex:1 }}>{n.label}</span>
          {editMenu && (
            <span style={{ display:"flex", gap:4 }} onClick={(e)=>e.stopPropagation()}>
              <span title="Move up" onClick={()=>moveMenuItem(key, -1)} style={{ border:`1px solid ${T.border}`, borderRadius:6, padding:"1px 6px", background:T.card, cursor:"pointer" }}>↑</span>
              <span title="Move down" onClick={()=>moveMenuItem(key, 1)} style={{ border:`1px solid ${T.border}`, borderRadius:6, padding:"1px 6px", background:T.card, cursor:"pointer" }}>↓</span>
            </span>
          )}
        </button>
      </div>
    );
  };

  let lastGroup = null;
  return (
    <>
      {/* Backdrop */}
      {open && (
        <div onClick={onClose} style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.35)", zIndex:1100, transition:"opacity .2s" }} />
      )}
      {/* Drawer */}
      <div style={{
        position:"fixed", top:0, left:0, bottom:0, width:editMenu?300:260,
        background:T.card, boxShadow:"4px 0 24px rgba(0,0,0,.12)",
        zIndex:1200, display:"flex", flexDirection:"column",
        transform: open?"translateX(0)":"translateX(-100%)",
        transition:"transform .25s cubic-bezier(.4,0,.2,1), width .18s",
      }}>
        {/* Drawer header — click to open Settings */}
        <div style={{ padding:"18px 20px 14px", borderBottom:`1px solid ${T.border}`, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <button onClick={()=>{ if(!editMenu){ onSettings(); onClose(); } }} style={{ display:"flex", alignItems:"center", gap:10, background:"none", border:"none", cursor:editMenu?"default":"pointer", padding:0, textAlign:"left", flex:1 }}
            title={editMenu?"Finish menu editing first":"Click to open System Settings"}>
            <div style={{ width:34, height:34, background:T.accent, borderRadius:8, display:"flex", alignItems:"center", justifyContent:"center", fontSize:16, flexShrink:0 }}>⚙</div>
            <div>
              <div style={{ fontFamily:T.sans, fontSize:13, fontWeight:700, color:T.text, lineHeight:1.2 }}>{companyName||"NCA Maintenance"}</div>
              <div style={{ fontFamily:T.sans, fontSize:10, color:T.accent }}>{editMenu?"Menu reorder mode":"Tap to open Settings"}</div>
            </div>
          </button>
          <button onClick={onClose} style={{ background:"none", border:"none", fontSize:22, color:T.muted, cursor:"pointer", lineHeight:1, padding:0 }}>×</button>
        </div>

        {/* Nav items */}
        <div style={{ flex:1, overflowY:"auto", padding:"10px 0" }}>
          {editMenu && (
            <div style={{ margin:"0 12px 10px", padding:"10px", border:`1px solid ${T.border}`, borderRadius:9, background:T.grayLt, fontFamily:T.sans, fontSize:12, color:T.subtext, lineHeight:1.35 }}>
              Drag a section up or down, or use the arrow buttons. Your menu order saves automatically.
            </div>
          )}
          {orderedItems.map((n, idx)=>{
            const showTitle = n.group !== lastGroup;
            lastGroup = n.group;
            return (
              <React.Fragment key={`${n.group}:${n.id}:wrap`}>
                {showTitle && n.group === "reports" && (
                  <div style={{ margin:"14px 20px 6px", paddingTop:10, borderTop:`1px solid ${T.border}`, fontFamily:T.sans, fontSize:11, fontWeight:900, color:T.muted, textTransform:"uppercase", letterSpacing:.8 }}>
                    Reports
                  </div>
                )}
                {renderMenuButton(n, idx)}
              </React.Fragment>
            );
          })}
        </div>

        {/* Footer — user info / menu editor */}
        <div style={{ padding:"12px 20px", borderTop:`1px solid ${T.border}` }}>
          <button onClick={()=>setEditMenu(v=>!v)} style={{ width:"100%", marginBottom:10, display:"flex", alignItems:"center", justifyContent:"center", gap:8, border:`1px solid ${editMenu?T.accent:T.border}`, background:editMenu?T.accentLt:"#fff", color:editMenu?T.accent:T.subtext, borderRadius:8, padding:"8px 10px", fontFamily:T.sans, fontSize:13, fontWeight:700, cursor:"pointer" }}>
            ✏️ {editMenu?"Done organizing menu":"Organize menu"}
          </button>
          {editMenu && <button onClick={resetMenuOrder} style={{ width:"100%", marginBottom:10, border:`1px solid ${T.border}`, background:T.card, color:T.muted, borderRadius:8, padding:"7px 10px", fontFamily:T.sans, fontSize:12, fontWeight:600, cursor:"pointer" }}>Reset default order</button>}
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

function Dashboard({ state, dispatch, setTab, onSettings }) {
  const { workOrders:wos=[], equipment:eqs=[], preventiveMaintenance:pms=[], parts=[] } = state;
  const settings = state.settings || {};
  const today_s = today();
  const monthKey = today_s.slice(0,7);
  const openWOs = wos.filter(w=>w.status==="Open").length;
  const inProgWOs = wos.filter(w=>w.status==="In Progress").length;
  const awaitParts = wos.filter(w=>w.status==="Awaiting Parts").length;
  const onHoldWOs = wos.filter(w=>w.status==="On Hold").length;
  const activeWOs = wos.filter(w=>w.status!=="Completed").length;
  const highPriority = wos.filter(w=>w.status!=="Completed" && w.priority==="High").length;
  const completedMo = wos.filter(w=>w.status==="Completed" && (w.completed||"").slice(0,7)===monthKey).length;
  const outOfSvc = eqs.filter(e=>e.status==="Out of Service / Deadline").length;
  const withDefic = eqs.filter(e=>e.status==="Operational with Deficiencies").length;
  const readyAssets = Math.max(0, eqs.length - outOfSvc - withDefic);
  const readiness = eqs.length ? Math.round((readyAssets / eqs.length) * 100) : 100;
  const pmOverdue = pms.filter(p=>p.status==="Overdue").length;
  const pmDueSoon = pms.filter(p=>p.status==="Due Soon").length;
  const lowStock = parts.filter(p=>p.lowStockAlert!==false && (+p.qty||0)<=(+p.minQty||0)).length;
  const totalCost = w => woTotalCost(w);
  const spendMo = wos.filter(w=>w.status==="Completed" && (w.completed||"").slice(0,7)===monthKey).reduce((s,w)=>s+totalCost(w),0);
  const urgentWOs = wos.filter(w=>w.status!=="Completed").sort((a,b)=>({High:0,Medium:1,Low:2}[a.priority]??3)-({High:0,Medium:1,Low:2}[b.priority]??3)).slice(0,5);
  const servicesDue = pms.filter(p=>p.status==="Overdue"||p.status==="Due Soon").map(pm=>({...pm, eqName:eqs.find(e=>e.id===pm.equipment)?.name||pm.equipment})).sort((a,b)=>(a.nextDue||"").localeCompare(b.nextDue||"")).slice(0,5);
  const deadlineEqs = eqs.filter(e=>e.status==="Out of Service / Deadline"||e.status==="Operational with Deficiencies").slice(0,5);
  const criticalParts = parts.filter(p=>p.lowStockAlert!==false && (+p.qty||0)<=(+p.minQty||0)).slice(0,5);
  const recentWOs = [...wos].sort((a,b)=>(b.created||"").localeCompare(a.created||"")).slice(0,5);

  const [customize, setCustomize] = useState(false);
  const defaultLayout = ["focus","today","workorders","pm","equipment","inventory","activity","costs"];
  const presetMap = {
    calm:{ label:"Calm Operations", layout:["focus","today","workorders","pm","equipment","inventory","activity","costs"], hidden:[], sizes:{ focus:"hero", today:"wide", workorders:"large", pm:"large", equipment:"large", inventory:"medium", activity:"wide", costs:"medium" } },
    mechanic:{ label:"Mechanic Daily Board", layout:["today","focus","workorders","pm","inventory","equipment","activity","costs"], hidden:["costs"], sizes:{ today:"hero", focus:"wide", workorders:"large", pm:"large", inventory:"medium", equipment:"medium", activity:"wide" } },
    manager:{ label:"Manager Console", layout:["focus","costs","equipment","workorders","pm","inventory","activity","today"], hidden:[], sizes:{ focus:"wide", costs:"large", equipment:"large", workorders:"medium", pm:"medium", inventory:"medium", activity:"wide", today:"medium" } },
    simple:{ label:"Simple Clean", layout:["today","workorders","pm","equipment","inventory","activity","focus","costs"], hidden:[], sizes:{ today:"wide", workorders:"wide", pm:"wide", equipment:"wide", inventory:"wide", activity:"wide", focus:"wide", costs:"wide" } }
  };
  const activePreset = settings.dashboardPreset || "calm";
  const savedLayout = settings.dashboardLayout?.length ? settings.dashboardLayout : presetMap.calm.layout;
  const layout = savedLayout.filter(id=>defaultLayout.includes(id));
  const fullLayout = [...layout, ...defaultLayout.filter(id=>!layout.includes(id))];
  const hidden = settings.dashboardHidden || [];
  const sizes = settings.dashboardWidgetSizes || presetMap.calm.sizes;
  const saveDash = (patch, mode="custom") => {
    const next = { ...settings, ...patch };
    if(mode === "custom") {
      next.dashboardPreset = "custom";
      next.dashboardCustomPreset = {
        dashboardLayout: next.dashboardLayout?.length ? next.dashboardLayout : fullLayout,
        dashboardHidden: next.dashboardHidden || [],
        dashboardWidgetSizes: next.dashboardWidgetSizes || sizes
      };
    }
    dispatch({ type:"UPDATE_SETTINGS", payload:next });
  };
  const applyPreset = preset => {
    if(preset === "custom") {
      if(settings.dashboardCustomPreset) saveDash({ ...settings.dashboardCustomPreset, dashboardPreset:"custom" }, "preset");
      else saveDash({ dashboardPreset:"custom" }, "preset");
      return;
    }
    const p = presetMap[preset] || presetMap.calm;
    saveDash({ dashboardPreset:preset, dashboardLayout:p.layout, dashboardHidden:p.hidden, dashboardWidgetSizes:p.sizes }, "preset");
  };
  const moveWidget = (id, dir) => {
    const arr = [...fullLayout];
    const i = arr.indexOf(id), j = i + dir;
    if(i<0 || j<0 || j>=arr.length) return;
    [arr[i], arr[j]] = [arr[j], arr[i]];
    saveDash({ dashboardLayout:arr });
  };
  const setWidgetSize = (id, size) => saveDash({ dashboardWidgetSizes:{ ...sizes, [id]:size } });
  const toggleWidget = id => saveDash({ dashboardHidden:hidden.includes(id) ? hidden.filter(x=>x!==id) : [...hidden, id] });
  const lockIfEditing = e => {
    if(!customize) return;
    if(e.target.closest?.("[data-dash-control]")) return;
    e.preventDefault();
    e.stopPropagation();
  };
  const go = tab => { if(!customize && tab) setTab(tab); };
  const sizeStyle = id => {
    const size = sizes[id] || "large";
    if(size==="small") return { gridColumn:"span 1", minHeight:130 };
    if(size==="medium") return { gridColumn:"span 2", minHeight:175 };
    if(size==="large") return { gridColumn:"span 3", minHeight:220 };
    if(size==="wide") return { gridColumn:"span 6", minHeight:190 };
    return { gridColumn:"1 / -1", minHeight:245 };
  };

  const ActionBtn = ({ icon, label, tab, accent=T.accent, onClick }) => (
    <button onClick={()=>{ if(customize) return; if(onClick) onClick(); else go(tab); }} disabled={customize} style={{ display:"flex", alignItems:"center", gap:10, border:`1px solid ${T.border}`, background:T.card, borderRadius:16, padding:"13px 14px", cursor:customize?"default":"pointer", opacity:customize ? .85 : 1, textAlign:"left", boxShadow:"0 8px 20px rgba(15,23,42,.06)" }}>
      <span style={{ width:34, height:34, borderRadius:12, background:accent+"18", color:accent, display:"grid", placeItems:"center", fontSize:17 }}>{icon}</span>
      <span style={{ display:"flex", flexDirection:"column", lineHeight:1.15 }}><b style={{ fontSize:13 }}>{label}</b><small style={{ color:T.muted, marginTop:3 }}>Open</small></span>
    </button>
  );
  const Metric = ({ label, value, sub, color=T.accent }) => (
    <div style={{ border:`1px solid ${T.border}`, borderRadius:18, padding:14, background:"linear-gradient(180deg,#fff,#fbfcff)", minWidth:0 }}>
      <div style={{ color:T.muted, fontSize:11, fontWeight:800, textTransform:"uppercase", letterSpacing:.45 }}>{label}</div>
      <div style={{ color, fontSize:28, fontWeight:950, letterSpacing:-.8, marginTop:3 }}>{value}</div>
      {sub && <div style={{ color:T.muted, fontSize:12, marginTop:2 }}>{sub}</div>}
    </div>
  );
  const MiniRow = ({ title, sub, badge, color=T.accent, tab }) => (
    <button onClick={()=>go(tab)} disabled={customize} style={{ width:"100%", border:"none", background:"transparent", borderBottom:`1px solid ${T.border}`, padding:"10px 0", display:"flex", justifyContent:"space-between", gap:10, textAlign:"left", cursor:customize?"default":"pointer" }}>
      <span style={{ minWidth:0 }}><b style={{ display:"block", fontSize:13, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{title}</b><small style={{ color:T.muted, display:"block", marginTop:2, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{sub}</small></span>
      {badge && <span style={{ alignSelf:"center", border:`1px solid ${color}`, color, borderRadius:999, padding:"3px 8px", fontSize:11, fontWeight:900, whiteSpace:"nowrap" }}>{badge}</span>}
    </button>
  );

  const cardHidden = settings.dashboardCardHidden || {};
  const itemCatalog = {
    focus:{ quick:"Quick actions", metrics:"Status summary" },
    today:{ plan:"Daily game plan" },
    workorders:{ metrics:"Work order counts", list:"Work order list" },
    pm:{ metrics:"PM counts", list:"PM due list" },
    equipment:{ metrics:"Equipment counts", list:"Equipment alert list" },
    inventory:{ metrics:"Inventory counts", list:"Low stock list" },
    activity:{ list:"Recent activity list" },
    costs:{ metrics:"Cost metrics", note:"Export reminder" }
  };
  const isItemHidden = (card,item) => (cardHidden[card] || []).includes(item);
  const setItemHidden = (card,item,hide=true) => {
    const current = cardHidden[card] || [];
    const nextList = hide ? [...new Set([...current,item])] : current.filter(x=>x!==item);
    saveDash({ dashboardCardHidden:{ ...cardHidden, [card]:nextList } });
  };
  const DashItem = ({ card, item, children }) => {
    if(isItemHidden(card,item)) return null;
    return <div style={{ position:"relative", paddingTop:customize?6:0 }}>
      {customize && <button data-dash-control="true" title="Remove this item from this card" onClick={()=>setItemHidden(card,item,true)} style={{ position:"absolute", top:-6, right:-6, width:22, height:22, borderRadius:999, border:`1px solid ${T.border}`, background:T.card, color:T.red, fontWeight:950, cursor:"pointer", lineHeight:"18px", boxShadow:"0 4px 12px rgba(15,23,42,.12)" }}>×</button>}
      {children}
    </div>;
  };
  const Widget = ({ id, title, subtitle, children, accent=T.accent }) => {
    const hiddenItems = cardHidden[id] || [];
    const addable = Object.entries(itemCatalog[id] || {}).filter(([key])=>hiddenItems.includes(key));
    return <Card style={{ ...sizeStyle(id), padding:0, overflow:"hidden", borderRadius:22, border:`1px solid ${T.border}`, background:T.card, boxShadow:"0 12px 30px rgba(15,23,42,.08)", position:"relative" }}>
      <div style={{ height:5, background:accent }} />
      <div style={{ padding:18 }}>
        <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:10, marginBottom:14 }}>
          <div><h3 style={{ margin:0, fontSize:17, letterSpacing:-.35 }}>{title}</h3>{subtitle && <div style={{ color:T.muted, fontSize:12, marginTop:3 }}>{subtitle}</div>}</div>
          {customize && <div data-dash-control="true" style={{ display:"flex", gap:6, alignItems:"center", flexWrap:"wrap", justifyContent:"flex-end" }}>
            <button onClick={()=>moveWidget(id,-1)} style={{ ...smallControl }}>↑</button>
            <button onClick={()=>moveWidget(id,1)} style={{ ...smallControl }}>↓</button>
            <select value={sizes[id] || "large"} onChange={e=>setWidgetSize(id,e.target.value)} style={{ ...smallControl, width:86 }}>
              <option value="small">Small</option><option value="medium">Medium</option><option value="large">Large</option><option value="wide">Wide</option><option value="hero">Hero</option>
            </select>
            <select value="" onChange={e=>{ if(e.target.value) setItemHidden(id,e.target.value,false); e.target.value=""; }} title="Add hidden item back to this card" style={{ ...smallControl, width:96 }}>
              <option value="">+ Add</option>
              {addable.map(([key,label])=><option key={key} value={key}>{label}</option>)}
            </select>
            <button onClick={()=>toggleWidget(id)} style={{ ...smallControl }}>Hide</button>
          </div>}
        </div>
        {children}
      </div>
    </Card>;
  };
  const smallControl = { height:28, border:`1px solid ${T.border}`, background:T.card, borderRadius:9, padding:"0 8px", fontSize:11, fontWeight:900, cursor:"pointer" };

  const quickActions = <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(145px,1fr))", gap:10 }}>
    <ActionBtn icon="➕" label="New Work Order" tab="workorders" accent="#2563eb" />
    <ActionBtn icon="🚜" label="Add Equipment" tab="equipment" accent="#16a34a" />
    <ActionBtn icon="🛠️" label="PM Schedule" tab="pm" accent="#d97706" />
    <ActionBtn icon="📦" label="Parts" tab="parts" accent="#7c3aed" />
    <ActionBtn icon="📊" label="Reports" tab="reports_combined" accent="#0f766e" />
    <ActionBtn icon="⚙️" label="Settings" onClick={onSettings} accent="#475569" />
  </div>;

  const widgets = {
    focus:<Widget id="focus" title="Shop Pulse" subtitle="A calm snapshot of what needs attention" accent={highPriority||pmOverdue||outOfSvc?T.red:T.green}>
      <DashItem card="focus" item="quick">{quickActions}</DashItem>
      <DashItem card="focus" item="metrics"><div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))", gap:10, marginTop:14 }}>
        <Metric label="Readiness" value={`${readiness}%`} sub={`${readyAssets}/${eqs.length || 0} ready`} color={readiness>=85?T.green:readiness>=70?T.amber:T.red}/>
        <Metric label="Active WOs" value={activeWOs} sub={`${highPriority} high priority`} color={highPriority?T.red:T.accent}/>
        <Metric label="PM Attention" value={pmOverdue+pmDueSoon} sub={`${pmOverdue} overdue`} color={pmOverdue?T.red:T.amber}/>
        <Metric label="Low Stock" value={lowStock} sub="parts to review" color={lowStock?T.amber:T.green}/>
      </div></DashItem>
    </Widget>,
    today:<Widget id="today" title="Today’s Game Plan" subtitle="Simple order of work for the day" accent="#0f766e">
      <DashItem card="today" item="plan"><div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(190px,1fr))", gap:10 }}>
        {[{n:"1",t:"Protect uptime",d:`Check ${outOfSvc} deadline assets and ${withDefic} deficiencies.`},{n:"2",t:"Clear PM risk",d:`Handle ${pmOverdue} overdue and ${pmDueSoon} due soon services.`},{n:"3",t:"Unblock repairs",d:`Review ${awaitParts} awaiting-parts work orders.`},{n:"4",t:"Close the loop",d:`Update notes, parts used, labor, and completed jobs.`}].map(x=><div key={x.n} style={{ border:`1px solid ${T.border}`, borderRadius:18, padding:14, background:T.card }}><div style={{ display:"flex", gap:10 }}><b style={{ width:28, height:28, borderRadius:10, background:T.accentLt, color:T.accent, display:"grid", placeItems:"center" }}>{x.n}</b><div><b>{x.t}</b><div style={{ color:T.muted, fontSize:12, marginTop:4 }}>{x.d}</div></div></div></div>)}
      </div></DashItem>
    </Widget>,
    workorders:<Widget id="workorders" title="Work Orders" subtitle="Current workload without digging" accent={highPriority?T.red:T.accent}>
      <DashItem card="workorders" item="metrics"><div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(90px,1fr))", gap:8, marginBottom:12 }}><Metric label="Open" value={openWOs}/><Metric label="In Prog" value={inProgWOs}/><Metric label="Parts" value={awaitParts}/><Metric label="On Hold" value={onHoldWOs} color={onHoldWOs?T.red:T.green}/></div></DashItem>
      <DashItem card="workorders" item="list">{(urgentWOs.length ? urgentWOs : recentWOs).map(w=><MiniRow key={w.id} title={`${w.woNumber||w.id} — ${w.title||w.type||"Work Order"}`} sub={`${w.equipmentName||w.equipment||"No equipment"} • ${w.status||"Open"}`} badge={w.priority||w.status} color={w.priority==="High"?T.red:T.accent} tab="workorders" />)}</DashItem>
    </Widget>,
    pm:<Widget id="pm" title="Preventive Maintenance" subtitle="Due services and inspections" accent={pmOverdue?T.red:T.amber}>
      <DashItem card="pm" item="metrics"><div style={{ display:"grid", gridTemplateColumns:"repeat(2,1fr)", gap:8, marginBottom:12 }}><Metric label="Overdue" value={pmOverdue} color={pmOverdue?T.red:T.green}/><Metric label="Due Soon" value={pmDueSoon} color={pmDueSoon?T.amber:T.green}/></div></DashItem>
      <DashItem card="pm" item="list">{servicesDue.length ? servicesDue.map(p=><MiniRow key={p.id} title={p.title||p.service||"PM Item"} sub={`${p.eqName||"Equipment"} • Due ${p.nextDue||"N/A"}`} badge={p.status} color={p.status==="Overdue"?T.red:T.amber} tab="pm" />) : <div style={{ color:T.muted, fontSize:13 }}>No PM due right now.</div>}</DashItem>
    </Widget>,
    equipment:<Widget id="equipment" title="Equipment Health" subtitle="Readiness and problem assets" accent={outOfSvc?T.red:T.green}>
      <DashItem card="equipment" item="metrics"><div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:8, marginBottom:12 }}><Metric label="Total" value={eqs.length}/><Metric label="Deadline" value={outOfSvc} color={outOfSvc?T.red:T.green}/><Metric label="Deficient" value={withDefic} color={withDefic?T.amber:T.green}/></div></DashItem>
      <DashItem card="equipment" item="list">{deadlineEqs.length ? deadlineEqs.map(e=><MiniRow key={e.id} title={`${e.id} — ${e.name}`} sub={`${e.make||""} ${e.model||""} • ${e.location||"No location"}`} badge={e.status?.replace("Out of Service / ","")} color={e.status==="Out of Service / Deadline"?T.red:T.amber} tab="equipment" />) : <div style={{ color:T.muted, fontSize:13 }}>No deadline or deficient equipment.</div>}</DashItem>
    </Widget>,
    inventory:<Widget id="inventory" title="Parts & Inventory" subtitle="Stock issues before they delay work" accent={lowStock?T.amber:T.green}>
      <DashItem card="inventory" item="metrics"><div style={{ display:"grid", gridTemplateColumns:"repeat(2,1fr)", gap:8, marginBottom:12 }}><Metric label="Tracked" value={parts.length}/><Metric label="Low Stock" value={lowStock} color={lowStock?T.amber:T.green}/></div></DashItem>
      <DashItem card="inventory" item="list">{criticalParts.length ? criticalParts.map(p=><MiniRow key={p.id} title={p.name||p.partNumber||"Part"} sub={`${p.partNumber||"No part #"} • Qty ${p.qty??0} / Min ${p.minQty??0}`} badge="Reorder" color={T.amber} tab="parts" />) : <div style={{ color:T.muted, fontSize:13 }}>Inventory looks good.</div>}</DashItem>
    </Widget>,
    activity:<Widget id="activity" title="Recent Activity" subtitle="Latest movement in the shop" accent="#64748b">
      <DashItem card="activity" item="list">{recentWOs.length ? recentWOs.map(w=><MiniRow key={w.id} title={w.title||w.type||"Work Order"} sub={`${w.woNumber||w.id} • ${w.status||"Open"} • ${w.created||"No date"}`} badge={w.priority||w.status} color={w.priority==="High"?T.red:T.accent} tab="workorders" />) : <div style={{ color:T.muted, fontSize:13 }}>No recent work order activity.</div>}</DashItem>
    </Widget>,
    costs:<Widget id="costs" title="Cost Snapshot" subtitle="Basic monthly maintenance awareness" accent="#2563eb">
      <DashItem card="costs" item="metrics"><div style={{ display:"grid", gridTemplateColumns:"repeat(2,1fr)", gap:10 }}><Metric label="Month Spend" value={`$${spendMo.toFixed(2)}`} color="#2563eb"/><Metric label="Completed" value={completedMo} sub="this month" color={T.green}/></div></DashItem>
      <DashItem card="costs" item="note"><div style={{ marginTop:12, color:T.muted, fontSize:12 }}>Use Reports to export PDF, Excel, or Word documents.</div></DashItem>
    </Widget>
  };

  return <div style={{ display:"flex", flexDirection:"column", gap:16, background:"linear-gradient(135deg,#f8fafc 0%,#eef6ff 46%,#fff7ed 100%)", margin:-4, padding:customize?16:6, borderRadius:24 }}>
    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", gap:12, flexWrap:"wrap" }}>
      <div><h2 style={{ margin:"0 0 4px", fontSize:30, letterSpacing:-.8 }}>Dashboard</h2><div style={{ color:T.muted, fontSize:13 }}>A clean home base for maintenance work, decisions, and quick actions.</div></div>
      <div data-dash-control="true" style={{ display:"flex", gap:8, alignItems:"center", flexWrap:"wrap" }}>
        <select value={activePreset} onChange={e=>applyPreset(e.target.value)} style={{ height:38, border:`1px solid ${T.border}`, borderRadius:12, padding:"0 12px", background:T.card, fontWeight:900 }}>
          <option value="calm">Calm Operations</option>
          <option value="mechanic">Mechanic Daily Board</option>
          <option value="manager">Manager Console</option>
          <option value="simple">Simple Clean</option>
          <option value="custom">My Custom Dashboard</option>
        </select>
        <Btn onClick={()=>setCustomize(v=>!v)}>{customize?"Done Customizing":"Customize Dashboard"}</Btn>
      </div>
    </div>

    {customize && <Card style={{ padding:16, border:`2px dashed ${T.accent}`, borderRadius:20, background:T.card }}>
      <div style={{ fontSize:16, fontWeight:950, marginBottom:4 }}>Dashboard edit mode</div>
      <div style={{ fontSize:12, color:T.muted, marginBottom:12 }}>Cards are locked while editing. Pick a preset, move cards, resize them, or hide what you do not use. Your changes save as “My Custom Dashboard.”</div>
      <div data-dash-control="true" style={{ display:"flex", flexWrap:"wrap", gap:8, marginBottom:12 }}>
        <Btn small onClick={()=>applyPreset("calm")}>Calm Operations</Btn>
        <Btn small variant="secondary" onClick={()=>applyPreset("mechanic")}>Mechanic Daily Board</Btn>
        <Btn small variant="secondary" onClick={()=>applyPreset("manager")}>Manager Console</Btn>
        <Btn small variant="secondary" onClick={()=>applyPreset("simple")}>Simple Clean</Btn>
      </div>
      <div data-dash-control="true" style={{ display:"flex", flexWrap:"wrap", gap:8 }}>{fullLayout.map(id=><Btn key={id} small variant={hidden.includes(id)?"secondary":"primary"} onClick={()=>toggleWidget(id)}>{hidden.includes(id)?"Show":"Hide"} {id}</Btn>)}</div>
    </Card>}

    <div onClickCapture={lockIfEditing} onMouseDownCapture={lockIfEditing} style={{ display:"grid", gridTemplateColumns:"repeat(6,minmax(130px,1fr))", gap:14, alignItems:"stretch" }}>
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
  const [equipmentStatusFilter, setEquipmentStatusFilter] = useState("All");
  const [completedDateFilter, setCompletedDateFilter] = useState("all");
  const [eqSearch, setEqSearch] = useState("");
  const [showNewTech, setShowNewTech] = useState(false);
  const [newTech, setNewTech] = useState({ name:"", position:"", laborRate:"" });
  const [showNewPart, setShowNewPart] = useState(null); // index of part row adding new part
  const [newPartForm, setNewPartForm] = useState({});
  const [detailWO, setDetailWO] = useState(null);
  const [editMode, setEditMode] = useState(false);

  const isDarkMode = T.bg === DARK_THEME.bg;
  const WO_TYPES = [
    { id:"Repair",     label:"Repair Work Order",     icon:"🛠", desc:"Fault repairs and breakdown response",     color:isDarkMode?T.red:"#7f1d1d", bg:isDarkMode?T.redLt:"#fef2f2" },
    { id:"Service",    label:"Service Work Order",    icon:"🧰", desc:"Preventive maintenance service generated from PM tasks", color:T.accent, bg:isDarkMode?T.accentLt:"#eff6ff" },
    { id:"Inspection", label:"Inspection Work Order", icon:"🔍", desc:"Equipment inspection generated from inspection tasks", color:T.green, bg:isDarkMode?T.greenLt:"#ecfdf5" },
  ];

  /* Intervals shown for Service and Inspection types */
  const SERVICE_INTERVALS   = ["New Equipment Service","Weekly","Bi-Weekly","Monthly","Bi-Monthly","Quarterly","Bi-Annual","Annual"];
  const INSPECT_INTERVALS   = ["New Equipment Inspection","Weekly","Bi-Weekly","Monthly","Bi-Monthly","Quarterly","Bi-Annual","Annual"];
  const getIntervals = (woType) => woType==="Inspection" ? INSPECT_INTERVALS : SERVICE_INTERVALS;
  const partCategories = getPartCategoryOptions(state);

  const WO_STATUS_OPTIONS = ["Open","In Progress","Pending Diagnostic","Awaiting Parts","On Hold","Completed"];
  const STATUS_TABS = ["Active", ...WO_STATUS_OPTIONS, "All"];
  const PRIO_ORDER  = {"High":0,"Medium":1,"Low":2};
  const EQUIPMENT_STATUS_FILTERS = ["Fully Operational", "Operational with Deficiencies", "Out of Service / Deadline"];
  const EQUIPMENT_STATUS_ALL_SORTS = {
    allAsc: "All Statuses — Fully Operational First",
    allDesc: "All Statuses — Deadline First",
  };
  const getCompletedDate = (w) => w?.completed || w?.completedDate || w?.dateCompleted || w?.closedDate || w?.closedAt || w?.completedAt || "";

  /* Date range filter for completed WOs */
  const matchCompletedDate = (w) => {
    if(filter!=="Completed" || completedDateFilter==="all") return true;
    const completedDate = getCompletedDate(w);
    if(!completedDate) return false;
    const d = new Date(completedDate);
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

  const equipmentStatusRank = (status) => ({
    "Fully Operational": 1,
    "Operational with Deficiencies": 2,
    "Out of Service / Deadline": 3,
  }[status] || 99);
  const getWOEquipmentStatus = (w) => {
    const eq = (state.equipment||[]).find(e=>String(e.id)===String(workOrderEquipmentId(w)));
    return w.status==="Completed" ? "Fully Operational" : (w.equipmentStatus || eq?.status || "Fully Operational");
  };

  const filtered = state.workOrders.filter(w=>{
    const matchStatus   = filter==="Active"?(w.status!=="Completed"):filter==="All"?true:w.status===filter;
    const matchType     = typeFilter==="All"     || w.woType===typeFilter;
    const matchPriority = priorityFilter==="All" || w.priority===priorityFilter;
    const matchMech     = mechFilter==="All"     || w.tech===mechFilter;
    const woEqStatus = getWOEquipmentStatus(w);
    const matchEquipmentStatus = equipmentStatusFilter==="All" || equipmentStatusFilter==="allAsc" || equipmentStatusFilter==="allDesc" || woEqStatus===equipmentStatusFilter;
    return matchStatus && matchType && matchPriority && matchMech && matchEquipmentStatus && matchCompletedDate(w);
  }).sort((a,b)=>{
    const compareBySelectedSort = () => {
      let cmp = 0;
      if(sortBy==="priority") cmp = (PRIO_ORDER[a.priority]??9)-(PRIO_ORDER[b.priority]??9);
      else if(sortBy==="due")     cmp = (a.due||"").localeCompare(b.due||"");
      else if(sortBy==="created") cmp = (a.created||"").localeCompare(b.created||"");
      else if(sortBy==="completed") cmp = getCompletedDate(a).localeCompare(getCompletedDate(b));
      else if(sortBy==="status")  cmp = (a.status||"").localeCompare(b.status||"");
      else if(sortBy==="equipmentStatus") cmp = equipmentStatusRank(getWOEquipmentStatus(a)) - equipmentStatusRank(getWOEquipmentStatus(b));
      else if(sortBy==="cost") {
        cmp = woTotalCost(a)-woTotalCost(b);
      }
      return sortDir==="asc" ? cmp : -cmp;
    };
    if(equipmentStatusFilter==="allAsc" || equipmentStatusFilter==="allDesc") {
      const statusCmp = equipmentStatusRank(getWOEquipmentStatus(a)) - equipmentStatusRank(getWOEquipmentStatus(b));
      if(statusCmp !== 0) return equipmentStatusFilter==="allAsc" ? statusCmp : -statusCmp;
      return compareBySelectedSort();
    }
    return compareBySelectedSort();
  });
  const allMechanics = [...new Set(state.workOrders.map(w=>w.tech).filter(Boolean))];
  const technicians = state.technicians || [];
  const defaultMechanic = technicians.length === 1 ? technicians[0] : null;

  const applyDefaultMechanic = (base={}) => {
    if(!defaultMechanic) return base;
    return {
      ...base,
      techId: base.techId || defaultMechanic.id,
      tech: base.tech || defaultMechanic.name || "",
      laborCost: base.laborCost || ((+base.laborHours||0) * (+defaultMechanic.laborRate||0)),
    };
  };

  /* Smart WO ID. Service WOs are numbered per equipment: EQID SVC 01, EQID SVC 02... */
  const genWOId = (eqId, woType="Repair") => {
    const id = eqId || "GEN";
    if (woType === "Service") {
      const prefix = `${id} SVC `;
      const existing = state.workOrders.filter(w => String(w.id || w.woNumber || "").startsWith(prefix));
      const nums = existing.map(w => parseInt(String(w.id || w.woNumber || "").slice(prefix.length), 10)).filter(n => !Number.isNaN(n));
      return `${prefix}${String(nums.length ? Math.max(...nums) + 1 : 1).padStart(2, "0")}`;
    }
    const prefix = `${id}-`;
    const existing = state.workOrders.filter(w=>String(w.id || w.woNumber || "").startsWith(prefix));
    const nums = existing.map(w=>parseInt(String(w.id || w.woNumber || "").slice(prefix.length),10)).filter(n => !Number.isNaN(n));
    return `${prefix}${String(nums.length>0?Math.max(...nums)+1:1).padStart(2,"0")}`;
  };

  const buildTitle = (woType, interval) => {
    if (!woType) return "";
    if ((woType==="Service"||woType==="Inspection") && interval) return `${interval} ${woType}`;
    return woType;
  };

  /* Equipment picker list */
  const allPickable = [
    ...state.equipment.map(eq=>({ id:eq.id, label:eq.name, sub:`${eq.id} | ${eq.make||""} ${eq.model||""} | Serial: ${eq.serial||"—"} | EIL: ${eq.eilNumber||"—"}`, type:"Equipment", typeColor:"#1e40af", typeBg:"#eff6ff", parentName:null, parentId:null })),
    ...state.equipment.flatMap(eq=>(eq.attachments||[]).map(at=>({ id:at.id, label:at.name, sub:`${at.id} | ${at.make||""} ${at.model||""} | Serial: ${at.serial||"—"} | EIL: ${at.eilNumber||"—"} | on: ${eq.name} (${eq.id})`, type:"Attachment", typeColor:"#065f46", typeBg:"#ecfdf5", parentNomenclature:eq.name, parentId:eq.id }))),
  ];
  const filteredPickable = allPickable.filter(i=>`${i.label} ${i.sub}`.toLowerCase().includes(eqSearch.toLowerCase()));

  const openAdd = () => {
    setEqSearch("");
    setForm(applyDefaultMechanic({ woType:"Repair", status:"Open", equipmentStatus:"Fully Operational", priority:"Medium", created:today(), due:today(), tech:"", techId:"", laborHours:0, laborCost:0, partsCost:0, partsUsed:[], outsideServices:[], mechanicNotes:"", faultEnabled:true, faultDescription:"", usageHours:"", usageMileage:"", usageNA:false, repairCause:"", correctiveAction:"", serviceChecklist:"", inspectionFindings:"" }));
    setModal("pick");
  };

  const pickType = (typeId) => { setForm(f=>({...f, woType:typeId, title:buildTitle(typeId,"")})); setModal("pick"); };
  const latestUsageForEquipment = (equipmentId) => {
    const logs = (state.usageLogs||[])
      .filter(l=>String(l.equipmentId)===String(equipmentId))
      .sort((a,b)=>String(b.date||"").localeCompare(String(a.date||"")) || String(b.id||"").localeCompare(String(a.id||"")));
    const latestHoursLog = logs.find(l=>String(l.hours ?? "").trim());
    const latestMileageLog = logs.find(l=>String(l.mileage ?? "").trim());
    return {
      hours: latestHoursLog ? String(latestHoursLog.hours) : "",
      mileage: latestMileageLog ? String(latestMileageLog.mileage) : "",
    };
  };

  const pickEquipment = (item) => {
    const eq = state.equipment.find(e=>e.id===item.id);
    const latestUsage = latestUsageForEquipment(item.id);
    setForm(f=>({...f, woType:f.woType||"Repair", equipment:item.id, equipmentLabel:item.label, equipmentSub:item.sub, equipmentType:item.type, parentName:item.parentName||null, parentId:item.parentId||null, equipmentStatus:eq?.status||"Fully Operational", usageType:eq?.usageType||"hours", usageNA: eq?.trackUsage ? false : (f.usageNA||false), usageHours:latestUsage.hours, usageMileage:latestUsage.mileage}));
    setModal("form");
  };

  /* Click row to open the editable Work Order form */
  const openEdit = (wo) => {
    setDetailWO(null);
    setEditMode(false);
    const eq = state.equipment.find(e=>e.id===wo.equipment);
    const hasAnyUsageReading = !!String(wo.usageHours||"").trim() || !!String(wo.usageMileage||"").trim();
    const needsManualUsagePrompt = (wo.woType === "Inspection") && eq && !eq.trackUsage && !hasAnyUsageReading && !wo.usageNA;
    setForm({
      ...wo,
      partsUsed:wo.partsUsed||[],
      outsideServices:wo.outsideServices||[],
      usageType: wo.usageType || eq?.usageType || "hours",
      // Inspection WOs for equipment without usage tracking still need the user to confirm a reading or choose N/A.
      usageNA: needsManualUsagePrompt ? false : !!wo.usageNA,
    });
    setModal("edit");
  };
  const openDetail = openEdit;

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
    if(!newTech.name) return alert("Nomenclature required.");
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
      arr[rowIdx] = { name:invPart.name, partNumber:invPart.partNumber||"", qty:1, unit:invPart.unit||invPart.unitType||"ea", unitCost:invPart.unitCost, partId:invPart.id, availableQty:+(invPart.qty||0), partSearch:invPart.name||invPart.partNumber||"" };
      return {...f, partsUsed:arr};
    });
  };

  const addNewPartToInventory = (rowIdx) => {
    if(!newPartForm.name) return alert("Part name required.");
    const requestedQty = +(newPartForm.requestedQty || newPartForm.qty || 1);
    const newPart = { ...newPartForm, equipmentId:"", category:String(newPartForm.category||"").trim(), modelFit:String(newPartForm.modelFit||"").trim(), id:genId("PT"), qty:+(newPartForm.qty||requestedQty||0), unit:String(newPartForm.unit||"ea").trim()||"ea", unitCost:+(newPartForm.unitCost||0), minQty:+(newPartForm.minQty||1) };
    delete newPart.requestedQty;
    dispatch({ type:"ADD_PART", payload:newPart });
    setForm(f=>{ const arr=[...(f.partsUsed||[])]; arr[rowIdx]={name:newPart.name,qty:requestedQty||1,unit:newPart.unit||newPart.unitType||"ea",unitCost:newPart.unitCost,partId:newPart.id}; return {...f,partsUsed:arr}; });
    setNewPartForm({});
    setShowNewPart(null);
  };

  const partMatchesInventory = (partName) => {
    const key = String(partName||"").trim().toLowerCase();
    if(!key) return true;
    return (state.parts||[]).some(pt =>
      String(pt.name||"").trim().toLowerCase() === key ||
      String(pt.partNumber||"").trim().toLowerCase() === key
    );
  };

  const promptMissingPartInventory = () => {
    const idx = (form.partsUsed||[]).findIndex(p => String(p?.name||"").trim() && !p.partId && !partMatchesInventory(p.name));
    if(idx < 0) return false;
    const p = (form.partsUsed||[])[idx] || {};
    const partName = String(p.name||"").trim();
    const addIt = confirm(`Part "${partName}" is not in stock / not found in inventory.\n\nDo you want to add this part to inventory now?`);
    if(addIt){
      setNewPartForm({ name:partName, partNumber:"", qty:p.qty||1, requestedQty:p.qty||1, minQty:1, unit:p.unit||"ea", unitCost:p.unitCost||"", category:"", vendor:"", modelFit:"" });
      setShowNewPart(idx);
      alert("Add the stock quantity and price, then click Add & Use. Save the work order after that.");
      return true;
    }
    return false;
  };

  const save = (isEdit) => {
    if(!form.equipment) return alert("Equipment required.");
    if(!(form.faultDescription||"").trim()) return alert("Description required.");
    const usageModeReq = String(form.usageType||"hours").toLowerCase();
    const selectedEquipment = state.equipment.find(e=>e.id===form.equipment);
    const latestUsage = latestUsageForEquipment(form.equipment);
    const formWithLatestUsage = applyDefaultMechanic(form.usageNA ? form : {
      ...form,
      usageHours: String(form.usageHours ?? "").trim() || latestUsage.hours,
      usageMileage: String(form.usageMileage ?? "").trim() || latestUsage.mileage,
    });
    const hoursEntered = !!String(formWithLatestUsage.usageHours||"").trim();
    const mileageEntered = !!String(formWithLatestUsage.usageMileage||"").trim();
    const hasUsageReading = formWithLatestUsage.usageNA || (usageModeReq==="mileage" ? mileageEntered : usageModeReq==="both" ? (hoursEntered || mileageEntered) : hoursEntered);
    if(!hasUsageReading) return alert("Enter the current usage reading or select N/A.");
    if(formWithLatestUsage.woType === "Inspection" && selectedEquipment && !selectedEquipment.trackUsage && !formWithLatestUsage.usageNA && !hoursEntered && !mileageEntered) {
      return alert("This equipment has no usage tracking selected. Enter the current usage for this inspection work order, or select N/A.");
    }
    const prevWO = isEdit ? state.workOrders.find(w=>w.id===formWithLatestUsage.id) : null;

    const newParts  = (formWithLatestUsage.partsUsed||[]);
    const partsTotal = newParts.reduce((s,p)=>s+lineItemTotal(p),0);
    const outsideServices = (formWithLatestUsage.outsideServices||[]).filter(svc=>String(svc?.description||svc?.name||"").trim() || +(svc?.unitCost||svc?.cost||0));
    const outsideServicesSubtotal = outsideServicesTotal(outsideServices);
    if(promptMissingPartInventory()) return;
    if(isEdit) {
      const payload = {...formWithLatestUsage, woType:formWithLatestUsage.woType||"Repair", title:formWithLatestUsage.faultDescription||formWithLatestUsage.woType||"Work Order", faultEnabled:true, outsideServices, partsCost:partsTotal, outsideServicesCost:outsideServicesSubtotal};
      if(prevWO && payload.status !== prevWO.status && !confirmWOStatusChange(prevWO, payload.status)) return;
      dispatch({type:"UPDATE_WO", payload});
      if(prevWO && prevWO.status !== "Completed" && payload.status === "Completed") {
        setTimeout(() => {
          if(confirm(`Work order ${payload.id || payload.woNumber || ""} was completed. Print it now?`)) printWO(payload);
        }, 0);
      }
    } else {
      const nextType = formWithLatestUsage.woType || "Repair";
      const nextId = genWOId(formWithLatestUsage.equipment, nextType);
      dispatch({type:"ADD_WO", payload:{...formWithLatestUsage, woType:nextType, title:formWithLatestUsage.faultDescription||nextType, faultEnabled:true, id:nextId, woNumber:nextId, outsideServices, partsCost:partsTotal, outsideServicesCost:outsideServicesSubtotal}});
    }
    setModal(null);
    setDetailWO(null);
  };

  const del = id => { if(confirm("Delete this work order?")){ dispatch({type:"DELETE_WO",payload:id}); setModal(null); setDetailWO(null); }};

  const confirmWOStatusChange = (wo, nextStatus) => {
    const currentStatus = wo?.status || "Open";
    if(currentStatus === nextStatus) return true;
    const woLabel = wo?.id || wo?.woNumber || "this work order";
    if(nextStatus === "Completed") {
      return confirm(`Close ${woLabel}?\n\nThis will mark the work order completed, set the equipment back to Fully Operational, and consume any parts listed on the work order from inventory.`);
    }
    if(currentStatus === "Completed" && nextStatus !== "Completed") {
      return confirm(`Re-open ${woLabel}?\n\nAny parts previously consumed by this work order will be restocked until the work order is closed again.`);
    }
    return true;
  };

  const quickUpdateWO = (wo, changes) => {
    const nextStatus = changes.status || wo.status || "Open";
    if(changes.status && !confirmWOStatusChange(wo, nextStatus)) return;
    const next = {
      ...wo,
      ...changes,
      equipmentStatus: nextStatus === "Completed" ? "Fully Operational" : (changes.equipmentStatus || wo.equipmentStatus || "Fully Operational"),
      completed: nextStatus === "Completed" ? (wo.completed || wo.completedDate || wo.dateCompleted || wo.closedDate || today()) : (changes.status && changes.status !== "Completed" ? "" : wo.completed),
      completedDate: nextStatus === "Completed" ? (wo.completedDate || wo.completed || wo.dateCompleted || wo.closedDate || today()) : (changes.status && changes.status !== "Completed" ? "" : wo.completedDate),
    };
    dispatch({ type:"UPDATE_WO", payload:next });
    if(changes.status && (wo.status || "Open") !== "Completed" && nextStatus === "Completed") {
      setTimeout(() => {
        if(confirm(`Work order ${next.id || next.woNumber || ""} was completed. Print it now?`)) printWO(next);
      }, 0);
    }
  };

  /* ---- Print Work Order ---- */
  const printWO = (wo) => {
    const ws = woSettings || {};
    const printOpt = (key) => ws[key] !== false;
    const gs = state.settings || {};
    const eq = state.equipment.find(e=>e.id===wo.equipment);

    const h = (value) => String(value ?? "").replace(/[&<>'"]/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[ch]));
    const money = (value) => `$${(+value || 0).toFixed(2)}`;

    const companyName = gs.companyName || "Maintenance Department";
    const companyLogo = gs.logo || "";
    const usageMode = (eq?.usageType || wo.usageType || "hours").toLowerCase();
    const usageDisplayLabel = usageMode === "mileage" ? "Mileage" : usageMode === "both" ? "Mileage / Hours" : "Hours";
    const usageDisplayValue = wo.usageNA ? "N/A" : (usageMode === "mileage"
      ? (wo.usageMileage ? Number(wo.usageMileage).toLocaleString() : "")
      : usageMode === "both"
        ? [wo.usageMileage ? Number(wo.usageMileage).toLocaleString() : "", wo.usageHours ? `${wo.usageHours} Hours` : ""].filter(Boolean).join(" / ")
        : (wo.usageHours || ""));

    const cleanInspectionTaskName = (value) => String(value || "").replace(/^\s*inspection\s*task\s*:\s*/i, "").trim();
    const printableDescription = wo.woType === "Inspection"
      ? (cleanInspectionTaskName(wo.inspectionTaskName || wo.faultDescription || wo.description || wo.title) || "")
      : (wo.faultDescription || "");

    const partsUsed = Array.isArray(wo.partsUsed) ? wo.partsUsed : [];
    const partsTotal = partsUsed.reduce((sum, part) => sum + lineItemTotal(part), 0);
    const outsideServices = Array.isArray(wo.outsideServices) ? wo.outsideServices : [];
    const outsideServicesSubtotal = outsideServicesTotal(outsideServices);
    const laborHoursTotal = +(wo.laborHours || 0);
    const laborTotal = +(wo.laborCost || 0);
    const grandTotal = partsTotal + outsideServicesSubtotal + laborTotal;

    const statusClass = String(wo.status || "Open").toLowerCase().includes("complete") ? "completed" : String(wo.status || "Open").toLowerCase().replace(/[^a-z0-9]+/g,"-");
    const workType = String(wo.woType || "Repair").toUpperCase();
    const typeIcon = wo.woType === "Service" ? "⚙" : wo.woType === "Inspection" ? "☑" : "⚒";
    const printedDate = wo.completed || "";
    const assignedMechanicName = wo.tech || "";

    const printTypeKey = (() => {
      const type = String(wo.woType || "Repair").toLowerCase();
      if (type.includes("inspection")) return "inspection";
      if (type.includes("service") || type.includes("prevent")) return "service";
      return "repair";
    })();
    const defaultTypeColors = { repair:"blue", inspection:"mint", service:"yellow" };
    const colorKey = ws[`${printTypeKey}PrintColor`] || defaultTypeColors[printTypeKey] || "blue";
    const colorMap = {
      blue:   { accent:"#dbeafe", border:"#1e3a8a", dark:"#1e3a8a", soft:"#eff6ff" },
      yellow: { accent:"#fef3c7", border:"#92400e", dark:"#78350f", soft:"#fffbeb" },
      mint:   { accent:"#dcfce7", border:"#166534", dark:"#14532d", soft:"#f0fdf4" },
      slate:  { accent:"#e2e8f0", border:"#334155", dark:"#1e293b", soft:"#f8fafc" }
    };
    const C = colorMap[colorKey] || colorMap[defaultTypeColors[printTypeKey]] || colorMap.blue;

    const woRows = [{"WO #":wo.id, Title:wo.title||"", Status:wo.status||"", Priority:wo.priority||"", Equipment:eq?`${eq.name} (${eq.id})`:wo.equipment||"", Mechanic:wo.tech||"", Created:wo.created||"", Due:wo.due||"", Completed:wo.completed||"", "Labor Hours":laborHoursTotal.toFixed(1), Labor:laborTotal.toFixed(2), Parts:partsTotal.toFixed(2), Total:grandTotal.toFixed(2), Description:printableDescription, "Work Performed":wo.description||"", Notes:wo.mechanicNotes||""}];
    const woCsv = rowsToDataUri(woRows);

    const inspectionChecklistPrint = (() => {
      if(wo.woType!=="Inspection") return "";
      const results = Array.isArray(wo.inspectionStepResults) && wo.inspectionStepResults.length
        ? wo.inspectionStepResults
        : String(wo.inspectionSteps||wo.workPerformed||"").split(/\n+/).map((step,i)=>({ id:`step-${i}`, step:step.trim(), result:"", comment:"" })).filter(x=>x.step);
      if(!results.length) return "";
      return `<section class="section"><div class="section-title">Inspection Checklist</div><table class="data-table"><thead><tr><th style="width:55%">Step</th><th style="width:15%">Pass / Fail</th><th style="width:30%">Comment</th></tr></thead><tbody>${results.map((r,i)=>`<tr><td>${i+1}. ${h(r.step)||"&nbsp;"}</td><td><b>${h(r.result)||"&nbsp;"}</b></td><td>${h(r.comment)||"&nbsp;"}</td></tr>`).join("")}</tbody></table></section>`;
    })();

    const win = window.open("","_blank","width=900,height=700");
    if(!win){ alert("Please allow pop-ups to print work orders."); return; }

    win.document.write(`<!DOCTYPE html><html><head><title>Work Order ${h(wo.id)}</title><style>
      *{box-sizing:border-box;margin:0;padding:0}
      html,body{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}
      body{font-family:Arial,Helvetica,sans-serif;background:#fff;color:#111827;font-size:11px;line-height:1.25}
      @page{size:Letter;margin:0}
      .page{width:8.5in;min-height:auto;margin:0 auto;padding:.24in .28in;display:flex;flex-direction:column;gap:4px}
      .outer{border:1.5px solid #111827;border-radius:8px;overflow:hidden;background:white}
      .top{display:grid;grid-template-columns:1.05in 1fr 1.65in;border-bottom:1.5px solid #111827;min-height:.72in}
      .logoBox{display:flex;align-items:center;justify-content:center;border-right:1.5px solid #111827;padding:6px;background:white;overflow:hidden}
      .logoBox img{max-width:100%;max-height:.58in;object-fit:contain;display:block}
      .logoText{font-weight:900;text-align:center;color:#111827;font-size:13px;line-height:1.2}
      .companyBox{display:flex;flex-direction:column;align-items:center;justify-content:center;background:${C.soft};padding:8px 10px;text-align:center}
      .company{font-size:18px;font-weight:900;letter-spacing:1px;text-transform:uppercase;color:#111827;line-height:1.1}
      .typePill{margin-top:4px;border:1.5px solid ${C.border};background:${C.accent};color:#111827;border-radius:999px;padding:4px 18px;font-size:12px;font-weight:900;letter-spacing:.8px;text-transform:uppercase;display:inline-flex;gap:6px;align-items:center}
      .numberBox{border-left:1.5px solid #111827;display:grid;grid-template-rows:1fr .32in;text-align:center;background:white}
      .woNumber{display:flex;flex-direction:column;align-items:center;justify-content:center;padding:6px}
      .woNumber .label{font-size:10px;font-weight:900;letter-spacing:1px;text-transform:uppercase;color:#111827}
      .woNumber .number{font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:900;color:#111827;margin-top:4px;word-break:break-word}
      .status{display:flex;align-items:center;justify-content:center;background:${C.border};color:white;font-size:11px;font-weight:900;letter-spacing:1.3px;text-transform:uppercase;border-top:1.5px solid #111827}
      .completed{background:${C.border}!important;color:white!important}
      .dateGrid{display:grid;grid-template-columns:1fr 1fr 1fr;border-bottom:1.5px solid #111827}
      .infoGrid{display:grid;grid-template-columns:1fr 1fr 1fr}
      .cell{min-height:.28in;padding:4px 6px;border-right:1px solid #9ca3af;border-bottom:1px solid #cbd5e1;display:grid;grid-template-columns:.95fr 1.35fr;align-items:center;gap:8px;overflow:hidden}
      .cell:nth-child(3n){border-right:none}
      .dateGrid .cell{border-bottom:none;grid-template-columns:1fr 1fr;min-height:.26in}
      .fieldLabel{font-size:8.5px;font-weight:900;text-transform:uppercase;letter-spacing:.65px;color:#111827;line-height:1.1}
      .fieldValue{font-size:10.5px;font-weight:800;color:#111827;line-height:1.15;white-space:normal;overflow-wrap:anywhere}
      .mono{font-family:Arial,Helvetica,sans-serif}
      .section{border-top:1.5px solid #111827;break-inside:auto;page-break-inside:auto}
      .section-title{background:${C.accent};color:#111827;border-bottom:1px solid #94a3b8;font-size:10.5px;font-weight:900;text-transform:uppercase;letter-spacing:.65px;padding:6px 10px}
      .textBlock{padding:5px 7px;min-height:.28in;white-space:pre-wrap;overflow-wrap:anywhere;color:#111827;font-size:12px}
      .textBlock.tall{min-height:.45in}
      .summaryTitle{background:${C.accent};color:#111827;border-bottom:1px solid #94a3b8;font-size:10.5px;font-weight:900;text-transform:uppercase;letter-spacing:.65px;padding:6px 10px}
      .miniTitle{padding:4px 7px 3px;font-weight:900;text-transform:uppercase;font-size:11px;color:#111827;background:#fff}
      .data-table{width:100%;border-collapse:collapse;table-layout:fixed;font-size:10.5px}
      .data-table th{background:#e5e7eb;color:#111827;text-transform:uppercase;letter-spacing:.35px;font-size:8.5px;font-weight:900;padding:4px 5px;border-top:1px solid #9ca3af;border-bottom:1px solid #9ca3af;border-right:1px solid #cbd5e1;text-align:left}
      .data-table td{padding:4px 5px;border-bottom:1px solid #cbd5e1;border-right:1px solid #e5e7eb;vertical-align:top;overflow-wrap:anywhere;color:#111827}
      .data-table th:last-child,.data-table td:last-child{border-right:none}
      .right{text-align:right}.center{text-align:center}
      .subRow td{background:#f8fafc;font-weight:900;border-top:1.5px solid #111827}
      .grandTotal{display:grid;grid-template-columns:1fr 1.5in;border-top:1.5px solid #111827;background:${C.accent};font-weight:900;font-size:13px;color:#111827}
      .grandTotal div{padding:9px 12px}.grandTotal div:last-child{text-align:right;border-left:1.5px solid #111827}
      .signatureGrid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;padding:8px 10px;border-top:1.5px solid #111827;min-height:.42in;align-items:end}
      .sigLine{border-top:1.5px solid #111827;padding-top:5px;min-height:32px}
      .sigValue{font-size:12px;font-weight:800;margin-bottom:4px;min-height:14px;overflow-wrap:anywhere;color:#111827}
      .sigLabel{font-size:9.5px;font-weight:900;text-transform:uppercase;letter-spacing:.6px;color:#111827}
      .pbtn{margin:14px auto 0;display:flex;gap:10px;justify-content:center}
      .pbtn button,.pbtn a{padding:9px 24px;font-size:13px;font-weight:800;border-radius:6px;cursor:pointer;text-decoration:none;font-family:Arial,Helvetica,sans-serif}
      .printBtn{background:${C.border};color:white;border:none}.fileBtn{background:#fff;color:#111827;border:1px solid #111827}
      @page{size:letter;margin:0}
      @media print{.pbtn,.print-customize{display:none!important}html,body{width:8.5in;margin:0!important;padding:0!important}.page{width:8.5in;padding:.18in .22in}.outer{break-inside:auto;page-break-inside:auto}body{font-size:10px}.section,.data-table tr{break-inside:auto;page-break-inside:auto}}
    </style></head><body>
    <div class="page">
      <div class="outer">
        <header class="top">
          <div class="logoBox">${companyLogo?`<img src="${companyLogo}" alt="Logo">`:`<div class="logoText">LOGO</div>`}</div>
          <div class="companyBox"><div class="company">${h(companyName)}</div><div class="typePill"><span>${typeIcon}</span><span>${h(workType)}</span></div></div>
          <div class="numberBox"><div class="woNumber"><div class="label">Work Order Number</div><div class="number">${h(wo.id || "")}</div></div><div class="status ${statusClass}">${h(wo.status || "Open")}</div></div>
        </header>

        ${printOpt("showDates") ? `<div class="dateGrid">
          <div class="cell"><div class="fieldLabel">Date Created</div><div class="fieldValue">${h(wo.created)||"&nbsp;"}</div></div>
          <div class="cell"><div class="fieldLabel">Due Date</div><div class="fieldValue">${h(wo.due)||"&nbsp;"}</div></div>
          <div class="cell"><div class="fieldLabel">Date Completed</div><div class="fieldValue">${h(wo.completed)||"&nbsp;"}</div></div>
        </div>` : ""}

        ${printOpt("showEquipment") ? `<section class="section" style="border-top:none">
          <div class="section-title">Work Order Type and Equipment Information</div>
          <div class="infoGrid">
            <div class="cell"><div class="fieldLabel">Work Order Type</div><div class="fieldValue">${h(workType)}</div></div>
            <div class="cell"><div class="fieldLabel">Equipment Number</div><div class="fieldValue mono">${h(wo.equipment)||"&nbsp;"}</div></div>
            <div class="cell"><div class="fieldLabel">Equipment Name</div><div class="fieldValue">${h(eq?.name || wo.equipmentLabel)||"&nbsp;"}</div></div>
            <div class="cell"><div class="fieldLabel">Make and Model</div><div class="fieldValue">${h(eq ? `${eq.make||""} ${eq.model||""}`.trim() : "")||"&nbsp;"}</div></div>
            <div class="cell"><div class="fieldLabel">Serial Number</div><div class="fieldValue mono">${h(eq?.serial)||"&nbsp;"}</div></div>
            <div class="cell"><div class="fieldLabel">${h(usageDisplayLabel)}</div><div class="fieldValue mono">${h(usageDisplayValue)||"&nbsp;"}</div></div>
            <div class="cell"><div class="fieldLabel">EIL #</div><div class="fieldValue mono">${h(eq?.eilNumber)||"&nbsp;"}</div></div>
            <div class="cell"><div class="fieldLabel">Priority</div><div class="fieldValue">${h(wo.priority)||"&nbsp;"}</div></div>
            <div class="cell"><div class="fieldLabel">Mechanic</div><div class="fieldValue">${h(wo.tech)||"&nbsp;"}</div></div>
          </div>
        </section>` : ""}

        ${printOpt("showFaultDescription") ? `<section class="section"><div class="section-title">Description</div><div class="textBlock">${h(printableDescription)||"&nbsp;"}</div></section>` : ""}
        ${printOpt("showDescription") ? `<section class="section"><div class="section-title">Work Description and Work Performed</div><div class="textBlock tall">${h(wo.description)||"&nbsp;"}</div></section>` : ""}
        ${inspectionChecklistPrint}
        ${wo.woType !== "Inspection" && printOpt("showMechanicNotes") ? `<section class="section"><div class="section-title">Mechanic Notes</div><div class="textBlock tall">${h(wo.mechanicNotes)||"&nbsp;"}</div></section>` : ""}

        ${(printOpt("showParts") || printOpt("showOutsideServices") || printOpt("showLaborHours") || printOpt("showLaborTotal") || printOpt("showGrandTotal") || printOpt("showCosts")) ? `<section class="section" data-print-item="Parts and Labor Summary">
          <div class="summaryTitle">Parts and Labor Summary</div>
          ${printOpt("showParts") ? `<div class="miniTitle">Parts Used</div>
          <table class="data-table">
            <thead><tr><th style="width:50%">Description</th><th style="width:13%" class="center">Quantity</th>${printOpt("showPartsUnitPrice") ? `<th style="width:18%" class="right">Unit Price</th>` : ""}${printOpt("showPartsLineTotal") ? `<th style="width:19%" class="right">Total</th>` : ""}</tr></thead>
            <tbody>
              ${partsUsed.length>0 ? partsUsed.map(part=>{ const q=+(part.qty||1); const u=+(part.unitCost||0); return `<tr><td>${h(part.name || part.description || "—")}</td><td class="center">${h(q)} ${h(part.unit||"ea")}</td>${printOpt("showPartsUnitPrice") ? `<td class="right">${money(u)}</td>` : ""}${printOpt("showPartsLineTotal") ? `<td class="right">${money(q*u)}</td>` : ""}</tr>`; }).join("") : `<tr><td colspan="${2 + (printOpt("showPartsUnitPrice") ? 1 : 0) + (printOpt("showPartsLineTotal") ? 1 : 0)}" style="color:#64748b;font-style:italic">No parts listed</td></tr>`}
              ${printOpt("showPartsSubtotal") ? `<tr class="subRow"><td colspan="${2 + (printOpt("showPartsUnitPrice") ? 1 : 0) + (printOpt("showPartsLineTotal") ? 1 : 0)}">Parts Subtotal: ${money(partsTotal)}</td></tr>` : ""}
            </tbody>
          </table>` : ""}

          ${printOpt("showOutsideServices") ? `<div class="miniTitle" data-print-item="Outside Services Table">Outside Services</div>
          <table class="data-table">
            <thead><tr><th style="width:50%">Service Description</th><th style="width:13%" class="center">Quantity</th>${printOpt("showOutsideServicesUnitPrice") ? `<th style="width:18%" class="right">Unit Cost</th>` : ""}${printOpt("showOutsideServicesLineTotal") ? `<th style="width:19%" class="right">Total</th>` : ""}</tr></thead>
            <tbody>
              ${outsideServices.length>0 ? outsideServices.map(svc=>{ const q=+(svc.qty||1); const u=+(svc.unitCost ?? svc.cost ?? 0); return `<tr><td>${h(svc.description || svc.name || "—")}</td><td class="center">${h(q)}</td>${printOpt("showOutsideServicesUnitPrice") ? `<td class="right">${money(u)}</td>` : ""}${printOpt("showOutsideServicesLineTotal") ? `<td class="right">${money(q*u)}</td>` : ""}</tr>`; }).join("") : `<tr><td colspan="${2 + (printOpt("showOutsideServicesUnitPrice") ? 1 : 0) + (printOpt("showOutsideServicesLineTotal") ? 1 : 0)}" style="color:#64748b;font-style:italic">No outside services listed</td></tr>`}
              ${printOpt("showOutsideServicesSubtotal") ? `<tr class="subRow"><td colspan="${2 + (printOpt("showOutsideServicesUnitPrice") ? 1 : 0) + (printOpt("showOutsideServicesLineTotal") ? 1 : 0)}">Outside Services Subtotal: ${money(outsideServicesSubtotal)}</td></tr>` : ""}
            </tbody>
          </table>` : ""}

          ${(printOpt("showLaborHours") || printOpt("showLaborTotal")) ? `<div class="miniTitle" data-print-item="Labor Table">Labor</div>
          <table class="data-table">
            <thead><tr><th style="width:63%">Work Performed</th>${printOpt("showLaborHours") ? `<th style="width:15%" class="center">Hours</th>` : ""}${printOpt("showLaborTotal") ? `<th style="width:22%" class="right">Total</th>` : ""}</tr></thead>
            <tbody><tr><td>${h(wo.laborDescription || wo.laborTask || "Diagnosis and Repair")}</td>${printOpt("showLaborHours") ? `<td class="center">${laborHoursTotal.toFixed(1)}</td>` : ""}${printOpt("showLaborTotal") ? `<td class="right">${money(laborTotal)}</td>` : ""}</tr></tbody>
          </table>` : ""}
          ${printOpt("showGrandTotal") ? `<div class="grandTotal"><div>Grand Total</div><div>${money(grandTotal)}</div></div>` : ""}
        </section>` : ""}

        ${printOpt("showFooterText") && ws.footerText ? `<section class="section"><div class="section-title">Remarks</div><div class="textBlock">${h(ws.footerText)}</div></section>` : ""}
        ${printOpt("showSignature") ? `<div class="signatureGrid">
          <div><div class="sigValue">&nbsp;</div><div class="sigLine"><div class="sigLabel">Signature</div></div></div>
          <div><div class="sigValue">${h(assignedMechanicName)||"&nbsp;"}</div><div class="sigLine"><div class="sigLabel">Printed Name</div></div></div>
          <div><div class="sigValue">${h(printedDate)||"&nbsp;"}</div><div class="sigLine"><div class="sigLabel">Date</div></div></div>
        </div>` : ""}
      </div>
    </div>

    <div class="pbtn">
      <button class="printBtn" onclick="window.print()">Print / Save PDF</button>
      <a class="fileBtn" href="${woCsv}" download="work-order-${h(wo.id)}.csv">Download Excel CSV</a>
      <button class="fileBtn" onclick="var blob=new Blob([document.documentElement.outerHTML],{type:'application/msword'});var a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='work-order-${h(wo.id)}.doc';a.click();URL.revokeObjectURL(a.href);">Download Word</button>
    </div>
    ${printCustomizePanelHtml(wo.woType || "WorkOrder")}
    </body></html>`);
    win.document.close();
    win.focus();
  };

  /* ---- Tech dropdown ---- */
  /* ---- WO form fields ---- */
  const renderWOForm = () => {
    const needsInterval = form.woType==="Service" || form.woType==="Inspection";
    const typeInfo = WO_TYPES.find(t=>t.id===form.woType);
    const techObj = technicians.find(t=>t.id===form.techId);
    const TypeSection = ({ title, subtitle, accent, children }) => (
      <div style={{ gridColumn:"span 2", marginBottom:14, border:`1px solid ${accent||T.border}`, borderRadius:10, padding:14, background:T.card }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:10, marginBottom:10 }}>
          <div>
            <div style={{ fontFamily:T.sans, fontSize:12, fontWeight:800, color:accent||T.text, textTransform:"uppercase", letterSpacing:.5 }}>{title}</div>
            {subtitle && <div style={{ fontFamily:T.sans, fontSize:12, color:T.muted, marginTop:3 }}>{subtitle}</div>}
          </div>
          {typeInfo && <span style={{ padding:"3px 9px", borderRadius:999, background:typeInfo.bg, color:typeInfo.color, fontFamily:T.sans, fontSize:11, fontWeight:800 }}>{typeInfo.icon} {typeInfo.id}</span>}
        </div>
        {children}
      </div>
    );
    return (
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"0 16px" }}>

        <div style={{ gridColumn:"span 2", marginBottom:10, padding:"10px 12px", border:`1px solid ${T.border}`, borderRadius:8, background:T.grayLt, fontFamily:T.sans, fontSize:13, fontWeight:700, color:T.text }}>Work Order Type: {typeInfo?.label || `${form.woType||"Repair"} Work Order`}</div>

        <Field label="Equipment Status" half>
          <select style={{...sel, minWidth:260, width:"100%"}} value={form.equipmentStatus||"Fully Operational"} onChange={e=>setForm(f=>({...f,equipmentStatus:e.target.value}))}>
            {["Fully Operational","Operational with Deficiencies","Out of Service / Deadline"].map(s=><option key={s}>{s}</option>)}
          </select>
        </Field>

        <Field label="Priority" half>
          <select style={sel} value={form.priority||"Medium"} onChange={e=>setForm(f=>({...f,priority:e.target.value}))}>
            {["High","Medium","Low"].map(p=><option key={p}>{p}</option>)}
          </select>
        </Field>

        <div style={{ gridColumn:"span 2", marginBottom:14, border:`1px solid ${T.border}`, borderRadius:8, padding:12, background:T.card }}>
          <label style={{ display:"block", fontFamily:T.sans, fontSize:12, fontWeight:700, color:T.subtext, marginBottom:6 }}>Description <span style={{ color:T.red }}>*</span></label>
          <textarea style={{ ...inp, minHeight:90, resize:"vertical", background:T.card }} value={form.faultDescription||""} onChange={e=>setForm(f=>({...f,faultEnabled:true,faultDescription:e.target.value}))} placeholder="Describe the problem, complaint, symptom, or failure..." />
        </div>

        <div style={{ gridColumn:"span 2", marginBottom:14, border:`1px solid ${T.border}`, borderRadius:8, padding:12, background:T.grayLt }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:10, marginBottom:8 }}>
            <div style={{ fontFamily:T.sans, fontSize:12, fontWeight:700, color:T.text }}>Current Usage at Work Order <span style={{ color:T.red }}>*</span></div>
            <label style={{ display:"flex", alignItems:"center", gap:6, fontFamily:T.sans, fontSize:12, fontWeight:700, color:T.subtext, cursor:"pointer" }}>
              <input type="checkbox" checked={!!form.usageNA} onChange={e=>setForm(f=>({...f,usageNA:e.target.checked,usageHours:e.target.checked?"":f.usageHours,usageMileage:e.target.checked?"":f.usageMileage}))} /> N/A
            </label>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, opacity:form.usageNA ? .65 : 1 }}>
            <div>
              <label style={{ display:"block", fontFamily:T.sans, fontSize:11, fontWeight:600, color:T.muted, marginBottom:4 }}>Current Hours</label>
              <input style={inp} disabled={!!form.usageNA} type="number" step="0.1" value={form.usageHours||""} onChange={e=>setForm(f=>({...f,usageHours:e.target.value}))} placeholder="Enter current hours" />
            </div>
            <div>
              <label style={{ display:"block", fontFamily:T.sans, fontSize:11, fontWeight:600, color:T.muted, marginBottom:4 }}>Current Mileage</label>
              <input style={inp} disabled={!!form.usageNA} type="number" step="1" value={form.usageMileage||""} onChange={e=>setForm(f=>({...f,usageMileage:e.target.value}))} placeholder="Enter current mileage" />
            </div>
          </div>
          <div style={{ fontFamily:T.sans, fontSize:11, color:T.muted, marginTop:6 }}>If this equipment has no usage tracking selected, enter the reading here for the WO record, or select N/A when there is truly no hour/mileage value.</div>
        </div>

        <Field label={form.woType==="Service" ? "Service Description / Work Performed" : "Work Description / Problem Reported"}>
          <textarea style={{ ...inp, minHeight:110, resize:"vertical" }} value={form.description||""} onChange={e=>setForm(f=>({...f,description:e.target.value}))} />
        </Field>

        <Field label="Mechanic Notes">
          <textarea style={{ ...inp, minHeight:110, resize:"vertical" }} value={form.mechanicNotes||""} onChange={e=>setForm(f=>({...f,mechanicNotes:e.target.value}))} placeholder="Mechanic observations, steps taken, findings..." />
        </Field>

        {form.woType === "Inspection" && (
          <div
            onClick={(e)=>e.stopPropagation()}
            onKeyDown={(e)=>e.stopPropagation()}
            style={{ gridColumn:"span 2", marginBottom:14, border:`1px solid ${T.border}`, borderRadius:8, padding:12, background:T.card }}
          >
            <div style={{ fontFamily:T.sans, fontSize:12, fontWeight:800, color:T.text, textTransform:"uppercase", letterSpacing:.5, marginBottom:8 }}>Inspection Checklist Results</div>
            <div style={{ fontFamily:T.sans, fontSize:12, color:T.muted, marginBottom:10 }}>Mark Pass or Fail for each inspection step. Comments are useful when a step fails.</div>
            {(() => {
              const rows = Array.isArray(form.inspectionStepResults) && form.inspectionStepResults.length
                ? form.inspectionStepResults
                : String(form.inspectionSteps || form.workPerformed || "").split(/\n+/).map((step,i)=>({ id:`step-${i}`, step:step.trim(), result:"", comment:"" })).filter(x=>x.step);
              const setInspectionRow = (idx, changes) => {
                const next = rows.map((r,i)=>i===idx?{...r,...changes}:r);
                setForm(f=>({...f, inspectionStepResults:next}));
              };
              if(!rows.length) return <div style={{ color:T.muted, fontFamily:T.sans, fontSize:13 }}>No inspection steps recorded.</div>;
              return <div style={{ display:"grid", gap:8 }}>
                {rows.map((r,i)=>(
                  <div key={r.id||i} style={{ display:"grid", gridTemplateColumns:"minmax(220px,1fr) 90px 90px minmax(180px,.8fr)", gap:8, alignItems:"center", padding:8, border:`1px solid ${T.border}`, borderRadius:8, background:T.grayLt }}>
                    <div style={{ fontFamily:T.sans, fontSize:13 }}><b>{i+1}.</b> {r.step}</div>
                    <button type="button" onClick={(e)=>{ e.stopPropagation(); setInspectionRow(i,{result:"Pass"}); }} style={{...inp, padding:"7px 10px", background:r.result==="Pass"?"#dcfce7":"#fff", borderColor:r.result==="Pass"?"#16a34a":T.border, fontWeight:700}}>Pass</button>
                    <button type="button" onClick={(e)=>{ e.stopPropagation(); setInspectionRow(i,{result:"Fail"}); }} style={{...inp, padding:"7px 10px", background:r.result==="Fail"?"#fee2e2":"#fff", borderColor:r.result==="Fail"?"#dc2626":T.border, fontWeight:700}}>Fail</button>
                    <input style={inp} value={r.comment||""} onClick={e=>e.stopPropagation()} onKeyDown={e=>e.stopPropagation()} onChange={e=>setInspectionRow(i,{comment:e.target.value})} placeholder="Comment if failed" />
                  </div>
                ))}
              </div>;
            })()}
          </div>
        )}

        {/* Parts */}
        <div style={{ gridColumn:"span 2", marginBottom:14, border:`1px solid ${T.border}`, borderRadius:8, padding:12, background:T.grayLt }}>
          <label style={{ display:"block", fontFamily:T.sans, fontSize:12, fontWeight:700, color:T.text, marginBottom:8 }}>Parts</label>
          {(form.partsUsed||[]).map((p,idx)=>(
            <div key={idx}>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 64px 96px 90px auto auto", gap:8, marginBottom:4, alignItems:"center" }}>
                <div style={{ position:"relative" }}>
                  <input style={inp} placeholder="Part name or pick from inventory..." value={p.name||""} onChange={e=>setForm(f=>{ const arr=[...(f.partsUsed||[])]; arr[idx]={...arr[idx],name:e.target.value,partSearch:e.target.value,partId:undefined,availableQty:undefined,partNumber:undefined}; return {...f,partsUsed:arr}; })} />
                  {p.partId && <span style={{ position:"absolute", right:8, top:"50%", transform:"translateY(-50%)", fontFamily:T.mono, fontSize:9, color:T.green }}>inv</span>}
                </div>
                <input style={{ ...inp, textAlign:"center" }} type="number" min="1" placeholder="Qty" value={p.qty||""} onChange={e=>setForm(f=>{ const arr=[...(f.partsUsed||[])]; arr[idx]={...arr[idx],qty:e.target.value}; return {...f,partsUsed:arr}; })} />
                <select style={sel} value={p.unit||"ea"} onChange={e=>handleUnitSelectChange(e.target.value, p.unit||"ea", v=>setForm(f=>{ const arr=[...(f.partsUsed||[])]; arr[idx]={...arr[idx],unit:v}; return {...f,partsUsed:arr}; }))}>
                  {getUnitOptionsFromState(state).map(u=><option key={u} value={u}>{u}</option>)}
                  <option value="__new_unit__">+ Add new...</option>
                </select>
                <input style={inp} type="number" min="0" step="0.01" placeholder="Unit $" value={p.unitCost||""} onChange={e=>setForm(f=>{ const arr=[...(f.partsUsed||[])]; arr[idx]={...arr[idx],unitCost:e.target.value}; return {...f,partsUsed:arr}; })} />
                <button onClick={()=>setShowNewPart(showNewPart===idx?null:idx)} style={{ padding:"6px 8px", border:`1px solid ${T.border}`, borderRadius:6, background:T.grayLt, cursor:"pointer", fontFamily:T.sans, fontSize:11, fontWeight:600, color:T.accent, whiteSpace:"nowrap" }}>
                  {showNewPart===idx?"Close":"Inventory"}
                </button>
                <button onClick={()=>setForm(f=>{ const arr=[...(f.partsUsed||[])]; arr.splice(idx,1); return {...f,partsUsed:arr}; })} style={{ padding:"6px 10px", border:`1px solid ${T.red}`, borderRadius:6, background:"none", color:T.red, cursor:"pointer", fontFamily:T.sans, fontSize:12, fontWeight:600 }}>X</button>
              </div>
              {p.partId && (
                <div style={{ fontFamily:T.sans, fontSize:11, color:(+p.qty||0)>(+p.availableQty||0)?T.red:T.green, margin:"0 0 6px 2px", fontWeight:600 }}>
                  Inventory selected{p.partNumber?` • #${p.partNumber}`:""} • Available: {p.availableQty ?? 0} {p.unit||"ea"}{(+p.qty||0)>(+p.availableQty||0)?" • Not enough stock":""}
                </div>
              )}
              {showNewPart===idx && (
                <div style={{ background:T.grayLt, border:`1px solid ${T.border}`, borderRadius:8, padding:"10px 12px", marginBottom:8 }}>
                  <div style={{ fontFamily:T.sans, fontSize:12, fontWeight:700, color:T.text, marginBottom:8 }}>Pick from Inventory</div>
                  <div style={{ display:"flex", flexDirection:"column", gap:4, maxHeight:160, overflowY:"auto", marginBottom:10 }}>
                    {/* Model-matched parts first */}
                    {(() => {
                      const eq = state.equipment.find(e=>e.id===form.equipment);
                      const eqKey = `${eq?.make||""} ${eq?.model||""}`.trim().toLowerCase();
                      const search = String(p.partSearch || p.name || "").trim().toLowerCase();
                      const inStock = (state.parts||[]).filter(pt=>(+pt.qty||0)>0);
                      const searchable = inStock.filter(pt=>{
                        if(!search) return true;
                        return `${pt.name||""} ${pt.partNumber||""} ${pt.category||""} ${pt.vendor||""} ${pt.modelFit||""}`.toLowerCase().includes(search);
                      });
                      const matched = searchable.filter(pt=>pt.modelFit&&eqKey&&pt.modelFit.toLowerCase().split(",").some(m=>eqKey.includes(m.trim().toLowerCase())||m.trim().toLowerCase().includes(eqKey)));
                      const other   = searchable.filter(pt=>!matched.find(m=>m.id===pt.id));
                      const setPartSearch = (value) => setForm(f=>{ const arr=[...(f.partsUsed||[])]; arr[idx]={...arr[idx],partSearch:value,name:value,partId:undefined,availableQty:undefined,partNumber:undefined}; return {...f,partsUsed:arr}; });
                      const renderRow = (pt, highlight) => (
                        <button key={pt.id} onClick={()=>{ addPartFromInventory(pt,idx); setShowNewPart(null); }} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"6px 10px", background:highlight?"#f0fdf4":"#fff", border:`1px solid ${highlight?"#86efac":T.border}`, borderRadius:6, cursor:"pointer", textAlign:"left", fontFamily:T.sans, fontSize:12 }}>
                          <span><b>{pt.name}</b> <span style={{ color:T.muted, fontSize:11 }}>{pt.partNumber?`#${pt.partNumber}`:"No part #"}</span> {highlight&&<span style={{ color:T.green, fontSize:10, fontWeight:700 }}>Model Match</span>}</span>
                          <span style={{ color:T.green, fontFamily:T.mono, fontSize:11, marginLeft:8, flexShrink:0 }}>Qty:{pt.qty} {pt.unit||"ea"} | ${pt.unitCost||0}</span>
                        </button>
                      );
                      return (<>
                        <input style={{...inp, marginBottom:8}} placeholder="Search inventory by part name, part #, category, vendor, or model..." value={p.partSearch || p.name || ""} onChange={e=>setPartSearch(e.target.value)} autoFocus />
                        {matched.length>0&&<div style={{ fontFamily:T.sans, fontSize:10, fontWeight:700, color:T.green, textTransform:"uppercase", letterSpacing:.5, padding:"2px 0" }}>Model-Specific Parts</div>}
                        {matched.map(pt=>renderRow(pt,true))}
                        {other.length>0&&matched.length>0&&<div style={{ fontFamily:T.sans, fontSize:10, fontWeight:700, color:T.muted, textTransform:"uppercase", letterSpacing:.5, padding:"4px 0 2px" }}>All Other Parts</div>}
                        {other.map(pt=>renderRow(pt,false))}
                        {inStock.length===0&&<div style={{ color:T.muted, fontSize:12, fontFamily:T.sans }}>No parts in stock.</div>}
                        {inStock.length>0&&searchable.length===0&&<div style={{ color:T.muted, fontSize:12, fontFamily:T.sans }}>No inventory parts match that search.</div>}
                      </>);
                    })()}
                  </div>
                  <div style={{ fontFamily:T.sans, fontSize:12, fontWeight:700, color:T.text, marginBottom:6 }}>Or Add New Part to Inventory</div>
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 80px 80px 90px 80px", gap:6, marginBottom:6 }}>
                    <input style={inp} placeholder="Part name*" value={newPartForm.name||""} onChange={e=>setNewPartForm(f=>({...f,name:e.target.value}))} />
                    <input style={inp} placeholder="Part number" value={newPartForm.partNumber||""} onChange={e=>setNewPartForm(f=>({...f,partNumber:e.target.value}))} />
                    <input style={inp} placeholder="Stock" type="number" value={newPartForm.qty||""} onChange={e=>setNewPartForm(f=>({...f,qty:e.target.value}))} />
                    <input style={inp} placeholder="Min" type="number" value={newPartForm.minQty||""} onChange={e=>setNewPartForm(f=>({...f,minQty:e.target.value}))} />
                    <select style={sel} value={newPartForm.unit||"ea"} onChange={e=>handleUnitSelectChange(e.target.value, newPartForm.unit||"ea", v=>setNewPartForm(f=>({...f,unit:v})))}>{getUnitOptionsFromState(state).map(u=><option key={u} value={u}>{u}</option>)}<option value="__new_unit__">+ Add new...</option></select>
                    <input style={inp} placeholder="$/unit" type="number" step="0.01" value={newPartForm.unitCost||""} onChange={e=>setNewPartForm(f=>({...f,unitCost:e.target.value}))} />
                  </div>
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr auto", gap:6 }}>
                    <input style={inp} list="wo-part-category-options" placeholder="Category" value={newPartForm.category||""} onChange={e=>setNewPartForm(f=>({...f,category:e.target.value}))} />
                    <datalist id="wo-part-category-options">{partCategories.map(c=><option key={c} value={c} />)}</datalist>
                    <input style={inp} placeholder="Vendor" value={newPartForm.vendor||""} onChange={e=>setNewPartForm(f=>({...f,vendor:e.target.value}))} />
                    <input style={inp} list="equipment-model-options" placeholder="Fits model (optional)" value={newPartForm.modelFit||""} onChange={e=>setNewPartForm(f=>({...f,modelFit:e.target.value}))} />
                    <datalist id="equipment-model-options">{getEquipmentModelOptions(state.equipment).map(m=><option key={m} value={m} />)}</datalist>
                    <Btn small onClick={()=>addNewPartToInventory(idx)}>Add & Use</Btn>
                  </div>
                </div>
              )}
            </div>
          ))}
          <button onClick={()=>setForm(f=>({...f,partsUsed:[...(f.partsUsed||[]),{name:"",qty:1,unit:"ea",unitCost:""}]}))} style={{ background:"none", border:`1px dashed ${T.borderHi}`, borderRadius:6, padding:"7px 16px", color:T.accent, cursor:"pointer", fontFamily:T.sans, fontSize:12, fontWeight:600, width:"100%" }}>
            + Add Part
          </button>
        </div>



        {/* Outside Services */}
        <div style={{ gridColumn:"span 2", marginBottom:14, border:`1px solid ${T.border}`, borderRadius:8, padding:12, background:T.grayLt }}>
          <label style={{ display:"block", fontFamily:T.sans, fontSize:12, fontWeight:700, color:T.text, marginBottom:8 }}>Outside Services</label>
          <div style={{ fontFamily:T.sans, fontSize:11, color:T.muted, marginBottom:8 }}>Use this for outsourced services like DPF cleaning, tire mounting, machine work, welding, hydraulic hose fabrication, or vendor repairs.</div>
          {(form.outsideServices||[]).map((svc,idx)=>(
            <div key={idx} style={{ display:"grid", gridTemplateColumns:"1fr 80px 110px 110px auto", gap:8, marginBottom:8, alignItems:"center" }}>
              <input style={inp} placeholder="Service description..." value={svc.description||svc.name||""} onChange={e=>setForm(f=>{ const arr=[...(f.outsideServices||[])]; arr[idx]={...arr[idx],description:e.target.value}; return {...f,outsideServices:arr}; })} />
              <input style={{ ...inp, textAlign:"center" }} type="number" min="1" step="0.01" placeholder="Qty" value={svc.qty||""} onChange={e=>setForm(f=>{ const arr=[...(f.outsideServices||[])]; arr[idx]={...arr[idx],qty:e.target.value}; return {...f,outsideServices:arr}; })} />
              <input style={inp} type="number" min="0" step="0.01" placeholder="Unit Cost" value={svc.unitCost ?? svc.cost ?? ""} onChange={e=>setForm(f=>{ const arr=[...(f.outsideServices||[])]; arr[idx]={...arr[idx],unitCost:e.target.value}; return {...f,outsideServices:arr}; })} />
              <div style={{ fontFamily:T.mono, fontSize:12, fontWeight:700, color:T.text, textAlign:"right" }}>${lineItemTotal(svc).toFixed(2)}</div>
              <button onClick={()=>setForm(f=>{ const arr=[...(f.outsideServices||[])]; arr.splice(idx,1); return {...f,outsideServices:arr}; })} style={{ padding:"6px 10px", border:`1px solid ${T.red}`, borderRadius:6, background:"none", color:T.red, cursor:"pointer", fontFamily:T.sans, fontSize:12, fontWeight:600 }}>X</button>
            </div>
          ))}
          <button onClick={()=>setForm(f=>({...f,outsideServices:[...(f.outsideServices||[]),{description:"",qty:1,unitCost:""}]}))} style={{ background:"none", border:`1px dashed ${T.borderHi}`, borderRadius:6, padding:"7px 16px", color:T.accent, cursor:"pointer", fontFamily:T.sans, fontSize:12, fontWeight:600, width:"100%" }}>
            + Add Outside Service
          </button>
        </div>

        {/* Mechanic inline */}
        <div style={{ gridColumn:"span 2", marginBottom:0 }}>
          <label style={{ display:"block", fontFamily:T.sans, fontSize:12, fontWeight:600, color:T.subtext, marginBottom:5 }}>Mechanic</label>
          {defaultMechanic ? (
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:10, background:T.grayLt, border:`1px solid ${T.border}`, borderRadius:8, padding:"10px 12px" }}>
              <div>
                <div style={{ fontFamily:T.sans, fontSize:13, fontWeight:800, color:T.text }}>{form.tech || defaultMechanic.name}</div>
                <div style={{ fontFamily:T.sans, fontSize:11, color:T.muted }}>Only mechanic created — automatically assigned to this work order.</div>
              </div>
              <div style={{ fontFamily:T.mono, fontSize:11, color:T.muted, whiteSpace:"nowrap" }}>Rate: ${defaultMechanic.laborRate||0}/hr</div>
            </div>
          ) : (
            <>
              <div style={{ display:"flex", gap:8, alignItems:"flex-start", flexWrap:"wrap" }}>
                <select style={{ ...sel, flex:1, minWidth:180 }} value={form.techId||""} onChange={e=>{ if(e.target.value==="__new__"){ setShowNewTech(true); } else { selectTech(e.target.value); setShowNewTech(false); } }}>
                  <option value="">-- Select Mechanic --</option>
                  {technicians.map(t=><option key={t.id} value={t.id}>{t.name}{t.laborRate?` ($${t.laborRate}/hr)`:""}</option>)}
                  <option value="__new__">+ Add New Mechanic...</option>
                </select>
                {form.techId && <div style={{ fontFamily:T.mono, fontSize:11, color:T.muted, paddingTop:8 }}>Rate: ${technicians.find(t=>t.id===form.techId)?.laborRate||0}/hr</div>}
              </div>
              {technicians.length > 1 && !form.techId && (
                <div style={{ fontFamily:T.sans, fontSize:11, color:T.orange, marginTop:5, fontWeight:700 }}>Multiple mechanics found — choose who is assigned to this work order.</div>
              )}
            </>
          )}
          {showNewTech && !defaultMechanic && (
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




      </div>
    );
  };

  /* WO Detail render function - avoids remount */
  const renderWODetail = (wo) => {
    if(!wo) return null;
    const eq = state.equipment.find(e=>e.id===wo.equipment);
    const typeInfo = WO_TYPES.find(t=>t.id===wo.woType);
    const partsUsed = wo.partsUsed||[];
    const partsTotal = partsUsed.reduce((s,p)=>s+lineItemTotal(p),0);
    const outsideServices = wo.outsideServices||[];
    const outsideServicesSubtotal = outsideServicesTotal(outsideServices);
    const total = (+wo.laborCost||0)+partsTotal+outsideServicesSubtotal;
    const isCompleted = wo.status==="Completed";

    const completeWO = () => {
      if(!confirmWOStatusChange(wo, "Completed")) return;
      const completedDate = today();
      const updated = { ...wo, status:"Completed", equipmentStatus:"Fully Operational", completed:completedDate, completedDate:completedDate };
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
            {wo.serviceInterval && wo.woType!=="Repair" && <div style={{ fontFamily:T.mono, fontSize:11, color:T.accent, marginTop:2 }}>{wo.serviceInterval}</div>}
          </div>
          <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
            <Btn small variant="secondary" onClick={()=>printWO(wo)}>Print</Btn>
            <Btn small variant="danger" onClick={()=>del(wo.id)}>Delete</Btn>
            {!isCompleted && !editMode && <Btn small onClick={()=>setEditMode(true)} style={{ background:"#1e40af", borderColor:"#1e40af" }}>Update Work Order</Btn>}
            {!isCompleted && editMode && <Btn small onClick={()=>{ const payload={ ...wo, ...form }; if(payload.status!==wo.status && !confirmWOStatusChange(wo, payload.status)) return; dispatch({ type:"UPDATE_WO", payload }); setEditMode(false); setDetailWO(payload); }} style={{ background:T.green, borderColor:T.green }}>Save Changes</Btn>}
            {!isCompleted && editMode && <Btn small variant="secondary" onClick={()=>{ setEditMode(false); setForm({...wo, partsUsed:wo.partsUsed||[], outsideServices:wo.outsideServices||[]}); }}>Cancel Edit</Btn>}
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

        {wo.faultEnabled && (
          <div style={{ background:T.grayLt, borderRadius:6, padding:"10px 12px", border:`1px solid ${T.border}` }}>
            <div style={{ fontFamily:T.sans, fontSize:10, fontWeight:600, color:T.muted, textTransform:"uppercase", letterSpacing:.4, marginBottom:4 }}>Description</div>
            <div style={{ minHeight:70, fontFamily:T.sans, fontSize:13, color:wo.faultDescription?T.text:T.muted, lineHeight:1.6, fontStyle:wo.faultDescription?"normal":"italic" }}>{wo.faultDescription||"No description recorded."}</div>
          </div>
        )}

        {/* Description */}
        <div style={{ background:T.grayLt, borderRadius:6, padding:"10px 12px", border:`1px solid ${T.border}` }}>
          <div style={{ fontFamily:T.sans, fontSize:10, fontWeight:600, color:T.muted, textTransform:"uppercase", letterSpacing:.4, marginBottom:4 }}>{wo.woType==="Service" ? "Service Description & Work Performed" : "Work Description"}</div>
          <div style={{ minHeight:90, fontFamily:T.sans, fontSize:13, color:wo.description?T.text:T.muted, lineHeight:1.6, fontStyle:wo.description?"normal":"italic" }}>{wo.description||"No work description recorded."}</div>
        </div>


        {wo.woType==="Inspection" && (Array.isArray((editMode?form:wo).inspectionStepResults) || (wo.inspectionSteps||wo.workPerformed)) && (
          <div
            onClick={(e)=>e.stopPropagation()}
            onKeyDown={(e)=>e.stopPropagation()}
            style={{ border:`1px solid ${T.border}`, borderRadius:8, overflow:"hidden", background:T.card }}
          >
            <div style={{ background:T.text, color:"#fff", padding:"7px 12px", fontFamily:T.sans, fontSize:11, fontWeight:700, textTransform:"uppercase", letterSpacing:.6 }}>Inspection Checklist</div>
            <div style={{ display:"grid", gap:8, padding:10 }}>
              {(() => {
                const source = editMode ? form : wo;
                const rows = Array.isArray(source.inspectionStepResults) && source.inspectionStepResults.length
                  ? source.inspectionStepResults
                  : String(source.inspectionSteps||source.workPerformed||"").split(/\n+/).map((step,i)=>({ id:`step-${i}`, step:step.trim(), result:"", comment:"" })).filter(x=>x.step);
                const setRow = (idx, changes) => {
                  const next = rows.map((r,i)=>i===idx?{...r,...changes}:r);
                  setForm(f=>({...f, inspectionStepResults:next}));
                };
                return rows.length===0 ? <div style={{ color:T.muted, fontFamily:T.sans, fontSize:13 }}>No inspection steps recorded.</div> : rows.map((r,i)=>(
                  <div key={r.id||i} style={{ display:"grid", gridTemplateColumns:"minmax(220px,1fr) 90px 90px minmax(180px,.8fr)", gap:8, alignItems:"center", padding:8, border:`1px solid ${T.border}`, borderRadius:8, background:T.grayLt }}>
                    <div style={{ fontFamily:T.sans, fontSize:13 }}><b>{i+1}.</b> {r.step}</div>
                    {editMode ? <button type="button" onClick={()=>setRow(i,{result:"Pass"})} style={{...inp, padding:"7px 10px", background:r.result==="Pass"?"#dcfce7":"#fff", borderColor:r.result==="Pass"?"#16a34a":T.border, fontWeight:700}}>Pass</button> : <span style={{ fontWeight:700, color:r.result==="Pass"?T.green:r.result==="Fail"?T.red:T.muted }}>{r.result||"—"}</span>}
                    {editMode ? <button type="button" onClick={()=>setRow(i,{result:"Fail"})} style={{...inp, padding:"7px 10px", background:r.result==="Fail"?"#fee2e2":"#fff", borderColor:r.result==="Fail"?"#dc2626":T.border, fontWeight:700}}>Fail</button> : <span/>}
                    {editMode ? <input style={inp} value={r.comment||""} onClick={e=>e.stopPropagation()} onKeyDown={e=>e.stopPropagation()} onChange={e=>setRow(i,{comment:e.target.value})} placeholder="Comment if failed" /> : <span style={{ color:T.subtext }}>{r.comment||"—"}</span>}
                  </div>
                ));
              })()}
            </div>
          </div>
        )}


        {wo.woType==="Service" && (wo.meterReading||wo.nextServiceDue||wo.serviceChecklist) && (
          <div style={{ background:T.accentLt, borderRadius:6, padding:"10px 12px", border:`1px solid ${T.borderHi}` }}>
            <div style={{ fontFamily:T.sans, fontSize:10, fontWeight:700, color:T.accent, textTransform:"uppercase", letterSpacing:.4, marginBottom:6 }}>Service Block</div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, fontFamily:T.sans, fontSize:13, color:T.text }}>
              <div><b>Meter / Hours:</b><br />{wo.meterReading||"—"}</div>
              <div><b>Next Service Due:</b><br />{wo.nextServiceDue||"—"}</div>
              <div style={{ gridColumn:"span 2" }}><b>Service Checklist:</b><br />{wo.serviceChecklist||"—"}</div>
            </div>
          </div>
        )}

        {wo.woType==="Inspection" && (wo.inspectionResult||wo.followUpRequired||wo.inspectionFindings) && (
          <div style={{ background:T.greenLt, borderRadius:6, padding:"10px 12px", border:`1px solid ${T.borderHi}` }}>
            <div style={{ fontFamily:T.sans, fontSize:10, fontWeight:700, color:T.green, textTransform:"uppercase", letterSpacing:.4, marginBottom:6 }}>Inspection Block</div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, fontFamily:T.sans, fontSize:13, color:T.text }}>
              <div><b>Result:</b><br />{wo.inspectionResult||"—"}</div>
              <div><b>Follow-Up:</b><br />{wo.followUpRequired||"—"}</div>
              <div style={{ gridColumn:"span 2" }}><b>Findings:</b><br />{wo.inspectionFindings||"—"}</div>
            </div>
          </div>
        )}

        {/* Mechanic Notes */}
        <div style={{ background:T.grayLt, borderRadius:6, padding:"10px 12px", border:`1px solid ${T.border}` }}>
          <div style={{ fontFamily:T.sans, fontSize:10, fontWeight:600, color:T.muted, textTransform:"uppercase", letterSpacing:.4, marginBottom:4 }}>Mechanic Notes</div>
          <div style={{ minHeight:90, fontFamily:T.sans, fontSize:13, color:wo.mechanicNotes?T.text:T.muted, lineHeight:1.6, fontStyle:wo.mechanicNotes?"normal":"italic" }}>{wo.mechanicNotes||"No notes recorded."}</div>
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

          {outsideServices.length>0 && (
            <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13, fontFamily:T.sans, borderTop:`1px solid ${T.border}` }}>
              <thead><tr style={{ background:T.grayLt, borderBottom:`1px solid ${T.border}` }}>
                {["Outside Service","Qty","Unit Cost","Total"].map(h=><th key={h} style={{ padding:"6px 12px", textAlign:"left", fontSize:11, fontWeight:600, color:T.muted, textTransform:"uppercase" }}>{h}</th>)}
              </tr></thead>
              <tbody>
                {outsideServices.map((svc,i)=>(
                  <tr key={i} style={{ borderBottom:`1px solid ${T.border}`, background:i%2===0?"#fff":T.grayLt }}>
                    <td style={{ padding:"8px 12px", color:T.text, fontWeight:500 }}>{svc.description || svc.name || "Outside service"}</td>
                    <td style={{ padding:"8px 12px", fontFamily:T.mono, fontSize:12, color:T.subtext }}>{svc.qty || 1}</td>
                    <td style={{ padding:"8px 12px", fontFamily:T.mono, fontSize:12, color:T.subtext }}>${(+(svc.unitCost ?? svc.cost ?? 0)).toFixed(2)}</td>
                    <td style={{ padding:"8px 12px", fontFamily:T.mono, fontSize:12, fontWeight:600 }}>${lineItemTotal(svc).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {partsUsed.length===0 && outsideServices.length===0 && <div style={{ padding:"10px 12px", fontFamily:T.sans, fontSize:13, color:T.muted, fontStyle:"italic" }}>No parts or outside services recorded.</div>}
          <div style={{ background:T.grayLt, borderTop:`2px solid ${T.border}`, padding:"10px 14px", display:"flex", gap:24, flexWrap:"wrap" }}>
            {[["Labor ("+wo.laborHours+"hrs)",`$${(+wo.laborCost||0).toFixed(2)}`],["Parts",`$${partsTotal.toFixed(2)}`],["Outside Services",`$${outsideServicesSubtotal.toFixed(2)}`],["GRAND TOTAL",`$${total.toFixed(2)}`]].map(([k,v])=>(
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
          <div style={{ display:"flex", gap:0, background:T.card, border:`1px solid ${T.border}`, borderRadius:7, overflow:"hidden", flexWrap:"wrap" }}>
            {STATUS_TABS.map((s,i)=>(
              <button key={s} onClick={()=>setFilter(s)} style={{ padding:"7px 12px", border:"none", borderLeft:i>0?`1px solid ${T.border}`:"none", background:filter===s?T.accent:T.card, color:filter===s?"#fff":T.subtext, cursor:"pointer", fontFamily:T.sans, fontSize:11, fontWeight:filter===s?600:400 }}>{s}</button>
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
            {["Repair","Service","Inspection"].map(t=><option key={t}>{t}</option>)}
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
          {/* Equipment Status */}
          <select style={{ ...sel, width:280 }} value={equipmentStatusFilter} onChange={e=>setEquipmentStatusFilter(e.target.value)}>
            <option value="All">All Equipment Statuses</option>
            <option value="allAsc">{EQUIPMENT_STATUS_ALL_SORTS.allAsc}</option>
            <option value="allDesc">{EQUIPMENT_STATUS_ALL_SORTS.allDesc}</option>
            {EQUIPMENT_STATUS_FILTERS.map(s=><option key={s} value={s}>{s}</option>)}
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
              <option value="completed">Completed Date</option>
              <option value="priority">Priority</option>
              <option value="status">Work Order Status</option>
              <option value="equipmentStatus">Equipment Status</option>
              <option value="cost">Cost</option>
            </select>
            <button onClick={()=>setSortDir(d=>d==="asc"?"desc":"asc")} style={{ padding:"0 10px", border:"none", borderLeft:`1px solid ${T.border}`, background:T.grayLt, cursor:"pointer", fontFamily:T.mono, fontSize:13, color:T.subtext }}>
              {sortDir==="asc"?"↑":"↓"}
            </button>
          </div>
          {/* Clear filters */}
          {(typeFilter!=="All"||priorityFilter!=="All"||mechFilter!=="All"||equipmentStatusFilter!=="All") && (
            <button onClick={()=>{ setTypeFilter("All"); setPriorityFilter("All"); setMechFilter("All"); setEquipmentStatusFilter("All"); }} style={{ background:"none", border:"none", color:T.accent, fontFamily:T.sans, fontSize:12, fontWeight:600, cursor:"pointer" }}>✕ Clear</button>
          )}
          <span style={{ fontFamily:T.sans, fontSize:12, color:T.muted, marginLeft:"auto" }}>
            {filtered.length} work order{filtered.length!==1?"s":""}
          </span>
        </div>
      </div>

      {/* WO Table — click anywhere on row to edit */}
      <Card style={{ padding:0, overflow:"hidden" }}>
        <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13, fontFamily:T.sans }}>
          <thead>
            <tr style={{ background:T.grayLt, borderBottom:`1px solid ${T.border}` }}>
              {(filter==="Completed" ? ["Equipment #","Equipment Name","Description","Type of Work Order","Priority","Status","Created","Due","Completed Date","Cost","Actions"] : ["Equipment #","Equipment Name","Description","Type of Work Order","Priority","Status","Created","Due","Cost","Actions"]).map(h=>(
                <th key={h} style={{ padding:"10px 14px", textAlign:"left", fontWeight:600, fontSize:11, color:T.muted, textTransform:"uppercase", letterSpacing:.4, whiteSpace:"nowrap" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((wo,i)=>{
              const eq = state.equipment.find(e=>e.id===wo.equipment);
              const eqLabel = eq?.name || wo.equipmentLabel || wo.equipment || "—";
              const partsTotal = (wo.partsUsed||[]).reduce((s,p)=>s+(+(p.qty||1))*(+(p.unitCost||0)),0);
              const total = (+wo.laborCost||0)+partsTotal;
              const typeInfo = WO_TYPES.find(t=>t.id===wo.woType);
              const rowStatus = wo.status==="Completed" ? "Fully Operational" : (wo.equipmentStatus || eq?.status || "Fully Operational");
              const isOpenInspection = wo.woType==="Inspection" && wo.status!=="Completed";
              // Keep work order rows neutral in dark/light mode. Equipment status is shown only by the small left color tab.
              const rowBg = isDarkMode ? (i%2===0 ? T.card : T.grayLt) : (i%2===0 ? "#fff" : T.grayLt);
              const rowHover = isDarkMode ? T.accentLt : T.grayLt;
              const rowBorder = isOpenInspection ? "4px solid #7dd3fc" : rowStatus==="Out of Service / Deadline" ? "4px solid #ef4444" : rowStatus==="Operational with Deficiencies" ? "4px solid #f59e0b" : "4px solid transparent";
              const completedDate = wo.completed || wo.completedDate || wo.dateCompleted || wo.closedDate || wo.closedAt || wo.completedAt || "";
              return (
                <tr key={wo.id} onClick={()=>openEdit(wo)} style={{ borderBottom:`1px solid ${T.border}`, borderLeft:rowBorder, background:rowBg, cursor:"pointer", transition:"background .12s" }}
                  onMouseEnter={e=>e.currentTarget.style.background=rowHover}
                  onMouseLeave={e=>e.currentTarget.style.background=rowBg}>
                  <td style={{ padding:"11px 14px", fontFamily:T.mono, fontSize:12, color:T.subtext, whiteSpace:"nowrap" }}>{wo.equipment || "—"}</td>
                  <td style={{ padding:"11px 14px", color:T.subtext, whiteSpace:"nowrap" }}>
                    <div style={{ fontWeight:600, color:T.text }}>{eqLabel}</div>
                    {wo.parentName && <div style={{ fontSize:11, color:T.muted }}>on: {wo.parentName}</div>}
                  </td>
                  <td style={{ padding:"11px 14px", minWidth:220 }}>
                    <div style={{ fontWeight:500, color:T.text }}>{wo.faultDescription || wo.description || wo.title || "—"}</div>
                    {wo.serviceInterval && <div style={{ fontSize:11, color:T.accent, marginTop:1 }}>{wo.serviceInterval}</div>}
                  </td>
                  <td style={{ padding:"11px 14px" }}>
                    {typeInfo ? <span style={{ display:"inline-flex", alignItems:"center", gap:4, padding:"2px 8px", borderRadius:4, background:typeInfo.bg, color:typeInfo.color, fontSize:11, fontWeight:600 }}>{typeInfo.icon} {typeInfo.label || typeInfo.id}</span> : <span style={{ color:T.muted }}>Repair Work Order</span>}
                  </td>
                  <td style={{ padding:"11px 14px" }}><Badge label={wo.priority} type="priority" /></td>
                  <td style={{ padding:"11px 14px" }}><Badge label={wo.status} /></td>
                  <td style={{ padding:"11px 14px", fontFamily:T.mono, fontSize:12, color:T.subtext, whiteSpace:"nowrap" }}>{wo.created||"—"}</td>
                  <td style={{ padding:"11px 14px", fontFamily:T.mono, fontSize:12, color:wo.due&&wo.due<today()&&wo.status!=="Completed"?T.red:T.subtext, whiteSpace:"nowrap" }}>{wo.due}</td>
                  {filter==="Completed" && (
                    <td style={{ padding:"11px 14px", fontFamily:T.mono, fontSize:12, color:T.green, fontWeight:700, whiteSpace:"nowrap" }}>{completedDate || "—"}</td>
                  )}
                  <td style={{ padding:"11px 14px", fontFamily:T.mono, fontSize:12, color:T.subtext, whiteSpace:"nowrap" }}>{total>0?`$${total.toFixed(0)}`:"—"}</td>
                  <td style={{ padding:"4px 10px", whiteSpace:"nowrap", display:"flex", gap:6, alignItems:"center" }} onClick={e=>e.stopPropagation()}>
                    <select title="Change Work Order Status" value={wo.status||"Open"} onChange={e=>quickUpdateWO(wo,{status:e.target.value})} style={{ ...sel, width:145, minWidth:145, padding:"7px 10px", fontSize:12 }}>
                      {WO_STATUS_OPTIONS.map(s=><option key={s}>{s}</option>)}
                    </select>
                    <select title="Change Equipment Status" value={wo.status==="Completed"?"Fully Operational":(wo.equipmentStatus||eq?.status||"Fully Operational")} onChange={e=>quickUpdateWO(wo,{equipmentStatus:e.target.value})} disabled={wo.status==="Completed"} style={{ ...sel, width:240, minWidth:240, padding:"7px 10px", fontSize:12, opacity:wo.status==="Completed" ? .65 : 1 }}>
                      {["Fully Operational","Operational with Deficiencies","Out of Service / Deadline"].map(s=><option key={s}>{s}</option>)}
                    </select>
                    <button
                      title="Edit Work Order"
                      onClick={e=>{ e.stopPropagation(); openEdit(wo); }}
                      style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:6, padding:"5px 9px", cursor:"pointer", fontSize:13, color:T.subtext, display:"inline-flex", alignItems:"center", justifyContent:"center" }}>
                      ✏️
                    </button>
                    <button
                      title="Print Work Order"
                      onClick={e=>{ e.stopPropagation(); printWO(wo); }}
                      style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:6, padding:"5px 9px", cursor:"pointer", fontSize:14, color:T.subtext, display:"inline-flex", alignItems:"center", justifyContent:"center" }}>
                      🖨
                    </button>
                    <button
                      title="Delete Work Order"
                      onClick={e=>{ e.stopPropagation(); del(wo.id); }}
                      style={{ background:T.redLt, border:`1px solid ${T.red}`, borderRadius:6, padding:"5px 9px", cursor:"pointer", fontSize:14, color:T.red, display:"inline-flex", alignItems:"center", justifyContent:"center" }}>
                      🗑
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
        <Modal title={`Edit Work Order — ${form.id}`} onClose={()=>setModal(null)}>
          <div style={{ background:T.grayLt, border:`1px solid ${T.border}`, borderRadius:8, padding:"10px 14px", marginBottom:14 }}>
            <div style={{ fontFamily:T.sans, fontSize:11, fontWeight:600, color:T.muted, textTransform:"uppercase", letterSpacing:.4, marginBottom:3 }}>Equipment</div>
            <div style={{ fontFamily:T.sans, fontSize:13, fontWeight:600, color:T.text }}>{state.equipment.find(e=>e.id===form.equipment)?.name||form.equipmentLabel||form.equipment||"—"}</div>
          </div>
          {renderWOForm()}
          <div style={{ display:"flex", gap:8, justifyContent:"flex-end", marginTop:8 }}>
            <Btn variant="secondary" onClick={()=>setModal(null)}>Cancel</Btn>
            <Btn onClick={()=>save(true)}>Save Work Order Changes</Btn>
          </div>
        </Modal>
      )}

      {/* Equipment picker */}
      {modal==="pick" && (
        <Modal title="Select Equipment or Attachment" onClose={()=>setModal(null)}>
          <p style={{ margin:"0 0 14px", fontFamily:T.sans, fontSize:13, color:T.subtext }}>Choose the equipment or attachment this work order is for.</p>
          <input style={{ ...inp, marginBottom:14 }} placeholder="Search by nomenclature, serial, EIL #..." value={eqSearch} onChange={e=>setEqSearch(e.target.value)} autoFocus />
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
    if(!form.name) return alert("Attachment nomenclature is required.");
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
  const [historyWO, setHistoryWO] = useState(null);
  const [historyEdit, setHistoryEdit] = useState(false);
  const [expandedAt, setExpandedAt]     = useState({});
  const [form, setForm]         = useState({});
  const [search, setSearch]     = useState("");
  const [statusF, setStatusF]   = useState("All");
  const [typeF, setTypeF]       = useState("All");
  const [locationF, setLocationF] = useState("All");
  const [equipSort, setEquipSort] = useState("equipAsc");
  const [showNewCat, setShowNewCat] = useState(false);
  const [newCat, setNewCat]     = useState("");
  const F = k => e => setForm(f=>({...f,[k]:e.target.value}));

  const printEquipmentSummary = (eq) => {
    if(!eq) return;
    const esc = htmlEscape;
    const usage = equipmentUsageSummary(state, eq);
    const fin = equipmentFinancialSummary(state, eq);
    const settings = state.settings || {};
    const wos = [...(fin.wos || [])].sort((a,b)=>String(workOrderDate(b)||"").localeCompare(String(workOrderDate(a)||"")));
    const exportRows = [
      { Item:"Equipment #", Value:eq.id || "" },
      { Item:"Nomenclature", Value:eq.name || eq.nomenclature || "" },
      { Item:"Year", Value:eq.year || "" },
      { Item:`Current ${usage.label}`, Value:Number(usage.value||0).toLocaleString(undefined,{maximumFractionDigits:1}) },
      { Item:"Lifetime Spent", Value:moneyFmt(fin.lifetimeSpent) },
      { Item:"FY Spent", Value:moneyFmt(fin.fySpent) },
      { Item:"Total Work Orders", Value:fin.totalWOs },
      { Item:"Lifetime Labor Hours", Value:fin.lifetimeLaborHours.toFixed(1) },
    ];
    const win = window.open("","_blank","width=900,height=700");
    if(!win) { alert("Please allow pop-ups to print the equipment summary."); return; }
    const metric = (label, value) => `<div class="metric"><div class="metricValue">${esc(value)}</div><div class="metricLabel">${esc(label)}</div></div>`;
    win.document.write(`<!DOCTYPE html><html><head><title>Equipment Summary ${esc(eq.id||"")}</title><style>
      body{font-family:Arial,Helvetica,sans-serif;background:#fff;color:#111827;padding:24px;font-size:12px}h1{margin:0 0 4px;font-size:22px}p{margin:0 0 16px;color:#667085}.header{display:flex;align-items:flex-start;gap:14px;border-bottom:2px solid #111827;padding-bottom:14px;margin-bottom:16px}.logo{max-height:58px;max-width:120px;object-fit:contain}.titleBlock{flex:1}.eqNum{font-family:monospace;font-size:13px;font-weight:800;color:#334155}.subtitle{font-size:13px;color:#475467;margin-top:3px}.metrics{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:14px 0 18px}.metric{border:1px solid #d0d5dd;background:#f9fafb;border-radius:10px;padding:12px}.metricValue{font-size:20px;font-weight:800;color:#111827}.metricLabel{font-size:10px;text-transform:uppercase;letter-spacing:.4px;color:#667085;margin-top:4px}.sectionTitle{background:#e5e7eb;padding:8px 10px;border-radius:8px;font-size:12px;font-weight:900;text-transform:uppercase;letter-spacing:.5px;margin:18px 0 8px}table{width:100%;border-collapse:collapse;font-size:12px}th{background:#111827;color:white;text-align:left;padding:7px 8px;font-size:10px;text-transform:uppercase;letter-spacing:.4px}td{border-bottom:1px solid #e5e7eb;padding:7px 8px;vertical-align:top}.right{text-align:right}.grid{display:grid;grid-template-columns:repeat(2,1fr);gap:8px 20px}.field{border-bottom:1px solid #e5e7eb;padding:7px 0}.label{font-size:10px;text-transform:uppercase;color:#667085;font-weight:800}.value{font-size:13px;margin-top:2px}.actions{margin-top:18px;display:flex;gap:8px;justify-content:center}.actions button{padding:9px 18px;border:none;border-radius:8px;background:#111827;color:#fff;font-weight:800;cursor:pointer}@media print{.actions{display:none}.metric,.sectionTitle{break-inside:avoid}body{padding:18px}.metrics{grid-template-columns:repeat(4,1fr)}}@page{size:letter;margin:.35in}
    </style></head><body>`);
    win.document.write(`<div class="header">${settings.logo?`<img class="logo" src="${settings.logo}" alt="Logo">`:""}<div class="titleBlock"><h1>${esc(settings.companyName || "Maintenance Department")}</h1><div class="eqNum">Equipment Summary — ${esc(eq.id||"—")}</div><div class="subtitle">${esc(eq.name || eq.nomenclature || "—")} · ${esc([eq.year,eq.make,eq.model].filter(Boolean).join(" ") || "—")}</div></div><div style="text-align:right;color:#667085;font-size:11px">Generated: ${new Date().toLocaleDateString()}</div></div>`);
    win.document.write(`<div class="metrics">${metric("Current " + usage.label, Number(usage.value||0).toLocaleString(undefined,{maximumFractionDigits:1}))}${metric("Lifetime Spent", moneyFmt(fin.lifetimeSpent))}${metric("FY Spent", moneyFmt(fin.fySpent))}${metric("Total WOs", fin.totalWOs)}${metric("Lifetime Labor", fin.lifetimeLaborHours.toFixed(1)+"h")}${metric("FY Labor", fin.fyLaborHours.toFixed(1)+"h")}${metric("Open WOs", fin.openWOs)}${metric("Completed WOs", fin.completedWOs)}</div>`);
    win.document.write(`<div class="sectionTitle">Equipment Information</div><div class="grid">${[["Equipment #",eq.id],["Nomenclature",eq.name||eq.nomenclature],["Year",eq.year],["Make",eq.make],["Model",eq.model],["Serial #",eq.serial],["EIL #",eq.eilNumber],["Facility",eq.location],["Area",eq.area],["Category",eq.category||eq.type],["Acquisition Date",eq.acquisitionDate],["Purchase Price",eq.acquisitionCost?moneyFmt(eq.acquisitionCost):""],["Status",eq.status||"Fully Operational"]].map(([k,v])=>`<div class="field"><div class="label">${esc(k)}</div><div class="value">${esc(v||"—")}</div></div>`).join("")}</div>`);
    win.document.write(`<div class="sectionTitle">Work Order Totals</div><table><tr><th>Type</th><th class="right">Count</th></tr><tr><td>Repair</td><td class="right">${fin.repairWOs}</td></tr><tr><td>Service / PM</td><td class="right">${fin.serviceWOs}</td></tr><tr><td>Inspection</td><td class="right">${fin.inspectionWOs}</td></tr></table>`);
    win.document.write(`<div class="sectionTitle">Work Order History</div><table><tr><th>WO #</th><th>Type</th><th>Status</th><th>Date</th><th>Description</th><th class="right">Labor</th><th class="right">Cost</th></tr>${wos.map(w=>`<tr><td>${esc(w.id||"—")}</td><td>${esc(w.woType||w.type||"—")}</td><td>${esc(w.status||"—")}</td><td>${esc(workOrderDate(w)||"—")}</td><td>${esc(w.title||w.faultDescription||w.description||"—")}</td><td class="right">${esc((+w.laborHours||0).toFixed(1))}h</td><td class="right">${esc(moneyFmt(woTotalCost(w)))}</td></tr>`).join("")}${!wos.length?`<tr><td colspan="7" style="text-align:center;color:#667085;padding:18px">No work orders for this equipment.</td></tr>`:""}</table>`);
    if(eq.notes) win.document.write(`<div class="sectionTitle">Notes</div><div style="white-space:pre-wrap;border:1px solid #e5e7eb;border-radius:8px;padding:10px">${esc(eq.notes)}</div>`);
    win.document.write(`<div class="actions"><button onclick="window.print()">Print Equipment Summary</button></div>${reportButtonsHtml(exportRows)}</body></html>`);
    win.document.close();
  };


  const printHistoryWO = (wo) => {
    const eq = state.equipment.find(e => e.id === wo.equipment) || {};
    const gs = state.settings || {};
    const h = (value) => String(value ?? "").replace(/[&<>'"]/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[ch]));
    const inspectionRowsForPrint = (() => {
      const linkedTask = (state.inspectionTasks || []).find(t => String(t.id || "") === String(wo.inspectionTaskId || ""));
      const source = Array.isArray(wo.inspectionStepResults) && wo.inspectionStepResults.length
        ? wo.inspectionStepResults
        : Array.isArray(wo.inspectionSteps) && wo.inspectionSteps.length
          ? wo.inspectionSteps
          : Array.isArray(wo.steps) && wo.steps.length
            ? wo.steps
            : Array.isArray(linkedTask?.stepLines) && linkedTask.stepLines.length
              ? linkedTask.stepLines
              : String(wo.inspectionSteps || wo.steps || wo.workPerformed || linkedTask?.steps || "")
                  .split(/\n+/)
                  .map((step,i)=>({ id:`step-${i}`, step:step.trim(), result:"", comment:"" }))
                  .filter(x=>x.step);
      return source.map((r,i)=>({
        id: r?.id || `step-${i}`,
        step: r?.step || r?.text || r?.name || String(r || ""),
        result: r?.result || r?.status || "",
        comment: r?.comment || r?.notes || ""
      })).filter(r=>String(r.step||"").trim());
    })();
    const money = (value) => `$${(+value || 0).toFixed(2)}`;
    const partsUsed = Array.isArray(wo.partsUsed) ? wo.partsUsed : [];
    const partsTotal = partsUsed.reduce((sum, part) => sum + lineItemTotal(part), 0);
    const outsideServices = Array.isArray(wo.outsideServices) ? wo.outsideServices : [];
    const outsideServicesSubtotal = outsideServicesTotal(outsideServices);
    const laborHoursTotal = +(wo.laborHours || 0);
    const laborTotal = +(wo.laborCost || 0);
    const grandTotal = partsTotal + outsideServicesSubtotal + laborTotal;
    const type = String(wo.woType || wo.type || "Repair");
    const typeLower = type.toLowerCase();
    const colorMap = {
      repair: { accent:"#dbeafe", border:"#1e3a8a", soft:"#eff6ff" },
      inspection: { accent:"#dcfce7", border:"#166534", soft:"#f0fdf4" },
      service: { accent:"#fef3c7", border:"#92400e", soft:"#fffbeb" }
    };
    const C = typeLower.includes("inspection") ? colorMap.inspection : (typeLower.includes("service") || typeLower.includes("prevent")) ? colorMap.service : colorMap.repair;
    const usageValue = wo.usageNA ? "N/A" : [wo.usageHours ? `${wo.usageHours} Hours` : "", wo.usageMileage ? `${wo.usageMileage} Miles` : ""].filter(Boolean).join(" / ");
    const desc = typeLower.includes("inspection")
      ? String(wo.inspectionTaskName || wo.faultDescription || wo.description || wo.title || "")
      : String(wo.faultDescription || wo.description || wo.title || "");
    const win = window.open("", "_blank", "width=900,height=700");
    if (!win) { alert("Please allow pop-ups to print work orders."); return; }
    win.document.write(`<!DOCTYPE html><html><head><title>Work Order ${h(wo.id)}</title><style>
      *{box-sizing:border-box;margin:0;padding:0}
      html,body{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}
      body{font-family:Arial,Helvetica,sans-serif;background:#fff;color:#111827;font-size:12px;line-height:1.35}
      .page{width:8.5in;min-height:11in;margin:0 auto;padding:.38in .45in}
      .outer{border:1.5px solid #111827;border-radius:8px;overflow:hidden;background:white}
      .top{display:grid;grid-template-columns:1.05in 1fr 1.65in;border-bottom:1.5px solid #111827;min-height:.72in}
      .logoBox{display:flex;align-items:center;justify-content:center;border-right:1.5px solid #111827;padding:6px;background:white;overflow:hidden}
      .logoBox img{max-width:100%;max-height:.58in;object-fit:contain;display:block}
      .logoText{font-weight:900;text-align:center;color:#111827;font-size:13px;line-height:1.2}
      .companyBox{display:flex;flex-direction:column;align-items:center;justify-content:center;background:${C.soft};padding:8px 10px;text-align:center}
      .company{font-size:18px;font-weight:900;letter-spacing:1px;text-transform:uppercase;color:#111827;line-height:1.1}
      .typePill{margin-top:4px;border:1.5px solid ${C.border};background:${C.accent};color:#111827;border-radius:999px;padding:4px 18px;font-size:12px;font-weight:900;letter-spacing:.8px;text-transform:uppercase}
      .numberBox{border-left:1.5px solid #111827;display:grid;grid-template-rows:1fr .32in;text-align:center;background:white}
      .woNumber{display:flex;flex-direction:column;align-items:center;justify-content:center;padding:6px}
      .woNumber .label{font-size:10px;font-weight:900;letter-spacing:1px;text-transform:uppercase;color:#111827}
      .woNumber .number{font-size:18px;font-weight:900;color:#111827;margin-top:4px;word-break:break-word}
      .status{display:flex;align-items:center;justify-content:center;background:${C.border};color:white;font-size:11px;font-weight:900;letter-spacing:1.3px;text-transform:uppercase;border-top:1.5px solid #111827}
      .dateGrid,.infoGrid{display:grid;grid-template-columns:1fr 1fr 1fr;border-bottom:1.5px solid #111827}
      .cell{min-height:.28in;padding:4px 6px;border-right:1px solid #9ca3af;border-bottom:1px solid #cbd5e1;display:grid;grid-template-columns:.95fr 1.35fr;align-items:center;gap:8px;overflow:hidden}
      .cell:nth-child(3n){border-right:none}
      .fieldLabel{font-size:8.5px;font-weight:900;text-transform:uppercase;letter-spacing:.65px;color:#111827;line-height:1.1}
      .fieldValue{font-size:10.5px;font-weight:800;color:#111827;line-height:1.15;white-space:normal;overflow-wrap:anywhere}
      .section{border-top:1.5px solid #111827;break-inside:auto;page-break-inside:auto}
      .section-title,.summaryTitle{background:${C.accent};color:#111827;border-bottom:1px solid #94a3b8;font-size:10.5px;font-weight:900;text-transform:uppercase;letter-spacing:.65px;padding:6px 10px}
      .textBlock{padding:5px 7px;min-height:.28in;white-space:pre-wrap;overflow-wrap:anywhere;color:#111827;font-size:12px}
      .textBlock.tall{min-height:.45in}
      .miniTitle{padding:4px 7px 3px;font-weight:900;text-transform:uppercase;font-size:11px;color:#111827;background:#fff}
      .data-table{width:100%;border-collapse:collapse;table-layout:fixed;font-size:10.5px}
      .data-table th{background:#e5e7eb;color:#111827;text-transform:uppercase;letter-spacing:.35px;font-size:8.5px;font-weight:900;padding:4px 5px;border-top:1px solid #9ca3af;border-bottom:1px solid #9ca3af;border-right:1px solid #cbd5e1;text-align:left}
      .data-table td{padding:4px 5px;border-bottom:1px solid #cbd5e1;border-right:1px solid #e5e7eb;vertical-align:top;overflow-wrap:anywhere;color:#111827}
      .data-table th:last-child,.data-table td:last-child{border-right:none}
      .right{text-align:right}.center{text-align:center}
      .subRow td{background:#f8fafc;font-weight:900;border-top:1.5px solid #111827}
      .grandTotal{display:grid;grid-template-columns:1fr 1.5in;border-top:1.5px solid #111827;background:${C.accent};font-weight:900;font-size:13px;color:#111827}
      .grandTotal div{padding:9px 12px}.grandTotal div:last-child{text-align:right;border-left:1.5px solid #111827}
      .signatureGrid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;padding:8px 10px;border-top:1.5px solid #111827;min-height:.42in;align-items:end}
      .sigLine{border-top:1.5px solid #111827;padding-top:5px;min-height:32px}
      .sigValue{font-size:12px;font-weight:800;margin-bottom:4px;min-height:14px;overflow-wrap:anywhere;color:#111827}
      .sigLabel{font-size:9.5px;font-weight:900;text-transform:uppercase;letter-spacing:.6px;color:#111827}
      .pbtn{margin:14px auto 0;display:flex;gap:10px;justify-content:center}
      .pbtn button{padding:9px 24px;font-size:13px;font-weight:800;border-radius:6px;cursor:pointer;background:${C.border};color:white;border:none}
      @page{size:letter;margin:0}
      @media print{.pbtn,.print-customize{display:none!important}html,body{width:8.5in;margin:0!important;padding:0!important}.page{width:8.5in;padding:.18in .22in}.outer{break-inside:auto;page-break-inside:auto}body{font-size:10px}.section,.data-table tr{break-inside:auto;page-break-inside:auto}}
    </style></head><body>
      <div class="page"><div class="outer">
        <header class="top">
          <div class="logoBox">${gs.logo ? `<img src="${gs.logo}" alt="Logo">` : `<div class="logoText">LOGO</div>`}</div>
          <div class="companyBox"><div class="company">${h(gs.companyName || "Maintenance Department")}</div><div class="typePill">${h(type.toUpperCase())}</div></div>
          <div class="numberBox"><div class="woNumber"><div class="label">Work Order Number</div><div class="number">${h(wo.id || "")}</div></div><div class="status">${h(wo.status || "Open")}</div></div>
        </header>
        <div class="dateGrid">
          <div class="cell"><div class="fieldLabel">Date Created</div><div class="fieldValue">${h(wo.created)||"&nbsp;"}</div></div>
          <div class="cell"><div class="fieldLabel">Due Date</div><div class="fieldValue">${h(wo.due)||"&nbsp;"}</div></div>
          <div class="cell"><div class="fieldLabel">Date Completed</div><div class="fieldValue">${h(wo.completed||wo.closedDate)||"&nbsp;"}</div></div>
        </div>
        <section class="section" style="border-top:none">
          <div class="section-title">Work Order Type and Equipment Information</div>
          <div class="infoGrid">
            <div class="cell"><div class="fieldLabel">Work Order Type</div><div class="fieldValue">${h(type.toUpperCase())}</div></div>
            <div class="cell"><div class="fieldLabel">Equipment Number</div><div class="fieldValue">${h(wo.equipment)||"&nbsp;"}</div></div>
            <div class="cell"><div class="fieldLabel">Equipment Name</div><div class="fieldValue">${h(eq.name || wo.equipmentLabel)||"&nbsp;"}</div></div>
            <div class="cell"><div class="fieldLabel">Make and Model</div><div class="fieldValue">${h([eq.make,eq.model].filter(Boolean).join(" "))||"&nbsp;"}</div></div>
            <div class="cell"><div class="fieldLabel">Serial Number</div><div class="fieldValue">${h(eq.serial)||"&nbsp;"}</div></div>
            <div class="cell"><div class="fieldLabel">Usage</div><div class="fieldValue">${h(usageValue)||"&nbsp;"}</div></div>
            <div class="cell"><div class="fieldLabel">EIL #</div><div class="fieldValue">${h(eq.eilNumber)||"&nbsp;"}</div></div>
            <div class="cell"><div class="fieldLabel">Priority</div><div class="fieldValue">${h(wo.priority)||"&nbsp;"}</div></div>
            <div class="cell"><div class="fieldLabel">Mechanic</div><div class="fieldValue">${h(wo.tech)||"&nbsp;"}</div></div>
          </div>
        </section>
        <section class="section"><div class="section-title">Description</div><div class="textBlock">${h(desc)||"&nbsp;"}</div></section>
        <section class="section"><div class="section-title">Work Description and Work Performed</div><div class="textBlock tall">${h(wo.description)||"&nbsp;"}</div></section>
        ${!typeLower.includes("inspection") ? `<section class="section"><div class="section-title">Mechanic Notes</div><div class="textBlock tall">${h(wo.mechanicNotes)||"&nbsp;"}</div></section>` : ""}
        ${typeLower.includes("inspection") && inspectionRowsForPrint.length ? `<section class="section"><div class="section-title">Inspection Checklist</div><table class="data-table"><thead><tr><th style="width:55%">Step</th><th style="width:15%">Pass / Fail</th><th style="width:30%">Comment</th></tr></thead><tbody>${inspectionRowsForPrint.map((r,i)=>`<tr><td>${i+1}. ${h(r.step)||"&nbsp;"}</td><td><b>${h(r.result)||"—"}</b></td><td>${h(r.comment)||"—"}</td></tr>`).join("")}</tbody></table></section>` : ""}
        <section class="section" data-print-item="Parts and Labor Summary">
          <div class="summaryTitle">Parts and Labor Summary</div>
          <div class="miniTitle" data-print-item="Parts Used Table">Parts Used</div>
          <table class="data-table">
            <thead><tr><th style="width:50%">Description</th><th style="width:13%" class="center">Quantity</th><th style="width:18%" class="right">Unit Price</th><th style="width:19%" class="right">Total</th></tr></thead>
            <tbody>
              ${partsUsed.length ? partsUsed.map(part => { const q=+(part.qty||1); const u=+(part.unitCost||0); return `<tr><td>${h(part.name || part.description || "—")}</td><td class="center">${h(q)} ${h(part.unit||"ea")}</td><td class="right">${money(u)}</td><td class="right">${money(q*u)}</td></tr>`; }).join("") : `<tr><td colspan="4" style="color:#64748b;font-style:italic">No parts listed</td></tr>`}
              <tr class="subRow"><td colspan="3">Parts Subtotal</td><td class="right">${money(partsTotal)}</td></tr>
            </tbody>
          </table>
          <div class="miniTitle" data-print-item="Outside Services Table">Outside Services</div>
          <table class="data-table">
            <thead><tr><th style="width:50%">Service Description</th><th style="width:13%" class="center">Quantity</th><th style="width:18%" class="right">Unit Cost</th><th style="width:19%" class="right">Total</th></tr></thead>
            <tbody>
              ${outsideServices.length ? outsideServices.map(svc => { const q=+(svc.qty||1); const u=+(svc.unitCost ?? svc.cost ?? 0); return `<tr><td>${h(svc.description || svc.name || "—")}</td><td class="center">${h(q)}</td><td class="right">${money(u)}</td><td class="right">${money(q*u)}</td></tr>`; }).join("") : `<tr><td colspan="4" style="color:#64748b;font-style:italic">No outside services listed</td></tr>`}
              <tr class="subRow"><td colspan="3">Outside Services Subtotal</td><td class="right">${money(outsideServicesSubtotal)}</td></tr>
            </tbody>
          </table>
          <div class="miniTitle" data-print-item="Labor Table">Labor</div>
          <table class="data-table">
            <thead><tr><th style="width:63%">Work Performed</th><th style="width:15%" class="center">Hours</th><th style="width:22%" class="right">Total</th></tr></thead>
            <tbody><tr><td>${h(wo.laborDescription || wo.laborTask || "Diagnosis and Repair")}</td><td class="center">${laborHoursTotal.toFixed(1)}</td><td class="right">${money(laborTotal)}</td></tr></tbody>
          </table>
          <div class="grandTotal"><div>Grand Total</div><div>${money(grandTotal)}</div></div>
        </section>
        <div class="signatureGrid">
          <div><div class="sigValue">&nbsp;</div><div class="sigLine"><div class="sigLabel">Signature</div></div></div>
          <div><div class="sigValue">${h(wo.tech)||"&nbsp;"}</div><div class="sigLine"><div class="sigLabel">Printed Name</div></div></div>
          <div><div class="sigValue">${h(wo.completed||wo.closedDate)||"&nbsp;"}</div><div class="sigLine"><div class="sigLabel">Date</div></div></div>
        </div>
      </div></div>
      <div class="pbtn"><button onclick="window.print()">Print / Save PDF</button></div>
    ${printCustomizePanelHtml(wo.woType || "WorkOrder")}
    </body></html>`);
    win.document.close();
    win.focus();
  };

  const toggleAttachments = (eqId, e) => {
    e.stopPropagation();
    setExpandedAt(prev=>({...prev,[eqId]:!prev[eqId]}));
  };

  const EQ_STATUSES = ["Fully Operational","Operational with Deficiencies","Out of Service / Deadline","No Status"];
  const categories = [...new Set([...(state.categories||[]), ...state.equipment.map(e=>e.category).filter(Boolean)])].sort((a,b)=>String(a).localeCompare(String(b)));
  const locations = [...new Set(state.equipment.map(e=>e.location).filter(Boolean))];

  const STATUS_SORT = { "Out of Service / Deadline":0, "Operational with Deficiencies":1, "Fully Operational":2, "No Status":3 };

  const filtered = state.equipment.filter(e=>{
    /* Hide equipment that's been turned in or disposed - they live in Equipment Inventory only */
    if(["Turned-in","Disposed"].includes(e.turnInStatus)) return false;
    const normalizeSearch = (value) => String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
    const searchable = `${e.id||""} ${e.equipmentId||""} ${e.eqNumber||""} ${e.name||""} ${e.nomenclature||""} ${e.category||""} ${e.type||""} ${e.make||""} ${e.model||""} ${e.serial||""} ${e.eilNumber||""} ${e.location||""} ${e.year||""}`.toLowerCase();
    const compactSearchable = normalizeSearch(searchable);
    const terms = String(search||"").toLowerCase().trim().split(/\s+/).filter(Boolean);
    const ms = terms.length === 0 || terms.every(term => searchable.includes(term) || compactSearchable.includes(normalizeSearch(term)));
    const mt  = typeF==="All"   || e.category===typeF;
    const ml  = locationF==="All" || e.location===locationF;
    return ms&&mt&&ml;
  }).sort((a,b)=>{
    if(equipSort==="equipAsc") return String(a.id||"").localeCompare(String(b.id||""), undefined, { numeric:true, sensitivity:"base" });
    if(equipSort==="equipDesc") return String(b.id||"").localeCompare(String(a.id||""), undefined, { numeric:true, sensitivity:"base" });
    return String(a.id||"").localeCompare(String(b.id||""), undefined, { numeric:true, sensitivity:"base" });
  });

  const woForEq  = eq => state.workOrders.filter(w=>String(workOrderEquipmentId(w) || w.equipment || "")===String(eq.id||""));
  const openAdd  = () => { setForm({ status:"Fully Operational" }); setModal("add"); };
  const openEdit = eq => { setForm({...eq, _originalId:eq.id}); setModal("editing"); };
  const save = () => {
    if(!form.name) return alert("Nomenclature required.");
    if(modal==="add") {
      const newId = form.id && form.id.trim() ? form.id.trim() : genId("EQ");
      dispatch({type:"ADD_EQ", payload:{...form, id:newId}});
    } else {
      const updatedEquipment = {
        ...form,
        id: form.id && String(form.id).trim() ? String(form.id).trim() : form._originalId
      };
      dispatch({type:"UPDATE_EQ", payload:updatedEquipment});
    }
    setModal(null);
  };
  const del = id => { if(confirm("Delete this equipment record?")){ dispatch({type:"DELETE_EQ",payload:id}); setDetail(null); }};
  const closeHistoryWO = () => { setHistoryWO(null); setHistoryEdit(false); };
  const saveHistoryWO = () => {
    if(!historyWO) return;
    dispatch({ type:"UPDATE_WO", payload:historyWO });
    setHistoryEdit(false);
  };

  /* Equipment tab is inventory-focused: no operational status colors shown here */
  const rowStyle = () => ({ bg:"#fff", borderColor:T.border, leftBorder:`4px solid ${T.border}` });

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
      <Field label="Nomenclature">
        <SmartInput historyKey="equipment.name" style={inp} value={form.name||""} onChange={e=>setForm(f=>({...f,name:e.target.value}))} placeholder="e.g. John Deere Zero-Turn" />
      </Field>
      <Field label="Equipment #" half>
        <SmartInput historyKey="equipment.id" style={inp} value={form.id||""} onChange={e=>setForm(f=>({...f,id:e.target.value}))} placeholder="e.g. EQ-005" />
      </Field>
      <Field label="EIL #" half>
        <SmartInput historyKey="equipment.eilNumber" style={inp} value={form.eilNumber||""} onChange={e=>setForm(f=>({...f,eilNumber:e.target.value}))} placeholder="EE#" />
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

      <Field label="Make" half>
        <SmartInput historyKey="equipment.make" style={inp} value={form.make||""} onChange={e=>setForm(f=>({...f,make:e.target.value}))} />
      </Field>
      <Field label="Model" half>
        <SmartInput historyKey="equipment.model" style={inp} value={form.model||""} onChange={e=>setForm(f=>({...f,model:e.target.value}))} />
      </Field>
      <Field label="Year" half>
        <SmartInput historyKey="equipment.year" style={inp} type="number" value={form.year||""} onChange={e=>setForm(f=>({...f,year:e.target.value}))} />
      </Field>
      <Field label="Serial Number" half>
        <SmartInput historyKey="equipment.serial" style={inp} value={form.serial||""} onChange={e=>setForm(f=>({...f,serial:e.target.value}))} />
      </Field>
      <Field label="Facility" half>
        <SmartInput historyKey="equipment.facility" style={inp} listId="equipment-facility-history" extraOptions={[...new Set([...(state.settings?.locations||[]), ...(state.equipment||[]).map(e=>e.location).filter(Boolean)])]} value={form.location||""} onChange={e=>setForm(f=>({...f,location:e.target.value,facility:e.target.value}))} placeholder="Select or type facility..." />
      </Field>
      <Field label="Area / Building / Department" half>
        <SmartInput historyKey="equipment.area" style={inp} listId="equipment-area-history" extraOptions={[...new Set([...(state.settings?.areas||[]).map(a=>typeof a==="string"?a:a.name), ...(state.equipment||[]).map(e=>e.area).filter(Boolean)])]} value={form.area||""} onChange={e=>setForm(f=>({...f,area:e.target.value}))} placeholder="e.g. Maintenance Building" />
      </Field>
      <Field label="Acquisition Date" half>
        <input style={inp} type="date" value={form.acquisitionDate||""} onChange={e=>setForm(f=>({...f,acquisitionDate:e.target.value}))} />
      </Field>
      <Field label="Purchase Price ($)" half>
        <SmartInput historyKey="equipment.acquisitionCost" style={inp} type="number" value={form.acquisitionCost||""} onChange={e=>setForm(f=>({...f,acquisitionCost:e.target.value}))} placeholder="0.00" />
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
            <span style={{ position:"absolute", top:3, left:form.trackUsage?22:3, width:18, height:18, borderRadius:"50%", background:T.card, transition:"left .2s", display:"block", boxShadow:"0 1px 3px rgba(0,0,0,.2)" }}/>
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
    const completedHistory = wos.filter(w => (w.status||"").toLowerCase()==="completed").sort((a,b)=>String(b.completed||b.closedDate||b.created||"").localeCompare(String(a.completed||a.closedDate||a.created||"")));
    const historyType = (w) => String(w.woType || w.type || "").trim().toLowerCase();
    const isRepairHistoryWO = (w) => historyType(w) === "repair";
    const isInspectionHistoryWO = (w) => historyType(w) === "inspection";
    const isServiceHistoryWO = (w) => {
      const type = historyType(w);
      return type === "service" || type === "preventive" || type === "preventative" || type === "preventive maintenance" || type === "preventative maintenance";
    };
    const serviceHistory = completedHistory.filter(isServiceHistoryWO);
    const repairHistory = completedHistory.filter(isRepairHistoryWO);
    const inspectionHistory = completedHistory.filter(isInspectionHistoryWO);
    const historyCost = (wo) => woTotalCost(wo);
    const historyUsage = (wo) => {
      if (wo.usageNA) return "N/A";
      if (wo.usageType==="mileage") return wo.usageMileage ? `${wo.usageMileage} mi` : "—";
      if (wo.usageType==="both") return `${wo.usageHours||"—"} hrs / ${wo.usageMileage||"—"} mi`;
      return wo.usageHours ? `${wo.usageHours} hrs` : (wo.usageMileage ? `${wo.usageMileage} mi` : "—");
    };
    const historyLabel = (wo, fallback) => wo.title || wo.faultDescription || wo.description || wo.problem || fallback;
    const getInspectionRowsForWO = (wo) => {
      const linkedTask = (state.inspectionTasks || []).find(t => String(t.id || "") === String(wo.inspectionTaskId || ""));
      const raw = Array.isArray(wo.inspectionStepResults) && wo.inspectionStepResults.length
        ? wo.inspectionStepResults
        : Array.isArray(wo.inspectionSteps) && wo.inspectionSteps.length
          ? wo.inspectionSteps
          : Array.isArray(wo.steps) && wo.steps.length
            ? wo.steps
            : Array.isArray(linkedTask?.stepLines) && linkedTask.stepLines.length
              ? linkedTask.stepLines
              : String(wo.inspectionSteps || wo.steps || wo.workPerformed || linkedTask?.steps || "")
                  .split(/\n+/)
                  .map((step,i)=>({ id:`step-${i}`, step:step.trim(), result:"", comment:"" }))
                  .filter(x=>x.step);
      return raw.map((r,i)=>({
        id: r.id || `step-${i}`,
        step: r.step || r.text || r.name || String(r || ""),
        result: r.result || r.status || "",
        comment: r.comment || r.notes || ""
      })).filter(r=>String(r.step||"").trim());
    };
    const renderHistoryTable = (rows, emptyText, fallbackTitle) => (
      rows.length===0
        ? <p style={{ margin:"0 0 12px", fontFamily:T.sans, fontSize:13, color:T.muted }}>{emptyText}</p>
        : <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13, fontFamily:T.sans, marginBottom:18 }}>
            <thead>
              <tr style={{ background:T.grayLt, borderBottom:`1px solid ${T.border}` }}>
                {["WO #","Description","Completed","Usage","Cost","Print","Edit"].map(h=>(
                  <th key={h} style={{ padding:"8px 12px", textAlign:"left", fontWeight:600, fontSize:11, color:T.muted, textTransform:"uppercase", letterSpacing:.4 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((wo,i)=>(
                <tr key={wo.id} onClick={()=>{ setHistoryWO(wo); setHistoryEdit(false); }} style={{ borderBottom:`1px solid ${T.border}`, background:i%2===0?"#fff":T.grayLt, cursor:"pointer" }} title="Click to open this work order">
                  <td style={{ padding:"9px 12px", fontFamily:T.mono, fontSize:11, color:T.accent, fontWeight:700 }}>{wo.id}</td>
                  <td style={{ padding:"9px 12px", fontWeight:500, color:T.text }}>{historyLabel(wo, fallbackTitle)}</td>
                  <td style={{ padding:"9px 12px", fontFamily:T.mono, fontSize:12, color:T.subtext }}>{wo.completed||wo.closedDate||"—"}</td>
                  <td style={{ padding:"9px 12px", fontFamily:T.mono, fontSize:12, color:T.subtext }}>{historyUsage(wo)}</td>
                  <td style={{ padding:"9px 12px", fontFamily:T.mono, fontSize:12, color:T.subtext }}>${historyCost(wo).toFixed(2)}</td>
                  <td style={{ padding:"6px 12px" }}>
                    <button
                      type="button"
                      onClick={(e)=>{ e.stopPropagation(); printHistoryWO(wo); }}
                      title="Print this work order"
                      style={{ border:`1px solid ${T.accent}`, background:T.accent, color:"#fff", borderRadius:7, padding:"5px 9px", cursor:"pointer", fontSize:12, fontWeight:700, lineHeight:1 }}
                    >
                      Print
                    </button>
                  </td>
                  <td style={{ padding:"6px 12px" }}>
                    <button
                      type="button"
                      onClick={(e)=>{ e.stopPropagation(); setHistoryWO(wo); setHistoryEdit(true); }}
                      title="Edit this archived work order"
                      style={{ border:`1px solid ${T.border}`, background:T.card, borderRadius:7, padding:"5px 8px", cursor:"pointer", fontSize:14, lineHeight:1 }}
                    >
                      ✏️
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
    );
    const rs     = rowStyle(eq.status);
    const isOOS  = eq.status==="Out of Service / Deadline";
    const isDef  = eq.status==="Operational with Deficiencies";
    const editing = modal==="editing";

    return (
      <div>
        {historyWO && (
          <Modal title={`${historyEdit ? "Edit" : "View"} Work Order ${historyWO.id || ""}`} onClose={closeHistoryWO}>
            {!historyEdit ? (
              <div style={{ fontFamily:T.sans, color:T.text }}>
                <div style={{ display:"flex", justifyContent:"space-between", gap:8, marginBottom:14, alignItems:"flex-start" }}>
                  <div>
                    <div style={{ fontFamily:T.mono, fontSize:12, color:T.muted }}>{historyWO.woType || historyWO.type || "Work Order"}</div>
                    <div style={{ fontSize:18, fontWeight:800 }}>{historyWO.id || "Work Order"}</div>
                  </div>
                  <div style={{ display:"flex", gap:8 }}>
                    <Btn small variant="secondary" onClick={()=>printHistoryWO(historyWO)}>Print</Btn>
                    <Btn small onClick={()=>setHistoryEdit(true)}>✏ Edit</Btn>
                  </div>
                </div>
                <div style={{ border:`2px solid ${T.text}`, borderRadius:8, overflow:"hidden", background:T.card }}>
                  <div style={{ background:T.text, color:"#fff", padding:"10px 14px", display:"flex", justifyContent:"space-between", gap:12, alignItems:"center" }}>
                    <div>
                      <div style={{ fontSize:17, fontWeight:900, textTransform:"uppercase", letterSpacing:.4 }}>{historyWO.woType || historyWO.type || "Work Order"}</div>
                      <div style={{ fontFamily:T.mono, fontSize:12, opacity:.9 }}>{historyWO.id}</div>
                    </div>
                    <div style={{ textAlign:"right", fontSize:12 }}>
                      <div><b>Status:</b> {historyWO.status || "—"}</div>
                      <div><b>Completed:</b> {historyWO.completed || historyWO.closedDate || "—"}</div>
                    </div>
                  </div>
                  <div style={{ padding:14 }}>
                    <div style={{ display:"grid", gridTemplateColumns:"repeat(3, 1fr)", gap:10, marginBottom:14 }}>
                      {[
                        ["Created", historyWO.created],
                        ["Due", historyWO.due],
                        ["Usage", historyUsage(historyWO)],
                        ["Cost", `$${historyCost(historyWO)}`],
                        ["Equipment", eq?.name || historyWO.equipment],
                        ["Type", historyWO.woType || historyWO.type],
                      ].map(([k,v])=>(
                        <div key={k} style={{ border:`1px solid ${T.border}`, borderRadius:6, padding:"8px 10px" }}>
                          <div style={{ fontSize:10, fontWeight:800, color:T.muted, textTransform:"uppercase", letterSpacing:.4 }}>{k}</div>
                          <div style={{ marginTop:3, fontSize:13, color:T.text }}>{v || "—"}</div>
                        </div>
                      ))}
                    </div>
                    <div style={{ marginBottom:12 }}>
                      <div style={{ fontSize:11, fontWeight:900, color:T.text, textTransform:"uppercase", letterSpacing:.5, marginBottom:5 }}>Description</div>
                      <div style={{ whiteSpace:"pre-wrap", border:`1px solid ${T.border}`, borderRadius:6, padding:10, minHeight:42 }}>{historyWO.description || historyWO.faultDescription || historyWO.problem || historyLabel(historyWO, "—")}</div>
                    </div>
                    <div style={{ marginBottom:12 }}>
                      <div style={{ fontSize:11, fontWeight:900, color:T.text, textTransform:"uppercase", letterSpacing:.5, marginBottom:5 }}>Work Performed / Mechanic Notes</div>
                      <div style={{ whiteSpace:"pre-wrap", border:`1px solid ${T.border}`, borderRadius:6, padding:10, minHeight:42 }}>{historyWO.mechanicNotes || historyWO.workPerformed || historyWO.correctiveAction || "—"}</div>
                    </div>
                    {(historyWO.partsUsed||[]).length>0 && (
                      <div style={{ marginBottom:12 }}>
                        <div style={{ fontSize:11, fontWeight:900, color:T.text, textTransform:"uppercase", letterSpacing:.5, marginBottom:5 }}>Parts</div>
                        {(historyWO.partsUsed||[]).map((p,i)=><div key={i} style={{ fontSize:13, padding:"4px 0", borderBottom:`1px solid ${T.border}` }}>{p.name || p.partName || "Part"} · Qty {p.qty || 1} {p.unit || "ea"} · ${p.unitCost || 0}</div>)}
                      </div>
                    )}
                    {getInspectionRowsForWO(historyWO).length>0 && (
                      <div>
                        <div style={{ fontSize:11, fontWeight:900, color:T.text, textTransform:"uppercase", letterSpacing:.5, marginBottom:5 }}>Inspection Checklist</div>
                        <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
                          <thead><tr style={{ background:T.grayLt }}><th style={{ textAlign:"left", padding:8, border:`1px solid ${T.border}` }}>Step</th><th style={{ textAlign:"left", padding:8, border:`1px solid ${T.border}`, width:110 }}>Result</th><th style={{ textAlign:"left", padding:8, border:`1px solid ${T.border}` }}>Comment</th></tr></thead>
                          <tbody>{getInspectionRowsForWO(historyWO).map((s,i)=><tr key={s.id||i}><td style={{ padding:8, border:`1px solid ${T.border}` }}>{i+1}. {s.step}</td><td style={{ padding:8, border:`1px solid ${T.border}`, fontWeight:800, color:s.result==="Pass"?T.green:s.result==="Fail"?T.red:T.muted }}>{s.result || "—"}</td><td style={{ padding:8, border:`1px solid ${T.border}` }}>{s.comment || "—"}</td></tr>)}</tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ fontFamily:T.sans }}>
                <Field label="Status">
                  <select style={inp} value={historyWO.status||""} onChange={e=>setHistoryWO(w=>({...w,status:e.target.value}))}>
                    {WO_STATUS_OPTIONS.map(s=><option key={s} value={s}>{s}</option>)}
                  </select>
                </Field>
                <Field label="Description">
                  <textarea style={{...inp,minHeight:80}} value={historyWO.description || historyWO.faultDescription || ""} onChange={e=>setHistoryWO(w=>({...w,description:e.target.value,faultDescription:e.target.value}))} />
                </Field>
                <Field label="Mechanic Notes / Work Performed">
                  <textarea style={{...inp,minHeight:90}} value={historyWO.mechanicNotes || ""} onChange={e=>setHistoryWO(w=>({...w,mechanicNotes:e.target.value}))} />
                </Field>
                <div style={{ display:"flex", justifyContent:"flex-end", gap:8 }}>
                  <Btn variant="secondary" onClick={()=>setHistoryEdit(false)}>Cancel</Btn>
                  <Btn onClick={saveHistoryWO}>Save Work Order</Btn>
                </div>
              </div>
            )}
          </Modal>
        )}
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
                </div>
                <h2 style={{ margin:0, fontFamily:T.sans, fontSize:22, fontWeight:700, color:T.text }}>{eq.name}</h2>
                <p style={{ margin:"4px 0 0", fontFamily:T.sans, fontSize:14, color:T.subtext }}>{eq.year} {eq.make} {eq.model} · Serial: {eq.serial}</p>
              </div>
              <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                <Btn small variant="secondary" onClick={()=>printEquipmentSummary(eq)}>🖨 Print Summary</Btn>
                <Btn small onClick={()=>openEdit(eq)}>✏ Edit</Btn>
                <Btn small variant="danger" onClick={()=>del(eq.id)}>Delete</Btn>
              </div>
            </div>

          </Card>

          {/* Details */}
          <Card>
            <h4 style={{ margin:"0 0 14px", fontFamily:T.sans, fontSize:12, fontWeight:700, color:T.muted, textTransform:"uppercase", letterSpacing:.4 }}>Equipment Details</h4>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"12px 20px" }}>
              {[["Type",eq.type],["Facility",eq.location],["Area",eq.area],["Serial Number",eq.serial],["EIL #",eq.eilNumber],["Year",eq.year],["Make",eq.make],["Model",eq.model],["Acquisition Date",eq.acquisitionDate],["Purchase Price",eq.acquisitionCost?`$${Number(eq.acquisitionCost).toLocaleString()}`:"—"],["Warranty Start",eq.warrantyStart],["Warranty End",eq.warrantyEnd]].map(([k,v])=>(
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

          {/* Equipment Summary */}
          <Card>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", gap:8, marginBottom:14 }}>
              <h4 style={{ margin:0, fontFamily:T.sans, fontSize:12, fontWeight:700, color:T.muted, textTransform:"uppercase", letterSpacing:.4 }}>Equipment Summary</h4>
              <Btn small variant="secondary" onClick={()=>printEquipmentSummary(eq)}>Print</Btn>
            </div>
            {(()=>{
              const usage = equipmentUsageSummary(state, eq);
              const fin = equipmentFinancialSummary(state, eq);
              const summaryRows = [
                ["Year", eq.year || "—", T.text],
                [`Current ${usage.label}`, Number(usage.value||0).toLocaleString(undefined,{maximumFractionDigits:1}), T.text],
                ["Lifetime Spent", moneyFmt(fin.lifetimeSpent), T.accent],
                ["FY Spent", moneyFmt(fin.fySpent), T.accent],
                ["Total Work Orders", fin.totalWOs, T.text],
                ["Open Work Orders", fin.openWOs, T.amber],
                ["Lifetime Labor", `${fin.lifetimeLaborHours.toFixed(1)}h`, T.text],
                ["FY Labor", `${fin.fyLaborHours.toFixed(1)}h`, T.text],
              ];
              return <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))", gap:10 }}>
                {summaryRows.map(([k,v,c])=>(
                  <div key={k} style={{ background:T.grayLt, borderRadius:7, padding:"12px 14px", border:`1px solid ${T.border}` }}>
                    <div style={{ fontFamily:T.sans, fontSize:20, fontWeight:800, color:c, lineHeight:1.15 }}>{v}</div>
                    <div style={{ fontFamily:T.sans, fontSize:11, color:T.muted, marginTop:4 }}>{k}</div>
                  </div>
                ))}
                <div style={{ gridColumn:"1 / -1", display:"flex", gap:8, flexWrap:"wrap", paddingTop:2 }}>
                  <Badge label={`Repair: ${fin.repairWOs}`} />
                  <Badge label={`Service: ${fin.serviceWOs}`} />
                  <Badge label={`Inspection: ${fin.inspectionWOs}`} />
                  <Badge label={`Completed: ${fin.completedWOs}`} />
                </div>
              </div>;
            })()}
          </Card>

          {/* Work Order History */}
          <Card style={{ gridColumn:"span 2" }}>
            <h4 style={{ margin:"0 0 14px", fontFamily:T.sans, fontSize:12, fontWeight:700, color:T.muted, textTransform:"uppercase", letterSpacing:.4 }}>Work Order History</h4>
            <p style={{ margin:"-6px 0 16px", fontFamily:T.sans, fontSize:13, color:T.subtext }}>
              Closed work orders are archived below by type for this equipment.
            </p>

            <div style={{ marginBottom:18 }}>
              <h5 style={{ margin:"0 0 10px", fontFamily:T.sans, fontSize:12, fontWeight:800, color:T.text, textTransform:"uppercase", letterSpacing:.4 }}>Service History / Preventive Maintenance</h5>
              {renderHistoryTable(serviceHistory, "No closed service or preventive maintenance work orders for this equipment yet.", "Service Work Order")}
            </div>

            <div style={{ marginBottom:18 }}>
              <h5 style={{ margin:"0 0 10px", fontFamily:T.sans, fontSize:12, fontWeight:800, color:T.text, textTransform:"uppercase", letterSpacing:.4 }}>Repair History</h5>
              {renderHistoryTable(repairHistory, "No closed repair work orders for this equipment yet.", "Repair Work Order")}
            </div>

            <div>
              <h5 style={{ margin:"0 0 10px", fontFamily:T.sans, fontSize:12, fontWeight:800, color:T.text, textTransform:"uppercase", letterSpacing:.4 }}>Inspection History</h5>
              {renderHistoryTable(inspectionHistory, "No closed inspection work orders for this equipment yet.", "Inspection Work Order")}
            </div>
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
          <input style={{ ...inp, flex:1, minWidth:200 }} placeholder="Search by equipment #, nomenclature, make, model, serial, EIL #, facility, area…" value={search} onChange={e=>setSearch(e.target.value)} />
          <Btn variant="secondary" onClick={()=>{
            const allEquipment = state.equipment || [];
            const esc = htmlEscape;
            const faultInfo = (e) => equipmentFaultInfo(state, e);
            const statusRank = s => s==="Out of Service / Deadline" ? 0 : s==="Operational with Deficiencies" ? 1 : s==="Fully Operational" ? 2 : 3;
            const reportEqs = [...allEquipment].sort((a,b)=>statusRank(a.status)-statusRank(b.status) || String(a.id||"").localeCompare(String(b.id||"")));
            const exportRows = reportEqs.map(e=>{ const f=faultInfo(e); return {Status:e.status||"Fully Operational", "Equipment #":e.id||"", Nomenclature:e.name||e.nomenclature||"", Facility:e.location||"", Area:e.area||"", "Make/Model":`${e.make||""} ${e.model||""}`.trim(), "Serial #":e.serial||"", "EIL #":e.eilNumber||"", "Fault Date":f.faultDate||"", "Fault / Deficiency Description":f.description||"", "Open Work Orders":f.openWOs||""}; });
            const win = window.open("","_blank");
            const rowHtml = (e) => {
              const f = faultInfo(e);
              return `<tr><td><b>${esc(e.id||"—")}</b></td><td><b>${esc(e.name||e.nomenclature||"—")}</b><br><small>${esc(e.location||"")}</small></td><td>${esc(e.status||"Fully Operational")}</td><td>${esc(e.make||"")} ${esc(e.model||"")}</td><td>${esc(e.serial||"—")}</td><td>${esc(e.eilNumber||"—")}</td><td>${esc(f.faultDate||"—")}</td><td>${esc(f.description||"—")}${f.openWOs?`<br><small>WO: ${esc(f.openWOs)}</small>`:""}</td></tr>`;
            };
            const section = (title, rows, cls) => {
              if(!rows.length) return "";
              return `<div class="section"><h2 class="${cls}">${esc(title)} (${rows.length})</h2><table><tr><th>Equip #</th><th>Nomenclature / Facility</th><th>Status</th><th>Make/Model</th><th>Serial #</th><th>EIL #</th><th>Fault Date</th><th>Fault / Deficiency / Open WO Description</th></tr>${rows.map(rowHtml).join("")}</table></div>`;
            };
            const oos = reportEqs.filter(e=>e.status==="Out of Service / Deadline");
            const def = reportEqs.filter(e=>e.status==="Operational with Deficiencies");
            const full = reportEqs.filter(e=>(e.status||"Fully Operational")==="Fully Operational");
            const other = reportEqs.filter(e=>!["Out of Service / Deadline","Operational with Deficiencies","Fully Operational",""] .includes(e.status||""));
            win.document.write(`<html><head><title>Equipment Status Report</title><style>body{font-family:Arial,sans-serif;padding:24px;color:#111;background:#fff}h1{font-size:22px;margin:0 0 4px}p{font-size:12px;color:#666;margin:0 0 18px}.summary{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:16px 0 22px}.box{border:1px solid #e5e7eb;border-radius:12px;padding:12px;background:#f9fafb}.num{font-size:24px;font-weight:800}.label{font-size:11px;color:#667085;text-transform:uppercase;letter-spacing:.4px}.section{margin-bottom:26px}h2{font-size:14px;margin:0 0 8px;padding:8px 10px;border-radius:8px}.red{background:#fee2e2;color:#7f1d1d}.yellow{background:#fef3c7;color:#92400e}.green{background:#dcfce7;color:#14532d}.blue{background:#dbeafe;color:#1e3a8a}table{width:100%;border-collapse:collapse;font-size:12px}th{background:#f3f4f6;padding:8px 10px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:.4px}td{padding:8px 10px;border-bottom:1px solid #e5e7eb;vertical-align:top}small{color:#667085}@media print{button{display:none}.summary{break-inside:avoid}.section{break-inside:auto}}</style></head><body>`);
            win.document.write(`<h1>Equipment Status Report</h1><p>Generated: ${new Date().toLocaleDateString()} — NCA Maintenance Manager</p>`);
            win.document.write(`<div class="summary"><div class="box"><div class="num">${allEquipment.length}</div><div class="label">Total Equipment</div></div><div class="box"><div class="num" style="color:#7f1d1d">${oos.length}</div><div class="label">Out of Service / Deadline</div></div><div class="box"><div class="num" style="color:#92400e">${def.length}</div><div class="label">Operational w/ Deficiencies</div></div><div class="box"><div class="num" style="color:#14532d">${full.length}</div><div class="label">Fully Operational</div></div></div>`);
            win.document.write(section("🚨 Out of Service / Deadline", oos, "red"));
            win.document.write(section("⚠️ Operational with Deficiencies", def, "yellow"));
            win.document.write(section("✅ Fully Operational", full, "green"));
            win.document.write(section("ℹ️ Other Status", other, "blue"));
            if(!reportEqs.length) win.document.write(`<p>No equipment found.</p>`);
            win.document.write(reportButtonsHtml(exportRows)+`</body></html>`);
            win.document.close();
          }}>🖨 Equipment Status Report</Btn>
          <Btn onClick={openAdd}>+ Add New Equipment</Btn>
        </div>
        <div style={{ display:"flex", gap:16, flexWrap:"wrap", alignItems:"flex-end" }}>
          <span style={{ fontFamily:T.sans, fontSize:12, fontWeight:600, color:T.muted, paddingBottom:6 }}>Filter by:</span>
          {[
            ["Category", categories,   typeF,     setTypeF,     180],
            ["Facility",locations,    locationF, setLocationF, 160],
          ].map(([label, opts, val, set, width])=>(
            <div key={label} style={{ display:"flex", flexDirection:"column", gap:4 }}>
              <label style={{ fontFamily:T.sans, fontSize:11, fontWeight:600, color:T.muted, textTransform:"uppercase", letterSpacing:.4 }}>{label}</label>
              <select style={{ ...sel, width }} value={val} onChange={e=>set(e.target.value)}>
                <option value="All">— Select —</option>
                {opts.map(o=><option key={o} value={o}>{o}</option>)}
              </select>
            </div>
          ))}
          <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
            <label style={{ fontFamily:T.sans, fontSize:11, fontWeight:600, color:T.muted, textTransform:"uppercase", letterSpacing:.4 }}>Sort</label>
            <select style={{ ...sel, width:210 }} value={equipSort} onChange={e=>setEquipSort(e.target.value)}>
              <option value="equipAsc">Equip # ascending</option>
              <option value="equipDesc">Equip # descending</option>
            </select>
          </div>
          {(typeF!=="All"||locationF!=="All") && (
            <button onClick={()=>{setTypeF("All");setLocationF("All");}} style={{ background:"none", border:"none", color:T.accent, fontFamily:T.sans, fontSize:12, fontWeight:600, cursor:"pointer", padding:"0 0 6px", alignSelf:"flex-end" }}>
              ✕ Clear filters
            </button>
          )}
        </div>
      </Card>

      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10, flexWrap:"wrap", gap:8 }}>
        <div style={{ fontFamily:T.sans, fontSize:12, color:T.muted }}>
          Showing <strong style={{ color:T.text }}>{filtered.length}</strong> of <strong style={{ color:T.text }}>{state.equipment.length}</strong> equipment
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
                      <div style={{ fontFamily:T.sans, fontSize:10, fontWeight:600, color:T.muted, textTransform:"uppercase", letterSpacing:.4 }}>Nomenclature</div>
                      <div style={{ fontFamily:T.sans, fontSize:14, fontWeight:700, color:T.text, marginTop:3 }}>{eq.name}</div>
                      
                    </div>

                    <div style={{ width:140, flexShrink:0, marginRight:20 }}>
                      <div style={{ fontFamily:T.sans, fontSize:10, fontWeight:600, color:T.muted, textTransform:"uppercase", letterSpacing:.4 }}>Category</div>
                      <div style={{ fontFamily:T.sans, fontSize:13, color:T.subtext, marginTop:3 }}>{eq.category||"—"}</div>
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

              </div>

              {/* ── Attachment Sub-Rows (dropdown) ── */}
              {isExpanded && hasAttach && (
                <div style={{ border:`1px solid ${T.accent}44`, borderTop:"none", borderRadius:"0 0 8px 8px", overflow:"hidden", background:T.accentLt }}>
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
          <div style={{ padding:48, textAlign:"center", color:T.muted, fontFamily:T.sans, fontSize:13, background:T.card, borderRadius:8, border:`1px solid ${T.border}` }}>
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
  const [stockF, setStockF]     = useState("All");
  const [expanded, setExpanded] = useState(null);
  const [invUpdate, setInvUpdate] = useState(null);
  const [poForm, setPoForm]     = useState({ poNumber:"", vendor:"", date:today(), parts:[{name:"",partNumber:"",category:"",qty:"",unit:"ea",unitCost:"",location:"",modelFit:""}] });
  const F = k => e => setForm(f=>({...f,[k]:e.target.value}));
  const partCategories = getPartCategoryOptions(state);
  const modelOptions = getEquipmentModelOptions(state.equipment);
  const cats     = ["All",...partCategories];
  const stockFilters = ["All", "In Stock", "Low Stock", "Out of Stock"];
  const parts = Array.isArray(state.parts) ? state.parts : [];
  const sortedParts = [...parts].sort((a,b)=>(a.partNumber||"").localeCompare(b.partNumber||""));
  const filtered = sortedParts.filter(p=>{
    const mc = catF==="All"||p.category===catF;
    const st = getPartStockStatus(p);
    const msf = stockF==="All"||st===stockF;
    const ms = `${p.name||""} ${p.partNumber||""} ${p.vendor||""} ${p.modelFit||""} ${p.category||""} ${p.location||""}`.toLowerCase().includes(search.toLowerCase());
    return mc&&msf&&ms;
  });

  const totalVal = parts.reduce((s,p)=>s+((+p.qty||0)*(+p.unitCost||0)),0);
  const lowParts = parts.filter(p=>getPartStockStatus(p)==="Low Stock");
  const outParts = parts.filter(p=>getPartStockStatus(p)==="Out of Stock");
  const exportRows = sortedParts.map(p=>{ const eq = p.equipmentId ? (state.equipment||[]).find(e=>e.id===p.equipmentId) : null; return {"Part #":p.partNumber||"", Nomenclature:p.name||"", Category:p.category||"", Location:p.location||"", "Equipment / Model":eq?`${eq.id} - ${eq.name}`:(p.modelFit||""), "Unit $":(+p.unitCost||0).toFixed(2), "Unit Type":p.unit||"ea", Qty:p.qty||0, "Total $":((+p.qty||0)*(+p.unitCost||0)).toFixed(2)}; });
  const openAdd  = () => { setForm({qty:0,minQty:1,unit:"ea",unitCost:0,lowStockAlert:true,modelFit:"",equipmentId:""}); setModal("add"); };
  const openEdit = p  => { setForm({...p}); setModal(p); };
  const save = () => {
    if(!form.name) return alert("Nomenclature required.");
    const cleanForm = { ...form, category:String(form.category||"").trim(), unit:String(form.unit||"ea").trim()||"ea", qty:+form.qty||0, unitCost:+form.unitCost||0, minQty:+form.minQty||0, equipmentId:"" };
    modal==="add"
      ? dispatch({type:"ADD_PART",  payload:{...cleanForm,id:genId("PT")}})
      : dispatch({type:"UPDATE_PART",payload:cleanForm});
    setModal(null);
  };
  const del = id => { if(confirm("Delete part?")) dispatch({type:"DELETE_PART",payload:id}); };

  const openInvUpdate = () => {
    const map = {};
    parts.forEach(p=>{ map[p.id]=String(p.qty); });
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
    const esc = htmlEscape;
    const win = window.open("","_blank","width=900,height=700");
    if(!win) return;
    win.document.write(`<!DOCTYPE html><html><head><title>Parts Inventory Report</title>
      <style>body{font-family:Arial,sans-serif;padding:24px}h1{font-size:18px;margin-bottom:4px}p{font-size:12px;color:#666;margin:0 0 16px}table{width:100%;border-collapse:collapse;font-size:12px}th{background:#1a1a2e;color:#fff;padding:6px 10px;text-align:left;font-size:10px;text-transform:uppercase}td{padding:6px 10px;border-bottom:1px solid #e5e7eb}.low{background:#fff5f5}.total-row{font-weight:700;background:#f3f4f6}@media print{button{display:none}}</style>
      </head><body>
      ${reportHeaderHTML(state, "Parts Inventory Report")}
      <p style="font-size:12px;color:#666;margin-bottom:12px">SKUs: ${parts.length} | Total Value: $${totalVal.toFixed(2)} | Low Stock: ${lowParts.length}</p>
      <table>
        <tr><th>Part #</th><th>Nomenclature</th><th>Category</th><th>Location</th><th>Equipment / Model</th><th style="text-align:right">Unit $</th><th>Unit Type</th><th style="text-align:right">Qty</th><th style="text-align:right">Total $</th><th>New Count</th></tr>
        ${sortedParts.map(p=>{
          const eq = p.equipmentId ? (state.equipment||[]).find(e=>e.id===p.equipmentId) : null;
          const total = (+p.qty||0) * (+p.unitCost||0);
          return `<tr class="${(+p.qty||0)<=(+p.minQty||0)?"low":""}"><td>${esc(p.partNumber||"—")}</td><td>${esc(p.name||"—")}</td><td>${esc(p.category||"—")}</td><td>${esc(p.location||"—")}</td><td>${esc(eq?`${eq.id} - ${eq.name}`:(p.modelFit||"—"))}</td><td style="text-align:right">$${(+p.unitCost||0).toFixed(2)}</td><td>${esc(p.unit||"ea")}</td><td style="text-align:right">${(+p.qty||0).toLocaleString()}</td><td style="text-align:right">$${total.toFixed(2)}</td><td style="border-bottom:1px solid #bbb;min-width:80px">&nbsp;</td></tr>`;
        }).join("")}
        <tr class="total-row"><td colspan="8" style="text-align:right;padding:8px 10px">TOTAL INVENTORY VALUE</td><td style="text-align:right;padding:8px 10px">$${totalVal.toFixed(2)}</td><td></td></tr>
      </table>
      ${reportButtonsHtml(exportRows)}
      </body></html>`);
    win.document.close();
  };

  const savePO = () => {
    const valid = poForm.parts.filter(p=>p.name.trim());
    if(!valid.length) return alert("Add at least one part.");
    valid.forEach(p=>{
      dispatch({type:"ADD_PART",payload:{...p,equipmentId:"",category:String(p.category||"").trim(),id:genId("PT"),qty:+p.qty||0,unit:String(p.unit||"ea").trim()||"ea",unitCost:+p.unitCost||0,minQty:1,lowStockAlert:true,vendor:poForm.vendor,poNumber:poForm.poNumber,dateReceived:poForm.date,modelFit:String(p.modelFit||"").trim()}});
    });
    setModal(null);
    setPoForm({poNumber:"",vendor:"",date:today(),parts:[{name:"",partNumber:"",category:"",qty:"",unit:"ea",unitCost:"",location:"",modelFit:""}]});
  };
  const addPoRow = () => setPoForm(f=>({...f,parts:[...f.parts,{name:"",partNumber:"",category:"",qty:"",unit:"ea",unitCost:"",location:"",modelFit:""}]}));
  const setPoRow = (i,k,v) => setPoForm(f=>{ const pts=[...f.parts]; pts[i]={...pts[i],[k]:v}; return {...f,parts:pts}; });
  const delPoRow = i => setPoForm(f=>{ const pts=[...f.parts]; pts.splice(i,1); return {...f,parts:pts}; });

  return (
    <div>
      <datalist id="part-category-options">{partCategories.map(c=><option key={c} value={c} />)}</datalist>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(160px,1fr))", gap:12, marginBottom:16 }}>
        {[["Inventory Value","$"+totalVal.toLocaleString("en-US",{minimumFractionDigits:2}),T.accent],["Total SKUs",parts.length,T.text],["Low Stock",lowParts.length,T.amber],["Out of Stock",outParts.length,T.red]].map(([l,v,c])=>(
          <Card key={l} style={{ padding:"14px 16px" }}>
            <div style={{ fontFamily:T.sans, fontSize:22, fontWeight:700, color:c }}>{v}</div>
            <div style={{ fontFamily:T.sans, fontSize:12, color:T.muted, marginTop:3 }}>{l}</div>
          </Card>
        ))}
      </div>
      <div style={{ display:"flex", justifyContent:"space-between", marginBottom:12, gap:8, flexWrap:"wrap" }}>
        <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
          <input style={{ ...inp, maxWidth:240 }} placeholder="Search parts..." value={search} onChange={e=>setSearch(e.target.value)} />
          <select style={{ ...sel, maxWidth:180 }} value={catF} onChange={e=>setCatF(e.target.value)}>{cats.map(c=><option key={c}>{c}</option>)}</select>
          <select style={{ ...sel, maxWidth:170 }} value={stockF} onChange={e=>setStockF(e.target.value)}>{stockFilters.map(c=><option key={c}>{c}</option>)}</select>
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
              <button onClick={saveInvUpdate} style={{ background:T.card, border:"none", borderRadius:6, padding:"5px 14px", color:T.accent, cursor:"pointer", fontFamily:T.sans, fontSize:12, fontWeight:700 }}>Save All</button>
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
              {["Part Number","Name","Category","Unit Cost","Unit","Qty","Total Value",""].map(h=>(
                <th key={h} style={{ padding:"10px 12px", textAlign:"left", fontWeight:600, fontSize:11, color:T.muted, textTransform:"uppercase", letterSpacing:.4, whiteSpace:"nowrap" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((p,i)=>{
              const linkedEq = p.equipmentId ? state.equipment.find(e=>e.id===p.equipmentId) : null;
              const stockStatus = getPartStockStatus(p);
              const isOut = stockStatus === "Out of Stock";
              const isLow = stockStatus === "Low Stock";
              return (
                <React.Fragment key={p.id}>
                  <tr onClick={()=>setExpanded(expanded===p.id?null:p.id)}
                    style={{ borderBottom:expanded===p.id?"none":`1px solid ${T.border}`, background:isLow?"#fff8f8":i%2===0?"#fff":T.grayLt, cursor:"pointer" }}
                    onMouseEnter={e=>e.currentTarget.style.background=T.accentLt}
                    onMouseLeave={e=>e.currentTarget.style.background=isLow?"#fff8f8":i%2===0?"#fff":T.grayLt}>
                    <td style={{ padding:"10px 12px", fontFamily:T.mono, fontSize:12, color:T.accent }}>{p.partNumber||"—"}</td>
                    <td style={{ padding:"10px 12px", fontWeight:600, color:T.text }}>
                      {p.name}{isOut&&<span style={{ color:T.red, marginLeft:6, fontSize:11 }}>Out</span>}{isLow&&<span style={{ color:T.amber, marginLeft:6, fontSize:11 }}>⚠ Low</span>}
                      {linkedEq&&<div style={{ fontSize:10, color:T.accent, fontWeight:500, marginTop:1 }}>For: {linkedEq.name} ({linkedEq.id})</div>}
                      {!linkedEq&&p.modelFit&&<div style={{ fontSize:10, color:T.muted, marginTop:1 }}>Fits: {p.modelFit}</div>}
                    </td>
                    <td style={{ padding:"10px 12px", color:T.subtext }}>{p.category||"—"}</td>
                    <td style={{ padding:"10px 12px", fontFamily:T.mono, fontSize:12 }}>${(+p.unitCost||0).toFixed(2)}</td>
                    <td style={{ padding:"10px 12px", fontFamily:T.mono, fontSize:12 }}>{p.unit||"ea"}</td>
                    <td style={{ padding:"10px 12px", fontFamily:T.mono, fontSize:13, fontWeight:700, color:isOut?T.red:isLow?T.amber:T.green }}>{p.qty}<div style={{ fontFamily:T.sans, fontSize:10, fontWeight:600 }}>{stockStatus}</div></td>
                    <td style={{ padding:"10px 12px", fontFamily:T.mono, fontSize:12, color:T.subtext }}>${(p.qty*(+p.unitCost||0)).toFixed(2)}</td>
                    <td style={{ padding:"10px 12px" }} onClick={e=>e.stopPropagation()}>
                      <Btn small variant="secondary" onClick={()=>openEdit(p)} style={{ marginRight:4 }}>Edit</Btn>
                      <Btn small variant="danger" onClick={()=>del(p.id)}>Del</Btn>
                    </td>
                  </tr>
                  {expanded===p.id && (
                    <tr style={{ borderBottom:`1px solid ${T.border}` }}>
                      <td colSpan={8} style={{ padding:"12px 20px", background:T.accentLt }}>
                        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(180px,1fr))", gap:"10px 24px", marginBottom:12 }}>
                          {[["Vendor",p.vendor],["Location",p.location],["Unit Type",p.unit||"ea"],["Stock Status",stockStatus],["Min Qty",p.minQty],["PO Number",p.poNumber],["Date Received",p.dateReceived],["Fits Model",p.modelFit]].filter(([,v])=>v).map(([k,v])=>(
                            <div key={k}><div style={{ fontFamily:T.sans, fontSize:10, fontWeight:700, color:T.muted, textTransform:"uppercase", letterSpacing:.4 }}>{k}</div><div style={{ fontFamily:T.sans, fontSize:13, color:T.text, marginTop:3 }}>{v}</div></div>
                          ))}
                        </div>
                        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                          <span style={{ fontFamily:T.sans, fontSize:12, fontWeight:600, color:T.subtext }}>Low Stock Alert:</span>
                          <button type="button" onClick={()=>dispatch({type:"UPDATE_PART",payload:{...p,lowStockAlert:!(p.lowStockAlert!==false)}})}
                            style={{ width:44, height:24, borderRadius:12, border:"none", background:p.lowStockAlert!==false?T.accent:"#d1d5db", cursor:"pointer", position:"relative", transition:"background .2s" }}>
                            <span style={{ position:"absolute", top:3, left:p.lowStockAlert!==false?22:3, width:18, height:18, borderRadius:"50%", background:T.card, transition:"left .2s", display:"block" }}/>
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
            <Field label="Category" half><input style={inp} list="part-category-options" value={form.category||""} onChange={F("category")} placeholder="Pick or type category" /></Field>
            <Field label="Fits Model" half><input style={inp} list="part-model-options" value={form.modelFit||""} onChange={F("modelFit")} placeholder="e.g. John Deere 5065E" /></Field>
            <datalist id="part-model-options">{modelOptions.map(m=><option key={m} value={m} />)}</datalist>
            <Field label="Vendor" half><input style={inp} value={form.vendor||""} onChange={F("vendor")} /></Field>
            <Field label="PO Number" half><input style={inp} value={form.poNumber||""} onChange={F("poNumber")} /></Field>
            <Field label="Facility" half><input style={inp} value={form.location||""} onChange={F("location")} /></Field>
            <Field label="Date Received" half><input style={inp} type="date" value={form.dateReceived||""} onChange={F("dateReceived")} /></Field>
            <Field label="Unit Cost ($)" half><input style={inp} type="number" value={form.unitCost||0} onChange={F("unitCost")} /></Field>
            <Field label="Qty on Hand" half><input style={inp} type="number" value={form.qty||0} onChange={F("qty")} /></Field>
            <Field label="Unit Type" half><select style={sel} value={form.unit||"ea"} onChange={e=>handleUnitSelectChange(e.target.value, form.unit||"ea", v=>setForm(f=>({...f,unit:v})))}>{getUnitOptionsFromState(state).map(u=><option key={u} value={u}>{u}</option>)}<option value="__new_unit__">+ Add new...</option></select></Field>
            <Field label="Min Qty (Low Stock)" half><input style={inp} type="number" value={form.minQty||1} onChange={F("minQty")} /></Field>
            <div style={{ marginBottom:14, gridColumn:"span 2", display:"flex", alignItems:"center", gap:12 }}>
              <label style={{ fontFamily:T.sans, fontSize:12, fontWeight:600, color:T.subtext }}>Low Stock Alert:</label>
              <button type="button" onClick={()=>setForm(f=>({...f,lowStockAlert:!(f.lowStockAlert!==false)}))}
                style={{ width:44, height:24, borderRadius:12, border:"none", background:form.lowStockAlert!==false?T.accent:"#d1d5db", cursor:"pointer", position:"relative", transition:"background .2s" }}>
                <span style={{ position:"absolute", top:3, left:form.lowStockAlert!==false?22:3, width:18, height:18, borderRadius:"50%", background:T.card, transition:"left .2s", display:"block" }}/>
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
          <div style={{ display:"grid", gridTemplateColumns:"2fr 1fr 1fr 55px 80px 65px 1fr 1fr auto", gap:6, marginBottom:6, background:T.grayLt, padding:"6px 8px", borderRadius:6 }}>
            {["Name*","Part #","Category","Qty","Unit","$/Unit","Location","Fits Model",""].map(h=><div key={h} style={{ fontFamily:T.sans, fontSize:10, fontWeight:700, color:T.muted, textTransform:"uppercase", letterSpacing:.4 }}>{h}</div>)}
          </div>
          {poForm.parts.map((p,i)=>(
            <div key={i} style={{ display:"grid", gridTemplateColumns:"2fr 1fr 1fr 55px 80px 65px 1fr 1fr auto", gap:6, marginBottom:6, alignItems:"center" }}>
              <input style={inp} placeholder="Part name*" value={p.name} onChange={e=>setPoRow(i,"name",e.target.value)} />
              <input style={inp} placeholder="Part #" value={p.partNumber} onChange={e=>setPoRow(i,"partNumber",e.target.value)} />
              <input style={inp} list="part-category-options" placeholder="Category" value={p.category} onChange={e=>setPoRow(i,"category",e.target.value)} />
              <input style={inp} type="number" placeholder="Qty" value={p.qty} onChange={e=>setPoRow(i,"qty",e.target.value)} />
              <select style={sel} value={p.unit||"ea"} onChange={e=>handleUnitSelectChange(e.target.value, p.unit||"ea", v=>setPoRow(i,"unit",v))}>{getUnitOptionsFromState(state).map(u=><option key={u} value={u}>{u}</option>)}<option value="__new_unit__">+ Add new...</option></select>
              <input style={inp} type="number" step="0.01" placeholder="0.00" value={p.unitCost} onChange={e=>setPoRow(i,"unitCost",e.target.value)} />
              <input style={inp} placeholder="Facility" value={p.location} onChange={e=>setPoRow(i,"location",e.target.value)} />
              <input style={inp} list="po-model-options" placeholder="Fits model" value={p.modelFit||""} onChange={e=>setPoRow(i,"modelFit",e.target.value)} />
              <datalist id="po-model-options">{modelOptions.map(m=><option key={m} value={m} />)}</datalist>
              {poForm.parts.length>1?<button onClick={()=>delPoRow(i)} style={{ background:"none", border:`1px solid ${T.red}`, borderRadius:5, color:T.red, cursor:"pointer", padding:"6px 8px", fontFamily:T.sans, fontSize:12, fontWeight:600 }}>X</button>:<div/>}
            </div>
          ))}
          <button onClick={addPoRow} style={{ background:"none", border:`1px dashed ${T.borderHi}`, borderRadius:6, padding:"7px 14px", color:T.accent, cursor:"pointer", fontFamily:T.sans, fontSize:12, fontWeight:600, width:"100%", marginBottom:12 }}>+ Add Another Part</button>
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


/* INSPECTIONS */
function Inspections({ state, dispatch }) {
  const equipment = state.equipment || [];
  const tasks = state.inspectionTasks || [];
  const schedules = state.inspectionSchedules || [];
  const [modal, setModal] = useState(null);
  const [taskForm, setTaskForm] = useState({ id:null, name:"", frequency:"Monthly", steps:"", notes:"", attachments:[] });
  const [scheduleForm, setScheduleForm] = useState({ id:null, equipmentId:"", taskId:"", timeInterval:1, timeUnit:"months", lastInspectionDate:"", nextDueDate:today(), notes:"" });
  const [selectedTask, setSelectedTask] = useState(null);
  const [showInspectionLibrary, setShowInspectionLibrary] = useState(false);
  const [inspectionEveryFilter, setInspectionEveryFilter] = useState("All");
  const [inspectionDueSort, setInspectionDueSort] = useState("asc");
  const [expandedInspectionEquipment, setExpandedInspectionEquipment] = useState({});

  const taskById = id => tasks.find(t=>t.id===id) || null;
  const eqById = id => equipment.find(e=>e.id===id) || null;
  const stepLines = (txt="") => String(txt||"").split(/\n/).filter((x,i,arr)=>x.trim() || arr.length===1);
  const taskStepRows = (txt="") => {
    const rows = String(txt ?? "").split(/\n/);
    return rows.length ? rows : [""];
  };

  const openTask = (task=null) => {
    const base = task || { id:null, name:"", frequency:"Monthly", steps:"", notes:"", attachments:[] };
    setTaskForm({ ...base, attachments:Array.isArray(base.attachments)?base.attachments:[] });
    setSelectedTask(task || null);
    setModal("task");
  };

  const openSchedule = (schedule=null) => {
    const base = schedule || { id:null, equipmentId:"", taskId:"", timeInterval:1, timeUnit:"months", lastInspectionDate:"", nextDueDate:today(), notes:"" };
    setScheduleForm({ ...base, lastInspectionDate:base.lastInspectionDate || base.lastDoneDate || base.lastTriggered || "" });
    setModal("schedule");
  };

  const saveTask = () => {
    if(!taskForm.name?.trim()) { alert("Add an inspection task name."); return; }
    const payload = { ...taskForm, id:taskForm.id || genId("IT"), name:taskForm.name.trim(), attachments:Array.isArray(taskForm.attachments)?taskForm.attachments:[] };
    dispatch({ type: taskForm.id ? "UPDATE_INSPECTION_TASK" : "ADD_INSPECTION_TASK", payload });
    setSelectedTask(payload);
    setShowInspectionLibrary(true);
    setModal(null);
  };

  const saveSchedule = () => {
    if(!scheduleForm.equipmentId || !scheduleForm.taskId) { alert("Choose equipment and an inspection task."); return; }
    const selected = taskById(scheduleForm.taskId);
    const inherited = intervalFromInspectionTask(selected);
    const calculatedNextDue = scheduleForm.lastInspectionDate
      ? nextDateFrom(scheduleForm.lastInspectionDate, inherited.timeInterval, inherited.timeUnit)
      : (scheduleForm.nextDueDate || today());
    const payload = {
      ...scheduleForm,
      ...inherited,
      frequency:selected?.frequency || scheduleForm.frequency || "Monthly",
      nextDueDate:calculatedNextDue,
      lastDoneDate:scheduleForm.lastInspectionDate || scheduleForm.lastDoneDate || "",
      lastTriggered:scheduleForm.lastTriggered || scheduleForm.lastInspectionDate || "",
      id:scheduleForm.id || genId("IS"),
      created:scheduleForm.created || today()
    };
    dispatch({ type: scheduleForm.id ? "UPDATE_INSPECTION_SCHEDULE" : "ADD_INSPECTION_SCHEDULE", payload });
    setModal(null);
  };

  const addTaskFiles = async (files) => {
    const list = Array.from(files || []);
    if(list.length === 0) return;
    const loaded = await Promise.all(list.map(file => new Promise(resolve => {
      const reader = new FileReader();
      reader.onload = () => resolve({ id:genId("FILE"), name:file.name, type:file.type || "file", size:file.size, dataUrl:reader.result });
      reader.onerror = () => resolve({ id:genId("FILE"), name:file.name, type:file.type || "file", size:file.size, dataUrl:"" });
      reader.readAsDataURL(file);
    })));
    setTaskForm(f=>({ ...f, attachments:[...(f.attachments||[]), ...loaded] }));
  };

  const removeTaskFile = (id) => setTaskForm(f=>({ ...f, attachments:(f.attachments||[]).filter(a=>a.id!==id) }));

  const nextDateFrom = (date, interval, unit) => {
    const d = new Date(date || today());
    const n = Number(interval || 1);
    if(unit === "days") d.setDate(d.getDate() + n);
    if(unit === "weeks") d.setDate(d.getDate() + (n * 7));
    if(unit === "months") d.setMonth(d.getMonth() + n);
    if(unit === "years") d.setFullYear(d.getFullYear() + n);
    return d.toISOString().split("T")[0];
  };

  const setScheduleTask = (taskId) => {
    const selected = taskById(taskId);
    const inherited = intervalFromInspectionTask(selected);
    setScheduleForm(f=>({
      ...f,
      taskId,
      ...inherited,
      frequency:selected?.frequency || f.frequency || "Monthly",
      nextDueDate:f.lastInspectionDate ? nextDateFrom(f.lastInspectionDate, inherited.timeInterval, inherited.timeUnit) : f.nextDueDate
    }));
  };

  const setScheduleLastInspectionDate = (date) => {
    setScheduleForm(f=>{
      const selected = taskById(f.taskId);
      const inherited = intervalFromInspectionTask(selected);
      return {
        ...f,
        ...inherited,
        lastInspectionDate:date,
        lastDoneDate:date,
        nextDueDate:date ? nextDateFrom(date, inherited.timeInterval, inherited.timeUnit) : f.nextDueDate
      };
    });
  };

  const intervalFromInspectionTask = (task) => {
    const f = normalizeInspectionFrequency(task?.frequency || "Monthly");
    if(f === "Daily") return { timeInterval:1, timeUnit:"days" };
    if(f === "Weekly") return { timeInterval:1, timeUnit:"weeks" };
    if(f === "Quarterly") return { timeInterval:3, timeUnit:"months" };
    if(f === "Semi-Annual") return { timeInterval:6, timeUnit:"months" };
    if(f === "Annual") return { timeInterval:1, timeUnit:"years" };
    return { timeInterval:1, timeUnit:"months" };
  };

  const genInspectionWOInfo = (eqId) => {
    const base = String(eqId || "EQ").trim() || "EQ";
    const related = (state.workOrders || []).filter(w =>
      w.woType === "Inspection" &&
      String(w.equipment || w.equipmentId || "") === base
    );
    const usedNums = related.map(w => {
      const match = String(w.id || "").match(/-I(?:WO)?(\d+)$/i);
      return match ? parseInt(match[1], 10) : (+w.inspectionSequence || 0);
    }).filter(n => Number.isFinite(n) && n > 0);
    const next = usedNums.length ? Math.max(...usedNums) + 1 : related.length + 1;
    return { id:`${base}-I${String(next).padStart(2,"0")}`, sequence:next };
  };

  const genInspectionWOId = (eqId) => genInspectionWOInfo(eqId).id;

  const normalizeInspectionFrequency = (value) => {
    const v = String(value || "").toLowerCase().replace(/[^a-z]/g, "");
    if(v === "daily") return "Daily";
    if(v === "weekly") return "Weekly";
    if(v === "monthly") return "Monthly";
    if(v === "quarterly") return "Quarterly";
    if(v === "semiannual" || v === "semianual" || v === "biannual" || v === "bianual") return "Semi-Annual";
    if(v === "annual" || v === "yearly") return "Annual";
    return "";
  };

  const scheduleFrequencyLabel = (schedule) => {
    const task = taskById(schedule.taskId);
    const fromTask = normalizeInspectionFrequency(task?.frequency || schedule.frequency);
    if(fromTask) return fromTask;
    const n = Number(schedule.timeInterval || 0);
    const unit = String(schedule.timeUnit || "").toLowerCase();
    if(n === 1 && unit === "days") return "Daily";
    if(n === 1 && unit === "weeks") return "Weekly";
    if(n === 1 && unit === "months") return "Monthly";
    if(n === 3 && unit === "months") return "Quarterly";
    if(n === 6 && unit === "months") return "Semi-Annual";
    if((n === 1 && unit === "years") || (n === 12 && unit === "months")) return "Annual";
    return `${schedule.timeInterval || "—"} ${schedule.timeUnit || ""}`.trim();
  };

  const matchesInspectionEvery = (schedule) => {
    if(inspectionEveryFilter === "All") return true;
    return scheduleFrequencyLabel(schedule) === inspectionEveryFilter;
  };

  const filteredSchedules = [...schedules]
    .filter(matchesInspectionEvery)
    .sort((a,b)=> inspectionDueSort === "asc"
      ? String(a.nextDueDate || "9999-12-31").localeCompare(String(b.nextDueDate || "9999-12-31"))
      : String(b.nextDueDate || "").localeCompare(String(a.nextDueDate || ""))
    );

  const groupedInspectionSchedules = filteredSchedules.reduce((groups, schedule) => {
    const key = String(schedule.equipmentId || "NO-EQUIPMENT");
    if(!groups[key]) groups[key] = [];
    groups[key].push(schedule);
    return groups;
  }, {});

  const inspectionEquipmentRows = Object.entries(groupedInspectionSchedules)
    .map(([equipmentId, items]) => {
      const eq = eqById(equipmentId);
      const sortedItems = [...items].sort((a,b)=>String(a.nextDueDate || "9999-12-31").localeCompare(String(b.nextDueDate || "9999-12-31")));
      const nextDue = sortedItems[0]?.nextDueDate || "";
      const overdueCount = sortedItems.filter(x => x.nextDueDate && x.nextDueDate < today()).length;
      return { equipmentId, eq, items:sortedItems, nextDue, overdueCount };
    })
    .sort((a,b)=> inspectionDueSort === "asc"
      ? String(a.nextDue || "9999-12-31").localeCompare(String(b.nextDue || "9999-12-31"))
      : String(b.nextDue || "").localeCompare(String(a.nextDue || ""))
    );

  const toggleInspectionEquipment = (equipmentId) => {
    setExpandedInspectionEquipment(prev => ({ ...prev, [equipmentId]: !prev[equipmentId] }));
  };

  const triggerInspection = (schedule) => {
    const task = taskById(schedule.taskId);
    const eq = eqById(schedule.equipmentId);
    if(!task || !eq) { alert("Missing task or equipment for this inspection."); return; }
    const steps = stepLines(task.steps);
    const iwo = genInspectionWOInfo(eq.id);
    const wo = {
      id:iwo.id,
      inspectionSequence:iwo.sequence,
      woType:"Inspection",
      title:`Inspection - ${task.name}`,
      inspectionTaskName:task.name,
      equipment:eq.id,
      equipmentStatus:"Fully Operational",
      status:"Open",
      priority:"Normal",
      created:today(),
      due:schedule.nextDueDate || today(),
      completed:"",
      tech:"",
      usageReading:"N/A",
      usageType:"N/A",
      faultEnabled:true,
      faultDescription:task.name,
      problem:task.name,
      description:task.name,
      workPerformed: buildNumberedStepsText(task.steps),
      mechanicNotes: task.notes || "",
      inspectionTaskId:task.id,
      inspectionScheduleId:schedule.id,
      inspectionSteps:steps.join("\n"),
      steps,
      inspectionStepResults:steps.map((step,i)=>({ id:`${genId("STEP")}-${i}`, step, result:"", comment:"" })),
      inspectionAttachments:Array.isArray(task.attachments)?task.attachments:[],
      partsUsed:[], labor:[],
    };
    dispatch({ type:"ADD_WO", payload:wo });
    dispatch({ type:"UPDATE_INSPECTION_SCHEDULE", payload:{ ...schedule, lastTriggered:today() } });
    alert(`Inspection Work Order ${wo.id} created.`);
  };

  const updateStep = (idx, value) => {
    setTaskForm(f=>{
      const lines = taskStepRows(f.steps);
      lines[idx] = value;
      return { ...f, steps:lines.join("\n") };
    });
  };
  const addStep = () => setTaskForm(f=>({ ...f, steps:[...taskStepRows(f.steps), ""].join("\n") }));
  const copyInspectionTask = (task) => {
    const clone = { ...task, id:null, name:`Copy of ${task.name||"Inspection Task"}`, created:today() };
    setTaskForm({ ...clone, attachments:Array.isArray(clone.attachments)?clone.attachments:[] });
    setSelectedTask(null);
    setModal("task");
  };
  const removeStep = (idx) => setTaskForm(f=>{
    const lines = taskStepRows(f.steps).filter((_,i)=>i!==idx);
    return { ...f, steps:(lines.length ? lines : [""]).join("\n") };
  });

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", gap:12, flexWrap:"wrap" }}>
        <div>
          <h1 style={{ margin:0, fontFamily:T.sans, color:T.text, fontSize:24 }}>Inspections</h1>
          <p style={{ margin:"4px 0 0", fontFamily:T.sans, color:T.subtext, fontSize:13 }}>Create inspection tasks, attach existing inspection sheets, assign them to equipment, and generate Inspection Work Orders by time.</p>
        </div>
        <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
          <Btn variant="secondary" onClick={()=>openTask()}>+ Inspection Task</Btn>
          <Btn variant="secondary" onClick={()=>setShowInspectionLibrary(v=>!v)}>Inspection Tasks Library</Btn>
          <Btn onClick={()=>openSchedule()}>Assign Task to Equipment</Btn>
        </div>
      </div>

      {showInspectionLibrary && <Card title="Inspection Tasks Library" right={<span style={{ fontFamily:T.mono, color:T.muted }}>{tasks.length} tasks</span>}>
        <div style={{ overflowX:"auto" }}>
          <table style={{ width:"100%", borderCollapse:"collapse", fontFamily:T.sans, fontSize:13 }}>
            <thead><tr style={{ background:T.grayLt }}>
              {['Task Name','Frequency','Steps','Attachments','Notes','Actions'].map(h=><th key={h} style={{ textAlign:"left", padding:"10px", borderBottom:`1px solid ${T.border}`, color:T.subtext }}>{h}</th>)}
            </tr></thead>
            <tbody>
              {tasks.length===0 && <tr><td colSpan="6" style={{ padding:16, color:T.muted }}>No inspection tasks yet.</td></tr>}
              {tasks.map(t=>{
                const steps=stepLines(t.steps);
                return <tr key={t.id} onClick={()=>setSelectedTask(t)} style={{ cursor:"pointer", borderBottom:`1px solid ${T.border}`, background:selectedTask?.id===t.id?T.grayLt:"transparent" }}>
                  <td style={{ padding:"10px", fontWeight:700, color:T.text }}>{t.name}</td>
                  <td style={{ padding:"10px", color:T.subtext }}>{t.frequency||"—"}</td>
                  <td style={{ padding:"10px", color:T.subtext }}>{steps.length}</td>
                  <td style={{ padding:"10px", color:T.subtext }}>{(t.attachments||[]).length}</td>
                  <td style={{ padding:"10px", color:T.subtext, maxWidth:260, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{t.notes||"—"}</td>
                  <td style={{ padding:"10px" }}><div style={{ display:"flex", gap:6 }}><Btn variant="secondary" onClick={(e)=>{e.stopPropagation(); openTask(t);}}>Edit</Btn><Btn variant="secondary" onClick={(e)=>{e.stopPropagation(); copyInspectionTask(t);}}>Copy</Btn></div></td>
                </tr>;
              })}
            </tbody>
          </table>
        </div>
        {selectedTask && <div style={{ marginTop:14, border:`1px solid ${T.border}`, borderRadius:14, padding:14, background:T.card }}>
          <div style={{ display:"flex", justifyContent:"space-between", gap:10, flexWrap:"wrap", alignItems:"center" }}>
            <div>
              <div style={{ fontWeight:800, color:T.text }}>{selectedTask.name}</div>
              <div style={{ color:T.subtext, fontSize:12 }}>{selectedTask.frequency||"No frequency"} • {(selectedTask.attachments||[]).length} attachment(s)</div>
            </div>
            <div style={{ display:"flex", gap:8 }}><Btn variant="secondary" onClick={()=>openTask(selectedTask)}>Edit Task</Btn><Btn variant="secondary" onClick={()=>copyInspectionTask(selectedTask)}>Copy Task</Btn></div>
          </div>
          <div style={{ marginTop:12, display:"grid", gap:8 }}>
            {stepLines(selectedTask.steps).length===0 ? <div style={{ color:T.muted }}>No steps added.</div> : stepLines(selectedTask.steps).map((step,i)=>(
              <div key={i} style={{ display:"grid", gridTemplateColumns:"48px minmax(220px,1fr)", gap:8, alignItems:"center", padding:8, border:`1px solid ${T.border}`, borderRadius:10 }}>
                <div style={{ fontWeight:800, color:T.subtext }}>{i+1}.</div>
                <div>{step}</div>
              </div>
            ))}
          </div>
          {(selectedTask.attachments||[]).length>0 && <div style={{ marginTop:12 }}>
            <div style={{ fontWeight:700, marginBottom:6 }}>Attached Inspection Sheets</div>
            <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>{selectedTask.attachments.map(a=><a key={a.id||a.name} href={a.dataUrl||"#"} download={a.name} style={{ color:T.blue, fontSize:13 }}>{a.name}</a>)}</div>
          </div>}
        </div>}
      </Card>}

      <Card title="Inspection Schedule / Triggers" right={<span style={{ fontFamily:T.mono, color:T.muted }}>{filteredSchedules.length} inspections / {inspectionEquipmentRows.length} equipment</span>}>
        <div style={{ display:"flex", gap:10, flexWrap:"wrap", alignItems:"end", marginBottom:12 }}>
          <Field label="Every"><select style={{...inp, minWidth:190}} value={inspectionEveryFilter} onChange={e=>setInspectionEveryFilter(e.target.value)}>{["All","Daily","Weekly","Monthly","Quarterly","Semi-Annual","Annual"].map(x=><option key={x} value={x}>{x}</option>)}</select></Field>
          <Field label="Next Due"><select style={{...inp, minWidth:210}} value={inspectionDueSort} onChange={e=>setInspectionDueSort(e.target.value)}><option value="asc">Next Due Ascending</option><option value="desc">Next Due Descending</option></select></Field>
        </div>
        <div style={{ display:"grid", gap:10 }}>
          {inspectionEquipmentRows.length===0 && <div style={{ padding:16, color:T.muted, border:`1px solid ${T.border}`, borderRadius:12 }}>No inspection schedules match this filter.</div>}
          {inspectionEquipmentRows.map(row=>{
            const equipmentTitle = row.eq?.name || row.eq?.nomenclature || "No nomenclature";
            const isExpanded = !!expandedInspectionEquipment[row.equipmentId];
            return <div key={row.equipmentId} style={{ border:`1px solid ${T.border}`, borderRadius:14, overflow:"hidden", background:T.card }}>
              <button type="button" onClick={()=>toggleInspectionEquipment(row.equipmentId)} style={{ width:"100%", border:"none", background:isExpanded?T.grayLt:"transparent", cursor:"pointer", padding:0, textAlign:"left" }}>
                <div style={{ display:"grid", gridTemplateColumns:"minmax(120px,.7fr) minmax(180px,1fr) 140px 140px 90px", gap:10, alignItems:"center", padding:"12px 14px", color:T.text }}>
                  <div style={{ fontFamily:T.mono, fontWeight:900 }}>{row.eq?.id || row.equipmentId}</div>
                  <div>
                    <div style={{ fontWeight:800 }}>{equipmentTitle}</div>
                    <div style={{ color:T.muted, fontSize:12 }}>{row.items.length} assigned inspection{row.items.length===1?"":"s"}{row.overdueCount ? ` • ${row.overdueCount} overdue` : ""}</div>
                  </div>
                  <div style={{ color:T.subtext, fontSize:12 }}><b style={{ color:T.text }}>Next Due:</b><br/><span style={{ fontFamily:T.mono }}>{row.nextDue || "—"}</span></div>
                  <div style={{ color:T.subtext, fontSize:12 }}><b style={{ color:T.text }}>Soonest Task:</b><br/>{taskById(row.items[0]?.taskId)?.name || "—"}</div>
                  <div style={{ justifySelf:"end", fontWeight:900, color:T.blue }}>{isExpanded ? "▲" : "▼"}</div>
                </div>
              </button>
              {isExpanded && <div style={{ padding:12, borderTop:`1px solid ${T.border}`, background:T.card }}>
                <div style={{ overflowX:"auto" }}>
                  <table style={{ width:"100%", borderCollapse:"collapse", fontFamily:T.sans, fontSize:13 }}>
                    <thead><tr style={{ background:T.grayLt }}>
                      {["Inspection Task","Every","Last Inspection","Next Inspection","Last Triggered","Notes","Actions"].map(h=><th key={h} style={{ textAlign:"left", padding:"10px", borderBottom:`1px solid ${T.border}`, color:T.subtext }}>{h}</th>)}
                    </tr></thead>
                    <tbody>
                      {row.items.map(s=>{ const task=taskById(s.taskId); return (
                        <tr key={s.id} style={{ borderBottom:`1px solid ${T.border}` }}>
                          <td style={{ padding:"10px", fontWeight:800, color:T.text }}>{task?.name || "Missing task"}</td>
                          <td style={{ padding:"10px", color:T.subtext }}>{scheduleFrequencyLabel(s)}</td>
                          <td style={{ padding:"10px", fontFamily:T.mono, color:T.subtext }}>{s.lastInspectionDate || s.lastDoneDate || "—"}</td>
                          <td style={{ padding:"10px", fontFamily:T.mono, color:T.text }}>{s.nextDueDate || "—"}</td>
                          <td style={{ padding:"10px", fontFamily:T.mono, color:T.subtext }}>{s.lastTriggered || "—"}</td>
                          <td style={{ padding:"10px", maxWidth:220, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis", color:T.subtext }}>{s.notes || "—"}</td>
                          <td style={{ padding:"10px" }}><div style={{ display:"flex", gap:6, flexWrap:"wrap" }}><Btn variant="secondary" onClick={()=>triggerInspection(s)}>Trigger WO</Btn><Btn variant="secondary" onClick={()=>openSchedule(s)}>Edit</Btn><Btn variant="danger" onClick={()=>{if(confirm("Delete this inspection assignment?")) dispatch({type:"DELETE_INSPECTION_SCHEDULE", payload:s.id});}}>Delete</Btn></div></td>
                        </tr>
                      );})}
                    </tbody>
                  </table>
                </div>
              </div>}
            </div>;
          })}
        </div>
      </Card>

      {modal==="task" && (
        <Modal title={taskForm.id?"Edit Inspection Task":"New Inspection Task"} onClose={()=>setModal(null)}>
          <div style={{ display:"grid", gap:12 }}>
            <Field label="Task Name"><input style={inp} value={taskForm.name||""} onChange={e=>setTaskForm(f=>({...f,name:e.target.value}))} placeholder="e.g. Monthly safety inspection" /></Field>
            <Field label="Default Frequency"><select style={inp} value={taskForm.frequency||"Monthly"} onChange={e=>setTaskForm(f=>({...f,frequency:e.target.value}))}>{["Daily","Weekly","Monthly","Quarterly","Semi-Annual","Annual"].map(x=><option key={x}>{x}</option>)}</select></Field>
            <Field label="Upload Existing Inspection Sheet"><input style={inp} type="file" multiple accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,image/*" onChange={e=>addTaskFiles(e.target.files)} /></Field>
            {(taskForm.attachments||[]).length>0 && <div style={{ display:"grid", gap:6 }}>{taskForm.attachments.map(a=><div key={a.id||a.name} style={{ display:"flex", justifyContent:"space-between", gap:10, alignItems:"center", padding:8, border:`1px solid ${T.border}`, borderRadius:10 }}><span style={{ fontSize:13 }}>{a.name}</span><Btn variant="danger" onClick={()=>removeTaskFile(a.id)}>Remove</Btn></div>)}</div>}
            <Field label="Inspection Steps / Checklist"><div style={{ display:"grid", gap:8 }}>
              {taskStepRows(taskForm.steps).map((step,i,arr)=><div key={`step-${i}`} style={{ display:"grid", gridTemplateColumns:"40px 1fr auto", gap:8, alignItems:"center" }}>
                <b>{i+1}</b><input style={inp} value={step} autoFocus={i===arr.length-1 && step===""} onClick={e=>e.stopPropagation()} onKeyDown={e=>e.stopPropagation()} onChange={e=>updateStep(i,e.target.value)} placeholder="Start typing inspection step..." />
                <Btn variant="danger" onClick={()=>removeStep(i)}>X</Btn>
              </div>)}
              <Btn variant="secondary" onClick={addStep}>+ Add Step Line</Btn>
            </div></Field>
            <Field label="Notes"><textarea style={{...inp,minHeight:70}} value={taskForm.notes||""} onChange={e=>setTaskForm(f=>({...f,notes:e.target.value}))} /></Field>
            <div style={{ display:"flex", justifyContent:"space-between", gap:8 }}>
              <div style={{ display:"flex", gap:8 }}>{taskForm.id ? <Btn variant="danger" onClick={()=>{ if(confirm("Delete this inspection task?")){ dispatch({type:"DELETE_INSPECTION_TASK", payload:taskForm.id}); setModal(null); } }}>Delete</Btn> : <span/>}{taskForm.id ? <Btn variant="secondary" onClick={()=>copyInspectionTask(taskForm)}>Copy</Btn> : null}</div>
              <div style={{ display:"flex", gap:8 }}><Btn variant="secondary" onClick={()=>setModal(null)}>Cancel</Btn><Btn onClick={saveTask}>Save Task</Btn></div>
            </div>
          </div>
        </Modal>
      )}

      {modal==="schedule" && (
        <Modal title={scheduleForm.id?"Edit Inspection Assignment":"Assign Inspection Task to Equipment"} onClose={()=>setModal(null)}>
          <div style={{ display:"grid", gap:12 }}>
            <Field label="Equipment"><select style={inp} value={scheduleForm.equipmentId} onChange={e=>setScheduleForm(f=>({...f,equipmentId:e.target.value}))}><option value="">Choose equipment...</option>{equipment.map(e=><option key={e.id} value={e.id}>{e.id} — {e.name || e.nomenclature}</option>)}</select></Field>
            <Field label="Inspection Task"><select style={inp} value={scheduleForm.taskId} onChange={e=>setScheduleTask(e.target.value)}><option value="">Choose task...</option>{tasks.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></Field>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(180px, 1fr))", gap:10 }}>
              <Field label="Frequency From Task"><input style={{...inp, background:T.grayLt}} readOnly value={taskById(scheduleForm.taskId)?.frequency || "Choose task first"} /></Field>
              <Field label="Last Inspection Date"><input style={inp} type="date" value={scheduleForm.lastInspectionDate || ""} onChange={e=>setScheduleLastInspectionDate(e.target.value)} /></Field>
              <Field label="Next Inspection Date"><input style={inp} type="date" value={scheduleForm.nextDueDate || ""} onChange={e=>setScheduleForm(f=>({...f,nextDueDate:e.target.value,lastInspectionDate:e.target.value ? f.lastInspectionDate : f.lastInspectionDate}))} /></Field>
            </div>
            <div style={{ marginTop:-4, color:T.muted, fontSize:12 }}>
              Enter the last inspection date to auto-generate the next inspection date from the task frequency, or enter the next inspection date manually.
            </div>
            <Field label="Assignment Notes"><textarea style={{...inp,minHeight:70}} value={scheduleForm.notes||""} onChange={e=>setScheduleForm(f=>({...f,notes:e.target.value}))} placeholder="Optional notes for this equipment assignment" /></Field>
            <div style={{ display:"flex", justifyContent:"space-between", gap:8 }}>
              {scheduleForm.id ? <Btn variant="danger" onClick={()=>{ if(confirm("Delete this inspection assignment?")){ dispatch({type:"DELETE_INSPECTION_SCHEDULE", payload:scheduleForm.id}); setModal(null); } }}>Delete</Btn> : <span/>}
              <div style={{ display:"flex", justifyContent:"flex-end", gap:8 }}><Btn variant="secondary" onClick={()=>setModal(null)}>Cancel</Btn><Btn onClick={saveSchedule}>Save Assignment</Btn></div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function PM({ state, dispatch }) {
  const [modal, setModal]         = useState(null); /* null | "edit" | "schedule" | "manualTrigger" */
  const [form, setForm]           = useState({});
  const [schForm, setSchForm]     = useState({ equipmentId:"", taskId:"", task:"", triggerType:"time", timeInterval:"", timeUnit:"months", usageInterval:"", usageType:"hours", lastDoneDate:today(), lastDoneUsage:"" });
  const [manualForm, setManualForm] = useState({ equipmentId:"", taskId:"" });
  const [taskModal, setTaskModal] = useState(false);
  const [editTaskId, setEditTaskId] = useState(null);
  const blankTaskForm = () => ({ name:"", description:"", steps:[""], parts:[{name:"",qty:"",unit:"ea"}], triggers:[{type:"time",timeInterval:"",timeUnit:"months",usageInterval:"",usageType:"hours",usageMode:"every"}] });
  const [taskForm, setTaskForm]   = useState(blankTaskForm());
  const [showTaskLib, setShowTaskLib] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState(null);
  const [autoFired, setAutoFired]     = useState(false);
  const [expandedPMEquipment, setExpandedPMEquipment] = useState({});

  const F  = k => e => setForm(f=>({...f,[k]:e.target.value}));
  const SF = k => e => setSchForm(f=>({...f,[k]:e.target.value}));

  // PM paste cleanup: some PDF/manual text pastes into Chrome without spaces.
  // This repairs common maintenance words while preserving normal pasted text.
  const pmPasteWords = new Set([
    "a","about","above","adjust","after","air","all","and","annual","as","axle","battery","belt","blades","bolts","brake","brakes","brakepads","brakeshoes","cable","cap","change","check","clean","condition","conditions","coolant","daily","damage","deck","diesel","dirty","drain","drive","each","engine","equipment","every","filter","filters","fluid","for","front","fuel","grease","hose","hoses","hour","hours","hydraulic","in","inspect","inspection","install","level","levels","lines","lubricate","mower","oil","or","parking","parts","pressure","pump","radiator","rear","replace","required","safety","service","shoe","shoes","steering","system","the","tighten","tire","tires","to","torque","transmission","wear","wheel","wheels","with","worn","visually","water"
  ]);

  const splitPMRun = (run) => {
    const lower = String(run || "").toLowerCase();
    if(lower.length < 12) return run;
    const memo = {};
    const solve = (idx) => {
      if(idx >= lower.length) return [];
      if(memo[idx] !== undefined) return memo[idx];
      let best = null;
      for(let end = Math.min(lower.length, idx + 16); end > idx; end--) {
        const word = lower.slice(idx, end);
        if(!pmPasteWords.has(word)) continue;
        const rest = solve(end);
        if(rest !== null) {
          const candidate = [run.slice(idx, end), ...rest];
          if(!best || candidate.join("").length > best.join("").length) best = candidate;
        }
      }
      memo[idx] = best;
      return best;
    };
    const parts = solve(0);
    return parts && parts.join("").length === run.length ? parts.join(" ") : run;
  };

  const cleanPMPasteText = (value="") => String(value || "")
    .replace(/\u00a0/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/([.!?])(?=[A-Za-z])/g, "$1 ")
    .replace(/([,)])(?=[A-Za-z])/g, "$1 ")
    .replace(/([A-Za-z]{12,})/g, m => splitPMRun(m))
    .replace(/\bbrake pads?\b/gi, m => m)
    .replace(/brake shoes/gi, "brake shoes")
    .replace(/\bindusty\b/gi, "in dusty")
    .replace(/\s+/g, " ")
    .trim();

  const pasteIntoText = (setter) => (e) => {
    const raw = e.clipboardData?.getData("text/plain");
    if(raw == null) return;
    e.preventDefault();
    const text = cleanPMPasteText(raw);
    const el = e.currentTarget;
    const start = el.selectionStart ?? String(el.value||"").length;
    const end = el.selectionEnd ?? start;
    const next = String(el.value||"").slice(0,start) + text + String(el.value||"").slice(end);
    setter(next);
    requestAnimationFrame(()=>{ try { el.selectionStart = el.selectionEnd = start + text.length; } catch(_) {} });
  };

  const pmTasks  = state.pmTasks    || [];
  const schedules = state.pmSchedules || [];
  const selectedLibraryTask = pmTasks.find(t=>t.id===selectedTaskId) || pmTasks[0] || null;

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

  const normalizeTaskTriggers = (taskOrSchedule) => {
    const raw = Array.isArray(taskOrSchedule?.triggers) && taskOrSchedule.triggers.length
      ? taskOrSchedule.triggers
      : [{
          type: taskOrSchedule?.triggerType === "usage" ? (taskOrSchedule?.usageType || "hours") : "time",
          timeInterval: taskOrSchedule?.timeInterval || "",
          timeUnit: taskOrSchedule?.timeUnit || "months",
          usageInterval: taskOrSchedule?.usageInterval || "",
          usageMode: "every",
        }];
    return raw
      .map(t=>({
        type: t.type || "time",
        timeInterval: t.timeInterval || "",
        timeUnit: t.timeUnit || "months",
        usageInterval: t.usageInterval || "",
        usageMode: t.usageMode || "every",
        nextDueDate: t.nextDueDate || "",
        nextDueUsage: t.nextDueUsage || "",
      }))
      .filter(t=> t.type==="time" ? !!t.timeInterval : !!t.usageInterval);
  };

  const currentUsageFor = (equipmentId, type="hours") => {
    const logs = (state.usageLogs||[]).filter(l=>l.equipmentId===equipmentId);
    const key = type === "mileage" ? "mileage" : "hours";
    return Math.max(...logs.map(l=>+(l[key]||0)), 0);
  };

  const buildScheduleTriggers = (triggers, lastDate, lastUsage) => normalizeTaskTriggers({triggers}).map(t=>{
    if(t.type === "time") return { ...t, nextDueDate: nextDueDate(lastDate, t.timeInterval, t.timeUnit), nextDueUsage:"" };
    const base = +(lastUsage || 0);
    return { ...t, nextDueDate:"", nextDueUsage: t.usageMode==="at" ? +(t.usageInterval||0) : base + +(t.usageInterval||0) };
  });

  const advanceScheduleTriggers = (sch, doneDate=today(), doneUsage=null) => normalizeTaskTriggers(sch).map(t=>{
    if(t.type === "time") return { ...t, nextDueDate: nextDueDate(doneDate, t.timeInterval, t.timeUnit), nextDueUsage:"" };
    const usage = doneUsage ?? currentUsageFor(sch.equipmentId, t.type);
    return { ...t, nextDueDate:"", nextDueUsage: t.usageMode==="at" ? +(t.usageInterval||0) : usage + +(t.usageInterval||0) };
  });

  /* Check if a schedule should trigger. Supports multiple triggers on the same PM task. */
  const shouldTrigger = (sch) => {
    try {
      if(!sch.equipmentId) return false;
      const alreadyOpen = state.workOrders.some(w=>
        w.equipment===sch.equipmentId &&
        w.scheduleId===sch.id &&
        (w.status==="Open"||w.status==="In Progress")
      );
      if(alreadyOpen) return false;
      const triggersToCheck = normalizeTaskTriggers(sch);
      return triggersToCheck.some(t=>{
        if(t.type==="time") {
          const dueDate = t.nextDueDate || sch.nextDueDate;
          return !!dueDate && today() >= dueDate;
        }
        const usage = currentUsageFor(sch.equipmentId, t.type);
        const dueUsage = t.nextDueUsage || sch.nextDueUsage;
        return !!dueUsage && usage >= +dueUsage;
      });
    } catch(e) { /* swallow any errors in trigger check */ }
    return false;
  };

  const triggered = schedules.filter(shouldTrigger);

  /* PM auto-generation is handled once at the App level so it works from every tab and does not duplicate WOs. */
  useEffect(()=>{
    if(!autoFired && triggered.length>0) setAutoFired(true);
  }, [autoFired, triggered.length]);

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

  const getTaskTriggerSettings = (task) => {
    const triggers = normalizeTaskTriggers(task);
    const timeTrig  = triggers.find(t=>t.type==="time") || null;
    const usageTrig = triggers.find(t=>t.type==="hours" || t.type==="mileage") || null;
    const triggerType = timeTrig && usageTrig ? "both" : usageTrig ? "usage" : "time";
    return {
      triggers,
      triggerType,
      timeInterval: timeTrig?.timeInterval || "",
      timeUnit: timeTrig?.timeUnit || "months",
      usageInterval: usageTrig?.usageInterval || "",
      usageType: usageTrig?.type==="mileage" ? "mileage" : "hours",
    };
  };

  const describeTaskTriggers = (task) => {
    const triggers = (task?.triggers||[]).filter(Boolean);
    if(triggers.length===0) return "No trigger saved on this task yet.";
    return triggers.map(t=>{
      if(t.type==="time") return `Every ${t.timeInterval||"—"} ${t.timeUnit||"months"}`;
      if(t.type==="hours") return `${t.usageMode==="at"?"At":"Every"} ${t.usageInterval||"—"} engine hours`;
      if(t.type==="mileage") return `${t.usageMode==="at"?"At":"Every"} ${t.usageInterval||"—"} miles`;
      return "Trigger saved";
    }).join(" • ");
  };

  const saveSchedule = () => {
    if(!schForm.equipmentId) return alert("Select equipment.");
    const selectedTask = pmTasks.find(t=>t.id===schForm.taskId);
    if(!selectedTask) return alert("Pick a named PM task first. The trigger is controlled by the task.");
    const trig = getTaskTriggerSettings(selectedTask);
    const schedulePayload = { ...schForm, task:selectedTask.name, ...trig };
    const nextTriggers = buildScheduleTriggers(schedulePayload.triggers, schedulePayload.lastDoneDate, schedulePayload.lastDoneUsage);
    const nextDate  = nextTriggers.find(t=>t.type==="time")?.nextDueDate || "";
    const nextUsage = nextTriggers.find(t=>t.type==="hours"||t.type==="mileage")?.nextDueUsage || "";
    const isEditingSchedule = !!schForm.id;
    dispatch({type:isEditingSchedule ? "UPDATE_PM_SCHEDULE" : "ADD_PM_SCHEDULE", payload:{
      ...schedulePayload,
      id:isEditingSchedule ? schForm.id : genId("SCH"),
      triggers:nextTriggers,
      nextDueDate:nextDate, nextDueUsage:nextUsage,
      created:schForm.created || today(),
      updated:today(),
    }});
    setModal(null);
    setSchForm({equipmentId:"",taskId:"",task:"",triggerType:"time",timeInterval:"",timeUnit:"months",usageInterval:"",usageType:"hours",lastDoneDate:today(),lastDoneUsage:""});
  };

  const buildTaskStepsText = (task) => buildNumberedStepsText(task?.steps);

  const createPMWorkOrderFromTask = (equipmentId, task, manual=false, sch=null) => {
    if(!equipmentId || !task) return;
    const woId = genNextWOId(state.workOrders, equipmentId, "SVC");
    const stepLines = normalizeStepLines(task?.steps);
    const stepsText = buildTaskStepsText(task);
    const taskParts = (task.parts||[]).filter(p=>p.name).map(p=>({ name:p.name, qty:p.qty||1, unit:p.unit||"ea", unitCost:0 }));
    const details = [
      `${manual?"Manually triggered service":"Auto-generated service"}: ${task.name||sch?.task||"PM Service"}`,
      task.description ? `Description: ${task.description}` : "",
      stepsText ? `Service Steps:\n${stepsText}` : ""
    ].filter(Boolean).join("\n\n");
    const eq = state.equipment.find(e=>e.id===equipmentId);
    const logs = (state.usageLogs||[]).filter(l=>l.equipmentId===equipmentId);
    const usageMode = (eq?.usageType || sch?.usageType || "hours").toLowerCase();
    const currentHours = Math.max(...logs.map(l=>+(l.hours||0)), 0) || "";
    const currentMileage = Math.max(...logs.map(l=>+(l.mileage||0)), 0) || "";
    dispatch({type:"ADD_WO", payload:{
      id:woId,
      title:task.name||sch?.task||"PM Service",
      equipment:equipmentId,
      status:"Open",
      priority:"Medium",
      woType:"Service",
      equipmentStatus:"Fully Operational",
      created:today(),
      due:sch?.nextDueDate||today(),
      tech:"",
      laborHours:0,
      laborCost:0,
      partsCost:0,
      description:details,
      workPerformed:stepsText,
      serviceSteps:stepsText,
      serviceStepLines:stepLines,
      steps:stepLines,
      serviceChecklist:stepsText,
      mechanicNotes:"",
      faultEnabled:true,
      faultDescription:task.description||task.name||"PM Service",
      usageType:usageMode,
      usageHours:usageMode==="mileage" ? "" : currentHours,
      usageMileage:usageMode==="hours" ? "" : currentMileage,
      usageNA:!(eq?.trackUsage),
      partsUsed:taskParts,
      scheduleId:sch?.id||null,
      pmTaskId:task.id||sch?.taskId||null,
    }});
  };

  const createPMWorkOrderFromSchedule = (sch, manual=false) => {
    if(!sch) return;
    const task = pmTasks.find(t=>t.id===sch.taskId) || { id:sch.taskId, name:sch.task, description:"", steps:[], parts:[] };
    createPMWorkOrderFromTask(sch.equipmentId, task, manual, sch);
  };

  const manualTriggerService = () => {
    if(!manualForm.equipmentId) return alert("Select equipment to service.");
    const task = pmTasks.find(t=>t.id===manualForm.taskId);
    if(!task) return alert("Select the task to trigger.");
    createPMWorkOrderFromTask(manualForm.equipmentId, task, true, null);
    setModal(null);
    setManualForm({equipmentId:"", taskId:""});
  };

  const delSchedule = id => { if(confirm("Delete this maintenance schedule?")) dispatch({type:"DELETE_PM_SCHEDULE",payload:id}); };


  const getAssignedPMRows = () => schedules.map(s=>{
    const task = pmTasks.find(t=>t.id===s.taskId) || {};
    const eq = state.equipment.find(e=>e.id===s.equipmentId) || {};
    const triggers = normalizeTaskTriggers(s).length ? normalizeTaskTriggers(s) : normalizeTaskTriggers(task);
    const dueBits = triggers.map(t=>{
      if(t.type==="time") return `Date ${t.nextDueDate || s.nextDueDate || "—"}`;
      const unit = t.type==="mileage" ? "mi" : "hrs";
      return `${t.nextDueUsage || s.nextDueUsage || "—"} ${unit}`;
    }).filter(Boolean);
    const isOverdue = triggers.some(t=>{
      if(t.type==="time") {
        const d = t.nextDueDate || s.nextDueDate;
        return !!d && today() >= d;
      }
      const due = +(t.nextDueUsage || s.nextDueUsage || 0);
      return !!due && currentUsageFor(s.equipmentId, t.type) >= due;
    });
    const soonLimit = new Date();
    soonLimit.setDate(soonLimit.getDate()+30);
    const dueSoon = !isOverdue && triggers.some(t=>{
      if(t.type!=="time") return false;
      const d = t.nextDueDate || s.nextDueDate;
      if(!d) return false;
      const dt = new Date(d);
      return dt <= soonLimit;
    });
    return {
      ...s,
      eqName: eq.name || s.equipmentId || "—",
      taskName: task.name || s.task || "PM Task",
      taskDescription: task.description || "",
      triggerText: describeTaskTriggers(task),
      nextDueText: dueBits.length ? dueBits.join(" • ") : "—",
      currentHours: currentUsageFor(s.equipmentId, "hours"),
      currentMileage: currentUsageFor(s.equipmentId, "mileage"),
      status: isOverdue ? "Overdue" : dueSoon ? "Due Soon" : "OK",
    };
  }).sort((a,b)=>{
    const order = { Overdue:0, "Due Soon":1, OK:2 };
    return ((order[a.status] ?? 3) - (order[b.status] ?? 3)) || String(a.eqName).localeCompare(String(b.eqName));
  });

  const assignedPMRows = getAssignedPMRows();
  const assignedPMByEquipment = assignedPMRows.reduce((groups, row) => {
    const key = row.equipmentId || row.eqName || "Unknown";
    if(!groups[key]) groups[key] = {
      equipmentId: row.equipmentId || key,
      eqName: row.eqName || row.equipmentId || "—",
      currentHours: row.currentHours,
      currentMileage: row.currentMileage,
      status: "OK",
      rows: []
    };
    groups[key].rows.push(row);
    const order = { Overdue:0, "Due Soon":1, OK:2 };
    if((order[row.status] ?? 3) < (order[groups[key].status] ?? 3)) groups[key].status = row.status;
    return groups;
  }, {});
  const assignedPMEquipmentRows = Object.values(assignedPMByEquipment).sort((a,b)=>{
    const order = { Overdue:0, "Due Soon":1, OK:2 };
    return ((order[a.status] ?? 3) - (order[b.status] ?? 3)) || String(a.equipmentId).localeCompare(String(b.equipmentId));
  });
  const togglePMEquipment = (equipmentId) => setExpandedPMEquipment(x=>({...x, [equipmentId]: !x[equipmentId]}));

  /* Task library */
  const openNewTask = () => { setEditTaskId(null); setTaskForm(blankTaskForm()); setTaskModal(true); };
  const openEditTask = (t) => { setEditTaskId(t.id); setTaskForm({...t, triggers:t.triggers||[{type:"time",timeInterval:t.timeInterval||"",timeUnit:t.timeUnit||"months",usageInterval:"",usageType:"hours",usageMode:"every"}]}); setTaskModal(true); };
  const copyPMTask = (t) => { setEditTaskId(null); setTaskForm({...t, id:undefined, name:`Copy of ${t.name||"PM Task"}`, steps:Array.isArray(t.steps)?[...t.steps]:[""], parts:Array.isArray(t.parts)?t.parts.map(p=>({...p})):[{name:"",qty:"",unit:"ea"}], triggers:Array.isArray(t.triggers)?t.triggers.map(tr=>({...tr})):[{type:"time",timeInterval:t.timeInterval||"",timeUnit:t.timeUnit||"months",usageInterval:"",usageType:"hours",usageMode:"every"}]}); setTaskModal(true); };
  const saveTask = () => {
    if(!taskForm.name) return alert("Task name required.");
    if(editTaskId) {
      dispatch({type:"UPDATE_PM_TASK", payload:{...taskForm, parts:(taskForm.parts||[]).map(p=>({...p, unit:String(p.unit||"ea").trim()||"ea"})), id:editTaskId}});
    } else {
      dispatch({type:"ADD_PM_TASK", payload:{...taskForm, parts:(taskForm.parts||[]).map(p=>({...p, unit:String(p.unit||"ea").trim()||"ea"})), id:genId("PMT")}});
    }
    setTaskModal(false); setEditTaskId(null); setTaskForm(blankTaskForm());
  };
  /* Trigger helpers */
  const addTrigger   = () => setTaskForm(f=>({...f,triggers:[...(f.triggers||[]),{type:"time",timeInterval:"",timeUnit:"months",usageInterval:"",usageType:"hours",usageMode:"every"}]}));
  const setTrigger   = (i,k,v) => setTaskForm(f=>{ const tr=[...(f.triggers||[])]; tr[i]={...tr[i],[k]:v}; return {...f,triggers:tr}; });
  const delTrigger   = i => setTaskForm(f=>{ const tr=[...(f.triggers||[])]; tr.splice(i,1); return {...f,triggers:tr}; });
  const addTaskStep  = () => setTaskForm(f=>({...f,steps:[...(f.steps||[]),""] }));
  const setStep      = (i,v) => setTaskForm(f=>{ const s=[...(f.steps||[])]; s[i]=v; return {...f,steps:s}; });

  const pasteTaskStep = (i) => (e) => {
    try {
      const raw = e.clipboardData?.getData("text/plain");
      if(raw == null) return;
      e.preventDefault();

      const el = e.currentTarget;
      const currentValue = String(el?.value ?? "");
      const start = Number.isFinite(el?.selectionStart) ? el.selectionStart : currentValue.length;
      const end = Number.isFinite(el?.selectionEnd) ? el.selectionEnd : start;

      const cleaned = raw
        .replace(/\r\n?/g, "\n")
        .replace(/•/g, "\n")
        .split(/\n+/)
        .map(line => cleanPMPasteText(line.replace(/^\s*(?:[-*]+|\d+[.)])\s*/, "")))
        .filter(Boolean);

      if(!cleaned.length) return;

      setTaskForm(f => {
        const steps = Array.isArray(f.steps) && f.steps.length ? [...f.steps] : [""];
        const existing = String(steps[i] ?? currentValue);
        const firstLine = existing.slice(0, start) + cleaned[0] + existing.slice(end);
        if(cleaned.length > 1) {
          steps.splice(i, 1, firstLine, ...cleaned.slice(1));
        } else {
          steps[i] = firstLine;
        }
        return { ...f, steps };
      });
    } catch(err) {
      console.error("PM step paste failed", err);
    }
  };
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
        <div style={{ background:T.redLt, border:`1px solid ${T.red}`, borderRadius:8, padding:"12px 16px", marginBottom:16, display:"flex", gap:10, alignItems:"center" }}>
          <span style={{ fontSize:20 }}>🚨</span>
          <div style={{ fontFamily:T.sans, fontSize:13, color:T.red, fontWeight:600 }}>
            {triggered.length} PM schedule{triggered.length>1?"s":""} triggered — work orders auto-generated.
          </div>
        </div>
      )}

      <div style={{ display:"flex", gap:8, justifyContent:"flex-end", marginBottom:16 }}>
        <Btn variant="secondary" onClick={()=>{ setSelectedTaskId(pmTasks[0]?.id||null); setShowTaskLib(true); }}>
          Tasks Library ({pmTasks.length})
        </Btn>
        <div style={{ display:"flex", gap:8 }}><Btn variant="secondary" onClick={openNewTask}>+ Create New Task</Btn>{selectedLibraryTask&&<Btn variant="secondary" onClick={()=>copyPMTask(selectedLibraryTask)}>Copy Selected Task</Btn>}</div>
        <Btn onClick={()=>setModal("schedule")}>Task-to-Equipment</Btn>
        <Btn variant="secondary" onClick={()=>setModal("manualTrigger")}>Manual Trigger</Btn>
      </div>


      <div style={{ border:`1px solid ${T.border}`, borderRadius:14, background:T.card, overflow:"hidden", marginBottom:18, boxShadow:"0 1px 2px rgba(15,23,42,.04)" }}>
        <div style={{ display:"flex", justifyContent:"space-between", gap:12, alignItems:"center", padding:"12px 14px", background:T.grayLt, borderBottom:`1px solid ${T.border}` }}>
          <div>
            <h3 style={{ margin:0, fontFamily:T.sans, fontSize:16, color:T.text }}>Assigned Preventive Maintenance</h3>
            <div style={{ fontFamily:T.sans, fontSize:12, color:T.muted, marginTop:3 }}>PM tasks currently linked to equipment, like the inspection assignments list.</div>
          </div>
          <div style={{ fontFamily:T.mono, fontSize:11, color:T.muted }}>{assignedPMRows.length} assigned</div>
        </div>
        {assignedPMRows.length===0 ? (
          <div style={{ padding:18, fontFamily:T.sans, fontSize:13, color:T.muted }}>
            No PM tasks assigned yet. Use <b>Task-to-Equipment</b> to link a PM task to a piece of equipment.
          </div>
        ) : (
          <div style={{ overflow:"auto" }}>
            <table style={{ width:"100%", borderCollapse:"collapse", fontFamily:T.sans, fontSize:12, minWidth:900 }}>
              <thead>
                <tr style={{ background:T.grayLt, borderBottom:`1px solid ${T.border}` }}>
                  {["Equipment #","Equipment","Tasks","Current Usage","Status","Actions"].map(h=>(
                    <th key={h} style={{ padding:"9px 10px", textAlign:"left", fontSize:10, fontWeight:800, color:T.muted, textTransform:"uppercase", letterSpacing:.4, whiteSpace:"nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {assignedPMEquipmentRows.map(group=>{
                  const expanded = !!expandedPMEquipment[group.equipmentId];
                  return (
                    <React.Fragment key={group.equipmentId}>
                      <tr
                        onClick={()=>togglePMEquipment(group.equipmentId)}
                        style={{ borderBottom:`1px solid ${T.border}`, background:group.status==="Overdue"?"#fff1f2":group.status==="Due Soon"?"#fffbeb":"#fff", cursor:"pointer" }}
                      >
                        <td style={{ padding:"10px", fontWeight:900, color:T.text, whiteSpace:"nowrap", fontFamily:T.mono }}>
                          <span style={{ display:"inline-block", width:18, color:T.accent }}>{expanded?"▾":"▸"}</span>{group.equipmentId}
                        </td>
                        <td style={{ padding:"10px", fontWeight:800, color:T.text, whiteSpace:"nowrap" }}>{group.eqName}</td>
                        <td style={{ padding:"10px", color:T.subtext, whiteSpace:"nowrap" }}>{group.rows.length} task{group.rows.length===1?"":"s"}</td>
                        <td style={{ padding:"10px", fontFamily:T.mono, fontSize:11, color:T.subtext, whiteSpace:"nowrap" }}>{group.currentHours} hrs • {group.currentMileage} mi</td>
                        <td style={{ padding:"10px", whiteSpace:"nowrap" }}><span style={{ borderRadius:999, padding:"3px 9px", fontFamily:T.sans, fontSize:11, fontWeight:800, color:group.status==="Overdue"?T.red:group.status==="Due Soon"?T.amber:T.green, background:group.status==="Overdue"?"#fee2e2":group.status==="Due Soon"?"#fef3c7":"#dcfce7" }}>{group.status}</span></td>
                        <td style={{ padding:"8px 10px", whiteSpace:"nowrap", color:T.muted, fontSize:11 }}>Click to {expanded?"hide":"show"} tasks</td>
                      </tr>
                      {expanded && (
                        <tr style={{ borderBottom:`1px solid ${T.border}`, background:T.grayLt }}>
                          <td colSpan={6} style={{ padding:"0 10px 12px 38px" }}>
                            <table style={{ width:"100%", borderCollapse:"collapse", fontFamily:T.sans, fontSize:12, background:T.card, border:`1px solid ${T.border}`, borderRadius:10, overflow:"hidden" }}>
                              <thead>
                                <tr style={{ background:T.grayLt, borderBottom:`1px solid ${T.border}` }}>
                                  {["PM Task","Triggers","Next Due","Status","Actions"].map(h=>(
                                    <th key={h} style={{ padding:"8px 10px", textAlign:"left", fontSize:10, fontWeight:800, color:T.muted, textTransform:"uppercase", letterSpacing:.4, whiteSpace:"nowrap" }}>{h}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {group.rows.map(r=>(
                                  <tr key={r.id} style={{ borderBottom:`1px solid ${T.border}` }}>
                                    <td style={{ padding:"10px", color:T.subtext, minWidth:180 }}><b style={{ color:T.text }}>{r.taskName}</b>{r.taskDescription&&<div style={{ fontSize:11, color:T.muted, marginTop:2 }}>{r.taskDescription}</div>}</td>
                                    <td style={{ padding:"10px", color:T.subtext, minWidth:180 }}>{r.triggerText}</td>
                                    <td style={{ padding:"10px", fontFamily:T.mono, fontSize:11, color:T.text, minWidth:150 }}>{r.nextDueText}</td>
                                    <td style={{ padding:"10px", whiteSpace:"nowrap" }}><span style={{ borderRadius:999, padding:"3px 9px", fontFamily:T.sans, fontSize:11, fontWeight:800, color:r.status==="Overdue"?T.red:r.status==="Due Soon"?T.amber:T.green, background:r.status==="Overdue"?"#fee2e2":r.status==="Due Soon"?"#fef3c7":"#dcfce7" }}>{r.status}</span></td>
                                    <td style={{ padding:"8px 10px", whiteSpace:"nowrap" }} onClick={e=>e.stopPropagation()}>
                                      <Btn small onClick={()=>createPMWorkOrderFromSchedule(r, true)}>Create WO</Btn>
                                      <Btn small variant="secondary" onClick={()=>{ setSchForm({...r}); setModal("schedule"); }} style={{ marginLeft:6 }}>Edit</Btn>
                                      <Btn small variant="danger" onClick={()=>delSchedule(r.id)} style={{ marginLeft:6 }}>Del</Btn>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Tasks Library Modal */}
      {showTaskLib && (
        <Modal title={`Tasks Library (${pmTasks.length})`} onClose={()=>setShowTaskLib(false)}>
          {pmTasks.length===0 ? (
            <div style={{ textAlign:"center", padding:"24px 0", color:T.muted, fontFamily:T.sans, fontSize:13 }}>
              No tasks yet. Click "+ Create New Task" to add one.
            </div>
          ) : (
            <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
              <div style={{ border:`1px solid ${T.border}`, borderRadius:12, overflow:"hidden", background:T.card }}>
                <div style={{ padding:"10px 12px", background:T.grayLt, borderBottom:`1px solid ${T.border}`, fontFamily:T.sans, fontSize:11, fontWeight:800, color:T.muted, textTransform:"uppercase", letterSpacing:.5 }}>
                  Tasks Library — Spreadsheet List
                </div>
                <div style={{ overflow:"auto", maxHeight:360 }}>
                  <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12, fontFamily:T.sans, minWidth:920 }}>
                    <thead>
                      <tr style={{ background:T.grayLt, borderBottom:`1px solid ${T.border}` }}>
                        {["Task Name","Description","Triggers","Steps","Parts / Fluids","Assigned Equipment","Actions"].map(h=>(
                          <th key={h} style={{ padding:"9px 10px", textAlign:"left", fontWeight:800, fontSize:10, color:T.muted, textTransform:"uppercase", letterSpacing:.4, whiteSpace:"nowrap", borderRight:`1px solid ${T.border}` }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {pmTasks.map(t=>{
                        const activeScheds = schedules.filter(s=>s.taskId===t.id);
                        const active = selectedLibraryTask?.id===t.id;
                        const steps = (t.steps||[]).filter(Boolean);
                        const parts = (t.parts||[]).filter(p=>p.name);
                        return (
                          <tr
                            key={t.id}
                            onClick={()=>setSelectedTaskId(t.id)}
                            style={{
                              borderBottom:`1px solid ${T.border}`,
                              background:active?T.accentLt:"#fff",
                              cursor:"pointer"
                            }}
                          >
                            <td style={{ padding:"10px", fontWeight:800, color:T.text, borderRight:`1px solid ${T.border}`, whiteSpace:"nowrap" }}>{t.name||"Unnamed Task"}</td>
                            <td style={{ padding:"10px", color:T.subtext, borderRight:`1px solid ${T.border}`, maxWidth:240 }}>{t.description||"—"}</td>
                            <td style={{ padding:"10px", color:T.subtext, borderRight:`1px solid ${T.border}`, minWidth:170 }}>{describeTaskTriggers(t)}</td>
                            <td style={{ padding:"10px", color:T.subtext, borderRight:`1px solid ${T.border}`, whiteSpace:"nowrap" }}>{steps.length}</td>
                            <td style={{ padding:"10px", color:T.subtext, borderRight:`1px solid ${T.border}`, whiteSpace:"nowrap" }}>{parts.length}</td>
                            <td style={{ padding:"10px", color:T.subtext, borderRight:`1px solid ${T.border}`, whiteSpace:"nowrap" }}>{activeScheds.length}</td>
                            <td style={{ padding:"8px 10px", whiteSpace:"nowrap" }} onClick={e=>e.stopPropagation()}>
                              <Btn small variant="secondary" onClick={()=>{ setSelectedTaskId(t.id); openEditTask(t); }}>Edit</Btn>
                              <Btn small variant="danger" onClick={()=>{ if(confirm(`Delete task "${t.name}"? This will not delete active schedules.`)) { dispatch({type:"DELETE_PM_TASK",payload:t.id}); setSelectedTaskId(pmTasks.find(x=>x.id!==t.id)?.id||null); } }} style={{ marginLeft:6 }}>Del</Btn>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {selectedLibraryTask && (()=>{
                const t = selectedLibraryTask;
                const activeScheds = schedules.filter(s=>s.taskId===t.id);
                const steps = (t.steps||[]).filter(Boolean);
                const parts = (t.parts||[]).filter(p=>p.name);
                return (
                  <div style={{ border:`1px solid ${T.border}`, borderRadius:12, padding:16, background:T.card }}>
                    <div style={{ display:"flex", justifyContent:"space-between", gap:10, alignItems:"flex-start", marginBottom:12 }}>
                      <div>
                        <h3 style={{ margin:"0 0 4px", fontFamily:T.sans, fontSize:18, color:T.text }}>{t.name||"Unnamed Task"}</h3>
                        <div style={{ fontFamily:T.sans, fontSize:13, color:T.muted }}>{t.description||"No description saved."}</div>
                      </div>
                      <Btn small variant="secondary" onClick={()=>openEditTask(t)}>Edit Selected Task</Btn>
                    </div>

                    <div style={{ display:"grid", gridTemplateColumns:"repeat(3, minmax(0, 1fr))", gap:10, marginBottom:14 }}>
                      <div style={{ background:T.grayLt, border:`1px solid ${T.border}`, borderRadius:10, padding:10 }}>
                        <div style={{ fontFamily:T.sans, fontSize:10, fontWeight:800, color:T.muted, textTransform:"uppercase", letterSpacing:.4 }}>Triggers</div>
                        <div style={{ fontFamily:T.sans, fontSize:13, color:T.text, marginTop:4 }}>{describeTaskTriggers(t)}</div>
                      </div>
                      <div style={{ background:T.grayLt, border:`1px solid ${T.border}`, borderRadius:10, padding:10 }}>
                        <div style={{ fontFamily:T.sans, fontSize:10, fontWeight:800, color:T.muted, textTransform:"uppercase", letterSpacing:.4 }}>Steps</div>
                        <div style={{ fontFamily:T.sans, fontSize:13, color:T.text, marginTop:4 }}>{steps.length}</div>
                      </div>
                      <div style={{ background:T.grayLt, border:`1px solid ${T.border}`, borderRadius:10, padding:10 }}>
                        <div style={{ fontFamily:T.sans, fontSize:10, fontWeight:800, color:T.muted, textTransform:"uppercase", letterSpacing:.4 }}>Assigned Equipment</div>
                        <div style={{ fontFamily:T.sans, fontSize:13, color:T.text, marginTop:4 }}>{activeScheds.length}</div>
                      </div>
                    </div>

                    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
                      <div>
                        <div style={{ fontFamily:T.sans, fontSize:11, fontWeight:800, color:T.muted, textTransform:"uppercase", letterSpacing:.4, marginBottom:6 }}>Task Steps</div>
                        {steps.length===0 ? <div style={{ fontFamily:T.sans, fontSize:12, color:T.muted }}>No steps saved.</div> : (
                          <ol style={{ margin:"0 0 0 20px", padding:0, fontFamily:T.sans, fontSize:13, color:T.subtext, lineHeight:1.6 }}>
                            {steps.map((s,j)=><li key={j}>{s}</li>)}
                          </ol>
                        )}
                      </div>
                      <div>
                        <div style={{ fontFamily:T.sans, fontSize:11, fontWeight:800, color:T.muted, textTransform:"uppercase", letterSpacing:.4, marginBottom:6 }}>Parts / Fluids</div>
                        {parts.length===0 ? <div style={{ fontFamily:T.sans, fontSize:12, color:T.muted }}>No parts or fluids saved.</div> : (
                          <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                            {parts.map((p,j)=><div key={j} style={{ fontFamily:T.mono, fontSize:11, padding:"6px 8px", borderRadius:6, background:T.grayLt, border:`1px solid ${T.border}`, color:T.subtext }}>{p.qty||""} {p.unit||"ea"} {p.name}</div>)}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}
          <div style={{ display:"flex", justifyContent:"space-between", marginTop:14 }}>
            <div style={{ display:"flex", gap:8 }}><Btn variant="secondary" onClick={openNewTask}>+ Create New Task</Btn>{selectedLibraryTask&&<Btn variant="secondary" onClick={()=>copyPMTask(selectedLibraryTask)}>Copy Selected Task</Btn>}</div>
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
            <Field label="Task Name"><input style={inp} value={taskForm.name} onPaste={pasteIntoText(v=>setTaskForm(f=>({...f,name:v})))} onChange={e=>setTaskForm(f=>({...f,name:e.target.value}))} placeholder="e.g. 500-Hour Service, Annual Inspection" /></Field>
            <Field label="Description"><textarea style={{ ...inp, minHeight:50, resize:"vertical" }} value={taskForm.description} onPaste={pasteIntoText(v=>setTaskForm(f=>({...f,description:v})))} onChange={e=>setTaskForm(f=>({...f,description:e.target.value}))} placeholder="Brief description..." /></Field>
            <div>
              <label style={{ display:"block", fontFamily:T.sans, fontSize:12, fontWeight:600, color:T.subtext, marginBottom:8 }}>Service Steps</label>
              {(taskForm.steps||[""]).map((step,i)=>(
                <div key={i} style={{ display:"flex", gap:6, marginBottom:6, alignItems:"center" }}>
                  <span style={{ fontFamily:T.mono, fontSize:11, color:T.muted, minWidth:20 }}>{i+1}.</span>
                  <input style={{ ...inp, flex:1 }} value={step} autoFocus={i===(taskForm.steps||[]).length-1 && step===""} onPaste={pasteTaskStep(i)} onChange={e=>setStep(i,e.target.value)} placeholder={`Step ${i+1}...`} />
                  {(taskForm.steps||[]).length>1&&<button onClick={()=>delStep(i)} style={{ background:"none", border:"none", color:T.red, cursor:"pointer", fontSize:18, lineHeight:1 }}>×</button>}
                </div>
              ))}
              <button onClick={addTaskStep} style={{ background:"none", border:`1px dashed ${T.borderHi}`, borderRadius:6, padding:"5px 12px", color:T.accent, cursor:"pointer", fontFamily:T.sans, fontSize:12, fontWeight:600 }}>+ Add Step</button>
            </div>
            <div>
              <label style={{ display:"block", fontFamily:T.sans, fontSize:12, fontWeight:600, color:T.subtext, marginBottom:8 }}>Parts & Lubricants Required</label>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 80px 80px auto", gap:6, marginBottom:6, background:T.grayLt, padding:"5px 8px", borderRadius:5 }}>
                {["Part / Fluid Name","Qty","Unit",""].map(h=><div key={h} style={{ fontFamily:T.sans, fontSize:10, fontWeight:700, color:T.muted, textTransform:"uppercase", letterSpacing:.4 }}>{h}</div>)}
              </div>
              {(taskForm.parts||[]).map((p,i)=>(
                <div key={i} style={{ display:"grid", gridTemplateColumns:"1fr 80px 80px auto", gap:6, marginBottom:6, alignItems:"center" }}>
                  <input style={inp} placeholder="e.g. Engine Oil, Air Filter..." value={p.name} onPaste={pasteIntoText(v=>setTaskPart(i,"name",v))} onChange={e=>setTaskPart(i,"name",e.target.value)} />
                  <input style={inp} type="number" placeholder="5" value={p.qty} onChange={e=>setTaskPart(i,"qty",e.target.value)} />
                  <select style={sel} value={p.unit||"ea"} onChange={e=>handleUnitSelectChange(e.target.value, p.unit||"ea", v=>setTaskPart(i,"unit",v))}>
                    {getUnitOptionsFromState(state).map(u=><option key={u} value={u}>{u}</option>)}
                    <option value="__new_unit__">+ Add new...</option>
                  </select>
                  {(taskForm.parts||[]).length>1?<button onClick={()=>delTaskPart(i)} style={{ background:"none", border:"none", color:T.red, cursor:"pointer", fontSize:18, lineHeight:1 }}>×</button>:<div/>}
                </div>
              ))}
              <button onClick={addTaskPart} style={{ background:"none", border:`1px dashed ${T.borderHi}`, borderRadius:6, padding:"5px 12px", color:T.accent, cursor:"pointer", fontFamily:T.sans, fontSize:12, fontWeight:600 }}>+ Add Part / Lubricant</button>
            </div>

            {/* Multi-trigger section */}
            <div style={{ background:T.grayLt, borderRadius:8, padding:"12px 14px", border:`1px solid ${T.border}` }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
                <label style={{ fontFamily:T.sans, fontSize:12, fontWeight:600, color:T.subtext }}>Service Triggers</label>
                <button onClick={addTrigger} style={{ background:"none", border:`1px solid ${T.accent}`, borderRadius:5, padding:"3px 10px", color:T.accent, cursor:"pointer", fontFamily:T.sans, fontSize:11, fontWeight:600 }}>+ Add Trigger</button>
              </div>
              {(taskForm.triggers||[]).map((tr,i)=>(
                <div key={i} style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:7, padding:"10px 12px", marginBottom:8 }}>
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
            {editTaskId&&<Btn variant="secondary" onClick={()=>copyPMTask({...taskForm,id:editTaskId})}>Copy as New</Btn>}<Btn onClick={saveTask}>{editTaskId?"Update Task":"Save Task to Library"}</Btn>
          </div>
        </Modal>
      )}

      {modal==="manualTrigger"&&(
        <Modal title="Manual PM Service Trigger" onClose={()=>setModal(null)}>
          <p style={{ margin:"0 0 14px", fontFamily:T.sans, fontSize:13, color:T.subtext }}>
            Manually create a Service work order by choosing the equipment first, then the task. The generated work order will include the task steps.
          </p>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"0 16px" }}>
            <Field label="Equipment to Service" half>
              <select style={{ ...sel, minWidth:320, width:"100%" }} value={manualForm.equipmentId||""} onChange={e=>setManualForm(f=>({...f,equipmentId:e.target.value}))}>
                <option value="">-- Select Equipment --</option>
                {state.equipment.map(e=><option key={e.id} value={e.id}>{e.id} — {e.name}</option>)}
              </select>
            </Field>
            <Field label="Task to Trigger" half>
              <select style={{ ...sel, minWidth:320, width:"100%" }} value={manualForm.taskId||""} onChange={e=>setManualForm(f=>({...f,taskId:e.target.value}))}>
                <option value="">-- Select Task --</option>
                {pmTasks.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </Field>
          </div>
          {manualForm.equipmentId && manualForm.taskId && (()=>{
            const eq=state.equipment.find(e=>e.id===manualForm.equipmentId);
            const task=pmTasks.find(t=>t.id===manualForm.taskId);
            const steps=(task?.steps||[]).filter(Boolean);
            return (
              <div style={{ background:T.accentLt, border:`1px solid ${T.accent}44`, borderRadius:8, padding:"12px 14px", marginTop:8, fontFamily:T.sans, fontSize:12, color:T.subtext }}>
                <div>This will create an open <b>Service Work Order</b> for <b>{eq?.name||manualForm.equipmentId}</b> using <b>{task?.name}</b>.</div>
                {steps.length>0 && <div style={{ marginTop:8 }}><b>Steps included:</b> {steps.length}</div>}
              </div>
            );
          })()}
          <div style={{ display:"flex", gap:8, justifyContent:"flex-end", marginTop:14 }}>
            <Btn variant="secondary" onClick={()=>setModal(null)}>Cancel</Btn>
            <Btn onClick={manualTriggerService}>Create Service WO</Btn>
          </div>
        </Modal>
      )}

      {/* Create Maintenance Schedule */}
      {modal==="schedule"&&(
        <Modal title={schForm.id?"Edit Assigned Preventive Maintenance":"Task-to-Equipment"} onClose={()=>setModal(null)}>
          <p style={{ margin:"0 0 14px", fontFamily:T.sans, fontSize:13, color:T.subtext }}>
            Assign a PM task to equipment. The trigger comes from the task itself; this screen only links the task to the equipment.
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
                  if(t) setSchForm(f=>({...f, taskId:t.id, task:t.name, ...getTaskTriggerSettings(t)}));
                  else  setSchForm(f=>({...f,taskId:"",task:""}));
                }}>
                  <option value="">-- Pick from Tasks Library --</option>
                  {pmTasks.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
            </div>
            {schForm.taskId && (()=>{ const selectedTask = pmTasks.find(t=>t.id===schForm.taskId); return (
              <div style={{ gridColumn:"span 2", marginBottom:14, background:T.grayLt, border:`1px solid ${T.border}`, borderRadius:8, padding:"10px 12px" }}>
                <div style={{ fontFamily:T.sans, fontSize:12, fontWeight:700, color:T.text, marginBottom:4 }}>Trigger controlled by the selected task</div>
                <div style={{ fontFamily:T.sans, fontSize:12, color:T.subtext }}>{describeTaskTriggers(selectedTask)}</div>
              </div>
            ); })()}
            <Field label="Last Service Date" half><input style={inp} type="date" value={schForm.lastDoneDate} onChange={SF("lastDoneDate")} /></Field>
            {(schForm.triggerType==="usage"||schForm.triggerType==="both")&&(
              <Field label={`Usage at Last Service (${schForm.usageType})`} half><input style={inp} type="number" value={schForm.lastDoneUsage} onChange={SF("lastDoneUsage")} placeholder="e.g. 100" /></Field>
            )}
          </div>
          {schForm.equipmentId&&schForm.task&&(
            <div style={{ background:T.accentLt, border:`1px solid ${T.accent}44`, borderRadius:8, padding:"12px 14px", marginTop:8 }}>
              <div style={{ fontFamily:T.sans, fontSize:12, fontWeight:700, color:T.accent, marginBottom:6 }}>Preview</div>
              {buildScheduleTriggers((pmTasks.find(t=>t.id===schForm.taskId)?.triggers)||[], schForm.lastDoneDate, schForm.lastDoneUsage).map((tr,i)=>(
                <div key={i} style={{ fontFamily:T.sans, fontSize:13, color:T.text, marginBottom:4 }}>
                  {tr.type==="time" ? <>Next due date: <b>{tr.nextDueDate||"—"}</b> <span style={{ color:T.muted }}>({tr.timeInterval} {tr.timeUnit})</span></> : <>Next due at: <b>{tr.nextDueUsage||"—"} {tr.type}</b></>}
                </div>
              ))}
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
  const totalCost = w => woTotalCost(w);
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
    headerText:  s.headerText||"Maintenance Work Order",
    showEquipment: s.showEquipment!==false,
    showTech:      s.showTech!==false,
    showDates:     s.showDates!==false,
    showCosts:     s.showCosts!==false,
    showPriority:  s.showPriority!==false,
    showFaultDescription: s.showFaultDescription!==false,
    showDescription: s.showDescription!==false,
    showTypeSpecific: s.showTypeSpecific!==false,
    showMechanicNotes: s.showMechanicNotes!==false,
    showParts:     s.showParts!==false,
    showPartsUnitPrice: s.showPartsUnitPrice!==false,
    showPartsLineTotal: s.showPartsLineTotal!==false,
    showPartsSubtotal: s.showPartsSubtotal!==false,
    showOutsideServices: s.showOutsideServices!==false,
    showOutsideServicesUnitPrice: s.showOutsideServicesUnitPrice!==false,
    showOutsideServicesLineTotal: s.showOutsideServicesLineTotal!==false,
    showOutsideServicesSubtotal: s.showOutsideServicesSubtotal!==false,
    showLaborHours: s.showLaborHours!==false,
    showLaborTotal: s.showLaborTotal!==false,
    showGrandTotal: s.showGrandTotal!==false,
    showSignature: s.showSignature!==false,
    showFooterText: s.showFooterText!==false,
    showFooterBar: s.showFooterBar!==false,
    repairPrintColor: s.repairPrintColor || "blue",
    inspectionPrintColor: s.inspectionPrintColor || "mint",
    servicePrintColor: s.servicePrintColor || "yellow",
    footerText:  s.footerText||"",
  });
  const F = k => e => setForm(f=>({...f,[k]:e.target.value}));
  const Toggle = ({label,k}) => (
    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"8px 0", borderBottom:`1px solid ${T.border}` }}>
      <span style={{ fontFamily:T.sans, fontSize:13, color:T.text }}>{label}</span>
      <button onClick={()=>setForm(f=>({...f,[k]:!f[k]}))} style={{ width:40, height:22, borderRadius:11, border:"none", background:form[k]?T.accent:"#d1d5db", cursor:"pointer", position:"relative", transition:"background .2s" }}>
        <span style={{ position:"absolute", top:2, left:form[k]?18:2, width:18, height:18, borderRadius:"50%", background:T.card, transition:"left .2s", display:"block" }}/>
      </button>
    </div>
  );
  const printColorOptions = [
    ["blue", "Blue"],
    ["mint", "Green"],
    ["yellow", "Yellow"],
    ["slate", "Slate"]
  ];
  const ColorSelect = ({ label, k }) => (
    <Field label={label}>
      <select style={inp} value={form[k]} onChange={F(k)}>
        {printColorOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select>
    </Field>
  );

  const handleLogo = e => {
    const file = e.target.files[0]; if(!file) return;
    const reader = new FileReader();
    reader.onload = ev => setForm(f=>({...f,logo:ev.target.result}));
    reader.readAsDataURL(file);
  };

  const save = () => { const { companyName, logo, ...cleanForm } = form; dispatch({ type:"UPDATE_WO_SETTINGS", payload:cleanForm }); onClose(); };

  return (
    <Modal title="Work Order Settings" onClose={onClose}>
      <div style={{ display:"flex", flexDirection:"column", gap:14, marginBottom:14 }}>
        <div style={{ padding:12, border:`1px solid ${T.border}`, borderRadius:8, background:T.grayLt, fontFamily:T.sans, fontSize:12, color:T.subtext }}>
          Company / Organization name and logo are controlled in main Settings.
        </div>
        <Field label="Work Order Header Title">
          <input style={inp} value={form.headerText} onChange={F("headerText")} />
        </Field>
        <Field label="Footer / Notes Text">
          <textarea style={{ ...inp, minHeight:56, resize:"vertical" }} value={form.footerText} onChange={F("footerText")} placeholder="e.g. Authorized signatures required…" />
        </Field>
        <div style={{ fontFamily:T.sans, fontSize:12, fontWeight:700, color:T.muted, textTransform:"uppercase", letterSpacing:.4, marginTop:4 }}>Printable Work Order Colors</div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))", gap:10 }}>
          <ColorSelect label="Repair Work Orders" k="repairPrintColor" />
          <ColorSelect label="Inspection Work Orders" k="inspectionPrintColor" />
          <ColorSelect label="Preventive / Service Work Orders" k="servicePrintColor" />
        </div>
      </div>
      <div style={{ fontFamily:T.sans, fontSize:12, fontWeight:700, color:T.muted, textTransform:"uppercase", letterSpacing:.4, marginBottom:8 }}>Fields to show on printed Work Order</div>
      <div style={{ fontFamily:T.sans, fontSize:11, color:T.muted, marginBottom:8 }}>Assigned mechanic and priority are kept inside the system but are no longer printed on the work order.</div>
      <Toggle label="Equipment Information" k="showEquipment" />
      <Toggle label="Usage Reading / Mileage / Hours" k="showUsageReading" />
      <Toggle label="Dates (Created / Due / Completed)" k="showDates" />
      <Toggle label="Description" k="showFaultDescription" />
      <Toggle label="Work/Service Description & Work Performed" k="showDescription" />
      <Toggle label="Service / Inspection Details" k="showTypeSpecific" />
      <Toggle label="Mechanic Notes" k="showMechanicNotes" />
      <Toggle label="Parts Table" k="showParts" />
      <Toggle label="Parts Unit Price Column" k="showPartsUnitPrice" />
      <Toggle label="Parts Line Total Column" k="showPartsLineTotal" />
      <Toggle label="Parts Subtotal Row" k="showPartsSubtotal" />
      <Toggle label="Outside Services Table" k="showOutsideServices" />
      <Toggle label="Outside Services Unit Cost Column" k="showOutsideServicesUnitPrice" />
      <Toggle label="Outside Services Line Total Column" k="showOutsideServicesLineTotal" />
      <Toggle label="Outside Services Subtotal Row" k="showOutsideServicesSubtotal" />
      <Toggle label="Labor Hours Column" k="showLaborHours" />
      <Toggle label="Labor Total $ Column" k="showLaborTotal" />
      <Toggle label="Grand Total $ Bar" k="showGrandTotal" />
      <Toggle label="Mechanic Signature Block" k="showSignature" />
      <Toggle label="Remarks / Footer Notes" k="showFooterText" />
      <Toggle label="Bottom Footer Bar" k="showFooterBar" />
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
  const [editLog, setEditLog]      = useState(null); /* usage log being corrected */
  const [entry, setEntry]          = useState({});   /* {[eqId]: {hours, mileage, fuel, notes, date}} */

  const trackableEq = state.equipment.filter(e=>e.trackUsage);
  const allLogs     = state.usageLogs || [];

  const logsFor  = (eqId) => allLogs
    .map((l, idx)=>({...l, _idx:idx}))
    .filter(l=>String(l.equipmentId)===String(eqId))
    .sort((a,b)=>{
      const dateCompare = String(b.date||"").localeCompare(String(a.date||""));
      if(dateCompare) return dateCompare;
      const createdCompare = String(b.createdAt||"").localeCompare(String(a.createdAt||""));
      if(createdCompare) return createdCompare;
      return (b._idx||0) - (a._idx||0);
    });
  const latestLogFor = (eqId) => logsFor(eqId)[0] || null;
  /* Current reading = most recent log entry value (not cumulative) */
  const currentOf = (eqId, field) => {
    const logs = logsFor(eqId);
    const latest = logs.find(l=>String(l[field] ?? "").trim());
    return latest ? +(latest[field]||0) : 0;
  };
  /* Fuel IS cumulative (gallons added each fill-up) */
  const totalFuelOf = (eqId) => logsFor(eqId).reduce((s,l)=>s+(+(l.fuel||0)),0);

  const eqEntry  = (eqId) => entry[String(eqId)] || { date:today(), hours:"", mileage:"", fuel:"", notes:"" };
  const setEqEntry = (eqId, k, v) => setEntry(prev=>({...prev,[String(eqId)]:{...(prev[String(eqId)] || eqEntry(eqId)),[k]:v}}));

  const save = (eq) => {
    if(!eq) return;
    const e = eqEntry(eq.id);
    const cleaned = {
      ...e,
      date: e.date || today(),
      hours: String(e.hours ?? "").trim(),
      mileage: String(e.mileage ?? "").trim(),
      fuel: String(e.fuel ?? "").trim(),
      notes: String(e.notes ?? "").trim(),
    };
    if(!cleaned.hours && !cleaned.mileage && !cleaned.fuel) { alert("Enter at least one value."); return; }
    dispatch({ type:"ADD_USAGE_LOG", payload:{ ...cleaned, equipmentId:eq.id, id:genId("UL"), createdAt:new Date().toISOString() }});
    setEntry(prev=>({...prev,[String(eq.id)]:{ date:today(), hours:"", mileage:"", fuel:"", notes:"" }}));
  };

  const saveOnEnter = (ev, eq) => {
    if(ev.key === "Enter") {
      ev.preventDefault();
      ev.stopPropagation();
      save(eq);
    }
  };

  const del = id => { if(confirm("Delete this entry?")) dispatch({type:"DELETE_USAGE_LOG", payload:id}); };

  const saveEditLog = () => {
    if(!editLog) return;
    if(!String(editLog.hours||"").trim() && !String(editLog.mileage||"").trim() && !String(editLog.fuel||"").trim()) {
      alert("Enter at least one value, or delete the log instead.");
      return;
    }
    dispatch({ type:"UPDATE_USAGE_LOG", payload:editLog });
    setEditLog(null);
  };

  const renderEditUsageModal = () => {
    if(!editLog) return null;
    const eq = state.equipment.find(e=>e.id===editLog.equipmentId);
    const mode = eq?.usageType || "both";
    const showH = mode==="hours" || mode==="both";
    const showM = mode==="mileage" || mode==="both";
    return (
      <Modal title={(eq?.name || "Equipment") + " — Correct Usage Entry"} onClose={()=>setEditLog(null)}>
        <div style={{ display:"grid", gap:12 }}>
          <div style={{ fontFamily:T.sans, fontSize:12, color:T.muted }}>Use this only to correct a wrong entry. This updates the selected usage history record.</div>
          <Field label="Date"><input style={inp} type="date" value={editLog.date||today()} onChange={e=>setEditLog(l=>({...l,date:e.target.value}))} /></Field>
          {showH && <Field label="Hours"><input style={inp} type="number" step="0.1" value={editLog.hours||""} onChange={e=>setEditLog(l=>({...l,hours:e.target.value}))} /></Field>}
          {showM && <Field label="Mileage"><input style={inp} type="number" step="1" value={editLog.mileage||""} onChange={e=>setEditLog(l=>({...l,mileage:e.target.value}))} /></Field>}
          <Field label="Fuel Added (gal)"><input style={inp} type="number" step="0.1" value={editLog.fuel||""} onChange={e=>setEditLog(l=>({...l,fuel:e.target.value}))} /></Field>
          <Field label="Notes"><textarea style={{...inp,minHeight:70}} value={editLog.notes||""} onChange={e=>setEditLog(l=>({...l,notes:e.target.value}))} /></Field>
          <div style={{ display:"flex", justifyContent:"flex-end", gap:8 }}><Btn variant="secondary" onClick={()=>setEditLog(null)}>Cancel</Btn><Btn onClick={saveEditLog}>Save Correction</Btn></div>
        </div>
      </Modal>
    );
  };

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
          {showH&&<div style={{ flex:1, background:T.accentLt, borderRadius:8, padding:"12px 16px", border:`1px solid ${T.borderHi}`, minWidth:120 }}>
            <div style={{ fontFamily:T.sans, fontSize:10, fontWeight:700, color:T.accent, textTransform:"uppercase", letterSpacing:.5 }}>Total Hours</div>
            <div style={{ fontFamily:T.sans, fontSize:28, fontWeight:800, color:T.accent }}>{totH.toFixed(1)}</div>
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
                  <button onClick={()=>setEditLog({...l})} title="Edit usage entry" style={{ background:"none", border:"none", color:T.accent, cursor:"pointer", fontFamily:T.sans, fontSize:14, fontWeight:700, marginRight:8 }}>✏️</button>
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
      {editLog && renderEditUsageModal()}

      <Card style={{ padding:0, overflow:"hidden" }}>
        {/* Table header */}
        <div style={{ display:"grid", gridTemplateColumns:"220px 80px 120px 120px 80px 1fr 110px 110px 76px", background:T.grayLt, borderBottom:`2px solid ${T.borderHi}`, padding:"9px 16px", gap:8, alignItems:"center" }}>
          {["Equipment","Equip #","Current Hours","Current Miles","Fuel (gal)","Notes","Date","Track by","Actions"].map(h=>(
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
              <div style={{ display:"grid", gridTemplateColumns:"220px 80px 120px 120px 80px 1fr 110px 110px 76px", padding:"10px 16px", gap:8, alignItems:"center" }}>

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
                    ? <div style={{ fontFamily:T.sans, fontSize:18, fontWeight:700, color:T.accent }}>{totH.toFixed(1)} <span style={{ fontSize:11, fontWeight:400, color:T.accent }}>hrs</span></div>
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
                <input style={{ ...inp, fontSize:12 }} placeholder="Notes..." value={e.notes} onChange={ev=>setEqEntry(eq.id,"notes",ev.target.value)} onKeyDown={ev=>saveOnEnter(ev, eq)} />

                {/* Date input */}
                <input style={{ ...inp, fontSize:12 }} type="date" value={e.date} onChange={ev=>setEqEntry(eq.id,"date",ev.target.value)} />

                {/* Track mode pills */}
                <div style={{ display:"flex", gap:3, flexWrap:"wrap" }}>
                  {[["H","hours"],["Mi","mileage"],["Both","both"]].map(([lbl,v])=>(
                    <button key={v} onClick={()=>dispatch({type:"UPDATE_EQ",payload:{...eq,usageType:v}})} style={{ padding:"2px 6px", borderRadius:4, border:`1px solid ${mode===v?T.accent:T.border}`, background:mode===v?T.accentLt:"#fff", color:mode===v?T.accent:T.muted, cursor:"pointer", fontFamily:T.mono, fontSize:10, fontWeight:mode===v?700:400 }}>{lbl}</button>
                  ))}
                </div>

                {/* Usage actions */}
                <div style={{ display:"flex", justifyContent:"center", gap:4 }}>
                  <button title="Edit latest usage entry" onClick={()=>{ const last=latestLogFor(eq.id); if(last) setEditLog({...last}); else alert("No usage history to edit yet."); }} style={{ border:`1px solid ${T.border}`, background:T.card, borderRadius:6, cursor:"pointer", padding:"4px 6px", fontSize:13 }}>✏️</button>
                  <button title="Usage history" onClick={()=>setDetailEq(eq.id)} style={{ border:`1px solid ${T.border}`, background:T.card, borderRadius:6, cursor:"pointer", padding:"4px 6px", fontSize:13 }}>🕘</button>
                </div>
              </div>

              {/* New entry input row */}
              <div style={{ display:"grid", gridTemplateColumns:"220px 80px 120px 120px 80px 1fr 110px 110px 76px", padding:"6px 16px 10px", gap:8, alignItems:"center", background:"#f0f8ff", borderTop:`1px dashed ${T.border}` }}>
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
                  onKeyDown={ev=>saveOnEnter(ev, eq)}
                />
                {/* Mileage input */}
                <input
                  style={{ ...inp, fontSize:12, border:`1px solid ${showM?"#86efac":T.border}`, background:showM?"#fff":"#f3f4f6", color:showM?T.text:T.muted }}
                  type="number" min="0"
                  placeholder={showM?"e.g. 24580":"N/A"}
                  disabled={!showM}
                  value={e.mileage}
                  onChange={ev=>setEqEntry(eq.id,"mileage",ev.target.value)}
                  onKeyDown={ev=>saveOnEnter(ev, eq)}
                />
                {/* Fuel input */}
                <input
                  style={{ ...inp, fontSize:12, border:"1px solid #e9d5ff" }}
                  type="number" step="0.1" min="0"
                  placeholder="e.g. 18.5"
                  value={e.fuel}
                  onChange={ev=>setEqEntry(eq.id,"fuel",ev.target.value)}
                  onKeyDown={ev=>saveOnEnter(ev, eq)}
                />
                <div/><div/>
                {/* Save button */}
                <div style={{ display:"flex", gap:6, alignItems:"center" }}>
                  <Btn small type="button" onClick={()=>save(eq)} style={{ whiteSpace:"nowrap" }}>+ Log</Btn>
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
  const isDark = T.bg === DARK_THEME.bg;

  const [missingEeOnly, setMissingEeOnly] = useState(false);

  /* Combine equipment from Equipment tab, equipment attachments, and inventory-only items */
  const eqAsInventory = (state.equipment||[]).map(e=>({
    id: e.id, name: e.name, eilNumber: e.eilNumber, serial: e.serial,
    category: e.category, location: e.location, make: e.make, model: e.model, year: e.year,
    acquisitionDate: e.acquisitionDate, acquisitionCost: e.acquisitionCost,
    notes: e.notes, condition: e.condition||"Good",
    turnInStatus: e.turnInStatus||"Active",
    turnInReason: e.turnInReason, turnInDate: e.turnInDate, turnInPaperwork: e.turnInPaperwork,
    _source: "equipment",
  }));
  const attachmentAsInventory = (state.equipment||[]).flatMap(e => (e.attachments||[]).map(at=>({
    id: at.id,
    name: at.name,
    eilNumber: at.eilNumber,
    serial: at.serial,
    category: at.category || "Attachment / Implement",
    location: at.location || e.location,
    make: at.make,
    model: at.model,
    year: at.year,
    acquisitionDate: at.acquisitionDate,
    acquisitionCost: at.acquisitionCost,
    notes: at.notes,
    condition: at.condition || "Good",
    turnInStatus: at.turnInStatus || "Active",
    turnInReason: at.turnInReason,
    turnInDate: at.turnInDate,
    turnInPaperwork: at.turnInPaperwork,
    documents: at.documents || [],
    parentEquipmentId: e.id,
    parentEquipmentName: e.name,
    _source: "attachment",
  })));
  const invOnly = (state.inventoryItems||[]).map(i=>({...i, _source:"inventory"}));
  const items    = [...eqAsInventory, ...attachmentAsInventory, ...invOnly];
  const active   = items.filter(i=>!["Turned-in","Disposed"].includes(i.turnInStatus));
  const archived = items.filter(i=>["Turned-in","Disposed"].includes(i.turnInStatus));

  const filtered = (tab==="active"?active:archived).filter(i=> {
    const matchesSearch = `${i.name} ${i.eilNumber||""} ${i.serial||""} ${i.location||""} ${i.parentEquipmentName||""}`.toLowerCase().includes(search.toLowerCase());
    const noEe = !String(i.eilNumber||"").trim();
    return matchesSearch && (!missingEeOnly || noEe);
  });

  const CONDITIONS = ["New","Good","Poor","Damaged"];
  const TURNIN_STATUSES = ["Pending Turn-in","Turn-in Initiated","Turned-in","Disposed"];

  const openAdd = () => { setForm({ condition:"Good", date:today() }); setModal("add"); };
  const openTurnIn = () => { setTurnInForm({ equipmentId:"", reason:"", date:today(), paperwork:"" }); setModal("turnin"); };
  const openItem = item => { setForm({...item}); setModal(item); };

  const save = () => {
    if(!form.name) return alert("Nomenclature required.");
    if(modal==="add") {
      dispatch({type:"ADD_INV", payload:{...form, id:genId("INV"), turnInStatus:"Active"}});
    } else {
      /* Route to equipment vs inventoryItems based on source */
      if(form._source==="equipment") {
        const orig = state.equipment.find(e=>e.id===form.id);
        dispatch({type:"UPDATE_EQ", payload:{...orig, ...form}});
      } else if(form._source==="attachment") {
        const parent = state.equipment.find(e=>e.id===form.parentEquipmentId);
        if(parent) {
          const updatedAttachments = (parent.attachments||[]).map(a => a.id===form.id ? { ...a, ...form } : a);
          dispatch({type:"UPDATE_EQ", payload:{...parent, attachments:updatedAttachments}});
        }
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
    } else if(item._source==="attachment") {
      const parent = state.equipment.find(e=>e.id===item.parentEquipmentId);
      if(parent) {
        const updatedAttachments = (parent.attachments||[]).map(a => a.id===item.id ? { ...a, ...payloadBase } : a);
        dispatch({type:"UPDATE_EQ", payload:{...parent, attachments:updatedAttachments}});
      }
    } else {
      dispatch({type:"UPDATE_INV", payload:{...item, ...payloadBase}});
    }
    setModal(null);
  };

  const updateStatus = (item, status) => {
    if(item._source==="equipment") {
      const orig = state.equipment.find(e=>e.id===item.id);
      dispatch({type:"UPDATE_EQ", payload:{...orig, turnInStatus:status}});
    } else if(item._source==="attachment") {
      const parent = state.equipment.find(e=>e.id===item.parentEquipmentId);
      if(parent) {
        const updatedAttachments = (parent.attachments||[]).map(a => a.id===item.id ? { ...a, turnInStatus:status } : a);
        dispatch({type:"UPDATE_EQ", payload:{...parent, attachments:updatedAttachments}});
      }
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
    } else if(item?._source==="attachment") {
      const parent = state.equipment.find(e=>e.id===item.parentEquipmentId);
      if(parent) dispatch({type:"UPDATE_EQ", payload:{...parent, attachments:(parent.attachments||[]).filter(a=>a.id!==id)}});
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
        <div style={{ display:"flex", gap:8, flexWrap:"wrap", alignItems:"center" }}>
          <input style={{ ...inp, maxWidth:220 }} placeholder="Search inventory..." value={search} onChange={e=>setSearch(e.target.value)} />
          <button type="button" onClick={()=>setMissingEeOnly(v=>!v)} style={{ padding:"7px 12px", borderRadius:7, border:`1px solid ${missingEeOnly?T.red:T.border}`, background:missingEeOnly?(isDark?"rgba(239,68,68,.16)":"#fee2e2"):(isDark?T.surface:"#fff"), color:missingEeOnly?T.red:T.subtext, cursor:"pointer", fontFamily:T.sans, fontSize:12, fontWeight:700 }}>No EE ({items.filter(i=>!String(i.eilNumber||"").trim()).length})</button>
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
                <td style={{ padding:"10px 12px", fontFamily:T.mono, fontSize:11, color:item.eilNumber?T.muted:T.red, fontWeight:item.eilNumber?500:800 }}>{item.eilNumber||"No EE"}</td>
                <td style={{ padding:"10px 12px", fontWeight:600, color:T.text }}>
                  {item.name}
                  {item._source==="attachment" && <div style={{ marginTop:2, fontSize:10, color:T.accent, fontWeight:700, textTransform:"uppercase", letterSpacing:.4 }}>Attachment on {item.parentEquipmentName||item.parentEquipmentId}</div>}
                </td>
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
                {active.map(i=><option key={i.id} value={i.id}>{i.name} ({i.eilNumber||"No EE"})</option>)}
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
  const parts = Array.isArray(state.parts) ? state.parts : [];
  const totalVal = parts.reduce((s,p)=>s+((+p.qty||0)*(+p.unitCost||0)),0);
  const lowParts = parts.filter(p=>p.lowStockAlert!==false&&(+p.qty||0)<=(+p.minQty||0));
  const sorted = [...parts].sort((a,b)=>(a.partNumber||"").localeCompare(b.partNumber||""));
  const exportRows = sorted.map(p=>{ const eq = p.equipmentId?state.equipment.find(e=>e.id===p.equipmentId):null; return {"Part #":p.partNumber||"", Name:p.name||"", Category:p.category||"", Location:p.location||"", "Equipment / Model":eq?`${eq.id} - ${eq.name}`:(p.modelFit||""), "Unit $":(+p.unitCost||0).toFixed(2), Qty:p.qty||0, "Total $":(p.qty*(+p.unitCost||0)).toFixed(2)}; });

  const print = () => {
    const esc = htmlEscape;
    const win = window.open("","_blank","width=900,height=700");
    if(!win) return;
    win.document.write(`<!DOCTYPE html><html><head><title>Parts Inventory Report</title>
      <style>body{font-family:Arial,sans-serif;padding:24px}h1{font-size:18px;margin-bottom:2px}p{font-size:12px;color:#666;margin:0 0 14px}table{width:100%;border-collapse:collapse;font-size:12px}th{background:#1a1a2e;color:#fff;padding:6px 10px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:.5px}td{padding:6px 10px;border-bottom:1px solid #e5e7eb}.low{background:#fff5f5}.total-row td{font-weight:700;background:#f3f4f6;font-size:13px;border-top:2px solid #1a1a2e}@media print{button{display:none}}</style>
      </head><body>
      <h1>Parts Inventory Report</h1>
      <p>Generated: ${new Date().toLocaleDateString()} | Total SKUs: ${parts.length} | Total Value: $${totalVal.toFixed(2)} | Low Stock Items: ${lowParts.length}</p>
      <table>
        <tr><th>Part #</th><th>Nomenclature</th><th>Category</th><th>Location</th><th>Equipment / Model</th><th style="text-align:right">Unit $</th><th>Unit Type</th><th style="text-align:right">Qty</th><th style="text-align:right">Total $</th><th>New Count</th></tr>
        ${sorted.map(p=>{
          const eq = p.equipmentId?(state.equipment||[]).find(e=>e.id===p.equipmentId):null;
          const low = (+p.qty||0)<=(+p.minQty||0)&&p.lowStockAlert!==false;
          const total = (+p.qty||0) * (+p.unitCost||0);
          return `<tr class="${low?"low":""}"><td>${esc(p.partNumber||"—")}</td><td>${esc(p.name||"—")}${low?" &#9888;":""}</td><td>${esc(p.category||"—")}</td><td>${esc(p.location||"—")}</td><td>${esc(eq?`${eq.id} - ${eq.name}`:(p.modelFit||"—"))}</td><td style="text-align:right">$${(+p.unitCost||0).toFixed(2)}</td><td>${esc(p.unit||"ea")}</td><td style="text-align:right">${(+p.qty||0).toLocaleString()}</td><td style="text-align:right">$${total.toFixed(2)}</td><td style="border-bottom:1px solid #999;min-width:80px">&nbsp;</td></tr>`;
        }).join("")}
        <tr class="total-row"><td colspan="8" style="text-align:right;padding:8px 10px">TOTAL INVENTORY VALUE</td><td style="text-align:right;padding:8px 10px">$${totalVal.toFixed(2)}</td><td></td></tr>
      </table>
      ${reportButtonsHtml(exportRows)}
      </body></html>`);
    win.document.close();
  };

  return (
    <div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(160px,1fr))", gap:12, marginBottom:16 }}>
        {[["Total SKUs",parts.length,T.text],["Total Value","$"+totalVal.toFixed(2),T.accent],["Low Stock",lowParts.length,T.red]].map(([l,v,c])=>(
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
                  <td style={{ padding:"9px 12px", color:T.subtext }}>{eq?`${eq.id} - ${eq.name}`:p.modelFit||"—"}</td>
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
  const [selEq, setSelEq] = useState("all");
  const trackableEq = (state.equipment||[]).filter(e=>e.trackUsage);
  const allLogs = state.usageLogs || [];
  const dateOnly = d => new Date(String(d||today()) + "T00:00:00");
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const fyStart = new Date(now.getMonth() >= 9 ? now.getFullYear() : now.getFullYear()-1, 9, 1);
  const eqList = selEq==="all" ? trackableEq : trackableEq.filter(e=>e.id===selEq);
  const logsFor = (eqId) => allLogs.filter(l=>l.equipmentId===eqId).sort((a,b)=>String(a.date||"").localeCompare(String(b.date||"")));
  const latestReading = (eqId, field, before=null) => {
    const logs = logsFor(eqId).filter(l=>l[field]!=="" && l[field]!=null && (!before || dateOnly(l.date) < before));
    const last = logs[logs.length-1];
    return last ? +(last[field]||0) : 0;
  };
  const currentReading = (eqId, field) => latestReading(eqId, field, null);
  const deltaSince = (eqId, field, startDate) => Math.max(0, currentReading(eqId, field) - latestReading(eqId, field, startDate));
  const statsFor = (eq, field) => ({
    current: currentReading(eq.id, field),
    month: deltaSince(eq.id, field, monthStart),
    fy: deltaSince(eq.id, field, fyStart),
    entries: logsFor(eq.id).length,
    lastDate: logsFor(eq.id).slice(-1)[0]?.date || "—"
  });
  const fmt = (n, decimals=1) => Number(n||0).toLocaleString(undefined,{maximumFractionDigits:decimals, minimumFractionDigits:decimals});
  const isMileageEq = (eq) => (eq.usageType||"hours") === "mileage";
  const primaryField = (eq) => isMileageEq(eq) ? "mileage" : "hours";
  const primaryLabel = (eq) => isMileageEq(eq) ? "Miles" : "Hours";
  const exportRows = eqList.map(eq=>{ const field=primaryField(eq); const st=statsFor(eq, field); return {"Equipment #":eq.id, Nomenclature:eq.name||eq.nomenclature||"", Type:primaryLabel(eq), Current:st.current, "New This Month":st.month, "This FY":st.fy, "Last Entry":st.lastDate, Entries:st.entries}; });

  const printUsageReport = () => {
    const win = window.open("","_blank","width=1000,height=760");
    if(!win) return;
    const cards = eqList.map(eq=>{
      const field=primaryField(eq), label=primaryLabel(eq), st=statsFor(eq, field);
      return `<tr><td><b>${eq.id||"—"}</b></td><td><b>${eq.name||eq.nomenclature||""}</b><br><small>${eq.category||""}</small></td><td>${label}</td><td><b>${fmt(st.current)}</b></td><td><b>${fmt(st.month)}</b></td><td><b>${fmt(st.fy)}</b></td><td>${st.lastDate}</td><td>${st.entries}</td></tr>`;
    }).join("");
    win.document.write(`<!DOCTYPE html><html><head><title>Usage Report</title><style>body{font-family:Arial,sans-serif;padding:24px;color:#111827}h1{margin:0 0 4px}.summary{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:16px 0}.box{border:1px solid #dbeafe;background:#eff6ff;border-radius:12px;padding:12px}.box small{color:#64748b;text-transform:uppercase;font-weight:700}.box div{font-size:22px;font-weight:800;color:#1d4ed8;margin-top:4px}table{width:100%;border-collapse:collapse;font-size:12px;margin-top:12px}th{background:#1e3a8a;color:white;padding:8px 10px;text-align:left;font-size:11px;text-transform:uppercase}td{padding:9px 10px;border-bottom:1px solid #e5e7eb}tr:nth-child(even){background:#f8fafc}@media print{button{display:none}}</style></head><body>${reportHeaderHTML(state,"Equipment Usage Report")}
      <p style="color:#64748b;font-size:12px;margin-top:4px">Shows current reading, new usage this month, and usage this fiscal year for monthly and annual reporting.</p>
      <table><thead><tr><th>Equipment #</th><th>Nomenclature</th><th>Meter</th><th>Current</th><th>New This Month</th><th>This FY</th><th>Last Entry</th><th>Entries</th></tr></thead><tbody>${cards || `<tr><td colspan="8">No tracked equipment found.</td></tr>`}</tbody></table>${reportButtonsHtml(exportRows)}</body></html>`);
    win.document.close();
  };

  return (
    <div>
      <Card style={{ marginBottom:16 }}>
        <div style={{ display:"flex", gap:12, flexWrap:"wrap", alignItems:"center", justifyContent:"space-between" }}>
          <div>
            <h2 style={{ margin:0, fontFamily:T.sans, fontSize:20, color:T.text }}>Equipment Usage Report</h2>
            <p style={{ margin:"4px 0 0", fontFamily:T.sans, fontSize:13, color:T.subtext }}>Simple monthly and FY usage numbers for reporting and planning future equipment needs.</p>
          </div>
          <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
            <select style={{ ...sel, width:240 }} value={selEq} onChange={e=>setSelEq(e.target.value)}>
              <option value="all">All Tracked Equipment</option>
              {trackableEq.map(e=><option key={e.id} value={e.id}>{e.name} ({e.id})</option>)}
            </select>
            <Btn small onClick={printUsageReport}>Print / PDF</Btn>
            <Btn small variant="secondary" onClick={()=>downloadCSV("usage-report.csv", exportRows)}>Excel CSV</Btn>
          </div>
        </div>
      </Card>

      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))", gap:14 }}>
        {eqList.map(eq=>{
          const field=primaryField(eq), label=primaryLabel(eq), st=statsFor(eq, field);
          return <Card key={eq.id} style={{ padding:0, overflow:"hidden", border:`1px solid ${T.border}` }}>
            <div style={{ padding:"12px 14px", background:T.accentLt, borderBottom:`1px solid ${T.border}` }}>
              <div style={{ fontFamily:T.sans, fontSize:14, fontWeight:800, color:T.text }}>{eq.name}</div>
              <div style={{ fontFamily:T.mono, fontSize:11, color:T.muted }}>{eq.id} • {label}</div>
            </div>
            <div style={{ padding:14, display:"grid", gap:10 }}>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8 }}>
                <div style={{ background:T.grayLt, border:`1px solid ${T.border}`, borderRadius:10, padding:10 }}><div style={{ fontSize:10, fontWeight:800, color:T.muted, textTransform:"uppercase" }}>Current</div><div style={{ fontSize:22, fontWeight:900, color:"#1d4ed8" }}>{fmt(st.current)}</div></div>
                <div style={{ background:T.grayLt, border:`1px solid ${T.border}`, borderRadius:10, padding:10 }}><div style={{ fontSize:10, fontWeight:800, color:T.muted, textTransform:"uppercase" }}>New This Month</div><div style={{ fontSize:22, fontWeight:900, color:"#047857" }}>{fmt(st.month)}</div></div>
                <div style={{ background:T.grayLt, border:`1px solid ${T.border}`, borderRadius:10, padding:10 }}><div style={{ fontSize:10, fontWeight:800, color:T.muted, textTransform:"uppercase" }}>This FY</div><div style={{ fontSize:22, fontWeight:900, color:"#7c3aed" }}>{fmt(st.fy)}</div></div>
              </div>
              <div style={{ display:"flex", justifyContent:"space-between", fontFamily:T.sans, fontSize:12, color:T.subtext }}><span>Last entry: <b>{st.lastDate}</b></span><span>{st.entries} log entries</span></div>
            </div>
          </Card>;
        })}
        {eqList.length===0 && <Card><div style={{ padding:16, color:T.muted, fontFamily:T.sans }}>No tracked equipment found.</div></Card>}
      </div>
    </div>
  );
}

function ReportDeadline({ state }) {
  const oos  = (state.equipment || []).filter(e=>e.status==="Out of Service / Deadline");
  const def  = (state.equipment || []).filter(e=>e.status==="Operational with Deficiencies");
  const eqReportData = (eq) => equipmentFaultInfo(state, eq);
  const exportRows = [
    ...oos.map(eq=>{ const d=eqReportData(eq); return {Status:"Out of Service / Deadline", "Equip #":eq.id, Nomenclature:eq.name||eq.nomenclature||"", "Fault Date":d.faultDate, Description:d.description, "Open Work Orders":d.openWOs}; }),
    ...def.map(eq=>{ const d=eqReportData(eq); return {Status:"Operational with Deficiencies", "Equip #":eq.id, Nomenclature:eq.name||eq.nomenclature||"", "Fault Date":d.faultDate, Description:d.description, "Open Work Orders":d.openWOs}; })
  ];
  const print = () => {
    const win = window.open("","_blank","width=900,height=700");
    if(!win) return;
    const table = (list,bg,title,color) => `<h2 style="background:${bg};color:${color};padding:8px 10px;border-radius:8px;font-size:14px">${title} (${list.length})</h2>
      <table class="deadline-table">
        <colgroup><col style="width:13%"><col style="width:22%"><col style="width:14%"><col style="width:33%"><col style="width:18%"></colgroup>
        <thead><tr><th>Equip #</th><th>Nomenclature</th><th>Fault Date</th><th>Description</th><th>Work Orders</th></tr></thead>
        <tbody>${list.map(eq=>{ const d=eqReportData(eq); return `<tr><td class="equip">${htmlEscape(eq.id||"—")}</td><td class="nomenclature"><b>${htmlEscape(eq.name||eq.nomenclature||"—")}</b><br><small>${htmlEscape(eq.location||"")}</small></td><td class="faultDate">${htmlEscape(d.faultDate||"—")}</td><td class="description">${htmlEscape(d.description||"—")}</td><td class="workOrders">${htmlEscape(d.openWOs||"—")}</td></tr>`; }).join("")}</tbody>
      </table>`;
    win.document.write(`<!DOCTYPE html><html><head><title>Deadline Report</title>
      <style>
        body{font-family:Arial,sans-serif;padding:24px;color:#111;background:white}h1{font-size:22px;margin:0 0 4px}.meta{font-size:12px;color:#64748b;margin:0 0 16px}.deadline-table{width:100%;border-collapse:collapse;table-layout:fixed;font-size:12px;margin-bottom:16px}.deadline-table th{background:#1a1a2e;color:#fff;padding:7px 8px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:.03em;white-space:nowrap;vertical-align:middle}.deadline-table td{padding:8px;border-bottom:1px solid #d1d5db;vertical-align:top;line-height:1.25}.deadline-table .equip{font-weight:700;white-space:nowrap;font-family:monospace}.deadline-table .nomenclature{overflow-wrap:break-word}.deadline-table .faultDate{white-space:nowrap;font-family:monospace}.deadline-table .description,.deadline-table .workOrders{overflow-wrap:anywhere}small{color:#64748b}@media print{button{display:none}body{padding:0}.deadline-table{page-break-inside:auto}tr{page-break-inside:avoid;page-break-after:auto}}
      </style></head><body>
      ${reportHeaderHTML(state, "Deadline & Deficiency Report")}
      <p class="meta">Fault date and description are pulled from the equipment record first. If blank, the report uses the latest open work order for that equipment.</p>
      ${table(oos,"#fff5f5","Out of Service / Deadline","#dc2626")}
      ${table(def,"#fffbeb","Operational with Deficiencies","#b45309")}
      ${!oos.length&&!def.length?`<p>No equipment in deadline or deficiency status.</p>`:""}
      ${reportButtonsHtml(exportRows, "deadline-deficiency-report")}
      </body></html>`);
    win.document.close();
  };
  return <Card>
    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", gap:12, marginBottom:16, flexWrap:"wrap" }}>
      <h3 style={{ margin:0, fontFamily:T.sans, fontSize:18, fontWeight:700 }}>Deadline / Deficiency Equipment</h3>
      <div style={{ display:"flex", gap:8 }}>
        <Btn small onClick={print}>Print / PDF</Btn>
        <Btn small variant="secondary" onClick={()=>downloadCSV("deadline-deficiency-report.csv", exportRows)}>Excel CSV</Btn>
      </div>
    </div>
    {[{list:oos,label:"Out of Service / Deadline",color:T.red,bg:"#fff5f5",leftBorder:"4px solid #ef4444"},
      {list:def,label:"Operational with Deficiencies",color:T.amber,bg:"#fffbeb",leftBorder:"4px solid #f59e0b"}].map(sec=><div key={sec.label} style={{ marginBottom:18 }}>
        <div style={{ fontFamily:T.sans, fontSize:12, fontWeight:800, color:sec.color, marginBottom:8, textTransform:"uppercase", letterSpacing:.4 }}>{sec.label} ({sec.list.length})</div>
        {sec.list.length ? sec.list.map(eq=>{ const d=eqReportData(eq); return <div key={eq.id} style={{ background:sec.bg, border:`1px solid ${T.border}`, borderLeft:sec.leftBorder, borderRadius:12, padding:12, marginBottom:8 }}>
          <div style={{ display:"flex", justifyContent:"space-between", gap:12, flexWrap:"wrap" }}>
            <div><b style={{ color:sec.color }}>{eq.id}</b> — {eq.name||eq.nomenclature}</div>
            <div style={{ fontFamily:T.sans, fontSize:12, color:T.muted }}>{eq.location||"No location"}</div>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))", gap:10, marginTop:10 }}>
            <div><div style={{ fontFamily:T.sans, fontSize:9, fontWeight:700, color:T.muted, textTransform:"uppercase", letterSpacing:.5 }}>Fault Date</div><div style={{ fontFamily:T.mono, fontSize:12, color:sec.color, fontWeight:700, marginTop:2 }}>{d.faultDate||"—"}</div></div>
            <div><div style={{ fontFamily:T.sans, fontSize:9, fontWeight:700, color:T.muted, textTransform:"uppercase", letterSpacing:.5 }}>Description</div><div style={{ fontFamily:T.sans, fontSize:12, color:T.text, marginTop:2, whiteSpace:"pre-wrap" }}>{d.description||"—"}</div></div>
            <div><div style={{ fontFamily:T.sans, fontSize:9, fontWeight:700, color:T.muted, textTransform:"uppercase", letterSpacing:.5 }}>Open Work Orders</div><div style={{ fontFamily:T.sans, fontSize:12, color:T.text, marginTop:2 }}>{d.openWOs||"—"}</div></div>
          </div>
        </div>; }) : <div style={{ color:T.muted, fontSize:13 }}>No equipment in this status.</div>}
      </div>)}
  </Card>;
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
  const exportPM = (group, p) => ({Group:group, "Equipment #":p.equipment||"", Nomenclature:eqName(p.equipment), Task:p.task, Interval:p.interval, "Last Done":p.lastDone||"", "Next Due":p.nextDue||"", Status:p.status});
  const exportRows = [...overdue.map(p=>exportPM("Overdue", p)), ...dueSoon.map(p=>exportPM("Due Soon", p)), ...completed.map(p=>exportPM("Completed This Month", p))];

  const printPMReport = () => {
    const win = window.open("","_blank","width=900,height=700");
    if(!win) return;
    const pmRows = (list) => list.map(p=>`<tr><td><b>${p.equipment||"—"}</b></td><td>${eqName(p.equipment)}</td><td>${p.task}</td><td>${p.interval}</td><td>${p.lastDone||"—"}</td><td>${p.nextDue||"—"}</td><td>${p.status}</td></tr>`).join("");
    win.document.write(`<!DOCTYPE html><html><head><title>PM Report</title>
      <style>body{font-family:Arial,sans-serif;padding:24px}h2{font-size:14px;margin:16px 0 6px}table{width:100%;border-collapse:collapse;font-size:12px}th{background:#1a1a2e;color:#fff;padding:6px 10px;text-align:left;font-size:11px;text-transform:uppercase}td{padding:6px 10px;border-bottom:1px solid #e5e7eb}@media print{button{display:none}}</style>
      </head><body>
      ${reportHeaderHTML(state, "Preventive Maintenance Report")}
      <p style="color:#666;font-size:12px">Look-ahead: ${lookAheadDays} days</p>
      ${overdue.length?`<h2 style="color:#dc2626">OVERDUE (${overdue.length})</h2><table><tr><th>Equipment #</th><th>Nomenclature</th><th>Task</th><th>Interval</th><th>Last Done</th><th>Due</th><th>Status</th></tr>${pmRows(overdue)}</table>`:""}
      ${dueSoon.length?`<h2 style="color:#d97706">DUE WITHIN ${lookAheadDays} DAYS (${dueSoon.length})</h2><table><tr><th>Equipment #</th><th>Nomenclature</th><th>Task</th><th>Interval</th><th>Last Done</th><th>Due</th><th>Status</th></tr>${pmRows(dueSoon)}</table>`:""}
      ${completed.length?`<h2 style="color:#059669">COMPLETED THIS MONTH (${completed.length})</h2><table><tr><th>Equipment #</th><th>Nomenclature</th><th>Task</th><th>Interval</th><th>Last Done</th><th>Due</th><th>Status</th></tr>${pmRows(completed)}</table>`:""}
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
                {["Equipment #","Nomenclature","Task","Interval","Last Done","Next Due","Status"].map(h=><th key={h} style={{ padding:"8px 12px", textAlign:"left", fontSize:11, fontWeight:600, color:T.muted, textTransform:"uppercase", letterSpacing:.4 }}>{h}</th>)}
              </tr></thead>
              <tbody>
                {list.map((p,i)=>{
                  const eq = state.equipment.find(e=>e.id===p.equipment);
                  return <tr key={p.id} style={{ borderBottom:`1px solid ${T.border}`, background:i%2===0?"#fff":T.grayLt }}>
                    <td style={{ padding:"9px 12px", fontFamily:T.mono, fontWeight:800, color:T.accent }}>{p.equipment||"—"}</td>
                    <td style={{ padding:"9px 12px", fontWeight:500 }}>{eq?.name||"—"}</td>
                    <td style={{ padding:"9px 12px" }}>{p.task}</td>
                    <td style={{ padding:"9px 12px", color:T.muted }}>{p.interval}</td>
                    <td style={{ padding:"9px 12px", fontFamily:T.mono, fontSize:12 }}>{p.lastDone||"—"}</td>
                    <td style={{ padding:"9px 12px", fontFamily:T.mono, fontSize:12, color }}>{p.nextDue||"—"}</td>
                    <td style={{ padding:"9px 12px" }}><Badge label={p.status} /></td>
                  </tr>;
                })}
                {list.length===0&&<tr><td colSpan={8} style={{ padding:20, textAlign:"center", color:T.muted, fontFamily:T.sans, fontSize:13 }}>None</td></tr>}
              </tbody>
            </table>
          </Card>
        </div>
      ))}
    </div>
  );
}

function ReportSpending({ state }) {
  const now = new Date();
  const fyYear = now.getMonth() >= 9 ? now.getFullYear() : now.getFullYear() - 1;
  const fy_start = new Date(fyYear, 9, 1); // Federal FY starts Oct 1
  const fy_end = new Date(fyYear + 1, 9, 1); // exclusive
  const month_start = new Date(now.getFullYear(), now.getMonth(), 1);
  const wos = state.workOrders;
  const totalCost = (w) => woTotalCost(w);
  const monthly = wos.filter(w=>w.completed&&new Date(w.completed)>=month_start);
  const annual  = wos.filter(w=>w.completed&&new Date(w.completed)>=fy_start&&new Date(w.completed)<fy_end);
  const monthTotal = monthly.reduce((s,w)=>s+totalCost(w),0);
  const fyTotal    = annual.reduce((s,w)=>s+totalCost(w),0);

  const spendingRows = (list) => list.map(w=>({"Equipment #":w.equipment||"", Nomenclature:state.equipment.find(e=>e.id===w.equipment)?.name||"", "WO #":w.id, Title:w.title||"", Mechanic:w.tech||"", Date:w.completed||w.created||"", Labor:(+w.laborCost||0).toFixed(2), Parts:woPartsTotal(w).toFixed(2), "Outside Services":outsideServicesTotal(w.outsideServices).toFixed(2), Total:totalCost(w).toFixed(2)}));
  const printSpending = (list, title) => {
    const rows = spendingRows(list);
    const win = window.open("","_blank","width=900,height=700");
    if(!win) return;
    win.document.write(`<!DOCTYPE html><html><head><title>${title}</title>
      <style>body{font-family:Arial,sans-serif;padding:24px}h1{font-size:18px;margin:0}table{width:100%;border-collapse:collapse;font-size:12px}th{background:#1a1a2e;color:#fff;padding:6px 10px;text-align:left;font-size:11px;text-transform:uppercase}td{padding:6px 10px;border-bottom:1px solid #e5e7eb}@media print{button{display:none}}</style>
      </head><body>${reportHeaderHTML(state, title)}
      <table><tr><th>Equipment #</th><th>Nomenclature</th><th>WO #</th><th>Title</th><th>Mechanic</th><th>Date</th><th>Labor</th><th>Parts</th><th>Outside Services</th><th>Total</th></tr>
      ${list.map(w=>`<tr><td><b>${w.equipment||"—"}</b></td><td>${state.equipment.find(e=>e.id===w.equipment)?.name||"—"}</td><td>${w.id}</td><td>${w.title}</td><td>${w.tech||"—"}</td><td>${w.completed||w.created||"—"}</td><td>$${(+w.laborCost||0).toFixed(2)}</td><td>$${woPartsTotal(w).toFixed(2)}</td><td>$${outsideServicesTotal(w.outsideServices).toFixed(2)}</td><td><b>$${totalCost(w).toFixed(2)}</b></td></tr>`).join("")}
      <tr style="font-weight:700;background:#f3f4f6"><td colspan="8">TOTAL</td><td>$${list.reduce((s,w)=>s+totalCost(w),0).toFixed(2)}</td></tr>
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
  const [selected, setSelected] = useState({ deadline:true, pm:true, spending:false, parts:false, usage:false, fuel:false, equipment:false, workorders:false });
  const [lookAhead, setLookAhead] = useState(30);
  const toggle = k => setSelected(s=>({...s,[k]:!s[k]}));

  const printCombined = () => {
    const win = window.open("","_blank","width=900,height=700");
    if(!win) return;
    const eqName = id => state.equipment.find(e=>e.id===id)?.name||id;
    const totalCost = w => woTotalCost(w);
    const allLogs = state.usageLogs || [];
    const currentReading = (eqId, field) => { const l = allLogs.filter(x=>x.equipmentId===eqId&&x[field]).sort((a,b)=>b.date.localeCompare(a.date))[0]; return l?+(l[field]||0):0; };

    let body = `<!DOCTYPE html><html><head><title>Combined Report</title>
      <style>body{font-family:Arial,sans-serif;padding:24px}h2{font-size:14px;margin:20px 0 6px;color:#1a1a2e;border-bottom:1px solid #ddd;padding-bottom:4px}table{width:100%;border-collapse:collapse;font-size:12px;margin-bottom:16px}th{background:#1a1a2e;color:#fff;padding:6px 10px;text-align:left;font-size:11px}td{padding:6px 10px;border-bottom:1px solid #e5e7eb}@media print{button{display:none}}</style>
      </head><body>${reportHeaderHTML(state, 'Combined Maintenance Report')}`;

    if(selected.deadline) {
      const bad = state.equipment.filter(e=>e.status==="Out of Service / Deadline"||e.status==="Operational with Deficiencies");
      body += `<h2>Deadline / Deficiency Equipment (${bad.length})</h2><table><tr><th>Equip #</th><th>Nomenclature</th><th>Status</th><th>Fault Date</th><th>Description</th><th>Open WOs</th></tr>${bad.map(e=>{ const f=equipmentFaultInfo(state,e); return `<tr><td>${htmlEscape(e.id)}</td><td>${htmlEscape(e.name||e.nomenclature||"")}</td><td>${htmlEscape(e.status)}</td><td>${htmlEscape(f.faultDate||"—")}</td><td>${htmlEscape(f.description||"—")}</td><td>${htmlEscape(f.openWOs||"—")}</td></tr>`; }).join("")}</table>`;
    }
    if(selected.pm) {
      const pmBad = state.preventiveMaintenance.filter(p=>p.status==="Overdue"||p.status==="Due Soon");
      body += `<h2>PM Overdue / Due Soon (${pmBad.length})</h2><table><tr><th>Equipment #</th><th>Nomenclature</th><th>Task</th><th>Last Done</th><th>Due</th><th>Status</th></tr>${pmBad.map(p=>`<tr><td><b>${p.equipment||"—"}</b></td><td>${eqName(p.equipment)}</td><td>${p.task}</td><td>${p.lastDone||"—"}</td><td>${p.nextDue||"—"}</td><td>${p.status}</td></tr>`).join("")}</table>`;
    }
    if(selected.spending) {
      const wos = state.workOrders.filter(w=>w.completed);
      const total = wos.reduce((s,w)=>s+totalCost(w),0);
      body += `<h2>Completed Work Orders — Total $${total.toFixed(2)}</h2><table><tr><th>Equipment #</th><th>Nomenclature</th><th>WO#</th><th>Title</th><th>Description</th><th>Mechanic</th><th>Completed</th><th>Total</th></tr>${wos.map(w=>`<tr><td><b>${w.equipment||"—"}</b></td><td>${eqName(w.equipment)}</td><td>${w.id}</td><td>${w.title}</td><td>${htmlEscape(workOrderDescription(w)||"—")}</td><td>${w.tech||"—"}</td><td>${w.completed||"—"}</td><td>$${totalCost(w).toFixed(2)}</td></tr>`).join("")}</table>`;
    }
    if(selected.parts) {
      const lowStock = state.parts.filter(p=>p.lowStockAlert!==false&&(+(p.qty||0))<=(+(p.minQty||0)));
      const totalVal = state.parts.reduce((s,p)=>s+(+(p.qty||0))*(+(p.unitCost||0)),0);
      body += `<h2>Parts Inventory — ${state.parts.length} SKUs, Total Value $${totalVal.toFixed(2)}</h2>`;
      if(lowStock.length>0) body += `<p style="color:#b91c1c;font-size:12px"><b>⚠ Low stock alerts: ${lowStock.length} items</b></p>`;
      body += `<table><tr><th>Part #</th><th>Nomenclature</th><th>Category</th><th>Qty</th><th>Min</th><th>Unit $</th><th>Total $</th></tr>${state.parts.map(p=>`<tr style="${(+(p.qty||0))<=(+(p.minQty||0))?'background:#fee2e2':''}"><td>${p.partNumber||"—"}</td><td>${p.name}</td><td>${p.category||"—"}</td><td>${p.qty||0}</td><td>${p.minQty||0}</td><td>$${(+(p.unitCost||0)).toFixed(2)}</td><td>$${((+(p.qty||0))*(+(p.unitCost||0))).toFixed(2)}</td></tr>`).join("")}</table>`;
    }
    if(selected.usage) {
      const trackable = state.equipment.filter(e=>e.trackUsage);
      body += `<h2>Current Usage Readings (${trackable.length} tracked units)</h2><table><tr><th>Equip #</th><th>Nomenclature</th><th>Hours</th><th>Mileage</th><th>Last Entry</th></tr>${trackable.map(e=>{ const logs = allLogs.filter(l=>l.equipmentId===e.id); const last = logs.sort((a,b)=>b.date.localeCompare(a.date))[0]; return `<tr><td>${e.id}</td><td>${e.name}</td><td>${currentReading(e.id,"hours").toFixed(1)}</td><td>${currentReading(e.id,"mileage").toLocaleString()}</td><td>${last?.date||"—"}</td></tr>`; }).join("")}</table>`;
    }
    if(selected.fuel) {
      const containers = state.fuelContainers || [];
      body += `<h2>Fuel Report (${containers.length} containers)</h2><table><tr><th>Container</th><th>Fuel</th><th>Capacity</th><th>Latest Inches</th><th>Gallons</th><th>% Full</th><th>Consumed This Month</th><th>Refilled This Month</th><th>Last Reading</th></tr>${containers.map(c=>{ const r=latestFuelReading(state,c.id); return `<tr><td>${htmlEscape(c.name||"")}</td><td>${htmlEscape(c.fuelType||"")}</td><td>${(+c.capacity||0).toLocaleString()} gal</td><td>${r?htmlEscape(r.inchesText ?? r.inches):"—"}</td><td>${r?Math.round(r.gallons).toLocaleString():"—"}</td><td>${r?fuelPercent(c,r.gallons).toFixed(1)+"%":"—"}</td><td>${Math.round(fuelConsumedForPeriod(state,c.id,"month")).toLocaleString()} gal</td><td>${Math.round(fuelRefilledForPeriod(state,c.id,"month")).toLocaleString()} gal</td><td>${r?htmlEscape(r.date||""):"—"}</td></tr>`; }).join("")}</table>`;
    }
    if(selected.equipment) {
      body += `<h2>Equipment Roster (${state.equipment.length})</h2><table><tr><th>Equip #</th><th>Nomenclature</th><th>Make/Model</th><th>Serial #</th><th>Location</th><th>Status</th></tr>${state.equipment.map(e=>`<tr><td>${e.id}</td><td>${e.name}</td><td>${e.make||""} ${e.model||""}</td><td>${e.serial||"—"}</td><td>${e.location||"—"}</td><td>${e.status}</td></tr>`).join("")}</table>`;
    }
    if(selected.workorders) {
      const active = state.workOrders.filter(w=>w.status!=="Completed");
      body += `<h2>Active Work Orders (${active.length})</h2><table><tr><th>Equipment #</th><th>Nomenclature</th><th>WO#</th><th>Title</th><th>Description</th><th>Mechanic</th><th>Priority</th><th>Status</th><th>Due</th></tr>${active.map(w=>`<tr><td><b>${w.equipment||"—"}</b></td><td>${eqName(w.equipment)}</td><td>${w.id}</td><td>${w.title}</td><td>${htmlEscape(workOrderDescription(w)||"—")}</td><td>${w.tech||"—"}</td><td>${w.priority}</td><td>${w.status}</td><td>${w.due||"—"}</td></tr>`).join("")}</table>`;
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
    ["fuel","⛽ Fuel Report","Fuel on hand, usage, and refills by container"],
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



function slugifyFacility(value="") {
  return String(value || "facility").toLowerCase().trim().replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"") || "facility";
}

function normalizeFacilityName(value="") {
  return String(value || "").toLowerCase().trim().replace(/\s+/g," ");
}

function equipmentFacilityValues(eq={}) {
  return [
    eq.location, eq.facility, eq.site, eq.siteName, eq.facilityName,
    eq.assignedFacility, eq.baseLocation, eq.currentLocation, eq.shop, eq.department
  ].map(normalizeFacilityName).filter(Boolean);
}

function equipmentMatchesFacility(eq={}, facility="") {
  const fac = normalizeFacilityName(facility);
  if(!fac) return true;
  const slug = normalizeFacilityName(slugifyFacility(facility));
  const candidates = equipmentFacilityValues(eq);
  if(!candidates.length) return false;
  return candidates.some(c => c === fac || c === slug || slugifyFacility(c) === slugifyFacility(facility));
}

function equipmentPublicId(eq={}, idx=0) {
  return String(eq.id || eq.equipment || eq.equipmentId || eq.eqId || eq.number || eq.equipmentNumber || eq.assetNumber || `EQ-${idx+1}`).trim();
}

function equipmentPublicName(eq={}) {
  return String(eq.name || eq.nomenclature || eq.description || eq.title || eq.makeModel || "Equipment").trim();
}

function buildWORequestEquipmentList(equipment=[], facility="") {
  const allEquipment = Array.isArray(equipment) ? equipment : [];
  const exact = allEquipment.filter(e => equipmentMatchesFacility(e, facility));
  const unassigned = allEquipment.filter(e => !equipmentFacilityValues(e).length);
  const source = exact.length
    ? [...exact, ...unassigned.filter(e=>!exact.some(x=>equipmentPublicId(x)===equipmentPublicId(e)))]
    : allEquipment;
  const seen = new Set();
  return source.map((e, idx) => {
    const id = equipmentPublicId(e, idx);
    const item = {
      id,
      name: equipmentPublicName(e),
      nomenclature: e.nomenclature || e.name || e.description || "",
      category: e.category || e.type || "",
      make: e.make || "",
      model: e.model || "",
      serial: e.serial || e.serialNumber || "",
      location: e.location || e.facility || e.site || e.siteName || e.facilityName || facility || "",
    };
    return item;
  }).filter(e => {
    const key = String(e.id || "").toLowerCase();
    if(!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function makeStableFacilityQrToken() {
  return `fac_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,10)}`;
}

function getFacilityQrToken(settings={}, facility="") {
  const ids = settings.facilityQrIds || {};
  return ids[facility] || slugifyFacility(facility);
}

function requestUrlForFacility(facility="", settings={}, ownerUserId="") {
  try {
    const base = window.location.origin + window.location.pathname;
    const token = getFacilityQrToken(settings, facility);
    const params = new URLSearchParams();
    params.set("woRequest", token);
    if(ownerUserId) params.set("owner", ownerUserId);
    if(facility) params.set("facility", facility);
    return `${base}?${params.toString()}`;
  } catch(e) {
    const token = getFacilityQrToken(settings, facility);
    return `?woRequest=${encodeURIComponent(token)}${ownerUserId?`&owner=${encodeURIComponent(ownerUserId)}`:""}${facility?`&facility=${encodeURIComponent(facility)}`:""}`;
  }
}

function getWORequestUrlParam(name) {
  try { return new URLSearchParams(window.location.search).get(name) || ""; }
  catch(e) { return ""; }
}

function qrUrlForText(text="") {
  return `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(text)}`;
}


function getWORequestPortalToken() {
  return getWORequestUrlParam("woRequest");
}

function isPublicWORequestPage() {
  return !!getWORequestPortalToken();
}

async function upsertWORequestPortal({ token, ownerUserId, facility, settings, equipment }) {
  if(!token || !ownerUserId || !facility) return;
  const portal = {
    token,
    owner_user_id: ownerUserId,
    facility,
    company_name: settings?.companyName || "MaintForge",
    equipment_json: buildWORequestEquipmentList(equipment, facility),
    updated_at: new Date().toISOString(),
  };
  try {
    await supabase.from("wo_request_portals").upsert(portal, { onConflict:"token" });
  } catch(e) {
    console.warn("WO request portal sync failed:", e);
  }
}

async function loadWORequestPortal(token) {
  if(!token) return null;
  try {
    const { data, error } = await supabase
      .from("wo_request_portals")
      .select("token,owner_user_id,facility,company_name,equipment_json")
      .eq("token", token)
      .maybeSingle();
    if(error) throw error;

    // Fallback for older/permanent QR links that include owner + facility.
    // This keeps an already printed QR useful even if the token record has to be re-synced
    // or if an older token row exists but has an empty equipment cache.
    const owner = getWORequestUrlParam("owner");
    const facility = getWORequestUrlParam("facility");
    const dataHasEquipment = Array.isArray(data?.equipment_json) && data.equipment_json.length > 0;
    if(owner && facility && !dataHasEquipment) {
      const res = await supabase
        .from("wo_request_portals")
        .select("token,owner_user_id,facility,company_name,equipment_json,updated_at")
        .eq("owner_user_id", owner)
        .eq("facility", facility)
        .order("updated_at", { ascending:false })
        .limit(1);
      const newer = Array.isArray(res.data) ? res.data[0] : res.data;
      if(!res.error && newer && Array.isArray(newer.equipment_json) && newer.equipment_json.length > 0) {
        return { ...newer, token:data?.token || token };
      }
    }
    if(data) return data;
    return null;
  } catch(e) {
    console.warn("WO request public portal load failed:", e);
    return null;
  }
}

async function submitPublicWORequest(req) {
  try {
    const { error } = await supabase.from("wo_requests_public").insert({
      id:req.id,
      portal_token:req.portalToken,
      owner_user_id:req.ownerUserId,
      facility:req.facility,
      submitted_date:req.submittedDate,
      fault_date:req.faultDate,
      requested_by:req.requestedBy,
      equipment:req.equipment,
      equipment_name:req.equipmentName,
      description:req.description,
      photos_json:req.photos || [],
      status:"New",
      created_at:req.createdAt || new Date().toISOString(),
    });
    if(error) throw error;
    return true;
  } catch(e) {
    console.warn("Public WO request submit failed:", e);
    const msg = String(e?.message || e || "");
    const code = String(e?.code || "");
    if(code === "42P01" || msg.toLowerCase().includes("does not exist") || msg.toLowerCase().includes("schema cache")) {
      alert("This request portal is not fully connected yet. Maintenance needs to finish the Work Order Request storage setup in Supabase.");
    } else if(code === "42501" || msg.toLowerCase().includes("row-level security") || msg.toLowerCase().includes("permission")) {
      alert("This request portal is active, but guest submissions are blocked by Supabase security settings. Maintenance needs to enable guest request submissions.");
    } else {
      alert("The request could not be submitted. Please try again or notify maintenance.");
    }
    return false;
  }
}

function WorkOrderRequests({ state, dispatch, session, publicPortal=null, publicMode=false }) {
  const portalToken = getWORequestPortalToken();
  const isOperatorPortal = !!portalToken;
  const settings = publicPortal ? { companyName:publicPortal.company_name || "MaintForge", locations:[publicPortal.facility].filter(Boolean), facilityQrIds:{ [publicPortal.facility]:portalToken } } : (state.settings || {});
  const portalEquipment = Array.isArray(publicPortal?.equipment_json) ? publicPortal.equipment_json : [];
  const equipmentSource = publicMode ? portalEquipment : (state.equipment||[]);
  const facilities = [...new Set([...(settings.locations||[]), ...equipmentSource.map(e=>e.location).filter(Boolean), settings.location, settings.siteName].filter(Boolean))];
  const allFacilities = facilities.length ? facilities : [publicPortal?.facility || "Main Facility"];
  const facilityQrIds = settings.facilityQrIds || {};
  const facilityFromToken = portalToken ? (publicPortal?.facility || allFacilities.find(f=>facilityQrIds[f]===portalToken) || allFacilities.find(f=>slugifyFacility(f)===portalToken) || allFacilities[0]) : "";
  const defaultFacility = facilityFromToken || allFacilities[0] || "Main Facility";
  const [facility, setFacility] = useState(defaultFacility);
  const [requestForm, setRequestForm] = useState({ requestedBy:"", faultDate:today(), equipment:"", description:"", photos:[] });
  const [equipmentSearch, setEquipmentSearch] = useState("");
  const [showSubmit, setShowSubmit] = useState(isOperatorPortal);
  const [statusFilter, setStatusFilter] = useState("New");
  const [showQRPicker, setShowQRPicker] = useState(false);
  const [reviewRequest, setReviewRequest] = useState(null);

  useEffect(()=>{
    if(isOperatorPortal || !session?.user?.id) return;
    let cancelled = false;
    async function loadPublicRequests(){
      try {
        const { data, error } = await supabase
          .from("wo_requests_public")
          .select("*")
          .eq("owner_user_id", session.user.id)
          .order("created_at", { ascending:false });
        if(error) throw error;
        if(cancelled) return;
        const existing = new Set((state.workOrderRequests||[]).map(r=>r.id));
        (data||[]).forEach(row=>{
          if(existing.has(row.id)) return;
          dispatch({type:"ADD_WO_REQUEST", payload:{
            id:row.id,
            portalToken:row.portal_token,
            facility:row.facility,
            submittedDate:row.submitted_date,
            createdAt:row.created_at,
            faultDate:row.fault_date,
            requestedBy:row.requested_by,
            equipment:row.equipment,
            equipmentName:row.equipment_name,
            description:row.description,
            photos:row.photos_json || [],
            status:row.status || "New",
            publicRequest:true,
          }});
        });
      } catch(e) { console.warn("Public WO requests load failed:", e); }
    }
    loadPublicRequests();
  }, [isOperatorPortal, session?.user?.id]);

  useEffect(()=>{
    const missing = allFacilities.filter(f=>!facilityQrIds[f]);
    if(missing.length && !isOperatorPortal) {
      const nextIds = { ...facilityQrIds };
      missing.forEach(f=>{ if(!nextIds[f]) nextIds[f] = makeStableFacilityQrToken(); });
      dispatch({ type:"UPDATE_SETTINGS", payload:{ ...settings, facilityQrIds:nextIds } });
    }
  }, [allFacilities.join("|"), isOperatorPortal]);

  useEffect(()=>{
    if(isOperatorPortal && facilityFromToken && facility !== facilityFromToken) setFacility(facilityFromToken);
  }, [portalToken, facilityFromToken]);
  useEffect(()=>{
    if(isOperatorPortal || !session?.user?.id) return;
    const timer = setTimeout(()=>{
      (allFacilities||[]).forEach(fac=>{
        const token = getFacilityQrToken(settings, fac);
        upsertWORequestPortal({ token, ownerUserId:session.user.id, facility:fac, settings, equipment:state.equipment||[] });
      });
    }, 600);
    return ()=>clearTimeout(timer);
  }, [isOperatorPortal, session?.user?.id, allFacilities.join("|"), JSON.stringify(facilityQrIds), (state.equipment||[]).length, settings.companyName]);


  const exactEqForFacility = equipmentSource.filter(e=>equipmentMatchesFacility(e, facility));
  const eqForFacility = exactEqForFacility.length ? exactEqForFacility : equipmentSource;
  const equipmentSuggestions = eqForFacility.filter(e=>{
    const q = equipmentSearch.trim().toLowerCase();
    if(!q) return false;
    const text = `${e.id||""} ${e.name||""} ${e.nomenclature||""} ${e.category||""} ${e.make||""} ${e.model||""} ${e.serial||""}`.toLowerCase();
    return text.includes(q);
  }).slice(0,8);
  const selectedEquipment = equipmentSource.find(e=>e.id===requestForm.equipment);
  const requests = (state.workOrderRequests||[]).filter(r=> statusFilter==="All" ? true : (r.status||"New")===statusFilter);

  const updateForm = (k,v) => setRequestForm(f=>({...f,[k]:v}));
  const handlePhotos = (files) => {
    const list = Array.from(files||[]).slice(0,4);
    if(!list.length) return;
    Promise.all(list.map(file=>new Promise(resolve=>{ const reader=new FileReader(); reader.onload=e=>resolve({name:file.name, data:e.target.result}); reader.readAsDataURL(file); })))
      .then(photos=>setRequestForm(f=>({...f, photos:[...(f.photos||[]), ...photos].slice(0,4)})));
  };
  const chooseEquipment = (e) => {
    updateForm("equipment", e.id);
    setEquipmentSearch(`${e.id} — ${e.name||e.nomenclature||"Equipment"}`);
  };
  const submitRequest = async () => {
    if(!requestForm.requestedBy.trim()) { alert("Enter Requested By."); return; }
    const typedEquipment = equipmentSearch.trim();
    if(!requestForm.equipment && !typedEquipment) { alert("Select or type equipment."); return; }
    if(!requestForm.description.trim()) { alert("Enter the problem description."); return; }
    const eq = equipmentSource.find(e=>e.id===requestForm.equipment) || {};
    const req = {
      id:`WOR-${String(Date.now()).slice(-6)}`,
      facility: facility || eq.location || defaultFacility,
      submittedDate: today(),
      createdAt: new Date().toISOString(),
      faultDate: requestForm.faultDate || today(),
      requestedBy: requestForm.requestedBy.trim(),
      equipment: requestForm.equipment || typedEquipment,
      equipmentName: eq.name || eq.nomenclature || (requestForm.equipment ? "" : "Typed by operator"),
      description: requestForm.description.trim(),
      photos: requestForm.photos || [],
      status:"New",
      portalToken,
      ownerUserId: publicPortal?.owner_user_id || session?.user?.id || "",
    };
    if(isOperatorPortal && publicMode) {
      const ok = await submitPublicWORequest(req);
      if(!ok) return;
    } else {
      dispatch({type:"ADD_WO_REQUEST", payload:req});
    }
    setRequestForm({ requestedBy:"", faultDate:today(), equipment:"", description:"", photos:[] });
    setEquipmentSearch("");
    alert("Work order request submitted.");
  };

  const convertToWO = (req) => {
    const id = genNextWOId(state.workOrders||[], req.equipment, "R");
    const wo = {
      id,
      woType:"Repair",
      title:`Request from ${req.requestedBy || "Operator"}`,
      equipment:req.equipment,
      status:"Open",
      equipmentStatus:"Operational with Deficiencies",
      priority:settings.defaultPriority || "Medium",
      created:today(),
      faultDate:req.faultDate || req.submittedDate || today(),
      requestedBy:req.requestedBy || "",
      requestId:req.id,
      description:req.description || "",
      faultDescription:req.description || "",
      mechanicNotes:"",
      attachments:req.photos || [],
      partsUsed:[],
      outsideServices:[],
      laborHours:0,
      laborCost:0,
      partsCost:0,
    };
    dispatch({type:"ADD_WO", payload:wo});
    dispatch({type:"UPDATE_WO_REQUEST", payload:{...req, status:"Converted", convertedWO:id, convertedDate:today()}});
    if(req.publicRequest) {
      try { supabase.from("wo_requests_public").update({ status:"Converted", converted_wo:id, converted_date:today() }).eq("id", req.id); } catch(e) {}
    }
    setReviewRequest(null);
  };

  const printQR = async (fac) => {
    const token = getFacilityQrToken(settings, fac);
    const url = requestUrlForFacility(fac, settings, session?.user?.id || "");
    await upsertWORequestPortal({ token, ownerUserId:session?.user?.id, facility:fac, settings, equipment:state.equipment||[] });
    const win = window.open("","_blank");
    if(!win) { alert("Pop-up blocked. Allow pop-ups to print the QR code."); return; }
    win.document.write(`<html><head><title>Work Order Request QR</title><style>
      body{font-family:Arial,sans-serif;text-align:center;padding:28px;color:#111;background:#fff}.sheet{max-width:520px;margin:0 auto;border:2px solid #111;border-radius:16px;padding:26px}.brand{font-size:24px;font-weight:800;margin:0 0 4px}.facility{font-size:18px;font-weight:700;margin:0 0 18px}.instructions{font-size:16px;line-height:1.35;margin:0 0 18px}.qr{width:300px;height:300px;max-width:88vw;background:#fff}.footer{font-size:12px;margin-top:18px;color:#555}.note{font-size:12px;color:#555;margin-top:12px}button{margin-top:22px;padding:10px 18px;border:none;border-radius:8px;background:#111827;color:#fff;font-weight:700;cursor:pointer}@media print{button{display:none}body{padding:0}.sheet{border:2px solid #111;margin-top:20px}}
    </style></head><body><div class="sheet"><div class="brand">${htmlEscape(settings.companyName||"MaintForge")}</div><div class="facility">${htmlEscape(fac)}</div><p class="instructions">Scan this QR code to submit a maintenance work order request.</p><img class="qr" src="${qrUrlForText(url)}"/><div class="note">This QR code is permanent for this facility. Do not replace unless intentionally regenerated by the owner.</div><div class="footer">MaintForge Work Order Requests</div></div><button onclick="window.print()">Print QR Code</button></body></html>`);
    win.document.close();
  };

  const RequestActions = ({ r }) => (
    <div className="wo-request-actions" style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
      <Btn small variant="secondary" onClick={()=>setReviewRequest(r)}>Review</Btn>
      {(r.status||"New")==="New" && <Btn small onClick={()=>convertToWO(r)}>Create WO</Btn>}
      {(r.status||"New")==="New" && <Btn small variant="secondary" onClick={()=>dispatch({type:"UPDATE_WO_REQUEST", payload:{...r,status:"Dismissed"}})}>Dismiss</Btn>}
      <Btn small variant="danger" onClick={()=>{ if(confirm("Delete this request?")) dispatch({type:"DELETE_WO_REQUEST", payload:r.id}); }}>Delete</Btn>
    </div>
  );

  const RequestReview = ({ r }) => r ? <Modal title="Review Work Order Request" onClose={()=>setReviewRequest(null)}>
    <div style={{ display:"grid", gap:14 }}>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))", gap:10 }}>
        <div><b>Facility</b><br/>{r.facility}</div>
        <div><b>Equipment</b><br/>{r.equipment}<br/><span style={{ color:T.muted }}>{r.equipmentName}</span></div>
        <div><b>Requested By</b><br/>{r.requestedBy}</div>
        <div><b>Fault Date</b><br/>{r.faultDate}</div>
        <div><b>Submitted</b><br/>{r.submittedDate}</div>
        <div><b>Status</b><br/>{r.status||"New"}</div>
      </div>
      <div style={{ padding:12, border:`1px solid ${T.border}`, borderRadius:12, background:T.grayLt }}><b>Operator Statement</b><div style={{ marginTop:6, whiteSpace:"pre-wrap", lineHeight:1.45 }}>{r.description}</div></div>
      {(r.photos||[]).length>0 ? <div><b>Pictures</b><div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(140px,1fr))", gap:10, marginTop:8 }}>{r.photos.map((p,i)=><a key={i} href={p.data} target="_blank" rel="noreferrer"><img src={p.data} alt={p.name||`Photo ${i+1}`} style={{ width:"100%", height:150, objectFit:"cover", borderRadius:12, border:`1px solid ${T.border}` }}/></a>)}</div></div> : <div style={{ color:T.muted }}>No pictures attached.</div>}
      <div style={{ display:"flex", gap:8, justifyContent:"flex-end", flexWrap:"wrap" }}>
        {(r.status||"New")==="New" && <Btn onClick={()=>convertToWO(r)}>Create Work Order</Btn>}
        {(r.status||"New")==="New" && <Btn variant="secondary" onClick={()=>{ dispatch({type:"UPDATE_WO_REQUEST", payload:{...r,status:"Dismissed"}}); if(r.publicRequest){ try { supabase.from("wo_requests_public").update({ status:"Dismissed" }).eq("id", r.id); } catch(e) {} } setReviewRequest(null); }}>Dismiss Request</Btn>}
        <Btn variant="secondary" onClick={()=>setReviewRequest(null)}>Close</Btn>
      </div>
    </div>
  </Modal> : null;

  if(isOperatorPortal) {
    return <div className="wo-requests-page operator-request-only" style={{ display:"grid", gap:16, maxWidth:720, margin:"0 auto" }}>
      <Card>
        <SectionHeading sub="Submit a maintenance request. No account is required.">Work Order Request</SectionHeading>
        <div className="wo-request-form-grid" style={{ display:"grid", gridTemplateColumns:"1fr", gap:12 }}>
          <Field label="Facility"><input style={inp} value={facility} disabled /></Field>
          <Field label="Fault Date"><input style={inp} type="date" value={requestForm.faultDate} onChange={e=>updateForm("faultDate",e.target.value)} /></Field>
          <Field label="Requested By"><input style={inp} value={requestForm.requestedBy} onChange={e=>updateForm("requestedBy",e.target.value)} placeholder="Your name" /></Field>
          <Field label="Equipment">
            <div style={{ position:"relative" }}>
              <input style={inp} value={equipmentSearch} onChange={e=>{ setEquipmentSearch(e.target.value); updateForm("equipment",""); }} placeholder="Start typing equipment number or name" autoComplete="off" />
              {equipmentSuggestions.length>0 && <div className="equipment-suggestion-box" style={{ position:"absolute", zIndex:50, top:"100%", left:0, right:0, background:T.surface, border:`1px solid ${T.border}`, borderRadius:12, boxShadow:"0 12px 28px rgba(0,0,0,.12)", marginTop:4, overflow:"hidden" }}>
                {equipmentSuggestions.map(e=><button key={e.id} type="button" onClick={()=>chooseEquipment(e)} style={{ display:"block", width:"100%", textAlign:"left", padding:"12px 14px", border:"none", borderBottom:`1px solid ${T.border}`, background:T.surface, color:T.text, cursor:"pointer" }}><b>{e.id}</b> — {e.name||e.nomenclature||"Equipment"}<br/><span style={{ fontSize:12, color:T.muted }}>{e.category||""}</span></button>)}
              </div>}
            </div>
            {selectedEquipment && <div style={{ fontSize:12, color:T.green, marginTop:6 }}>Selected: <b>{selectedEquipment.id}</b> — {selectedEquipment.name||selectedEquipment.nomenclature||"Equipment"}</div>}
            {!eqForFacility.length && <div style={{ fontSize:12, color:T.amber, marginTop:6, lineHeight:1.4 }}>Equipment list is still syncing for this facility. You can still type the equipment number/name and submit the request.</div>}
          </Field>
          <Field label="Photos (Optional)"><input style={inp} type="file" accept="image/*" capture="environment" multiple onChange={e=>handlePhotos(e.target.files)} /></Field>
          <Field label="Problem / Fault Description"><textarea style={{...inp, minHeight:150}} value={requestForm.description} onChange={e=>updateForm("description",e.target.value)} placeholder="Describe what is wrong, where it is located, and what happened." /></Field>
        </div>
        {(requestForm.photos||[]).length>0 && <div className="wo-request-photo-strip" style={{ display:"flex", gap:8, flexWrap:"wrap", marginTop:10 }}>{requestForm.photos.map((p,i)=><div key={i} style={{ position:"relative" }}><img src={p.data} alt={p.name} style={{ width:82, height:82, objectFit:"cover", borderRadius:10, border:`1px solid ${T.border}` }}/><button onClick={()=>setRequestForm(f=>({...f,photos:f.photos.filter((_,x)=>x!==i)}))} style={{ position:"absolute", top:-6, right:-6, border:"none", borderRadius:10, background:T.red, color:"#fff", cursor:"pointer", width:22, height:22, fontWeight:900 }}>×</button></div>)}</div>}
        <div className="wo-request-form-actions" style={{ display:"flex", justifyContent:"flex-end", gap:8, marginTop:14 }}><Btn onClick={submitRequest}>Submit Request</Btn></div>
      </Card>
    </div>;
  }

  return <div className="wo-requests-page" style={{ display:"grid", gap:16 }}>
    <Card>
      <div className="wo-request-header-row" style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:12, marginBottom:10 }}>
        <SectionHeading sub="Owner/Admin request queue. QR codes are printed from the button in the corner and are permanent per facility.">Work Order Requests</SectionHeading>
        <Btn small onClick={()=>setShowQRPicker(true)}>Print QR Code</Btn>
      </div>
    </Card>

    {showQRPicker && <Modal title="Print QR Code" onClose={()=>setShowQRPicker(false)}>
      <div style={{ display:"grid", gap:10 }}>
        <div style={{ fontSize:13, color:T.muted, lineHeight:1.4 }}>Choose one facility. Only that facility QR code will be generated for printing. This QR code is permanent for that facility.</div>
        {allFacilities.map(fac=><button key={fac} onClick={async()=>{ await printQR(fac); setShowQRPicker(false); }} style={{ textAlign:"left", padding:"14px 16px", borderRadius:12, border:`1px solid ${T.border}`, background:T.surface, cursor:"pointer", color:T.text }}>
          <div style={{ fontWeight:900, fontSize:15 }}>{fac}</div>
        </button>)}
      </div>
    </Modal>}

    {reviewRequest && <RequestReview r={reviewRequest} />}

    <Card>
      <SectionHeading sub="Open a request to review the operator statement and pictures before creating a Repair Work Order.">Request Queue</SectionHeading>
      <div style={{ display:"flex", gap:8, marginBottom:10 }}><select style={{...sel, width:170}} value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}>{["New","Converted","Dismissed","All"].map(x=><option key={x}>{x}</option>)}</select></div>

      <div className="wo-request-mobile-list">
        {requests.map(r=><div className="wo-request-mobile-card" key={r.id} style={{ border:`1px solid ${T.border}`, borderRadius:14, padding:14, background:T.surface, marginBottom:12 }}>
          <div style={{ display:"flex", justifyContent:"space-between", gap:10, alignItems:"flex-start", marginBottom:10 }}>
            <div><div style={{ fontSize:12, color:T.muted, fontWeight:800, textTransform:"uppercase" }}>Equipment</div><div style={{ fontSize:18, fontWeight:900, color:T.text }}>{r.equipment}</div><div style={{ fontSize:13, color:T.muted }}>{r.equipmentName}</div></div>
            <div style={{ padding:"5px 9px", borderRadius:999, background:(r.status||"New")==="New"?T.accentLt:T.grayLt, color:(r.status||"New")==="New"?T.accent:T.subtext, fontSize:12, fontWeight:900 }}>{r.status||"New"}</div>
          </div>
          <div className="wo-request-mobile-meta" style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:10 }}>
            <div><b>Fault Date</b><br/>{r.faultDate}</div>
            <div><b>Submitted</b><br/>{r.submittedDate}</div>
            <div><b>Facility</b><br/>{r.facility}</div>
            <div><b>Requested By</b><br/>{r.requestedBy}</div>
          </div>
          <div style={{ fontSize:13, lineHeight:1.4, marginBottom:12 }}><b>Operator Statement</b><br/>{r.description}</div>
          {(r.photos||[]).length>0 && <div style={{ display:"flex", gap:8, overflowX:"auto", marginBottom:12 }}>{r.photos.map((p,i)=><img key={i} src={p.data} alt={p.name||`Photo ${i+1}`} style={{ width:86, height:86, objectFit:"cover", borderRadius:10, border:`1px solid ${T.border}`, flex:"0 0 auto" }}/>)}</div>}
          {r.convertedWO && <div style={{ fontSize:13, marginBottom:10 }}><b>Converted WO:</b> {r.convertedWO}</div>}
          <RequestActions r={r} />
        </div>)}
        {!requests.length && <div style={{ padding:20, textAlign:"center", color:T.muted, border:`1px dashed ${T.border}`, borderRadius:12 }}>No requests found.</div>}
      </div>

      <div className="wo-request-desktop-table mobile-x-scroll"><table style={{ width:"100%", borderCollapse:"collapse" }}><thead><tr>{["Submitted","Fault Date","Facility","Equipment","Requested By","Statement / Pictures","Status","Actions"].map(h=><th key={h} style={{ textAlign:"left", padding:10, borderBottom:`1px solid ${T.border}`, color:T.muted }}>{h}</th>)}</tr></thead><tbody>
        {requests.map(r=><tr key={r.id}><td style={{ padding:10, borderBottom:`1px solid ${T.border}` }}>{r.submittedDate}</td><td style={{ padding:10, borderBottom:`1px solid ${T.border}`, fontWeight:800 }}>{r.faultDate}</td><td style={{ padding:10, borderBottom:`1px solid ${T.border}` }}>{r.facility}</td><td style={{ padding:10, borderBottom:`1px solid ${T.border}` }}><b>{r.equipment}</b><br/><span style={{ color:T.muted, fontSize:12 }}>{r.equipmentName}</span></td><td style={{ padding:10, borderBottom:`1px solid ${T.border}` }}>{r.requestedBy}</td><td style={{ padding:10, borderBottom:`1px solid ${T.border}`, maxWidth:360 }}><div style={{ marginBottom:6 }}>{r.description}</div>{(r.photos||[]).length>0?<span style={{ fontSize:12, color:T.accent, fontWeight:800 }}>{r.photos.length} picture{r.photos.length!==1?"s":""} attached</span>:<span style={{ fontSize:12, color:T.muted }}>No pictures</span>}</td><td style={{ padding:10, borderBottom:`1px solid ${T.border}` }}>{r.status}{r.convertedWO?<><br/><b>{r.convertedWO}</b></>:null}</td><td style={{ padding:10, borderBottom:`1px solid ${T.border}` }}><RequestActions r={r} /></td></tr>)}
        {!requests.length && <tr><td colSpan="8" style={{ padding:24, textAlign:"center", color:T.muted }}>No requests found.</td></tr>}
      </tbody></table></div>
    </Card>
  </div>;
}


function SystemSettings({ state, dispatch, onClose }) {
  const s = state.settings || {};
  const [form, setForm] = useState({
    companyName:   s.companyName   || "National Cemetery Administration",
    department:    s.department    || "Maintenance Department",
    location:      s.location      || "",
    phone:         s.phone         || "",
    email:         s.email         || "",
    siteName:      s.siteName      || "",
    region:        s.region        || "",
    address:       s.address       || "",
    cityState:     s.cityState     || "",
    locations:     Array.isArray(s.locations) ? s.locations : [],
    areas:         Array.isArray(s.areas) ? s.areas : [],
    _newLoc:       "",
    _newArea:      "",
    _newAreaFacilityId: "",
    accentColor:   s.accentColor   || "#0052cc",
    theme:         s.theme         || "light",
    dateFormat:    s.dateFormat    || "MM/DD/YYYY",
    currency:      s.currency      || "USD",
    defaultPriority: s.defaultPriority || "Medium",
    laborRateDefault: s.laborRateDefault || 45,
    logo:          s.logo          || "",
    showCostsOnWO: s.showCostsOnWO !== false,
    requireTech:   s.requireTech   || false,
  });
  const orgLocations = normalizeMaintForgeLocations(state);
  const orgAreas = normalizeMaintForgeAreas({ ...state, settings:form });
  const [inviteForm, setInviteForm] = useState({ email:"", name:"", role:"Facility Administrator", locationId:orgLocations[0]?.id || "" });
  const [migrationForm, setMigrationForm] = useState({ fromId:orgLocations[0]?.id || "", toId:orgLocations[1]?.id || orgLocations[0]?.id || "", pmTasks:true, inspectionTasks:true, tasks:true });
  const createInvitePayload = () => {
    const token = `INVITE-${Date.now()}-${Math.random().toString(36).slice(2,8).toUpperCase()}`;
    const locName = locationNameForId(state, inviteForm.locationId);
    let inviteUrl = token;
    try {
      inviteUrl = `${window.location.origin}${window.location.pathname}?invite=${encodeURIComponent(token)}`;
    } catch(e) {}
    return { ...inviteForm, token, inviteUrl, locationName:locName, organizationId:state.organization?.id || "", organizationName:form.companyName || state.organization?.name || "" };
  };
  const F = k => e => setForm(f=>({...f,[k]:e.target.value}));
  const Toggle = ({label, k, sub}) => (
    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"10px 0", borderBottom:`1px solid ${T.border}` }}>
      <div>
        <div style={{ fontFamily:T.sans, fontSize:13, color:T.text, fontWeight:500 }}>{label}</div>
        {sub && <div style={{ fontFamily:T.sans, fontSize:11, color:T.muted, marginTop:2 }}>{sub}</div>}
      </div>
      <button type="button" onClick={()=>setForm(f=>({...f,[k]:!f[k]}))} style={{ width:44, height:24, borderRadius:12, border:"none", background:form[k]?T.accent:"#d1d5db", cursor:"pointer", position:"relative", transition:"background .2s", flexShrink:0 }}>
        <span style={{ position:"absolute", top:3, left:form[k]?22:3, width:18, height:18, borderRadius:"50%", background:T.card, transition:"left .2s", display:"block", boxShadow:"0 1px 3px rgba(0,0,0,.2)" }}/>
      </button>
    </div>
  );

  const handleLogo = e => {
    const file = e.target.files[0]; if(!file) return;
    const reader = new FileReader();
    reader.onload = ev => setForm(f=>({...f, logo:ev.target.result}));
    reader.readAsDataURL(file);
  };

  const save = () => {
    const { _newLoc, _newArea, _newAreaFacilityId, ...cleanForm } = form;
    const cleanLocations = [...new Set((cleanForm.locations || []).map(l => String(l || "").trim()).filter(Boolean))];
    const cleanAreas = (cleanForm.areas || []).map(a => typeof a === "string" ? { name:a } : a).filter(a => String(a?.name || "").trim());
    dispatch({ type:"UPDATE_SETTINGS", payload:{ ...cleanForm, locations: cleanLocations, areas: cleanAreas } });
    onClose();
  };

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
              {form.logo && <img src={form.logo} alt="logo" style={{ height:48, objectFit:"contain", border:`1px solid ${T.border}`, borderRadius:6, padding:4, background:T.surface }} />}
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
            <Field label="Appearance / Theme" half>
              <select style={sel} value={form.theme} onChange={F("theme")}>
                <option value="light">☀️ Light Mode</option>
                <option value="dark">🌙 Dark Mode</option>
                <option value="system">💻 System Default</option>
              </select>
            </Field>
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
          <div style={{ fontFamily:T.sans, fontSize:11, fontWeight:700, color:T.muted, textTransform:"uppercase", letterSpacing:.6, marginBottom:10, paddingBottom:6, borderBottom:`2px solid ${T.border}` }}>Foundation — Facilities & Areas</div>
          <div style={{ fontFamily:T.sans, fontSize:12, color:T.muted, marginBottom:10 }}>Create separate Facilities for independent shops/sites. Add Areas for buildings, departments, zones, or sections inside a Facility.</div>
          <div style={{ display:"flex", gap:8, marginBottom:10 }}>
            <input style={{ ...inp, flex:1 }} placeholder="Add facility (e.g. MNC, PRNC, San Juan Shop)..." value={form._newLoc||""} onChange={e=>setForm(f=>({...f,_newLoc:e.target.value}))} onKeyDown={e=>{ if(e.key==="Enter"&&form._newLoc?.trim()){ e.preventDefault(); setForm(f=>{ const next=f._newLoc.trim(); const existing=(f.locations||[]).map(x=>String(x).toLowerCase()); return {...f,locations:existing.includes(next.toLowerCase())?(f.locations||[]):[...(f.locations||[]),next],_newLoc:""}; }); }}} />
            <Btn small onClick={()=>{ if(form._newLoc?.trim()) setForm(f=>{ const next=f._newLoc.trim(); const existing=(f.locations||[]).map(x=>String(x).toLowerCase()); return {...f,locations:existing.includes(next.toLowerCase())?(f.locations||[]):[...(f.locations||[]),next],_newLoc:""}; }); }}>Add</Btn>
          </div>
          {(form.locations||[]).length===0 ? (
            <div style={{ fontFamily:T.sans, fontSize:12, color:T.muted, fontStyle:"italic", padding:"8px 0" }}>No facilities defined. Add one above.</div>
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

          <div style={{ marginTop:14, padding:12, border:`1px solid ${T.border}`, borderRadius:8, background:T.grayLt }}>
            <div style={{ fontFamily:T.sans, fontSize:12, fontWeight:800, color:T.text, marginBottom:8 }}>Areas Inside a Facility</div>
            <div style={{ fontFamily:T.sans, fontSize:11, color:T.muted, marginBottom:8 }}>Use Areas for Administration Building, Maintenance Building, Warehouse, Fuel Station, sections, or other places inside one Facility. Areas do not create a separate shop.</div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr auto", gap:8, alignItems:"center" }}>
              <select style={sel} value={form._newAreaFacilityId || orgLocations[0]?.id || ""} onChange={e=>setForm(f=>({...f,_newAreaFacilityId:e.target.value}))}>
                {orgLocations.map(l=><option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
              <input style={inp} placeholder="Add area (e.g. Administration Building, Maintenance Building)..." value={form._newArea||""} onChange={e=>setForm(f=>({...f,_newArea:e.target.value}))} />
              <Btn small onClick={()=>{ if(form._newArea?.trim()) setForm(f=>{ const facId=f._newAreaFacilityId || orgLocations[0]?.id || ""; const facName=locationNameForId({ ...state, settings:f }, facId); const next={ id:`AREA-${Date.now()}`, name:f._newArea.trim(), facilityId:facId, facilityName:facName }; const exists=(f.areas||[]).some(a=>String((typeof a==="string"?a:a.name)||"").toLowerCase()===next.name.toLowerCase() && (!facId || a.facilityId===facId)); return exists ? {...f,_newArea:""} : {...f,areas:[...(f.areas||[]),next],_newArea:""}; }); }}>Add Area</Btn>
            </div>
            {(form.areas||[]).length===0 ? <div style={{ fontFamily:T.sans, fontSize:12, color:T.muted, fontStyle:"italic", padding:"8px 0" }}>No areas defined yet.</div> : (
              <div style={{ display:"flex", flexDirection:"column", gap:4, maxHeight:180, overflowY:"auto", marginTop:10 }}>
                {(form.areas||[]).map((area,i)=>{ const a=typeof area==="string"?{name:area}:area; return (
                  <div key={a.id||i} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"7px 12px", background:T.surface, borderRadius:6, border:`1px solid ${T.border}` }}>
                    <span style={{ fontFamily:T.sans, fontSize:13, color:T.text }}><b>{a.name}</b><span style={{ color:T.muted }}> — {a.facilityName || locationNameForId({ ...state, settings:form }, a.facilityId)}</span></span>
                    <button onClick={()=>setForm(f=>({...f,areas:(f.areas||[]).filter((_,j)=>j!==i)}))} style={{ background:"none", border:"none", color:T.red, cursor:"pointer", fontSize:16, lineHeight:1, padding:"0 4px" }}>×</button>
                  </div>
                );})}
              </div>
            )}
          </div>

          <div style={{ marginTop:14, padding:12, border:`1px solid ${T.border}`, borderRadius:8, background:T.grayLt }}>
            <div style={{ fontFamily:T.sans, fontSize:12, fontWeight:800, color:T.text, marginBottom:8 }}>Invite User to a Facility</div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
              <input style={inp} placeholder="Mechanic name" value={inviteForm.name} onChange={e=>setInviteForm(f=>({...f,name:e.target.value}))} />
              <input style={inp} placeholder="Mechanic email" value={inviteForm.email} onChange={e=>setInviteForm(f=>({...f,email:e.target.value}))} />
              <select style={sel} value={inviteForm.role} onChange={e=>setInviteForm(f=>({...f,role:e.target.value}))}><option>Facility Administrator</option><option>Mechanic</option><option>Read Only</option></select>
              <select style={sel} value={inviteForm.locationId} onChange={e=>setInviteForm(f=>({...f,locationId:e.target.value}))}>{orgLocations.map(l=><option key={l.id} value={l.id}>{l.name}</option>)}</select>
            </div>
            <div style={{ display:"flex", justifyContent:"space-between", gap:8, marginTop:8, alignItems:"center" }}>
              <div style={{ fontSize:11, color:T.muted }}>Invite is saved with a secure token. Until email service is connected, copy the invite link shown below and send it to the user.</div>
              <Btn small onClick={()=>{ if(!inviteForm.email.trim()) return alert("Enter an email first."); if(!inviteForm.locationId) return alert("Create/select a facility first."); const payload=createInvitePayload(); dispatch({type:"ADD_USER_INVITE", payload}); alert("Invite created. Send the invite link to the user so they can create their account for only this facility."); setInviteForm(f=>({...f,email:"",name:""})); }}>Create Invite</Btn>
            </div>
            {(state.userInvites||[]).length>0 && <div style={{ marginTop:8, display:"grid", gap:6 }}>{(state.userInvites||[]).slice(0,5).map(inv=><div key={inv.id} style={{ fontSize:12, color:T.subtext, padding:8, border:`1px solid ${T.border}`, borderRadius:6, background:T.surface }}><b style={{ color:T.text }}>{inv.email}</b> — {inv.role} — {inv.locationName || locationNameForId(state, inv.locationId)} — {inv.status}<div style={{ marginTop:4, fontFamily:T.mono, fontSize:10, color:T.muted, wordBreak:"break-all" }}>{inv.inviteUrl || inv.token || "Invite token saved"}</div></div>)}</div>}
          </div>

          <div style={{ marginTop:14, padding:12, border:`1px solid ${T.border}`, borderRadius:8, background:T.grayLt }}>
            <div style={{ fontFamily:T.sans, fontSize:12, fontWeight:800, color:T.text, marginBottom:8 }}>Migrate / Copy Templates Between Facilities</div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
              <Field label="From Facility" half><select style={sel} value={migrationForm.fromId} onChange={e=>setMigrationForm(f=>({...f,fromId:e.target.value}))}>{orgLocations.map(l=><option key={l.id} value={l.id}>{l.name}</option>)}</select></Field>
              <Field label="To Facility" half><select style={sel} value={migrationForm.toId} onChange={e=>setMigrationForm(f=>({...f,toId:e.target.value}))}>{orgLocations.map(l=><option key={l.id} value={l.id}>{l.name}</option>)}</select></Field>
            </div>
            <div style={{ display:"flex", gap:12, flexWrap:"wrap", fontSize:12, color:T.text }}>
              <label><input type="checkbox" checked={migrationForm.pmTasks} onChange={e=>setMigrationForm(f=>({...f,pmTasks:e.target.checked}))}/> PM task library</label>
              <label><input type="checkbox" checked={migrationForm.inspectionTasks} onChange={e=>setMigrationForm(f=>({...f,inspectionTasks:e.target.checked}))}/> Inspection task library</label>
              <label><input type="checkbox" checked={migrationForm.tasks} onChange={e=>setMigrationForm(f=>({...f,tasks:e.target.checked}))}/> General task library</label>
            </div>
            <div style={{ display:"flex", justifyContent:"space-between", gap:8, marginTop:8, alignItems:"center" }}>
              <div style={{ fontSize:11, color:T.muted }}>This creates independent copies in the destination facility. The destination mechanic can edit their copy without changing the original templates.</div>
              <Btn small onClick={()=>{ if(migrationForm.fromId===migrationForm.toId) return alert("Choose two different facilities."); dispatch({type:"MIGRATE_TEMPLATES", payload:migrationForm}); alert("Independent copies created in destination facility."); }}>Copy Selected</Btn>
            </div>
          </div>

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
      <div style={{ maxWidth:680, margin:"40px auto", background:T.card, borderRadius:14, boxShadow:"0 10px 40px rgba(0,0,0,.12)", padding:"32px 36px" }}>
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
                {data.logo && <img src={data.logo} alt="logo" style={{ height:64, maxWidth:120, objectFit:"contain", border:`1px solid ${T.border}`, borderRadius:6, padding:4, background:T.surface }} />}
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
                <span key={i} style={{ display:"flex", alignItems:"center", gap:6, padding:"6px 12px", background:T.card, border:`1px solid ${T.border}`, borderRadius:7, fontFamily:T.sans, fontSize:13, color:T.text }}>
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



function fuelReportHTML(state={}, period="month") {
  const containers = state.fuelContainers || [];
  const total = containers.reduce((s,c)=>s+(+(latestFuelReading(state,c.id)?.gallons||0)),0);
  const periodLabel = period==="month" ? "This Month" : period==="quarter" ? "This Quarter" : period==="year" ? "This Year" : "This FY";
  return `<!DOCTYPE html><html><head><title>Fuel Report</title><style>body{font-family:Arial,sans-serif;padding:22px;color:#111}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ddd;padding:8px;text-align:left}th{background:#f3f4f6}.right{text-align:right}@media print{button{display:none}}</style></head><body>${reportHeaderHTML(state,"Fuel Report")}<p>Total fuel on hand: <b>${Math.round(total).toLocaleString()} gallons</b></p><p>Usage period: <b>${periodLabel}</b></p><table><thead><tr><th>Container</th><th>Fuel</th><th>Capacity</th><th>Latest Inches</th><th>Gallons</th><th>% Full</th><th>Consumed</th><th>Refilled</th><th>Date</th></tr></thead><tbody>${containers.map(c=>{const r=latestFuelReading(state,c.id); const used=fuelConsumedForPeriod(state,c.id,period); const refill=fuelRefilledForPeriod(state,c.id,period); return `<tr><td>${htmlEscape(c.name||"")}</td><td>${htmlEscape(c.fuelType||"")}</td><td>${(+c.capacity||0).toLocaleString()}</td><td>${r?htmlEscape(r.inchesText ?? r.inches):""}</td><td>${r?Math.round(r.gallons).toLocaleString():""}</td><td>${r?fuelPercent(c,r.gallons).toFixed(1)+"%":""}</td><td>${Math.round(used).toLocaleString()}</td><td>${Math.round(refill).toLocaleString()}</td><td>${r?htmlEscape(r.date||""):""}</td></tr>`}).join("")}</tbody></table><br><button onclick="window.print()" style="padding:8px 20px;background:#1a1a2e;color:#fff;border:none;border-radius:6px;cursor:pointer">Print / Save PDF</button></body></html>`;
}

function printFuelReportWindow(state={}, period="month") {
  const win = window.open("", "_blank", "width=900,height=700");
  if(!win) return;
  win.document.write(fuelReportHTML(state, period));
  win.document.close();
  win.print();
}

function FuelMetric({ label, value, sub }) {
  return (
    <div style={{ border:`1px solid ${T.border}`, borderRadius:10, padding:12, background:T.card }}>
      <div style={{ fontFamily:T.sans, fontSize:11, color:T.muted, fontWeight:700, textTransform:"uppercase", letterSpacing:.4 }}>{label}</div>
      <div style={{ fontFamily:T.mono, fontSize:22, fontWeight:800, color:T.text, marginTop:4 }}>{value}</div>
      {sub && <div style={{ fontFamily:T.sans, fontSize:12, color:T.muted, marginTop:2 }}>{sub}</div>}
    </div>
  );
}

function FuelTracking({ state, dispatch }) {
  const emptyContainer = {
    name:"",
    fuelType:"Diesel",
    capacity:"",
    maxHeight:"",
    gallonsPerInch:"",
    length:"",
    width:"",
    height:"",
    calibration:[{ inches:"0", gallons:"0" }, { inches:"", gallons:"" }],
  };
  const [modal, setModal] = useState(null);
  const [editing, setEditing] = useState(null);
  const [editingEvent, setEditingEvent] = useState(null);
  const [form, setForm] = useState(emptyContainer);
  const [levelEntry, setLevelEntry] = useState({});
  const [refillForm, setRefillForm] = useState({ containerId:"", mode:"max", unit:"gallons", amount:"", date:today(), notes:"" });
  const [period, setPeriod] = useState("month");
  const [historyContainer, setHistoryContainer] = useState("all");
  const [eventForm, setEventForm] = useState({ id:"", kind:"reading", containerId:"", inches:"", gallons:"", gallonsAdded:"", date:today(), notes:"" });
  const containers = state.fuelContainers || [];
  const readings = state.fuelReadings || [];

  const openAdd = () => { setEditing(null); setForm({ ...emptyContainer, calibration:(emptyContainer.calibration||[]).map(r=>({...r})) }); setModal("container"); };
  const openEdit = (c) => { setEditing(c.id); setForm({ ...emptyContainer, ...c, calibration:fuelCalibrationRows(c) }); setModal("container"); };
  const saveContainer = () => {
    if(!String(form.name||"").trim()) return alert("Enter a tank/container name.");
    const payload = {
      ...form,
      id: editing || genId("FUEL"),
      name:String(form.name||"").trim(),
      fuelType:String(form.fuelType||"Fuel").trim(),
      capacity:parseNumber(form.capacity,0),
      maxHeight:parseNumber(form.maxHeight,0),
      gallonsPerInch:parseNumber(form.gallonsPerInch,0),
      length:parseNumber(form.length,0),
      width:parseNumber(form.width,0),
      height:parseNumber(form.height,0),
      calibration:fuelCalibrationRows(form),
    };
    dispatch({ type:editing?"UPDATE_FUEL_CONTAINER":"ADD_FUEL_CONTAINER", payload });
    setModal(null);
  };
  const setLevel = (id, key, value) => setLevelEntry(prev=>({ ...prev, [id]:{ date:today(), inches:"", notes:"", ...(prev[id]||{}), [key]:value } }));
  const openRefill = (c) => {
    setRefillForm({ containerId:c.id, mode:"max", unit:"gallons", amount:"", date:today(), notes:"" });
    setModal("refill");
  };
  const saveLevel = (c) => {
    const row = levelEntry[c.id] || {};
    const inchesText = String(row.inches ?? "").trim();
    const inches = parseInches(inchesText, NaN);
    if(!Number.isFinite(inches)) return alert("Enter inches for this container. Examples: 30, 30.5, 30 1/2, 30 7/8.");
    const gallons = calculateFuelGallons(c, inches);
    dispatch({ type:"ADD_FUEL_READING", payload:{ id:genId("FLOG"), kind:"reading", containerId:c.id, date:row.date||today(), inches, inchesText, gallons, percent:fuelPercent(c, gallons), fuelType:c.fuelType, notes:row.notes||"" } });
    setLevelEntry(prev=>({ ...prev, [c.id]:{ date:today(), inches:"", notes:"" } }));
  };
  const saveRefill = () => {
    const c = containers.find(x=>x.id===refillForm.containerId);
    if(!c) return alert("Select a fuel container.");
    const last = latestFuelReading(state, c.id);
    const currentGallons = parseNumber(last?.gallons, 0);
    const capacity = parseNumber(c.capacity, 0);
    let gallonsAdded = 0;
    let postGallons = null;
    let inches = null;
    let inchesText = "";

    if(refillForm.mode === "max") {
      if(capacity <= 0) return alert("Enter a capacity for this container before using Max Refill.");
      gallonsAdded = Math.max(0, capacity - currentGallons);
      postGallons = capacity;
      const maxInches = parseNumber(c.maxHeight, NaN);
      if(Number.isFinite(maxInches) && maxInches > 0) { inches = maxInches; inchesText = String(c.maxHeight); }
    } else if(refillForm.unit === "inches") {
      inchesText = String(refillForm.amount||"").trim();
      inches = parseInches(inchesText, NaN);
      if(!Number.isFinite(inches)) return alert("Enter refill inches. Examples: 30, 30.5, 30 1/2, 30 7/8.");
      postGallons = calculateFuelGallons(c, inches);
      gallonsAdded = Math.max(0, postGallons - currentGallons);
    } else {
      gallonsAdded = parseNumber(refillForm.amount, NaN);
      if(!Number.isFinite(gallonsAdded) || gallonsAdded <= 0) return alert("Enter refill gallons added.");
      postGallons = capacity > 0 ? Math.min(capacity, currentGallons + gallonsAdded) : currentGallons + gallonsAdded;
    }

    if(gallonsAdded <= 0 && refillForm.mode !== "max") return alert("The refill amount must be greater than zero.");
    dispatch({ type:"ADD_FUEL_READING", payload:{ id:genId("FREF"), kind:"refill", containerId:c.id, date:refillForm.date||today(), gallonsAdded, fuelType:c.fuelType, notes:refillForm.notes||"" } });
    if(postGallons !== null) {
      dispatch({ type:"ADD_FUEL_READING", payload:{ id:genId("FLOG"), kind:"reading", containerId:c.id, date:refillForm.date||today(), inches, inchesText, gallons:postGallons, percent:fuelPercent(c, postGallons), fuelType:c.fuelType, notes:"Post-refill level" } });
    }
    setModal(null);
    setRefillForm({ containerId:"", mode:"max", unit:"gallons", amount:"", date:today(), notes:"" });
  };
  const openEditEvent = (r) => {
    setEditingEvent(r.id);
    setEventForm({ id:r.id, kind:r.kind||"reading", containerId:r.containerId||"", inches:r.inchesText??r.inches??"", gallons:r.gallons??"", gallonsAdded:r.gallonsAdded??"", date:r.date||today(), notes:r.notes||"", fuelType:r.fuelType||"" });
    setModal("event");
  };
  const saveEventEdit = () => {
    const c = containers.find(x=>x.id===eventForm.containerId) || {};
    let payload = { ...eventForm, fuelType:c.fuelType || eventForm.fuelType || "Fuel" };
    if((payload.kind||"reading")==="refill") {
      payload.gallonsAdded = parseNumber(payload.gallonsAdded,0);
      delete payload.inches; delete payload.gallons; delete payload.percent;
    } else {
      const inchesText = String(payload.inches ?? "").trim();
      const inches = parseInches(inchesText, NaN);
      if(!Number.isFinite(inches)) return alert("Enter inches. Examples: 30, 30.5, 30 1/2, 30 7/8.");
      const gallons = calculateFuelGallons(c, inches);
      payload = { ...payload, kind:"reading", inches, inchesText, gallons, percent:fuelPercent(c,gallons) };
      delete payload.gallonsAdded;
    }
    dispatch({ type:"UPDATE_FUEL_READING", payload });
    setModal(null); setEditingEvent(null);
  };
  const updateCalibrationRow = (idx, key, value) => {
    const rows = [...(form.calibration||[])];
    rows[idx] = { ...(rows[idx]||{}), [key]:value };
    setForm({ ...form, calibration:rows });
  };
  const totalGallons = containers.reduce((sum,c)=>sum+(+(latestFuelReading(state,c.id)?.gallons||0)),0);
  const periodLabel = period==="month" ? "This Month" : period==="quarter" ? "This Quarter" : period==="year" ? "This Year" : "This FY";
  const shownHistory = [...readings].filter(r=>historyContainer==="all" || r.containerId===historyContainer).sort((a,b)=>String(b.date||"").localeCompare(String(a.date||"")) || String(b.id||"").localeCompare(String(a.id||"")));
  const fuelCell = { padding:10, borderBottom:`1px solid ${T.border}`, verticalAlign:"middle" };
  const fuelControlBox = { display:"grid", gap:6, alignItems:"center" };
  const fuelControlRow = { display:"flex", gap:6, alignItems:"center", minHeight:38 };
  const fuelActionRow = { display:"flex", gap:6, alignItems:"center", minHeight:38, flexWrap:"nowrap" };
  const fuelHelp = { fontSize:11, color:T.muted, lineHeight:1.25 };
  const fuelPreview = { fontSize:12, fontWeight:800, minHeight:16, lineHeight:"16px" };

  return <div style={{ display:"grid", gap:16 }}>
    <Card>
      <SectionHeading sub="Track tank level like equipment usage: enter inches on the container line and the app calculates gallons.">Fuel Tracking</SectionHeading>
      <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginBottom:16 }}>
        <Btn onClick={openAdd}>+ Add Fuel Container</Btn>
        <Btn variant="secondary" onClick={()=>printFuelReportWindow(state, period)}>Print</Btn>
      </div>
      {containers.length === 0 ? <div style={{ padding:16, border:`1px dashed ${T.border}`, borderRadius:12, color:T.muted, background:T.soft }}>No fuel containers added yet. Add a container to start tracking fuel levels.</div> : <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(190px,1fr))", gap:10 }}>
        {containers.map(c=>{ const r=latestFuelReading(state,c.id); const gallons=+(r?.gallons||0); const cap=+c.capacity||0; const pct=cap?fuelPercent(c,gallons):0; const usedMonth=fuelConsumedForPeriod(state,c.id,"month"); const levelColor = pct >= 75 ? "#16a34a" : pct >= 26 ? "#f97316" : "#dc2626"; return <div key={c.id} style={{ border:`1px solid ${r?levelColor:T.border}`, borderRadius:12, padding:10, background:T.card, boxShadow:"0 4px 12px rgba(0,0,0,.035)" }}>
          <div style={{ fontSize:15, fontWeight:900, marginBottom:8, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{c.name||"Fuel Container"}</div>
          <div style={{ textAlign:"center", padding:"8px 6px 10px", marginBottom:8, borderRadius:10, background:T.soft }}>
            <div style={{ color:T.muted, fontSize:10, fontWeight:900, textTransform:"uppercase", letterSpacing:.5 }}>Current Level</div>
            <div style={{ color:r?levelColor:T.text, fontSize:28, fontWeight:950, lineHeight:1.05, marginTop:3 }}>{r?`${Math.round(gallons).toLocaleString()} gal`:"—"}</div>
            <div style={{ color:r?levelColor:T.muted, fontSize:13, fontWeight:900, marginTop:3 }}>{r?`${pct.toFixed(1)}% Full`:"No reading"}</div>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:7, fontSize:12 }}>
            <div><div style={{ color:T.muted, fontSize:10, fontWeight:800, textTransform:"uppercase" }}>Latest Inches</div><b>{r?(r.inchesText ?? r.inches ?? "—"):"—"}</b></div>
            <div><div style={{ color:T.muted, fontSize:10, fontWeight:800, textTransform:"uppercase" }}>Used This Month</div><b>{Math.round(usedMonth).toLocaleString()} gal</b></div>
          </div>
        </div>})}
      </div>}
    </Card>

    <Card>
      <SectionHeading sub="Each container has its own usage summary. Refills are logged separately and do not count against consumed fuel.">Container Fuel Usage</SectionHeading>
      <div style={{ display:"flex", gap:8, flexWrap:"wrap", alignItems:"center", marginBottom:10 }}>
        <span style={{ fontWeight:800 }}>View:</span>
        <select style={{ ...sel, width:180 }} value={period} onChange={e=>setPeriod(e.target.value)}>
          <option value="month">This Month</option>
          <option value="quarter">This Quarter</option>
          <option value="year">This Year</option>
          <option value="fy">This FY</option>
        </select>
        <Btn variant="secondary" onClick={openAdd}>+ Add More Containers</Btn>
      </div>
      <div className="mobile-x-scroll"><table style={{ borderCollapse:"collapse", width:"100%" }}><thead><tr>{["Container","Fuel","Latest Level","Gallons","Consumed","Refilled","Enter Inches","Actions"].map(h=><th key={h} style={{ textAlign:"left", padding:10, borderBottom:`1px solid ${T.border}`, fontSize:12, color:T.muted }}>{h}</th>)}</tr></thead><tbody>
        {containers.map(c=>{ const last=latestFuelReading(state,c.id); const pct=fuelPercent(c,last?.gallons||0); const le=levelEntry[c.id] || { date:today(), inches:"", notes:"" }; const preview = le.inches!=="" ? calculateFuelGallons(c, le.inches) : null; return <tr key={c.id}>
          <td style={{ ...fuelCell, fontWeight:800 }}>{c.name}</td>
          <td style={fuelCell}>{c.fuelType}</td>
          <td style={fuelCell}>{last?`${last.inchesText ?? last.inches} in / ${pct.toFixed(1)}%`:"—"}</td>
          <td style={fuelCell}>{last?Math.round(last.gallons).toLocaleString():"—"}</td>
          <td style={{ ...fuelCell, fontWeight:800 }}><div>{Math.round(fuelConsumedForPeriod(state,c.id,period)).toLocaleString()} gal</div><div style={{ color:T.muted, fontWeight:600, fontSize:11, marginTop:2 }}>{periodLabel}</div></td>
          <td style={fuelCell}>{Math.round(fuelRefilledForPeriod(state,c.id,period)).toLocaleString()} gal</td>
          <td style={{ ...fuelCell, minWidth:240 }}><div style={fuelControlBox}><div style={fuelControlRow}><input style={{ ...inp, width:115, height:36 }} type="text" placeholder="30 7/8" value={le.inches||""} onChange={e=>setLevel(c.id,"inches",e.target.value)} /><Btn small onClick={()=>saveLevel(c)}>Log</Btn></div><div style={fuelPreview}>{preview!==null ? `${Math.round(preview).toLocaleString()} gal` : ""}</div><div style={fuelHelp}>Examples: 30, 30.5, 30 1/2, 30 7/8</div><input style={{ ...inp, width:138, minWidth:138, height:36 }} type="date" value={le.date||today()} onChange={e=>setLevel(c.id,"date",e.target.value)} /></div></td>
          <td style={{ ...fuelCell, minWidth:215 }}><div style={fuelActionRow}><Btn small variant="secondary" onClick={()=>openRefill(c)}>Refill</Btn><Btn small variant="secondary" onClick={()=>openEdit(c)}>Edit</Btn><Btn small variant="danger" onClick={()=>confirm("Delete this fuel container and its history?")&&dispatch({type:"DELETE_FUEL_CONTAINER",payload:c.id})}>Delete</Btn></div></td>
        </tr> })}
        {!containers.length && <tr><td colSpan="9" style={{ padding:24, textAlign:"center", color:T.muted }}>No fuel containers yet. Add a tank/container and enter its inch-to-gallon chart.</td></tr>}
      </tbody></table></div>
    </Card>

    <Card>
      <SectionHeading sub="Historical fuel data for level readings and refill records. Use Edit to correct mistakes.">Fuel History</SectionHeading>
      <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginBottom:10 }}><select style={{ ...sel, maxWidth:280 }} value={historyContainer} onChange={e=>setHistoryContainer(e.target.value)}><option value="all">All containers</option>{containers.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
      <div className="mobile-x-scroll"><table style={{ borderCollapse:"collapse", width:"100%" }}><thead><tr>{["Date","Container","Type","Fuel","Inches","Gallons","Refill Added","% Full","Notes","Actions"].map(h=><th key={h} style={{ textAlign:"left", padding:10, borderBottom:`1px solid ${T.border}`, fontSize:12, color:T.muted }}>{h}</th>)}</tr></thead><tbody>
        {shownHistory.map(r=>{ const c=containers.find(x=>x.id===r.containerId)||{}; const isRefill=(r.kind||"reading")==="refill"; return <tr key={r.id}><td style={{ padding:10, borderBottom:`1px solid ${T.border}` }}>{r.date}</td><td style={{ padding:10, borderBottom:`1px solid ${T.border}`, fontWeight:700 }}>{c.name||"Deleted container"}</td><td style={{ padding:10, borderBottom:`1px solid ${T.border}` }}>{isRefill?"Refill":"Level"}</td><td style={{ padding:10, borderBottom:`1px solid ${T.border}` }}>{r.fuelType||c.fuelType}</td><td style={{ padding:10, borderBottom:`1px solid ${T.border}` }}>{isRefill?"—":(r.inchesText ?? r.inches)}</td><td style={{ padding:10, borderBottom:`1px solid ${T.border}` }}>{isRefill?"—":Math.round(+r.gallons||0).toLocaleString()}</td><td style={{ padding:10, borderBottom:`1px solid ${T.border}` }}>{isRefill?Math.round(+r.gallonsAdded||0).toLocaleString():"—"}</td><td style={{ padding:10, borderBottom:`1px solid ${T.border}` }}>{isRefill?"—":(+r.percent||fuelPercent(c,r.gallons)).toFixed(1)+"%"}</td><td style={{ padding:10, borderBottom:`1px solid ${T.border}` }}>{r.notes}</td><td style={{ padding:10, borderBottom:`1px solid ${T.border}`, display:"flex", gap:6 }}><Btn small variant="secondary" onClick={()=>openEditEvent(r)}>Edit</Btn><Btn small variant="danger" onClick={()=>dispatch({type:"DELETE_FUEL_READING",payload:r.id})}>Delete</Btn></td></tr> })}
        {!shownHistory.length && <tr><td colSpan="10" style={{ padding:24, textAlign:"center", color:T.muted }}>No fuel history yet.</td></tr>}
      </tbody></table></div>
    </Card>

    {modal==="refill" && (()=>{ const c=containers.find(x=>x.id===refillForm.containerId)||{}; const last=latestFuelReading(state,c.id); const current=parseNumber(last?.gallons,0); const cap=parseNumber(c.capacity,0); const customByInches=refillForm.mode==="custom" && refillForm.unit==="inches"; const postByInches=customByInches && String(refillForm.amount||"").trim()?calculateFuelGallons(c, refillForm.amount):null; const maxAdd=cap>0?Math.max(0,cap-current):0; const preview=refillForm.mode==="max"?maxAdd:(customByInches?Math.max(0,(postByInches||0)-current):parseNumber(refillForm.amount,0)); return <Modal title={`Refill ${c.name||"Fuel Container"}`} onClose={()=>setModal(null)}>
      <div style={{ display:"grid", gap:10 }}>
        <div style={{ padding:10, border:`1px solid ${T.border}`, borderRadius:8, background:T.grayLt }}><b>Current:</b> {Math.round(current).toLocaleString()} gal {cap?`/ ${cap.toLocaleString()} gal capacity`:""}</div>
        <Field label="Refill Type"><select style={sel} value={refillForm.mode} onChange={e=>setRefillForm({...refillForm,mode:e.target.value})}><option value="max">Max Refill</option><option value="custom">Custom Refill</option></select></Field>
        {refillForm.mode==="custom" && <Field label="Custom Refill Entry"><div style={{ display:"grid", gridTemplateColumns:"130px 1fr", gap:8 }}><select style={sel} value={refillForm.unit} onChange={e=>setRefillForm({...refillForm,unit:e.target.value,amount:""})}><option value="gallons">Gallons Added</option><option value="inches">Final Inches</option></select><input style={inp} type="text" placeholder={refillForm.unit==="inches"?"30 7/8":"250"} value={refillForm.amount} onChange={e=>setRefillForm({...refillForm,amount:e.target.value})} /></div>{refillForm.unit==="inches" && <div style={{ fontSize:11, color:T.muted, marginTop:3 }}>Enter the tank level after refill. Examples: 30, 30.5, 30 1/2, 30 7/8.</div>}</Field>}
        <Field label="Date"><input style={inp} type="date" value={refillForm.date||today()} onChange={e=>setRefillForm({...refillForm,date:e.target.value})} /></Field>
        <Field label="Notes"><input style={inp} value={refillForm.notes||""} onChange={e=>setRefillForm({...refillForm,notes:e.target.value})} placeholder="Delivery ticket, vendor, notes" /></Field>
        <div style={{ padding:10, border:`1px solid ${T.border}`, borderRadius:8, background:T.card, fontWeight:800 }}>Refill to log: {Math.round(preview||0).toLocaleString()} gal{customByInches && postByInches!==null ? ` (final level ${Math.round(postByInches).toLocaleString()} gal)` : ""}</div>
      </div>
      <div style={{ display:"flex", justifyContent:"flex-end", gap:8, marginTop:14 }}><Btn variant="secondary" onClick={()=>setModal(null)}>Cancel</Btn><Btn onClick={saveRefill}>Save Refill</Btn></div>
    </Modal>; })()}

    {modal==="event" && <Modal title="Edit Fuel History" onClose={()=>setModal(null)}>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(2,minmax(0,1fr))", gap:10 }}>
        <Field label="Container"><select style={sel} value={eventForm.containerId} onChange={e=>setEventForm({...eventForm,containerId:e.target.value})}>{containers.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
        <Field label="Date"><input style={inp} type="date" value={eventForm.date} onChange={e=>setEventForm({...eventForm,date:e.target.value})} /></Field>
        {(eventForm.kind||"reading")==="refill" ? <Field label="Refill Gallons Added"><input style={inp} type="number" step="0.1" value={eventForm.gallonsAdded} onChange={e=>setEventForm({...eventForm,gallonsAdded:e.target.value})} /></Field> : <Field label="Stick Reading Inches"><input style={inp} type="text" placeholder="30 7/8" value={eventForm.inches} onChange={e=>setEventForm({...eventForm,inches:e.target.value})} /><div style={{ fontSize:11, color:T.muted, marginTop:3 }}>Examples: 30, 30.5, 30 1/2, 30 7/8</div></Field>}
        <Field label="Notes"><input style={inp} value={eventForm.notes} onChange={e=>setEventForm({...eventForm,notes:e.target.value})} /></Field>
      </div>
      {(eventForm.kind||"reading")==="reading" && eventForm.containerId && eventForm.inches!=="" && (()=>{ const c=containers.find(x=>x.id===eventForm.containerId); const gal=calculateFuelGallons(c, eventForm.inches); return <div style={{ marginTop:8, padding:10, border:`1px solid ${T.border}`, borderRadius:8, background:T.grayLt, fontWeight:800 }}>Calculated: {Math.round(gal).toLocaleString()} gallons</div>; })()}
      <div style={{ display:"flex", justifyContent:"flex-end", gap:8, marginTop:14 }}><Btn variant="secondary" onClick={()=>setModal(null)}>Cancel</Btn><Btn onClick={saveEventEdit}>Save Edit</Btn></div>
    </Modal>}

    {modal==="container" && <Modal title={editing?"Edit Fuel Container":"Add Fuel Container"} onClose={()=>setModal(null)}>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(2,minmax(0,1fr))", gap:10 }}>
        <Field label="Container Name"><input style={inp} value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="Diesel tank" /></Field>
        <Field label="Fuel Type"><input style={inp} value={form.fuelType} onChange={e=>setForm({...form,fuelType:e.target.value})} placeholder="Diesel, Gasoline, DEF" /></Field>
        <Field label="Capacity Gallons"><input style={inp} type="number" value={form.capacity} onChange={e=>setForm({...form,capacity:e.target.value})} /></Field>
        <Field label="Max Fuel Height Inches"><input style={inp} type="number" step="0.01" value={form.maxHeight} onChange={e=>setForm({...form,maxHeight:e.target.value})} /></Field>
        <Field label="Gallons Per Inch"><input style={inp} type="number" step="0.01" value={form.gallonsPerInch} onChange={e=>setForm({...form,gallonsPerInch:e.target.value})} /></Field>
        <Field label="Dimensions L x W x H"><div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:6 }}><input style={inp} type="number" placeholder="L" value={form.length} onChange={e=>setForm({...form,length:e.target.value})}/><input style={inp} type="number" placeholder="W" value={form.width} onChange={e=>setForm({...form,width:e.target.value})}/><input style={inp} type="number" placeholder="H" value={form.height} onChange={e=>setForm({...form,height:e.target.value})}/></div></Field>
      </div>
      <div style={{ marginTop:8, padding:12, background:T.grayLt, border:`1px solid ${T.border}`, borderRadius:8 }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}><b>Inches-to-Gallons Chart</b><div style={{ display:"flex", gap:6 }}><Btn small variant="secondary" onClick={()=>setForm({...form,calibration:CONVAULT_2000_CALIBRATION.map(r=>({...r}))})}>Use ConVault 2000 Chart</Btn><Btn small variant="secondary" onClick={()=>setForm({...form,calibration:[...(form.calibration||[]),{inches:"",gallons:""}]})}>+ Row</Btn></div></div>
        <div style={{ maxHeight:220, overflow:"auto" }}><table style={{ width:"100%", borderCollapse:"collapse" }}><thead><tr><th style={{ textAlign:"left", padding:6 }}>Inches</th><th style={{ textAlign:"left", padding:6 }}>Gallons</th><th></th></tr></thead><tbody>{(form.calibration||[]).map((r,i)=><tr key={i}><td style={{ padding:4 }}><input style={inp} type="text" placeholder="30 7/8" value={r.inches} onChange={e=>updateCalibrationRow(i,"inches",e.target.value)} /></td><td style={{ padding:4 }}><input style={inp} type="number" step="1" value={r.gallons} onChange={e=>updateCalibrationRow(i,"gallons",e.target.value)} /></td><td style={{ padding:4 }}><Btn small variant="ghost" onClick={()=>setForm({...form,calibration:(form.calibration||[]).filter((_,x)=>x!==i)})}>×</Btn></td></tr>)}</tbody></table></div>
        <div style={{ fontSize:12, color:T.muted, marginTop:8 }}>Tip: For non-standard tanks, add several known inch/gallon points from the manufacturer chart. The app interpolates between points. Use the template button only when that exact manufacturer chart applies to your tank.</div>
      </div>
      <div style={{ display:"flex", justifyContent:"flex-end", gap:8, marginTop:14 }}><Btn variant="secondary" onClick={()=>setModal(null)}>Cancel</Btn><Btn onClick={saveContainer}>Save Container</Btn></div>
    </Modal>}
  </div>;
}


function ReportFuel({ state }) {
  const [period, setPeriod] = useState("month");
  const containers = state.fuelContainers || [];
  const readings = state.fuelReadings || [];
  const total = containers.reduce((s,c)=>s+(+(latestFuelReading(state,c.id)?.gallons||0)),0);
  const periodLabel = period==="month" ? "This Month" : period==="quarter" ? "This Quarter" : period==="year" ? "This Year" : "This FY";
  const printReport = () => printFuelReportWindow(state, period);
  return <div style={{ display:"grid", gap:16 }}>
    <Card><SectionHeading sub="Fuel levels and historical usage by container." action={<Btn onClick={printReport}>Print Fuel Report</Btn>}>Fuel Report</SectionHeading><div style={{ display:"flex", gap:8, flexWrap:"wrap", alignItems:"center", marginBottom:12 }}><span style={{ fontWeight:800 }}>Usage Period:</span><select style={{ ...sel, width:180 }} value={period} onChange={e=>setPeriod(e.target.value)}><option value="month">This Month</option><option value="quarter">This Quarter</option><option value="year">This Year</option><option value="fy">This FY</option></select></div><div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))", gap:10 }}><FuelMetric label="Containers" value={containers.length}/><FuelMetric label="Total Fuel" value={`${Math.round(total).toLocaleString()} gal`}/><FuelMetric label="History Records" value={readings.length}/></div></Card>
    <Card><div className="mobile-x-scroll"><table style={{ borderCollapse:"collapse", width:"100%" }}><thead><tr>{["Container","Fuel","Capacity","Latest Inches","Gallons","% Full","Consumed","Refilled","Last Reading"].map(h=><th key={h} style={{ textAlign:"left", padding:10, borderBottom:`1px solid ${T.border}`, color:T.muted }}>{h}</th>)}</tr></thead><tbody>{containers.map(c=>{const r=latestFuelReading(state,c.id);return <tr key={c.id}><td style={{ padding:10, borderBottom:`1px solid ${T.border}`, fontWeight:700 }}>{c.name}</td><td style={{ padding:10, borderBottom:`1px solid ${T.border}` }}>{c.fuelType}</td><td style={{ padding:10, borderBottom:`1px solid ${T.border}` }}>{(+c.capacity||0).toLocaleString()} gal</td><td style={{ padding:10, borderBottom:`1px solid ${T.border}` }}>{r?(r.inchesText ?? r.inches):"—"}</td><td style={{ padding:10, borderBottom:`1px solid ${T.border}` }}>{r?Math.round(r.gallons).toLocaleString():"—"}</td><td style={{ padding:10, borderBottom:`1px solid ${T.border}` }}>{r?fuelPercent(c,r.gallons).toFixed(1)+"%":"—"}</td><td style={{ padding:10, borderBottom:`1px solid ${T.border}`, fontWeight:800 }}>{Math.round(fuelConsumedForPeriod(state,c.id,period)).toLocaleString()} gal</td><td style={{ padding:10, borderBottom:`1px solid ${T.border}` }}>{Math.round(fuelRefilledForPeriod(state,c.id,period)).toLocaleString()} gal</td><td style={{ padding:10, borderBottom:`1px solid ${T.border}` }}>{r?r.date:"—"}</td></tr>})}{!containers.length&&<tr><td colSpan="9" style={{ padding:24, textAlign:"center", color:T.muted }}>No fuel containers to report.</td></tr>}</tbody></table></div></Card>
  </div>;
}

const PAGE_TITLES = {
  dashboard:        "Maintenance Dashboard",
  workorders:       "Work Orders",
  wo_requests:      "Work Order Requests",
  equipment:        "Equipment",
  parts:            "Parts Inventory",
  pm:               "Preventive Maintenance",
  usage:            "Usage Tracking",
  fuel:             "Fuel Tracking",
  spending:         "Spending & Costs",
  inventory:        "Equipment Inventory List",
  reports_deadline: "Deadline Equipment Report",
  reports_parts_inv:"Parts Inventory Report",
  reports_pm:       "PM Reports",
  reports_usage:    "Usage Report",
  reports_fuel:     "Fuel Report",
  reports_spending: "Spending Reports",
  reports_combined: "Combined Report",
};

async function loadSession(setSession, setAuthLoading) {
  const { data } = await supabase.auth.getSession();
  setSession(data.session || null);

  supabase.auth.onAuthStateChange((_event, session) => {
    setSession(session || null);
  });

  setAuthLoading(false);
}

export default function App() {
  /* Start empty, then load the signed-in user's data from Supabase */
  const emptyState = blankUserState();
  const [state, dispatch] = useReducer(reducer, emptyState);

  const [dataLoaded, setDataLoaded] = useState(false);
  const [syncStatus, setSyncStatus] = useState("idle"); /* idle | saving | saved | error */
  const [systemThemeTick, setSystemThemeTick] = useState(0);

  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authMode, setAuthMode] = useState("login");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authConfirmPassword, setAuthConfirmPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [authInfoMsg, setAuthInfoMsg] = useState("");
  const publicWORequestMode = isPublicWORequestPage();
  const [publicPortal, setPublicPortal] = useState(null);
  const [publicPortalLoading, setPublicPortalLoading] = useState(false);

  useEffect(() => {
    if(publicWORequestMode) { setAuthLoading(false); return; }
    loadSession(setSession, setAuthLoading);
  }, [publicWORequestMode]);

  useEffect(() => {
    if(!publicWORequestMode) return;
    let cancelled = false;
    async function loadPortal(){
      setPublicPortalLoading(true);
      const portal = await loadWORequestPortal(getWORequestPortalToken());
      if(!cancelled) { setPublicPortal(portal); setPublicPortalLoading(false); }
    }
    loadPortal();
    return () => { cancelled = true; };
  }, [publicWORequestMode]);

  useEffect(() => {
    let media;
    try { media = window.matchMedia("(prefers-color-scheme: dark)"); } catch(e) {}
    if(!media) return;
    const onChange = () => setSystemThemeTick(t => t + 1);
    if(media.addEventListener) media.addEventListener("change", onChange);
    else if(media.addListener) media.addListener(onChange);
    return () => {
      if(media.removeEventListener) media.removeEventListener("change", onChange);
      else if(media.removeListener) media.removeListener(onChange);
    };
  }, []);

  /* Load user data from Supabase after login; migrate local storage if cloud is empty */
  useEffect(() => {
    if (!session) {
      setDataLoaded(false);
      return;
    }
    let cancelled = false;
    async function loadData() {
      try {
        const { data, error } = await supabase
          .from("user_state")
          .select("data")
          .eq("user_id", session.user.id)
          .maybeSingle();

        if (cancelled) return;
        if (error) {
          console.error("Load error:", error);
          dispatch({ type:"REPLACE_STATE", payload:blankUserState(session.user.id) });
        } else if (data && data.data && Object.keys(data.data).length > 0) {
          dispatch({ type:"REPLACE_STATE", payload:normalizeLoadedUserState(data.data, session.user.id) });
        } else {
          // New users must start with a blank platform. Do not migrate browser localStorage,
          // because that can contain another user's equipment, work orders, inventory, or reports.
          dispatch({ type:"REPLACE_STATE", payload:blankUserState(session.user.id) });
          try { localStorage.removeItem("ncaState"); } catch(e) {}
        }
      } catch (e) {
        console.error("Load exception:", e);
      } finally {
        if (!cancelled) setDataLoaded(true);
      }
    }
    loadData();
    return () => { cancelled = true; };
  }, [session]);

  /* Save state to Supabase, debounced */
  useEffect(() => {
    if (!session || !dataLoaded) return;
    setSyncStatus("saving");
    const timer = setTimeout(async () => {
      try {
        const { error } = await supabase
          .from("user_state")
          .upsert({
            user_id: session.user.id,
            data: normalizeLoadedUserState(state, session.user.id),
            updated_at: new Date().toISOString(),
          }, { onConflict:"user_id" });

        if (error) {
          console.error("Save error:", error);
          setSyncStatus("error");
        } else {
          setSyncStatus("saved");
          try { localStorage.setItem("ncaState", JSON.stringify(normalizeLoadedUserState(state, session.user.id))); localStorage.setItem("ncaState:lastUserId", session.user.id); } catch(e) {}
          setTimeout(() => setSyncStatus("idle"), 2000);
        }
      } catch (e) {
        console.error("Save exception:", e);
        setSyncStatus("error");
      }
    }, 1000);
    return () => clearTimeout(timer);
  }, [state, session, dataLoaded]);


  /* Auto-create Preventive Maintenance Service Work Orders when PM schedules are due */
  useEffect(() => {
    const schedules = state.pmSchedules || [];
    if(!schedules.length) return;
    const todayStr = today();
    const currentUsageFor = (equipmentId, type="hours") => {
      const logs = (state.usageLogs || []).filter(l => l.equipmentId === equipmentId);
      const key = type === "mileage" ? "mileage" : "hours";
      return Math.max(...logs.map(l => +(l[key] || 0)), 0);
    };
    const nextDateFrom = (date, interval, unit) => {
      const d = new Date(date || todayStr);
      const n = Number(interval || 1);
      if(unit === "days") d.setDate(d.getDate() + n);
      if(unit === "weeks") d.setDate(d.getDate() + (n * 7));
      if(unit === "months") d.setMonth(d.getMonth() + n);
      if(unit === "years") d.setFullYear(d.getFullYear() + n);
      return d.toISOString().split("T")[0];
    };
    const scheduleTriggers = (sch) => {
      if(Array.isArray(sch.triggers) && sch.triggers.length) return sch.triggers;
      if(sch.triggerType === "usage") return [{ type:sch.usageType || "hours", usageInterval:sch.usageInterval, usageMode:"every", nextDueUsage:sch.nextDueUsage }];
      return [{ type:"time", timeInterval:sch.timeInterval, timeUnit:sch.timeUnit || "months", nextDueDate:sch.nextDueDate }];
    };
    schedules.forEach(schedule => {
      if(!schedule?.equipmentId) return;
      const alreadyOpen = (state.workOrders || []).some(w =>
        w.scheduleId === schedule.id &&
        w.woType === "Service" &&
        ["Open", "In Progress", "Pending Diagnostic", "On Hold"].includes(w.status)
      );
      if(alreadyOpen) return;
      const triggers = scheduleTriggers(schedule);
      const due = triggers.some(t => {
        if((t.type || "time") === "time") {
          const dueDate = t.nextDueDate || schedule.nextDueDate;
          return !!dueDate && dueDate <= todayStr;
        }
        const dueUsage = +(t.nextDueUsage || schedule.nextDueUsage || 0);
        return !!dueUsage && currentUsageFor(schedule.equipmentId, t.type) >= dueUsage;
      });
      if(!due) return;
      const task = (state.pmTasks || []).find(t => t.id === schedule.taskId) || { id:schedule.taskId, name:schedule.task || "PM Service", description:"", steps:[], parts:[] };
      const eq = (state.equipment || []).find(e => e.id === schedule.equipmentId);
      if(!eq) return;
      const stepLines = normalizeStepLines(task.steps);
      const stepsText = buildNumberedStepsText(stepLines);
      const woId = genNextWOId(state.workOrders, schedule.equipmentId, "SVC");
      const usageType = (eq.usageType || schedule.usageType || triggers.find(t => t.type === "mileage")?.type || "hours").toLowerCase();
      const curHours = currentUsageFor(schedule.equipmentId, "hours");
      const curMileage = currentUsageFor(schedule.equipmentId, "mileage");
      const taskParts = (task.parts || []).filter(p => p.name).map(p => ({ name:p.name, qty:p.qty || 1, unit:p.unit || "ea", unitCost:+(p.unitCost || 0) }));
      dispatch({ type:"ADD_WO", payload:{
        id:woId,
        title:task.name || schedule.task || "PM Service",
        equipment:schedule.equipmentId,
        equipmentStatus:"Fully Operational",
        status:"Open",
        priority:"Medium",
        woType:"Service",
        created:todayStr,
        due:triggers.find(t => (t.type || "time") === "time")?.nextDueDate || schedule.nextDueDate || todayStr,
        completed:"",
        tech:"",
        usageType,
        usageHours:usageType === "mileage" ? "" : curHours,
        usageMileage:usageType === "hours" ? "" : curMileage,
        usageNA:!(eq?.trackUsage),
        faultEnabled:true,
        faultDescription:task.description || task.name || schedule.task || "PM Service",
        description:[`Auto-generated service: ${task.name || schedule.task || "PM Service"}`, task.description ? `Description: ${task.description}` : "", stepsText ? `Service Steps:\n${stepsText}` : ""].filter(Boolean).join("\n\n"),
        workPerformed:stepsText,
        serviceSteps:stepsText,
        serviceStepLines:stepLines,
        steps:stepLines,
        serviceChecklist:stepsText,
        mechanicNotes:"",
        partsUsed:taskParts,
        labor:[],
        scheduleId:schedule.id,
        pmTaskId:task.id || schedule.taskId || null,
      }});
      dispatch({ type:"ADD_NOTIFICATION", payload:{ id:`N${Date.now()}-${schedule.id}`, type:"pm", msg:`Preventive maintenance due for ${eq.id} — ${eq.name || eq.nomenclature || "equipment"}. Service Work Order ${woId} created with ${stepLines.length} step${stepLines.length===1?"":"s"}.`, read:false } });
    });
  }, [state.pmSchedules, state.pmTasks, state.equipment, state.workOrders, state.usageLogs]);

  /* Auto-create Inspection Work Orders when inspection schedules are due */
  useEffect(() => {
    const inspections = state.inspectionSchedules || [];
    if(!inspections.length) return;
    const todayStr = today();
    const nextDateFrom = (date, interval, unit) => {
      const d = new Date(date || todayStr);
      const n = Number(interval || 1);
      if(unit === "days") d.setDate(d.getDate() + n);
      if(unit === "weeks") d.setDate(d.getDate() + (n * 7));
      if(unit === "months") d.setMonth(d.getMonth() + n);
      if(unit === "years") d.setFullYear(d.getFullYear() + n);
      return d.toISOString().split("T")[0];
    };
    const genInspectionWOInfo = (eqId) => {
      const base = String(eqId || "EQ").trim() || "EQ";
      const related = (state.workOrders || []).filter(w =>
        w.woType === "Inspection" &&
        String(w.equipment || w.equipmentId || "") === base
      );
      const usedNums = related.map(w => {
        const match = String(w.id || "").match(/-I(?:WO)?(\d+)$/i);
        return match ? parseInt(match[1], 10) : (+w.inspectionSequence || 0);
      }).filter(n => Number.isFinite(n) && n > 0);
      const next = usedNums.length ? Math.max(...usedNums) + 1 : related.length + 1;
      return { id:`${base}-I${String(next).padStart(2,"0")}`, sequence:next };
    };
    inspections.forEach(schedule => {
      if(!schedule?.nextDueDate || schedule.nextDueDate > todayStr) return;
      const alreadyOpen = (state.workOrders||[]).some(w =>
        w.inspectionScheduleId === schedule.id &&
        w.woType === "Inspection" &&
        ["Open","In Progress","Pending Diagnostic","On Hold"].includes(w.status)
      );
      if(alreadyOpen) return;
      const task = (state.inspectionTasks||[]).find(t => t.id === schedule.taskId);
      const eq = (state.equipment||[]).find(e => e.id === schedule.equipmentId);
      if(!task || !eq) return;
      const steps = normalizeStepLines(task.steps);
      const iwo = genInspectionWOInfo(eq.id);
      const woId = iwo.id;
      dispatch({ type:"ADD_WO", payload:{
        id:woId,
        inspectionSequence:iwo.sequence,
        woType:"Inspection",
        title:`Inspection - ${task.name}`,
        inspectionTaskName:task.name,
        equipment:eq.id,
        equipmentStatus:"Fully Operational",
        status:"Open",
        priority:"Normal",
        created:todayStr,
        due:schedule.nextDueDate || todayStr,
        completed:"",
        tech:"",
        usageReading:"N/A",
        usageType:"N/A",
        usageNA:true,
        faultEnabled:true,
        faultDescription:task.name,
        problem:task.name,
        description:task.name,
        workPerformed: buildNumberedStepsText(task.steps),
        mechanicNotes: task.notes || "",
        inspectionTaskId:task.id,
        inspectionScheduleId:schedule.id,
        inspectionSteps:steps.join("\n"),
        steps,
        inspectionStepResults:steps.map((step,i)=>({ id:`${genId("STEP")}-${i}`, step, result:"", comment:"" })),
        inspectionAttachments:Array.isArray(task.attachments)?task.attachments:[],
        partsUsed:[], labor:[],
      }});
      dispatch({ type:"ADD_NOTIFICATION", payload:{ id:`N${Date.now()}-${schedule.id}`, type:"inspection", msg:`Inspection due for ${eq.id} — ${eq.name || eq.nomenclature || "equipment"}. Inspection Work Order ${woId} created with ${steps.length} step${steps.length===1?"":"s"}.`, time:"Just now", read:false } });
      dispatch({ type:"UPDATE_INSPECTION_SCHEDULE", payload:{ ...schedule, lastTriggered:todayStr } });
    });
  }, [state.inspectionSchedules, state.inspectionTasks, state.equipment, state.workOrders]);


  function validateEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  async function handleLogin() {
    setAuthError(""); setAuthInfoMsg("");
    if(!authEmail.trim()) { setAuthError("Please enter your email."); return; }
    if(!validateEmail(authEmail.trim())) { setAuthError("Please enter a valid email address."); return; }
    if(!authPassword) { setAuthError("Please enter your password."); return; }
    setAuthBusy(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: authEmail.trim(),
      password: authPassword,
    });
    setAuthBusy(false);
    if (error) setAuthError(error.message);
  }

  async function handleSignup() {
    setAuthError(""); setAuthInfoMsg("");
    if(!authEmail.trim()) { setAuthError("Please enter your email."); return; }
    if(!validateEmail(authEmail.trim())) { setAuthError("Please enter a valid email address."); return; }
    if(!authPassword) { setAuthError("Please enter a password."); return; }
    if(authPassword.length < 6) { setAuthError("Password must be at least 6 characters."); return; }
    if(authPassword !== authConfirmPassword) { setAuthError("Passwords do not match."); return; }
    try { localStorage.removeItem("ncaState"); localStorage.removeItem("ncaState:lastUserId"); } catch(e) {}
    setAuthBusy(true);
    const { error, data } = await supabase.auth.signUp({
      email: authEmail.trim(),
      password: authPassword,
    });
    setAuthBusy(false);
    if (error) {
      setAuthError(error.message);
    } else if (data.user && !data.session) {
      setAuthInfoMsg("✓ Account created! Check your email to confirm your address, then log in.");
      setAuthMode("login");
      setAuthPassword(""); setAuthConfirmPassword("");
    } else {
      setAuthInfoMsg("✓ Account created and signed in!");
    }
  }

  function switchAuthMode(mode) {
    setAuthMode(mode);
    setAuthError(""); setAuthInfoMsg("");
    setAuthPassword(""); setAuthConfirmPassword("");
  }

  async function handleLogout() {
    try { localStorage.removeItem("ncaState"); } catch(e) {}
    await supabase.auth.signOut();
  }

  const [tab, setTab]       = useState("dashboard");
  const [menuOpen, setMenuOpen]           = useState(false);
  const [showProfile, setShowProfile]     = useState(false);
  const [showWOSettings, setShowWOSettings] = useState(false);
  const [showSettings, setShowSettings]   = useState(false);

  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      if(params.get("woRequest")) setTab("wo_requests");
    } catch(e) {}
  }, []);

  const profile      = state.profile || {};
  const settings     = state.settings || {};
  const companyName  = settings.companyName || "NCA Maintenance";
  const maintLocations = normalizeMaintForgeLocations(state);
  const activeLocationLabel = locationNameForId(state, state.activeLocationId || "__all");
  const visibleState = scopedStateForActiveLocation(state);

  const initials = profile.firstName&&profile.lastName ? `${profile.firstName[0]}${profile.lastName[0]}`.toUpperCase() : "JM";
  const displayName = profile.firstName ? `${profile.firstName} ${profile.lastName}` : "J. Martinez";

  const pages = {
    dashboard:        <Dashboard        state={visibleState} dispatch={dispatch} setTab={setTab} onSettings={()=>setShowSettings(true)} />,
    workorders:       <WorkOrders       state={visibleState} dispatch={dispatch} woSettings={state.woSettings} onWOSettings={()=>setShowWOSettings(true)} />,
    wo_requests:      <WorkOrderRequests state={visibleState} dispatch={dispatch} session={session} />,
    inspections:      <Inspections      state={visibleState} dispatch={dispatch} />,
    equipment:        <Equipment        state={visibleState} dispatch={dispatch} />,
    parts:            <Parts            state={visibleState} dispatch={dispatch} />,
    pm:               <PM               state={visibleState} dispatch={dispatch} />,
    usage:            <UsageTracking    state={visibleState} dispatch={dispatch} />,
    fuel:             <FuelTracking     state={visibleState} dispatch={dispatch} />,
    spending:         <Spending         state={visibleState} />,
    inventory:        <EquipmentInventory state={visibleState} dispatch={dispatch} />,
    reports_deadline: <ReportDeadline   state={visibleState} />,
    reports_parts_inv:<ReportPartsInv   state={visibleState} />,
    reports_pm:       <ReportPM         state={visibleState} />,
    reports_usage:    <ReportUsage      state={visibleState} />,
    reports_fuel:     <ReportFuel       state={visibleState} />,
    reports_spending: <ReportSpending   state={visibleState} />,
    reports_combined: <ReportCombined   state={visibleState} />,
  };

  const selectedTheme = state.settings?.theme || "light";
  const effectiveTheme = getEffectiveThemeMode(selectedTheme);
  applyThemeMode(effectiveTheme);

  const setThemePreference = (theme) => {
    dispatch({ type:"UPDATE_SETTINGS", payload:{ ...(state.settings || {}), theme } });
  };

  const cycleThemePreference = () => {
    const order = ["light", "dark", "system"];
    const next = order[(order.indexOf(selectedTheme) + 1) % order.length] || "light";
    setThemePreference(next);
  };

  if (publicWORequestMode) {
    if(publicPortalLoading) return <div style={{ padding:40, fontSize:20, fontFamily:T.sans }}>Loading request form...</div>;
    if(!publicPortal) {
      const token = getWORequestPortalToken();
      const fallbackFacility = getWORequestUrlParam("facility") || "Facility";
      const fallbackOwner = getWORequestUrlParam("owner") || "";
      const fallbackPortal = fallbackOwner ? {
        token,
        owner_user_id:fallbackOwner,
        facility:fallbackFacility,
        company_name:"MaintForge",
        equipment_json:[],
        fallback:true,
      } : null;
      if(fallbackPortal) return <div style={{ minHeight:"100vh", background:T.bg, padding:16 }}><WorkOrderRequests state={{...INIT, settings:{ companyName:"MaintForge", locations:[fallbackFacility], facilityQrIds:{ [fallbackFacility]:token } }, equipment:[], workOrderRequests:[]}} dispatch={()=>{}} session={null} publicPortal={fallbackPortal} publicMode={true} /></div>;
      return <div style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", padding:18, fontFamily:T.sans, background:T.bg, color:T.text }}><div style={{ maxWidth:520, background:T.card, border:`1px solid ${T.border}`, borderRadius:16, padding:20, textAlign:"center" }}><h2>Request link not active</h2><p>This QR code has not been activated by maintenance yet.</p></div></div>;
    }
    return <div style={{ minHeight:"100vh", background:T.bg, padding:16 }}><WorkOrderRequests state={{...INIT, settings:{ companyName:publicPortal.company_name || "MaintForge", locations:[publicPortal.facility], facilityQrIds:{ [publicPortal.facility]:getWORequestPortalToken() } }, equipment:publicPortal.equipment_json || [], workOrderRequests:[]}} dispatch={()=>{}} session={null} publicPortal={publicPortal} publicMode={true} /></div>;
  }

  if (authLoading) {
    return <div style={{ padding:40, fontSize:20, fontFamily:T.sans }}>Loading...</div>;
  }

  if (!session) {
    const isSignup = authMode==="signup";
    return (
      <div style={{
        minHeight:"100vh",
        display:"flex",
        alignItems:"center",
        justifyContent:"center",
        background:"linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
        color:"white",
        fontFamily:T.sans,
        padding:16,
      }}>
        <div style={{
          width:420,
          maxWidth:"100%",
          background:"#1f2937",
          padding:32,
          borderRadius:14,
          boxShadow:"0 20px 60px rgba(0,0,0,.4)",
          border:"1px solid #374151",
        }}>
          {/* Header */}
          <div style={{ textAlign:"center", marginBottom:22 }}>
            <div style={{ fontSize:36, marginBottom:6 }}>🔧</div>
            <h1 style={{ margin:0, fontSize:24, fontWeight:700 }}>WIN Maintenance</h1>
            <p style={{ opacity:.65, margin:"6px 0 0", fontSize:13 }}>
              {isSignup ? "Create your account to get started" : "Sign in to your account"}
            </p>
          </div>

          {/* Tab switcher */}
          <div style={{ display:"flex", background:"#111827", borderRadius:8, padding:4, marginBottom:20 }}>
            <button
              onClick={()=>switchAuthMode("login")}
              style={{
                flex:1, padding:"10px", borderRadius:6, border:"none", cursor:"pointer",
                background: !isSignup ? "#3b82f6" : "transparent",
                color: !isSignup ? "white" : "#9ca3af",
                fontWeight:600, fontSize:13, transition:"all .15s"
              }}>
              Sign In
            </button>
            <button
              onClick={()=>switchAuthMode("signup")}
              style={{
                flex:1, padding:"10px", borderRadius:6, border:"none", cursor:"pointer",
                background: isSignup ? "#3b82f6" : "transparent",
                color: isSignup ? "white" : "#9ca3af",
                fontWeight:600, fontSize:13, transition:"all .15s"
              }}>
              Create Account
            </button>
          </div>

          {/* Info / Error messages */}
          {authInfoMsg && (
            <div style={{ padding:"10px 12px", background:"#065f46", border:"1px solid #10b981", borderRadius:6, marginBottom:14, fontSize:13 }}>
              {authInfoMsg}
            </div>
          )}
          {authError && (
            <div style={{ padding:"10px 12px", background:"#7f1d1d", border:"1px solid #ef4444", borderRadius:6, marginBottom:14, fontSize:13 }}>
              ⚠ {authError}
            </div>
          )}

          {/* Email */}
          <label style={{ display:"block", fontSize:12, fontWeight:600, color:"#9ca3af", marginBottom:5 }}>Email</label>
          <input
            type="email"
            placeholder="you@example.com"
            value={authEmail}
            onChange={(e)=>{ setAuthEmail(e.target.value); setAuthError(""); }}
            onKeyDown={(e)=>{ if(e.key==="Enter") (isSignup?handleSignup:handleLogin)(); }}
            disabled={authBusy}
            style={{
              width:"100%", padding:"12px 14px", marginBottom:14, borderRadius:7,
              border:"1px solid #374151", background:"#111827", color:"white",
              fontSize:14, outline:"none", fontFamily:T.sans,
            }}
          />

          {/* Password */}
          <label style={{ display:"block", fontSize:12, fontWeight:600, color:"#9ca3af", marginBottom:5 }}>
            Password {isSignup && <span style={{ fontWeight:400, opacity:.7 }}>(min 6 characters)</span>}
          </label>
          <input
            type="password"
            placeholder={isSignup ? "Choose a password" : "Your password"}
            value={authPassword}
            onChange={(e)=>{ setAuthPassword(e.target.value); setAuthError(""); }}
            onKeyDown={(e)=>{ if(e.key==="Enter") (isSignup?handleSignup:handleLogin)(); }}
            disabled={authBusy}
            style={{
              width:"100%", padding:"12px 14px", marginBottom:14, borderRadius:7,
              border:"1px solid #374151", background:"#111827", color:"white",
              fontSize:14, outline:"none", fontFamily:T.sans,
            }}
          />

          {/* Confirm Password — only on signup */}
          {isSignup && (
            <>
              <label style={{ display:"block", fontSize:12, fontWeight:600, color:"#9ca3af", marginBottom:5 }}>Confirm Password</label>
              <input
                type="password"
                placeholder="Re-enter your password"
                value={authConfirmPassword}
                onChange={(e)=>{ setAuthConfirmPassword(e.target.value); setAuthError(""); }}
                onKeyDown={(e)=>{ if(e.key==="Enter") handleSignup(); }}
                disabled={authBusy}
                style={{
                  width:"100%", padding:"12px 14px", marginBottom:14, borderRadius:7,
                  border:"1px solid #374151", background:"#111827", color:"white",
                  fontSize:14, outline:"none", fontFamily:T.sans,
                }}
              />
            </>
          )}

          {/* Submit button */}
          <button
            onClick={isSignup ? handleSignup : handleLogin}
            disabled={authBusy}
            style={{
              width:"100%", padding:"13px", borderRadius:8, border:"none",
              cursor: authBusy ? "wait" : "pointer", fontWeight:700, fontSize:14,
              background: authBusy ? "#475569" : "#3b82f6",
              color:"white", marginTop:6, fontFamily:T.sans,
              transition:"background .15s",
            }}>
            {authBusy ? "Please wait..." : (isSignup ? "Create Account" : "Sign In")}
          </button>

          {/* Footer toggle hint */}
          <div style={{ textAlign:"center", marginTop:16, fontSize:13, color:"#9ca3af" }}>
            {isSignup ? (
              <>Already have an account?{" "}
                <button onClick={()=>switchAuthMode("login")} style={{ background:"none", border:"none", color:"#60a5fa", cursor:"pointer", fontWeight:600, padding:0, fontSize:13 }}>
                  Sign in
                </button>
              </>
            ) : (
              <>Don't have an account?{" "}
                <button onClick={()=>switchAuthMode("signup")} style={{ background:"none", border:"none", color:"#60a5fa", cursor:"pointer", fontWeight:600, padding:0, fontSize:13 }}>
                  Create one
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  /* First-run setup wizard */
  /* While Supabase loads the user's data, show a brief loading screen */
  if (session && !dataLoaded) {
    return (
      <div style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", background:T.bg, fontFamily:T.sans, color:T.text }}>
        <div style={{ textAlign:"center" }}>
          <div style={{ fontSize:32, marginBottom:12 }}>⟳</div>
          <div style={{ fontSize:14, color:T.muted }}>Loading your data from the cloud...</div>
        </div>
      </div>
    );
  }


  /* First-run setup wizard */
  if (session && !dataLoaded) {
    return (
      <div style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", background:T.bg, fontFamily:T.sans, color:T.text }}>
        <div style={{ textAlign:"center" }}>
          <div style={{ fontSize:32, marginBottom:12 }}>⟳</div>
          <div style={{ fontSize:14, color:T.muted }}>Loading your data from the cloud...</div>
        </div>
      </div>
    );
  }

  if(!state.setupComplete) {
    return <SetupWizard onComplete={(setupData)=>dispatch({type:"COMPLETE_SETUP",payload:setupData})} />;
  }

  return (
    <div data-theme={effectiveTheme} style={{ minHeight:"100vh", background:T.bg, color:T.text, fontFamily:T.sans }}>
      <style>{`
        * { box-sizing:border-box; }
        body { margin:0; background:${T.bg}; color:${T.text}; }
        #root { width:100%; min-width:0; }
        table { width:100%; }
        input, select, textarea { background:${T.surface} !important; color:${T.text} !important; border-color:${T.border} !important; caret-color:${T.text}; }
        input::placeholder, textarea::placeholder { color:${T.muted} !important; opacity:.9; }
        option { background:${T.surface}; color:${T.text}; }
        button { color:inherit; }
        [data-theme="dark"] table, [data-theme="dark"] th, [data-theme="dark"] td { border-color:${T.border} !important; }
        [data-theme="dark"] th { background:${T.grayLt} !important; color:${T.subtext} !important; }
        [data-theme="dark"] td { color:${T.text}; }
        [data-theme="dark"] tr:hover { background:${T.accentLt} !important; }
        [data-theme="dark"] a { color:${T.accent}; }

        /* Dark mode deep cleanup: catch old hard-coded light panels that were left behind */
        [data-theme="dark"] [style*="background:#fff"],
        [data-theme="dark"] [style*="background: #fff"],
        [data-theme="dark"] [style*="background:#ffffff"],
        [data-theme="dark"] [style*="background: #ffffff"],
        [data-theme="dark"] [style*="background:white"],
        [data-theme="dark"] [style*="background: white"] { background:${T.card} !important; color:${T.text} !important; }

        [data-theme="dark"] [style*="background:#f9fafb"],
        [data-theme="dark"] [style*="background: #f9fafb"],
        [data-theme="dark"] [style*="background:#f3f4f6"],
        [data-theme="dark"] [style*="background: #f3f4f6"],
        [data-theme="dark"] [style*="background:#f8fafc"],
        [data-theme="dark"] [style*="background: #f8fafc"],
        [data-theme="dark"] [style*="background:#f0f8ff"],
        [data-theme="dark"] [style*="background: #f0f8ff"] { background:${T.grayLt} !important; color:${T.text} !important; }

        [data-theme="dark"] [style*="background:#fff5f5"],
        [data-theme="dark"] [style*="background: #fff5f5"],
        [data-theme="dark"] [style*="background:#fef2f2"],
        [data-theme="dark"] [style*="background: #fef2f2"],
        [data-theme="dark"] [style*="background:#fee2e2"],
        [data-theme="dark"] [style*="background: #fee2e2"] { background:${T.redLt} !important; color:${T.red} !important; }

        [data-theme="dark"] [style*="background:#fffbeb"],
        [data-theme="dark"] [style*="background: #fffbeb"],
        [data-theme="dark"] [style*="background:#fef3c7"],
        [data-theme="dark"] [style*="background: #fef3c7"],
        [data-theme="dark"] [style*="background:#fff7ed"],
        [data-theme="dark"] [style*="background: #fff7ed"] { background:${T.amberLt} !important; color:${T.amber} !important; }

        [data-theme="dark"] [style*="background:#ecfdf5"],
        [data-theme="dark"] [style*="background: #ecfdf5"],
        [data-theme="dark"] [style*="background:#f0fdf4"],
        [data-theme="dark"] [style*="background: #f0fdf4"],
        [data-theme="dark"] [style*="background:#dcfce7"],
        [data-theme="dark"] [style*="background: #dcfce7"] { background:${T.greenLt} !important; color:${T.green} !important; }

        [data-theme="dark"] [style*="background:#eff6ff"],
        [data-theme="dark"] [style*="background: #eff6ff"],
        [data-theme="dark"] [style*="background:#e8f0fe"],
        [data-theme="dark"] [style*="background: #e8f0fe"],
        [data-theme="dark"] [style*="background:#dbeafe"],
        [data-theme="dark"] [style*="background: #dbeafe"] { background:${T.accentLt} !important; color:${T.accent} !important; }

        [data-theme="dark"] [style*="background:#faf5ff"],
        [data-theme="dark"] [style*="background: #faf5ff"] { background:#2e1f45 !important; color:#d8b4fe !important; }

        [data-theme="dark"] [style*="color:#111"],
        [data-theme="dark"] [style*="color: #111"],
        [data-theme="dark"] [style*="color:#111827"],
        [data-theme="dark"] [style*="color: #111827"],
        [data-theme="dark"] [style*="color:#1f2937"],
        [data-theme="dark"] [style*="color: #1f2937"] { color:${T.text} !important; }

        [data-theme="dark"] [style*="color:#666"],
        [data-theme="dark"] [style*="color: #666"],
        [data-theme="dark"] [style*="color:#667085"],
        [data-theme="dark"] [style*="color: #667085"],
        [data-theme="dark"] [style*="color:#6b7280"],
        [data-theme="dark"] [style*="color: #6b7280"] { color:${T.muted} !important; }


        [data-theme="dark"] [style*="background: rgb(255, 255, 255)"],
        [data-theme="dark"] [style*="background:rgb(255, 255, 255)"] { background:${T.card} !important; color:${T.text} !important; }
        [data-theme="dark"] [style*="background: rgb(255, 251, 235)"],
        [data-theme="dark"] [style*="background:rgb(255, 251, 235)"] { background:${T.amberLt} !important; color:${T.amber} !important; }
        [data-theme="dark"] [style*="background: rgb(255, 245, 245)"],
        [data-theme="dark"] [style*="background:rgb(255, 245, 245)"] { background:${T.redLt} !important; color:${T.red} !important; }
        [data-theme="dark"] [style*="background: rgb(219, 234, 254)"],
        [data-theme="dark"] [style*="background:rgb(219, 234, 254)"] { background:${T.accentLt} !important; color:${T.accent} !important; }

        [data-theme="dark"] input[type="date"]::-webkit-calendar-picker-indicator { filter:invert(1); opacity:.85; }
        [data-theme="dark"] input[type="number"]::-webkit-inner-spin-button,
        [data-theme="dark"] input[type="number"]::-webkit-outer-spin-button { opacity:.8; }

        [data-theme="dark"] .print-page, [data-theme="dark"] .print-page * { background:#fff !important; color:#111827 !important; }
        @media print { body { background:#fff !important; color:#111827 !important; } input, select, textarea { background:#fff !important; color:#111827 !important; } }
        ::-webkit-scrollbar { width:6px; height:6px; }
        ::-webkit-scrollbar-track { background:${T.grayLt}; }
        ::-webkit-scrollbar-thumb { background:${T.borderHi}; border-radius:3px; }
        input:focus, select:focus, textarea:focus { border-color:${T.accent} !important; box-shadow:0 0 0 3px ${T.accentLt}; outline:none; }
        tr:hover { background:${T.accentLt} !important; }

        .mobile-x-scroll { overflow-x:auto; -webkit-overflow-scrolling:touch; max-width:100%; }
        .mobile-x-scroll table { min-width:960px; }
        .wo-request-mobile-list { display:none; }
        .wo-request-full { grid-column:1 / -1; }
        @media print { .no-print { display:none !important; } }
        @media (max-width: 768px) {
          html, body { width:100%; overflow-x:auto; -webkit-overflow-scrolling:touch; }
          #root { width:100%; min-width:0; overflow-x:visible; }
          header.no-print { height:auto !important; min-height:56px !important; padding:8px 10px !important; gap:8px !important; align-items:flex-start !important; }
          header.no-print > div:first-child { min-width:0 !important; flex:1 1 auto !important; gap:8px !important; flex-wrap:wrap !important; }
          header.no-print > div:last-child { gap:6px !important; flex-wrap:wrap !important; justify-content:flex-end !important; }
          header.no-print span, header.no-print button div + div { max-width:160px !important; overflow:hidden !important; text-overflow:ellipsis !important; white-space:nowrap !important; }
          main { padding:12px 10px 90px !important; overflow-x:auto !important; -webkit-overflow-scrolling:touch; }
          main > div { max-width:100%; min-width:0; }
          h1 { font-size:20px !important; }
          h2 { font-size:22px !important; }
          /* Mobile spreadsheet-style tables: keep first column frozen and swipe left/right for the rest */
          main { max-width:100vw !important; }
          main, main > div, section, article { overflow-x:auto !important; -webkit-overflow-scrolling:touch !important; }
          main table {
            display:block !important;
            width:max-content !important;
            min-width:980px !important;
            max-width:none !important;
            overflow-x:auto !important;
            overflow-y:visible !important;
            -webkit-overflow-scrolling:touch !important;
            table-layout:auto !important;
            border-collapse:separate !important;
            border-spacing:0 !important;
          }
          main thead, main tbody, main tr { width:max-content !important; }
          main th, main td {
            min-width:130px !important;
            max-width:none !important;
            white-space:nowrap !important;
            overflow:visible !important;
            text-overflow:clip !important;
            vertical-align:top !important;
          }
          main th:first-child, main td:first-child {
            position:sticky !important;
            left:0 !important;
            z-index:5 !important;
            min-width:165px !important;
            max-width:220px !important;
            white-space:normal !important;
            overflow-wrap:anywhere !important;
            background:${T.surface} !important;
            box-shadow:2px 0 5px rgba(15,23,42,.12) !important;
          }
          main th:first-child { z-index:8 !important; background:${T.grayLt} !important; }
          main tr:hover td:first-child { background:${T.accentLt} !important; }
          main th:last-child, main td:last-child { padding-right:22px !important; }
          main [style*="overflow:hidden"], main [style*="overflow: hidden"] { overflow:visible !important; }
          main [style*="textOverflow"], main [style*="text-overflow"] { text-overflow:clip !important; }
          main [style*="whiteSpace:"nowrap""], main [style*="white-space: nowrap"] { white-space:nowrap !important; }
          input, select, textarea, button { font-size:16px !important; }
          textarea { min-height:88px; }
          button { min-height:40px; touch-action:manipulation; }
          form, .modal, [role=dialog] { max-width:100vw !important; }
          div[style*="grid-template-columns:repeat(6"] { grid-template-columns:1fr !important; }
          div[style*="grid-template-columns: repeat(6"] { grid-template-columns:1fr !important; }
          div[style*="grid-template-columns:repeat(auto-fit"] { grid-template-columns:repeat(2,minmax(140px,1fr)) !important; }
          div[style*="width:420"] { width:100% !important; }
          div[style*="width: 420"] { width:100% !important; }
          div[style*="max-width: 1100"] { max-width:100% !important; }
          div[style*="maxWidth:1100"] { max-width:100% !important; }
          div[style*="overflowX"], div[style*="overflow-x"] { overflow-x:auto !important; -webkit-overflow-scrolling:touch; }
          td, th { white-space:nowrap; }
          p, div, span { overflow-wrap:anywhere; }
          .wo-requests-page { gap:12px !important; }
          .wo-requests-page > div { padding:14px !important; border-radius:14px !important; }
          .wo-request-facility-grid, .wo-request-form-grid { grid-template-columns:1fr !important; gap:12px !important; }
          .wo-request-header-row { flex-direction:column !important; align-items:stretch !important; }
          .wo-request-header-row button { width:100% !important; min-height:46px !important; }
          .wo-request-facility-card { padding:14px !important; }
          .wo-request-full { grid-column:auto !important; }
          .wo-request-form-grid input, .wo-request-form-grid select, .wo-request-form-grid textarea { width:100% !important; min-height:48px !important; border-radius:10px !important; }
          .wo-request-form-grid textarea { min-height:140px !important; }
          .wo-request-form-actions, .wo-request-actions { flex-direction:column !important; align-items:stretch !important; }
          .wo-request-form-actions button, .wo-request-actions button, .wo-request-facility-card button { width:100% !important; min-height:46px !important; justify-content:center !important; }
          .wo-request-desktop-table { display:none !important; }
          .wo-request-mobile-list { display:block !important; }
          .wo-request-mobile-card { width:100% !important; }
          .wo-request-mobile-card * { white-space:normal !important; }
          .wo-request-mobile-meta { grid-template-columns:1fr !important; font-size:13px !important; }
        }
        @media (max-width: 480px) {
          div[style*="grid-template-columns:repeat(auto-fit"], div[style*="grid-template-columns:repeat(2"] { grid-template-columns:1fr !important; }
          main table { min-width:1040px !important; }
        }
      `}</style>

      <SlideMenu tab={tab} setTab={setTab} open={menuOpen} onClose={()=>setMenuOpen(false)} onSettings={()=>setShowSettings(true)} companyName={companyName} profile={profile} />

      {/* Custom header with profile button */}
      <header className="no-print" style={{ position:"sticky", top:0, zIndex:1000, background:T.surface, borderBottom:`1px solid ${T.border}`, padding:"0 20px", height:56, display:"flex", alignItems:"center", justifyContent:"space-between", boxShadow:`0 1px 0 ${T.border}` }}>
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
          <select title="Switch facility" value={state.activeLocationId || "__all"} onChange={e=>dispatch({type:"SET_ACTIVE_LOCATION", payload:e.target.value})} style={{ ...sel, width:190, padding:"5px 9px", fontSize:12 }}>
            <option value="__all">Organization Dashboard / All Facilities</option>
            {maintLocations.map(l=><option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
          <span style={{ fontFamily:T.sans, fontSize:11, color:T.muted }}>Facility: {activeLocationLabel}</span>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <button onClick={cycleThemePreference} title={`Theme: ${selectedTheme === "system" ? "System Default" : selectedTheme === "dark" ? "Dark Mode" : "Light Mode"}`} style={{ padding:"6px 10px", border:`1px solid ${T.border}`, borderRadius:7, background:T.surface, color:T.text, cursor:"pointer", fontSize:13, fontFamily:T.sans }}>
            {effectiveTheme === "dark" ? "🌙" : "☀️"}
          </button>
          {/* Sync status indicator */}
          {syncStatus !== "idle" && (
            <span style={{
              fontFamily:T.sans, fontSize:11, fontWeight:600,
              padding:"3px 9px", borderRadius:10,
              background: syncStatus==="saving"?"#fef3c7":syncStatus==="saved"?"#d1fae5":"#fee2e2",
              color:     syncStatus==="saving"?"#92400e":syncStatus==="saved"?"#065f46":"#991b1b",
              border: `1px solid ${syncStatus==="saving"?"#fbbf24":syncStatus==="saved"?"#10b981":"#ef4444"}`,
            }}>
              {syncStatus==="saving"?"⟳ Saving...":syncStatus==="saved"?"✓ Saved":"⚠ Save failed"}
            </span>
          )}
          {/* Notification bell */}
          <NotifBell notifications={state.notifications} dispatch={dispatch} />
          <button onClick={handleLogout} style={{ padding:"6px 10px", border:`1px solid ${T.border}`, borderRadius:7, background:T.surface, color:T.text, cursor:"pointer", fontSize:13 }}>
            Logout
          </button>
          {/* User profile button */}
          <button onClick={()=>setShowProfile(true)} style={{ display:"flex", alignItems:"center", gap:8, padding:"5px 10px", border:`1px solid ${T.border}`, borderRadius:7, background:T.surface, cursor:"pointer" }}>
            <div style={{ width:24, height:24, borderRadius:"50%", background:T.accent, display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, color:"#fff", fontWeight:700, fontFamily:T.mono, overflow:"hidden" }}>
              {profile.photo ? <img src={profile.photo} alt="me" style={{ width:"100%", height:"100%", objectFit:"cover" }} /> : initials}
            </div>
            <span style={{ fontFamily:T.sans, fontSize:13, fontWeight:500, color:T.text }}>{displayName}</span>
          </button>
        </div>
      </header>

      <main style={{ width:"100%", maxWidth:"none", padding:"16px 18px", minHeight:"calc(100vh - 56px)", overflowX:"auto" }}>
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
