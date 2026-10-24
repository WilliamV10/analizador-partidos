/**
 * Mercados de conteo (corners, corners del 1er tiempo, tarjetas amarillas).
 *
 * Esperado por equipo = promedio(lo que el equipo produce en su condición,
 *                                lo que el rival concede en la suya).
 * El total sigue una binomial negativa (varianza = dispersión × media), porque
 * corners y tarjetas varían más de lo que supone una Poisson. Después cada línea
 * se mezcla con lo ocurrido realmente, igual que los goles.
 *
 * Si la casa da una línea (ej. "Corners 10.5"), el total esperado se mezcla además con
 * el total que implica esa cuota (sin margen), como se hace con los goles: así el modelo
 * no "ve valor" solo porque sus promedios difieren de un mercado que sabe más.
 */
import { mean } from '../utils/math.js';
import { fairProbabilities } from './odds.js';
import { blendWithEmpirical, empiricalRate } from './empirical.js';
import { poissonVector } from './poisson.js';
import { overOutcome } from './probabilities.js';

/** P(0..maxCount) de una binomial negativa con la media y dispersión dadas (Poisson si dispersión ≤ 1). */
export function countVector(average, dispersion, maxCount) {
  if (dispersion <= 1) return poissonVector(average, maxCount);
  const size = average / (dispersion - 1);
  const success = 1 / dispersion;
  const vector = [];
  let probability = success ** size;
  for (let count = 0; count <= maxCount; count += 1) {
    vector.push(probability);
    probability *= ((count + size) / (count + 1)) * (1 - success);
  }
  return vector;
}

const statFor = (stat) => (row) => row.stats[stat]?.for;
const statAgainst = (stat) => (row) => row.stats[stat]?.against;
const hasStat = (stat) => (row) => Boolean(row.stats[stat]);

/** Partidos en la condición del día si hay suficientes con el dato; si no, todos los recientes. */
function rowsWithStat(side, stat, minSample) {
  const venue = side.venueRows.filter(hasStat(stat));
  return venue.length >= minSample ? venue : side.recentRows.filter(hasStat(stat));
}

function overRate(rows, read, line) {
  return { rows, predicate: (row) => read(row) > line, weight: 1 };
}

function lineEstimates(lines, distribution, samples, empiricalConfig) {
  return Object.fromEntries(
    lines.map((line) => {
      const model = overOutcome(distribution, line).win;
      return [line, blendWithEmpirical(model, empiricalRate(samples(line)), empiricalConfig)];
    }),
  );
}

/**
 * Total medio que reproduce la probabilidad justa de "más de `line`" de la casa (bisección:
 * P(over) crece con la media). null si la línea no sirve.
 */
export function marketImpliedMean(line, overProbability, dispersion, maxCount) {
  if (!(overProbability > 0 && overProbability < 1)) return null;
  let low = 0.05;
  let high = maxCount;
  for (let step = 0; step < 50; step += 1) {
    const middle = (low + high) / 2;
    const over = overOutcome(countVector(middle, dispersion, maxCount), line).win;
    if (over < overProbability) low = middle;
    else high = middle;
  }
  return (low + high) / 2;
}

/** Línea de la casa más pareja (la de mejor información) y su total implícito. */
function marketTotal(markets, statConfig, maxCount) {
  const candidates = (markets ?? [])
    .map((market) => {
      const over = market.selections.find((selection) => selection.key === 'over');
      if (!over || market.line === null || market.selections.length !== 2) return null;
      const fair = fairProbabilities(market.selections.map((selection) => selection.odds));
      return { line: market.line, over: fair[market.selections.indexOf(over)] };
    })
    .filter(Boolean)
    .sort((a, b) => Math.abs(a.over - 0.5) - Math.abs(b.over - 0.5));
  const best = candidates[0];
  return best ? marketImpliedMean(best.line, best.over, statConfig.dispersion, maxCount) : null;
}

/**
 * @typedef {Object} CountModel
 * @property {{ home: number, away: number, total: number }} expected
 * @property {number|null} statsTotal   total esperado solo por estadísticas
 * @property {number|null} marketTotal  total que implica la cuota de la casa
 * @property {Record<number, import('./empirical.js').Estimate>} total
 * @property {Record<number, import('./empirical.js').Estimate>} home
 * @property {Record<number, import('./empirical.js').Estimate>} away
 * @property {number} sample
 */

/**
 * @param {Object} params
 * @param {string} params.stat  clave de TeamMatchRow.stats (corners, cornersFirstHalf, yellows)
 * @param {{ venueRows: Object[], recentRows: Object[] }} params.home  local (venue = en casa)
 * @param {{ venueRows: Object[], recentRows: Object[] }} params.away  visita (venue = fuera)
 * @param {number} [params.extra]  ajuste sumado al total esperado (contexto de Claude)
 * @param {Object[]} [params.markets]   mercados canónicos de esta estadística (para el total implícito)
 * @param {number[]} params.lines       líneas del total
 * @param {number[]} params.teamLines   líneas por equipo
 * @param {{ dispersion: number }} params.statConfig
 * @param {typeof import('../config.js').CONFIG.counts} params.config
 * @param {typeof import('../config.js').CONFIG.empirical} params.empiricalConfig
 * @returns {CountModel|null}  null si no hay datos de esa estadística
 */
export function countModel({ stat, home, away, extra = 0, markets = [], lines, teamLines, statConfig, config, empiricalConfig }) {
  const homeRows = rowsWithStat(home, stat, config.minVenueSample);
  const awayRows = rowsWithStat(away, stat, config.minVenueSample);
  const homeMean = mean([mean(homeRows.map(statFor(stat))), mean(awayRows.map(statAgainst(stat)))]);
  const awayMean = mean([mean(awayRows.map(statFor(stat))), mean(homeRows.map(statAgainst(stat)))]);
  if (homeMean === null || awayMean === null) return null;

  const statsTotal = homeMean + awayMean;
  const impliedTotal = marketTotal(markets, statConfig, config.maxCount);
  const marketWeight = config.marketWeight ?? 0;
  const baseTotal =
    impliedTotal === null ? statsTotal : marketWeight * impliedTotal + (1 - marketWeight) * statsTotal;
  const total = Math.max(0, baseTotal + extra);
  const scale = statsTotal > 0 ? total / statsTotal : 1;
  const expected = { home: homeMean * scale, away: awayMean * scale, total };
  const distribution = (average) => countVector(average, statConfig.dispersion, config.maxCount);
  const totalOf = (row) => row.stats[stat].for + row.stats[stat].against;

  return {
    expected,
    statsTotal,
    marketTotal: impliedTotal,
    total: lineEstimates(lines, distribution(expected.total), (line) => [
      overRate(homeRows, totalOf, line),
      overRate(awayRows, totalOf, line),
    ], empiricalConfig),
    home: lineEstimates(teamLines, distribution(expected.home), (line) => [
      overRate(homeRows, statFor(stat), line),
      overRate(awayRows, statAgainst(stat), line),
    ], empiricalConfig),
    away: lineEstimates(teamLines, distribution(expected.away), (line) => [
      overRate(awayRows, statFor(stat), line),
      overRate(homeRows, statAgainst(stat), line),
    ], empiricalConfig),
    sample: homeRows.length + awayRows.length,
  };
}
