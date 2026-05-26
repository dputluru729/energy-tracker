/* ══════════════════════════════════════════════════
   EnergyFlow · app.js
   localStorage backend — zero setup, works instantly
   ══════════════════════════════════════════════════ */

// ──────────────────────────────────────────────────
//  STORAGE KEYS
// ──────────────────────────────────────────────────
const STORE_KEY  = "energyflow_v1";
const CONFIG_KEY = "energyflow_config";

// ──────────────────────────────────────────────────
//  CONSTANTS
// ──────────────────────────────────────────────────
const CATEGORY_CFG = {
  Work:     { icon: "💼", color: "#818cf8" },
  Study:    { icon: "📚", color: "#38bdf8" },
  Personal: { icon: "🧘", color: "#34d399" },
  Chilling: { icon: "🎮", color: "#fbbf24" },
};

const ENERGY_EMOJI = { 1: "😫", 2: "😔", 3: "😐", 4: "😊", 5: "🤩" };
const ENERGY_LABEL = { 1: "Drained", 2: "Tired", 3: "Okay", 4: "Good", 5: "Amazing" };
const ENERGY_COLOR = { 1: "#f87171", 2: "#fb923c", 3: "#fbbf24", 4: "#4ade80", 5: "#34d399" };

const MAX_MINS = 540; // 9 hours

// ──────────────────────────────────────────────────
//  STATE
// ──────────────────────────────────────────────────
let selCategory = null;
let selEnergy   = null;
let allEntries  = []; // Local cache of all data

// ──────────────────────────────────────────────────
//  GITHUB GIST BACKEND
// ──────────────────────────────────────────────────

function getConfig() {
  return JSON.parse(localStorage.getItem(CONFIG_KEY) || "{}");
}

function saveConfig(config) {
  localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
}

async function fetchFromGist() {
  const { token, gistId } = getConfig();
  if (!token || !gistId) return readLocal();

  try {
    const res = await fetch(`https://api.github.com/gists/${gistId}`, {
      headers: { 
        'Authorization': `Bearer ${token}`,
        'X-GitHub-Api-Version': '2022-11-28'
      }
    });
    if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
    const data = await res.json();
    const content = data.files["energyflow_data.json"]?.content;
    return content ? JSON.parse(content) : [];
  } catch (err) {
    console.error("Cloud fetch error, using local:", err);
    return readLocal();
  }
}

async function syncToGist(entries) {
  const { token, gistId } = getConfig();
  if (!token) {
    saveLocal(entries);
    return;
  }

  const body = {
    description: "EnergyFlow Data",
    public: false,
    files: {
      "energyflow_data.json": { content: JSON.stringify(entries, null, 2) }
    }
  };

  try {
    let url = "https://api.github.com/gists";
    let method = "POST";
    
    if (gistId) {
      url = `https://api.github.com/gists/${gistId}`;
      method = "PATCH";
    }

    const res = await fetch(url, {
      method,
      headers: { 
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'X-GitHub-Api-Version': '2022-11-28'
      },
      body: JSON.stringify(body)
    });

    if (!res.ok) {
      const errorData = await res.json();
      throw new Error(errorData.message || `Sync failed: ${res.status}`);
    }
    
    if (!gistId) {
      const data = await res.json();
      saveConfig({ ...getConfig(), gistId: data.id });
    }
    
    saveLocal(entries);
  } catch (err) {
    console.error("Cloud sync error:", err);
    saveLocal(entries);
    throw err;
  }
}

// ──────────────────────────────────────────────────
//  LOCAL STORAGE FALLBACK
// ──────────────────────────────────────────────────

function readLocal() {
  try {
    return JSON.parse(localStorage.getItem(STORE_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveLocal(entries) {
  localStorage.setItem(STORE_KEY, JSON.stringify(entries));
}

// ──────────────────────────────────────────────────
//  SETUP UI
// ──────────────────────────────────────────────────

function openSetup() {
  const { token, gistId } = getConfig();
  document.getElementById("gh-token").value   = token || "";
  document.getElementById("gh-gist-id").value = gistId || "";
  document.getElementById("setup-modal").style.display = "flex";
}

function closeSetup() {
  document.getElementById("setup-modal").style.display = "none";
}

async function saveSetup() {
  const token  = document.getElementById("gh-token").value.trim();
  const gistId = document.getElementById("gh-gist-id").value.trim();
  
  saveConfig({ token, gistId });
  closeSetup();
  
  toast("⚙️ Config saved! Reloading...", "success");
  setTimeout(() => window.location.reload(), 1000);
}

// ──────────────────────────────────────────────────
//  UTILITIES
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

// Polar → SVG cartesian (0° = top, clockwise)
function polar(cx, cy, r, deg) {
  const rad = (deg - 90) * (Math.PI / 180);
  return {
    x: (cx + r * Math.cos(rad)).toFixed(3),
    y: (cy + r * Math.sin(rad)).toFixed(3),
  };
}

// ──────────────────────────────────────────────────
//  UI INIT
// ──────────────────────────────────────────────────
async function initUI() {
  const dateStr = niceDate();
  document.getElementById("header-date").textContent = dateStr;
  document.getElementById("log-date").textContent    = dateStr;
  document.getElementById("dash-date").textContent   = dateStr;

  // Category pills
  document.querySelectorAll(".pill").forEach(btn => {
    btn.addEventListener("click", () => {
      // If it's a modal pill, don't use category logic
      if (btn.closest(".modal-actions")) return;

      document.querySelectorAll(".pill").forEach(b => {
        if (b.closest(".modal-actions")) return;
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

  // Form submit
  document.getElementById("log-form").addEventListener("submit", handleSubmit);

  // Auto-advance from hours → minutes after 2 digits
  document.getElementById("hours-input").addEventListener("input", function () {
    if (this.value.length >= 2) {
      document.getElementById("minutes-input").focus();
      document.getElementById("minutes-input").select();
    }
  });

  // Initial Data Load
  allEntries = await fetchFromGist();
  renderDashboard(allEntries.filter(e => e.date === todayStr()));
}

// ──────────────────────────────────────────────────
//  FORM — SUBMIT
// ──────────────────────────────────────────────────
async function handleSubmit(e) {
  e.preventDefault();

  const hrs  = parseInt(document.getElementById("hours-input").value,   10) || 0;
  const mins = parseInt(document.getElementById("minutes-input").value, 10) || 0;

  if (!selCategory)    { toast("👆 Pick a category", "error");       return; }
  if (!hrs && !mins)   { toast("⏱ Enter time spent", "error");       return; }
  if (!selEnergy)      { toast("🎯 Select an energy level", "error"); return; }

  const entry = {
    id:        `${Date.now()}`,
    category:  selCategory,
    hours:     hrs,
    minutes:   mins,
    energy:    selEnergy,
    date:      todayStr(),
    totalMins: hrs * 60 + mins,
    timestamp: new Date().toISOString(),
  };

  // Brief loading feel
  const btn = document.getElementById("save-btn");
  btn.classList.add("loading");
  btn.disabled = true;

  try {
    allEntries.unshift(entry);
    await syncToGist(allEntries);
    toast("✅ Saved to Cloud", "success");
    resetForm();
    // Re-render dashboard if we are on it
    renderDashboard(allEntries.filter(e => e.date === todayStr()));
  } catch (err) {
    console.error(err);
    toast("❌ Sync failed — saved locally", "error");
    resetForm();
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
//  TAB SWITCHING
// ──────────────────────────────────────────────────
function switchTab(tab) {
  document.querySelectorAll(".tab").forEach(p => p.classList.remove("active"));
  document.querySelectorAll(".nav-btn").forEach(b => {
    b.classList.remove("active");
    b.setAttribute("aria-selected", "false");
  });
  document.getElementById(`tab-${tab}`).classList.add("active");
  const btn = document.getElementById(`nav-${tab}`);
  btn.classList.add("active");
  btn.setAttribute("aria-selected", "true");

  if (tab === "dashboard") {
    renderDashboard(allEntries.filter(e => e.date === todayStr()));
  }
}

// ──────────────────────────────────────────────────
//  DASHBOARD
// ──────────────────────────────────────────────────
function renderDashboard(entries) {
  const totalMins = entries.reduce((s, e) => s + (e.totalMins || 0), 0);
  const avgEnergy = entries.length
    ? entries.reduce((s, e) => s + e.energy, 0) / entries.length
    : null;

  buildRingChart(entries, totalMins, avgEnergy);
  buildCatLegend(entries, totalMins);
  buildEnergyTimeline(entries, avgEnergy);
  buildActivityList(entries);
}

// ──────────────────────────────────────────────────
//  RING CHART  (pure SVG — no library needed)
// ──────────────────────────────────────────────────
function buildRingChart(entries, totalMins, avgEnergy) {
  const cx = 110, cy = 110;
  const OR = 90, OW = 13;
  const IR = 68, IW = 10;

  const progress   = Math.min(totalMins / MAX_MINS, 1);
  const ocirc      = 2 * Math.PI * OR;
  const initOffset = ocirc.toFixed(3);
  const targOffset = (ocirc * (1 - progress)).toFixed(3);

  // Category arcs
  const catTotals = {};
  entries.forEach(e => {
    catTotals[e.category] = (catTotals[e.category] || 0) + (e.totalMins || 0);
  });

  const GAP = 5;
  let angle = 0;

  const catArcs = Object.entries(catTotals)
    .sort(([, a], [, b]) => b - a)
    .map(([cat, mins]) => {
      const cfg  = CATEGORY_CFG[cat] || { color: "#6366f1" };
      const span = (mins / MAX_MINS) * 360;
      if (span <= GAP * 2) { angle += span; return ""; }

      const p1   = polar(cx, cy, IR, angle + GAP / 2);
      const p2   = polar(cx, cy, IR, angle + span - GAP / 2);
      const large = (span - GAP) > 180 ? 1 : 0;
      const d    = `M${p1.x},${p1.y} A${IR},${IR} 0 ${large} 1 ${p2.x},${p2.y}`;
      angle     += span;

      return `<path d="${d}" fill="none" stroke="${cfg.color}" stroke-width="${IW}" stroke-linecap="round" opacity="0.9"/>`;
    })
    .join("\n");

  const timeLabel  = totalMins > 0 ? formatDur(totalMins) : "—";
  const energyLine = avgEnergy !== null
    ? `<text x="${cx}" y="${cy + 30}" text-anchor="middle"
         fill="rgba(100,116,139,0.85)" font-size="12" font-weight="500"
         font-family="Inter,-apple-system,sans-serif">
         ${ENERGY_EMOJI[Math.round(avgEnergy)]} ${avgEnergy.toFixed(1)} avg
       </text>`
    : "";

  const svg = `
<svg viewBox="0 0 220 220" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="pg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%"   stop-color="#6366f1"/>
      <stop offset="100%" stop-color="#a78bfa"/>
    </linearGradient>
    <filter id="outer-glow" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur in="SourceGraphic" stdDeviation="4" result="blur"/>
      <feMerge>
        <feMergeNode in="blur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  </defs>
  <circle cx="${cx}" cy="${cy}" r="${OR}" fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="${OW}"/>
  <circle cx="${cx}" cy="${cy}" r="${IR}" fill="none" stroke="rgba(255,255,255,0.04)" stroke-width="${IW}"/>
  <circle
    id="prog-ring"
    cx="${cx}" cy="${cy}" r="${OR}"
    fill="none"
    stroke="url(#pg)"
    stroke-width="${OW}"
    stroke-dasharray="${ocirc.toFixed(3)}"
    stroke-dashoffset="${initOffset}"
    stroke-linecap="round"
    transform="rotate(-90 ${cx} ${cy})"
    ${progress > 0 ? 'filter="url(#outer-glow)"' : ""}
    style="transition: stroke-dashoffset 1s cubic-bezier(0.4,0,0.2,1)"
  />
  ${catArcs}
  <text x="${cx}" y="${cy - 8}" text-anchor="middle"
    fill="#f1f5f9" font-size="22" font-weight="800" letter-spacing="-1.5"
    font-family="Inter,-apple-system,sans-serif">
    ${timeLabel}
  </text>
  <text x="${cx}" y="${cy + 12}" text-anchor="middle"
    fill="rgba(100,116,139,0.8)" font-size="10" font-weight="500"
    font-family="Inter,-apple-system,sans-serif">
    of 9 hours
  </text>
  ${energyLine}
</svg>`.trim();

  document.getElementById("ring-svg").innerHTML = svg;

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      const ring = document.getElementById("prog-ring");
      if (ring) ring.style.strokeDashoffset = targOffset;
    });
  });
}

// ──────────────────────────────────────────────────
//  CATEGORY LEGEND
// ──────────────────────────────────────────────────
function buildCatLegend(entries, totalMins) {
  const el = document.getElementById("cat-legend");
  if (!entries.length) { el.innerHTML = ""; return; }

  const catTotals = {};
  entries.forEach(e => {
    catTotals[e.category] = (catTotals[e.category] || 0) + (e.totalMins || 0);
  });

  el.innerHTML = Object.entries(catTotals)
    .sort(([, a], [, b]) => b - a)
    .map(([cat, mins]) => {
      const cfg = CATEGORY_CFG[cat] || { color: "#6366f1", icon: "📌" };
      const pct = totalMins > 0 ? Math.round((mins / totalMins) * 100) : 0;
      return `
        <div class="legend-item">
          <span class="legend-dot" style="background:${cfg.color}"></span>
          ${cfg.icon} ${cat}
          <span class="legend-pct">${pct}%</span>
        </div>`;
    }).join("");
}

// ──────────────────────────────────────────────────
//  ENERGY TIMELINE
// ──────────────────────────────────────────────────
function buildEnergyTimeline(entries, avgEnergy) {
  const el    = document.getElementById("energy-timeline");
  const badge = document.getElementById("energy-avg-badge");

  if (!entries.length) {
    el.innerHTML      = `<span class="timeline-empty">Log activities to see your energy flow</span>`;
    badge.textContent = "";
    return;
  }

  badge.textContent = avgEnergy !== null
    ? `${ENERGY_EMOJI[Math.round(avgEnergy)]} ${avgEnergy.toFixed(1)} avg`
    : "";

  // Oldest → newest (left to right)
  const sorted = [...entries].sort((a, b) =>
    new Date(a.timestamp) - new Date(b.timestamp)
  );

  el.innerHTML = sorted.map(e => {
    const col = ENERGY_COLOR[e.energy] ?? "#64748b";
    return `
      <div class="e-dot"
        style="background:${col}18; border-color:${col}60"
        title="${CATEGORY_CFG[e.category]?.icon ?? ""} ${e.category} · ${formatDur(e.totalMins)} · ${ENERGY_LABEL[e.energy]}"
        aria-label="${e.category}, ${formatDur(e.totalMins)}, ${ENERGY_LABEL[e.energy]}">
        ${ENERGY_EMOJI[e.energy]}
      </div>`;
  }).join("");
}

// ──────────────────────────────────────────────────
//  ACTIVITY LIST
// ──────────────────────────────────────────────────
function buildActivityList(entries) {
  const el    = document.getElementById("activity-list");
  const badge = document.getElementById("log-count-badge");

  badge.textContent = entries.length
    ? `${entries.length} entr${entries.length === 1 ? "y" : "ies"}`
    : "";

  if (!entries.length) {
    el.innerHTML = `<div class="empty-msg">Nothing logged today — start with the Log tab!</div>`;
    return;
  }

  el.innerHTML = entries.map(e => {
    const cfg = CATEGORY_CFG[e.category] || { icon: "📌", color: "#6366f1" };
    const dur = formatDur(e.totalMins || 0);
    const at  = formatTime(e.timestamp);
    const ec  = ENERGY_COLOR[e.energy] ?? "#64748b";

    return `
      <div class="act-row">
        <span class="act-dot" style="background:${cfg.color}; box-shadow:0 0 8px ${cfg.color}80"></span>
        <div class="act-body">
          <div class="act-name">${cfg.icon} ${e.category}</div>
          <div class="act-meta" style="color:${ec}">
            ${ENERGY_EMOJI[e.energy]} ${ENERGY_LABEL[e.energy]}
          </div>
        </div>
        <div class="act-right">
          <span class="act-dur">${dur}</span>
          <span class="act-at">${at}</span>
        </div>
      </div>`;
  }).join("");
}

// ──────────────────────────────────────────────────
//  BOOT
// ──────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  initUI();
});
