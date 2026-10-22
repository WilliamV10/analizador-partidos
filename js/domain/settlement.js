/**
 * Liquidación de apuestas con el resultado real (a 90 minutos).
 * Estados: win, halfWin (hándicap de cuarto), push (devolución), halfLoss, loss.
 * Si falta un dato necesario (ej. corners), la selección queda sin liquidar.
 */
import { findMarket } from './marketCatalog.js';

export const SETTLEMENT = Object.freeze({
  WIN: 'win',
  HALF_WIN: 'halfWin',
  PUSH: 'push',
  HALF_LOSS: 'halfLoss',
  LOSS: 'loss',
});

const QUARTER = 0.25;
const EPSILON = 1e-9;

/**
 * @typedef {Object} MatchResult
 * @property {string} id
 * @property {boolean} finished
 * @property {{ home: number, away: number }|null} score      a 90 minutos
 * @property {{ home: number, away: number }|null} halfTime
 * @property {{ home: number, away: number }|null} corners
 * @property {{ home: number, away: number }|null} yellows
 * @property {'home'|'away'|'none'|null} firstGoal
 * @property {import('./marketCatalog.js').CanonicalMarket[]} markets  últimas cuotas (cierre)
 */

/** Ganancia por unidad apostada según el estado. */
export function profitPerUnit(status, odds) {
  switch (status) {
    case SETTLEMENT.WIN:
      return odds - 1;
    case SETTLEMENT.HALF_WIN:
      return (odds - 1) / 2;
    case SETTLEMENT.HALF_LOSS:
      return -0.5;
    case SETTLEMENT.LOSS:
      return -1;
    default:
      return 0;
  }
}

const byCondition = (won) => (won ? SETTLEMENT.WIN : SETTLEMENT.LOSS);

/** "Más de `line`": gana si se supera, devuelve si se iguala (líneas enteras). */
function overStatus(value, line) {
  if (value > line + EPSILON) return SETTLEMENT.WIN;
  if (Math.abs(value - line) <= EPSILON) return SETTLEMENT.PUSH;
  return SETTLEMENT.LOSS;
}

const INVERSE = {
  [SETTLEMENT.WIN]: SETTLEMENT.LOSS,
  [SETTLEMENT.LOSS]: SETTLEMENT.WIN,
  [SETTLEMENT.PUSH]: SETTLEMENT.PUSH,
};

function overUnder(selection, value, line) {
  if (value === null) return null;
  const over = overStatus(value, line);
  return selection === 'over' ? over : INVERSE[over];
}

/** Hándicap asiático: las líneas de cuarto combinan dos medias apuestas. */
function handicapStatus(margin, line) {
  const isQuarter = Math.abs((Math.abs(line) % 0.5) - QUARTER) < EPSILON;
  if (!isQuarter) return overStatus(margin + line, 0);
  const halves = [overStatus(margin + line - QUARTER, 0), overStatus(margin + line + QUARTER, 0)];
  if (halves.every((status) => status === SETTLEMENT.WIN)) return SETTLEMENT.WIN;
  if (halves.every((status) => status === SETTLEMENT.LOSS)) return SETTLEMENT.LOSS;
  return halves.includes(SETTLEMENT.WIN) ? SETTLEMENT.HALF_WIN : SETTLEMENT.HALF_LOSS;
}

function outcome1x2({ home, away }) {
  if (home > away) return 'home';
  return home === away ? 'draw' : 'away';
}

const total = (pair) => (pair ? pair.home + pair.away : null);

const SETTLERS = {
  result: (selection, { score }) => byCondition(outcome1x2(score) === selection),
  resultFirstHalf: (selection, { halfTime }) => (halfTime ? byCondition(outcome1x2(halfTime) === selection) : null),
  doubleChance: (selection, { score }) => {
    const outcome = outcome1x2(score);
    const covers = { homeDraw: ['home', 'draw'], drawAway: ['draw', 'away'], homeAway: ['home', 'away'] };
    return byCondition(covers[selection]?.includes(outcome));
  },
  drawNoBet: (selection, { score }) => {
    const outcome = outcome1x2(score);
    return outcome === 'draw' ? SETTLEMENT.PUSH : byCondition(outcome === selection);
  },
  btts: (selection, { score }) => byCondition((score.home > 0 && score.away > 0) === (selection === 'yes')),
  total: (selection, { score }, line) => overUnder(selection, total(score), line),
  corners: (selection, { corners }, line) => overUnder(selection, total(corners), line),
  cards: (selection, { yellows }, line) => overUnder(selection, total(yellows), line),
  firstGoal: (selection, { score, firstGoal }) => {
    const first = total(score) === 0 ? 'none' : firstGoal;
    return first ? byCondition(first === selection) : null;
  },
  asianHandicap: (selection, { score }, line) => {
    const margin = score.home - score.away;
    return selection === 'home' ? handicapStatus(margin, line) : handicapStatus(-margin, -line);
  },
};

/**
 * @param {import('./history.js').HistoryRecord} record
 * @param {MatchResult} result
 * @returns {string|null}  estado (ver SETTLEMENT) o null si no se puede liquidar
 */
export function settleRecord(record, result) {
  if (!result.finished || !result.score) return null;
  const settler = SETTLERS[record.market.type];
  return settler ? settler(record.selection, result, record.market.line) : null;
}

/** Cuota de la misma selección en las últimas cuotas del partido (cierre), si existen. */
export function closingOddsFor(record, markets) {
  const market = findMarket(markets ?? [], record.market.type, record.market.line);
  return market?.selections.find((selection) => selection.key === record.selection)?.odds ?? null;
}

/**
 * Liquida los registros pendientes que tienen resultado.
 * @param {import('./history.js').HistoryRecord[]} records
 * @param {MatchResult[]} results
 * @param {number} now
 * @returns {import('./history.js').HistoryRecord[]}  solo los registros liquidados ahora
 */
export function applyResults(records, results, now) {
  const resultsById = new Map(results.map((result) => [result.id, result]));
  return records
    .filter((record) => !record.settlement && resultsById.has(record.matchId))
    .map((record) => {
      const result = resultsById.get(record.matchId);
      const status = settleRecord(record, result);
      if (!status) return null;
      return {
        ...record,
        closingOdds: closingOddsFor(record, result.markets) ?? record.closingOdds,
        settlement: { status, score: `${result.score.home}-${result.score.away}`, settledAt: now },
      };
    })
    .filter(Boolean);
}
