// ============ State + API ============
const TITLE = "Linas & Maxis WM Tippspiel";

const state = {
  userId: localStorage.getItem("userId") || null,
  user: null,
  tab: "tippen",
  dayKey: null,
  points: { difference: 2, winner: 1, goalPerTeam: 1 },
};

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

const ICON_EXIT = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>`;
const chevron = (dir) => `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="${dir === "left" ? "15 18 9 12 15 6" : "9 18 15 12 9 6"}"/></svg>`;

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
  lina: { color: "#ec4899", contrast: "#ffffff" },
  maxi: { color: "#3b82f6", contrast: "#ffffff" },
};
const themeFor = (name) => PLAYERS[(name || "").toLowerCase()] || { color: "#f5b301", contrast: "#1a1300" };
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
  const fl = flagHtml(name), nm = `<span class="tname">${esc(name)}</span>`;
  return side === "home"
    ? `<div class="side home">${fl}${nm}</div>`
    : `<div class="side away">${nm}${fl}</div>`;
}

// ============ Bootstrap ============
async function init() {
  let status;
  try { status = await api("GET", "/api/status"); }
  catch { status = { players: [], canAddPlayer: true }; }
  state.points = status.points || state.points;

  const me = status.players.find(p => p.id === state.userId);
  if (me) { state.user = me; renderApp(); }
  else { setUser(null); applyTheme(null); renderPlayerSelect(status); }
}

// ============ "Wer bist du?" ============
function renderPlayerSelect(status) {
  const view = el(`
    <div class="auth-wrap">
      <div class="brand" style="justify-content:center;margin-bottom:22px">
        <span class="logo">⚽</span>
        <div class="brand-text"><h1>${TITLE}</h1><small>Tippt die WM 2026 – wer kennt sich besser aus?</small></div>
      </div>
      <div class="card">
        <h2>Wer bist du?</h2>
        <p class="muted" id="ps-sub" style="margin-top:0"></p>
        <div id="ps-players" style="display:flex;flex-direction:column;gap:10px;margin-bottom:14px"></div>
        <div id="ps-add"></div>
        <div class="error" id="ps-err"></div>
      </div>
    </div>
  `);
  app().replaceChildren(view);

  view.querySelector("#ps-sub").textContent = status.players.length
    ? "Wähle deinen Namen aus." : "Legt zuerst eure beiden Namen an.";

  const list = view.querySelector("#ps-players");
  for (const p of status.players) {
    const color = themeFor(p.name).color;
    const b = el(`
      <button class="player-pick" style="--pc:${color}">
        <span class="pavatar">${esc((p.name[0] || "?").toUpperCase())}</span>
        <span>${esc(p.name)}</span>
        <span class="arrow">→</span>
      </button>`);
    b.onclick = () => { setUser(p); state.tab = "tippen"; state.dayKey = null; renderApp(); };
    list.appendChild(b);
  }

  const addBox = view.querySelector("#ps-add");
  if (status.canAddPlayer) {
    const form = el(`
      <div>
        ${status.players.length ? '<div class="muted" style="text-align:center;margin:6px 0">oder neuen Spieler anlegen:</div>' : ""}
        <div class="field"><input id="ps-name" placeholder="Name eingeben" /></div>
        <button class="btn secondary" id="ps-create">+ Spieler anlegen</button>
      </div>`);
    addBox.appendChild(form);
    const create = async () => {
      const name = form.querySelector("#ps-name").value.trim();
      const err = view.querySelector("#ps-err");
      err.textContent = "";
      if (!name) { err.textContent = "Bitte einen Namen eingeben."; return; }
      try { const data = await api("POST", "/api/players", { name }); setUser(data.player); state.tab = "tippen"; renderApp(); }
      catch (e) { err.textContent = e.message; }
    };
    form.querySelector("#ps-create").onclick = create;
    form.querySelector("#ps-name").addEventListener("keydown", e => { if (e.key === "Enter") create(); });
  }
}

// ============ Haupt-App ============
function renderApp() {
  applyTheme(state.user.name);
  const tabs = [["tippen", "⚽ Tippen"], ["rangliste", "🏆 Rangliste"], ["ergebnisse", "🔄 Ergebnisse"]];

  const view = el(`
    <div>
      <div class="topbar">
        <div class="brand">
          <span class="logo">⚽</span>
          <div class="brand-text"><h1>${TITLE}</h1><small>Hi, <b style="color:var(--accent)">${esc(state.user.name)}</b></small></div>
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

  const content = view.querySelector("#content");
  if (state.tab === "tippen") renderMatches(content);
  else if (state.tab === "rangliste") renderStandings(content);
  else if (state.tab === "ergebnisse") renderResults(content);
}

// ============ Tippen (Kalender nach Tagen) ============
async function renderMatches(content, dir = 0) {
  if (!content.querySelector(".day-nav")) showSkeleton(content);
  let data;
  try { data = await api("GET", "/api/matches"); }
  catch (e) { content.innerHTML = `<div class="empty">${e.message}</div>`; return; }

  const matches = data.matches;
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
  content.appendChild(nav);
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
    content.appendChild(card);
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

function centerHtml(m) {
  if (!m.locked) {
    return `<div class="score-input">
        <input type="number" min="0" max="99" class="in-home" value="${m.myTip ? m.myTip.home : ""}" aria-label="Tore ${esc(m.home)}"/>
        <i>:</i>
        <input type="number" min="0" max="99" class="in-away" value="${m.myTip ? m.myTip.away : ""}" aria-label="Tore ${esc(m.away)}"/>
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
    ih.addEventListener("change", saveTip);
    ia.addEventListener("change", saveTip);
  } else {
    const wrap = el(`<div class="tips-compare"></div>`);
    for (const t of m.tips) wrap.appendChild(tipCard(t, m));
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
  const s = standings.standings;
  const matches = matchesData.matches;
  content.innerHTML = "";

  if (s.length === 2) {
    const [a, b] = s;
    const diff = a.points - b.points;
    const tie = diff === 0;
    const lead = tie ? "Gleichstand! 🤝 Jeder Tipp zählt." : `<b>${esc(a.name)}</b> führt mit ${diff} Punkt${diff === 1 ? "" : "en"}.`;
    const sbCard = (p, rank, isLeader) => {
      const color = themeFor(p.name).color;
      const me = p.userId === state.user.id;
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
        ${sbCard(a, tie ? "🤝" : "🥇", !tie)}
        <div class="sb-mid"><div class="sb-vs">VS</div></div>
        ${sbCard(b, tie ? "🤝" : "🥈", false)}
      </div>`));
    content.appendChild(el(`<div class="lead-msg">${lead}</div>`));
  } else {
    const medals = ["🥇", "🥈", "🥉"];
    for (let i = 0; i < s.length; i++) {
      const p = s[i];
      content.appendChild(el(`
        <div class="card" style="--pc:${themeFor(p.name).color};display:flex;align-items:center;gap:12px">
          <span style="font-size:20px">${medals[i] || (i + 1)}</span>
          <span style="font-weight:700;flex:1">${esc(p.name)}${p.userId === state.user.id ? " (du)" : ""}</span>
          <span style="font-size:22px;font-weight:900;color:var(--pc)">${p.points}</span>
        </div>`));
    }
    if (!s.length) content.appendChild(el(`<div class="empty">Noch keine Spieler.</div>`));
  }

  // ----- Zusatz-Statistiken aus den Spielen -----
  const finished = matches.filter(m => m.homeScore != null);
  if (s.length === 2 && finished.length) {
    const ids = s.map(p => p.userId);
    const info = {};
    s.forEach(p => info[p.userId] = { name: p.name, color: themeFor(p.name).color, duel: 0, best: null });
    let draws = 0;
    const dayMap = new Map();
    for (const m of finished) {
      const pm = {};
      for (const t of m.tips) {
        if (!t.tip) continue;
        pm[t.userId] = t.points || 0;
        const b = info[t.userId];
        if (b && (!b.best || (t.points || 0) > b.best.pts))
          b.best = { pts: t.points || 0, label: `${m.home} ${m.homeScore}:${m.awayScore}`, tip: `${t.tip.home}:${t.tip.away}` };
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
        ${bestRow(s[0])}${bestRow(s[1])}
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

  // Punkte-Regeln
  const p = state.points;
  const exact = p.winner + p.difference + 2 * p.goalPerTeam;
  content.appendChild(el(`
    <div class="card rules">
      <div class="section-title" style="margin-top:0">So gibt's Punkte – alles wird addiert</div>
      <ul class="rules-list">
        <li><span>Richtige Tendenz (Sieger oder Remis)</span><b>+${p.winner}</b></li>
        <li><span>Richtige Tordifferenz</span><b>+${p.difference}</b></li>
        <li><span>Richtige Tore Heimteam</span><b>+${p.goalPerTeam}</b></li>
        <li><span>Richtige Tore Gastteam</span><b>+${p.goalPerTeam}</b></li>
      </ul>
      <div class="rules-foot">Tipp komplett richtig = <b>${exact} Punkte</b></div>
    </div>`));
}

// ============ Ergebnisse aktualisieren ============
async function renderResults(content) {
  showSkeleton(content, 1);
  let data;
  try { data = await api("GET", "/api/matches"); }
  catch (e) { content.innerHTML = `<div class="empty">${e.message}</div>`; return; }

  const finished = data.matches.filter(m => m.homeScore != null).length;
  const total = data.matches.length;

  content.innerHTML = "";
  const card = el(`
    <div class="card sync-card">
      <div class="sync-icon">🔄</div>
      <h2 class="sync-title">Ergebnisse aktualisieren</h2>
      <p class="muted sync-desc">Holt die echten WM-Ergebnisse aus dem offiziellen Spielplan und berechnet die Punkte neu.</p>
      <div class="sync-stat"><b>${finished}</b> von ${total} Spielen ausgewertet</div>
      <button class="btn" id="sync-btn">Jetzt aktualisieren</button>
      <div class="save-hint" id="sync-hint"></div>
    </div>
  `);
  content.appendChild(card);

  const btn = card.querySelector("#sync-btn");
  const hint = card.querySelector("#sync-hint");
  btn.onclick = async () => {
    btn.disabled = true; btn.textContent = "⏳ Hole Ergebnisse…"; hint.textContent = ""; hint.classList.remove("ok");
    try {
      const r = await api("POST", "/api/results/sync");
      hint.textContent = r.updated > 0
        ? `✓ ${r.updated} Ergebnis(se) aktualisiert.`
        : `Alles aktuell – keine neuen Ergebnisse.`;
      hint.classList.add("ok");
      setTimeout(() => renderResults(content), 1100);
    } catch (e) {
      hint.textContent = "Fehler: " + e.message;
      btn.disabled = false; btn.textContent = "Jetzt aktualisieren";
    }
  };
}

init();
