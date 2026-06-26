import express from "express";
import crypto from "crypto";
import path from "path";
import { fileURLToPath } from "url";
import { load, saveSync } from "./db.js";
import { syncResults, fetchBracket } from "./sync-results.js";
import { breakdownFor, pointsFor, isKnockout } from "./scoring.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;
const MAX_USERS = 2; // Tippspiel fuer zwei Personen

// --- Daten im Speicher, persistiert in JSON-Datei ---
const db = load();
function persist() { saveSync(db); }

// Aktuellen Spieler aus dem Header lesen (kein Login, nur Identifikation)
function userFromReq(req) {
  const id = req.headers["x-user-id"];
  if (!id) return null;
  return db.users.find(u => u.id === id) || null;
}
function publicUser(u) {
  return u ? { id: u.id, name: u.name } : null;
}
function requireUser(req, res, next) {
  const user = userFromReq(req);
  if (!user) return res.status(401).json({ error: "Kein Spieler ausgewaehlt" });
  req.user = user;
  next();
}

// Punkteberechnung liegt in scoring.js (von Server und Skripten gemeinsam genutzt).

const isStarted = (m) => new Date(m.kickoff).getTime() <= Date.now();

// --- Middleware ---
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// === API ===

// Liste der Spieler + Punkte-Schema
app.get("/api/status", (req, res) => {
  const koExists = db.matches.some(isKnockout);
  const phasePoints = (u, wantKo) => {
    let pts = 0;
    for (const m of db.matches) {
      if (m.homeScore == null || m.awayScore == null) continue;
      if (isKnockout(m) !== wantKo) continue;
      const t = db.tips.find(x => x.matchId === m.id && x.userId === u.id);
      pts += t ? (pointsFor(t, m, db.config) || 0) : 0;
    }
    return pts;
  };
  // Turnierende + Gesamtsieger (Gruppen- plus K.o.-Punkte)
  const finalMatch = db.matches.find(m => m.stage === "Finale");
  const tournamentOver = !!(finalMatch && finalMatch.homeScore != null && finalMatch.awayScore != null);
  let champion = null;
  if (tournamentOver) {
    const totals = db.users
      .map(u => ({ name: u.name, pts: phasePoints(u, false) + phasePoints(u, true) }))
      .sort((a, b) => b.pts - a.pts);
    champion = (totals.length >= 2 && totals[0].pts === totals[1].pts) ? "tie" : (totals[0] ? totals[0].name : null);
  }

  res.json({
    players: db.users.map(u => ({ ...publicUser(u), group: phasePoints(u, false), ko: phasePoints(u, true) })),
    phase: koExists ? "ko" : "group",
    canAddPlayer: db.users.length < MAX_USERS,
    points: db.config.points,
    ko: db.config.ko,
    tournamentOver,
    champion
  });
});

// Neuen Spieler anlegen (nur solange < MAX_USERS)
app.post("/api/players", (req, res) => {
  const { name } = req.body || {};
  if (!name || !name.trim()) return res.status(400).json({ error: "Name noetig" });
  if (db.users.length >= MAX_USERS) return res.status(403).json({ error: "Es gibt schon zwei Spieler" });
  if (db.users.some(u => u.name.toLowerCase() === name.trim().toLowerCase()))
    return res.status(409).json({ error: "Name bereits vergeben" });
  const user = { id: "u" + crypto.randomBytes(4).toString("hex"), name: name.trim() };
  db.users.push(user);
  persist();
  res.json({ player: publicUser(user) });
});

// Alle Spiele inkl. eigener Tipps; Tipps des anderen erst nach Anpfiff sichtbar
app.get("/api/matches", requireUser, (req, res) => {
  const me = req.user.id;
  const matches = [...db.matches].sort((a, b) => new Date(a.kickoff) - new Date(b.kickoff));
  const result = matches.map(m => {
    const started = isStarted(m);
    const allTips = db.tips.filter(t => t.matchId === m.id);
    const myTip = allTips.find(t => t.userId === me) || null;
    // Tipps aller Spieler nur, wenn das Spiel begonnen hat
    const visibleTips = db.users.map(u => {
      const t = allTips.find(x => x.userId === u.id);
      const reveal = started || u.id === me;
      const bd = (reveal && t) ? breakdownFor(t, m, db.config) : null;
      return {
        userId: u.id,
        name: u.name,
        tip: reveal && t ? { home: t.home, away: t.away } : null,
        hasTip: !!t,
        points: t ? pointsFor(t, m, db.config) : (started ? 0 : null),
        breakdown: bd ? bd.parts : null
      };
    });
    return {
      id: m.id,
      home: m.home,
      away: m.away,
      kickoff: m.kickoff,
      stage: m.stage || "",
      location: m.location || null,
      homeScore: m.homeScore,
      awayScore: m.awayScore,
      started,
      locked: started,
      myTip: myTip ? { home: myTip.home, away: myTip.away } : null,
      tips: visibleTips
    };
  });
  res.json({ matches: result });
});

// Kompletter K.o.-Baum aus dem Feed (inkl. noch offener Paarungen), kurz gecacht
let bracketCache = { at: 0, data: null };
app.get("/api/bracket", requireUser, async (req, res) => {
  try {
    if (!bracketCache.data || Date.now() - bracketCache.at > 180000) {
      bracketCache = { at: Date.now(), data: await fetchBracket() };
    }
    res.json({ bracket: bracketCache.data });
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
});

// Tipp abgeben/aendern (nur vor Anpfiff)
app.post("/api/tips", requireUser, (req, res) => {
  const { matchId, home, away } = req.body || {};
  const match = db.matches.find(m => m.id === matchId);
  if (!match) return res.status(404).json({ error: "Spiel nicht gefunden" });
  if (isStarted(match)) return res.status(403).json({ error: "Spiel hat bereits begonnen" });
  const h = Number(home), a = Number(away);
  if (!Number.isInteger(h) || !Number.isInteger(a) || h < 0 || a < 0 || h > 99 || a > 99)
    return res.status(400).json({ error: "Ungueltiges Ergebnis" });
  let tip = db.tips.find(t => t.matchId === matchId && t.userId === req.user.id);
  if (tip) { tip.home = h; tip.away = a; tip.updatedAt = Date.now(); }
  else db.tips.push({ userId: req.user.id, matchId, home: h, away: a, createdAt: Date.now() });
  persist();
  res.json({ ok: true });
});

// Rangliste – getrennt nach Gruppenphase und K.o.-Phase
app.get("/api/standings", requireUser, (req, res) => {
  const phaseStats = (inPhase) => db.users.map(u => {
    let points = 0, exact = 0, tips = 0, finished = 0;
    for (const m of db.matches) {
      if (!inPhase(m)) continue;
      const t = db.tips.find(x => x.matchId === m.id && x.userId === u.id);
      if (t) tips++;
      if (m.homeScore != null && m.awayScore != null) {
        finished++;
        points += t ? (pointsFor(t, m, db.config) || 0) : 0;
        if (t && t.home === m.homeScore && t.away === m.awayScore) exact++;
      }
    }
    return { userId: u.id, name: u.name, points, exact, tips, finished };
  }).sort((a, b) => b.points - a.points || b.exact - a.exact);

  res.json({
    group: phaseStats(m => !isKnockout(m)),
    ko: phaseStats(m => isKnockout(m))
  });
});

// --- Spiele verwalten (beide Spieler duerfen das) ---
app.post("/api/matches", requireUser, (req, res) => {
  const { home, away, kickoff, stage } = req.body || {};
  if (!home || !away || !kickoff) return res.status(400).json({ error: "Heim, Gast und Anpfiff noetig" });
  if (isNaN(new Date(kickoff).getTime())) return res.status(400).json({ error: "Ungueltiges Datum" });
  const match = {
    id: "m" + crypto.randomBytes(4).toString("hex"),
    home: home.trim(),
    away: away.trim(),
    kickoff: new Date(kickoff).toISOString(),
    stage: (stage || "").trim(),
    homeScore: null,
    awayScore: null
  };
  db.matches.push(match);
  persist();
  res.json({ match });
});

app.put("/api/matches/:id", requireUser, (req, res) => {
  const match = db.matches.find(m => m.id === req.params.id);
  if (!match) return res.status(404).json({ error: "Spiel nicht gefunden" });
  const { home, away, kickoff, stage } = req.body || {};
  if (home != null) match.home = String(home).trim();
  if (away != null) match.away = String(away).trim();
  if (stage != null) match.stage = String(stage).trim();
  if (kickoff != null) {
    if (isNaN(new Date(kickoff).getTime())) return res.status(400).json({ error: "Ungueltiges Datum" });
    match.kickoff = new Date(kickoff).toISOString();
  }
  persist();
  res.json({ match });
});

// Ergebnis eintragen (null loescht das Ergebnis wieder)
app.put("/api/matches/:id/result", requireUser, (req, res) => {
  const match = db.matches.find(m => m.id === req.params.id);
  if (!match) return res.status(404).json({ error: "Spiel nicht gefunden" });
  const { homeScore, awayScore } = req.body || {};
  if (homeScore === null || awayScore === null || homeScore === "" || awayScore === "") {
    match.homeScore = null; match.awayScore = null;
  } else {
    const h = Number(homeScore), a = Number(awayScore);
    if (!Number.isInteger(h) || !Number.isInteger(a) || h < 0 || a < 0)
      return res.status(400).json({ error: "Ungueltiges Ergebnis" });
    match.homeScore = h; match.awayScore = a;
  }
  persist();
  res.json({ match });
});

// Echte WM-Ergebnisse automatisch vom Feed holen und eintragen
app.post("/api/results/sync", requireUser, async (req, res) => {
  try {
    const stats = await syncResults(db);
    if (stats.updated > 0 || stats.added > 0) persist();
    res.json(stats);
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
});

app.delete("/api/matches/:id", requireUser, (req, res) => {
  db.matches = db.matches.filter(m => m.id !== req.params.id);
  db.tips = db.tips.filter(t => t.matchId !== req.params.id);
  persist();
  res.json({ ok: true });
});

// Fallback auf die SPA
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
  console.log(`\n  WM-Tippspiel laeuft auf http://localhost:${PORT}\n`);
});

// --- Automatischer Ergebnis-Abruf ---
// Solange es angepfiffene Spiele ohne Ergebnis gibt, regelmaessig den Feed
// abfragen. So tauchen Resultate kurz nach Spielende von selbst auf.
const SYNC_INTERVAL_MS = Number(process.env.SYNC_INTERVAL_MIN || 3) * 60 * 1000;

async function autoSync(reason) {
  try {
    const stats = await syncResults(db);
    if (stats.updated > 0 || stats.added > 0) {
      persist();
      console.log(`[auto-sync/${reason}] +${stats.added} Spiele, ${stats.updated} Ergebnis(se) aktualisiert`);
    }
  } catch (e) {
    console.warn(`[auto-sync/${reason}] fehlgeschlagen: ${e.message}`);
  }
}

// Gibt es bereits begonnene Spiele, die noch kein Ergebnis haben?
function hasPendingResults() {
  const now = Date.now();
  return db.matches.some(m => m.homeScore == null && new Date(m.kickoff).getTime() <= now);
}
// Laeuft das Turnier noch? (bis kurz nach dem Finale) – dann K.o.-Teams nachziehen
function tournamentOngoing() {
  return Date.now() < Date.parse("2026-07-21T00:00:00Z");
}

let syncTick = 0;
autoSync("startup");
setInterval(() => {
  syncTick++;
  if (hasPendingResults()) autoSync("live");                              // alle 3 Min waehrend Spiele laufen
  else if (tournamentOngoing() && syncTick % 10 === 0) autoSync("populate"); // ~alle 30 Min K.o.-Spiele/Teams nachziehen
}, SYNC_INTERVAL_MS);
