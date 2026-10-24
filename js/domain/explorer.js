/**
 * Explorador: distribución completa de una estadística (goles, corners, tarjetas;
 * total, por equipo o del 1er tiempo) para preguntar "¿qué probabilidad hay de N?".
 *
 *  - Goles: la grilla final del partido (Poisson con Dixon-Coles).
 *  - Goles del 1er tiempo: Poisson con los λ del primer tiempo.
 *  - Corners y tarjetas: binomial negativa con el esperado final (incluye la mezcla con la cuota).
 * No incluye la mezcla con lo ocurrido realmente de las pestañas Valor y Mercados,
 * por eso puede diferir en uno o dos puntos de ellas.
 */
import { countVector } from './counts.js';
import { poissonVector, totalGoalsDistribution } from './poisson.js';

/**
 * Estadísticas que se pueden explorar.
 * `source`: de dónde sale la distribución; `side`: total, home o away;
 * `market`: tipo de mercado de la casa con líneas X.5 de ese total (para mostrar la cuota).
 */
export const EXPLORER_STATS = Object.freeze([
  { id: 'goals', group: 'goals', source: 'goals', side: 'total', market: 'total' },
  { id: 'goalsHome', group: 'goals', source: 'goals', side: 'home', market: null },
  { id: 'goalsAway', group: 'goals', source: 'goals', side: 'away', market: null },
  { id: 'goalsFirstHalf', group: 'goals', source: 'halfTime', side: 'total', market: null },
  { id: 'corners', group: 'corners', source: 'corners', side: 'total', market: 'corners' },
  { id: 'cornersHome', group: 'corners', source: 'corners', side: 'home', market: null },
  { id: 'cornersAway', group: 'corners', source: 'corners', side: 'away', market: null },
  { id: 'cornersFirstHalf', group: 'corners', source: 'cornersFirstHalf', side: 'total', market: null },
  { id: 'cards', group: 'cards', source: 'yellows', side: 'total', market: 'cards' },
  { id: 'cardsHome', group: 'cards', source: 'yellows', side: 'home', market: null },
  { id: 'cardsAway', group: 'cards', source: 'yellows', side: 'away', market: null },
]);

export const EXPLORER_GROUPS = Object.freeze([...new Set(EXPLORER_STATS.map((stat) => stat.group))]);

export function explorerStat(id) {
  return EXPLORER_STATS.find((stat) => stat.id === id) ?? EXPLORER_STATS[0];
}

function normalize(vector) {
  const total = vector.reduce((sum, value) => sum + value, 0);
  return total > 0 ? vector.map((value) => value / total) : vector;
}

/** Goles de un lado: suma de filas (local) o columnas (visita) de la grilla. */
function goalsDistribution(grid, side) {
  if (side === 'total') return totalGoalsDistribution(grid);
  if (side === 'home') return grid.cells.map((row) => row.reduce((sum, value) => sum + value, 0));
  return grid.cells[0].map((_, away) => grid.cells.reduce((sum, row) => sum + row[away], 0));
}

/**
 * Distribución P(0..max) de la estadística en un partido, o null si no hay datos.
 * @param {import('./analyzeMatch.js').MatchAnalysis} analysis
 * @param {string} statId
 * @returns {number[]|null}
 */
export function statDistribution(analysis, statId) {
  const stat = explorerStat(statId);
  const { config } = analysis;
  if (stat.source === 'goals') return goalsDistribution(analysis.grid, stat.side);
  if (stat.source === 'halfTime') {
    const { home, away } = analysis.halfTime.lambdas;
    return normalize(poissonVector(home + away, config.poisson.maxGoals));
  }
  const model = analysis.counts[stat.source];
  if (!model) return null;
  return normalize(countVector(model.expected[stat.side], config.counts[stat.source].dispersion, config.counts.maxCount));
}

/**
 * Probabilidades para un valor N: exactamente N, N o más y N o menos, y la media.
 * @param {number[]} distribution
 * @param {number} value
 */
export function valueProbabilities(distribution, value) {
  const below = distribution.slice(0, value).reduce((sum, probability) => sum + probability, 0);
  const exactly = distribution[value] ?? 0;
  return {
    exactly,
    atLeast: Math.max(0, 1 - below),
    atMost: Math.min(1, below + exactly),
  };
}

export function distributionMean(distribution) {
  return distribution.reduce((sum, probability, value) => sum + probability * value, 0);
}
