// ============ State + API ============
const TITLE = "Linas & Maxis WM Tippspiel";

const state = {
  userId: localStorage.getItem("userId") || null,
  user: null,
  tab: "tippen",
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
const fmtDate = (iso) => new Date(iso).toLocaleString("de-DE", {
  weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit"
});
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

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
  // Mobile-Statusleiste / Browser-UI in Spielerfarbe (dunkle Tönung)
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", name ? darken(t.color, 0.55) : "#0a0e1a");
}

// ---- Flaggen (deutscher Name -> ISO-Code für flagcdn.com) ----
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
  if (me) {
    state.user = me;
    renderApp();
  } else {
    setUser(null);
    applyTheme(null);
    renderPlayerSelect(status);
  }
}

// ============ "Wer bist du?" ============
function renderPlayerSelect(status) {
  const view = el(`
    <div class="auth-wrap">
      <div class="brand" style="justify-content:center;margin-bottom:22px">
        <span class="logo">⚽</span>
        <h1>${TITLE}<small>Tippt die WM 2026 – wer kennt sich besser aus?</small></h1>
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
        <span class="pavatar">${esc(p.name[0] || "?").toUpperCase()}</span>
        <span>${esc(p.name)}</span>
        <span class="arrow">→</span>
      </button>`);
    b.onclick = () => { setUser(p); state.tab = "tippen"; renderApp(); };
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
      try {
        const data = await api("POST", "/api/players", { name });
        setUser(data.player); state.tab = "tippen"; renderApp();
      } catch (e) { err.textContent = e.message; }
    };
    form.querySelector("#ps-create").onclick = create;
    form.querySelector("#ps-name").addEventListener("keydown", e => { if (e.key === "Enter") create(); });
  }
}

// ============ Haupt-App ============
function renderApp() {
  applyTheme(state.user.name);
  const p = state.points;
  const exact = p.winner + p.difference + 2 * p.goalPerTeam;
  const tabs = [["tippen", "⚽ Tippen"], ["rangliste", "🏆 Rangliste"], ["verwalten", "⚙️ Spiele"]];

  const view = el(`
    <div>
      <div class="topbar">
        <div class="brand">
          <span class="logo">⚽</span>
          <h1>${TITLE}<small>${exact} P. exakt · ${p.difference} P. Differenz · ${p.winner} P. Sieger · ${p.goalPerTeam} P. je Mannschafts-Tor</small></h1>
        </div>
        <div class="userbox">
          <span class="me">${esc(state.user.name)}</span>
          <button class="btn secondary small" id="switch">Wechseln</button>
        </div>
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
  else if (state.tab === "verwalten") renderManage(content);
}

// ============ Tippen ============
async function renderMatches(content) {
  content.innerHTML = `<div class="empty">Lade Spiele…</div>`;
  let data;
  try { data = await api("GET", "/api/matches"); }
  catch (e) { content.innerHTML = `<div class="empty">${e.message}</div>`; return; }

  if (!data.matches.length) {
    content.innerHTML = `<div class="empty">Noch keine Spiele angelegt. Lege im Tab „Spiele" welche an.</div>`;
    return;
  }
  content.innerHTML = "";
  for (const m of data.matches) content.appendChild(matchCard(m));
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
    ? `<span class="status">${fmtDate(m.kickoff)}</span>`
    : (m.homeScore != null
        ? `<span class="status final">🔒 Endstand</span>`
        : `<span class="status live">🔒 läuft</span>`);

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

// ============ Rangliste / Scoreboard ============
async function renderStandings(content) {
  content.innerHTML = `<div class="empty">Lade…</div>`;
  let data;
  try { data = await api("GET", "/api/standings"); }
  catch (e) { content.innerHTML = `<div class="empty">${e.message}</div>`; return; }

  const s = data.standings;
  content.innerHTML = "";

  if (s.length === 2) {
    const [a, b] = s;
    const diff = a.points - b.points;
    const lead = diff === 0
      ? "Gleichstand! 🤝 Jeder Tipp zählt."
      : `<b>${esc(a.name)}</b> führt mit ${diff} Punkt${diff === 1 ? "" : "en"}.`;
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
    const tie = diff === 0;
    content.appendChild(el(`
      <div class="scoreboard">
        ${sbCard(a, tie ? "🤝" : "🥇", !tie)}
        <div class="sb-mid"><div class="sb-vs">VS</div></div>
        ${sbCard(b, tie ? "🤝" : "🥈", false)}
      </div>
    `));
    content.appendChild(el(`<div class="lead-msg">${lead}</div>`));
    return;
  }

  // Fallback (mehr/weniger als 2 Spieler)
  const medals = ["🥇", "🥈", "🥉"];
  const rows = s.map((p, i) => `
    <div class="card" style="--pc:${themeFor(p.name).color};display:flex;align-items:center;gap:12px">
      <span style="font-size:20px">${medals[i] || (i + 1)}</span>
      <span style="font-weight:700;flex:1">${esc(p.name)}${p.userId === state.user.id ? " (du)" : ""}</span>
      <span style="font-size:22px;font-weight:900;color:var(--pc)">${p.points}</span>
      <span class="muted">${p.exact} exakt · ${p.tips} Tipps</span>
    </div>`).join("");
  content.innerHTML = rows || `<div class="empty">Noch keine Spieler.</div>`;
}

// ============ Spiele verwalten ============
async function renderManage(content) {
  content.innerHTML = `<div class="empty">Lade…</div>`;
  let data;
  try { data = await api("GET", "/api/matches"); }
  catch (e) { content.innerHTML = `<div class="empty">${e.message}</div>`; return; }

  content.innerHTML = "";

  // Ergebnisse automatisch holen
  const syncCard = el(`
    <div class="card">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap">
        <div>
          <strong>Ergebnisse automatisch holen</strong>
          <div class="muted">Lädt die echten WM-Resultate und aktualisiert die Punkte.</div>
        </div>
        <button class="btn small" id="sync-btn">🔄 Jetzt holen</button>
      </div>
      <div class="save-hint" id="sync-hint"></div>
    </div>
  `);
  content.appendChild(syncCard);
  syncCard.querySelector("#sync-btn").onclick = async () => {
    const btn = syncCard.querySelector("#sync-btn");
    const hint = syncCard.querySelector("#sync-hint");
    btn.disabled = true; btn.textContent = "⏳ Hole…"; hint.textContent = ""; hint.classList.remove("ok");
    try {
      const s = await api("POST", "/api/results/sync");
      hint.textContent = s.updated > 0
        ? `✓ ${s.updated} Ergebnis(se) aktualisiert (${s.withResult} fertige Spiele insgesamt).`
        : `Keine neuen Ergebnisse – alles aktuell (${s.withResult} fertige Spiele).`;
      hint.classList.add("ok");
      if (s.updated > 0) setTimeout(() => renderManage(content), 900);
    } catch (e) { hint.textContent = "Fehler: " + e.message; }
    finally { btn.disabled = false; btn.textContent = "🔄 Jetzt holen"; }
  };

  // Neues Spiel anlegen
  const addCard = el(`
    <div class="card">
      <div class="section-title" style="margin-top:0">Neues Spiel anlegen</div>
      <div class="admin-grid">
        <div class="field"><label>Heim</label><input id="a-home" placeholder="z.B. Deutschland"/></div>
        <div class="field"><label>Gast</label><input id="a-away" placeholder="z.B. Brasilien"/></div>
        <div class="field"><label>Anpfiff</label><input id="a-kick" type="datetime-local"/></div>
        <div class="field"><label>Phase</label><input id="a-stage" placeholder="Gruppe A"/></div>
        <button class="btn small" id="a-add">+ Anlegen</button>
      </div>
      <div class="error" id="a-err"></div>
    </div>
  `);
  content.appendChild(addCard);
  addCard.querySelector("#a-add").onclick = async () => {
    const err = addCard.querySelector("#a-err");
    err.textContent = "";
    const body = {
      home: addCard.querySelector("#a-home").value.trim(),
      away: addCard.querySelector("#a-away").value.trim(),
      kickoff: addCard.querySelector("#a-kick").value,
      stage: addCard.querySelector("#a-stage").value.trim(),
    };
    if (!body.home || !body.away || !body.kickoff) { err.textContent = "Heim, Gast und Anpfiff sind nötig."; return; }
    try { await api("POST", "/api/matches", body); renderManage(content); }
    catch (e) { err.textContent = e.message; }
  };

  content.appendChild(el(`<div class="section-title">Spiele & Ergebnisse</div>`));
  if (!data.matches.length) { content.appendChild(el(`<div class="empty">Noch keine Spiele.</div>`)); return; }
  for (const m of data.matches) content.appendChild(manageMatchRow(m, content));
}

function manageMatchRow(m, content) {
  const card = el(`
    <div class="card">
      <div class="match-head">
        <span class="stage-badge">${esc(m.stage || "Spiel")}</span>
        <span class="status">${fmtDate(m.kickoff)}</span>
      </div>
      <div class="matchup">
        ${sideHtml(m.home, "home")}
        <div class="score-input">
          <input type="number" min="0" max="99" class="r-home" value="${m.homeScore ?? ""}"/>
          <i>:</i>
          <input type="number" min="0" max="99" class="r-away" value="${m.awayScore ?? ""}"/>
        </div>
        ${sideHtml(m.away, "away")}
      </div>
      <div class="row-actions">
        <button class="btn small r-save">Ergebnis speichern</button>
        <button class="btn small secondary r-clear">Ergebnis löschen</button>
        <button class="btn small danger r-del">Spiel löschen</button>
      </div>
      <div class="save-hint r-hint"></div>
    </div>
  `);
  const hint = card.querySelector(".r-hint");
  const setHint = (txt, ok) => { hint.textContent = txt; hint.classList.toggle("ok", !!ok); };

  card.querySelector(".r-save").onclick = async () => {
    try {
      await api("PUT", `/api/matches/${m.id}/result`, {
        homeScore: card.querySelector(".r-home").value,
        awayScore: card.querySelector(".r-away").value,
      });
      setHint("✓ Ergebnis gespeichert – Punkte aktualisiert", true);
    } catch (e) { setHint(e.message, false); }
  };
  card.querySelector(".r-clear").onclick = async () => {
    try {
      await api("PUT", `/api/matches/${m.id}/result`, { homeScore: null, awayScore: null });
      card.querySelector(".r-home").value = ""; card.querySelector(".r-away").value = "";
      setHint("Ergebnis gelöscht", true);
    } catch (e) { setHint(e.message, false); }
  };
  card.querySelector(".r-del").onclick = async () => {
    if (!confirm(`Spiel "${m.home} – ${m.away}" wirklich löschen? Alle Tipps dazu gehen verloren.`)) return;
    try { await api("DELETE", `/api/matches/${m.id}`); renderManage(content); }
    catch (e) { setHint(e.message, false); }
  };
  return card;
}

init();
