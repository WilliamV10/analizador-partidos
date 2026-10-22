/**
 * Primer tiempo: λ_HT = λ × proporción de goles que caen antes del descanso.
 * La proporción sale de lo ocurrido (goles al descanso / goles totales),
 * encogida hacia un valor por defecto con `priorGoals` goles virtuales.
 */
import { sum } from '../utils/math.js';
import { scoreGrid, probabilityWhere, totalGoalsDistribution } from './poisson.js';
import { overOutcome } from './probabilities.js';

const hasHalfTime = (row) => row.htGoalsFor !== null && row.htGoalsAgainst !== null;

/**
 * @param {import('../types.js').TeamMatchRow[]} rows   partidos de ambos equipos
 * @param {typeof import('../config.js').CONFIG.halfTime} config
 * @returns {{ share: number, goals: number }}  goals = goles con dato de descanso (muestra)
 */
export function firstHalfShare(rows, config) {
  const withHalfTime = rows.filter(hasHalfTime);
  const goals = sum(withHalfTime.map((row) => row.goalsFor + row.goalsAgainst));
  const firstHalfGoals = sum(withHalfTime.map((row) => row.htGoalsFor + row.htGoalsAgainst));
  const share = (firstHalfGoals + config.priorGoals * config.defaultShare) / (goals + config.priorGoals);
  return { share, goals };
}

/**
 * @typedef {Object} HalfTimeModel
 * @property {number} share
 * @property {number} sample
 * @property {{ home: number, away: number }} lambdas
 * @property {{ home: number, draw: number, away: number }} result
 * @property {number[]} totalDistribution
 * @property {Record<number, number>} overs
 */

/**
 * @param {{ home: number, away: number }} lambdas  goles esperados del partido completo
 * @param {{ share: number, goals: number }} split
 * @param {{ maxGoals: number, goalLines: number[] }} options
 * @returns {HalfTimeModel}
 */
export function halfTimeModel(lambdas, split, { maxGoals, goalLines }) {
  const halfLambdas = { home: lambdas.home * split.share, away: lambdas.away * split.share };
  const grid = scoreGrid(halfLambdas.home, halfLambdas.away, maxGoals);
  const home = probabilityWhere(grid, (h, a) => h > a);
  const draw = probabilityWhere(grid, (h, a) => h === a);
  const distribution = totalGoalsDistribution(grid);
  return {
    share: split.share,
    sample: split.goals,
    lambdas: halfLambdas,
    result: { home, draw, away: 1 - home - draw },
    totalDistribution: distribution,
    overs: Object.fromEntries(goalLines.map((line) => [line, overOutcome(distribution, line).win])),
  };
}
