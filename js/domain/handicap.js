/**
 * Hándicap asiático a partir de la grilla de marcadores.
 *
 * - Líneas enteras (0, ±1): con diferencia exacta se devuelve la apuesta.
 * - Líneas medias (±0.5, ±1.5): no hay devolución.
 * - Líneas de cuarto (±0.25, ±0.75): la apuesta se parte en dos mitades, una en cada
 *   línea vecina. El resultado es el promedio de ambas, que equivale a sumar
 *   "media ganada" y "media perdida" y deja intacta la fórmula del EV.
 */

/** @typedef {import('../types.js').Outcome} Outcome */

const QUARTER = 0.25;

/** Distribución de la diferencia de goles (local − visita): Map(diferencia -> probabilidad). */
export function marginDistribution(grid) {
  const margins = new Map();
  grid.cells.forEach((row, homeGoals) => {
    row.forEach((probability, awayGoals) => {
      const margin = homeGoals - awayGoals;
      margins.set(margin, (margins.get(margin) ?? 0) + probability);
    });
  });
  return margins;
}

function isQuarterLine(line) {
  return Math.abs((Math.abs(line) % 0.5) - QUARTER) < 1e-9;
}

/** Resultado en una línea entera o media, desde la perspectiva de quien suma `line` a su diferencia. */
function simpleOutcome(margins, line) {
  let win = 0;
  let push = 0;
  margins.forEach((probability, margin) => {
    const adjusted = margin + line;
    if (adjusted > 1e-9) win += probability;
    else if (Math.abs(adjusted) <= 1e-9) push += probability;
  });
  return { win, push, loss: Math.max(0, 1 - win - push) };
}

function averageOutcomes(first, second) {
  return {
    win: (first.win + second.win) / 2,
    push: (first.push + second.push) / 2,
    loss: (first.loss + second.loss) / 2,
  };
}

/**
 * @param {Map<number, number>} margins  ver marginDistribution
 * @param {number} homeLine  hándicap del local (el visitante tiene el opuesto)
 * @param {'home'|'away'} side
 * @returns {Outcome}
 */
export function asianHandicapOutcome(margins, homeLine, side) {
  const sideMargins = side === 'home' ? margins : new Map([...margins].map(([margin, p]) => [-margin, p]));
  const line = side === 'home' ? homeLine : -homeLine;
  if (!isQuarterLine(line)) return simpleOutcome(sideMargins, line);
  return averageOutcomes(simpleOutcome(sideMargins, line - QUARTER), simpleOutcome(sideMargins, line + QUARTER));
}
