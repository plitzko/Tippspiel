// Winziger JSON-Datei-Speicher. Keine externe DB noetig.
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Speicherort ueberschreibbar (z.B. fuer Hosting mit persistentem Volume)
const DB_FILE = process.env.DB_FILE || path.join(__dirname, "data", "db.json");

const DEFAULT_DATA = {
  users: [],
  matches: [],
  tips: [],
  sessions: [],
  config: {
    // Gruppenphase (additiv): Tendenz + Differenz + je Mannschafts-Toranzahl, exakt = 5
    points: { difference: 2, winner: 1, goalPerTeam: 1 },
    // K.o.-Phase (nur das Höchste zählt): exakt 5, Differenz 3, Sieger 2, eine Toranzahl 1
    ko: { exact: 5, difference: 3, winner: 2, goalPerTeam: 1 }
  }
};

function ensureDir() {
  const dir = path.dirname(DB_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

export function load() {
  ensureDir();
  if (!fs.existsSync(DB_FILE)) {
    // Erststart: falls ein mitgelieferter Seed-Stand (data/seed-db.json)
    // existiert und DB_FILE woanders liegt (z.B. Hosting-Volume), diesen als
    // Startzustand uebernehmen – so sind Spieler/Tipps nach dem Deployment da.
    // Die Live-Datei selbst ist NICHT versioniert; nur dieser Seed.
    const bundled = path.join(__dirname, "data", "seed-db.json");
    if (path.resolve(DB_FILE) !== path.resolve(bundled) && fs.existsSync(bundled)) {
      fs.copyFileSync(bundled, DB_FILE);
    } else {
      saveSync(DEFAULT_DATA);
      return structuredClone(DEFAULT_DATA);
    }
  }
  try {
    const raw = fs.readFileSync(DB_FILE, "utf8");
    const data = JSON.parse(raw);
    // fehlende Felder ergaenzen (Vorwaertskompatibilitaet), inkl. Punkte-Schema
    const merged = { ...structuredClone(DEFAULT_DATA), ...data };
    merged.config = { ...DEFAULT_DATA.config, ...(data.config || {}) };
    merged.config.points = { ...DEFAULT_DATA.config.points, ...(data.config?.points || {}) };
    merged.config.ko = { ...DEFAULT_DATA.config.ko, ...(data.config?.ko || {}) };
    return merged;
  } catch (e) {
    console.error("DB konnte nicht gelesen werden, nutze Default:", e.message);
    return structuredClone(DEFAULT_DATA);
  }
}

// Synchrones, atomares Speichern (erst in .tmp schreiben, dann umbenennen)
export function saveSync(data) {
  ensureDir();
  const tmp = DB_FILE + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, DB_FILE);
}
