// Holt die echten WM-2026-Ergebnisse und traegt sie in die DB ein (Kommandozeile).
// Praktisch fuer einen Cronjob / die Windows-Aufgabenplanung.
//
//   node update-results.js
//
// Hinweis: Laeuft der Server gerade, danach neu starten, damit er die
// aktualisierten Daten aus der Datei laedt. Im laufenden Betrieb nutzt am
// besten den Button "Ergebnisse automatisch holen" in der App.
import { load, saveSync } from "./db.js";
import { syncResults } from "./sync-results.js";

const db = load();
try {
  const s = await syncResults(db);
  if (s.updated > 0) saveSync(db);
  console.log(`\n  ${s.updated} Ergebnis(se) aktualisiert, ${s.unchanged} unveraendert.`);
  console.log(`  Fertige Spiele im Feed: ${s.withResult}${s.notFound ? `, davon ${s.notFound} nicht zugeordnet (z.B. K.-o.-Runde)` : ""}.\n`);
} catch (e) {
  console.error("\n  Fehler:", e.message, "\n");
  process.exit(1);
}
