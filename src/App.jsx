import React, { useState, useEffect, useMemo, useRef } from "react";
import { supabase } from "./supabaseClient";

/* ---------- design tokens: black / gold / white / gray theme ---------- */
const INK = "#1C1C1C";
const BG = "#F1F0ED";
const CARD = "#FFFFFF";
const WINE = "#1C1C1C";
const WINE_DARK = "#000000";
const GOLD = "#C9A227";
const SAGE = "#3F7A52";
const RUST = "#A3352C";
const LINE = "#D3D0C8";
const LINE_STRONG = "#AFAB9F";
const MUTED = "#6E6C67";
const FONT_VOICE = "'Cormorant Garamond', 'Times New Roman', Georgia, serif";

const peso = (n) =>
  "\u20B1" + (Number(n) || 0).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

const localDayFromDate = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return y + "-" + m + "-" + day;
};
const todayStr = () => localDayFromDate(new Date());
// converts a full ISO timestamp (e.g. a sale's date) to the local calendar day
const localDayOf = (isoString) => localDayFromDate(new Date(isoString));

const fmtDate = (d) => {
  const dt = new Date(d + "T00:00:00");
  return dt.toLocaleDateString("en-PH", { weekday: "short", month: "short", day: "numeric" });
};
const fmtBirthday = (d) => {
  if (!d) return "";
  const dt = new Date(d + "T00:00:00");
  return dt.toLocaleDateString("en-PH", { month: "long", day: "numeric", year: "numeric" });
};
const daysUntilBirthday = (birthdayIso) => {
  if (!birthdayIso) return null;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const bday = new Date(birthdayIso + "T00:00:00");
  let next = new Date(today.getFullYear(), bday.getMonth(), bday.getDate());
  if (next < today) next = new Date(today.getFullYear() + 1, bday.getMonth(), bday.getDate());
  return Math.round((next - today) / (24 * 60 * 60 * 1000));
};

const LOW_STOCK_THRESHOLD = 5;
const CATALOG_VERSION = 2;
const DEFAULT_CATEGORIES = ["Haircut", "Hair Color", "Organic Color", "Treatment", "Organic, Pure Vegan", "Hair Scalp Treatment", "Manicure", "Pedicure", "Nail Art", "Hand & Foot Care", "Arch & Define"];

const effectiveThreshold = (item, universal) =>
  typeof item.lowStockThreshold === "number" ? item.lowStockThreshold : universal;

const computeDiscountAmount = (subtotal, type, value) => {
  if (type === "percent") return Math.min(subtotal, subtotal * (Number(value) || 0) / 100);
  if (type === "fixed") return Math.min(subtotal, Number(value) || 0);
  if (type === "senior") return subtotal * 0.2;
  return 0;
};

/* ---------- date range presets ---------- */
const isoDay = (d) => localDayFromDate(d);

function presetRange(preset, customStart, customEnd) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (preset === "yesterday") {
    const y = new Date(today); y.setDate(y.getDate() - 1);
    return { start: isoDay(y), end: isoDay(y) };
  }
  if (preset === "last7") {
    const s = new Date(today); s.setDate(s.getDate() - 6);
    return { start: isoDay(s), end: isoDay(today) };
  }
  if (preset === "last30") {
    const s = new Date(today); s.setDate(s.getDate() - 29);
    return { start: isoDay(s), end: isoDay(today) };
  }
  if (preset === "lastweek") {
    const day = today.getDay();
    const diffToMon = day === 0 ? -6 : 1 - day;
    const thisMonday = new Date(today); thisMonday.setDate(today.getDate() + diffToMon);
    const lastSunday = new Date(thisMonday); lastSunday.setDate(thisMonday.getDate() - 1);
    const lastMonday = new Date(lastSunday); lastMonday.setDate(lastSunday.getDate() - 6);
    return { start: isoDay(lastMonday), end: isoDay(lastSunday) };
  }
  if (preset === "lastmonth") {
    const firstThisMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const lastMonthEnd = new Date(firstThisMonth); lastMonthEnd.setDate(lastMonthEnd.getDate() - 1);
    const lastMonthStart = new Date(lastMonthEnd.getFullYear(), lastMonthEnd.getMonth(), 1);
    return { start: isoDay(lastMonthStart), end: isoDay(lastMonthEnd) };
  }
  if (preset === "year") {
    const s = new Date(today); s.setDate(s.getDate() - 364);
    return { start: isoDay(s), end: isoDay(today) };
  }
  if (preset === "specific") return { start: customStart || isoDay(today), end: customStart || isoDay(today) };
  if (preset === "range") return { start: customStart || isoDay(today), end: customEnd || isoDay(today) };
  return { start: isoDay(today), end: isoDay(today) };
}

const rangeLabel = (preset, start, end) => {
  const labels = { today: "Today", yesterday: "Yesterday", last7: "Last 7 days", last30: "Last 30 days", lastweek: "Last week", lastmonth: "Last month", year: "Last year" };
  if (labels[preset]) return labels[preset];
  if (preset === "specific") return fmtDate(start);
  return fmtDate(start) + " – " + fmtDate(end);
};

function DateRangeFilter({ value, onChange }) {
  const setPreset = (preset) => {
    if (preset === "specific" || preset === "range") {
      onChange({ preset, start: value.start, end: value.end });
    } else {
      const r = presetRange(preset);
      onChange({ preset, start: r.start, end: r.end });
    }
  };
  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
      <select style={Object.assign({}, inputStyle, { width: 170 })} value={value.preset} onChange={(e) => setPreset(e.target.value)}>
        <option value="today">Today</option>
        <option value="yesterday">Yesterday</option>
        <option value="last7">Last 7 days</option>
        <option value="lastweek">Last week</option>
        <option value="last30">Last 30 days</option>
        <option value="lastmonth">Last month</option>
        <option value="year">Last year</option>
        <option value="specific">Specific date</option>
        <option value="range">Specific date range</option>
      </select>
      {value.preset === "specific" && (
        <input type="date" max={todayStr()} style={Object.assign({}, inputStyle, { width: 160 })} value={value.start} onChange={(e) => onChange({ preset: "specific", start: e.target.value, end: e.target.value })} />
      )}
      {value.preset === "range" && (
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <input type="date" max={todayStr()} style={Object.assign({}, inputStyle, { width: 150 })} value={value.start} onChange={(e) => {
            const newStart = e.target.value;
            onChange({ preset: "range", start: newStart, end: value.end < newStart ? newStart : value.end });
          }} />
          <span style={{ fontSize: 12, color: MUTED }}>to</span>
          <input type="date" max={todayStr()} min={value.start} style={Object.assign({}, inputStyle, { width: 150 })} value={value.end} onChange={(e) => {
            const newEnd = e.target.value;
            onChange({ preset: "range", start: value.start, end: newEnd < value.start ? value.start : newEnd });
          }} />
        </div>
      )}
    </div>
  );
}
const defaultRangeValue = (preset) => { const r = presetRange(preset || "today"); return { preset: preset || "today", start: r.start, end: r.end }; };
const inRange = (dateIso, start, end) => {
  const d = dateIso.length > 10 ? localDayOf(dateIso) : dateIso;
  return d >= start && d <= end;
};

/* ---------- file export helpers ---------- */
function downloadBlob(filename, content, mime) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
function downloadCSV(filename, rows) {
  const csv = rows.map((row) => row.map((cell) => {
    const s = String(cell != null ? cell : "");
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }).join(",")).join("\n");
  downloadBlob(filename, csv, "text/csv;charset=utf-8;");
}
function downloadJSON(filename, obj) {
  downloadBlob(filename, JSON.stringify(obj, null, 2), "application/json;charset=utf-8;");
}

/* ---------- seed data: real Leeya menu ---------- */
const svc = (name, category, price, starting) => ({
  id: uid(), name, type: "service", category, price,
  stock: null, lowStockThreshold: null,
  priceNote: starting ? "Start @" : null,
  linkedServiceId: null, sessionsIncluded: null,
});

const seedCatalog = () => [
  svc("Haircut", "Haircut", 300, false),
  svc("Haircut w/ Shampoo", "Haircut", 500, false),
  svc("Haircut w/ 10 mins treatment", "Haircut", 1000, false),
  svc("Shampoo w/ Blow dry", "Haircut", 500, false),
  svc("Iron", "Haircut", 650, false),
  svc("Curl", "Haircut", 650, false),
  svc("Hairstyle", "Haircut", 750, true),

  svc("Rooting", "Hair Color", 1200, false),
  svc("Frosting", "Hair Color", 1500, false),
  svc("Basic Color", "Hair Color", 1500, true),
  svc("Two-Tone Color: Change Color", "Hair Color", 3500, true),
  svc("Two-Tone Color: Fashion Color", "Hair Color", 3500, true),
  svc("Foil", "Hair Color", 2000, true),
  svc("Full Bleach", "Hair Color", 2500, true),
  svc("Balayage", "Hair Color", 4000, true),

  svc("Rooting", "Organic Color", 2000, true),
  svc("Basic Color", "Organic Color", 2900, true),
  svc("Two-Tone Color: Change Color", "Organic Color", 5000, true),
  svc("Two-Tone Color: Fashion Color", "Organic Color", 5000, true),
  svc("Frosting", "Organic Color", 2500, true),
  svc("Foil", "Organic Color", 3000, true),
  svc("Full Bleach", "Organic Color", 5000, true),
  svc("Balayage", "Organic Color", 6500, true),

  svc("Keratin Express", "Treatment", 2500, true),
  svc("Brazilian Blowout", "Treatment", 3500, true),
  svc("Hair Botox", "Treatment", 4000, true),
  svc("Rebond", "Treatment", 3000, true),
  svc("Protein Straight Bond", "Treatment", 4000, true),
  svc("Permanent Blow Dry", "Treatment", 5500, true),
  svc("Permanent Brazilian", "Treatment", 5000, true),

  svc("Nano Plasty", "Organic, Pure Vegan", 4999, true),
  svc("Meso-Therapy/Diamond", "Organic, Pure Vegan", 5499, true),
  svc("Protein Straight Bond", "Organic, Pure Vegan", 4999, true),

  svc("Deep Nourishing/Repair Tx", "Hair Scalp Treatment", 1500, false),
  svc("Nano Steam", "Hair Scalp Treatment", 1000, false),
  svc("Dandruff Treatment", "Hair Scalp Treatment", 1500, false),
  svc("Anti-hair loss Treatment", "Hair Scalp Treatment", 1500, false),
  svc("Hair SPA", "Hair Scalp Treatment", 500, true),
  svc("Hot Oil", "Hair Scalp Treatment", 500, true),
  svc("Collagen Treatment", "Hair Scalp Treatment", 1500, true),

  svc("Basic Manicure (ORLY)", "Manicure", 220, false),
  svc("Gel Manicure", "Manicure", 500, false),
  svc("Soft Gel Extension", "Manicure", 1500, false),
  svc("Acrylic Nail Extension", "Manicure", 2900, false),

  svc("Basic Pedicure (ORLY)", "Pedicure", 250, false),
  svc("Gel Pedicure", "Pedicure", 600, false),

  svc("Blings & Decals (per 10pcs)", "Nail Art", 150, false),
  svc("Decal Stickers (per 10pcs)", "Nail Art", 100, false),
  svc("French Tip", "Nail Art", 100, false),
  svc("Special Cat's Eye", "Nail Art", 200, false),
  svc("Freehand Simple", "Nail Art", 300, false),
  svc("Freehand with 3D Single", "Nail Art", 100, false),
  svc("Freehand with 3D", "Nail Art", 500, true),

  svc("Foot SPA Glow", "Hand & Foot Care", 500, false),
  svc("Foot SPA Ritual", "Hand & Foot Care", 1000, false),
  svc("Foot Massage 1hr", "Hand & Foot Care", 550, false),
  svc("Hand SPA Glow", "Hand & Foot Care", 500, false),
  svc("Hand Massage", "Hand & Foot Care", 500, false),

  svc("Brow Clean Up", "Arch & Define", 150, false),
  svc("Brow Threading", "Arch & Define", 350, false),
  svc("Upper Lip Threading", "Arch & Define", 350, false),
  svc("Lower Lip Threading", "Arch & Define", 500, false),
  svc("Brow Tinting", "Arch & Define", 550, false),
];

const seedStaff = () => [
  { id: uid(), name: "Owner", pin: "1234", role: "owner", commissionRate: 0, active: true, posAccess: true, canVoidSales: true },
];

/* ---------- storage helpers ---------- */
const KEYS = {
  catalog: "leeya:catalog",
  customers: "leeya:customers",
  staff: "leeya:staff",
  sales: "leeya:sales",
  appointments: "leeya:appointments",
  tickets: "leeya:tickets",
  packages: "leeya:packages",
  cashDrawer: "leeya:cashdrawer",
  expenses: "leeya:expenses",
  settings: "leeya:settings",
  messages: "leeya:messages",
  presence: "leeya:presence",
};

/* ---------- Leeya Kaizen App integration: Face ID time clock ----------
   Kaizen App stores its data as one JSON document in a Supabase table
   called "kaizen_state" (row id = "main"), in the SAME Supabase project
   this POS app uses. Staff identity, PINs, and roles for the two apps
   are intentionally kept separate (POS has its own posAccess/commission
   fields), but attendance is NOT duplicated: the Face ID clock below
   reads enrolled faces from Kaizen's staff list and writes stamps
   straight into Kaizen's own attendance array, so Kaizen App remains the
   single source of truth for attendance — POS never keeps its own copy. */
const KAIZEN_TABLE = "kaizen_state";
const FACE_MATCH_THRESHOLD = 0.55; // lower = stricter. 0.5 is face-api.js's textbook cutoff; nudged up slightly since a small team can tolerate a bit more leniency in exchange for fewer failed scans.
const FACE_MATCH_MARGIN = 0.04; // if the 2nd-closest face is within this margin of the best match, treat as ambiguous rather than guess

function euclideanDistance(a, b) {
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += (a[i] - b[i]) * (a[i] - b[i]);
  return Math.sqrt(sum);
}

let faceModelsLoaded = false;
function faceDetectorOptions() {
  // Larger inputSize + a lower score threshold than the library default
  // catches faces more reliably under real-world lighting/angles/camera
  // quality on shop-floor devices, at a small extra compute cost per frame.
  return new window.faceapi.TinyFaceDetectorOptions({ inputSize: 512, scoreThreshold: 0.4 });
}
function waitForFaceApi(timeoutMs) {
  timeoutMs = timeoutMs || 10000;
  return new Promise((resolve, reject) => {
    const start = Date.now();
    (function check() {
      if (window.faceapi) return resolve();
      if (Date.now() - start > timeoutMs) return reject(new Error("face-api.js did not load in time"));
      setTimeout(check, 120);
    })();
  });
}
async function ensureFaceModels() {
  if (faceModelsLoaded) return;
  await waitForFaceApi();
  const MODEL_URL = "https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.15/model";
  await window.faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
  await window.faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
  await window.faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL);
  faceModelsLoaded = true;
}

function kzDateStr(d) {
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, "0"), day = String(d.getDate()).padStart(2, "0");
  return y + "-" + m + "-" + day;
}
function kzTimeStr(d) {
  return String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
}

// Staff enrolled for Face ID in Kaizen App (active + has a saved face descriptor)
async function loadKaizenFaces() {
  const { data, error } = await supabase.from(KAIZEN_TABLE).select("data").eq("id", "main").maybeSingle();
  if (error) throw error;
  const staffList = (data && data.data && data.data.staff) || [];
  return staffList.filter((s) => s.active !== false && Array.isArray(s.faceDescriptor) && s.faceDescriptor.length === 128);
}

// Reads the freshest copy right before writing (small race window, not a full lock,
// but far safer than writing a stale in-memory copy of the whole Kaizen document).
// Returns "in" | "out" | "already-complete".
const MIN_STAMP_INTERVAL_MIN = 60; // require at least this many minutes between a time-in and its time-out
function kzMinutesOfDay(hhmm) { const [h, m] = hhmm.split(":").map(Number); return h * 60 + m; }

// Returns { outcome, timeIn?, minutesRemaining? } where outcome is one of:
// "in" | "out" | "already-complete" | "too-soon"
async function stampKaizenAttendance(staffId) {
  const { data, error } = await supabase.from(KAIZEN_TABLE).select("data").eq("id", "main").maybeSingle();
  if (error) throw error;
  const doc = (data && data.data) ? data.data : {};
  const attendance = Array.isArray(doc.attendance) ? doc.attendance.slice() : [];
  const today = kzDateStr(new Date());
  const t = kzTimeStr(new Date());
  const idx = attendance.findIndex((a) => a.staffId === staffId && a.date === today);
  if (idx === -1) {
    attendance.push({
      id: "att_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
      staffId, date: today, timeIn: t, timeOut: null,
      stampedBy: staffId, note: "Face ID time clock (Leeya POS App)",
      editHistory: [], source: "pos_face",
    });
    doc.attendance = attendance;
    const { error: upErr } = await supabase.from(KAIZEN_TABLE).upsert({ id: "main", data: doc, updated_at: new Date().toISOString() });
    if (upErr) throw upErr;
    return { outcome: "in" };
  }
  if (!attendance[idx].timeOut) {
    // Guard against the camera catching the same person again moments after
    // they timed in (e.g. lingering near the register) and mistaking it for
    // a time-out. Require a minimum gap before a time-out is accepted.
    const prevTimeIn = attendance[idx].timeIn;
    const elapsed = prevTimeIn ? (kzMinutesOfDay(t) - kzMinutesOfDay(prevTimeIn)) : MIN_STAMP_INTERVAL_MIN;
    if (elapsed < MIN_STAMP_INTERVAL_MIN) {
      return { outcome: "too-soon", timeIn: prevTimeIn, minutesRemaining: Math.max(1, MIN_STAMP_INTERVAL_MIN - elapsed) };
    }
    attendance[idx] = Object.assign({}, attendance[idx], { timeOut: t });
    doc.attendance = attendance;
    const { error: upErr } = await supabase.from(KAIZEN_TABLE).upsert({ id: "main", data: doc, updated_at: new Date().toISOString() });
    if (upErr) throw upErr;
    return { outcome: "out" };
  }
  return { outcome: "already-complete" };
}

/* ---------- persistence: Supabase + offline retry queue + conflict detection ---------- */
const lastKnownUpdatedAt = {}; // key -> ISO timestamp of the value we last read/wrote successfully
const pendingWrites = {}; // key -> value still waiting to reach the server
const conflictKeys = {}; // key -> true if another device changed this key since we last read it
let retryTimer = null;

function currentSyncStatus() {
  const pendingCount = Object.keys(pendingWrites).length;
  const conflictCount = Object.keys(conflictKeys).length;
  let state = "saved";
  if (pendingCount > 0) state = "offline";
  else if (conflictCount > 0) state = "conflict";
  return { state, pendingCount, conflictCount };
}
function notifySyncStatus() {
  window.dispatchEvent(new CustomEvent("leeya:syncstatus", { detail: currentSyncStatus() }));
}

async function loadKey(key, fallback) {
  try {
    const { data, error } = await supabase.from("leeya_kv").select("value, updated_at").eq("key", key).maybeSingle();
    if (error) throw error;
    if (data && data.value !== null && data.value !== undefined) {
      lastKnownUpdatedAt[key] = data.updated_at || null;
      return data.value;
    }
    lastKnownUpdatedAt[key] = null;
    return fallback;
  } catch (e) {
    console.error("load failed", key, e);
    return fallback;
  }
}

async function attemptSave(key, value) {
  try {
    const { data: current, error: readErr } = await supabase.from("leeya_kv").select("updated_at").eq("key", key).maybeSingle();
    if (!readErr && current && lastKnownUpdatedAt[key] && current.updated_at && current.updated_at !== lastKnownUpdatedAt[key]) {
      conflictKeys[key] = true;
    } else {
      delete conflictKeys[key];
    }
    const nowIso = new Date().toISOString();
    const { error } = await supabase.from("leeya_kv").upsert({ key, value, updated_at: nowIso });
    if (error) throw error;
    lastKnownUpdatedAt[key] = nowIso;
    return true;
  } catch (e) {
    console.error("save failed", key, e);
    return false;
  }
}

function scheduleRetry() {
  if (retryTimer) return;
  retryTimer = setInterval(async () => {
    const keys = Object.keys(pendingWrites);
    if (keys.length === 0) { clearInterval(retryTimer); retryTimer = null; return; }
    for (const key of keys) {
      const ok = await attemptSave(key, pendingWrites[key]);
      if (ok) delete pendingWrites[key];
    }
    notifySyncStatus();
    if (Object.keys(pendingWrites).length === 0 && retryTimer) { clearInterval(retryTimer); retryTimer = null; }
  }, 8000);
}

async function saveKey(key, value) {
  const ok = await attemptSave(key, value);
  if (ok) delete pendingWrites[key];
  else { pendingWrites[key] = value; scheduleRetry(); }
  notifySyncStatus();
}

function dismissConflict(key) {
  delete conflictKeys[key];
  notifySyncStatus();
}
function dismissAllConflicts() {
  Object.keys(conflictKeys).forEach((k) => delete conflictKeys[k]);
  notifySyncStatus();
}

/* ---------- small UI atoms ---------- */
function Btn(props) {
  const { children, onClick, variant, style, type, disabled } = props;
  const v = variant || "ghost";
  const base = { padding: "10px 16px", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: disabled ? "default" : "pointer", border: "1px solid transparent", transition: "opacity .15s", opacity: disabled ? 0.5 : 1 };
  const variants = {
    primary: { background: WINE, color: "#fff" },
    gold: { background: GOLD, color: "#3A2C10" },
    ghost: { background: "#fff", color: INK, border: "1px solid " + LINE },
    danger: { background: "#fff", color: RUST, border: "1px solid " + RUST + "55" },
  };
  return (
    <button type={type || "button"} disabled={disabled} onClick={onClick} style={Object.assign({}, base, variants[v], style)}>
      {children}
    </button>
  );
}

function Field({ label, children, hint }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: MUTED, marginBottom: 4, letterSpacing: 0.3 }}>{label}</div>
      {children}
      {hint && <div style={{ fontSize: 11, color: MUTED, marginTop: 3 }}>{hint}</div>}
    </div>
  );
}
const inputStyle = { width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid " + LINE, fontSize: 14, boxSizing: "border-box", background: "#fff", color: INK };

function Modal({ title, onClose, children, wide }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(36,26,38,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 16 }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: CARD, borderRadius: 14, padding: 20, width: wide ? 480 : 380, maxWidth: "100%", maxHeight: "88vh", overflowY: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div style={{ fontSize: 17, fontWeight: 700, color: INK }}>{title}</div>
          <span onClick={onClose} style={{ cursor: "pointer", color: MUTED, fontSize: 20, lineHeight: 1 }}>&times;</span>
        </div>
        {children}
      </div>
    </div>
  );
}

function ConfirmModal({ title, body, confirmLabel, onConfirm, onClose }) {
  return (
    <Modal title={title} onClose={onClose}>
      <div style={{ fontSize: 13, color: MUTED, marginBottom: 8 }}>{body}</div>
      <div style={{ fontSize: 12, color: RUST, marginBottom: 16 }}>This can't be undone.</div>
      <div style={{ display: "flex", gap: 8 }}>
        <Btn style={{ flex: 1 }} onClick={onClose}>Cancel</Btn>
        <Btn variant="danger" style={{ flex: 1 }} onClick={onConfirm}>{confirmLabel || "Confirm"}</Btn>
      </div>
    </Modal>
  );
}

function Badge({ text, color }) {
  return <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 20, background: color + "22", color: color }}>{text}</span>;
}

function Logo({ size, color }) {
  return <span style={{ fontFamily: FONT_VOICE, fontSize: size || 30, fontWeight: 600, color: color || GOLD, letterSpacing: 0.5 }}>Leeya</span>;
}

function FontImport() {
  return <style>{"@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600&display=swap');"}</style>;
}

const TYPE_META = {
  service: { label: "SERVICE", color: WINE },
  product: { label: "PRODUCT", color: SAGE },
  package: { label: "PACKAGE", color: GOLD },
  custom: { label: "CUSTOM CHARGE", color: RUST },
};

const priceLabel = (item) => (item.priceNote ? item.priceNote + " " + peso(item.price) : peso(item.price));

/* ---------- Discount picker (shared by direct charge + ticket checkout) ---------- */
function DiscountPicker({ discountType, setDiscountType, discountValue, setDiscountValue, discountReason, setDiscountReason }) {
  return (
    <div>
      <Field label="Discount">
        <select style={inputStyle} value={discountType} onChange={(e) => setDiscountType(e.target.value)}>
          <option value="none">No discount</option>
          <option value="percent">Percent off</option>
          <option value="fixed">Fixed amount off</option>
          <option value="senior">Senior citizen / PWD (20%)</option>
        </select>
      </Field>
      {(discountType === "percent" || discountType === "fixed") && (
        <Field label={discountType === "percent" ? "Discount %" : "Discount amount (PHP)"}>
          <input type="number" style={inputStyle} value={discountValue} onChange={(e) => setDiscountValue(e.target.value)} />
        </Field>
      )}
      {discountType !== "none" && (
        <Field label="Reason / reference (optional)">
          <input style={inputStyle} value={discountReason} onChange={(e) => setDiscountReason(e.target.value)} placeholder="Senior ID number, promo name..." />
        </Field>
      )}
    </div>
  );
}

/* ---------- Split payment editor (multiple methods on one sale) ---------- */
function SplitPaymentEditor({ payments, setPayments, total }) {
  const changeLine = (id, field, value) => setPayments((prev) => prev.map((p) => (p.id === id ? Object.assign({}, p, { [field]: value }) : p)));
  const addLine = () => setPayments((prev) => prev.concat([{ id: uid(), method: "Cash", amount: "" }]));
  const removeLine = (id) => setPayments((prev) => prev.filter((p) => p.id !== id));
  const splitTotal = payments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
  const remaining = Math.round((total - splitTotal) * 100) / 100;

  return (
    <div style={{ border: "1px solid " + LINE, borderRadius: 8, padding: 10, marginBottom: 12 }}>
      {payments.map((p) => (
        <div key={p.id} style={{ display: "flex", gap: 6, marginBottom: 6, alignItems: "center" }}>
          <select style={Object.assign({}, inputStyle, { width: 100 })} value={p.method} onChange={(e) => changeLine(p.id, "method", e.target.value)}>
            <option>Cash</option><option>GCash</option><option>Card</option>
          </select>
          <input type="number" style={Object.assign({}, inputStyle, { flex: 1 })} placeholder="Amount" value={p.amount} onChange={(e) => changeLine(p.id, "amount", e.target.value)} />
          <span onClick={() => removeLine(p.id)} style={{ cursor: "pointer", color: RUST, padding: "0 4px" }}>&times;</span>
        </div>
      ))}
      <Btn onClick={addLine} style={{ fontSize: 12, padding: "6px 10px" }}>+ Add payment line</Btn>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginTop: 8, fontWeight: 700, color: remaining === 0 ? SAGE : RUST }}>
        <span>{remaining === 0 ? "Fully covered" : remaining > 0 ? "Remaining: " + peso(remaining) : "Over by " + peso(Math.abs(remaining))}</span>
      </div>
    </div>
  );
}

/* ================= APP ================= */
export default function App() {
  const [loading, setLoading] = useState(true);
  const [catalog, setCatalog] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [staff, setStaff] = useState([]);
  const [sales, setSales] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [customerPackages, setCustomerPackages] = useState([]);
  const [cashDrawer, setCashDrawer] = useState({});
  const [expenses, setExpenses] = useState([]);
  const [settings, setSettings] = useState({ lowStockThreshold: LOW_STOCK_THRESHOLD, categories: DEFAULT_CATEGORIES, catalogVersion: CATALOG_VERSION });
  const [currentUser, setCurrentUser] = useState(null);
  const [tab, setTab] = useState("pos");
  const [syncStatus, setSyncStatus] = useState({ state: "saved", pendingCount: 0, conflictCount: 0 });

  useEffect(() => {
    const handler = (e) => setSyncStatus(e.detail);
    window.addEventListener("leeya:syncstatus", handler);
    const goOnline = () => { if (typeof scheduleRetry === "function") scheduleRetry(); };
    window.addEventListener("online", goOnline);
    return () => {
      window.removeEventListener("leeya:syncstatus", handler);
      window.removeEventListener("online", goOnline);
    };
  }, []);

  const IDLE_LIMIT_MS = 15 * 60 * 1000;
  const lastActivityRef = useRef(Date.now());
  useEffect(() => {
    const markActive = () => { lastActivityRef.current = Date.now(); };
    const events = ["mousedown", "keydown", "touchstart", "scroll"];
    events.forEach((ev) => window.addEventListener(ev, markActive));
    const interval = setInterval(() => {
      if (currentUser && Date.now() - lastActivityRef.current > IDLE_LIMIT_MS) {
        setCurrentUser(null);
      }
    }, 30000);
    return () => {
      events.forEach((ev) => window.removeEventListener(ev, markActive));
      clearInterval(interval);
    };
  }, [currentUser]);

  useEffect(() => {
    (async () => {
      const results = await Promise.all([
        loadKey(KEYS.catalog, null),
        loadKey(KEYS.customers, []),
        loadKey(KEYS.staff, null),
        loadKey(KEYS.sales, []),
        loadKey(KEYS.appointments, []),
        loadKey(KEYS.tickets, []),
        loadKey(KEYS.packages, []),
        loadKey(KEYS.cashDrawer, {}),
        loadKey(KEYS.expenses, []),
        loadKey(KEYS.settings, null),
      ]);
      const c = results[0], cu = results[1], st = results[2], sa = results[3], ap = results[4], ti = results[5], pk = results[6], cd = results[7], ex = results[8], se = results[9];

      const finalStaff = st || seedStaff();
      const needsReseed = !se || se.catalogVersion !== CATALOG_VERSION;
      const finalCatalog = needsReseed ? seedCatalog() : (c || seedCatalog());
      const finalSettings = needsReseed
        ? Object.assign({}, se || {}, { lowStockThreshold: (se && se.lowStockThreshold) || LOW_STOCK_THRESHOLD, categories: DEFAULT_CATEGORIES, catalogVersion: CATALOG_VERSION })
        : se;

      setCatalog(finalCatalog);
      setCustomers(cu || []);
      setStaff(finalStaff);
      setSales(sa || []);
      setAppointments(ap || []);
      setTickets(ti || []);
      setCustomerPackages(pk || []);
      setCashDrawer(cd || {});
      setExpenses(ex || []);
      setSettings(finalSettings);

      if (!st) saveKey(KEYS.staff, finalStaff);
      if (needsReseed) {
        saveKey(KEYS.catalog, finalCatalog);
        saveKey(KEYS.settings, finalSettings);
      }
      setLoading(false);
    })();
  }, []);

  const persist = {
    catalog: function (v) { setCatalog(v); saveKey(KEYS.catalog, v); },
    customers: function (v) { setCustomers(v); saveKey(KEYS.customers, v); },
    staff: function (v) { setStaff(v); saveKey(KEYS.staff, v); },
    sales: function (v) { setSales(v); saveKey(KEYS.sales, v); },
    appointments: function (v) { setAppointments(v); saveKey(KEYS.appointments, v); },
    tickets: function (v) { setTickets(v); saveKey(KEYS.tickets, v); },
    customerPackages: function (v) { setCustomerPackages(v); saveKey(KEYS.packages, v); },
    cashDrawer: function (v) { setCashDrawer(v); saveKey(KEYS.cashDrawer, v); },
    expenses: function (v) { setExpenses(v); saveKey(KEYS.expenses, v); },
    settings: function (v) { setSettings(v); saveKey(KEYS.settings, v); },
  };

  const runRestore = (obj) => {
    if (!obj || typeof obj !== "object") return;
    if (Array.isArray(obj.catalog)) persist.catalog(obj.catalog);
    if (Array.isArray(obj.customers)) persist.customers(obj.customers);
    if (Array.isArray(obj.staff)) persist.staff(obj.staff);
    if (Array.isArray(obj.sales)) persist.sales(obj.sales);
    if (Array.isArray(obj.appointments)) persist.appointments(obj.appointments);
    if (Array.isArray(obj.tickets)) persist.tickets(obj.tickets);
    if (Array.isArray(obj.customerPackages)) persist.customerPackages(obj.customerPackages);
    if (Array.isArray(obj.expenses)) persist.expenses(obj.expenses);
    if (obj.cashDrawer && typeof obj.cashDrawer === "object") persist.cashDrawer(obj.cashDrawer);
    if (obj.settings && typeof obj.settings === "object") persist.settings(obj.settings);
  };

  if (loading) return <div style={{ padding: 60, textAlign: "center", color: MUTED, fontFamily: "sans-serif" }}>Loading Leeya POS…</div>;

  if (!currentUser) return <EntryGate staff={staff} onLogin={setCurrentUser} />;

  const today = todayStr();
  if (!cashDrawer[today]) {
    return (
      <StartingCashGate
        staffName={currentUser.name}
        onSubmit={(amount) => {
          const updated = Object.assign({}, cashDrawer);
          updated[today] = { opening: amount, closing: null, note: "", openedBy: currentUser.name };
          persist.cashDrawer(updated);
        }}
      />
    );
  }

  const isOwner = currentUser.role === "owner";
  const canVoidSales = isOwner || currentUser.canVoidSales === true;
  const lowStockThreshold = settings.lowStockThreshold != null ? settings.lowStockThreshold : LOW_STOCK_THRESHOLD;
  const categories = settings.categories && settings.categories.length ? settings.categories : DEFAULT_CATEGORIES;
  const lowStockItems = catalog.filter((c) => typeof c.stock === "number" && c.stock <= effectiveThreshold(c, lowStockThreshold));
  const allData = { catalog: catalog, customers: customers, staff: staff, sales: sales, appointments: appointments, tickets: tickets, customerPackages: customerPackages, cashDrawer: cashDrawer, expenses: expenses, settings: settings, exportedAt: new Date().toISOString() };

  const tabs = [
    { id: "pos", label: "POS" },
    { id: "bookings", label: "Bookings" },
    { id: "customers", label: "Customers" },
    { id: "inventory", label: "Catalog" },
  ];
  if (canVoidSales) tabs.push({ id: "sales", label: "Sales" });
  if (isOwner || hasAnyReportAccess(currentUser)) tabs.push({ id: "staff", label: isOwner ? "Staff & Settings" : "Reports" });

  return (
    <div style={{ fontFamily: "-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif", background: BG, minHeight: "100vh", color: INK }}>
      <FontImport />
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "20px 16px 60px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
          <div>
            <Logo size={28} />
            <div style={{ fontSize: 12, color: MUTED, marginTop: 2 }}>Beauty Lounge · Balanga City Branch — POS</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ fontSize: 13, color: MUTED }}>
              Signed in as <strong style={{ color: INK }}>{currentUser.name}</strong>{" "}
              <Badge text={isOwner ? "Owner" : "Staff"} color={isOwner ? GOLD : MUTED} />
            </div>
            <Btn onClick={() => setCurrentUser(null)}>Log out</Btn>
          </div>
        </div>

        <div style={{ display: "flex", gap: 6, marginBottom: 20, borderBottom: "1px solid " + LINE, flexWrap: "wrap" }}>
          {tabs.map((t) => (
            <div key={t.id} onClick={() => setTab(t.id)} style={{ padding: "10px 16px", cursor: "pointer", fontWeight: 600, fontSize: 14, color: tab === t.id ? WINE : MUTED, borderBottom: tab === t.id ? "2px solid " + WINE : "2px solid transparent", marginBottom: -1 }}>
              {t.label}
            </div>
          ))}
        </div>

        {syncStatus.state === "offline" && (
          <div style={{ background: RUST + "15", border: "1px solid " + RUST + "55", borderRadius: 10, padding: "10px 14px", marginBottom: 16, fontSize: 13, color: RUST, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <strong>You're offline.</strong>
            <span>{syncStatus.pendingCount} change{syncStatus.pendingCount === 1 ? "" : "s"} waiting to sync — keep this tab open until it reconnects.</span>
          </div>
        )}
        {syncStatus.state === "conflict" && (
          <div style={{ background: GOLD + "18", border: "1px solid " + GOLD + "55", borderRadius: 10, padding: "10px 14px", marginBottom: 16, fontSize: 13, color: "#7A5E14", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", justifyContent: "space-between" }}>
            <span><strong>Heads up —</strong> data may have just changed on another device. Reload to make sure you're seeing the latest before making more changes.</span>
            <Btn onClick={() => window.location.reload()}>Reload now</Btn>
          </div>
        )}

        {lowStockItems.length > 0 && (
          <div style={{ background: RUST + "15", border: "1px solid " + RUST + "55", borderRadius: 10, padding: "10px 14px", marginBottom: 16, fontSize: 13, color: RUST, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <strong>Low stock:</strong>
            <span>{lowStockItems.map((i) => i.name + " (" + i.stock + ")").join(", ")}</span>
          </div>
        )}

        {tab === "pos" && (
          <POSTab
            catalog={catalog} setCatalog={persist.catalog}
            customers={customers} setCustomers={persist.customers}
            staff={staff}
            sales={sales} setSales={persist.sales}
            tickets={tickets} setTickets={persist.tickets}
            customerPackages={customerPackages} setCustomerPackages={persist.customerPackages}
            cashDrawer={cashDrawer} setCashDrawer={persist.cashDrawer}
            expenses={expenses} setExpenses={persist.expenses}
            settings={settings} setSettings={persist.settings}
            currentUser={currentUser}
            lowStockThreshold={lowStockThreshold}
          />
        )}
        {tab === "bookings" && (
          <BookingsTab appointments={appointments} setAppointments={persist.appointments} customers={customers} setCustomers={persist.customers} catalog={catalog} staff={staff} tickets={tickets} setTickets={persist.tickets} />
        )}
        {tab === "customers" && (
          <CustomersTab customers={customers} setCustomers={persist.customers} sales={sales} appointments={appointments} customerPackages={customerPackages} />
        )}
        {tab === "inventory" && (
          <InventoryTab catalog={catalog} setCatalog={persist.catalog} isOwner={isOwner} lowStockThreshold={lowStockThreshold} categories={categories} />
        )}
        {tab === "sales" && canVoidSales && (
          <SalesTab sales={sales} setSales={persist.sales} catalog={catalog} setCatalog={persist.catalog} customerPackages={customerPackages} setCustomerPackages={persist.customerPackages} customers={customers} currentUser={currentUser} />
        )}
        {tab === "staff" && (isOwner || hasAnyReportAccess(currentUser)) && (
          <StaffTab
            staff={staff} setStaff={persist.staff}
            sales={sales}
            catalog={catalog}
            expenses={expenses} setExpenses={persist.expenses}
            settings={settings} setSettings={persist.settings}
            allData={allData} onRestoreAll={runRestore}
            currentUser={currentUser}
          />
        )}
      </div>
      <MessengerWidget currentUser={currentUser} staff={staff} />
    </div>
  );
}

/* ---------- Login ---------- */
function Login({ staff, onLogin, onBack }) {
  const [picked, setPicked] = useState(null);
  const [pin, setPin] = useState("");
  const [err, setErr] = useState("");
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockUntil, setLockUntil] = useState(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!lockUntil) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [lockUntil]);

  const locked = lockUntil && now < lockUntil;
  const secondsLeft = locked ? Math.ceil((lockUntil - now) / 1000) : 0;

  const eligible = staff.filter((s) => s.active !== false && (s.role === "owner" || s.posAccess !== false));

  const selectStaff = (s) => { setPicked(s); setPin(""); setErr(""); setFailedAttempts(0); setLockUntil(null); };

  const tryLogin = () => {
    if (locked) return;
    if (picked.pin === pin) { onLogin(picked); return; }
    const next = failedAttempts + 1;
    setFailedAttempts(next);
    setPin("");
    if (next >= 5) {
      setLockUntil(Date.now() + 30000);
      setErr("Too many attempts. Try again in 30 seconds.");
    } else {
      setErr("Incorrect PIN. " + (5 - next) + " attempt" + (5 - next === 1 ? "" : "s") + " left.");
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: BG, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif" }}>
      <FontImport />
      <div style={{ width: 340, maxWidth: "90vw" }}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <Logo size={34} />
          <div style={{ fontSize: 13, color: MUTED, marginTop: 2 }}>Beauty Lounge · Balanga City Branch</div>
        </div>
        <div style={{ background: CARD, borderRadius: 14, padding: 20, border: "1px solid " + LINE }}>
          {!picked ? (
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: MUTED, marginBottom: 10 }}>Who's checking in?</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {eligible.map((s) => (
                  <div key={s.id} onClick={() => selectStaff(s)} style={{ padding: "12px 14px", borderRadius: 10, border: "1px solid " + LINE, cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontWeight: 600 }}>{s.name}</span>
                    <Badge text={s.role === "owner" ? "Owner" : "Staff"} color={s.role === "owner" ? GOLD : MUTED} />
                  </div>
                ))}
                {eligible.length === 0 && <div style={{ color: MUTED, fontSize: 13 }}>No accounts have POS access yet.</div>}
              </div>
            </div>
          ) : (
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: MUTED, marginBottom: 10 }}>Enter PIN for {picked.name}</div>
              <input autoFocus disabled={locked} type="password" inputMode="numeric" value={pin} onChange={(e) => setPin(e.target.value)} onKeyDown={(e) => e.key === "Enter" && tryLogin()} style={Object.assign({}, inputStyle, { textAlign: "center", fontSize: 20, letterSpacing: 4, marginBottom: 10, opacity: locked ? 0.5 : 1 })} placeholder="****" />
              {err && <div style={{ color: RUST, fontSize: 12, marginBottom: 10 }}>{locked ? "Too many attempts. Try again in " + secondsLeft + "s." : err}</div>}
              <div style={{ display: "flex", gap: 8 }}>
                <Btn onClick={() => setPicked(null)} style={{ flex: 1 }}>Back</Btn>
                <Btn variant="primary" onClick={tryLogin} disabled={locked} style={{ flex: 1 }}>Log in</Btn>
              </div>
            </div>
          )}
        </div>
        <div style={{ textAlign: "center", fontSize: 11, color: MUTED, marginTop: 14 }}>Default owner PIN is 1234 — change it under Staff & Settings.</div>
        {onBack && !picked && (
          <div style={{ textAlign: "center", marginTop: 10 }}>
            <button onClick={onBack} style={{ background: "none", border: "none", color: MUTED, fontSize: 12, cursor: "pointer", textDecoration: "underline" }}>&larr; Back</button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ================= ENTRY CHOOSER: Login to POS vs Time In/Out (Face ID) ================= */
function EntryGate({ staff, onLogin }) {
  const [mode, setMode] = useState(null); // null | "login" | "clock"
  if (mode === "login") return <Login staff={staff} onLogin={onLogin} onBack={() => setMode(null)} />;
  if (mode === "clock") return <TimeClock onBack={() => setMode(null)} />;
  return (
    <div style={{ minHeight: "100vh", background: BG, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif" }}>
      <FontImport />
      <div style={{ width: 340, maxWidth: "90vw", textAlign: "center" }}>
        <Logo size={34} />
        <div style={{ fontSize: 13, color: MUTED, marginTop: 2, marginBottom: 26 }}>Beauty Lounge · Balanga City Branch</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <Btn variant="primary" onClick={() => setMode("login")} style={{ padding: "16px 0", fontSize: 15 }}>Login to POS</Btn>
          <Btn onClick={() => setMode("clock")} style={{ padding: "16px 0", fontSize: 15 }}>Time In / Out (Face ID)</Btn>
        </div>
        <div style={{ fontSize: 11, color: MUTED, marginTop: 18 }}>Face ID is enrolled per staff member in Leeya Kaizen App, under My Profile.</div>
      </div>
    </div>
  );
}

/* ================= TIME CLOCK: face recognition time in/out ================= */
function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

function TimeClock({ onBack }) {
  const videoRef = useRef(null);
  const [phase, setPhase] = useState("loading"); // loading | scanning | stamping | success | notfound | error
  const [message, setMessage] = useState("Starting camera…");
  const [resultName, setResultName] = useState("");

  useEffect(() => {
    let stream = null;
    let stopped = false;
    const matchStreak = { id: null, count: 0 };

    async function handleMatch(staffMember) {
      stopped = true;
      setPhase("stamping");
      setResultName(staffMember.name);
      setMessage("Saving attendance…");
      try {
        const result = await stampKaizenAttendance(staffMember.id);
        if (result.outcome === "too-soon") {
          setPhase("toosoon");
          setMessage("Already timed in at " + result.timeIn + ". Please wait about " + result.minutesRemaining + " more minute(s) before timing out.");
        } else if (result.outcome === "in") {
          setPhase("success"); setMessage("Timed IN");
        } else if (result.outcome === "out") {
          setPhase("success"); setMessage("Timed OUT");
        } else {
          setPhase("success"); setMessage("Already complete for today");
        }
      } catch (e) {
        console.error(e);
        setPhase("error");
        setMessage("Could not save attendance — check your connection and try again.");
      }
      if (stream) stream.getTracks().forEach((t) => t.stop());
      setTimeout(onBack, 2800);
    }

    async function runLoop(enrolledStaff) {
      while (!stopped) {
        try {
          const det = await window.faceapi
            .detectSingleFace(videoRef.current, faceDetectorOptions())
            .withFaceLandmarks()
            .withFaceDescriptor();
          if (det && !stopped) {
            let best = null, bestDist = Infinity, secondDist = Infinity;
            for (const s of enrolledStaff) {
              const d = euclideanDistance(det.descriptor, s.faceDescriptor);
              if (d < bestDist) { secondDist = bestDist; bestDist = d; best = s; }
              else if (d < secondDist) { secondDist = d; }
            }
            const ambiguous = (secondDist - bestDist) < FACE_MATCH_MARGIN;
            if (best && bestDist < FACE_MATCH_THRESHOLD && !ambiguous) {
              if (matchStreak.id === best.id) matchStreak.count++;
              else { matchStreak.id = best.id; matchStreak.count = 1; }
              setMessage("Recognized " + best.name + "…");
              if (matchStreak.count >= 2) { await handleMatch(best); break; }
            } else {
              matchStreak.id = null; matchStreak.count = 0;
              if (!enrolledStaff.length) setMessage("No one has enrolled Face ID yet — set this up in Leeya Kaizen App under My Profile.");
              else if (best) setMessage("Face detected, but not a confident match — hold still, face the light, and stay centered.");
              else setMessage("Face detected — hold still…");
            }
          } else if (!stopped) {
            matchStreak.id = null; matchStreak.count = 0;
            setMessage(enrolledStaff.length ? "No face detected — move closer and face the camera directly." : "No one has enrolled Face ID yet — set this up in Leeya Kaizen App under My Profile.");
          }
        } catch (e) { /* skip a bad frame, keep scanning */ }
        await sleep(350);
      }
    }

    (async () => {
      try {
        await ensureFaceModels();
        const enrolledStaff = await loadKaizenFaces();
        stream = await navigator.mediaDevices.getUserMedia({ video: { width: 480, height: 480, facingMode: "user" } });
        if (stopped) { stream.getTracks().forEach((t) => t.stop()); return; }
        if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play(); }
        setPhase("scanning");
        setMessage(enrolledStaff.length ? "Look at the camera…" : "No one has enrolled Face ID yet — set this up in Leeya Kaizen App under My Profile.");
        runLoop(enrolledStaff);
      } catch (e) {
        console.error(e);
        setPhase("error");
        setMessage(e && e.name === "NotAllowedError" ? "Camera access was blocked. Allow camera access in your browser and try again." : "Could not start the camera on this device.");
      }
    })();

    return () => {
      stopped = true;
      if (stream) stream.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const color = phase === "error" ? RUST : phase === "success" ? SAGE : phase === "toosoon" ? GOLD : INK;

  return (
    <div style={{ minHeight: "100vh", background: BG, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif" }}>
      <FontImport />
      <div style={{ width: 380, maxWidth: "92vw", textAlign: "center" }}>
        <Logo size={30} />
        <div style={{ fontSize: 13, color: MUTED, marginTop: 2, marginBottom: 18 }}>Face ID Time Clock</div>
        <div style={{ background: CARD, borderRadius: 14, padding: 16, border: "1px solid " + LINE }}>
          <div style={{ position: "relative", width: "100%", aspectRatio: "1 / 1", borderRadius: 10, overflow: "hidden", background: "#000" }}>
            <video ref={videoRef} muted playsInline style={{ width: "100%", height: "100%", objectFit: "cover", transform: "scaleX(-1)" }} />
          </div>
          <div style={{ marginTop: 14, fontWeight: 700, color }}>
            {resultName ? resultName + " — " + message : message}
          </div>
          <Btn onClick={onBack} style={{ marginTop: 14, width: "100%" }}>Cancel</Btn>
        </div>
        <div style={{ fontSize: 11, color: MUTED, marginTop: 12 }}>Not recognized? Ask an Owner/Manager to enroll your Face ID in Leeya Kaizen App under My Profile.</div>
      </div>
    </div>
  );
}

/* ---------- Starting cash gate ---------- */
function StartingCashGate({ staffName, onSubmit }) {
  const [amount, setAmount] = useState("");
  return (
    <div style={{ minHeight: "100vh", background: BG, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif" }}>
      <FontImport />
      <div style={{ width: 340, maxWidth: "90vw" }}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <Logo size={30} />
          <div style={{ fontSize: 13, color: MUTED, marginTop: 2 }}>Starting cash for today</div>
        </div>
        <div style={{ background: CARD, borderRadius: 14, padding: 20, border: "1px solid " + LINE }}>
          <div style={{ fontSize: 13, color: MUTED, marginBottom: 10 }}>Hi {staffName} — enter the petty cash float in the drawer to start today's shift.</div>
          <input type="number" autoFocus style={Object.assign({}, inputStyle, { marginBottom: 12, fontSize: 18, textAlign: "center" })} placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} />
          <Btn variant="primary" style={{ width: "100%" }} onClick={() => onSubmit(Number(amount) || 0)}>Start shift</Btn>
        </div>
      </div>
    </div>
  );
}

/* ---------- ticket status meta ---------- */
const TICKET_STATUS = {
  pending: { label: "Waiting", color: GOLD, next: "in_service", nextLabel: "Start service" },
  in_service: { label: "In service", color: WINE, next: "ready", nextLabel: "Mark ready" },
  ready: { label: "Ready for checkout", color: SAGE, next: null, nextLabel: null },
};

/* ---------- Customer picker: searchable modal instead of a giant dropdown ---------- */
function CustomerPicker({ customers, setCustomers, customerId, setCustomerId }) {
  const [addingNew, setAddingNew] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");

  const selected = customers.find((c) => c.id === customerId);

  const saveNew = () => {
    if (!newName.trim()) return;
    const customer = { id: uid(), name: newName.trim(), phone: newPhone.trim(), email: "", address: "", birthday: "", notes: "", createdAt: new Date().toISOString() };
    setCustomers([customer].concat(customers));
    setCustomerId(customer.id);
    setAddingNew(false);
    setNewName("");
    setNewPhone("");
  };

  const filtered = customers.filter((c) => c.name.toLowerCase().indexOf(search.toLowerCase()) !== -1).slice(0, 50);

  return (
    <Field label="Customer (optional)">
      {selected ? (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", border: "1px solid " + LINE, borderRadius: 8, padding: "9px 12px" }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: 13 }}>{selected.name}</div>
            {selected.phone && <div style={{ fontSize: 12, color: MUTED }}>{selected.phone}</div>}
          </div>
          <Btn onClick={() => setCustomerId("")}>Change</Btn>
        </div>
      ) : addingNew ? (
        <div style={{ border: "1px solid " + LINE, borderRadius: 8, padding: 10 }}>
          <input style={Object.assign({}, inputStyle, { marginBottom: 6 })} placeholder="Customer name" value={newName} onChange={(e) => setNewName(e.target.value)} />
          <input style={Object.assign({}, inputStyle, { marginBottom: 8 })} placeholder="Mobile number (optional)" value={newPhone} onChange={(e) => setNewPhone(e.target.value)} />
          <div style={{ display: "flex", gap: 6 }}>
            <Btn style={{ flex: 1 }} onClick={() => setAddingNew(false)}>Cancel</Btn>
            <Btn variant="primary" style={{ flex: 1 }} onClick={saveNew}>Save</Btn>
          </div>
        </div>
      ) : (
        <div>
          <div style={{ fontSize: 12, color: MUTED, marginBottom: 6 }}>Walk-in (no customer selected)</div>
          <div style={{ display: "flex", gap: 8 }}>
            <Btn style={{ flex: 1 }} onClick={() => { setPickerOpen(true); setSearch(""); }}>Select existing</Btn>
            <Btn style={{ flex: 1 }} onClick={() => setAddingNew(true)}>+ New customer</Btn>
          </div>
        </div>
      )}

      {pickerOpen && (
        <Modal title="Select customer" onClose={() => setPickerOpen(false)}>
          <input autoFocus style={inputStyle} placeholder="Search by name" value={search} onChange={(e) => setSearch(e.target.value)} />
          <div style={{ maxHeight: 300, overflowY: "auto", marginTop: 10 }}>
            {filtered.map((c) => (
              <div key={c.id} onClick={() => { setCustomerId(c.id); setPickerOpen(false); }} style={{ padding: "10px 4px", borderBottom: "1px solid " + LINE, cursor: "pointer" }}>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{c.name}</div>
                {c.phone && <div style={{ fontSize: 12, color: MUTED }}>{c.phone}</div>}
              </div>
            ))}
            {filtered.length === 0 && <div style={{ fontSize: 13, color: MUTED, padding: "8px 0" }}>No matching customers.</div>}
          </div>
        </Modal>
      )}
    </Field>
  );
}

/* ---------- Cash drawer card ---------- */
function CashDrawerCard({ cashDrawer, setCashDrawer, sales, expenses, setExpenses, currentUser }) {
  const date = todayStr();
  const entry = cashDrawer[date] || { opening: 0, closing: null, note: "" };
  const [openingEdit, setOpeningEdit] = useState(false);
  const [openingVal, setOpeningVal] = useState(String(entry.opening != null ? entry.opening : 0));
  const [closing, setClosing] = useState(entry.closing != null ? String(entry.closing) : "");
  const [note, setNote] = useState(entry.note || "");
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [expDesc, setExpDesc] = useState("");
  const [expAmount, setExpAmount] = useState("");

  const todaySales = sales.filter((s) => !s.voided && localDayOf(s.date) === date);
  const methodTotal = (method) => todaySales.reduce((sum, s) => {
    if (s.paymentSplits) return sum + s.paymentSplits.filter((p) => p.method === method).reduce((a, p) => a + p.amount, 0);
    return sum + (s.paymentMethod === method ? s.total : 0);
  }, 0);
  const cashToday = methodTotal("Cash");
  const gcashToday = methodTotal("GCash");
  const cardToday = methodTotal("Card");
  const revenueToday = cashToday + gcashToday + cardToday;

  const expensesToday = expenses.filter((e) => e.date === date);
  const expensesTotal = expensesToday.reduce((sum, e) => sum + e.amount, 0);
  const expectedCash = (Number(entry.opening) || 0) + cashToday - expensesTotal;
  const variance = entry.closing != null ? Number(entry.closing) - expectedCash : null;

  const saveOpening = () => {
    const updated = Object.assign({}, cashDrawer);
    updated[date] = Object.assign({}, entry, { opening: Number(openingVal) || 0 });
    setCashDrawer(updated);
    setOpeningEdit(false);
  };
  const saveClosing = () => {
    const updated = Object.assign({}, cashDrawer);
    updated[date] = Object.assign({}, entry, { closing: closing === "" ? null : Number(closing), note: note });
    setCashDrawer(updated);
  };
  const addExpense = () => {
    if (!expDesc.trim() || expAmount === "") return;
    setExpenses([{ id: uid(), date: date, amount: Number(expAmount) || 0, description: expDesc.trim(), createdAt: new Date().toISOString(), loggedBy: currentUser.name }].concat(expenses));
    setExpDesc(""); setExpAmount(""); setShowExpenseForm(false);
  };
  const removeExpense = (id) => setExpenses(expenses.filter((e) => e.id !== id));

  return (
    <div style={{ background: CARD, border: "1px solid " + LINE, borderRadius: 12, padding: 14, marginBottom: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 10 }}>
        <div style={{ fontWeight: 700, fontSize: 13 }}>Cash drawer · {fmtDate(date)}</div>
        <div style={{ fontSize: 12, color: MUTED }}>Revenue today: <strong style={{ color: INK }}>{peso(revenueToday)}</strong> (Cash {peso(cashToday)} · GCash {peso(gcashToday)} · Card {peso(cardToday)})</div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 10, marginBottom: 10 }}>
        <div>
          <div style={{ fontSize: 11, color: MUTED }}>Opening float (petty cash)</div>
          {!openingEdit ? (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ fontWeight: 700, fontSize: 14 }}>{peso(entry.opening)}</div>
              <span onClick={() => { setOpeningVal(String(entry.opening != null ? entry.opening : 0)); setOpeningEdit(true); }} style={{ fontSize: 11, color: MUTED, cursor: "pointer", textDecoration: "underline" }}>edit</span>
            </div>
          ) : (
            <div style={{ display: "flex", gap: 6 }}>
              <input type="number" style={Object.assign({}, inputStyle, { width: 90 })} value={openingVal} onChange={(e) => setOpeningVal(e.target.value)} />
              <Btn onClick={saveOpening}>Save</Btn>
            </div>
          )}
        </div>
        <div>
          <div style={{ fontSize: 11, color: MUTED }}>Expenses today</div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: RUST }}>{peso(expensesTotal)}</div>
            <span onClick={() => setShowExpenseForm(!showExpenseForm)} style={{ fontSize: 11, color: MUTED, cursor: "pointer", textDecoration: "underline" }}>add</span>
          </div>
        </div>
        <div>
          <div style={{ fontSize: 11, color: MUTED }}>Expected cash in drawer</div>
          <div style={{ fontWeight: 700, fontSize: 14 }}>{peso(expectedCash)}</div>
        </div>
        <div>
          <div style={{ fontSize: 11, color: MUTED }}>Closing count</div>
          <div style={{ display: "flex", gap: 6 }}>
            <input type="number" style={Object.assign({}, inputStyle, { width: 90 })} value={closing} onChange={(e) => setClosing(e.target.value)} />
            <Btn onClick={saveClosing}>Save</Btn>
          </div>
        </div>
      </div>

      {variance != null && (
        <div style={{ fontSize: 13, fontWeight: 700, color: variance === 0 ? SAGE : RUST, marginBottom: 8 }}>
          {variance === 0 ? "Drawer balances exactly." : variance > 0 ? "Over by " + peso(variance) : "Short by " + peso(Math.abs(variance))}
        </div>
      )}

      {showExpenseForm && (
        <div style={{ border: "1px solid " + LINE, borderRadius: 8, padding: 10, marginBottom: 10 }}>
          <input style={Object.assign({}, inputStyle, { marginBottom: 6 })} placeholder="Expense description (e.g. bought tissue, water refill)" value={expDesc} onChange={(e) => setExpDesc(e.target.value)} />
          <input type="number" style={Object.assign({}, inputStyle, { marginBottom: 8 })} placeholder="Amount" value={expAmount} onChange={(e) => setExpAmount(e.target.value)} />
          <div style={{ display: "flex", gap: 6 }}>
            <Btn style={{ flex: 1 }} onClick={() => setShowExpenseForm(false)}>Cancel</Btn>
            <Btn variant="primary" style={{ flex: 1 }} onClick={addExpense}>Save expense</Btn>
          </div>
        </div>
      )}

      {expensesToday.length > 0 && (
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 4 }}>Today's expenses</div>
          {expensesToday.map((e) => (
            <div key={e.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "3px 0" }}>
              <span>{e.description} <span style={{ color: MUTED }}>({e.loggedBy})</span></span>
              <span>{peso(e.amount)} <span onClick={() => removeExpense(e.id)} style={{ cursor: "pointer", color: MUTED, marginLeft: 8 }}>&times;</span></span>
            </div>
          ))}
        </div>
      )}

      <input style={inputStyle} placeholder="Reconciliation note (optional)" value={note} onChange={(e) => setNote(e.target.value)} onBlur={() => {
        const updated = Object.assign({}, cashDrawer);
        updated[date] = Object.assign({}, cashDrawer[date] || entry, { note: note });
        setCashDrawer(updated);
      }} />
    </div>
  );
}

/* ---------- Ticket edit modal: add/remove services, or add a custom charge ---------- */
function TicketEditModal({ ticket, catalog, staff, onSave, onClose }) {
  const [items, setItems] = useState(ticket.items.map((i) => Object.assign({ staffId: ticket.staffId, staffName: ticket.staffName }, i)));
  const [addCatalogId, setAddCatalogId] = useState("");
  const [addStaffId, setAddStaffId] = useState(ticket.staffId);
  const [customDesc, setCustomDesc] = useState("");
  const [customAmount, setCustomAmount] = useState("");

  const total = items.reduce((s, i) => s + i.price * i.qty, 0);

  const changeQty = (idx, delta) => {
    setItems((prev) => prev.map((it, i) => (i === idx ? Object.assign({}, it, { qty: it.qty + delta }) : it)).filter((it) => it.qty > 0));
  };
  const changeStaff = (idx, newStaffId) => {
    const staffMember = staff.find((s) => s.id === newStaffId);
    setItems((prev) => prev.map((it, i) => (i === idx ? Object.assign({}, it, { staffId: newStaffId, staffName: staffMember ? staffMember.name : "" }) : it)));
  };
  const removeAt = (idx) => setItems((prev) => prev.filter((_, i) => i !== idx));

  const addFromCatalog = () => {
    const def = catalog.find((c) => c.id === addCatalogId);
    if (!def) return;
    const staffMember = staff.find((s) => s.id === addStaffId);
    setItems((prev) => {
      const existing = prev.find((p) => p.catalogId === def.id && p.type === def.type && p.staffId === addStaffId);
      if (existing) return prev.map((p) => (p === existing ? Object.assign({}, p, { qty: p.qty + 1 }) : p));
      return prev.concat([{ catalogId: def.id, name: def.name, price: def.price, qty: 1, type: def.type, kind: null, packageId: null, staffId: addStaffId, staffName: staffMember ? staffMember.name : "" }]);
    });
  };

  const addCustom = () => {
    if (!customDesc.trim() || customAmount === "") return;
    const staffMember = staff.find((s) => s.id === addStaffId);
    setItems((prev) => prev.concat([{ catalogId: null, name: customDesc.trim(), price: Number(customAmount) || 0, qty: 1, type: "custom", kind: "custom", packageId: null, staffId: addStaffId, staffName: staffMember ? staffMember.name : "" }]));
    setCustomDesc("");
    setCustomAmount("");
  };

  return (
    <Modal title="Edit ticket" onClose={onClose} wide>
      <div style={{ maxHeight: 260, overflowY: "auto", marginBottom: 12 }}>
        {items.map((i, idx) => {
          const meta = TYPE_META[i.type] || TYPE_META.service;
          return (
            <div key={idx} style={{ padding: "8px 0", borderBottom: "1px solid " + LINE }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{i.name} <span style={{ fontSize: 11, color: meta.color }}>{meta.label}</span></div>
                  <div style={{ fontSize: 12, color: MUTED }}>{peso(i.price)} each</div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span onClick={() => changeQty(idx, -1)} style={{ cursor: "pointer", width: 22, textAlign: "center", border: "1px solid " + LINE, borderRadius: 6 }}>-</span>
                  <span style={{ minWidth: 16, textAlign: "center", fontSize: 13 }}>{i.qty}</span>
                  <span onClick={() => changeQty(idx, 1)} style={{ cursor: "pointer", width: 22, textAlign: "center", border: "1px solid " + LINE, borderRadius: 6 }}>+</span>
                  <span onClick={() => removeAt(idx)} style={{ cursor: "pointer", color: RUST, marginLeft: 6 }}>&times;</span>
                </div>
              </div>
              {i.type === "service" && (
                <select style={Object.assign({}, inputStyle, { marginTop: 4, padding: "5px 8px", fontSize: 12 })} value={i.staffId || ""} onChange={(e) => changeStaff(idx, e.target.value)}>
                  {staff.filter((s) => s.active !== false).map((s) => (<option key={s.id} value={s.id}>{s.name}</option>))}
                </select>
              )}
            </div>
          );
        })}
        {items.length === 0 && <div style={{ fontSize: 13, color: MUTED }}>No items on this ticket.</div>}
      </div>

      <Field label="Staff for new items">
        <select style={inputStyle} value={addStaffId} onChange={(e) => setAddStaffId(e.target.value)}>
          {staff.filter((s) => s.active !== false).map((s) => (<option key={s.id} value={s.id}>{s.name}</option>))}
        </select>
      </Field>

      <Field label="Add existing item from catalog">
        <div style={{ display: "flex", gap: 8 }}>
          <select style={inputStyle} value={addCatalogId} onChange={(e) => setAddCatalogId(e.target.value)}>
            <option value="">Select an item</option>
            {catalog.map((c) => (<option key={c.id} value={c.id}>{c.name} — {priceLabel(c)}</option>))}
          </select>
          <Btn onClick={addFromCatalog}>Add</Btn>
        </div>
      </Field>

      <Field label="Add a custom charge" hint="For extra work, add-ons, or price adjustments not on the catalog.">
        <div style={{ display: "flex", gap: 8 }}>
          <input style={inputStyle} placeholder="Description" value={customDesc} onChange={(e) => setCustomDesc(e.target.value)} />
          <input type="number" style={Object.assign({}, inputStyle, { width: 110 })} placeholder="Amount" value={customAmount} onChange={(e) => setCustomAmount(e.target.value)} />
          <Btn onClick={addCustom}>Add</Btn>
        </div>
      </Field>

      <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 800, fontSize: 16, margin: "14px 0" }}>
        <span>New total</span><span>{peso(total)}</span>
      </div>
      <Btn variant="primary" style={{ width: "100%" }} onClick={() => onSave(items, total)}>Save ticket</Btn>
    </Modal>
  );
}

/* ---------- POS Tab ---------- */
function POSTab(props) {
  const { catalog, setCatalog, customers, setCustomers, staff, sales, setSales, tickets, setTickets, customerPackages, setCustomerPackages, cashDrawer, setCashDrawer, expenses, setExpenses, settings, setSettings, currentUser, lowStockThreshold } = props;
  const [cart, setCart] = useState([]);
  const [category, setCategory] = useState("All");
  const [customerId, setCustomerId] = useState("");
  const [assignedStaffId, setAssignedStaffId] = useState(currentUser.id);
  const [payment, setPayment] = useState("Cash");
  const [splitMode, setSplitMode] = useState(false);
  const [splitPayments, setSplitPayments] = useState([{ id: uid(), method: "Cash", amount: "" }, { id: uid(), method: "GCash", amount: "" }]);
  const [discountType, setDiscountType] = useState("none");
  const [discountValue, setDiscountValue] = useState("");
  const [discountReason, setDiscountReason] = useState("");
  const [amountTendered, setAmountTendered] = useState("");
  const [receipt, setReceipt] = useState(null);
  const [ticketCheckout, setTicketCheckout] = useState(null);
  const [ticketPayment, setTicketPayment] = useState("Cash");
  const [ticketSplitMode, setTicketSplitMode] = useState(false);
  const [ticketSplitPayments, setTicketSplitPayments] = useState([{ id: uid(), method: "Cash", amount: "" }, { id: uid(), method: "GCash", amount: "" }]);
  const [ticketDiscountType, setTicketDiscountType] = useState("none");
  const [ticketDiscountValue, setTicketDiscountValue] = useState("");
  const [ticketDiscountReason, setTicketDiscountReason] = useState("");
  const [ticketTendered, setTicketTendered] = useState("");
  const [editingTicket, setEditingTicket] = useState(null);
  const [confirmCancelId, setConfirmCancelId] = useState(null);
  const [search, setSearch] = useState("");

  const categories = useMemo(() => ["All"].concat(Array.from(new Set(catalog.map((c) => c.category)))), [catalog]);
  const byCategory = category === "All" ? catalog : catalog.filter((c) => c.category === category);
  const filtered = search.trim() ? byCategory.filter((c) => c.name.toLowerCase().indexOf(search.trim().toLowerCase()) !== -1) : byCategory;

  const addToCart = (item) => {
    const staffMember = staff.find((s) => s.id === assignedStaffId);
    const staffName = staffMember ? staffMember.name : "";
    const catalogId = item.catalogId !== undefined ? item.catalogId : item.id;
    const mergeKey = catalogId + "|" + (item.kind || "") + "|" + (item.packageId || "");
    setCart((prev) => {
      const existing = prev.find((p) => p.mergeKey === mergeKey && p.staffId === assignedStaffId);
      if (existing) return prev.map((p) => (p === existing ? Object.assign({}, p, { qty: p.qty + 1 }) : p));
      return prev.concat([{
        lineId: uid(), mergeKey, catalogId, name: item.name, price: item.price, type: item.type,
        kind: item.kind || null, packageId: item.packageId || null, qty: 1,
        staffId: assignedStaffId, staffName: staffName,
      }]);
    });
  };
  const changeQty = (lineId, delta) => setCart((prev) => prev.map((p) => (p.lineId === lineId ? Object.assign({}, p, { qty: p.qty + delta }) : p)).filter((p) => p.qty > 0));
  const changeItemStaff = (lineId, newStaffId) => {
    const staffMember = staff.find((s) => s.id === newStaffId);
    setCart((prev) => prev.map((p) => (p.lineId === lineId ? Object.assign({}, p, { staffId: newStaffId, staffName: staffMember ? staffMember.name : "" }) : p)));
  };

  const subtotal = cart.reduce((s, i) => s + i.price * i.qty, 0);
  const hasService = cart.some((i) => i.type === "service");
  const cartHasPackage = cart.some((i) => i.type === "package");
  const blockedNoCustomer = cartHasPackage && !customerId;

  const discountAmount = computeDiscountAmount(subtotal, discountType, discountValue);
  const finalTotal = Math.max(0, subtotal - discountAmount);
  const tenderedNum = payment === "Cash" && amountTendered !== "" ? Number(amountTendered) : null;
  const changeDue = tenderedNum != null ? tenderedNum - finalTotal : null;
  const splitTotal = splitPayments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
  const splitRemaining = Math.round((finalTotal - splitTotal) * 100) / 100;
  const splitValid = splitMode ? Math.abs(splitRemaining) < 0.01 && splitPayments.some((p) => Number(p.amount) > 0) : true;

  const resetCartInputs = () => {
    setCart([]); setCustomerId(""); setPayment("Cash");
    setSplitMode(false); setSplitPayments([{ id: uid(), method: "Cash", amount: "" }, { id: uid(), method: "GCash", amount: "" }]);
    setDiscountType("none"); setDiscountValue(""); setDiscountReason(""); setAmountTendered("");
  };

  const deductStock = (items) => {
    setCatalog(catalog.map((c) => {
      const soldItem = items.find((i) => i.catalogId === c.id && i.type === "product");
      if (soldItem && typeof c.stock === "number") return Object.assign({}, c, { stock: Math.max(0, c.stock - soldItem.qty) });
      return c;
    }));
  };

  const applyPackageEffects = (items, sale, customer) => {
    const newRecords = [];
    items.forEach((item) => {
      if (item.type === "package" && item.catalogId) {
        const def = catalog.find((c) => c.id === item.catalogId);
        if (def) {
          const linkedService = catalog.find((c) => c.id === def.linkedServiceId);
          newRecords.push({
            id: uid(), customerId: customer ? customer.id : null, customerName: customer ? customer.name : "Walk-in",
            packageCatalogId: def.id, packageName: def.name, serviceId: def.linkedServiceId || null,
            serviceName: linkedService ? linkedService.name : def.name,
            sessionsTotal: (Number(def.sessionsIncluded) || 0) * item.qty, sessionsRemaining: (Number(def.sessionsIncluded) || 0) * item.qty,
            purchasedAt: new Date().toISOString(), saleId: sale.id,
          });
        }
      }
    });
    let updated = newRecords.length ? newRecords.concat(customerPackages) : customerPackages;
    let changed = newRecords.length > 0;
    updated = updated.map((p) => {
      const redeemed = items.find((i) => i.kind === "redemption" && i.packageId === p.id);
      if (redeemed) { changed = true; return Object.assign({}, p, { sessionsRemaining: Math.max(0, p.sessionsRemaining - redeemed.qty) }); }
      return p;
    });
    if (changed) setCustomerPackages(updated);
  };

  const finalizeSale = (args) => {
    const items = args.items, subtotalV = args.subtotal, discountTypeV = args.discountType, discountValueV = args.discountValue, discountReasonV = args.discountReason, discountAmountV = args.discountAmount, total = args.total, paymentMethod = args.paymentMethod, paymentSplitsV = args.paymentSplits || null, amountTenderedV = args.amountTendered, changeDueV = args.changeDue, staffMember = args.staffMember, customer = args.customer, sourceTicketId = args.sourceTicketId;
    const orNumber = (settings.nextOrNumber != null ? settings.nextOrNumber : 1);
    const sale = {
      id: uid(), orNumber: orNumber, date: new Date().toISOString(), items: items, subtotal: subtotalV,
      discountType: discountTypeV, discountValue: discountTypeV === "none" ? null : Number(discountValueV) || 0, discountReason: discountReasonV || "", discountAmount: discountAmountV,
      total: total, paymentMethod: paymentMethod, paymentSplits: paymentSplitsV, amountTendered: amountTenderedV != null ? amountTenderedV : null, changeDue: changeDueV != null ? changeDueV : null,
      staffId: staffMember.id, staffName: staffMember.name,
      processedById: currentUser.id, processedBy: currentUser.name,
      customerId: customer ? customer.id : null, customerName: customer ? customer.name : "Walk-in",
      voided: false, voidedAt: null,
    };
    setSales([sale].concat(sales));
    setSettings(Object.assign({}, settings, { nextOrNumber: orNumber + 1 }));
    deductStock(items);
    applyPackageEffects(items, sale, customer);
    if (sourceTicketId) setTickets(tickets.filter((t) => t.id !== sourceTicketId));
    setReceipt(sale);
  };

  const chargeNow = () => {
    if (cart.length === 0 || blockedNoCustomer || (splitMode && !splitValid)) return;
    const staffMember = staff.find((s) => s.id === assignedStaffId) || currentUser;
    const customer = customers.find((c) => c.id === customerId);
    finalizeSale({
      items: cart.map((i) => ({ catalogId: i.catalogId, name: i.name, price: i.price, qty: i.qty, type: i.type, kind: i.kind || null, packageId: i.packageId || null, staffId: i.staffId, staffName: i.staffName })),
      subtotal: subtotal, discountType: discountType, discountValue: discountValue, discountReason: discountReason, discountAmount: discountAmount, total: finalTotal,
      paymentMethod: splitMode ? "Split" : payment,
      paymentSplits: splitMode ? splitPayments.filter((p) => Number(p.amount) > 0).map((p) => ({ method: p.method, amount: Number(p.amount) })) : null,
      amountTendered: splitMode ? null : tenderedNum, changeDue: splitMode ? null : changeDue,
      staffMember: staffMember, customer: customer,
    });
    resetCartInputs();
  };

  const sendToQueue = () => {
    if (cart.length === 0 || blockedNoCustomer) return;
    const staffMember = staff.find((s) => s.id === assignedStaffId) || currentUser;
    const customer = customers.find((c) => c.id === customerId);
    const ticket = {
      id: uid(), createdAt: new Date().toISOString(),
      items: cart.map((i) => ({ catalogId: i.catalogId, name: i.name, price: i.price, qty: i.qty, type: i.type, kind: i.kind || null, packageId: i.packageId || null, staffId: i.staffId, staffName: i.staffName })),
      total: subtotal, staffId: staffMember.id, staffName: staffMember.name,
      customerId: customer ? customer.id : null, customerName: customer ? customer.name : "Walk-in", status: "pending",
    };
    setTickets([ticket].concat(tickets));
    resetCartInputs();
  };

  const redeemPackageSession = (pkg) => {
    addToCart({ id: "redeem-" + pkg.id, catalogId: null, name: pkg.serviceName + " (package redemption)", price: 0, type: "service", kind: "redemption", packageId: pkg.id, category: null });
  };

  const advanceTicket = (id) => setTickets(tickets.map((t) => {
    if (t.id !== id) return t;
    const next = TICKET_STATUS[t.status] ? TICKET_STATUS[t.status].next : null;
    return next ? Object.assign({}, t, { status: next }) : t;
  }));
  const doCancelTicket = (id) => { setTickets(tickets.filter((t) => t.id !== id)); setConfirmCancelId(null); };

  const saveTicketEdit = (items, total) => {
    setTickets(tickets.map((t) => (t.id === editingTicket.id ? Object.assign({}, t, { items: items, total: total }) : t)));
    setEditingTicket(null);
  };

  const openTicketCheckout = (t) => {
    setTicketCheckout(t); setTicketPayment("Cash");
    setTicketSplitMode(false); setTicketSplitPayments([{ id: uid(), method: "Cash", amount: "" }, { id: uid(), method: "GCash", amount: "" }]);
    setTicketDiscountType("none"); setTicketDiscountValue(""); setTicketDiscountReason(""); setTicketTendered("");
  };

  const ticketSubtotal = ticketCheckout ? ticketCheckout.total : 0;
  const ticketDiscountAmount = ticketCheckout ? computeDiscountAmount(ticketSubtotal, ticketDiscountType, ticketDiscountValue) : 0;
  const ticketFinalTotal = Math.max(0, ticketSubtotal - ticketDiscountAmount);
  const ticketTenderedNum = ticketPayment === "Cash" && ticketTendered !== "" ? Number(ticketTendered) : null;
  const ticketChangeDue = ticketTenderedNum != null ? ticketTenderedNum - ticketFinalTotal : null;
  const ticketSplitTotal = ticketSplitPayments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
  const ticketSplitRemaining = Math.round((ticketFinalTotal - ticketSplitTotal) * 100) / 100;
  const ticketSplitValid = ticketSplitMode ? Math.abs(ticketSplitRemaining) < 0.01 && ticketSplitPayments.some((p) => Number(p.amount) > 0) : true;

  const confirmTicketCheckout = () => {
    if (ticketSplitMode && !ticketSplitValid) return;
    const staffMember = staff.find((s) => s.id === ticketCheckout.staffId) || { id: ticketCheckout.staffId, name: ticketCheckout.staffName };
    const customer = ticketCheckout.customerId ? { id: ticketCheckout.customerId, name: ticketCheckout.customerName } : null;
    finalizeSale({
      items: ticketCheckout.items, subtotal: ticketSubtotal, discountType: ticketDiscountType, discountValue: ticketDiscountValue, discountReason: ticketDiscountReason, discountAmount: ticketDiscountAmount,
      total: ticketFinalTotal,
      paymentMethod: ticketSplitMode ? "Split" : ticketPayment,
      paymentSplits: ticketSplitMode ? ticketSplitPayments.filter((p) => Number(p.amount) > 0).map((p) => ({ method: p.method, amount: Number(p.amount) })) : null,
      amountTendered: ticketSplitMode ? null : ticketTenderedNum, changeDue: ticketSplitMode ? null : ticketChangeDue,
      staffMember: staffMember, customer: customer, sourceTicketId: ticketCheckout.id,
    });
    setTicketCheckout(null);
  };

  const openTickets = tickets.slice().sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  const activePackagesForCustomer = customerId ? customerPackages.filter((p) => p.customerId === customerId && p.sessionsRemaining > 0) : [];

  return (
    <div>
      <CashDrawerCard cashDrawer={cashDrawer} setCashDrawer={setCashDrawer} sales={sales} expenses={expenses} setExpenses={setExpenses} currentUser={currentUser} />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 20 }}>
        <div>
          <input style={Object.assign({}, inputStyle, { marginBottom: 10 })} placeholder="Search services, products, packages..." value={search} onChange={(e) => setSearch(e.target.value)} />
          <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
            {categories.map((cat) => (
              <span key={cat} onClick={() => setCategory(cat)} style={{ padding: "6px 14px", borderRadius: 20, fontSize: 13, fontWeight: 600, cursor: "pointer", background: category === cat ? WINE : "#fff", color: category === cat ? "#fff" : INK, border: "1px solid " + (category === cat ? WINE : LINE) }}>
                {cat}
              </span>
            ))}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px,1fr))", gap: 10 }}>
            {filtered.map((item) => {
              const meta = TYPE_META[item.type] || TYPE_META.service;
              return (
                <div key={item.id} onClick={() => addToCart(item)} style={{ background: CARD, border: "1px solid " + LINE, borderRadius: 12, padding: 12, cursor: "pointer" }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: meta.color, marginBottom: 4 }}>{meta.label}</div>
                  <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 6, minHeight: 34 }}>{item.name}</div>
                  <div style={{ fontWeight: 800, color: WINE_DARK }}>{priceLabel(item)}</div>
                  {typeof item.stock === "number" && (
                    <div style={{ fontSize: 11, color: item.stock <= effectiveThreshold(item, lowStockThreshold) ? RUST : MUTED, marginTop: 4 }}>{item.stock} in stock</div>
                  )}
                  {item.type === "package" && <div style={{ fontSize: 11, color: MUTED, marginTop: 4 }}>{item.sessionsIncluded} sessions</div>}
                </div>
              );
            })}
            {filtered.length === 0 && <div style={{ color: MUTED, fontSize: 13 }}>No items in this category yet.</div>}
          </div>

          <div style={{ marginTop: 26 }}>
            <div style={{ fontWeight: 800, marginBottom: 10 }}>Order tickets</div>
            {openTickets.length === 0 && <div style={{ color: MUTED, fontSize: 13 }}>No open tickets. Sales with a service go here while work is in progress.</div>}
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {openTickets.map((t) => {
                const meta = TICKET_STATUS[t.status];
                return (
                  <div key={t.id} style={{ background: CARD, border: "1px solid " + LINE, borderRadius: 12, padding: 12, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>{t.customerName} <Badge text={meta.label} color={meta.color} /></div>
                      <div style={{ fontSize: 12, color: MUTED }}>{t.items.map((i) => i.qty + "× " + i.name + (i.staffName ? " (" + i.staffName + ")" : "")).join(", ")}</div>
                      <div style={{ fontSize: 12, color: MUTED }}>{peso(t.total)}</div>
                    </div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <Btn onClick={() => setEditingTicket(t)}>Edit</Btn>
                      {meta.next && <Btn onClick={() => advanceTicket(t.id)}>{meta.nextLabel}</Btn>}
                      {t.status === "ready" && <Btn variant="primary" onClick={() => openTicketCheckout(t)}>Checkout</Btn>}
                      <Btn variant="danger" onClick={() => setConfirmCancelId(t.id)}>Cancel</Btn>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div style={{ background: CARD, border: "1px solid " + LINE, borderRadius: 14, padding: 16, height: "fit-content" }}>
          <div style={{ fontWeight: 800, marginBottom: 10 }}>Current sale</div>
          {cart.length === 0 && <div style={{ color: MUTED, fontSize: 13 }}>Tap items to add them here.</div>}
          <div style={{ maxHeight: 220, overflowY: "auto" }}>
            {cart.map((i) => (
              <div key={i.lineId} style={{ padding: "8px 0", borderBottom: "1px solid " + LINE }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{i.name}</div>
                    <div style={{ fontSize: 12, color: MUTED }}>{peso(i.price)} each</div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span onClick={() => changeQty(i.lineId, -1)} style={{ cursor: "pointer", width: 22, textAlign: "center", border: "1px solid " + LINE, borderRadius: 6 }}>-</span>
                    <span style={{ minWidth: 16, textAlign: "center", fontSize: 13 }}>{i.qty}</span>
                    <span onClick={() => changeQty(i.lineId, 1)} style={{ cursor: "pointer", width: 22, textAlign: "center", border: "1px solid " + LINE, borderRadius: 6 }}>+</span>
                  </div>
                </div>
                {i.type === "service" && (
                  <select style={Object.assign({}, inputStyle, { marginTop: 4, padding: "5px 8px", fontSize: 12 })} value={i.staffId} onChange={(e) => changeItemStaff(i.lineId, e.target.value)}>
                    {staff.filter((s) => s.active !== false).map((s) => (<option key={s.id} value={s.id}>{s.name}</option>))}
                  </select>
                )}
              </div>
            ))}
          </div>

          <CustomerPicker customers={customers} setCustomers={setCustomers} customerId={customerId} setCustomerId={setCustomerId} />

          {activePackagesForCustomer.length > 0 && (
            <div style={{ background: BG, borderRadius: 10, padding: 10, marginBottom: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>Active packages</div>
              {activePackagesForCustomer.map((p) => (
                <div key={p.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12, padding: "4px 0" }}>
                  <span>{p.serviceName} · {p.sessionsRemaining}/{p.sessionsTotal} left</span>
                  <Btn onClick={() => redeemPackageSession(p)} style={{ padding: "4px 10px", fontSize: 12 }}>Redeem 1</Btn>
                </div>
              ))}
            </div>
          )}

          <Field label="Default staff for new items" hint="Applied to items as you add them. Change the staff on any line above individually if more than one person is doing the work.">
            <select style={inputStyle} value={assignedStaffId} onChange={(e) => setAssignedStaffId(e.target.value)}>
              {staff.filter((s) => s.active !== false).map((s) => (<option key={s.id} value={s.id}>{s.name}</option>))}
            </select>
          </Field>

          {!hasService && (
            <div>
              <Field label="Payment method">
                <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: MUTED, marginBottom: 6 }}>
                  <input type="checkbox" checked={splitMode} onChange={(e) => setSplitMode(e.target.checked)} />
                  Split across multiple payment methods
                </label>
                {!splitMode && (
                  <select style={inputStyle} value={payment} onChange={(e) => setPayment(e.target.value)}>
                    <option>Cash</option><option>GCash</option><option>Card</option>
                  </select>
                )}
              </Field>
              {splitMode && <SplitPaymentEditor payments={splitPayments} setPayments={setSplitPayments} total={finalTotal} />}
              <DiscountPicker discountType={discountType} setDiscountType={setDiscountType} discountValue={discountValue} setDiscountValue={setDiscountValue} discountReason={discountReason} setDiscountReason={setDiscountReason} />
              {discountAmount > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: SAGE, marginBottom: 6 }}><span>Discount</span><span>-{peso(discountAmount)}</span></div>
              )}
              {!splitMode && payment === "Cash" && (
                <Field label="Amount tendered (optional)">
                  <input type="number" style={inputStyle} value={amountTendered} onChange={(e) => setAmountTendered(e.target.value)} placeholder={peso(finalTotal)} />
                </Field>
              )}
              {!splitMode && changeDue != null && (
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 700, color: changeDue < 0 ? RUST : SAGE, marginBottom: 6 }}>
                  <span>{changeDue < 0 ? "Short by" : "Change due"}</span><span>{peso(Math.abs(changeDue))}</span>
                </div>
              )}
            </div>
          )}

          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: MUTED, marginTop: 8 }}><span>Subtotal</span><span>{peso(subtotal)}</span></div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 16, fontWeight: 800, margin: "4px 0 12px" }}>
            <span>Total</span><span style={{ color: WINE_DARK }}>{peso(hasService ? subtotal : finalTotal)}</span>
          </div>

          {blockedNoCustomer && <div style={{ fontSize: 12, color: RUST, marginBottom: 8 }}>Select a customer to sell a package.</div>}

          {hasService ? (
            <div>
              <Btn variant="primary" style={{ width: "100%" }} onClick={sendToQueue} disabled={cart.length === 0 || blockedNoCustomer}>Send to service queue</Btn>
              <div style={{ fontSize: 11, color: MUTED, marginTop: 6 }}>This sale includes a service — it'll wait as a ticket until the work is done, then you can check out with discount and payment options.</div>
            </div>
          ) : (
            <Btn variant="primary" style={{ width: "100%" }} onClick={chargeNow} disabled={cart.length === 0 || blockedNoCustomer || (splitMode && !splitValid)}>Charge now</Btn>
          )}
        </div>

        {receipt && (
          <Modal title="Sale complete" onClose={() => setReceipt(null)}>
            <div style={{ fontSize: 13, color: MUTED, marginBottom: 8 }}>OR #{receipt.orNumber} · {new Date(receipt.date).toLocaleString("en-PH")}</div>
            {receipt.items.map((i, idx) => (
              <div key={idx} style={{ display: "flex", justifyContent: "space-between", fontSize: 14, padding: "4px 0" }}>
                <span>{i.qty} × {i.name}{i.staffName ? <span style={{ color: MUTED, fontSize: 12 }}> — {i.staffName}</span> : null}</span>
                <span>{peso(i.price * i.qty)}</span>
              </div>
            ))}
            <div style={{ borderTop: "1px solid " + LINE, marginTop: 8, paddingTop: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: MUTED }}><span>Subtotal</span><span>{peso(receipt.subtotal)}</span></div>
              {receipt.discountAmount > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: SAGE }}><span>Discount{receipt.discountReason ? " (" + receipt.discountReason + ")" : ""}</span><span>-{peso(receipt.discountAmount)}</span></div>
              )}
              <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 800 }}><span>Total</span><span>{peso(receipt.total)}</span></div>
              {receipt.amountTendered != null && (
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: MUTED }}><span>Tendered</span><span>{peso(receipt.amountTendered)}</span></div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: MUTED }}><span>Change</span><span>{peso(receipt.changeDue)}</span></div>
                </div>
              )}
              {receipt.paymentSplits && (
                <div style={{ marginTop: 4 }}>
                  {receipt.paymentSplits.map((p, idx) => (
                    <div key={idx} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: MUTED }}><span>{p.method}</span><span>{peso(p.amount)}</span></div>
                  ))}
                </div>
              )}
            </div>
            <div style={{ fontSize: 12, color: MUTED, marginTop: 8 }}>Paid via {receipt.paymentMethod} · Customer: {receipt.customerName} · Encoded by {receipt.processedBy}</div>
            <Btn variant="primary" style={{ width: "100%", marginTop: 14 }} onClick={() => setReceipt(null)}>Done</Btn>
          </Modal>
        )}

        {ticketCheckout && (
          <Modal title="Checkout ticket" onClose={() => setTicketCheckout(null)}>
            <div style={{ fontSize: 13, color: MUTED, marginBottom: 8 }}>{ticketCheckout.customerName}</div>
            {ticketCheckout.items.map((i, idx) => (
              <div key={idx} style={{ display: "flex", justifyContent: "space-between", fontSize: 14, padding: "4px 0" }}>
                <span>{i.qty} × {i.name}{i.staffName ? <span style={{ color: MUTED, fontSize: 12 }}> — {i.staffName}</span> : null}</span>
                <span>{peso(i.price * i.qty)}</span>
              </div>
            ))}
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: MUTED, borderTop: "1px solid " + LINE, marginTop: 8, paddingTop: 8 }}><span>Subtotal</span><span>{peso(ticketSubtotal)}</span></div>
            <Field label="Payment method">
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: MUTED, marginBottom: 6 }}>
                <input type="checkbox" checked={ticketSplitMode} onChange={(e) => setTicketSplitMode(e.target.checked)} />
                Split across multiple payment methods
              </label>
              {!ticketSplitMode && (
                <select style={inputStyle} value={ticketPayment} onChange={(e) => setTicketPayment(e.target.value)}>
                  <option>Cash</option><option>GCash</option><option>Card</option>
                </select>
              )}
            </Field>
            {ticketSplitMode && <SplitPaymentEditor payments={ticketSplitPayments} setPayments={setTicketSplitPayments} total={ticketFinalTotal} />}
            <DiscountPicker discountType={ticketDiscountType} setDiscountType={setTicketDiscountType} discountValue={ticketDiscountValue} setDiscountValue={setTicketDiscountValue} discountReason={ticketDiscountReason} setDiscountReason={setTicketDiscountReason} />
            {ticketDiscountAmount > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: SAGE, marginBottom: 6 }}><span>Discount</span><span>-{peso(ticketDiscountAmount)}</span></div>
            )}
            {!ticketSplitMode && ticketPayment === "Cash" && (
              <Field label="Amount tendered (optional)">
                <input type="number" style={inputStyle} value={ticketTendered} onChange={(e) => setTicketTendered(e.target.value)} placeholder={peso(ticketFinalTotal)} />
              </Field>
            )}
            {!ticketSplitMode && ticketChangeDue != null && (
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 700, color: ticketChangeDue < 0 ? RUST : SAGE, marginBottom: 6 }}>
                <span>{ticketChangeDue < 0 ? "Short by" : "Change due"}</span><span>{peso(Math.abs(ticketChangeDue))}</span>
              </div>
            )}
            <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 800, marginBottom: 12 }}><span>Total</span><span>{peso(ticketFinalTotal)}</span></div>
            <Btn variant="primary" style={{ width: "100%" }} onClick={confirmTicketCheckout} disabled={ticketSplitMode && !ticketSplitValid}>Complete payment</Btn>
          </Modal>
        )}

        {editingTicket && <TicketEditModal ticket={editingTicket} catalog={catalog} staff={staff} onSave={saveTicketEdit} onClose={() => setEditingTicket(null)} />}

        {confirmCancelId && (
          <ConfirmModal title="Cancel this ticket?" body="The customer won't be charged and this ticket will be removed from the queue." confirmLabel="Cancel ticket" onConfirm={() => doCancelTicket(confirmCancelId)} onClose={() => setConfirmCancelId(null)} />
        )}
      </div>
    </div>
  );
}

/* ---------- Bookings Tab ---------- */
function startOfWeekDate(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(d); monday.setDate(d.getDate() + diff);
  return monday;
}
function weekDaysFrom(dateStr) {
  const monday = startOfWeekDate(dateStr);
  const days = [];
  for (let i = 0; i < 7; i++) { const d = new Date(monday); d.setDate(monday.getDate() + i); days.push(isoDay(d)); }
  return days;
}

function BookingsTab({ appointments, setAppointments, customers, setCustomers, catalog, staff, tickets, setTickets }) {
  const [date, setDate] = useState(todayStr());
  const [viewMode, setViewMode] = useState("day");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ customerName: "", customerPhone: "", serviceId: "", staffId: "", time: "10:00", notes: "" });

  const services = catalog.filter((c) => c.type === "service");
  const dayAppointments = appointments.filter((a) => a.date === date).sort((a, b) => a.time.localeCompare(b.time));
  const week = weekDaysFrom(date);

  const submit = () => {
    if (!form.customerName || !form.serviceId || !form.staffId) return;
    let customer = customers.find((c) => c.name.toLowerCase() === form.customerName.toLowerCase());
    let updatedCustomers = customers;
    if (!customer) {
      customer = { id: uid(), name: form.customerName, phone: form.customerPhone, email: "", address: "", birthday: "", notes: "", createdAt: new Date().toISOString() };
      updatedCustomers = [customer].concat(customers);
      setCustomers(updatedCustomers);
    }
    const service = services.find((s) => s.id === form.serviceId);
    const staffMember = staff.find((s) => s.id === form.staffId);
    const appt = { id: uid(), date: date, time: form.time, customerId: customer.id, customerName: customer.name, serviceId: service.id, serviceName: service.name, staffId: staffMember.id, staffName: staffMember.name, status: "booked", notes: form.notes };
    setAppointments([appt].concat(appointments));
    setShowForm(false);
    setForm({ customerName: "", customerPhone: "", serviceId: "", staffId: "", time: "10:00", notes: "" });
  };

  const setStatus = (id, status) => setAppointments(appointments.map((a) => (a.id === id ? Object.assign({}, a, { status: status }) : a)));
  const statusColor = { booked: GOLD, in_service: WINE, completed: SAGE, cancelled: RUST };

  const startService = (a) => {
    const def = catalog.find((c) => c.id === a.serviceId);
    const price = def ? def.price : 0;
    const ticket = {
      id: uid(), createdAt: new Date().toISOString(),
      items: [{ catalogId: a.serviceId, name: a.serviceName, price: price, qty: 1, type: "service", kind: null, packageId: null }],
      total: price, staffId: a.staffId, staffName: a.staffName,
      customerId: a.customerId, customerName: a.customerName, status: "pending",
    };
    setTickets([ticket].concat(tickets));
    setStatus(a.id, "in_service");
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 10 }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={Object.assign({}, inputStyle, { width: 180 })} />
          <Btn onClick={() => setViewMode(viewMode === "day" ? "week" : "day")}>{viewMode === "day" ? "Week view" : "Day view"}</Btn>
        </div>
        <Btn variant="primary" onClick={() => setShowForm(true)}>+ New booking</Btn>
      </div>

      {viewMode === "week" ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 8, marginBottom: 14 }}>
          {week.map((d) => {
            const dayAppts = appointments.filter((a) => a.date === d).sort((a, b) => a.time.localeCompare(b.time));
            return (
              <div key={d} onClick={() => { setDate(d); setViewMode("day"); }} style={{ background: CARD, border: "1px solid " + (d === todayStr() ? GOLD : LINE), borderRadius: 10, padding: 8, cursor: "pointer", minHeight: 100 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: MUTED }}>{fmtDate(d)}</div>
                <div style={{ fontSize: 12, fontWeight: 700, marginTop: 4 }}>{dayAppts.length} booking{dayAppts.length === 1 ? "" : "s"}</div>
                {dayAppts.slice(0, 3).map((a) => (<div key={a.id} style={{ fontSize: 11, color: MUTED, marginTop: 2 }}>{a.time} {a.customerName}</div>))}
                {dayAppts.length > 3 && <div style={{ fontSize: 11, color: MUTED, marginTop: 2 }}>+{dayAppts.length - 3} more</div>}
              </div>
            );
          })}
        </div>
      ) : (
        <div>
          <div style={{ fontSize: 13, color: MUTED, marginBottom: 10 }}>{fmtDate(date)}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {dayAppointments.length === 0 && <div style={{ color: MUTED, fontSize: 13 }}>No bookings for this day.</div>}
            {dayAppointments.map((a) => (
              <div key={a.id} style={{ background: CARD, border: "1px solid " + LINE, borderRadius: 12, padding: 14, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{a.time} · {a.customerName}</div>
                  <div style={{ fontSize: 13, color: MUTED }}>{a.serviceName} with {a.staffName}</div>
                  {a.notes && <div style={{ fontSize: 12, color: MUTED }}>{a.notes}</div>}
                  {a.status === "in_service" && <div style={{ fontSize: 12, color: MUTED }}>Being handled on the POS ticket queue.</div>}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Badge text={a.status === "in_service" ? "In service" : a.status} color={statusColor[a.status]} />
                  {a.status === "booked" && (
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <Btn variant="primary" onClick={() => startService(a)}>Start service</Btn>
                      <Btn onClick={() => setStatus(a.id, "completed")}>Mark done</Btn>
                      <Btn variant="danger" onClick={() => setStatus(a.id, "cancelled")}>Cancel</Btn>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {showForm && (
        <Modal title="New booking" onClose={() => setShowForm(false)}>
          <Field label="Customer name"><input style={inputStyle} value={form.customerName} onChange={(e) => setForm(Object.assign({}, form, { customerName: e.target.value }))} placeholder="Juana Dela Cruz" /></Field>
          <Field label="Mobile number (optional)"><input style={inputStyle} value={form.customerPhone} onChange={(e) => setForm(Object.assign({}, form, { customerPhone: e.target.value }))} placeholder="09xx xxx xxxx" /></Field>
          <Field label="Service">
            <select style={inputStyle} value={form.serviceId} onChange={(e) => setForm(Object.assign({}, form, { serviceId: e.target.value }))}>
              <option value="">Select a service</option>
              {services.map((s) => (<option key={s.id} value={s.id}>{s.name} — {priceLabel(s)}</option>))}
            </select>
          </Field>
          <Field label="Staff">
            <select style={inputStyle} value={form.staffId} onChange={(e) => setForm(Object.assign({}, form, { staffId: e.target.value }))}>
              <option value="">Assign staff</option>
              {staff.filter((s) => s.active !== false).map((s) => (<option key={s.id} value={s.id}>{s.name}</option>))}
            </select>
          </Field>
          <Field label="Time"><input type="time" style={inputStyle} value={form.time} onChange={(e) => setForm(Object.assign({}, form, { time: e.target.value }))} /></Field>
          <Field label="Notes (optional)"><input style={inputStyle} value={form.notes} onChange={(e) => setForm(Object.assign({}, form, { notes: e.target.value }))} /></Field>
          <Btn variant="primary" style={{ width: "100%" }} onClick={submit}>Save booking</Btn>
        </Modal>
      )}
    </div>
  );
}

/* ---------- Customer form fields (shared by add + edit) ---------- */
function CustomerForm({ form, setForm }) {
  return (
    <div>
      <Field label="Name"><input style={inputStyle} value={form.name} onChange={(e) => setForm(Object.assign({}, form, { name: e.target.value }))} /></Field>
      <Field label="Mobile number"><input style={inputStyle} value={form.phone} onChange={(e) => setForm(Object.assign({}, form, { phone: e.target.value }))} placeholder="09xx xxx xxxx" /></Field>
      <Field label="Address"><input style={inputStyle} value={form.address} onChange={(e) => setForm(Object.assign({}, form, { address: e.target.value }))} /></Field>
      <Field label="Birthday"><input type="date" style={inputStyle} value={form.birthday} onChange={(e) => setForm(Object.assign({}, form, { birthday: e.target.value }))} /></Field>
      <Field label="Email"><input type="email" style={inputStyle} value={form.email} onChange={(e) => setForm(Object.assign({}, form, { email: e.target.value }))} /></Field>
      <Field label="Notes" hint="Preferences like 'likes red manicure' or 'prefers moderate foot massage pressure'."><input style={inputStyle} value={form.notes} onChange={(e) => setForm(Object.assign({}, form, { notes: e.target.value }))} /></Field>
    </div>
  );
}
function emptyCustomerForm() { return { name: "", phone: "", address: "", birthday: "", email: "", notes: "" }; }

/* ---------- Customers Tab ---------- */
function CustomersTab({ customers, setCustomers, sales, appointments, customerPackages }) {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyCustomerForm());
  const [selected, setSelected] = useState(null);
  const [search, setSearch] = useState("");

  const openNew = () => { setForm(emptyCustomerForm()); setEditing(null); setShowForm(true); };
  const openEdit = (c) => { setForm({ name: c.name, phone: c.phone || "", address: c.address || "", birthday: c.birthday || "", email: c.email || "", notes: c.notes || "" }); setEditing(c); setShowForm(true); setSelected(null); };

  const submit = () => {
    if (!form.name) return;
    if (editing) setCustomers(customers.map((c) => (c.id === editing.id ? Object.assign({}, c, form) : c)));
    else setCustomers([Object.assign({ id: uid() }, form, { createdAt: new Date().toISOString() })].concat(customers));
    setShowForm(false);
  };

  const filtered = customers.filter((c) => c.name.toLowerCase().indexOf(search.toLowerCase()) !== -1);

  const upcomingBirthdays = customers
    .map((c) => ({ customer: c, days: daysUntilBirthday(c.birthday) }))
    .filter((x) => x.days != null && x.days <= 7)
    .sort((a, b) => a.days - b.days);

  const historyFor = (customer) => ({
    custSales: sales.filter((s) => s.customerId === customer.id),
    custAppts: appointments.filter((a) => a.customerId === customer.id),
    custPackages: customerPackages.filter((p) => p.customerId === customer.id),
  });

  return (
    <div>
      {upcomingBirthdays.length > 0 && (
        <div style={{ background: GOLD + "18", border: "1px solid " + GOLD + "55", borderRadius: 10, padding: "10px 14px", marginBottom: 14 }}>
          <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4 }}>Upcoming birthdays</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, fontSize: 13 }}>
            {upcomingBirthdays.map((x) => (
              <span key={x.customer.id}>{x.customer.name} — {x.days === 0 ? "today" : x.days === 1 ? "tomorrow" : "in " + x.days + " days"}</span>
            ))}
          </div>
        </div>
      )}
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14, gap: 10, flexWrap: "wrap" }}>
        <input style={Object.assign({}, inputStyle, { width: 220 })} placeholder="Search customers" value={search} onChange={(e) => setSearch(e.target.value)} />
        <Btn variant="primary" onClick={openNew}>+ Add customer</Btn>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))", gap: 10 }}>
        {filtered.map((c) => (
          <div key={c.id} onClick={() => setSelected(c)} style={{ background: CARD, border: "1px solid " + LINE, borderRadius: 12, padding: 14, cursor: "pointer" }}>
            <div style={{ fontWeight: 700 }}>{c.name}</div>
            <div style={{ fontSize: 12, color: MUTED }}>{c.phone || "No mobile number on file"}</div>
          </div>
        ))}
        {filtered.length === 0 && <div style={{ color: MUTED, fontSize: 13 }}>No customers yet.</div>}
      </div>

      {showForm && (
        <Modal title={editing ? "Edit customer" : "Add customer"} onClose={() => setShowForm(false)}>
          <CustomerForm form={form} setForm={setForm} />
          <Btn variant="primary" style={{ width: "100%" }} onClick={submit}>Save customer</Btn>
        </Modal>
      )}

      {selected && (function () {
        const h = historyFor(selected);
        const custSales = h.custSales, custAppts = h.custAppts, custPackages = h.custPackages;
        return (
          <Modal title={selected.name} onClose={() => setSelected(null)} wide>
            <div style={{ fontSize: 13, color: MUTED, marginBottom: 4 }}>{selected.phone || "No mobile number on file"}</div>
            {selected.email && <div style={{ fontSize: 13, color: MUTED, marginBottom: 4 }}>{selected.email}</div>}
            {selected.address && <div style={{ fontSize: 13, color: MUTED, marginBottom: 4 }}>{selected.address}</div>}
            {selected.birthday && <div style={{ fontSize: 13, color: MUTED, marginBottom: 4 }}>Birthday: {fmtBirthday(selected.birthday)}</div>}
            {selected.notes && <div style={{ fontSize: 13, color: MUTED, marginBottom: 10 }}>Notes: {selected.notes}</div>}
            <Btn onClick={() => openEdit(selected)} style={{ marginBottom: 14 }}>Edit details</Btn>

            {custPackages.length > 0 && (
              <div>
                <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 6 }}>Active packages</div>
                {custPackages.map((p) => (
                  <div key={p.id} style={{ fontSize: 13, display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: "1px solid " + LINE }}>
                    <span>{p.serviceName}</span><span>{p.sessionsRemaining}/{p.sessionsTotal} left</span>
                  </div>
                ))}
                <div style={{ marginBottom: 12 }} />
              </div>
            )}

            <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 6 }}>Purchase history</div>
            {custSales.length === 0 && <div style={{ color: MUTED, fontSize: 13, marginBottom: 12 }}>No purchases yet.</div>}
            {custSales.slice(0, 8).map((s) => (
              <div key={s.id} style={{ fontSize: 13, display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: "1px solid " + LINE, opacity: s.voided ? 0.5 : 1 }}>
                <span>{new Date(s.date).toLocaleDateString("en-PH")} · {s.items.map((i) => i.name).join(", ")}{s.voided ? " (voided)" : ""}</span><span>{peso(s.total)}</span>
              </div>
            ))}
            <div style={{ fontWeight: 700, fontSize: 13, margin: "14px 0 6px" }}>Booking history</div>
            {custAppts.length === 0 && <div style={{ color: MUTED, fontSize: 13 }}>No bookings yet.</div>}
            {custAppts.slice(0, 8).map((a) => (
              <div key={a.id} style={{ fontSize: 13, display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: "1px solid " + LINE }}>
                <span>{fmtDate(a.date)} {a.time} · {a.serviceName}</span>
                <Badge text={a.status} color={a.status === "completed" ? SAGE : a.status === "cancelled" ? RUST : GOLD} />
              </div>
            ))}
          </Modal>
        );
      })()}
    </div>
  );
}

/* ---------- Inventory / Catalog Tab ---------- */
function InventoryTab({ catalog, setCatalog, isOwner, lowStockThreshold, categories }) {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [activeCategory, setActiveCategory] = useState("All");
  const [confirmRemoveId, setConfirmRemoveId] = useState(null);
  const [form, setForm] = useState({ name: "", type: "service", category: categories[0] || "", price: "", starting: false, stock: "", lowStockThreshold: "", linkedServiceId: "", sessionsIncluded: "" });

  const categoryOptions = useMemo(() => {
    const set = new Set(categories);
    catalog.forEach((c) => set.add(c.category));
    return Array.from(set);
  }, [categories, catalog]);

  const services = catalog.filter((c) => c.type === "service");
  const filterCats = ["All"].concat(categoryOptions);
  const visibleCatalog = activeCategory === "All" ? catalog : catalog.filter((c) => c.category === activeCategory);

  const openNew = () => { setForm({ name: "", type: "service", category: categoryOptions[0] || "", price: "", starting: false, stock: "", lowStockThreshold: "", linkedServiceId: (services[0] && services[0].id) || "", sessionsIncluded: "" }); setEditing(null); setShowForm(true); };
  const openEdit = (item) => {
    setForm({
      name: item.name, type: item.type, category: item.category, price: item.price, starting: !!item.priceNote,
      stock: item.stock != null ? item.stock : "", lowStockThreshold: typeof item.lowStockThreshold === "number" ? item.lowStockThreshold : "",
      linkedServiceId: item.linkedServiceId || (services[0] && services[0].id) || "", sessionsIncluded: item.sessionsIncluded != null ? item.sessionsIncluded : "",
    });
    setEditing(item); setShowForm(true);
  };

  const submit = () => {
    if (!form.name || !form.price) return;
    const payload = {
      name: form.name, type: form.type, category: form.category || "General", price: Number(form.price),
      priceNote: form.type !== "product" && form.starting ? "Start @" : null,
      stock: form.type === "product" ? Number(form.stock || 0) : null,
      lowStockThreshold: form.type === "product" && form.lowStockThreshold !== "" ? Number(form.lowStockThreshold) : null,
      linkedServiceId: form.type === "package" ? form.linkedServiceId : null,
      sessionsIncluded: form.type === "package" ? Number(form.sessionsIncluded || 0) : null,
    };
    if (editing) setCatalog(catalog.map((c) => (c.id === editing.id ? Object.assign({}, c, payload) : c)));
    else setCatalog([Object.assign({ id: uid() }, payload)].concat(catalog));
    setShowForm(false);
  };

  const remove = (id) => { setCatalog(catalog.filter((c) => c.id !== id)); setConfirmRemoveId(null); };
  const adjustStock = (id, delta) => setCatalog(catalog.map((c) => (c.id === id && typeof c.stock === "number" ? Object.assign({}, c, { stock: Math.max(0, c.stock + delta) }) : c)));

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14, flexWrap: "wrap", gap: 10 }}>
        <div style={{ fontWeight: 700 }}>Services, products & packages</div>
        {isOwner && <Btn variant="primary" onClick={openNew}>+ Add item</Btn>}
      </div>
      <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
        {filterCats.map((cat) => (
          <span key={cat} onClick={() => setActiveCategory(cat)} style={{ padding: "5px 12px", borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: "pointer", background: activeCategory === cat ? WINE : "#fff", color: activeCategory === cat ? "#fff" : INK, border: "1px solid " + (activeCategory === cat ? WINE : LINE) }}>
            {cat}
          </span>
        ))}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {visibleCatalog.map((item) => {
          const threshold = effectiveThreshold(item, lowStockThreshold);
          const meta = TYPE_META[item.type] || TYPE_META.service;
          return (
            <div key={item.id} style={{ background: CARD, border: "1px solid " + LINE, borderRadius: 10, padding: "10px 14px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{item.name} <span style={{ fontSize: 11, color: MUTED }}>({item.category})</span></div>
                <div style={{ fontSize: 12, color: MUTED }}>
                  {meta.label.charAt(0) + meta.label.slice(1).toLowerCase()} · {priceLabel(item)}
                  {typeof item.stock === "number" && <span> · alert at {threshold}{typeof item.lowStockThreshold !== "number" ? " (universal)" : ""}</span>}
                  {item.type === "package" && <span> · {item.sessionsIncluded} sessions of {((catalog.find((c) => c.id === item.linkedServiceId)) || {}).name || "a service"}</span>}
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                {typeof item.stock === "number" && (
                  <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
                    <span onClick={() => adjustStock(item.id, -1)} style={{ cursor: "pointer", border: "1px solid " + LINE, borderRadius: 6, width: 22, textAlign: "center" }}>-</span>
                    <span style={{ color: item.stock <= threshold ? RUST : INK, fontWeight: 700 }}>{item.stock}</span>
                    <span onClick={() => adjustStock(item.id, 1)} style={{ cursor: "pointer", border: "1px solid " + LINE, borderRadius: 6, width: 22, textAlign: "center" }}>+</span>
                  </div>
                )}
                {isOwner && (
                  <div style={{ display: "flex", gap: 8 }}>
                    <Btn onClick={() => openEdit(item)}>Edit</Btn>
                    <Btn variant="danger" onClick={() => setConfirmRemoveId(item.id)}>Remove</Btn>
                  </div>
                )}
              </div>
            </div>
          );
        })}
        {visibleCatalog.length === 0 && <div style={{ color: MUTED, fontSize: 13 }}>No items in this category.</div>}
      </div>

      {showForm && (
        <Modal title={editing ? "Edit item" : "Add item"} onClose={() => setShowForm(false)}>
          <Field label="Name"><input style={inputStyle} value={form.name} onChange={(e) => setForm(Object.assign({}, form, { name: e.target.value }))} /></Field>
          <Field label="Type">
            <select style={inputStyle} value={form.type} onChange={(e) => setForm(Object.assign({}, form, { type: e.target.value }))}>
              <option value="service">Service</option>
              <option value="product">Product</option>
              <option value="package">Package (prepaid sessions)</option>
            </select>
          </Field>
          <Field label="Category" hint="Manage the category list under Staff & Settings.">
            <select style={inputStyle} value={form.category} onChange={(e) => setForm(Object.assign({}, form, { category: e.target.value }))}>
              {categoryOptions.map((cat) => (<option key={cat} value={cat}>{cat}</option>))}
            </select>
          </Field>
          <Field label="Price (PHP)"><input type="number" style={inputStyle} value={form.price} onChange={(e) => setForm(Object.assign({}, form, { price: e.target.value }))} /></Field>
          {form.type !== "product" && (
            <Field label="Pricing">
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14 }}>
                <input type="checkbox" checked={form.starting} onChange={(e) => setForm(Object.assign({}, form, { starting: e.target.checked }))} />
                This is a starting price (actual charge may vary — adjust at checkout)
              </label>
            </Field>
          )}
          {form.type === "product" && (
            <div>
              <Field label="Stock on hand"><input type="number" style={inputStyle} value={form.stock} onChange={(e) => setForm(Object.assign({}, form, { stock: e.target.value }))} /></Field>
              <Field label="Low-stock alert threshold" hint={"Leave blank to use the universal threshold (" + lowStockThreshold + ")."}>
                <input type="number" min="0" style={inputStyle} placeholder={"Universal (" + lowStockThreshold + ")"} value={form.lowStockThreshold} onChange={(e) => setForm(Object.assign({}, form, { lowStockThreshold: e.target.value }))} />
              </Field>
            </div>
          )}
          {form.type === "package" && (
            <div>
              <Field label="Linked service" hint="Which service each session in this package covers.">
                <select style={inputStyle} value={form.linkedServiceId} onChange={(e) => setForm(Object.assign({}, form, { linkedServiceId: e.target.value }))}>
                  {services.length === 0 && <option value="">Add a service first</option>}
                  {services.map((s) => (<option key={s.id} value={s.id}>{s.name}</option>))}
                </select>
              </Field>
              <Field label="Sessions included"><input type="number" style={inputStyle} value={form.sessionsIncluded} onChange={(e) => setForm(Object.assign({}, form, { sessionsIncluded: e.target.value }))} /></Field>
            </div>
          )}
          <Btn variant="primary" style={{ width: "100%" }} onClick={submit}>Save item</Btn>
        </Modal>
      )}
      {confirmRemoveId && (
        <ConfirmModal
          title="Remove this item?"
          body="It will disappear from the catalog and POS. Past sales already recorded won't be affected."
          confirmLabel="Remove item"
          onConfirm={() => remove(confirmRemoveId)}
          onClose={() => setConfirmRemoveId(null)}
        />
      )}
    </div>
  );
}

/* ---------- Daily Summary (screenshot-friendly) ---------- */
function DailySummary({ range, onRangeChange, sales, catalog, staff, expenses, lowStockThreshold, onClose }) {
  const daySales = sales.filter((s) => inRange(s.date, range.start, range.end) && !s.voided);
  const revenue = daySales.reduce((sum, s) => sum + s.total, 0);
  const byPayment = {};
  daySales.forEach((s) => {
    if (s.paymentSplits) {
      s.paymentSplits.forEach((p) => { byPayment[p.method] = (byPayment[p.method] || 0) + p.amount; });
    } else {
      byPayment[s.paymentMethod] = (byPayment[s.paymentMethod] || 0) + s.total;
    }
  });
  const expensesInRange = (expenses || []).filter((e) => inRange(e.date, range.start, range.end));
  const expensesTotal = expensesInRange.reduce((sum, e) => sum + e.amount, 0);
  const discountsTotal = daySales.reduce((sum, s) => sum + (s.discountAmount || 0), 0);

  const itemCounts = {};
  daySales.forEach((s) => s.items.forEach((i) => {
    itemCounts[i.name] = itemCounts[i.name] || { qty: 0, revenue: 0 };
    itemCounts[i.name].qty += i.qty;
    itemCounts[i.name].revenue += i.qty * i.price;
  }));
  const topItems = Object.entries(itemCounts).sort((a, b) => b[1].revenue - a[1].revenue).slice(0, 5);

  const byStaff = {};
  daySales.forEach((s) => {
    const ratio = s.subtotal ? s.total / s.subtotal : 1;
    s.items.forEach((i) => {
      const name = i.staffName || s.staffName;
      byStaff[name] = (byStaff[name] || 0) + i.price * i.qty * ratio;
    });
  });

  const lowStock = catalog.filter((c) => typeof c.stock === "number" && c.stock <= effectiveThreshold(c, lowStockThreshold));

  return (
    <Modal title="Sales summary" onClose={onClose} wide>
      <div style={{ marginBottom: 12 }}>
        <DateRangeFilter value={range} onChange={onRangeChange} />
      </div>
      <div id="daily-summary-capture" style={{ background: CARD }}>
        <div style={{ textAlign: "center", marginBottom: 16 }}>
          <Logo size={22} />
          <div style={{ fontSize: 12, color: MUTED }}>Balanga City Branch · {rangeLabel(range.preset, range.start, range.end)}</div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
          <div style={{ background: BG, borderRadius: 10, padding: 12, textAlign: "center" }}>
            <div style={{ fontSize: 11, color: MUTED }}>Revenue</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: WINE_DARK }}>{peso(revenue)}</div>
          </div>
          <div style={{ background: BG, borderRadius: 10, padding: 12, textAlign: "center" }}>
            <div style={{ fontSize: 11, color: MUTED }}>Transactions</div>
            <div style={{ fontSize: 22, fontWeight: 800 }}>{daySales.length}</div>
          </div>
          <div style={{ background: BG, borderRadius: 10, padding: 12, textAlign: "center" }}>
            <div style={{ fontSize: 11, color: MUTED }}>Discounts given</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: GOLD }}>{peso(discountsTotal)}</div>
          </div>
          <div style={{ background: BG, borderRadius: 10, padding: 12, textAlign: "center" }}>
            <div style={{ fontSize: 11, color: MUTED }}>Expenses</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: RUST }}>{peso(expensesTotal)}</div>
          </div>
          <div style={{ background: BG, borderRadius: 10, padding: 12, textAlign: "center", gridColumn: "1 / -1" }}>
            <div style={{ fontSize: 11, color: MUTED }}>Net (revenue − expenses)</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: SAGE }}>{peso(revenue - expensesTotal)}</div>
          </div>
        </div>

        <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 6 }}>By payment method</div>
        {Object.keys(byPayment).length === 0 && <div style={{ fontSize: 13, color: MUTED, marginBottom: 12 }}>No sales recorded.</div>}
        {Object.entries(byPayment).map(([method, amt]) => (<div key={method} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "3px 0" }}><span>{method}</span><span>{peso(amt)}</span></div>))}

        <div style={{ fontWeight: 700, fontSize: 13, margin: "14px 0 6px" }}>Top items</div>
        {topItems.length === 0 && <div style={{ fontSize: 13, color: MUTED }}>No items sold.</div>}
        {topItems.map(([name, d]) => (<div key={name} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "3px 0" }}><span>{name} × {d.qty}</span><span>{peso(d.revenue)}</span></div>))}

        <div style={{ fontWeight: 700, fontSize: 13, margin: "14px 0 6px" }}>By staff</div>
        {Object.keys(byStaff).length === 0 && <div style={{ fontSize: 13, color: MUTED }}>No sales recorded.</div>}
        {Object.entries(byStaff).map(([name, amt]) => (<div key={name} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "3px 0" }}><span>{name}</span><span>{peso(amt)}</span></div>))}

        <div style={{ fontWeight: 700, fontSize: 13, margin: "14px 0 6px" }}>Expenses</div>
        {expensesInRange.length === 0 && <div style={{ fontSize: 13, color: MUTED }}>No expenses logged.</div>}
        {expensesInRange.map((e) => (<div key={e.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "3px 0" }}><span>{e.description}</span><span>{peso(e.amount)}</span></div>))}

        {lowStock.length > 0 && (
          <div style={{ marginTop: 14, background: RUST + "15", border: "1px solid " + RUST + "55", borderRadius: 8, padding: 10, fontSize: 12, color: RUST }}>
            <strong>Low stock:</strong> {lowStock.map((i) => i.name + " (" + i.stock + ")").join(", ")}
          </div>
        )}
      </div>
      <div style={{ fontSize: 11, color: MUTED, textAlign: "center", marginTop: 14 }}>Screenshot this card to share with your team.</div>
    </Modal>
  );
}

/* ---------- Category manager ---------- */
function CategoryManager({ settings, setSettings }) {
  const [newCat, setNewCat] = useState("");
  const categories = settings.categories && settings.categories.length ? settings.categories : DEFAULT_CATEGORIES;

  const addCategory = () => {
    const name = newCat.trim();
    if (!name || categories.indexOf(name) !== -1) return;
    setSettings(Object.assign({}, settings, { categories: categories.concat([name]) }));
    setNewCat("");
  };
  const removeCategory = (name) => setSettings(Object.assign({}, settings, { categories: categories.filter((c) => c !== name) }));

  return (
    <div style={{ background: CARD, border: "1px solid " + LINE, borderRadius: 10, padding: "12px 14px", marginBottom: 20 }}>
      <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4 }}>Catalog categories</div>
      <div style={{ fontSize: 12, color: MUTED, marginBottom: 10 }}>Used when adding services, products, or packages in the Catalog tab.</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
        {categories.map((cat) => (
          <span key={cat} style={{ display: "flex", alignItems: "center", gap: 6, background: BG, borderRadius: 20, padding: "4px 6px 4px 12px", fontSize: 13 }}>
            {cat}
            <span onClick={() => removeCategory(cat)} style={{ cursor: "pointer", color: MUTED, fontWeight: 700, padding: "0 6px" }}>&times;</span>
          </span>
        ))}
        {categories.length === 0 && <span style={{ fontSize: 13, color: MUTED }}>No categories yet.</span>}
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <input style={inputStyle} placeholder="New category name" value={newCat} onChange={(e) => setNewCat(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addCategory()} />
        <Btn variant="primary" onClick={addCategory}>Add</Btn>
      </div>
    </div>
  );
}

/* ---------- Backup & restore ---------- */
function BackupRestore({ allData, onRestoreAll }) {
  const [pending, setPending] = useState(null);
  const [error, setError] = useState("");

  const exportAll = () => downloadJSON("leeya-backup-" + todayStr() + ".json", allData);

  const handleFile = (e) => {
    const file = e.target.files[0];
    e.target.value = "";
    if (!file) return;
    setError("");
    const reader = new FileReader();
    reader.onload = () => {
      try { setPending(JSON.parse(reader.result)); }
      catch (err) { setError("Could not read that file — make sure it's a Leeya backup JSON file."); }
    };
    reader.readAsText(file);
  };

  const confirmRestore = () => { onRestoreAll(pending); setPending(null); };

  return (
    <div style={{ background: CARD, border: "1px solid " + LINE, borderRadius: 10, padding: "12px 14px", marginBottom: 20 }}>
      <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4 }}>Backup & restore</div>
      <div style={{ fontSize: 12, color: MUTED, marginBottom: 10 }}>Download everything as one file, or restore from a previous backup.</div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <Btn onClick={exportAll}>Download backup</Btn>
        <label style={Object.assign({}, inputStyle, { width: "auto", display: "inline-flex", alignItems: "center", cursor: "pointer", padding: "9px 14px" })}>
          Restore from file
          <input type="file" accept="application/json" onChange={handleFile} style={{ display: "none" }} />
        </label>
      </div>
      {error && <div style={{ color: RUST, fontSize: 12, marginTop: 8 }}>{error}</div>}

      {pending && (
        <Modal title="Restore this backup?" onClose={() => setPending(null)}>
          <div style={{ fontSize: 13, color: MUTED, marginBottom: 12 }}>This will replace your current data with:</div>
          <div style={{ fontSize: 13, marginBottom: 4 }}>Catalog items: <strong>{(pending.catalog || []).length}</strong></div>
          <div style={{ fontSize: 13, marginBottom: 4 }}>Customers: <strong>{(pending.customers || []).length}</strong></div>
          <div style={{ fontSize: 13, marginBottom: 4 }}>Staff accounts: <strong>{(pending.staff || []).length}</strong></div>
          <div style={{ fontSize: 13, marginBottom: 4 }}>Sales records: <strong>{(pending.sales || []).length}</strong></div>
          <div style={{ fontSize: 13, marginBottom: 12 }}>Bookings: <strong>{(pending.appointments || []).length}</strong></div>
          <div style={{ fontSize: 12, color: RUST, marginBottom: 12 }}>This can't be undone unless you have another backup of your current data.</div>
          <div style={{ display: "flex", gap: 8 }}>
            <Btn style={{ flex: 1 }} onClick={() => setPending(null)}>Cancel</Btn>
            <Btn variant="primary" style={{ flex: 1 }} onClick={confirmRestore}>Restore</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ---------- Sales Tab: view + void (owner, or staff granted permission) ---------- */
function SaleEditModal({ sale, customers, onSave, onClose }) {
  const [customerId, setCustomerId] = useState(sale.customerId || "");
  const [customerSearch, setCustomerSearch] = useState("");
  const [paymentMethod, setPaymentMethod] = useState(sale.paymentMethod);
  const isSplit = !!sale.paymentSplits;

  const filteredCustomers = customers.filter((c) => c.name.toLowerCase().indexOf(customerSearch.toLowerCase()) !== -1).slice(0, 30);

  const submit = () => {
    const customer = customers.find((c) => c.id === customerId);
    onSave({
      customerId: customer ? customer.id : null,
      customerName: customer ? customer.name : "Walk-in",
      paymentMethod: isSplit ? sale.paymentMethod : paymentMethod,
    });
  };

  return (
    <Modal title={"Edit sale — OR #" + sale.orNumber} onClose={onClose}>
      <div style={{ fontSize: 12, color: MUTED, marginBottom: 12 }}>You can reassign the customer or fix the payment method. Items, prices, and totals can't be changed here — void and re-enter the sale if those are wrong.</div>
      <Field label="Customer">
        <input style={Object.assign({}, inputStyle, { marginBottom: 6 })} placeholder="Search by name (leave blank for Walk-in)" value={customerSearch} onChange={(e) => setCustomerSearch(e.target.value)} />
        <select style={inputStyle} value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
          <option value="">Walk-in</option>
          {filteredCustomers.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
        </select>
      </Field>
      <Field label="Payment method" hint={isSplit ? "This sale used a split payment — edit the individual amounts isn't supported here." : undefined}>
        <select style={inputStyle} value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} disabled={isSplit}>
          <option>Cash</option><option>GCash</option><option>Card</option>
        </select>
      </Field>
      <Btn variant="primary" style={{ width: "100%" }} onClick={submit}>Save changes</Btn>
    </Modal>
  );
}

function RevenueBarChart({ dayRows }) {
  if (dayRows.length === 0) return <div style={{ fontSize: 13, color: MUTED }}>No sales yet.</div>;
  const sorted = dayRows.slice().sort((a, b) => a[0].localeCompare(b[0]));
  const max = Math.max.apply(null, sorted.map((r) => r[1]));
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 140, padding: "10px 4px", overflowX: "auto" }}>
      {sorted.map(([day, amt]) => {
        const h = max > 0 ? Math.max(4, Math.round((amt / max) * 110)) : 4;
        return (
          <div key={day} title={fmtDate(day) + ": " + peso(amt)} style={{ display: "flex", flexDirection: "column", alignItems: "center", minWidth: 28 }}>
            <div style={{ fontSize: 10, color: MUTED, marginBottom: 3 }}>{amt > 0 ? Math.round(amt / 1000) + "k" : ""}</div>
            <div style={{ width: 18, height: h, background: GOLD, borderRadius: "3px 3px 0 0" }} />
            <div style={{ fontSize: 9, color: MUTED, marginTop: 4, whiteSpace: "nowrap" }}>{new Date(day + "T00:00:00").toLocaleDateString("en-PH", { month: "short", day: "numeric" })}</div>
          </div>
        );
      })}
    </div>
  );
}

function SalesTab({ sales, setSales, catalog, setCatalog, customerPackages, setCustomerPackages, customers, currentUser }) {
  const [range, setRange] = useState(defaultRangeValue("last7"));
  const [search, setSearch] = useState("");
  const [confirmVoid, setConfirmVoid] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [editingSale, setEditingSale] = useState(null);
  const isOwner = currentUser.role === "owner";

  const salesInRange = sales
    .filter((s) => inRange(s.date, range.start, range.end))
    .filter((s) => {
      if (!search.trim()) return true;
      const q = search.trim().toLowerCase();
      const inCustomer = (s.customerName || "").toLowerCase().indexOf(q) !== -1;
      const inItems = s.items.some((i) => i.name.toLowerCase().indexOf(q) !== -1);
      const inOr = String(s.orNumber || "").indexOf(q) !== -1;
      return inCustomer || inItems || inOr;
    })
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  const voidSale = (sale) => {
    setCatalog(catalog.map((c) => {
      const item = sale.items.find((i) => i.catalogId === c.id && i.type === "product");
      if (item && typeof c.stock === "number") return Object.assign({}, c, { stock: c.stock + item.qty });
      return c;
    }));
    let updatedPackages = customerPackages.filter((p) => p.saleId !== sale.id);
    updatedPackages = updatedPackages.map((p) => {
      const redeemed = sale.items.find((i) => i.kind === "redemption" && i.packageId === p.id);
      if (redeemed) return Object.assign({}, p, { sessionsRemaining: Math.min(p.sessionsTotal, p.sessionsRemaining + redeemed.qty) });
      return p;
    });
    setCustomerPackages(updatedPackages);
    setSales(sales.map((s) => (s.id === sale.id ? Object.assign({}, s, { voided: true, voidedAt: new Date().toISOString() }) : s)));
  };

  const deleteVoidedSale = (sale) => {
    setSales(sales.filter((s) => s.id !== sale.id));
  };

  const saveSaleEdit = (changes) => {
    const before = editingSale;
    const changeNotes = [];
    if (changes.customerName !== before.customerName) changeNotes.push("customer: " + before.customerName + " → " + changes.customerName);
    if (changes.paymentMethod !== before.paymentMethod) changeNotes.push("payment: " + before.paymentMethod + " → " + changes.paymentMethod);
    const historyEntry = { editedAt: new Date().toISOString(), editedBy: currentUser.name, note: changeNotes.join("; ") || "no changes" };
    setSales(sales.map((s) => (s.id === before.id ? Object.assign({}, s, changes, { edited: true, editHistory: (s.editHistory || []).concat([historyEntry]) }) : s)));
    setEditingSale(null);
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, flexWrap: "wrap", gap: 10 }}>
        <div style={{ fontWeight: 700 }}>Sales</div>
        <DateRangeFilter value={range} onChange={setRange} />
      </div>
      <input style={Object.assign({}, inputStyle, { marginBottom: 14 })} placeholder="Search by customer, item, or OR #" value={search} onChange={(e) => setSearch(e.target.value)} />
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {salesInRange.length === 0 && <div style={{ fontSize: 13, color: MUTED }}>No sales match.</div>}
        {salesInRange.map((s) => (
          <div key={s.id} style={{ background: CARD, border: "1px solid " + LINE, borderRadius: 10, padding: "10px 14px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8, opacity: s.voided ? 0.55 : 1 }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: 13 }}>OR #{s.orNumber} · {new Date(s.date).toLocaleString("en-PH")} · {s.customerName} {s.voided && <Badge text="voided" color={RUST} />} {s.edited && <Badge text="edited" color={GOLD} />}</div>
              <div style={{ fontSize: 12, color: MUTED }}>{s.items.map((i) => i.qty + "x " + i.name + (i.staffName ? " (" + i.staffName + ")" : "")).join(", ")} · {s.paymentMethod}</div>
              <div style={{ fontSize: 12, color: MUTED }}>Encoded by {s.processedBy || "—"}</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ fontWeight: 700, fontSize: 13 }}>{peso(s.total)}</div>
              {!s.voided && <Btn onClick={() => setEditingSale(s)}>Edit</Btn>}
              {!s.voided && <Btn variant="danger" onClick={() => setConfirmVoid(s)}>Void</Btn>}
              {s.voided && isOwner && <Btn variant="danger" onClick={() => setConfirmDelete(s)}>Delete permanently</Btn>}
            </div>
          </div>
        ))}
      </div>
      {editingSale && (
        <SaleEditModal sale={editingSale} customers={customers} onSave={saveSaleEdit} onClose={() => setEditingSale(null)} />
      )}
      {confirmVoid && (
        <ConfirmModal
          title="Void this sale?"
          body={confirmVoid.customerName + " · " + peso(confirmVoid.total) + " — stock and package sessions will be restored."}
          confirmLabel="Void sale"
          onConfirm={() => { voidSale(confirmVoid); setConfirmVoid(null); }}
          onClose={() => setConfirmVoid(null)}
        />
      )}
      {confirmDelete && (
        <ConfirmModal
          title="Permanently delete this voided sale?"
          body={"OR #" + confirmDelete.orNumber + " · " + confirmDelete.customerName + " · " + peso(confirmDelete.total) + " — this removes the record completely from your sales history and reports. It will not appear even in a future data backup taken after this."}
          confirmLabel="Delete permanently"
          onConfirm={() => { deleteVoidedSale(confirmDelete); setConfirmDelete(null); }}
          onClose={() => setConfirmDelete(null)}
        />
      )}
    </div>
  );
}

/* ---------- report permission labels ---------- */
const REPORT_PERMS = [
  { key: "salesCommission", label: "Sales & commission report (summary + daily summary + CSV export)" },
  { key: "commissionPerStaff", label: "Commission per staff" },
  { key: "topSellers", label: "Top sellers" },
  { key: "revenueByDay", label: "Revenue by day" },
  { key: "expenseHistory", label: "Expense history" },
];
const hasReportAccess = (user, key) => user.role === "owner" || (user.reportAccess && user.reportAccess[key] === true);
const hasAnyReportAccess = (user) => user.role === "owner" || REPORT_PERMS.some((p) => user.reportAccess && user.reportAccess[p.key] === true);

/* ---------- Staff & Settings / Reports Tab ---------- */
function StaffTab({ staff, setStaff, sales, catalog, expenses, setExpenses, settings, setSettings, allData, onRestoreAll, currentUser }) {
  const isOwner = currentUser.role === "owner";
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: "", pin: "", role: "staff", commissionRate: "", posAccess: true, canVoidSales: false, reportAccess: {} });
  const [range, setRange] = useState(defaultRangeValue("last7"));
  const [summaryRange, setSummaryRange] = useState(null);
  const [thresholdInput, setThresholdInput] = useState(String(settings.lowStockThreshold != null ? settings.lowStockThreshold : LOW_STOCK_THRESHOLD));
  const [orNumberInput, setOrNumberInput] = useState(String(settings.nextOrNumber != null ? settings.nextOrNumber : 1));
  const [showExpenses, setShowExpenses] = useState(false);
  const [confirmDeactivateId, setConfirmDeactivateId] = useState(null);

  const canSalesCommission = hasReportAccess(currentUser, "salesCommission");
  const canCommissionPerStaff = hasReportAccess(currentUser, "commissionPerStaff");
  const canTopSellers = hasReportAccess(currentUser, "topSellers");
  const canRevenueByDay = hasReportAccess(currentUser, "revenueByDay");
  const canExpenseHistory = hasReportAccess(currentUser, "expenseHistory");

  const openNew = () => { setForm({ name: "", pin: "", role: "staff", commissionRate: "10", posAccess: true, canVoidSales: false, reportAccess: {} }); setEditing(null); setShowForm(true); };
  const openEdit = (s) => { setForm({ name: s.name, pin: s.pin, role: s.role, commissionRate: s.commissionRate, posAccess: s.posAccess !== false, canVoidSales: s.canVoidSales === true, reportAccess: Object.assign({}, s.reportAccess) }); setEditing(s); setShowForm(true); };
  const submit = () => {
    if (!form.name || !form.pin) return;
    const payload = { name: form.name, pin: form.pin, role: form.role, commissionRate: Number(form.commissionRate || 0), active: true, posAccess: form.role === "owner" ? true : form.posAccess, canVoidSales: form.role === "owner" ? true : form.canVoidSales, reportAccess: form.role === "owner" ? {} : form.reportAccess };
    if (editing) setStaff(staff.map((s) => (s.id === editing.id ? Object.assign({}, s, payload) : s)));
    else setStaff([Object.assign({ id: uid() }, payload)].concat(staff));
    setShowForm(false);
  };
  const toggleActive = (id) => { setStaff(staff.map((s) => (s.id === id ? Object.assign({}, s, { active: s.active === false ? true : false }) : s))); setConfirmDeactivateId(null); };
  const toggleReportPerm = (key) => setForm(Object.assign({}, form, { reportAccess: Object.assign({}, form.reportAccess, { [key]: !form.reportAccess[key] }) }));

  const salesInRange = sales.filter((s) => inRange(s.date, range.start, range.end) && !s.voided);
  const totalRevenue = salesInRange.reduce((sum, s) => sum + s.total, 0);
  const totalDiscounts = salesInRange.reduce((sum, s) => sum + (s.discountAmount || 0), 0);

  const commissionRows = staff.map((s) => {
    let gross = 0;
    let count = 0;
    salesInRange.forEach((sa) => {
      const ratio = sa.subtotal ? sa.total / sa.subtotal : 1;
      sa.items.forEach((i) => {
        const itemStaffId = i.staffId || sa.staffId;
        if (itemStaffId === s.id) {
          gross += i.price * i.qty * ratio;
          count += i.qty;
        }
      });
    });
    const commission = gross * (Number(s.commissionRate) / 100);
    return { staff: s, gross: gross, commission: commission, count: count };
  });

  const itemAgg = {};
  salesInRange.forEach((s) => s.items.forEach((i) => {
    itemAgg[i.name] = itemAgg[i.name] || { qty: 0, revenue: 0 };
    itemAgg[i.name].qty += i.qty;
    itemAgg[i.name].revenue += i.qty * i.price;
  }));
  const topItemsRange = Object.entries(itemAgg).sort((a, b) => b[1].revenue - a[1].revenue).slice(0, 5);

  const byDay = {};
  salesInRange.forEach((s) => { const day = localDayOf(s.date); byDay[day] = (byDay[day] || 0) + s.total; });
  const dayRows = Object.entries(byDay).sort((a, b) => b[0].localeCompare(a[0]));

  const expensesInRange = expenses.filter((e) => inRange(e.date, range.start, range.end)).sort((a, b) => b.date.localeCompare(a.date));
  const expensesTotalRange = expensesInRange.reduce((sum, e) => sum + e.amount, 0);

  const exportCSV = () => {
    const rows = [["OR #", "Date", "Time", "Customer", "Items (staff)", "Subtotal", "Discount", "Discount Reason", "Payment", "Total", "Commission by staff", "Encoded by", "Voided"]];
    sales.filter((s) => inRange(s.date, range.start, range.end)).forEach((s) => {
      const ratio = s.subtotal ? s.total / s.subtotal : 1;
      const byStaffGross = {};
      s.items.forEach((i) => {
        const staffId = i.staffId || s.staffId;
        const staffMember = staff.find((st) => st.id === staffId);
        const name = i.staffName || s.staffName || "Unassigned";
        const rate = staffMember ? Number(staffMember.commissionRate) || 0 : 0;
        byStaffGross[name] = byStaffGross[name] || { gross: 0, rate: rate };
        byStaffGross[name].gross += i.price * i.qty * ratio;
      });
      const commissionSummary = Object.entries(byStaffGross).map(([name, v]) => name + ": " + peso(v.gross * (v.rate / 100))).join(", ");
      const itemsSummary = s.items.map((i) => i.qty + "x " + i.name + (i.staffName ? " (" + i.staffName + ")" : "")).join("; ");
      const paymentDisplay = s.paymentSplits ? s.paymentSplits.map((p) => p.method + " " + peso(p.amount)).join(" + ") : s.paymentMethod;
      rows.push([s.orNumber || "", localDayOf(s.date), new Date(s.date).toLocaleTimeString("en-PH"), s.customerName, itemsSummary, (s.subtotal != null ? s.subtotal : s.total).toFixed(2), (s.discountAmount || 0).toFixed(2), s.discountReason || "", paymentDisplay, s.total.toFixed(2), commissionSummary, s.processedBy || "", s.voided ? "Yes" : "No"]);
    });
    downloadCSV("leeya-sales-" + range.start + "-to-" + range.end + ".csv", rows);
  };

  const removeExpense = (id) => setExpenses(expenses.filter((e) => e.id !== id));

  return (
    <div>
      {canSalesCommission && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
            <div style={{ fontWeight: 700 }}>Sales & commission report</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <Btn onClick={() => setSummaryRange(defaultRangeValue("today"))}>Sales summary</Btn>
              <Btn onClick={exportCSV}>Export CSV</Btn>
              <DateRangeFilter value={range} onChange={setRange} />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 10, marginBottom: 20 }}>
            <div style={{ background: CARD, border: "1px solid " + LINE, borderRadius: 12, padding: 14 }}>
              <div style={{ fontSize: 12, color: MUTED }}>Revenue</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: WINE_DARK }}>{peso(totalRevenue)}</div>
            </div>
            <div style={{ background: CARD, border: "1px solid " + LINE, borderRadius: 12, padding: 14 }}>
              <div style={{ fontSize: 12, color: MUTED }}>Transactions</div>
              <div style={{ fontSize: 20, fontWeight: 800 }}>{salesInRange.length}</div>
            </div>
            <div style={{ background: CARD, border: "1px solid " + LINE, borderRadius: 12, padding: 14 }}>
              <div style={{ fontSize: 12, color: MUTED }}>Discounts given</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: GOLD }}>{peso(totalDiscounts)}</div>
            </div>
            {canExpenseHistory && (
              <div style={{ background: CARD, border: "1px solid " + LINE, borderRadius: 12, padding: 14 }}>
                <div style={{ fontSize: 12, color: MUTED }}>Expenses</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: RUST }}>{peso(expensesTotalRange)}</div>
              </div>
            )}
            {canCommissionPerStaff && (
              <div style={{ background: CARD, border: "1px solid " + LINE, borderRadius: 12, padding: 14 }}>
                <div style={{ fontSize: 12, color: MUTED }}>Total commission owed</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: SAGE }}>{peso(commissionRows.reduce((s, r) => s + r.commission, 0))}</div>
              </div>
            )}
          </div>
        </div>
      )}

      {canCommissionPerStaff && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 24 }}>
          {commissionRows.map((r) => (
            <div key={r.staff.id} style={{ background: CARD, border: "1px solid " + LINE, borderRadius: 10, padding: "10px 14px", display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
              <div style={{ fontWeight: 600 }}>{r.staff.name} <span style={{ fontSize: 12, color: MUTED }}>({r.staff.commissionRate}% rate · {r.count} item{r.count === 1 ? "" : "s"})</span></div>
              <div style={{ display: "flex", gap: 16 }}>
                <div style={{ fontSize: 13, color: MUTED }}>Gross: {peso(r.gross)}</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: SAGE }}>Commission: {peso(r.commission)}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {(canTopSellers || canRevenueByDay) && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 24 }}>
          {canTopSellers && (
            <div>
              <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8 }}>Top sellers (this range)</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {topItemsRange.length === 0 && <div style={{ fontSize: 13, color: MUTED }}>No sales yet.</div>}
                {topItemsRange.map(([name, d]) => (
                  <div key={name} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, background: CARD, border: "1px solid " + LINE, borderRadius: 8, padding: "6px 10px" }}>
                    <span>{name} × {d.qty}</span><span style={{ fontWeight: 700 }}>{peso(d.revenue)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {canRevenueByDay && (
            <div>
              <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8 }}>Revenue by day</div>
              {currentUser.role === "owner" && <RevenueBarChart dayRows={dayRows} />}
              <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 200, overflowY: "auto" }}>
                {dayRows.length === 0 && <div style={{ fontSize: 13, color: MUTED }}>No sales yet.</div>}
                {dayRows.map(([day, amt]) => (
                  <div key={day} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, background: CARD, border: "1px solid " + LINE, borderRadius: 8, padding: "6px 10px" }}>
                    <span>{fmtDate(day)}</span><span style={{ fontWeight: 700 }}>{peso(amt)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {canExpenseHistory && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <div style={{ fontWeight: 700 }}>Expense history</div>
            <Btn onClick={() => setShowExpenses(!showExpenses)}>{showExpenses ? "Hide" : "Show"}</Btn>
          </div>
          {showExpenses && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 24, maxHeight: 260, overflowY: "auto" }}>
              {expensesInRange.length === 0 && <div style={{ fontSize: 13, color: MUTED }}>No expenses in this range.</div>}
              {expensesInRange.map((e) => (
                <div key={e.id} style={{ background: CARD, border: "1px solid " + LINE, borderRadius: 10, padding: "8px 14px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{fmtDate(e.date)} · {e.description}</div>
                    <div style={{ fontSize: 12, color: MUTED }}>Logged by {e.loggedBy}</div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ fontWeight: 700, fontSize: 13, color: RUST }}>{peso(e.amount)}</div>
                    {isOwner && <Btn variant="danger" onClick={() => removeExpense(e.id)}>Remove</Btn>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {isOwner && (
        <div>
          <CategoryManager settings={settings} setSettings={setSettings} />

          <div style={{ background: CARD, border: "1px solid " + LINE, borderRadius: 10, padding: "12px 14px", marginBottom: 20, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 13 }}>Universal low-stock alert threshold</div>
              <div style={{ fontSize: 12, color: MUTED }}>Applies to any product without its own custom threshold.</div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <input type="number" min="0" style={Object.assign({}, inputStyle, { width: 90 })} value={thresholdInput} onChange={(e) => setThresholdInput(e.target.value)} />
              <Btn variant="primary" onClick={() => setSettings(Object.assign({}, settings, { lowStockThreshold: Math.max(0, Number(thresholdInput) || 0) }))}>Save</Btn>
            </div>
          </div>

          <div style={{ background: CARD, border: "1px solid " + LINE, borderRadius: 10, padding: "12px 14px", marginBottom: 20, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 13 }}>Next official receipt (OR) number</div>
              <div style={{ fontSize: 12, color: MUTED }}>Every sale gets the next number in sequence, then this increases automatically. Change it to match your paper OR booklet if needed.</div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <input type="number" min="1" style={Object.assign({}, inputStyle, { width: 100 })} value={orNumberInput} onChange={(e) => setOrNumberInput(e.target.value)} />
              <Btn variant="primary" onClick={() => setSettings(Object.assign({}, settings, { nextOrNumber: Math.max(1, Number(orNumberInput) || 1) }))}>Save</Btn>
            </div>
          </div>

          <BackupRestore allData={allData} onRestoreAll={onRestoreAll} />

          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
            <div style={{ fontWeight: 700 }}>Staff accounts</div>
            <Btn variant="primary" onClick={openNew}>+ Add staff</Btn>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {staff.map((s) => (
              <div key={s.id} style={{ background: CARD, border: "1px solid " + LINE, borderRadius: 10, padding: "10px 14px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                <div>
                  <div style={{ fontWeight: 600 }}>
                    {s.name} {s.active === false && <Badge text="inactive" color={MUTED} />}
                    {s.role !== "owner" && s.posAccess === false && <Badge text="no POS access" color={RUST} />}
                    {s.role !== "owner" && s.canVoidSales && <Badge text="can void sales" color={GOLD} />}
                    {s.role !== "owner" && hasAnyReportAccess(s) && <Badge text="report access" color={GOLD} />}
                  </div>
                  <div style={{ fontSize: 12, color: MUTED }}>{s.role === "owner" ? "Owner" : "Staff · " + s.commissionRate + "% commission"}</div>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <Btn onClick={() => openEdit(s)}>Edit</Btn>
                  {s.role !== "owner" && <Btn variant="danger" onClick={() => (s.active === false ? toggleActive(s.id) : setConfirmDeactivateId(s.id))}>{s.active === false ? "Reactivate" : "Deactivate"}</Btn>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {showForm && (
        <Modal title={editing ? "Edit staff" : "Add staff"} onClose={() => setShowForm(false)}>
          <Field label="Name"><input style={inputStyle} value={form.name} onChange={(e) => setForm(Object.assign({}, form, { name: e.target.value }))} /></Field>
          <Field label="4-digit PIN"><input style={inputStyle} value={form.pin} onChange={(e) => setForm(Object.assign({}, form, { pin: e.target.value }))} /></Field>
          <Field label="Role">
            <select style={inputStyle} value={form.role} onChange={(e) => setForm(Object.assign({}, form, { role: e.target.value }))}>
              <option value="staff">Staff</option>
              <option value="owner">Owner</option>
            </select>
          </Field>
          <Field label="Commission rate (%)"><input type="number" style={inputStyle} value={form.commissionRate} onChange={(e) => setForm(Object.assign({}, form, { commissionRate: e.target.value }))} /></Field>
          {form.role !== "owner" && (
            <div>
              <Field label="POS access">
                <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14 }}>
                  <input type="checkbox" checked={form.posAccess} onChange={(e) => setForm(Object.assign({}, form, { posAccess: e.target.checked }))} />
                  Allow this staff member to log in to the POS
                </label>
              </Field>
              <Field label="Void permission" hint="Manager-level access. Only owner and staff with this permission can void a sale.">
                <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14 }}>
                  <input type="checkbox" checked={form.canVoidSales} onChange={(e) => setForm(Object.assign({}, form, { canVoidSales: e.target.checked }))} />
                  Allow this staff member to void sales
                </label>
              </Field>
              <Field label="Reports visible to this staff member" hint="Grants a Reports tab showing only the sections checked below.">
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {REPORT_PERMS.map((p) => (
                    <label key={p.key} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
                      <input type="checkbox" checked={!!form.reportAccess[p.key]} onChange={() => toggleReportPerm(p.key)} />
                      {p.label}
                    </label>
                  ))}
                </div>
              </Field>
            </div>
          )}
          <Btn variant="primary" style={{ width: "100%" }} onClick={submit}>Save staff</Btn>
        </Modal>
      )}

      {summaryRange && (
        <DailySummary range={summaryRange} onRangeChange={setSummaryRange} sales={sales} catalog={catalog} staff={staff} expenses={expenses} lowStockThreshold={settings.lowStockThreshold != null ? settings.lowStockThreshold : LOW_STOCK_THRESHOLD} onClose={() => setSummaryRange(null)} />
      )}
      {confirmDeactivateId && (
        <ConfirmModal
          title="Deactivate this staff member?"
          body="They won't be able to log in to the POS until reactivated."
          confirmLabel="Deactivate"
          onConfirm={() => toggleActive(confirmDeactivateId)}
          onClose={() => setConfirmDeactivateId(null)}
        />
      )}
    </div>
  );
}

/* ---------- Messenger: owner <-> staff chat widget ---------- */
const ONLINE_WINDOW_MS = 3 * 60 * 1000;

function loadLastSeen(userId) {
  try {
    const raw = localStorage.getItem("leeya-chat-lastseen-" + userId);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    return {};
  }
}
function saveLastSeen(userId, map) {
  try {
    localStorage.setItem("leeya-chat-lastseen-" + userId, JSON.stringify(map));
  } catch (e) {
    // ignore — badge counts just won't persist across reloads
  }
}

function MessengerWidget({ currentUser, staff }) {
  const isOwner = currentUser.role === "owner";
  const [messages, setMessages] = useState([]);
  const [presence, setPresence] = useState({});
  const [open, setOpen] = useState(false);
  const [activeStaffId, setActiveStaffId] = useState(isOwner ? null : currentUser.id);
  const [draft, setDraft] = useState("");
  const [toast, setToast] = useState(null);
  const [centerPopup, setCenterPopup] = useState(false);
  const [lastSeenMap, setLastSeenMap] = useState(() => loadLastSeen(currentUser.id));
  const seenIdsRef = useRef(new Set());
  const initializedRef = useRef(false);
  const openRef = useRef(open);
  const activeStaffIdRef = useRef(activeStaffId);
  useEffect(() => { openRef.current = open; }, [open]);
  useEffect(() => { activeStaffIdRef.current = activeStaffId; }, [activeStaffId]);

  useEffect(() => {
    let cancelled = false;
    const beat = async () => {
      const latest = await loadKey(KEYS.presence, {});
      if (cancelled) return;
      const updated = Object.assign({}, latest, { [currentUser.id]: new Date().toISOString() });
      setPresence(updated);
      saveKey(KEYS.presence, updated);
    };
    beat();
    const id = setInterval(beat, 30000);
    return () => { cancelled = true; clearInterval(id); };
  }, [currentUser.id]);

  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      const latest = await loadKey(KEYS.messages, []);
      if (cancelled) return;
      if (initializedRef.current) {
        const relevant = latest.filter((m) => (isOwner ? true : m.staffId === currentUser.id));
        const newOnes = relevant.filter((m) => !seenIdsRef.current.has(m.id));
        newOnes.forEach((m) => seenIdsRef.current.add(m.id));
        const incoming = newOnes.filter((m) => (isOwner ? m.senderRole === "staff" : m.senderRole === "owner"));
        if (incoming.length > 0) {
          const last = incoming[incoming.length - 1];
          if (isOwner) {
            const viewingThatThread = openRef.current && activeStaffIdRef.current === last.staffId;
            if (!viewingThatThread) {
              setToast({ text: last.text, fromName: last.senderName, staffId: last.staffId });
            }
          } else {
            setCenterPopup(true);
          }
        }
      } else {
        latest.forEach((m) => seenIdsRef.current.add(m.id));
        initializedRef.current = true;
      }
      setMessages(latest);
    };
    poll();
    const id = setInterval(poll, 8000);
    return () => { cancelled = true; clearInterval(id); };
  }, [currentUser.id, isOwner]);

  const threadStaffId = isOwner ? activeStaffId : currentUser.id;
  const threadMessages = threadStaffId ? messages.filter((m) => m.staffId === threadStaffId).sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt)) : [];
  const threadScrollRef = useRef(null);
  useEffect(() => {
    if (threadScrollRef.current) threadScrollRef.current.scrollTop = threadScrollRef.current.scrollHeight;
  }, [threadMessages.length, open, activeStaffId]);

  const unreadForThread = (staffId, forOwner) => {
    const seen = lastSeenMap[staffId] || null;
    return messages.filter((m) => m.staffId === staffId && (forOwner ? m.senderRole === "staff" : m.senderRole === "owner") && (!seen || m.createdAt > seen)).length;
  };
  const totalUnread = isOwner
    ? staff.filter((s) => s.role !== "owner").reduce((sum, s) => sum + unreadForThread(s.id, true), 0)
    : unreadForThread(currentUser.id, false);

  const markThreadSeen = (staffId) => {
    const nowIso = new Date().toISOString();
    const updated = Object.assign({}, lastSeenMap, { [staffId]: nowIso });
    setLastSeenMap(updated);
    saveLastSeen(currentUser.id, updated);
  };

  const openThread = (staffId) => {
    setActiveStaffId(staffId);
    setOpen(true);
    setToast(null);
    markThreadSeen(staffId);
  };

  const sendMessage = async () => {
    if (!draft.trim() || !threadStaffId) return;
    const msg = { id: uid(), staffId: threadStaffId, senderRole: isOwner ? "owner" : "staff", senderName: currentUser.name, text: draft.trim(), createdAt: new Date().toISOString() };
    const latest = await loadKey(KEYS.messages, []);
    const updated = latest.concat([msg]);
    setMessages(updated);
    saveKey(KEYS.messages, updated);
    markThreadSeen(threadStaffId);
    setDraft("");
    setOpen(false);
    setCenterPopup(false);
  };

  const chattableStaff = staff.filter((s) => s.role !== "owner" && s.active !== false).sort((a, b) => {
    const aOnline = presence[a.id] && Date.now() - new Date(presence[a.id]).getTime() < ONLINE_WINDOW_MS;
    const bOnline = presence[b.id] && Date.now() - new Date(presence[b.id]).getTime() < ONLINE_WINDOW_MS;
    if (aOnline !== bOnline) return aOnline ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
  const activeStaffMember = staff.find((s) => s.id === threadStaffId);

  return (
    <React.Fragment>
      <div style={{ position: "fixed", right: 20, bottom: 20, zIndex: 60 }}>
      {toast && (
        <div
          onClick={() => openThread(toast.staffId)}
          style={{ position: "absolute", bottom: 66, right: 0, width: 260, background: CARD, border: "1px solid " + LINE, borderRadius: 12, padding: 12, boxShadow: "0 4px 16px rgba(0,0,0,0.18)", cursor: "pointer" }}
        >
          <div style={{ fontWeight: 700, fontSize: 13 }}>New message from {toast.fromName}</div>
          <div style={{ fontSize: 12, color: MUTED, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{toast.text}</div>
        </div>
      )}

      {open && (
        <div style={{ position: "absolute", bottom: 66, right: 0, width: 300, height: 400, maxHeight: "70vh", background: CARD, border: "1px solid " + LINE, borderRadius: 14, boxShadow: "0 8px 24px rgba(0,0,0,0.2)", display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <div style={{ background: INK, color: "#fff", padding: "10px 14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontWeight: 700, fontSize: 13 }}>
              {isOwner && !activeStaffId ? "Messages" : (activeStaffMember ? activeStaffMember.name : "Messages")}
            </div>
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              {isOwner && activeStaffId && (
                <span onClick={() => setActiveStaffId(null)} style={{ cursor: "pointer", fontSize: 12 }}>Back</span>
              )}
              <span onClick={() => setOpen(false)} style={{ cursor: "pointer", fontSize: 16, lineHeight: 1 }}>&minus;</span>
            </div>
          </div>

          {isOwner && !activeStaffId ? (
            <div style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
              {chattableStaff.length === 0 && <div style={{ padding: 14, fontSize: 13, color: MUTED }}>No staff accounts yet.</div>}
              {chattableStaff.map((s) => {
                const online = presence[s.id] && Date.now() - new Date(presence[s.id]).getTime() < ONLINE_WINDOW_MS;
                const unread = unreadForThread(s.id, true);
                const staffMsgs = messages.filter((m) => m.staffId === s.id);
                const last = staffMsgs.length ? staffMsgs[staffMsgs.length - 1] : null;
                return (
                  <div key={s.id} onClick={() => openThread(s.id)} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", borderBottom: "1px solid " + LINE, cursor: "pointer" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ width: 8, height: 8, borderRadius: 999, background: online ? SAGE : LINE_STRONG, display: "inline-block" }} />
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>{s.name}</div>
                        {last && <div style={{ fontSize: 11, color: MUTED, maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{last.text}</div>}
                      </div>
                    </div>
                    {unread > 0 && <span style={{ background: RUST, color: "#fff", fontSize: 11, fontWeight: 700, borderRadius: 999, padding: "2px 7px" }}>{unread}</span>}
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
              <div ref={threadScrollRef} style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: 10 }}>
                {threadMessages.length === 0 && <div style={{ fontSize: 12, color: MUTED, textAlign: "center", marginTop: 20 }}>No messages yet — say hi.</div>}
                {threadMessages.map((m) => {
                  const mine = m.senderRole === (isOwner ? "owner" : "staff");
                  return (
                    <div key={m.id} style={{ display: "flex", justifyContent: mine ? "flex-end" : "flex-start", marginBottom: 6 }}>
                      <div style={{ maxWidth: "75%", background: mine ? INK : BG, color: mine ? "#fff" : INK, borderRadius: 12, padding: "7px 11px", fontSize: 13 }}>
                        {m.text}
                        <div style={{ fontSize: 10, opacity: 0.7, marginTop: 2 }}>{new Date(m.createdAt).toLocaleTimeString("en-PH", { hour: "numeric", minute: "2-digit" })}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div style={{ display: "flex", gap: 6, padding: 10, borderTop: "1px solid " + LINE, flexShrink: 0 }}>
                <input
                  style={Object.assign({}, inputStyle, { flex: 1 })}
                  placeholder="Type a message..."
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                />
                <Btn variant="primary" onClick={sendMessage} style={{ padding: "9px 14px" }}>Send</Btn>
              </div>
            </div>
          )}
        </div>
      )}

      <div
        onClick={() => { setToast(null); if (open) { setOpen(false); } else { setOpen(true); if (threadStaffId) markThreadSeen(threadStaffId); } }}
        style={{ width: 52, height: 52, borderRadius: 999, background: INK, color: GOLD, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", boxShadow: "0 4px 12px rgba(0,0,0,0.25)", fontSize: 22, position: "relative" }}
      >
        💬
        {totalUnread > 0 && (
          <span style={{ position: "absolute", top: -4, right: -4, background: RUST, color: "#fff", fontSize: 11, fontWeight: 700, borderRadius: 999, padding: "2px 6px", minWidth: 18, textAlign: "center" }}>{totalUnread}</span>
        )}
      </div>
      </div>

      {!isOwner && centerPopup && (
        <Modal
          title={"Message from " + (threadMessages.length ? threadMessages[threadMessages.length - 1].senderName : "Owner")}
          onClose={() => { setCenterPopup(false); markThreadSeen(threadStaffId); }}
        >
          <div style={{ maxHeight: 240, overflowY: "auto", marginBottom: 12 }}>
            {threadMessages.slice(-4).map((m) => (
              <div key={m.id} style={{ display: "flex", justifyContent: m.senderRole === "staff" ? "flex-end" : "flex-start", marginBottom: 6 }}>
                <div style={{ maxWidth: "80%", background: m.senderRole === "staff" ? INK : BG, color: m.senderRole === "staff" ? "#fff" : INK, borderRadius: 12, padding: "7px 11px", fontSize: 13 }}>
                  {m.text}
                  <div style={{ fontSize: 10, opacity: 0.7, marginTop: 2 }}>{new Date(m.createdAt).toLocaleTimeString("en-PH", { hour: "numeric", minute: "2-digit" })}</div>
                </div>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <input
              autoFocus
              style={Object.assign({}, inputStyle, { flex: 1 })}
              placeholder="Type a reply..."
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendMessage()}
            />
            <Btn variant="primary" onClick={sendMessage}>Send</Btn>
          </div>
        </Modal>
      )}
    </React.Fragment>
  );
}
