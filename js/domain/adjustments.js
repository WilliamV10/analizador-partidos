/**
 * Capa 1 y 2 aplicadas a los partidos pasados antes de calcular los λ por estadísticas:
 *
 *  - Calendario: cada partido se corrige por la fuerza del rival (puntos por partido
 *    del rival / media de la liga). Marcar a un rival fuerte vale más; recibir de él, menos.
 *  - Nivel de liga: los partidos de "otra competición" se escalan por
 *    coeficiente(otra) / coeficiente(competición del partido).
 *  - Tipo de competición: amistosos, previas y copas pesan menos en los promedios.
 *  - Antigüedad: el peso de cada partido se reduce a la mitad cada `halfLifeDays` días
 *    (lo de la semana pasada dice más del equipo que lo de hace tres meses).
 *
 * Solo afecta a los λ por estadísticas; lo que se muestra en las tablas sigue siendo lo real.
 */
import { clamp } from '../utils/math.js';
import { namesMatch, normalizeName } from '../utils/text.js';

/**
 * @param {import('../types.js').Standing[]} standings
 * @param {typeof import('../config.js').CONFIG.schedule} config
 * @returns {(teamName: string) => number|null}  fuerza relativa del equipo (1 = media)
 */
export function strengthLookup(standings, config) {
  const rows = standings.filter((row) => row.played > 0);
  if (rows.length < config.minTeams) return () => null;
  const pointsPerGame = (row) => row.points / row.played;
  const average = rows.reduce((total, row) => total + pointsPerGame(row), 0) / rows.length;
  if (average <= 0) return () => null;
  return (teamName) => {
    const row = rows.find((candidate) => namesMatch(candidate.team, teamName));
    return row ? clamp(pointsPerGame(row) / average, config.minStrength, config.maxStrength) : null;
  };
}

/**
 * Entrada de una tabla por liga cuyo `match` aparece en el nombre de la competición
 * (la coincidencia más larga gana: "Liga de Expansión" antes que "Liga").
 * @template {{ match: string }} T
 * @param {string|null} competition
 * @param {T[]} table
 * @returns {T|null}
 */
export function findLeagueEntry(competition, table) {
  const name = normalizeName(competition);
  if (!name) return null;
  return (
    table
      .filter((entry) => name.includes(normalizeName(entry.match)))
      .sort((a, b) => normalizeName(b.match).length - normalizeName(a.match).length)[0] ?? null
  );
}

export function leagueCoefficient(competition, table) {
  return findLeagueEntry(competition, table)?.coefficient ?? null;
}

/**
 * @param {string|null} competition
 * @param {{ pattern: RegExp, weight: number }[]} rules
 * @param {number} fallback
 */
export function competitionWeight(competition, rules, fallback) {
  return rules.find((rule) => rule.pattern.test(competition ?? ''))?.weight ?? fallback;
}

function scalePair(pair, factor) {
  return pair ? { for: pair.for * factor, against: pair.against / factor } : pair;
}

/** Aplica un factor de "calidad" a una fila: lo producido se multiplica, lo concedido se divide. */
function scaleRow(row, factor) {
  if (factor === 1) return row;
  return {
    ...row,
    goalsFor: row.goalsFor * factor,
    goalsAgainst: row.goalsAgainst / factor,
    stats: { ...row.stats, xg: scalePair(row.stats.xg, factor) },
  };
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Peso por antigüedad: 0.5 ^ (días / vida media). 1 si falta alguna fecha o está desactivado.
 * @param {string|null} date           "AAAA-MM-DD" del partido
 * @param {string|null} referenceDate  fecha más reciente de los datos
 * @param {{ enabled: boolean, halfLifeDays: number }} recency
 */
export function recencyWeight(date, referenceDate, recency) {
  if (!recency?.enabled || !date || !referenceDate) return 1;
  const days = (Date.parse(referenceDate) - Date.parse(date)) / DAY_MS;
  if (!Number.isFinite(days)) return 1;
  return 0.5 ** (Math.max(0, days) / recency.halfLifeDays);
}

/**
 * @typedef {Object} AdjustmentContext
 * @property {(teamName: string) => number|null} strengthOf
 * @property {number|null} currentCoefficient   coeficiente de la competición del partido
 * @property {typeof import('../config.js').CONFIG.schedule} schedule
 * @property {{ coefficients: Object[], weights: Object[], defaultWeight: number }} leagues
 * @property {{ enabled: boolean, halfLifeDays: number }} [recency]
 * @property {string|null} [referenceDate]  fecha más reciente de los datos (para la antigüedad)
 */

/**
 * @param {import('../types.js').TeamMatchRow[]} rows
 * @param {AdjustmentContext} context
 * @returns {(import('../types.js').TeamMatchRow & { weight: number })[]}
 */
export function adjustRows(rows, { strengthOf, currentCoefficient, schedule, leagues, recency, referenceDate = null }) {
  return rows.map((row) => {
    const strength = schedule.enabled ? strengthOf(row.opponent) : null;
    const scheduleFactor = strength === null ? 1 : strength ** schedule.exponent;
    const otherCoefficient = row.block === 'other' ? leagueCoefficient(row.competition, leagues.coefficients) : null;
    const leagueFactor = otherCoefficient && currentCoefficient ? otherCoefficient / currentCoefficient : 1;
    const weight =
      competitionWeight(row.competition, leagues.weights, leagues.defaultWeight) *
      recencyWeight(row.date, referenceDate, recency);
    return { ...scaleRow(row, scheduleFactor * leagueFactor), weight };
  });
}
