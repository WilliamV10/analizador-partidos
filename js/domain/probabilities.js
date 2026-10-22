/**
 * Probabilidades de los mercados principales a partir de la grilla de marcadores.
 */
import { probabilityWhere, totalGoalsDistribution } from './poisson.js';

/**
 * Resultado de apostar a "más de `line` goles": gana, devuelve (líneas enteras) o pierde.
 * @returns {import('../types.js').Outcome}
 */
export function overOutcome(distribution, line) {
  let win = 0;
  let push = 0;
  distribution.forEach((probability, total) => {
    if (total > line) win += probability;
    else if (total === line) push += probability;
  });
  return { win, push, loss: 1 - win - push };
}

function topScores(grid, count) {
  const scores = [];
  grid.cells.forEach((row, homeGoals) => {
    row.forEach((probability, awayGoals) => {
      scores.push({ home: homeGoals, away: awayGoals, probability });
    });
  });
  return scores.sort((a, b) => b.probability - a.probability).slice(0, count);
}

function firstGoal(grid) {
  const none = grid.cells[0][0];
  const totalLambda = grid.homeLambda + grid.awayLambda;
  const homeShare = totalLambda > 0 ? grid.homeLambda / totalLambda : 0.5;
  return { home: (1 - none) * homeShare, none, away: (1 - none) * (1 - homeShare) };
}

/**
 * @typedef {Object} Probabilities
 * @property {{ home: number, draw: number, away: number }} result
 * @property {{ homeDraw: number, drawAway: number, homeAway: number }} doubleChance
 * @property {number[]} totalDistribution
 * @property {Record<number, number>} overs
 * @property {number} btts
 * @property {number} homeScores
 * @property {number} awayScores
 * @property {{ home: number, none: number, away: number }} firstGoal
 * @property {{ home: number, away: number, probability: number }[]} topScores
 */

/**
 * @param {{ homeLambda: number, awayLambda: number, cells: number[][] }} grid
 * @param {{ goalLines: number[], topScores: number }} display
 * @returns {Probabilities}
 */
export function outcomeProbabilities(grid, display) {
  const home = probabilityWhere(grid, (h, a) => h > a);
  const draw = probabilityWhere(grid, (h, a) => h === a);
  const away = 1 - home - draw;
  const distribution = totalGoalsDistribution(grid);
  const homeScores = probabilityWhere(grid, (h) => h > 0);
  const awayScores = probabilityWhere(grid, (_, a) => a > 0);
  return {
    result: { home, draw, away },
    doubleChance: { homeDraw: home + draw, drawAway: draw + away, homeAway: home + away },
    totalDistribution: distribution,
    overs: Object.fromEntries(display.goalLines.map((line) => [line, overOutcome(distribution, line).win])),
    btts: probabilityWhere(grid, (h, a) => h > 0 && a > 0),
    homeScores,
    awayScores,
    firstGoal: firstGoal(grid),
    topScores: topScores(grid, display.topScores),
  };
}
