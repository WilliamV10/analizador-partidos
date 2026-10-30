/**
 * Explorador: distribución completa de una estadística (goles, corners, tarjetas;
 * total, por equipo o del 1er tiempo) para preguntar "¿qué probabilidad hay de N?".
 *
 *  - Goles: la grilla final del partido (Poisson con Dixon-Coles).
 *  - Goles del 1er tiempo: Poisson con los λ del primer tiempo.
 *  - Corners y tarjetas: binomial negativa con el esperado final (incluye la mezcla con la cuota).
 *  - Remates y remates a puerta: binomial negativa con lo que remata cada equipo y concede el rival.
 * No incluye la mezcla con lo ocurrido realmente de las pestañas Valor y Mercados,
 * por eso puede diferir en uno o dos puntos de ellas.
 *  - Ambos anotan (bttsBreakdown): sí usa la probabilidad final de esas pestañas.
 *  - Jugadores (playerRanking): Poisson con los tiros esperados de cada jugador (pestaña
 *    Jugadores), en uno o en todos los partidos.
 */
import { countVector } from './counts.js';
import { poissonVector, probabilityWhere, totalGoalsDistribution } from './poisson.js';

/**
 * Estadísticas que se pueden explorar.
 * `source`: de dónde sale la distribución; `side`: total, home o away;
 * `market`: tipo de mercado de la casa con líneas X.5 de ese total (para mostrar la cuota).
 * Jugadores: `field` es el tipo de tiro y `start` el valor inicial del deslizador.
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
  { id: 'shots', group: 'shots', source: 'shots', side: 'total', market: null },
  { id: 'shotsHome', group: 'shots', source: 'shots', side: 'home', market: null },
  { id: 'shotsAway', group: 'shots', source: 'shots', side: 'away', market: null },
  { id: 'shotsOnTarget', group: 'shotsOnTarget', source: 'shotsOnTarget', side: 'total', market: null },
  { id: 'shotsOnTargetHome', group: 'shotsOnTarget', source: 'shotsOnTarget', side: 'home', market: null },
  { id: 'shotsOnTargetAway', group: 'shotsOnTarget', source: 'shotsOnTarget', side: 'away', market: null },
  { id: 'btts', group: 'btts', source: 'btts', side: 'total', market: 'btts' },
  { id: 'playerShotsOnTarget', group: 'players', source: 'players', field: 'shotsOnTarget', side: 'total', market: null, start: 1 },
  { id: 'playerShots', group: 'players', source: 'players', field: 'shots', side: 'total', market: null, start: 2 },
]);

/** ¿La estadística es de sí/no (sin deslizador)? */
export function isBinaryStat(stat) {
  return stat.source === 'btts';
}

/** ¿Es un ranking de jugadores (en vez de una distribución del partido)? */
export function isPlayerStat(stat) {
  return stat.source === 'players';
}

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
  if (isBinaryStat(stat) || isPlayerStat(stat)) return null;
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

/**
 * Ambos anotan, con lo que lo rodea.
 *  - yes: la probabilidad final (modelo mezclado con lo ocurrido), la misma de Valor y Mercados.
 *  - model / empirical / n: de dónde sale esa mezcla.
 *  - homeScores, awayScores: cada equipo anota (final).
 *  - yesAndOver25: ambos anotan y hay 3 goles o más (grilla del modelo).
 *  - firstHalf: ambos anotan antes del descanso (Poisson con los λ del primer tiempo).
 * @param {import('./analyzeMatch.js').MatchAnalysis} analysis
 */
export function bttsBreakdown(analysis) {
  const { btts, homeScores, awayScores } = analysis.binary;
  const { home, away } = analysis.halfTime.lambdas;
  return {
    yes: btts.final,
    model: btts.model,
    empirical: btts.empirical,
    n: btts.n,
    homeScores: homeScores.final,
    awayScores: awayScores.final,
    yesAndOver25: probabilityWhere(analysis.grid, (homeGoals, awayGoals) => homeGoals > 0 && awayGoals > 0 && homeGoals + awayGoals >= 3),
    firstHalf: (1 - Math.exp(-home)) * (1 - Math.exp(-away)),
  };
}

/** P(N o más) de una Poisson de media λ. */
function poissonAtLeast(lambda, value) {
  let term = Math.exp(-lambda);
  let below = 0;
  for (let count = 0; count < value; count += 1) {
    below += term;
    term *= lambda / (count + 1);
  }
  return Math.max(0, 1 - below);
}

/**
 * @typedef {Object} PlayerRankingEntry
 * @property {import('./analyzeMatch.js').MatchAnalysis} analysis
 * @property {'home'|'away'} side
 * @property {import('./players.js').PlayerProjection} projection
 * @property {number} expected     tiros esperados (λ)
 * @property {number} probability  P(N o más)
 */

/**
 * Jugadores con más probabilidad de N o más tiros (a puerta o totales) en los partidos
 * indicados, de mayor a menor. Quedan fuera los que no van a jugar (0 minutos esperados).
 * @param {import('./analyzeMatch.js').MatchAnalysis[]} analyses
 * @param {string} statId  playerShotsOnTarget o playerShots
 * @param {number} value   N (1 = al menos un tiro)
 * @returns {PlayerRankingEntry[]}
 */
export function playerRanking(analyses, statId, value) {
  const { field } = explorerStat(statId);
  return analyses
    .flatMap((analysis) =>
      ['home', 'away'].flatMap((side) =>
        analysis.players[side]
          .filter((projection) => projection.expectedMinutes > 0)
          .map((projection) => {
            const expected = projection[field].lambda;
            return { analysis, side, projection, expected, probability: poissonAtLeast(expected, value) };
          }),
      ),
    )
    .sort((a, b) => b.probability - a.probability || b.expected - a.expected);
}
