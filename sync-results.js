// Holt die echten WM-2026-Ergebnisse vom offenen Feed und traegt sie in die DB ein.
// Wird sowohl vom Server (Button) als auch vom CLI-Skript update-results.js genutzt.
import crypto from "crypto";

const FEED_URL = process.env.FEED_URL || "https://fixturedownload.com/feed/json/fifa-world-cup-2026";

// Rundenname der K.o.-Phase aus der Feed-Rundennummer
function koStage(f, maxNo) {
  switch (f.RoundNumber) {
    case 4: return "Sechzehntelfinale";
    case 5: return "Achtelfinale";
    case 6: return "Viertelfinale";
    case 7: return "Halbfinale";
    case 8: return f.MatchNumber === maxNo ? "Finale" : "Spiel um Platz 3";
    default: return "K.o.-Runde";
  }
}
const koKickoff = (f) => new Date(String(f.DateUtc).replace(" ", "T")).toISOString();

// Feed nutzt englische Teamnamen -> unsere deutschen Namen
const TEAMS_DE = {
  "Mexico": "Mexiko", "South Africa": "Südafrika", "Korea Republic": "Südkorea", "Czechia": "Tschechien",
  "Canada": "Kanada", "Bosnia and Herzegovina": "Bosnien-Herzegowina", "Qatar": "Katar", "Switzerland": "Schweiz",
  "Brazil": "Brasilien", "Morocco": "Marokko", "Haiti": "Haiti", "Scotland": "Schottland",
  "Australia": "Australien", "Paraguay": "Paraguay", "Türkiye": "Türkei", "USA": "USA",
  "Curaçao": "Curaçao", "Côte d'Ivoire": "Elfenbeinküste", "Ecuador": "Ecuador", "Germany": "Deutschland",
  "Japan": "Japan", "Netherlands": "Niederlande", "Sweden": "Schweden", "Tunisia": "Tunesien",
  "Belgium": "Belgien", "Egypt": "Ägypten", "IR Iran": "Iran", "New Zealand": "Neuseeland",
  "Cabo Verde": "Kap Verde", "Saudi Arabia": "Saudi-Arabien", "Spain": "Spanien", "Uruguay": "Uruguay",
  "France": "Frankreich", "Iraq": "Irak", "Norway": "Norwegen", "Senegal": "Senegal",
  "Algeria": "Algerien", "Argentina": "Argentinien", "Austria": "Österreich", "Jordan": "Jordanien",
  "Colombia": "Kolumbien", "Congo DR": "DR Kongo", "Portugal": "Portugal", "Uzbekistan": "Usbekistan",
  "Croatia": "Kroatien", "England": "England", "Ghana": "Ghana", "Panama": "Panama"
};
const de = (name) => TEAMS_DE[name] || name;

// Holt den Feed und aktualisiert die DB (mutiert db.matches):
//  - Gruppenspiele: Ergebnisse per Teamnamen zuordnen
//  - K.o.-Spiele: eintragen/aktualisieren, sobald beide Teams feststehen (per Spielnummer)
// Gibt Statistik zurueck: { updated, unchanged, withResult, notFound, added }.
export async function syncResults(db) {
  const res = await fetch(FEED_URL, { headers: { "User-Agent": "WM-Tippspiel" } });
  if (!res.ok) throw new Error(`Feed nicht erreichbar (HTTP ${res.status})`);
  const feed = await res.json();
  const maxNo = feed.reduce((m, f) => Math.max(m, f.MatchNumber || 0), 0);

  // Schnellzugriff auf Gruppenspiele per "Heim|Gast" (deutsche Namen)
  const byPair = new Map();
  for (const m of db.matches) byPair.set(`${m.home}|${m.away}`, m);

  let updated = 0, unchanged = 0, withResult = 0, notFound = 0, added = 0;

  const applyScore = (match, f) => {
    if (f.HomeTeamScore == null || f.AwayTeamScore == null) return;
    withResult++;
    const h = Number(f.HomeTeamScore), a = Number(f.AwayTeamScore);
    if (match.homeScore === h && match.awayScore === a) { unchanged++; return; }
    match.homeScore = h; match.awayScore = a; updated++;
  };

  for (const f of feed) {
    const isGroup = f.Group && String(f.Group).startsWith("Group");
    if (isGroup) {
      const match = byPair.get(`${de(f.HomeTeam)}|${de(f.AwayTeam)}`);
      if (!match) { if (f.HomeTeamScore != null) notFound++; continue; }
      applyScore(match, f);
    } else {
      // K.o.-Spiel: erst aufnehmen, wenn beide Teams bekannt sind
      const homeDe = TEAMS_DE[f.HomeTeam], awayDe = TEAMS_DE[f.AwayTeam];
      if (!homeDe || !awayDe) continue; // Teilnehmer stehen noch nicht fest
      let match = db.matches.find(m => m.feedMatch === f.MatchNumber);
      if (!match) {
        match = {
          id: "m" + crypto.randomBytes(4).toString("hex"),
          feedMatch: f.MatchNumber,
          home: homeDe, away: awayDe,
          kickoff: koKickoff(f),
          stage: koStage(f, maxNo),
          homeScore: null, awayScore: null
        };
        db.matches.push(match);
        added++;
      } else {
        match.home = homeDe; match.away = awayDe;
        match.stage = koStage(f, maxNo);
        if (f.DateUtc) match.kickoff = koKickoff(f);
      }
      applyScore(match, f);
    }
  }
  return { updated, unchanged, withResult, notFound, added };
}
