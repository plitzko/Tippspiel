// Spielt die WM-2026-Gruppenphase (72 Spiele) in die Datenbank ein.
// Idempotent: vorhandene "Gruppe X"-Spiele werden ersetzt, eigene Spiele
// und alle Tipps/Spieler bleiben erhalten.
//
//   node seed.js
//
import fs from "fs";
import crypto from "crypto";
import path from "path";
import { fileURLToPath } from "url";
import { load, saveSync } from "./db.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixtures = JSON.parse(
  fs.readFileSync(path.join(__dirname, "wm2026-fixtures.json"), "utf8")
);

const db = load();

// bisherige Gruppenspiele entfernen (anhand der bekannten Paarung), Tipps dazu loeschen
const isGroupStage = (s) => typeof s === "string" && s.startsWith("Gruppe ");
const removedIds = new Set(db.matches.filter(m => isGroupStage(m.stage)).map(m => m.id));
db.matches = db.matches.filter(m => !isGroupStage(m.stage));
db.tips = db.tips.filter(t => !removedIds.has(t.matchId));

// neue Spiele einfuegen
let added = 0;
for (const f of fixtures) {
  db.matches.push({
    id: "m" + crypto.randomBytes(4).toString("hex"),
    home: f.home,
    away: f.away,
    kickoff: new Date(f.kickoff).toISOString(),
    stage: f.stage,
    homeScore: null,
    awayScore: null
  });
  added++;
}

saveSync(db);
console.log(`\n  ${added} WM-2026-Gruppenspiele eingetragen.`);
console.log(`  Spiele gesamt in der DB: ${db.matches.length}\n`);
