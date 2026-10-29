/**
 * Historial: cada selección analizada se guarda como un registro. Sirve para dos cosas:
 *  - medir el modelo (todas las predicciones, se guardan solas al analizar);
 *  - llevar las apuestas del usuario (registros con `bet`).
 * Funciones puras: reciben registros y devuelven registros nuevos.
 */
import { hasStarted } from './alerts.js';
import { applyResults } from './settlement.js';

/**
 * Origen de un registro: en vivo (analizado antes del partido) o histórico (partido ya
 * jugado, analizado solo con la información previa y liquidado al importar).
 * Los registros viejos no tienen el campo: cuentan como en vivo.
 */
export const RECORD_ORIGINS = Object.freeze({ LIVE: 'live', BACKTEST: 'backtest' });

export function recordOrigin(record) {
  return record.origin === RECORD_ORIGINS.BACKTEST ? RECORD_ORIGINS.BACKTEST : RECORD_ORIGINS.LIVE;
}

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
 * @property {number|null} odds      cuota al analizar (null = la casa no tenía ese mercado)
 * @property {number} probability    probabilidad propia (sin devolución)
 * @property {number|null} fairProbability
 * @property {number|null} ev
 * @property {string} tier
 * @property {{ odds: number, stake: number, placedAt: number }|null} bet
 * @property {number|null} closingOdds
 * @property {{ status: string, score: string, settledAt: number }|null} settlement
 * @property {'live'|'backtest'} [origin]  ver RECORD_ORIGINS (sin campo = live)
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
export function pickRecord(match, pick, now, origin = RECORD_ORIGINS.LIVE) {
  return {
    origin,
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
 * Mercados del pronóstico del modelo (ver domain/forecasts.js). Se guardan siempre,
 * aunque la casa no tenga cuota, para poder medir cuánto acierta el modelo.
 * `probabilities(analysis)` da la probabilidad de cada selección.
 */
export const FORECAST_MARKETS = Object.freeze([
  {
    id: 'result',
    market: { type: 'result', line: null, name: 'Full time' },
    probabilities: ({ probabilities }) => probabilities.result,
  },
  {
    id: 'btts',
    market: { type: 'btts', line: null, name: 'Both teams to score' },
    probabilities: ({ binary }) => ({ yes: binary.btts.final, no: 1 - binary.btts.final }),
  },
  {
    id: 'goals25',
    market: { type: 'total', line: 2.5, name: 'Match goals 2.5' },
    probabilities: ({ binary, probabilities }) => {
      const over = binary.overs[2.5]?.final ?? probabilities.overs[2.5];
      return { over, under: 1 - over };
    },
  },
]);

/** Registro de una selección sin cuota de la casa (solo para medir el pronóstico). */
function modelOnlyRecord(match, market, selection, probability, now, origin) {
  return pickRecord(match, { market, key: selection, odds: null, probability, fairProbability: null, ev: null, tier: 'none' }, now, origin);
}

/**
 * Registros sin cuota de los mercados del pronóstico que la casa no ofrece en este partido.
 * @param {import('./analyzeMatch.js').MatchAnalysis} analysis
 * @param {number} now
 */
function forecastFillers(analysis, now, origin) {
  const quoted = new Set(analysis.picks.map((pick) => recordKey(analysis.match.id, pick.market, pick.key)));
  return FORECAST_MARKETS.flatMap(({ market, probabilities }) =>
    Object.entries(probabilities(analysis))
      .filter(([selection]) => !quoted.has(recordKey(analysis.match.id, market, selection)))
      .map(([selection, probability]) => modelOnlyRecord(analysis.match, market, selection, probability, now, origin)),
  );
}

/**
 * Registros de las predicciones de los partidos que todavía no empezaron
 * (con el partido en juego las cuotas serían en vivo y ensuciarían la medición).
 * Incluye todas las selecciones con cuota y, sin cuota, ganador, ambos anotan y más/menos de 2.5.
 * @param {import('./analyzeMatch.js').MatchAnalysis[]} analyses
 * @param {number} now
 * @returns {HistoryRecord[]}
 */
export function predictionRecords(analyses, now) {
  return analyses.filter((analysis) => !hasStarted(analysis.match)).flatMap((analysis) => recordsOf(analysis, now, RECORD_ORIGINS.LIVE));
}

/** Todas las selecciones de un análisis como registros (con cuota y, sin cuota, las del pronóstico). */
function recordsOf(analysis, now, origin) {
  return [
    ...analysis.picks.map((pick) => pickRecord(analysis.match, pick, now, origin)),
    ...forecastFillers(analysis, now, origin),
  ];
}

/**
 * Prueba histórica: partidos ya jugados que traen su resultado (script v5, modo histórico).
 * Se guardan todas sus selecciones ya liquidadas; las que no se pueden liquidar (falta el
 * dato, ej. corners) se descartan para no quedar pendientes para siempre.
 * @param {import('./analyzeMatch.js').MatchAnalysis[]} analyses
 * @param {number} now
 * @returns {HistoryRecord[]}
 */
export function backtestRecords(analyses, now) {
  return analyses
    .filter((analysis) => analysis.match.result?.finished)
    .flatMap((analysis) => applyResults(recordsOf(analysis, now, RECORD_ORIGINS.BACKTEST), [analysis.match.result], now));
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

/**
 * Une registros de una prueba histórica (ya liquidados) con los guardados:
 *  - si ya existe y está liquidado, no se toca;
 *  - si existe una predicción en vivo pendiente del mismo partido, se conserva (con sus
 *    cuotas y probabilidades de antes del partido) y solo se liquida con el resultado;
 *  - si no, entra el registro histórico (conservando una apuesta previa, si la hubiera).
 * @param {Map<string, HistoryRecord>} existing
 * @param {HistoryRecord[]} incoming  salida de backtestRecords
 * @returns {HistoryRecord[]}  registros que cambiaron (para guardar)
 */
export function mergeBacktest(existing, incoming) {
  return incoming
    .filter((record) => !existing.get(record.key)?.settlement)
    .map((record) => {
      const previous = existing.get(record.key);
      if (!previous) return record;
      if (recordOrigin(previous) === RECORD_ORIGINS.LIVE) {
        return { ...previous, settlement: record.settlement, closingOdds: previous.closingOdds ?? record.closingOdds };
      }
      return { ...record, bet: previous.bet };
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
