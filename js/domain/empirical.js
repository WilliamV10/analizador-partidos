/**
 * Mezcla del modelo con lo ocurrido realmente (porcentajes empíricos).
 *
 * Idea: el modelo es un "previo" que vale `priorStrength` partidos virtuales.
 * Cuantos más partidos reales haya, más pesa la realidad, hasta un máximo de `maxWeight`.
 */
import {
  bothScored,
  conceded,
  countWhere,
  overGoals,
  scored,
} from './events.js';

/**
 * @typedef {Object} EmpiricalSample
 * @property {import('../types.js').TeamMatchRow[]} rows
 * @property {(row: import('../types.js').TeamMatchRow) => boolean} predicate
 * @property {number} weight
 */

/**
 * @param {EmpiricalSample[]} samples
 * @returns {{ rate: number|null, n: number }}  n = tamaño efectivo (ponderado)
 */
export function empiricalRate(samples) {
  let hits = 0;
  let n = 0;
  samples.forEach(({ rows, predicate, weight }) => {
    hits += countWhere(rows, predicate) * weight;
    n += rows.length * weight;
  });
  return { rate: n > 0 ? hits / n : null, n };
}

/**
 * @typedef {Object} Estimate
 * @property {number} model       probabilidad del modelo (Poisson)
 * @property {number|null} empirical
 * @property {number} n           muestra empírica efectiva
 * @property {number} weight      peso de lo empírico en el final
 * @property {number} final
 */

/** @returns {Estimate} */
export function blendWithEmpirical(model, empirical, config) {
  if (empirical.rate === null) {
    return { model, empirical: null, n: 0, weight: 0, final: model };
  }
  const weight = Math.min(config.maxWeight, empirical.n / (empirical.n + config.priorStrength));
  return {
    model,
    empirical: empirical.rate,
    n: empirical.n,
    weight,
    final: (1 - weight) * model + weight * empirical.rate,
  };
}

/**
 * Para cada evento: qué contar en los partidos de casa del local, en los de visita
 * del visitante y en el H2H (perspectiva del local).
 */
function eventDefinitions(goalLines) {
  const overs = goalLines.map((line) => {
    const over = overGoals(line);
    return [`over:${line}`, { home: over, away: over, h2h: over }];
  });
  return [
    ['btts', { home: bothScored, away: bothScored, h2h: bothScored }],
    ['homeScores', { home: scored, away: conceded, h2h: scored }],
    ['awayScores', { home: conceded, away: scored, h2h: conceded }],
    ...overs,
  ];
}

/**
 * @param {Object} params
 * @param {import('./probabilities.js').Probabilities} params.probabilities  del modelo final
 * @param {import('../types.js').TeamMatchRow[]} params.homeVenueRows   local jugando en casa
 * @param {import('../types.js').TeamMatchRow[]} params.awayVenueRows   visita jugando fuera
 * @param {import('../types.js').TeamMatchRow[]} params.h2hRows
 * @param {number[]} params.goalLines
 * @param {typeof import('../config.js').CONFIG.empirical} params.config
 * @returns {{ btts: Estimate, homeScores: Estimate, awayScores: Estimate, overs: Record<number, Estimate> }}
 */
export function binaryEstimates({ probabilities, homeVenueRows, awayVenueRows, h2hRows, goalLines, config }) {
  const modelValue = {
    btts: probabilities.btts,
    homeScores: probabilities.homeScores,
    awayScores: probabilities.awayScores,
    ...Object.fromEntries(goalLines.map((line) => [`over:${line}`, probabilities.overs[line]])),
  };
  const estimates = Object.fromEntries(
    eventDefinitions(goalLines).map(([key, predicates]) => {
      const empirical = empiricalRate([
        { rows: homeVenueRows, predicate: predicates.home, weight: 1 },
        { rows: awayVenueRows, predicate: predicates.away, weight: 1 },
        { rows: h2hRows, predicate: predicates.h2h, weight: config.h2hWeight },
      ]);
      return [key, blendWithEmpirical(modelValue[key], empirical, config)];
    }),
  );
  return {
    btts: estimates.btts,
    homeScores: estimates.homeScores,
    awayScores: estimates.awayScores,
    overs: Object.fromEntries(goalLines.map((line) => [line, estimates[`over:${line}`]])),
  };
}
