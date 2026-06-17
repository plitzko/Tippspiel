// Punkteberechnung (voll additiv) – gemeinsam genutzt von Server und Skripten.
// Alle zutreffenden Bausteine werden addiert:
//   richtige Tendenz (Sieger bzw. Remis): 'winner'
//   richtige Tordifferenz:                'difference'
//   richtige Toranzahl je Mannschaft:     'goalPerTeam' (pro Team)
// Exakt richtig = winner(1) + difference(2) + 2*goalPerTeam(1) = 5.

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

export function pointsForTip(tip, match, cfg) {
  const b = scoreBreakdown(tip, match, cfg);
  return b ? b.total : null;
}
