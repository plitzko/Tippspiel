// ============ State + API ============
const TITLE = "Linas & Maxis WM Tippspiel";

const state = {
  userId: localStorage.getItem("userId") || null,
  user: null,
  tab: "tippen",
  dayKey: null,
  points: { difference: 2, winner: 1, goalPerTeam: 1 },
  koPoints: { exact: 5, difference: 3, winner: 2, goalPerTeam: 1 },
  standingsPhase: null,        // welche Phase ist in der Rangliste offen
  standingsPhaseUserSet: false, // hat der Nutzer manuell umgeschaltet?
  turnierView: null,           // "gruppen" | "baum"
  turnierViewUserSet: false
};
let trophyShown = false;       // Pokal-Animation nur einmal pro Sitzung

async function api(method, url, body) {
  const headers = { "Content-Type": "application/json" };
  if (state.userId) headers["X-User-Id"] = state.userId;
  const res = await fetch(url, { method, headers, body: body ? JSON.stringify(body) : undefined });
  let data = {};
  try { data = await res.json(); } catch {}
  if (!res.ok) throw new Error(data.error || "Fehler " + res.status);
  return data;
}

function setUser(user) {
  state.user = user;
  state.userId = user ? user.id : null;
  if (user) localStorage.setItem("userId", user.id);
  else localStorage.removeItem("userId");
}

// ============ Helfer ============
const el = (html) => {
  const t = document.createElement("template");
  t.innerHTML = html.trim();
  return t.content.firstChild;
};
const app = () => document.getElementById("app");
const fmtTime = (iso) => new Date(iso).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
const dayKeyOf = (iso) => new Date(iso).toLocaleDateString("sv-SE"); // YYYY-MM-DD lokal
const todayKey = () => new Date().toLocaleDateString("sv-SE");
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

// ---- Live-Auto-Refresh: nur neu rendern, wenn sich ein Ergebnis geändert hat ----
let liveSig = "";
const resultsSignature = (ms) =>
  ms.filter(m => m.homeScore != null).map(m => `${m.id}:${m.homeScore}:${m.awayScore}`).join("|") + "#" + ms.length;

async function livePoll() {
  if (!state.user) return;
  // nicht stören, während getippt wird
  if (document.activeElement && document.activeElement.tagName === "INPUT") return;
  let data;
  try { data = await api("GET", "/api/matches"); } catch { return; }
  const sig = resultsSignature(data.matches);
  if (sig === liveSig) return;          // nichts Neues
  liveSig = sig;
  const content = document.getElementById("content");
  if (!content) return;
  if (state.tab === "tippen") renderMatches(content);
  else if (state.tab === "turnier") renderTurnier(content);
  else renderStandings(content);
}

const ICON_EXIT = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>`;
const chevron = (dir) => `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="${dir === "left" ? "15 18 9 12 15 6" : "9 18 15 12 9 6"}"/></svg>`;

// ---- Eigene Symbole (plattformunabhängig, statt Emojis) ----
const ICON_BEAR = `
<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" class="ic-bear">
  <circle cx="25" cy="30" r="15" fill="#ffffff"/>
  <circle cx="75" cy="30" r="15" fill="#ffffff"/>
  <circle cx="25" cy="30" r="7.5" fill="#ffc2d9"/>
  <circle cx="75" cy="30" r="7.5" fill="#ffc2d9"/>
  <circle cx="50" cy="57" r="37" fill="#ffffff"/>
  <ellipse cx="33" cy="65" rx="7.5" ry="5.2" fill="#ffd0e2"/>
  <ellipse cx="67" cy="65" rx="7.5" ry="5.2" fill="#ffd0e2"/>
  <ellipse cx="50" cy="68" rx="18" ry="15" fill="#eef3ff"/>
  <circle cx="36" cy="52" r="6" fill="#2a2a3a"/>
  <circle cx="64" cy="52" r="6" fill="#2a2a3a"/>
  <circle cx="38" cy="49.8" r="2.1" fill="#ffffff"/>
  <circle cx="66" cy="49.8" r="2.1" fill="#ffffff"/>
  <ellipse cx="50" cy="62" rx="6.2" ry="4.8" fill="#2a2a3a"/>
  <path d="M41 71 Q50 78 59 71" stroke="#2a2a3a" stroke-width="2.7" fill="none" stroke-linecap="round"/>
</svg>`;
const ICON_TERM = `
<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" class="ic-term">
  <line x1="50" y1="15" x2="50" y2="5" stroke="#9aa0ad" stroke-width="3" stroke-linecap="round"/>
  <circle cx="50" cy="4.5" r="3.8" fill="#5fd9ff"/>
  <rect x="14" y="40" width="9" height="20" rx="4.5" fill="#7b8290"/>
  <rect x="77" y="40" width="9" height="20" rx="4.5" fill="#7b8290"/>
  <rect x="19" y="20" width="62" height="60" rx="24" fill="#cdd2dc"/>
  <rect x="19" y="20" width="62" height="30" rx="24" fill="#eef1f6" opacity="0.55"/>
  <rect x="27" y="36" width="46" height="26" rx="13" fill="#10212c"/>
  <circle cx="40" cy="49" r="6.6" fill="#5fd9ff"/>
  <circle cx="60" cy="49" r="6.6" fill="#5fd9ff"/>
  <circle cx="42.2" cy="46.8" r="2.3" fill="#eafaff"/>
  <circle cx="62.2" cy="46.8" r="2.3" fill="#eafaff"/>
  <path d="M42 69 Q50 75 58 69" stroke="#8b92a3" stroke-width="3.2" fill="none" stroke-linecap="round"/>
</svg>`;
const playerIcon = (name) => isLina(name) ? ICON_BEAR : isMaxi(name) ? ICON_TERM : "⚽";
const ICON_CROWN = `
<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" class="ic-crown">
  <path d="M2.6 8.4l4.2 3.3L12 4.2l5.2 7.5 4.2-3.3-1.9 10H4.5z" fill="#f5c84b" stroke="#c99a2e" stroke-width="1" stroke-linejoin="round"/>
  <circle cx="2.6" cy="8.4" r="1.6" fill="#f5c84b"/>
  <circle cx="21.4" cy="8.4" r="1.6" fill="#f5c84b"/>
  <circle cx="12" cy="4.2" r="1.7" fill="#f5c84b"/>
</svg>`;
const ICON_TROPHY = `
<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" class="ic-trophy">
  <defs><linearGradient id="tg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe79a"/><stop offset="1" stop-color="#e0a82e"/></linearGradient></defs>
  <path d="M19 8h26v9a13 13 0 0 1-26 0z" fill="url(#tg)" stroke="#b9851f" stroke-width="1.5"/>
  <path d="M19 12h-8a7 7 0 0 0 7 9" fill="none" stroke="#d9a32a" stroke-width="3" stroke-linecap="round"/>
  <path d="M45 12h8a7 7 0 0 1-7 9" fill="none" stroke="#d9a32a" stroke-width="3" stroke-linecap="round"/>
  <rect x="29" y="30" width="6" height="9" fill="#d9a32a"/>
  <rect x="22" y="39" width="20" height="5" rx="2" fill="#caa133"/>
  <rect x="17" y="44" width="30" height="7" rx="3" fill="#b9851f"/>
  <path d="M27 11.5l1.6 3.3 3.6.5-2.6 2.6.6 3.6L27 18.3l-3.2 1.7.6-3.6-2.6-2.6 3.6-.5z" fill="#fff7d6" opacity=".9"/>
</svg>`;

// große Pokal-Animation für den Gesamtsieger (einmal pro Sitzung)
function playTrophy(name) {
  if (trophyShown) return;
  trophyShown = true;
  const tie = name === "tie";
  const color = tie ? "#f5b301" : themeFor(name).color;
  const ov = el(`
    <div class="trophy-ov" style="--pc:${color}">
      <div class="trophy-inner">
        <div class="trophy-cup">${ICON_TROPHY}</div>
        <div class="trophy-kicker">${tie ? "Turnier zu Ende" : "🏆 Gesamtsieger"}</div>
        <div class="trophy-name">${tie ? "Unentschieden!" : esc(name)}</div>
        <div class="trophy-sub">Glückwunsch zur WM 2026! ⚽</div>
        <button class="btn trophy-close">Schließen</button>
      </div>
    </div>`);
  document.body.appendChild(ov);
  ov.querySelector(".trophy-close").onclick = () => ov.remove();
  ov.addEventListener("click", (e) => { if (e.target === ov) ov.remove(); });
  if (!reducedMotion()) {
    let n = 0;
    const burst = () => {
      if (n++ > 5 || !document.body.contains(ov)) return;
      confettiBurst(ov.querySelector(".trophy-cup"));
      setTimeout(burst, 650);
    };
    setTimeout(burst, 200);
  }
}

// ---- Konfetti bei exaktem Tipp (einmal je Spiel pro Sitzung) ----
const celebrated = new Set();
function confettiBurst(target) {
  const colors = ["#ec4899", "#3b82f6", "#f5b301", "#34d399", "#ffffff"];
  const rect = target.getBoundingClientRect();
  const x0 = rect.left + rect.width / 2, y0 = rect.top + rect.height / 2.6;
  for (let i = 0; i < 28; i++) {
    const p = document.createElement("div");
    p.className = "confetti-piece";
    p.style.background = colors[i % colors.length];
    p.style.left = x0 + "px"; p.style.top = y0 + "px";
    document.body.appendChild(p);
    const ang = Math.random() * Math.PI * 2, dist = 70 + Math.random() * 130;
    const dx = Math.cos(ang) * dist, dy = Math.sin(ang) * dist - 30;
    p.animate(
      [{ transform: "translate(0,0) rotate(0deg)", opacity: 1 },
       { transform: `translate(${dx}px, ${dy + 180}px) rotate(${Math.random() * 720 - 360}deg)`, opacity: 0 }],
      { duration: 900 + Math.random() * 600, easing: "cubic-bezier(.2,.6,.3,1)" }
    ).onfinish = () => p.remove();
  }
}

// ---- Lade-Skelett ----
function showSkeleton(content, n = 3) {
  content.innerHTML = "";
  for (let i = 0; i < n; i++)
    content.appendChild(el(`<div class="card skel-card"><span class="skel s1"></span><span class="skel s2"></span></div>`));
}

// ---- Spieler-Themen (Lina = rosa, Maxi = blau, sonst gold) ----
const PLAYERS = {
  lina: { color: "#ec4899", contrast: "#ffffff", emoji: "🐻‍❄️" },
  maxi: { color: "#3b82f6", contrast: "#ffffff", emoji: "🤖" },
};
const themeFor = (name) => PLAYERS[(name || "").toLowerCase()] || { color: "#f5b301", contrast: "#1a1300", emoji: "⚽" };
const isLina = (name) => (name || "").toLowerCase() === "lina";
const isMaxi = (name) => (name || "").toLowerCase() === "maxi";
const reducedMotion = () => window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;

// ---- Easter-Eggs: Blütenregen, winkender Bär, Terminator ----
function rainEmojis(list, count, duration = 2200) {
  for (let i = 0; i < count; i++) {
    const e = document.createElement("div");
    e.className = "emoji-fall";
    e.textContent = list[i % list.length];
    e.style.left = (Math.random() * 100) + "vw";
    e.style.fontSize = (20 + Math.random() * 22) + "px";
    document.body.appendChild(e);
    const dur = duration * (0.7 + Math.random() * 0.6);
    e.animate(
      [{ transform: "translateY(-12vh) rotate(0deg)", opacity: 0 },
       { transform: "translateY(-2vh) rotate(15deg)", opacity: 1, offset: 0.12 },
       { transform: `translateY(110vh) rotate(${Math.random() * 720 - 360}deg)`, opacity: 1 }],
      { duration: dur, easing: "linear" }
    ).onfinish = () => e.remove();
  }
}
function wavingBearCorner() {
  const b = el(`<div class="corner-bear">${ICON_BEAR}</div>`);
  document.body.appendChild(b);
  b.animate(
    [{ transform: "translateY(130%) rotate(0)" },
     { transform: "translateY(0) rotate(0)", offset: 0.2 },
     { transform: "translateY(0) rotate(14deg)", offset: 0.4 },
     { transform: "translateY(0) rotate(-8deg)", offset: 0.6 },
     { transform: "translateY(0) rotate(12deg)", offset: 0.8 },
     { transform: "translateY(130%) rotate(0)" }],
    { duration: 2800, easing: "ease-in-out" }
  ).onfinish = () => b.remove();
}
function redFlash() {
  const f = el(`<div class="red-flash">${ICON_TERM}</div>`);
  document.body.appendChild(f);
  f.animate([{ opacity: 0 }, { opacity: 0.92, offset: 0.18 }, { opacity: 0 }], { duration: 950 }).onfinish = () => f.remove();
}
// kleiner Gag beim Tippen aufs Logo
function easterEgg(name) {
  if (reducedMotion()) return;
  if (isLina(name)) { rainEmojis(["🌹", "🌸", "💮", "🌷"], 16, 1900); wavingBearCorner(); }
  else if (isMaxi(name)) { redFlash(); }
  else confettiBurst(document.querySelector(".logo") || document.body);
}
// große Begrüßungs-Animation beim Login
function playIntro(name) {
  return new Promise((resolve) => {
    if (reducedMotion() || (!isLina(name) && !isMaxi(name))) return resolve();
    const t = themeFor(name);
    const ov = el(`<div class="intro" style="--pc:${t.color}"></div>`);
    if (isLina(name)) {
      ov.classList.add("intro-lina");
      ov.innerHTML = `<div class="intro-bear">${ICON_BEAR}</div><div class="intro-text">Hallo Lina!</div>`;
      document.body.appendChild(ov);
    } else {
      ov.classList.add("intro-maxi");
      ov.innerHTML = `<div class="intro-scan"></div><div class="intro-bot">${ICON_TERM}</div><div class="intro-text">Hallo Maxi!</div>`;
      document.body.appendChild(ov);
    }
    setTimeout(() => { ov.classList.add("intro-out"); setTimeout(() => { ov.remove(); resolve(); }, 350); }, 1500);
  });
}
function hexA(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}
function darken(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.round(((n >> 16) & 255) * (1 - f));
  const g = Math.round(((n >> 8) & 255) * (1 - f));
  const b = Math.round((n & 255) * (1 - f));
  return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}
function applyTheme(name) {
  const t = themeFor(name);
  const r = document.documentElement.style;
  r.setProperty("--accent", t.color);
  r.setProperty("--accent-contrast", t.contrast);
  r.setProperty("--accent-weak", hexA(t.color, 0.16));
  r.setProperty("--accent-glow", hexA(t.color, 0.4));
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", name ? darken(t.color, 0.55) : "#0a0e1a");
}

// ---- Flaggen ----
const FLAGS = {
  "Mexiko": "mx", "Südafrika": "za", "Südkorea": "kr", "Tschechien": "cz",
  "Kanada": "ca", "Bosnien-Herzegowina": "ba", "Katar": "qa", "Schweiz": "ch",
  "Brasilien": "br", "Marokko": "ma", "Haiti": "ht", "Schottland": "gb-sct",
  "Australien": "au", "Paraguay": "py", "Türkei": "tr", "USA": "us",
  "Curaçao": "cw", "Elfenbeinküste": "ci", "Ecuador": "ec", "Deutschland": "de",
  "Japan": "jp", "Niederlande": "nl", "Schweden": "se", "Tunesien": "tn",
  "Belgien": "be", "Ägypten": "eg", "Iran": "ir", "Neuseeland": "nz",
  "Kap Verde": "cv", "Saudi-Arabien": "sa", "Spanien": "es", "Uruguay": "uy",
  "Frankreich": "fr", "Senegal": "sn", "Irak": "iq", "Norwegen": "no",
  "Algerien": "dz", "Argentinien": "ar", "Österreich": "at", "Jordanien": "jo",
  "Kolumbien": "co", "DR Kongo": "cd", "Portugal": "pt", "Usbekistan": "uz",
  "Kroatien": "hr", "England": "gb-eng", "Ghana": "gh", "Panama": "pa",
};
function flagHtml(name) {
  const code = FLAGS[name];
  if (!code) return `<span class="flag flag-empty"></span>`;
  return `<img class="flag" src="https://flagcdn.com/w40/${code}.png" srcset="https://flagcdn.com/w80/${code}.png 2x" loading="lazy" alt="" onerror="this.style.display='none'">`;
}
function sideHtml(name, side) {
  // Flagge oben, Name darunter (zentriert)
  return `<div class="side ${side}">${flagHtml(name)}<span class="tname">${esc(name)}</span></div>`;
}

// ============ Bootstrap ============
async function init() {
  let status;
  try { status = await api("GET", "/api/status"); }
  catch { status = { players: [], canAddPlayer: true }; }
  state.points = status.points || state.points;
  state.koPoints = status.ko || state.koPoints;

  const me = status.players.find(p => p.id === state.userId);
  if (me) { state.user = me; renderApp(); }
  else { setUser(null); applyTheme(null); renderPlayerSelect(status); }

  if (status.tournamentOver && status.champion) setTimeout(() => playTrophy(status.champion), 700);
}

// ============ "Wer bist du?" ============
function renderPlayerSelect(status) {
  const view = el(`
    <div class="login">
      <div class="login-hero">
        <div class="login-logo">⚽</div>
        <h1 class="login-title">Linas &amp; Maxis</h1>
        <div class="login-sub">WM 2026 Tippspiel</div>
      </div>
      <div class="login-pick-label">${status.players.length ? "Wer tippt?" : "Legt eure Namen an"}</div>
      <div class="login-players" id="lp"></div>
      <div id="ps-add"></div>
      <div class="error" id="ps-err" style="text-align:center"></div>
    </div>
  `);
  app().replaceChildren(view);
  document.body.classList.add("on-login");

  const lp = view.querySelector("#lp");
  const players = [...status.players]; // Create a copy to avoid modifying the original status object

  // Sort players to prioritize Lina, then Maxi
  players.sort((a, b) => {
    const nameA = (a.name || "").toLowerCase();
    const nameB = (b.name || "").toLowerCase();

    if (nameA === "lina" && nameB !== "lina") return -1;
    if (nameB === "lina" && nameA !== "lina") return 1;
    if (nameA === "maxi" && nameB !== "maxi") return -1;
    if (nameB === "maxi" && nameA !== "maxi") return 1;
    return 0;
  });
  // Punkte phasenabhängig: in der K.o.-Phase die K.o.-Wertung, sonst die Gruppenwertung
  const phase = status.phase || "group";
  const ptsOf = (p) => (phase === "ko" ? p.ko : p.group) || 0;
  const phaseLabel = phase === "ko" ? "K.o." : "Gruppe";
  const maxPts = Math.max(0, ...players.map(ptsOf));
  const leaders = players.filter(p => ptsOf(p) === maxPts);
  const someScored = players.some(p => ptsOf(p) > 0);

  const makeTile = (p, i) => {
    const th = themeFor(p.name);
    const cls = isLina(p.name) ? "lina" : isMaxi(p.name) ? "maxi" : "";
    const isLeader = someScored && leaders.length === 1 && leaders[0].id === p.id;
    const pts = ptsOf(p);
    const b = el(`
      <button class="ptile ${cls} enter-up" style="--pc:${th.color};animation-delay:${i * 70}ms">
        ${isLeader ? `<span class="ptile-crown">${ICON_CROWN}</span>` : ""}
        <span class="ptile-av">${playerIcon(p.name)}</span>
        <span class="ptile-name">${esc(p.name)}</span>
        <span class="ptile-pts">${pts} ${pts === 1 ? "Punkt" : "Punkte"} <span class="ptile-phase">· ${phaseLabel}</span></span>
      </button>`);
    b.onclick = async () => {
      setUser(p); state.tab = "tippen"; state.dayKey = null;
      renderApp();                 // App zuerst rendern (unter der Animation) – kein Aufblitzen der Login-Seite
      await playIntro(p.name);
    };
    return b;
  };

  if (players.length === 2) {
    lp.classList.add("login-vs");
    lp.appendChild(makeTile(players[0], 0));
    lp.appendChild(el(`<div class="vs-badge">VS</div>`));
    lp.appendChild(makeTile(players[1], 1));
  } else {
    players.forEach((p, i) => lp.appendChild(makeTile(p, i)));
  }

  const addBox = view.querySelector("#ps-add");
  if (status.canAddPlayer) {
    const form = el(`
      <div class="login-add">
        ${status.players.length ? '<div class="muted" style="text-align:center;margin:12px 0 8px">oder neuen Spieler anlegen</div>' : ""}
        <div class="field"><input id="ps-name" placeholder="Name eingeben" /></div>
        <button class="btn secondary" id="ps-create">+ Spieler anlegen</button>
      </div>`);
    addBox.appendChild(form);
    const create = async () => {
      const name = form.querySelector("#ps-name").value.trim();
      const err = view.querySelector("#ps-err");
      err.textContent = "";
      if (!name) { err.textContent = "Bitte einen Namen eingeben."; return; }
      try { const data = await api("POST", "/api/players", { name }); setUser(data.player); state.tab = "tippen"; renderApp(); await playIntro(name); }
      catch (e) { err.textContent = e.message; }
    };
    form.querySelector("#ps-create").onclick = create;
    form.querySelector("#ps-name").addEventListener("keydown", e => { if (e.key === "Enter") create(); });
  }
}

// ============ Haupt-App ============
function renderApp() {
  applyTheme(state.user.name);
  document.body.classList.remove("on-login");
  if (state.tab === "ergebnisse") state.tab = "rangliste";
  const tabs = [["tippen", "⚽ Tippen"], ["rangliste", "🏆 Rangliste"], ["turnier", "🏟️ Turnier"]];

  const view = el(`
    <div>
      <div class="topbar">
        <div class="brand">
          <span class="logo" id="logo" title="✨">⚽</span>
          <div class="brand-text"><h1>${TITLE}</h1><small>WM 2026</small></div>
        </div>
        <button class="icon-btn" id="switch" title="Spieler wechseln" aria-label="Spieler wechseln">${ICON_EXIT}</button>
      </div>
      <div class="tabs" id="tabs"></div>
      <div id="content"></div>
    </div>
  `);
  app().replaceChildren(view);

  const tabsEl = view.querySelector("#tabs");
  for (const [key, label] of tabs) {
    const b = el(`<button>${label}</button>`);
    if (state.tab === key) b.classList.add("active");
    b.onclick = () => { state.tab = key; renderApp(); };
    tabsEl.appendChild(b);
  }
  view.querySelector("#switch").onclick = () => { setUser(null); init(); };
  view.querySelector("#logo").onclick = () => easterEgg(state.user.name);

  const content = view.querySelector("#content");
  if (state.tab === "tippen") renderMatches(content);
  else if (state.tab === "turnier") renderTurnier(content);
  else renderStandings(content);
}

// ============ Tippen (Kalender nach Tagen) ============
async function renderMatches(content, dir = 0) {
  if (!content.querySelector(".day-nav")) showSkeleton(content);
  let data;
  try { data = await api("GET", "/api/matches"); }
  catch (e) { content.innerHTML = `<div class="empty">${e.message}</div>`; return; }

  const matches = data.matches;
  liveSig = resultsSignature(matches);
  if (!matches.length) { content.innerHTML = `<div class="empty">Noch keine Spiele angelegt.</div>`; return; }

  // nach Tag gruppieren
  const byDay = new Map();
  for (const m of matches) {
    const k = dayKeyOf(m.kickoff);
    if (!byDay.has(k)) byDay.set(k, []);
    byDay.get(k).push(m);
  }
  const days = [...byDay.keys()].sort();

  // Standardtag bestimmen (heute, sonst nächster mit Spielen, sonst letzter)
  if (!state.dayKey || !byDay.has(state.dayKey)) {
    const t = todayKey();
    state.dayKey = days.includes(t) ? t : (days.find(d => d >= t) || days[days.length - 1]);
  }
  const idx = days.indexOf(state.dayKey);
  const dayMatches = byDay.get(state.dayKey);

  content.innerHTML = "";
  const dayView = el(`<div class="day-view"></div>`);
  content.appendChild(dayView);

  // Tages-Navigation
  const d = new Date(state.dayKey + "T12:00:00");
  const rel = relDayLabel(state.dayKey);
  const dateStr = d.toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "long" });
  const nav = el(`
    <div class="day-nav">
      <button class="day-arrow" id="day-prev" ${idx <= 0 ? "disabled" : ""} aria-label="Vorheriger Tag">${chevron("left")}</button>
      <div class="day-label">
        ${rel ? `<div class="day-rel">${rel}</div>` : ""}
        <div class="day-date">${dateStr}</div>
        <div class="day-count">${dayMatches.length} ${dayMatches.length === 1 ? "Spiel" : "Spiele"} · Tag ${idx + 1}/${days.length}</div>
      </div>
      <button class="day-arrow" id="day-next" ${idx >= days.length - 1 ? "disabled" : ""} aria-label="Nächster Tag">${chevron("right")}</button>
    </div>
  `);
  dayView.appendChild(nav);
  const go = (delta) => {
    const ni = idx + delta;
    if (ni < 0 || ni >= days.length) return;
    state.dayKey = days[ni];
    renderMatches(content, delta);
  };
  nav.querySelector("#day-prev").onclick = () => go(-1);
  nav.querySelector("#day-next").onclick = () => go(1);

  const enterClass = dir > 0 ? "enter-right" : dir < 0 ? "enter-left" : "enter-up";
  dayMatches.forEach((m, i) => {
    const card = matchCard(m);
    card.classList.add(enterClass);
    card.style.animationDelay = (i * 45) + "ms";
    dayView.appendChild(card);
  });
}

function relDayLabel(key) {
  const t = todayKey();
  if (key === t) return "Heute";
  const today = new Date(t + "T12:00:00"), d = new Date(key + "T12:00:00");
  const diff = Math.round((d - today) / 86400000);
  if (diff === 1) return "Morgen";
  if (diff === -1) return "Gestern";
  return null;
}

function stepperHtml(cls, val, team) {
  return `<div class="stepper">
      <button type="button" class="step" data-dir="up" aria-label="${esc(team)}: ein Tor mehr">+</button>
      <input type="number" min="0" max="99" inputmode="numeric" class="${cls}" value="${val}" aria-label="Tore ${esc(team)}"/>
      <button type="button" class="step" data-dir="down" aria-label="${esc(team)}: ein Tor weniger">−</button>
    </div>`;
}

function centerHtml(m) {
  if (!m.locked) {
    return `<div class="score-input">
        ${stepperHtml("in-home", m.myTip ? m.myTip.home : "", m.home)}
        <i>:</i>
        ${stepperHtml("in-away", m.myTip ? m.myTip.away : "", m.away)}
      </div>`;
  }
  if (m.homeScore != null)
    return `<div class="score-final"><span>${m.homeScore}</span><i>:</i><span>${m.awayScore}</span></div>`;
  return `<div class="score-final pending"><span>–</span><i>:</i><span>–</span></div>`;
}

function matchCard(m) {
  const card = el(`<div class="card match ${m.locked ? "locked" : "open"}"></div>`);
  const status = !m.locked
    ? `<span class="status">${fmtTime(m.kickoff)} Uhr</span>`
    : (m.homeScore != null ? `<span class="status final">🔒 Endstand</span>` : `<span class="status live"><span class="live-dot"></span>LIVE</span>`);

  card.innerHTML = `
    <div class="match-head">
      <span class="stage-badge">${esc(m.stage || "Spiel")}</span>
      ${status}
    </div>
    <div class="matchup">
      ${sideHtml(m.home, "home")}
      ${centerHtml(m)}
      ${sideHtml(m.away, "away")}
    </div>
  `;

  if (!m.locked) {
    const hint = el(`<div class="save-hint">Dein Tipp wird automatisch gespeichert</div>`);
    card.appendChild(hint);
    const ih = card.querySelector(".in-home");
    const ia = card.querySelector(".in-away");
    let timer;
    const saveTip = async () => {
      if (ih.value === "" || ia.value === "") return;
      clearTimeout(timer);
      try {
        await api("POST", "/api/tips", { matchId: m.id, home: ih.value, away: ia.value });
        hint.textContent = "✓ gespeichert"; hint.classList.add("ok");
        timer = setTimeout(() => { hint.textContent = "Dein Tipp wird automatisch gespeichert"; hint.classList.remove("ok"); }, 1800);
      } catch (e) { hint.textContent = e.message; hint.classList.remove("ok"); }
    };
    // +/- Stepper
    card.querySelectorAll(".stepper").forEach(st => {
      const input = st.querySelector("input");
      st.querySelectorAll(".step").forEach(btn => {
        btn.addEventListener("click", () => {
          const cur = input.value === "" ? 0 : parseInt(input.value, 10) || 0;
          input.value = btn.dataset.dir === "up" ? Math.min(99, cur + 1) : Math.max(0, cur - 1);
          saveTip();
        });
      });
    });
    // Auto-Sprung Heim -> Gast nach erster Ziffer
    ih.addEventListener("input", () => {
      if (ih.value.length >= 1 && ia.value === "") { ia.focus(); ia.select && ia.select(); }
    });
    ih.addEventListener("change", saveTip);
    ia.addEventListener("change", saveTip);
  } else {
    const wrap = el(`<div class="tips-compare"></div>`);
    const sortedTips = [...m.tips].sort((a, b) => {
      const nameA = (a.name || "").toLowerCase();
      const nameB = (b.name || "").toLowerCase();
      if (nameA === "lina" && nameB !== "lina") return -1;
      if (nameB === "lina" && nameA !== "lina") return 1;
      if (nameA === "maxi" && nameB !== "maxi") return -1;
      if (nameB === "maxi" && nameA !== "maxi") return 1;
      return 0;
    });
    for (const t of sortedTips) wrap.appendChild(tipCard(t, m));
    card.appendChild(wrap);

    // Konfetti, wenn DU diesen Tipp exakt getroffen hast (einmal pro Sitzung)
    const exactHit = m.homeScore != null && m.myTip && m.myTip.home === m.homeScore && m.myTip.away === m.awayScore;
    if (exactHit && !celebrated.has(m.id)) {
      celebrated.add(m.id);
      setTimeout(() => confettiBurst(card), 350);
    }
  }

  return card;
}

function tipCard(t, m) {
  const color = themeFor(t.name).color;
  const me = t.userId === state.user.id;
  const hasResult = m.homeScore != null;
  const score = t.tip ? `${t.tip.home}<i>:</i>${t.tip.away}` : `<span class="no-tip">kein Tipp</span>`;

  let pts = "", parts = "";
  if (hasResult && t.tip) {
    const total = t.points || 0;
    pts = `<div class="tip-pts ${total > 0 ? "good" : "zero"}">${total} ${total === 1 ? "Punkt" : "Punkte"}</div>`;
    parts = (t.breakdown && t.breakdown.length)
      ? `<div class="tip-parts">${t.breakdown.map(x => `<span class="part">${x.label} +${x.pts}</span>`).join("")}</div>`
      : `<div class="tip-parts none">leider nichts getroffen</div>`;
  }

  return el(`
    <div class="tip-card ${me ? "me" : ""}" style="--pc:${color}">
      <div class="tip-name"><span class="dot"></span>${esc(t.name)}${me ? '<span class="me-tag">du</span>' : ""}</div>
      <div class="tip-score">${score}</div>
      ${pts}${parts}
    </div>
  `);
}

// ============ Rangliste + Punkte-Regeln ============
async function renderStandings(content) {
  showSkeleton(content, 2);
  let standings, matchesData;
  try { [standings, matchesData] = await Promise.all([api("GET", "/api/standings"), api("GET", "/api/matches")]); }
  catch (e) { content.innerHTML = `<div class="empty">${e.message}</div>`; return; }
  const players = standings.group;  // Spielerliste (Namen/IDs)
  const ord = (p) => isLina(p.name) ? 0 : isMaxi(p.name) ? 1 : 2;
  const displayOrder = [...players].sort((a, b) => ord(a) - ord(b));
  const matches = matchesData.matches;
  liveSig = resultsSignature(matches);

  const isKoStage = (st) => !!st && !st.startsWith("Gruppe");
  const koExists = matches.some(m => isKoStage(m.stage));
  if (!state.standingsPhaseUserSet) state.standingsPhase = koExists ? "ko" : "group";
  const phase = state.standingsPhase || "group";

  content.innerHTML = "";

  // Phasen-Tabs (Standard = aktuelle Phase)
  const sub = el(`
    <div class="subtabs">
      <button data-ph="group" class="${phase === "group" ? "active" : ""}">Gruppenphase</button>
      <button data-ph="ko" class="${phase === "ko" ? "active" : ""}">K.o.-Phase</button>
    </div>`);
  content.appendChild(sub);
  sub.querySelectorAll("button").forEach(b => b.onclick = () => {
    state.standingsPhase = b.dataset.ph; state.standingsPhaseUserSet = true; renderStandings(content);
  });

  const phaseArr = phase === "ko" ? standings.ko : standings.group;
  (function scoreboard(arr) {
    if (!arr || arr.length !== 2) { content.appendChild(el(`<div class="empty">Noch keine Spieler.</div>`)); return; }
    const order = [...arr].sort((a, b) => ord(a) - ord(b));
    const leader = arr[0];
    const tie = arr[0].points === arr[1].points;
    const anyFinished = arr.some(p => p.finished > 0);
    const sbCard = (p) => {
      const color = themeFor(p.name).color;
      const me = p.userId === state.user.id;
      const isLeader = anyFinished && !tie && p.userId === leader.userId;
      const rank = !anyFinished ? "•" : (tie ? "🤝" : (isLeader ? "🥇" : "🥈"));
      return `
        <div class="sb-card ${isLeader ? "leader" : ""}" style="--pc:${color}">
          <div class="sb-rank">${rank}</div>
          <div class="sb-name"><span class="dot"></span>${esc(p.name)}${me ? " (du)" : ""}</div>
          <div class="sb-points">${p.points}</div>
          <div class="sb-sub">Punkte</div>
          <div class="sb-meta">${p.exact} exakt · ${p.tips} Tipps</div>
        </div>`;
    };
    content.appendChild(el(`
      <div class="scoreboard">
        ${sbCard(order[0])}
        <div class="sb-mid"><div class="sb-vs">VS</div></div>
        ${sbCard(order[1])}
      </div>`));
    if (anyFinished) {
      const diff = Math.abs(arr[0].points - arr[1].points);
      const msg = tie ? "Gleichstand! 🤝 Jeder Tipp zählt." : `<b>${esc(leader.name)}</b> führt mit ${diff} Punkt${diff === 1 ? "" : "en"}.`;
      content.appendChild(el(`<div class="lead-msg">${msg}</div>`));
    } else {
      content.appendChild(el(`<div class="lead-msg">${phase === "ko" ? "Beginnt nach der Gruppenphase." : "Noch keine Ergebnisse."}</div>`));
    }
  })(phaseArr);

  // ----- Zusatz-Statistiken aus den Spielen -----
  const finished = matches.filter(m => m.homeScore != null && isKoStage(m.stage) === (phase === "ko"));
  if (players.length === 2 && finished.length) {
    content.appendChild(el(`<div class="section-title" style="margin-top:18px">Details</div>`));
    const ids = displayOrder.map(p => p.userId);
    const info = {};
    players.forEach(p => info[p.userId] = { name: p.name, color: themeFor(p.name).color, duel: 0, best: null, tipped: 0, tendency: 0, diffc: 0, exact: 0, seq: [] });
    let draws = 0;
    const dayMap = new Map();
    for (const m of finished) {
      const pm = {};
      for (const t of m.tips) {
        if (!t.tip) continue;
        pm[t.userId] = t.points || 0;
        const b = info[t.userId];
        if (!b) continue;
        if (!b.best || (t.points || 0) > b.best.pts)
          b.best = { pts: t.points || 0, label: `${m.home} ${m.homeScore}:${m.awayScore}`, tip: `${t.tip.home}:${t.tip.away}` };
        const td = t.tip.home - t.tip.away, rd = m.homeScore - m.awayScore;
        b.tipped++;
        if (Math.sign(td) === Math.sign(rd)) b.tendency++;
        if (td === rd) b.diffc++;
        if (t.tip.home === m.homeScore && t.tip.away === m.awayScore) b.exact++;
        b.seq.push(t.points || 0);
      }
      if (pm[ids[0]] != null && pm[ids[1]] != null) {
        if (pm[ids[0]] > pm[ids[1]]) info[ids[0]].duel++;
        else if (pm[ids[1]] > pm[ids[0]]) info[ids[1]].duel++;
        else draws++;
      }
      const k = dayKeyOf(m.kickoff);
      if (!dayMap.has(k)) dayMap.set(k, {});
      const dd = dayMap.get(k);
      for (const id in pm) dd[id] = (dd[id] || 0) + pm[id];
    }
    const A = info[ids[0]], B = info[ids[1]];

    // Direkte Duelle
    content.appendChild(el(`
      <div class="card">
        <div class="section-title" style="margin-top:0">Direkte Duelle</div>
        <div class="duel">
          <div class="duel-side" style="--pc:${A.color}"><span class="duel-num">${A.duel}</span><span class="duel-name">${esc(A.name)}</span></div>
          <div class="duel-mid">:</div>
          <div class="duel-side" style="--pc:${B.color}"><span class="duel-num">${B.duel}</span><span class="duel-name">${esc(B.name)}</span></div>
        </div>
        <div class="duel-foot">${draws}× Gleichstand · ${finished.length} Spiele gewertet</div>
      </div>`));

    // Beste Tipps
    const bestRow = (p) => {
      const b = info[p.userId].best, c = info[p.userId].color;
      return `<div class="best-row">
        <span class="best-name"><span class="dot" style="background:${c}"></span>${esc(p.name)}</span>
        ${b ? `<span class="best-info"><b style="color:${c}">${b.pts} P.</b> · ${esc(b.label)} <span class="muted">(Tipp ${esc(b.tip)})</span></span>` : `<span class="muted">noch nichts</span>`}
      </div>`;
    };
    content.appendChild(el(`
      <div class="card">
        <div class="section-title" style="margin-top:0">Beste Tipps</div>
        ${bestRow(displayOrder[0])}${bestRow(displayOrder[1])}
      </div>`));

    // Bester Tag + längster Lauf je Spieler
    for (const id of ids) {
      const b = info[id];
      b.bestDay = 0;
      for (const dd of dayMap.values()) b.bestDay = Math.max(b.bestDay, dd[id] || 0);
      let run = 0; b.run = 0;
      for (const v of b.seq) { if (v > 0) { run++; b.run = Math.max(b.run, run); } else run = 0; }
    }

    // Form (letzte 5 Spiele)
    const formRow = (p) => {
      const b = info[p.userId];
      const last = b.seq.slice(-5);
      const cells = last.length ? last.map(v => `<span class="pill ${v > 0 ? "hit" : "miss"}">${v}</span>`).join("") : `<span class="muted">noch keine</span>`;
      return `<div class="form-row"><span class="best-name"><span class="dot" style="background:${b.color}"></span>${esc(p.name)}</span><span class="form-pills" style="--pc:${b.color}">${cells}</span></div>`;
    };
    content.appendChild(el(`
      <div class="card">
        <div class="section-title" style="margin-top:0">Form – letzte 5 Spiele</div>
        ${formRow(displayOrder[0])}${formRow(displayOrder[1])}
      </div>`));

    // Trefferquote (in % der abgegebenen Tipps)
    const pct = (x, n) => n ? Math.round(x / n * 100) + "%" : "–";
    const quotaRow = (p) => {
      const b = info[p.userId];
      return `<div class="quota-row"><span class="best-name"><span class="dot" style="background:${b.color}"></span>${esc(p.name)}</span><span>${pct(b.tendency, b.tipped)}</span><span>${pct(b.diffc, b.tipped)}</span><span>${pct(b.exact, b.tipped)}</span></div>`;
    };
    content.appendChild(el(`
      <div class="card">
        <div class="section-title" style="margin-top:0">Trefferquote</div>
        <div class="quota">
          <div class="quota-row quota-head"><span></span><span>Tendenz</span><span>Differ.</span><span>Exakt</span></div>
          ${quotaRow(displayOrder[0])}${quotaRow(displayOrder[1])}
        </div>
      </div>`));

    // Rekorde
    const recRow = (p) => {
      const b = info[p.userId];
      return `<div class="best-row"><span class="best-name"><span class="dot" style="background:${b.color}"></span>${esc(p.name)}</span><span class="best-info"><span class="muted">Bester Tag</span> <b style="color:${b.color}">${b.bestDay}</b> · <span class="muted">Lauf</span> <b style="color:${b.color}">${b.run}</b></span></div>`;
    };
    content.appendChild(el(`
      <div class="card">
        <div class="section-title" style="margin-top:0">Rekorde</div>
        ${recRow(displayOrder[0])}${recRow(displayOrder[1])}
      </div>`));

    // Punkte-Verlauf (Sparkline)
    const days = [...dayMap.keys()].sort();
    if (days.length >= 2) {
      const cum = {}, series = {};
      ids.forEach(id => { cum[id] = 0; series[id] = []; });
      for (const k of days) { const dd = dayMap.get(k); ids.forEach(id => { cum[id] += dd[id] || 0; series[id].push(cum[id]); }); }
      const maxV = Math.max(1, ...ids.map(id => series[id][series[id].length - 1]));
      const W = 300, H = 80, pad = 8;
      const x = i => pad + (W - 2 * pad) * (i / (days.length - 1));
      const y = v => H - pad - (H - 2 * pad) * (v / maxV);
      const poly = id => series[id].map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
      content.appendChild(el(`
        <div class="card">
          <div class="section-title" style="margin-top:0">Punkte-Verlauf</div>
          <svg class="spark" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true">
            <polyline points="${poly(ids[0])}" fill="none" stroke="${A.color}" stroke-width="3" vector-effect="non-scaling-stroke" stroke-linejoin="round" stroke-linecap="round"/>
            <polyline points="${poly(ids[1])}" fill="none" stroke="${B.color}" stroke-width="3" vector-effect="non-scaling-stroke" stroke-linejoin="round" stroke-linecap="round"/>
          </svg>
          <div class="spark-legend">
            <span><span class="dot" style="background:${A.color}"></span>${esc(A.name)}</span>
            <span><span class="dot" style="background:${B.color}"></span>${esc(B.name)}</span>
          </div>
        </div>`));
    }
  }

  // Punkte-Regeln – nur für die gewählte Phase
  const p = state.points, k = state.koPoints;
  const gExact = p.winner + p.difference + 2 * p.goalPerTeam;
  const rulesHtml = phase === "ko"
    ? `<div class="section-title" style="margin-top:0">So gibt's Punkte – K.o.-Phase</div>
       <div class="rules-sub">Nur das Höchste zählt</div>
       <ul class="rules-list">
         <li><span>Exakt</span><b>${k.exact}</b></li>
         <li><span>Richtige Tordifferenz</span><b>${k.difference}</b></li>
         <li><span>Richtiger Sieger / Remis</span><b>${k.winner}</b></li>
         <li><span>Eine Toranzahl richtig</span><b>${k.goalPerTeam}</b></li>
       </ul>`
    : `<div class="section-title" style="margin-top:0">So gibt's Punkte – Gruppenphase</div>
       <div class="rules-sub">Alles wird addiert</div>
       <ul class="rules-list">
         <li><span>Richtige Tendenz (Sieger/Remis)</span><b>+${p.winner}</b></li>
         <li><span>Richtige Tordifferenz</span><b>+${p.difference}</b></li>
         <li><span>Richtige Tore je Team</span><b>+${p.goalPerTeam}</b></li>
       </ul>
       <div class="rules-foot">Exakt = <b>${gExact} Punkte</b></div>`;
  content.appendChild(el(`<div class="card rules">${rulesHtml}</div>`));
}

// ============ Turnier: Gruppentabellen + K.o.-Baum ============
async function renderTurnier(content) {
  showSkeleton(content, 2);
  let data;
  try { data = await api("GET", "/api/matches"); }
  catch (e) { content.innerHTML = `<div class="empty">${e.message}</div>`; return; }
  const matches = data.matches;
  liveSig = resultsSignature(matches);

  const isKoStage = (st) => !!st && !st.startsWith("Gruppe");
  const koExists = matches.some(m => isKoStage(m.stage));
  if (!state.turnierViewUserSet) state.turnierView = koExists ? "baum" : "gruppen";
  const view = state.turnierView || "gruppen";

  content.innerHTML = "";
  const sub = el(`
    <div class="subtabs">
      <button data-v="gruppen" class="${view === "gruppen" ? "active" : ""}">Gruppen</button>
      <button data-v="baum" class="${view === "baum" ? "active" : ""}">K.o.-Baum</button>
    </div>`);
  content.appendChild(sub);
  sub.querySelectorAll("button").forEach(b => b.onclick = () => {
    state.turnierView = b.dataset.v; state.turnierViewUserSet = true; renderTurnier(content);
  });

  if (view === "gruppen") renderGroupTables(content, matches);
  else renderBracketTree(content);
}

function renderGroupTables(content, matches) {
  const groups = {};
  for (const m of matches) {
    if (!m.stage || !m.stage.startsWith("Gruppe ")) continue;
    const g = m.stage.slice("Gruppe ".length).trim();
    groups[g] = groups[g] || {};
    for (const name of [m.home, m.away]) groups[g][name] = groups[g][name] || { name, sp: 0, s: 0, u: 0, n: 0, tf: 0, ta: 0, pkt: 0 };
    if (m.homeScore != null && m.awayScore != null) {
      const H = groups[g][m.home], A = groups[g][m.away];
      H.sp++; A.sp++; H.tf += m.homeScore; H.ta += m.awayScore; A.tf += m.awayScore; A.ta += m.homeScore;
      if (m.homeScore > m.awayScore) { H.s++; A.n++; H.pkt += 3; }
      else if (m.homeScore < m.awayScore) { A.s++; H.n++; A.pkt += 3; }
      else { H.u++; A.u++; H.pkt++; A.pkt++; }
    }
  }
  const keys = Object.keys(groups).sort();
  if (!keys.length) { content.appendChild(el(`<div class="empty">Noch keine Gruppenspiele.</div>`)); return; }
  for (const g of keys) {
    const rows = Object.values(groups[g]).map(t => ({ ...t, diff: t.tf - t.ta }))
      .sort((a, b) => b.pkt - a.pkt || b.diff - a.diff || b.tf - a.tf || a.name.localeCompare(b.name));
    const body = rows.map((t, i) => `
      <div class="gt-row ${i < 2 ? "q" : ""}">
        <span class="gt-pos">${i + 1}</span>
        <span class="gt-team">${flagHtml(t.name)}<span class="gt-name">${esc(t.name)}</span></span>
        <span class="gt-num">${t.sp}</span>
        <span class="gt-num">${t.diff > 0 ? "+" : ""}${t.diff}</span>
        <span class="gt-num gt-pkt">${t.pkt}</span>
      </div>`).join("");
    content.appendChild(el(`
      <div class="card gt-card">
        <div class="gt-row gt-head">
          <span class="gt-pos"></span>
          <span class="gt-title">Gruppe ${esc(g)}</span>
          <span class="gt-num">Sp</span>
          <span class="gt-num">Diff</span>
          <span class="gt-num">Pkt</span>
        </div>
        ${body}
      </div>`));
  }
}

const KO_LABELS = { 4: "Sechzehntelfinale", 5: "Achtelfinale", 6: "Viertelfinale", 7: "Halbfinale", 8: "Finale" };
async function renderBracketTree(content) {
  const loading = el(`<div class="empty">Lade K.o.-Baum…</div>`);
  content.appendChild(loading);
  let data;
  try { data = await api("GET", "/api/bracket"); }
  catch (e) { loading.textContent = e.message; return; }
  loading.remove();
  const ko = data.bracket || [];
  if (!ko.length) { content.appendChild(el(`<div class="empty">K.o.-Plan noch nicht verfügbar.</div>`)); return; }

  const third = ko.find(m => m.stage === "Spiel um Platz 3");
  const tree = ko.filter(m => m.stage !== "Spiel um Platz 3");
  const byRound = {};
  for (const m of tree) (byRound[m.round] = byRound[m.round] || []).push(m);
  for (const r in byRound) byRound[r].sort((a, b) => a.matchNumber - b.matchNumber);

  const scroll = el(`<div class="bracket-scroll"></div>`);
  const bracket = el(`<div class="bracket"><svg class="bracket-lines" aria-hidden="true"></svg></div>`);
  scroll.appendChild(bracket);
  for (const r of [4, 5, 6, 7, 8]) {
    const ms = byRound[r];
    if (!ms || !ms.length) continue;
    const col = el(`<div class="bround"></div>`);
    col.appendChild(el(`<div class="bround-title">${KO_LABELS[r] || ""}</div>`));
    const body = el(`<div class="bround-body"></div>`);
    for (const m of ms) body.appendChild(bracketCell(m));
    col.appendChild(body);
    bracket.appendChild(col);
  }
  content.appendChild(scroll);
  requestAnimationFrame(() => requestAnimationFrame(() => drawBracketLines(bracket)));

  if (third) {
    content.appendChild(el(`<div class="section-title" style="margin-top:18px">Spiel um Platz 3</div>`));
    content.appendChild(bracketCell(third, true));
  }
}

function bracketCell(m, standalone) {
  const done = m.homeScore != null && m.awayScore != null;
  const hw = done && m.homeScore > m.awayScore, aw = done && m.awayScore > m.homeScore;
  const row = (name, score, win) => `
    <div class="bc-row ${win ? "win" : (done && name ? "lose" : "")}">
      ${name ? flagHtml(name) : `<span class="flag flag-empty"></span>`}
      <span class="bc-name ${name ? "" : "open"}">${name ? esc(name) : "offen"}</span>
      <span class="bc-score">${done ? score : ""}</span>
    </div>`;
  const dt = new Date(m.kickoff).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" });
  return el(`
    <div class="bcell ${standalone ? "standalone" : ""}">
      ${row(m.home, m.homeScore, hw)}
      ${row(m.away, m.awayScore, aw)}
      <div class="bc-date">${dt}</div>
    </div>`);
}

// Verbindungslinien als SVG nachträglich aus den Zellpositionen zeichnen
function drawBracketLines(bracket) {
  const svg = bracket.querySelector(".bracket-lines");
  if (!svg) return;
  const W = bracket.scrollWidth, H = bracket.scrollHeight;
  svg.setAttribute("width", W); svg.setAttribute("height", H);
  svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
  const rounds = [...bracket.querySelectorAll(".bround")];
  let paths = "";
  for (let r = 0; r < rounds.length - 1; r++) {
    const cur = [...rounds[r].querySelectorAll(".bcell")];
    const nxt = [...rounds[r + 1].querySelectorAll(".bcell")];
    for (let i = 0; i < nxt.length; i++) {
      const p = nxt[i]; if (!p) continue;
      const px = p.offsetLeft, pyc = p.offsetTop + p.offsetHeight / 2;
      for (const c of [cur[i * 2], cur[i * 2 + 1]]) {
        if (!c) continue;
        const cx = c.offsetLeft + c.offsetWidth, cy = c.offsetTop + c.offsetHeight / 2;
        const mid = (cx + px) / 2;
        paths += `<path d="M${cx},${cy} H${mid} V${pyc} H${px}"/>`;
      }
    }
  }
  svg.innerHTML = paths;
}

init();
setInterval(livePoll, 45000); // Live-Auto-Refresh
