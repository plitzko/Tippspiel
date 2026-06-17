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
    // Punkte-Schema (voll additiv): richtige Tendenz (winner) + richtige
    // Tordifferenz (difference) + je richtige Mannschafts-Toranzahl (goalPerTeam)
    // werden alle addiert. "Alles richtig" = 1 + 2 + 1 + 1 = 5.
    points: { difference: 2, winner: 1, goalPerTeam: 1 }
  }
};

function ensureDir() {
  const dir = path.dirname(DB_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

export function load() {
  ensureDir();
  if (!fs.existsSync(DB_FILE)) {
    // Erststart: falls ein mitgelieferter Stand (data/db.json) existiert und
    // DB_FILE woanders liegt (z.B. Hosting-Volume), diesen als Startzustand
    // uebernehmen – so sind Spieler/Tipps nach dem Deployment direkt da.
    const bundled = path.join(__dirname, "data", "db.json");
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
