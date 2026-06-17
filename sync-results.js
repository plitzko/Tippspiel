// Holt die echten WM-2026-Ergebnisse vom offenen Feed und traegt sie in die DB ein.
// Wird sowohl vom Server (Button) als auch vom CLI-Skript update-results.js genutzt.

const FEED_URL = process.env.FEED_URL || "https://fixturedownload.com/feed/json/fifa-world-cup-2026";

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

// Holt den Feed und schreibt fertige Ergebnisse in die uebergebene DB (mutiert db.matches).
// Gibt Statistik zurueck: { updated, unchanged, withResult, notFound }.
export async function syncResults(db) {
  const res = await fetch(FEED_URL, { headers: { "User-Agent": "WM-Tippspiel" } });
  if (!res.ok) throw new Error(`Feed nicht erreichbar (HTTP ${res.status})`);
  const feed = await res.json();

  // Schnellzugriff auf unsere Spiele per "Heim|Gast" (deutsche Namen)
  const byPair = new Map();
  for (const m of db.matches) byPair.set(`${m.home}|${m.away}`, m);

  let updated = 0, unchanged = 0, withResult = 0, notFound = 0;
  for (const f of feed) {
    if (f.HomeTeamScore == null || f.AwayTeamScore == null) continue; // noch kein Ergebnis
    withResult++;
    const match = byPair.get(`${de(f.HomeTeam)}|${de(f.AwayTeam)}`);
    if (!match) { notFound++; continue; } // z.B. K.-o.-Spiele, die wir nicht fuehren
    const h = Number(f.HomeTeamScore), a = Number(f.AwayTeamScore);
    if (match.homeScore === h && match.awayScore === a) { unchanged++; continue; }
    match.homeScore = h;
    match.awayScore = a;
    updated++;
  }
  return { updated, unchanged, withResult, notFound };
}
