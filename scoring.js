// Punkteberechnung – gemeinsam genutzt von Server und Skripten.
// Zwei Phasen mit unterschiedlichen Systemen:
//   Gruppenphase (additiv): Tendenz + Differenz + je Mannschafts-Toranzahl, exakt = 5
//   K.o.-Phase (nur das Höchste zählt): exakt 5, Differenz 3, Sieger 2, eine Toranzahl 1

// Ein Spiel gehört zur K.o.-Phase, wenn die Phase nicht "Gruppe ..." ist.
export function isKnockout(match) {
  return !(typeof match.stage === "string" && match.stage.startsWith("Gruppe"));
}

// --- Gruppenphase: voll additiv ---
export function scoreBreakdown(tip, match, cfg) {
  if (match.homeScore == null || match.awayScore == null) return null; // noch kein Ergebnis
  if (tip == null || tip.home == null || tip.away == null) return { total: 0, parts: [] };
  const p = cfg.points;
  const parts = [];
  const tipDiff = tip.home - tip.away;
  const realDiff = match.homeScore - match.awayScore;
  if (Math.sign(tipDiff) === Math.sign(realDiff))
    parts.push({ label: realDiff === 0 ? "Remis" : "Sieger", pts: p.winner });
  if (tipDiff === realDiff)
    parts.push({ label: "Differenz", pts: p.difference });
  if (tip.home === match.homeScore) parts.push({ label: "Heim-Tore", pts: p.goalPerTeam });
  if (tip.away === match.awayScore) parts.push({ label: "Gast-Tore", pts: p.goalPerTeam });
  const total = parts.reduce((s, x) => s + x.pts, 0);
  return { total, parts };
}

// --- K.o.-Phase: nur die höchste zutreffende Stufe zählt ---
export function koBreakdown(tip, match, cfg) {
  if (match.homeScore == null || match.awayScore == null) return null;
  if (tip == null || tip.home == null || tip.away == null) return { total: 0, parts: [] };
  const p = cfg.ko;
  const td = tip.home - tip.away, rd = match.homeScore - match.awayScore;
  const part = (label, pts) => ({ total: pts, parts: [{ label, pts }] });
  if (tip.home === match.homeScore && tip.away === match.awayScore) return part("Exakt", p.exact);
  if (td === rd) return part("Differenz", p.difference);
  if (Math.sign(td) === Math.sign(rd)) return part(rd === 0 ? "Remis" : "Sieger", p.winner);
  if (tip.home === match.homeScore) return part("Heim-Tore", p.goalPerTeam);
  if (tip.away === match.awayScore) return part("Gast-Tore", p.goalPerTeam);
  return { total: 0, parts: [] };
}

// --- Phasen-bewusste Helfer ---
export function breakdownFor(tip, match, config) {
  return isKnockout(match) ? koBreakdown(tip, match, config) : scoreBreakdown(tip, match, config);
}
export function pointsFor(tip, match, config) {
  const b = breakdownFor(tip, match, config);
  return b ? b.total : null;
}

// Rückwärtskompatibel (Gruppenphase)
export function pointsForTip(tip, match, cfg) {
  const b = scoreBreakdown(tip, match, cfg);
  return b ? b.total : null;
}
