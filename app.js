/* ══════════════════════════════════════════════════
   EnergyFlow · app.js
   Supabase Backend · Zero-Login Sync
   ══════════════════════════════════════════════════ */

// ──────────────────────────────────────────────────
//  SUPABASE CONFIG
// ──────────────────────────────────────────────────
const SUPABASE_URL = "https://nrhgtcptjjbxtmhfakko.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5yaGd0Y3B0ampieHRtaGZha2tvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk3NDgwODksImV4cCI6MjA5NTMyNDA4OX0.Jwz9T599603Yklu870nJFv3cgP-PDGQsX4rZJLWqxLc";

const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ──────────────────────────────────────────────────
//  CONSTANTS
// ──────────────────────────────────────────────────
const CATEGORY_CFG = {
  Work:     { icon: "💼", color: "#3b82f6" }, // Electric Blue
  Study:    { icon: "📚", color: "#06b6d4" }, // Neon Cyan
  Personal: { icon: "🧘", color: "#10b981" }, // Emerald Green
  Chilling: { icon: "🎮", color: "#f59e0b" }, // Amber/Orange
};

const ENERGY_EMOJI = { 1: "😫", 2: "😔", 3: "😐", 4: "😊", 5: "🤩" };
const ENERGY_LABEL = { 1: "Drained", 2: "Tired", 3: "Okay", 4: "Good", 5: "Amazing" };
const ENERGY_COLOR = { 1: "#f87171", 2: "#fb923c", 3: "#fbbf24", 4: "#4ade80", 5: "#34d399" };

const PRODUCTIVE_MAX = 540; // 9 hours (Work + Study)
const OVERALL_MAX    = 780; // 13 hours (Total Active Day)
const USER_KEY = "default_user"; // Simple key for zero-login sync

// ──────────────────────────────────────────────────
//  STATE
// ──────────────────────────────────────────────────
let selCategory = null;
let selEnergy   = null;
let allEntries  = [];

// ──────────────────────────────────────────────────
//  DATABASE LOGIC
// ──────────────────────────────────────────────────

async function fetchEntries() {
  const { data, error } = await sb
    .from('entries')
    .select('*')
    .order('timestamp', { ascending: false });

  if (error) {
    console.error(error);
    return [];
  }
  return data;
}

async function saveToSupabase(entry) {
  const { error } = await sb
    .from('entries')
    .insert([{
      category:   entry.category,
      hours:      entry.hours,
      minutes:    entry.minutes,
      energy:     entry.energy,
      date:       entry.date,
      total_mins: entry.totalMins
    }]);

  if (error) throw error;
}

// ──────────────────────────────────────────────────
//  UI HELPERS
// ──────────────────────────────────────────────────
function todayStr() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function niceDate() {
  return new Date().toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric",
  });
}

function formatDur(mins) {
  if (!mins) return "0m";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function formatTime(isoString) {
  if (!isoString) return "";
  return new Date(isoString).toLocaleTimeString([], {
    hour: "2-digit", minute: "2-digit",
  });
}

function polar(cx, cy, r, deg) {
  const rad = (deg - 90) * (Math.PI / 180);
  return {
    x: (cx + r * Math.cos(rad)).toFixed(3),
    y: (cy + r * Math.sin(rad)).toFixed(3),
  };
}

// ──────────────────────────────────────────────────
//  APP LOGIC
// ──────────────────────────────────────────────────

async function initApp() {
  const dateStr = niceDate();
  document.getElementById("header-date").textContent = dateStr;
  document.getElementById("log-date").textContent    = dateStr;
  document.getElementById("dash-date").textContent   = dateStr;

  // Category pills
  document.querySelectorAll(".pill").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".pill").forEach(b => {
        b.classList.remove("active");
        b.setAttribute("aria-pressed", "false");
      });
      btn.classList.add("active");
      btn.setAttribute("aria-pressed", "true");
      selCategory = btn.dataset.value;
    });
  });

  // Energy buttons
  document.querySelectorAll(".e-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".e-btn").forEach(b => {
        b.classList.remove("active");
        b.setAttribute("aria-pressed", "false");
      });
      btn.classList.add("active");
      btn.setAttribute("aria-pressed", "true");
      selEnergy = parseInt(btn.dataset.value, 10);
    });
  });

  // Hours → Minutes jump
  document.getElementById("hours-input").addEventListener("input", function () {
    if (this.value.length >= 2) {
      document.getElementById("minutes-input").focus();
      document.getElementById("minutes-input").select();
    }
  });

  // Load Data
  allEntries = await fetchEntries();
  renderDashboard(allEntries.filter(e => e.date === todayStr()));
}

async function handleSubmit(e) {
  e.preventDefault();
  const hrs  = parseInt(document.getElementById("hours-input").value,   10) || 0;
  const mins = parseInt(document.getElementById("minutes-input").value, 10) || 0;

  if (!selCategory)    { toast("👆 Pick a category", "error");       return; }
  if (!hrs && !mins)   { toast("⏱ Enter time spent", "error");       return; }
  if (!selEnergy)      { toast("🎯 Select an energy level", "error"); return; }

  const entry = {
    category:  selCategory,
    hours:     hrs,
    minutes:   mins,
    energy:    selEnergy,
    date:      todayStr(),
    totalMins: hrs * 60 + mins,
  };

  const btn = document.getElementById("save-btn");
  btn.classList.add("loading");
  btn.disabled = true;

  try {
    await saveToSupabase(entry);
    allEntries = await fetchEntries();
    renderDashboard(allEntries.filter(e => e.date === todayStr()));
    toast("✅ Saved & Synced", "success");
    resetForm();
  } catch (err) {
    toast("❌ Sync failed", "error");
    console.error(err);
  } finally {
    btn.classList.remove("loading");
    btn.disabled = false;
  }
}

function resetForm() {
  document.querySelectorAll(".pill, .e-btn").forEach(b => {
    b.classList.remove("active");
    b.setAttribute("aria-pressed", "false");
  });
  ["hours-input", "minutes-input"].forEach(id => {
    document.getElementById(id).value = "";
  });
  selCategory = null;
  selEnergy   = null;
}

// ──────────────────────────────────────────────────
//  DASHBOARD RENDER
// ──────────────────────────────────────────────────

function renderDashboard(entries) {
  const totalMins = entries.reduce((s, e) => s + (e.total_mins || 0), 0);
  const prodMins  = entries.filter(e => e.category === 'Work' || e.category === 'Study')
                           .reduce((s, e) => s + (e.total_mins || 0), 0);
                           
  const avgEnergy = entries.length
    ? entries.reduce((s, e) => s + e.energy, 0) / entries.length
    : null;

  buildDoubleRing(entries, prodMins, totalMins, avgEnergy);
  buildCatLegend(entries, totalMins);
  buildEnergyTimeline(entries, avgEnergy);
  buildActivityList(entries);
}

function buildDoubleRing(entries, prodMins, totalMins, avgEnergy) {
  const cx = 110, cy = 110;
  
  // Outer Ring (Overall 13h)
  const OR_R = 92, OR_W = 12;
  const or_circ = 2 * Math.PI * OR_R;
  const or_prog = Math.min(totalMins / OVERALL_MAX, 1);
  const or_offset = or_circ * (1 - or_prog);

  // Inner Ring (Productive 9h)
  const IR_R = 72, IR_W = 12;
  const ir_circ = 2 * Math.PI * IR_R;
  const ir_prog = Math.min(prodMins / PRODUCTIVE_MAX, 1);
  const ir_offset = ir_circ * (1 - ir_prog);

  // Category arcs on Outer Ring
  let angle = 0;
  const GAP = 3;
  const catArcs = entries.map(e => {
    const cfg = CATEGORY_CFG[e.category] || { color: "#6366f1" };
    const span = (e.total_mins / OVERALL_MAX) * 360;
    if (span <= 0) return "";
    
    const p1 = polar(cx, cy, OR_R, angle + GAP / 2);
    const p2 = polar(cx, cy, OR_R, angle + span - GAP / 2);
    const large = (span - GAP) > 180 ? 1 : 0;
    const d = `M${p1.x},${p1.y} A${OR_R},${OR_R} 0 ${large} 1 ${p2.x},${p2.y}`;
    angle += span;
    return `<path d="${d}" fill="none" stroke="${cfg.color}" stroke-width="${OR_W}" stroke-linecap="round" />`;
  }).join("\n");

  // Inner ring arcs (Productive only)
  let prodAngle = 0;
  const prodArcs = entries.filter(e => e.category === 'Work' || e.category === 'Study').map(e => {
    const cfg = CATEGORY_CFG[e.category];
    const span = (e.total_mins / PRODUCTIVE_MAX) * 360;
    const p1 = polar(cx, cy, IR_R, prodAngle + GAP / 2);
    const p2 = polar(cx, cy, IR_R, prodAngle + span - GAP / 2);
    const large = (span - GAP) > 180 ? 1 : 0;
    const d = `M${p1.x},${p1.y} A${IR_R},${IR_R} 0 ${large} 1 ${p2.x},${p2.y}`;
    prodAngle += span;
    return `<path d="${d}" fill="none" stroke="${cfg.color}" stroke-width="${IR_W}" stroke-linecap="round" />`;
  }).join("\n");

  const timeLabel = formatDur(totalMins);
  const prodLabel = formatDur(prodMins);
  const energyText = avgEnergy ? `${ENERGY_EMOJI[Math.round(avgEnergy)]} ${avgEnergy.toFixed(1)}` : "—";

  document.getElementById("ring-svg").innerHTML = `
    <svg viewBox="0 0 220 220">
      <!-- Backgrounds -->
      <circle cx="${cx}" cy="${cy}" r="${OR_R}" fill="none" stroke="rgba(255,255,255,0.05)" stroke-width="${OR_W}"/>
      <circle cx="${cx}" cy="${cy}" r="${IR_R}" fill="none" stroke="rgba(255,255,255,0.05)" stroke-width="${IR_W}"/>
      
      <!-- Arcs -->
      ${catArcs}
      ${prodArcs}

      <!-- Center Text -->
      <text x="${cx}" y="${cy - 12}" text-anchor="middle" fill="#fff" font-size="20" font-weight="800">${timeLabel}</text>
      <text x="${cx}" y="${cy + 8}" text-anchor="middle" fill="rgba(255,255,255,0.5)" font-size="10" font-weight="600">PROD: ${prodLabel}</text>
      <text x="${cx}" y="${cy + 24}" text-anchor="middle" fill="rgba(255,255,255,0.4)" font-size="12" font-weight="500">${energyText}</text>
    </svg>
  `;
}

function buildCatLegend(entries, totalMins) {
  const el = document.getElementById("cat-legend");
  if (!entries.length) { el.innerHTML = ""; return; }
  const catTotals = {};
  entries.forEach(e => { catTotals[e.category] = (catTotals[e.category] || 0) + (e.total_mins || 0); });
  el.innerHTML = Object.entries(catTotals).sort(([, a], [, b]) => b - a).map(([cat, mins]) => {
    const cfg = CATEGORY_CFG[cat] || { color: "#6366f1", icon: "📌" };
    const pct = totalMins > 0 ? Math.round((mins / totalMins) * 100) : 0;
    return `<div class="legend-item"><span class="legend-dot" style="background:${cfg.color}"></span>${cfg.icon} ${cat}<span class="legend-pct">${pct}%</span></div>`;
  }).join("");
}

function buildEnergyTimeline(entries, avgEnergy) {
  const el = document.getElementById("energy-timeline");
  const badge = document.getElementById("energy-avg-badge");
  if (!entries.length) { el.innerHTML = `<span class="timeline-empty">Log activities to see your energy flow</span>`; badge.textContent = ""; return; }
  badge.textContent = avgEnergy !== null ? `${ENERGY_EMOJI[Math.round(avgEnergy)]} ${avgEnergy.toFixed(1)} avg` : "";
  const sorted = [...entries].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  el.innerHTML = sorted.map(e => `<div class="e-dot" style="border-color:${ENERGY_COLOR[e.energy]}60">${ENERGY_EMOJI[e.energy]}</div>`).join("");
}

function buildActivityList(entries) {
  const el = document.getElementById("activity-list");
  const badge = document.getElementById("log-count-badge");
  badge.textContent = entries.length ? `${entries.length} entries` : "";
  if (!entries.length) { el.innerHTML = `<div class="empty-msg">Nothing logged today!</div>`; return; }
  el.innerHTML = entries.map(e => {
    const cfg = CATEGORY_CFG[e.category] || { icon: "📌", color: "#6366f1" };
    return `<div class="act-row"><span class="act-dot" style="background:${cfg.color}"></span><div class="act-body"><div class="act-name">${cfg.icon} ${e.category}</div><div class="act-meta" style="color:${ENERGY_COLOR[e.energy]}">${ENERGY_EMOJI[e.energy]} ${ENERGY_LABEL[e.energy]}</div></div><div class="act-right"><span class="act-dur">${formatDur(e.total_mins)}</span></div></div>`;
  }).join("");
}

function switchTab(tab) {
  document.querySelectorAll(".tab").forEach(p => p.classList.remove("active"));
  document.querySelectorAll(".nav-btn").forEach(b => { b.classList.remove("active"); b.setAttribute("aria-selected", "false"); });
  document.getElementById(`tab-${tab}`).classList.add("active");
  const btn = document.getElementById(`nav-${tab}`);
  btn.classList.add("active");
  btn.setAttribute("aria-selected", "true");
  if (tab === "dashboard") renderDashboard(allEntries.filter(e => e.date === todayStr()));
}

// ──────────────────────────────────────────────────
//  TOAST
// ──────────────────────────────────────────────────
let _toastTimer = null;
function toast(msg, type = "success") {
  const el = document.getElementById("toast");
  el.textContent = msg;
  el.className   = `toast ${type} show`;
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => el.classList.remove("show"), 3000);
}

// ──────────────────────────────────────────────────
//  BOOT
// ──────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("log-form").addEventListener("submit", handleSubmit);
  initApp();
});
