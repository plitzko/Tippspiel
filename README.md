# ⚽ WM 2026 Tippspiel

Ein kleines Online-Tippspiel für zwei Personen. Ihr tippt die Ergebnisse der
WM-Spiele, ein:e Admin trägt die echten Resultate ein, und die App berechnet
automatisch Punkte und Rangliste.

## Features

- 👋 **Kein Login** – beim ersten Start legt ihr einfach eure beiden Namen an.
  Danach klickt man sich nur noch über „Wer bist du?" an (max. 2 Spieler).
- ⚽ **Tippen bis zum Anpfiff** – danach ist das Spiel automatisch gesperrt.
  Die Tipps des anderen werden erst **nach Anpfiff** sichtbar (kein Spicken!).
- ⚙️ **Spiele verwalten** – beide Spieler können Spiele anlegen, bearbeiten und
  Ergebnisse eintragen.
- 🏆 **Punkte & Rangliste** automatisch, plus Head-to-Head-Vergleich.
- 💾 Daten liegen in einer einfachen JSON-Datei (`data/db.json`) – keine
  Datenbank-Installation nötig.

### Punkte-Schema (voll additiv)

Alle zutreffenden Bausteine eines Tipps werden **addiert**:

| Kriterium | Punkte |
|-----------|--------|
| Richtige Tendenz (Sieger bzw. Remis) | **+1** |
| Richtige Tordifferenz | **+2** |
| Richtige Toranzahl Heimteam | **+1** |
| Richtige Toranzahl Gastteam | **+1** |

Daraus folgt: ein **exakt richtiger Tipp** gibt 1 + 2 + 1 + 1 = **5 Punkte**.

Beispiele:
- Tipp 2:1 → Ergebnis 2:1 = **5** (Sieger + Differenz + beide Tore)
- Tipp 2:0 → Ergebnis 3:1 = **3** (Sieger + Differenz)
- Tipp 2:1 → Ergebnis 3:2 = **3** (Sieger + Differenz)
- Tipp 1:1 → Ergebnis 0:0 = **3** (Remis + Differenz)
- Tipp 2:0 → Ergebnis 2:1 = **2** (Sieger + Heim-Tore)
- Tipp 2:1 → Ergebnis 0:1 = **1** (nur Gast-Tore richtig)

Ändern lässt sich das in `db.js` (`config.points`:
`difference`, `winner`, `goalPerTeam`).

## WM-2026-Spielplan laden

Die **72 Gruppenspiele der WM 2026** (echte Paarungen & Anstoßzeiten, deutsche
Teamnamen) liegen in [`wm2026-fixtures.json`](wm2026-fixtures.json) und lassen
sich mit einem Befehl eintragen:

```bash
node seed.js
```

Das Skript ist **idempotent**: Es ersetzt vorhandene „Gruppe X"-Spiele, lässt
selbst angelegte Spiele, eure Spieler und alle Tipps aber unangetastet. Bei
einem erneuten Aufruf werden die Spiele also nicht verdoppelt.

> Die **K.-o.-Runde** (Sechzehntelfinale bis Finale) wird **automatisch**
> ergänzt, sobald die Teilnehmer feststehen – der Ergebnis-Sync trägt die
> Spiele samt Teams, Runde und Anpfiff selbst ein.

> Datenquelle: [fixturedownload.com](https://fixturedownload.com/results/fifa-world-cup-2026)
> (Gruppen gegengeprüft mit ESPN & NBC Sports).

## Ergebnisse automatisch holen

Die echten WM-Resultate müssen nicht von Hand eingegeben werden:

- **In der App:** Im Tab „Spiele" auf **🔄 Jetzt holen** klicken. Die App lädt
  die aktuellen Ergebnisse vom Feed, trägt sie ein und die Punkte/Rangliste
  aktualisieren sich sofort.
- **Per Kommandozeile** (z.B. für einen Cronjob / die Windows-Aufgabenplanung):

  ```bash
  node update-results.js
  ```

  Läuft der Server dabei, danach einmal neu starten, damit er die neuen Daten
  aus der Datei lädt. Im laufenden Betrieb ist der Button die bequemere Wahl.

Eingetragen werden nur bereits **abgeschlossene** Spiele; kommende bleiben offen.
Datenquelle ist derselbe Feed wie beim Spielplan
([fixturedownload.com](https://fixturedownload.com/results/fifa-world-cup-2026)).

## Lokal starten

```bash
npm install
npm start
```

Dann im Browser **http://localhost:3000** öffnen.

Beim ersten Start: Spieler 1 registriert sich (= Admin), danach Spieler 2.
Auf demselben Rechner geht's am einfachsten in zwei verschiedenen Browsern
oder Profilen.

## Online stellen (von überall tippen)

Damit ihr beide von Handy/Laptop tippen könnt, die App bei einem kostenlosen
Hoster deployen. Beispiel **Render.com**:

1. Code in ein GitHub-Repo legen.
2. Auf render.com → *New* → *Web Service* → Repo auswählen.
3. Einstellungen:
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
4. Wichtig für dauerhafte Daten: unter *Disks* ein **persistentes Volume**
   anlegen (z.B. gemountet auf `/data`) und die Umgebungsvariable
   `DB_FILE=/data/db.json` setzen. Sonst werden die Tipps bei jedem Neustart
   zurückgesetzt.

Alternativen mit dem gleichen Prinzip: Railway, Fly.io, eigener Server.

> Der Port wird automatisch über `process.env.PORT` gesetzt – beim Hoster
> musst du dich darum nicht kümmern.

## Daten zurücksetzen

Einfach die Datei `data/db.json` löschen (oder das ganze `data/`-Verzeichnis).
Beim nächsten Start beginnt alles von vorn inkl. neuer Registrierung.

## Projektstruktur

```
server.js        – Express-Server + API
db.js            – JSON-Datei-Speicher
public/
  index.html     – Einstieg
  app.js         – komplette Frontend-Logik (kein Framework)
  style.css      – Styling
data/db.json     – wird automatisch angelegt (nicht im Git)
```
