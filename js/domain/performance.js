/**
 * Rendimiento del historial: ganancia, ROI, acierto, CLV y calibración.
 *
 *  - Modo "bets": las apuestas registradas por el usuario, con su cuota y monto.
 *  - Modo "model": todos los picks con valor que dio el modelo, a 1 unidad y a la cuota del análisis.
 *  - Modo "probable": las selecciones más probables de los mercados populares (las mismas
 *    reglas de "Más probables": cuota y probabilidad mínimas), haya valor o no, a 1 unidad.
 *    El historial guarda todas las selecciones de cada partido; estos modos solo eligen cuáles mirar.
 *  - CLV = cuota tomada / cuota de cierre − 1 (positivo = le ganaste al mercado).
 *  - Calibración: en cada rango de probabilidad, cuánto se predijo y cuánto ocurrió.
 */
import { isProbableCandidate } from './combos.js';
import { marketGroup } from './marketCatalog.js';
import { SETTLEMENT, profitPerUnit } from './settlement.js';
import { TIERS, TIER_ORDER } from './value.js';

export const PERFORMANCE_MODES = Object.freeze({ BETS: 'bets', MODEL: 'model', PROBABLE: 'probable' });

/** Rangos de probabilidad del desglose "por probabilidad" (límite inferior de cada uno). */
const PROBABILITY_BANDS = [0, 0.6, 0.7, 0.8, 0.9];

/** Parte ganada y perdida de cada estado (la devolución no cuenta). */
const WIN_SHARE = { win: 1, halfWin: 0.5, push: 0, halfLoss: 0, loss: 0 };
const LOSS_SHARE = { win: 0, halfWin: 0, push: 0, halfLoss: 0.5, loss: 1 };

/** Apuesta efectiva de un registro según el modo, o null si no entra. */
function stakeOf(record, mode, probable) {
  if (mode === PERFORMANCE_MODES.BETS) return record.bet ? { odds: record.bet.odds, stake: record.bet.stake } : null;
  if (mode === PERFORMANCE_MODES.PROBABLE) return record.odds && isProbableCandidate(record, probable) ? { odds: record.odds, stake: 1 } : null;
  return record.tier !== TIERS.NONE ? { odds: record.odds, stake: 1 } : null;
}

/**
 * @typedef {Object} PerformanceSummary
 * @property {number} count       apuestas liquidadas
 * @property {number} staked
 * @property {number} profit
 * @property {number|null} roi
 * @property {number|null} hitRate   ganadas / decididas
 * @property {number|null} clv
 * @property {number} clvCount
 */

/** @returns {PerformanceSummary} */
function summarize(entries) {
  let staked = 0;
  let profit = 0;
  let wins = 0;
  let losses = 0;
  const clvs = [];
  entries.forEach(({ record, odds, stake }) => {
    const { status } = record.settlement;
    staked += stake;
    profit += stake * profitPerUnit(status, odds);
    wins += WIN_SHARE[status];
    losses += LOSS_SHARE[status];
    if (record.closingOdds) clvs.push(odds / record.closingOdds - 1);
  });
  return {
    count: entries.length,
    staked,
    profit,
    roi: staked > 0 ? profit / staked : null,
    hitRate: wins + losses > 0 ? wins / (wins + losses) : null,
    clv: clvs.length ? clvs.reduce((sum, value) => sum + value, 0) / clvs.length : null,
    clvCount: clvs.length,
  };
}

function groupBy(entries, keyOf) {
  const groups = new Map();
  entries.forEach((entry) => {
    const key = keyOf(entry);
    groups.set(key, [...(groups.get(key) ?? []), entry]);
  });
  return groups;
}

/** Predicho vs. ocurrido por rangos de probabilidad, con todas las predicciones liquidadas. */
function calibration(records, bins) {
  const rows = Array.from({ length: bins }, (_, index) => ({
    from: index / bins,
    to: (index + 1) / bins,
    predicted: 0,
    wins: 0,
    losses: 0,
    count: 0,
  }));
  records
    .filter((record) => record.settlement && record.settlement.status !== SETTLEMENT.PUSH)
    .forEach((record) => {
      const row = rows[Math.min(bins - 1, Math.floor(record.probability * bins))];
      row.predicted += record.probability;
      row.wins += WIN_SHARE[record.settlement.status];
      row.losses += LOSS_SHARE[record.settlement.status];
      row.count += 1;
    });
  return rows
    .filter((row) => row.count > 0)
    .map((row) => ({
      from: row.from,
      to: row.to,
      count: row.count,
      predicted: row.predicted / row.count,
      observed: row.wins / (row.wins + row.losses),
    }));
}

/**
 * @param {import('./history.js').HistoryRecord[]} records
 * @param {string} mode  PERFORMANCE_MODES
 * @param {{ calibrationBins: number }} config
 * @param {typeof import('../config.js').CONFIG.probable} [probable]  reglas del modo "probable"
 */
export function analyzePerformance(records, mode, config, probable) {
  const candidates = records
    .map((record) => ({ record, ...stakeOf(record, mode, probable) }))
    .filter((entry) => entry.stake !== undefined);
  const settled = candidates.filter((entry) => entry.record.settlement);
  const byTier = groupBy(settled, (entry) => entry.record.tier);
  const byMarket = groupBy(settled, (entry) => marketGroup(entry.record.market));
  const bandOf = (entry) => PROBABILITY_BANDS.findLast((from) => entry.record.probability >= from);
  const byBand = groupBy(settled, bandOf);
  return {
    total: summarize(settled),
    tracked: candidates.length,
    pending: candidates.length - settled.length,
    byTier: [...TIER_ORDER]
      .reverse()
      .filter((tier) => byTier.has(tier))
      .map((tier) => ({ key: tier, ...summarize(byTier.get(tier)) })),
    byMarket: [...byMarket.entries()].map(([key, entries]) => ({ key, ...summarize(entries) })).sort((first, second) => second.count - first.count),
    /** Por liga, de la que más picks tiene a la que menos. */
    byLeague: [...groupBy(settled, (entry) => entry.record.tournament ?? '').entries()]
      .filter(([key]) => key)
      .map(([key, entries]) => ({ key, ...summarize(entries) }))
      .sort((a, b) => b.count - a.count),
    /** Por probabilidad del modelo: `from` y `to` (null en el último rango). */
    byProbability: PROBABILITY_BANDS.map((from, index) => ({ from, to: PROBABILITY_BANDS[index + 1] ?? null }))
      .filter(({ from }) => byBand.has(from))
      .map(({ from, to }) => ({ key: from, from, to, ...summarize(byBand.get(from)) })),
    calibration: calibration(records, config.calibrationBins),
    entries: candidates,
  };
}
