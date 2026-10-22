/**
 * Historial: cada selección analizada se guarda como un registro. Sirve para dos cosas:
 *  - medir el modelo (todas las predicciones, se guardan solas al analizar);
 *  - llevar las apuestas del usuario (registros con `bet`).
 * Funciones puras: reciben registros y devuelven registros nuevos.
 */
import { hasStarted } from './alerts.js';

/**
 * @typedef {Object} HistoryRecord
 * @property {string} key            partido|mercado|línea|selección (único)
 * @property {string} matchId
 * @property {string} matchTitle
 * @property {string} home
 * @property {string} away
 * @property {string|null} tournament
 * @property {string|null} kickoff
 * @property {number} analyzedAt     marca de tiempo (ms)
 * @property {{ type: string, line: number|null, name: string }} market
 * @property {string} selection
 * @property {number} odds           cuota al analizar
 * @property {number} probability    probabilidad propia (sin devolución)
 * @property {number} fairProbability
 * @property {number} ev
 * @property {string} tier
 * @property {{ odds: number, stake: number, placedAt: number }|null} bet
 * @property {number|null} closingOdds
 * @property {{ status: string, score: string, settledAt: number }|null} settlement
 */

/** Clave estable de una selección de un partido. */
export function recordKey(matchId, market, selection) {
  return [matchId, market.type, market.line ?? '', selection].join('|');
}

/**
 * Registro de una selección analizada (sin apuesta ni liquidación).
 * @param {import('../types.js').Match} match
 * @param {import('./value.js').ValuePick} pick
 * @param {number} now
 * @returns {HistoryRecord}
 */
export function pickRecord(match, pick, now) {
  return {
    key: recordKey(match.id, pick.market, pick.key),
    matchId: match.id,
    matchTitle: match.title,
    home: match.home.name,
    away: match.away.name,
    tournament: match.tournament,
    kickoff: match.kickoff,
    analyzedAt: now,
    market: { type: pick.market.type, line: pick.market.line, name: pick.market.name },
    selection: pick.key,
    odds: pick.odds,
    probability: pick.probability,
    fairProbability: pick.fairProbability,
    ev: pick.ev,
    tier: pick.tier,
    bet: null,
    closingOdds: null,
    settlement: null,
  };
}

/**
 * Registros de las predicciones de los partidos que todavía no empezaron
 * (con el partido en juego las cuotas serían en vivo y ensuciarían la medición).
 * @param {import('./analyzeMatch.js').MatchAnalysis[]} analyses
 * @param {number} now
 * @returns {HistoryRecord[]}
 */
export function predictionRecords(analyses, now) {
  return analyses
    .filter((analysis) => !hasStarted(analysis.match))
    .flatMap(({ match, picks }) => picks.map((pick) => pickRecord(match, pick, now)));
}

/**
 * Une predicciones nuevas con las guardadas. Las ya liquidadas no se tocan;
 * en las demás se actualiza el modelo y se conserva la apuesta del usuario.
 * @param {Map<string, HistoryRecord>} existing
 * @param {HistoryRecord[]} incoming
 * @returns {HistoryRecord[]}  registros que cambiaron (para guardar)
 */
export function mergePredictions(existing, incoming) {
  return incoming
    .filter((record) => !existing.get(record.key)?.settlement)
    .map((record) => {
      const previous = existing.get(record.key);
      return previous ? { ...record, bet: previous.bet, closingOdds: previous.closingOdds } : record;
    });
}

/** Al importar un respaldo, gana el registro con más información (liquidado > con apuesta > el más nuevo). */
export function preferRecord(current, candidate) {
  if (!current) return candidate;
  const score = (record) => (record.settlement ? 4 : 0) + (record.bet ? 2 : 0);
  if (score(candidate) !== score(current)) return score(candidate) > score(current) ? candidate : current;
  return candidate.analyzedAt >= current.analyzedAt ? candidate : current;
}

/** Ids de partidos con registros sin liquidar, del análisis más reciente al más viejo. */
export function pendingMatchIds(records, limit) {
  const latestByMatch = new Map();
  records
    .filter((record) => !record.settlement)
    .forEach((record) => {
      latestByMatch.set(record.matchId, Math.max(latestByMatch.get(record.matchId) ?? 0, record.analyzedAt));
    });
  return [...latestByMatch.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([matchId]) => matchId);
}
