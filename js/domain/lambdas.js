/**
 * Goles esperados (λ) de cada equipo:
 *  - por estadísticas (goles + xG a favor del equipo cruzados con lo que recibe el rival),
 *  - por mercado (los λ que reproducen el 1X2 y el Over/Under sin margen),
 *  - final (mezcla ponderada de ambos).
 */
import { mean, range, weightedMean } from '../utils/math.js';
import { fairProbabilities } from './odds.js';
import { closestTotalMarket, findMarket } from './marketCatalog.js';
import { poissonVector } from './poisson.js';

/** @typedef {import('./aggregates.js').TeamSummary} TeamSummary */

/** Mezcla goles reales y xG (el xG predice mejor: tiene menos ruido). Si falta uno, usa el otro. */
const goalsAndXg = (goals, xg, xgWeight) =>
  weightedMean([
    { value: goals, weight: 1 - xgWeight },
    { value: xg, weight: xgWeight },
  ]);
const attackOf = (summary, xgWeight) => goalsAndXg(summary?.avg.goalsFor, summary?.avg.xgFor, xgWeight);
const defenceOf = (summary, xgWeight) => goalsAndXg(summary?.avg.goalsAgainst, summary?.avg.xgAgainst, xgWeight);

function expectedGoals(attackSummary, defenceSummary, xgWeight) {
  return mean([attackOf(attackSummary, xgWeight), defenceOf(defenceSummary, xgWeight)]);
}

function hasSample(summary, minimum) {
  return (summary?.n ?? 0) >= minimum;
}

function sideLambda({ overall, venue, factor, config }) {
  if (overall === null) return venue ?? config.fallbackGoals;
  const adjusted = overall * factor;
  if (venue === null) return adjusted;
  return (1 - config.venueSplitWeight) * adjusted + config.venueSplitWeight * venue;
}

/**
 * @param {{ recent: TeamSummary|null, venue: TeamSummary|null }} home  venue = partidos en casa
 * @param {{ recent: TeamSummary|null, venue: TeamSummary|null }} away  venue = partidos de visita
 * @param {typeof import('../config.js').CONFIG.lambda} config
 * @returns {{ home: number, away: number }}
 */
export function statsLambdas(home, away, config) {
  const useVenue =
    hasSample(home.venue, config.minVenueSample) && hasSample(away.venue, config.minVenueSample);
  return {
    home: sideLambda({
      overall: expectedGoals(home.recent, away.recent, config.xgWeight),
      venue: useVenue ? expectedGoals(home.venue, away.venue, config.xgWeight) : null,
      factor: config.homeAdvantage,
      config,
    }),
    away: sideLambda({
      overall: expectedGoals(away.recent, home.recent, config.xgWeight),
      venue: useVenue ? expectedGoals(away.venue, home.venue, config.xgWeight) : null,
      factor: config.awayDisadvantage,
      config,
    }),
  };
}

/**
 * Probabilidades objetivo del mercado (sin margen) para ajustar los λ.
 * @returns {{ home: number, draw: number, away: number, totalLine: number|null, over: number|null }|null}
 */
export function marketTargets(markets) {
  const result = findMarket(markets, 'result');
  if (!result) return null;
  const [home, draw, away] = fairProbabilities(result.selections.map((selection) => selection.odds));
  const total = closestTotalMarket(markets);
  const overSelection = total?.selections.find((selection) => selection.key === 'over');
  const over = overSelection
    ? fairProbabilities(total.selections.map((selection) => selection.odds))[
        total.selections.indexOf(overSelection)
      ]
    : null;
  return { home, draw, away, totalLine: over === null ? null : total.line, over };
}

function cumulative(values) {
  let running = 0;
  return values.map((value) => (running += value));
}

/** P(local gana), P(visita gana) y P(total > línea) para un par de vectores Poisson. */
function pairProbabilities(homeVector, awayVector, totalLine) {
  const homeCumulative = cumulative(homeVector);
  const awayCumulative = cumulative(awayVector);
  const mass = homeCumulative.at(-1) * awayCumulative.at(-1);
  let homeWin = 0;
  let awayWin = 0;
  homeVector.forEach((probability, goals) => {
    if (goals > 0) homeWin += probability * awayCumulative[goals - 1];
  });
  awayVector.forEach((probability, goals) => {
    if (goals > 0) awayWin += probability * homeCumulative[goals - 1];
  });
  let under = 0;
  if (totalLine !== null) {
    const maxTotal = Math.floor(totalLine);
    for (let total = 0; total <= maxTotal; total += 1) {
      for (let homeGoals = 0; homeGoals <= total; homeGoals += 1) {
        under += (homeVector[homeGoals] ?? 0) * (awayVector[total - homeGoals] ?? 0);
      }
    }
  }
  return { home: homeWin / mass, away: awayWin / mass, over: 1 - under / mass };
}

function fitError(probabilities, targets) {
  const resultError = (probabilities.home - targets.home) ** 2 + (probabilities.away - targets.away) ** 2;
  const totalError = targets.over === null ? 0 : (probabilities.over - targets.over) ** 2;
  return resultError + totalError;
}

function searchBest(homeCandidates, awayCandidates, targets, maxGoals) {
  const awayVectors = awayCandidates.map((lambda) => poissonVector(lambda, maxGoals));
  let best = { error: Infinity, home: null, away: null };
  homeCandidates.forEach((homeLambda) => {
    const homeVector = poissonVector(homeLambda, maxGoals);
    awayVectors.forEach((awayVector, index) => {
      const error = fitError(pairProbabilities(homeVector, awayVector, targets.totalLine), targets);
      if (error < best.error) best = { error, home: homeLambda, away: awayCandidates[index] };
    });
  });
  return best;
}

/**
 * Busca los λ que mejor reproducen las probabilidades del mercado (grilla gruesa + fina).
 * @returns {{ home: number, away: number, error: number }}
 */
export function fitMarketLambdas(targets, fitConfig, maxGoals) {
  const coarse = range(fitConfig.min, fitConfig.max, fitConfig.coarseStep);
  const rough = searchBest(coarse, coarse, targets, maxGoals);
  const around = (center) =>
    range(
      Math.max(fitConfig.min, center - fitConfig.coarseStep),
      Math.min(fitConfig.max, center + fitConfig.coarseStep),
      fitConfig.fineStep,
    );
  return searchBest(around(rough.home), around(rough.away), targets, maxGoals);
}

/** Mezcla λ de mercado y de estadísticas. Si falta el mercado, usa solo estadísticas. */
export function blendLambdas(stats, market, marketWeight) {
  if (!market) return { ...stats };
  return {
    home: marketWeight * market.home + (1 - marketWeight) * stats.home,
    away: marketWeight * market.away + (1 - marketWeight) * stats.away,
  };
}
