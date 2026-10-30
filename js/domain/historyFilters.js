/**
 * Filtros del historial: estado (pendiente, ganada, perdida, devuelta), grupo de
 * mercado, nivel mínimo, origen (en vivo o histórico) y búsqueda por equipo o torneo.
 * Funciones puras.
 */
import { RECORD_ORIGINS, recordOrigin } from './history.js';
import { marketGroup } from './marketCatalog.js';
import { SETTLEMENT } from './settlement.js';
import { TIER_ORDER } from './value.js';
import { normalizeName } from '../utils/text.js';

export const STATUS_FILTERS = Object.freeze({ ALL: 'all', PENDING: 'pending', WON: 'won', LOST: 'lost', PUSH: 'push' });
export const ALL_GROUPS = 'all';
export const ALL_ORIGINS = 'all';
export const ORIGIN_FILTERS = Object.freeze([ALL_ORIGINS, RECORD_ORIGINS.LIVE, RECORD_ORIGINS.BACKTEST]);

const STATUS_OF_SETTLEMENT = {
  [SETTLEMENT.WIN]: STATUS_FILTERS.WON,
  [SETTLEMENT.HALF_WIN]: STATUS_FILTERS.WON,
  [SETTLEMENT.LOSS]: STATUS_FILTERS.LOST,
  [SETTLEMENT.HALF_LOSS]: STATUS_FILTERS.LOST,
  [SETTLEMENT.PUSH]: STATUS_FILTERS.PUSH,
};

/** Estado de un registro para filtrar: pending, won, lost o push. */
export function recordStatus(record) {
  return record.settlement ? STATUS_OF_SETTLEMENT[record.settlement.status] ?? STATUS_FILTERS.PENDING : STATUS_FILTERS.PENDING;
}

/**
 * @typedef {Object} HistoryFilters
 * @property {string} status   ver STATUS_FILTERS
 * @property {string} group    grupo de mercado (MARKET_GROUPS) o 'all'
 * @property {string} minTier  none, low, medium o high
 * @property {string} origin   all, live o backtest
 * @property {string} search   texto libre (equipo o torneo)
 */

export const DEFAULT_HISTORY_FILTERS = Object.freeze({
  status: STATUS_FILTERS.ALL,
  group: ALL_GROUPS,
  minTier: 'none',
  origin: ALL_ORIGINS,
  search: '',
});

/** Filtros que cambian los indicadores (todo menos el estado). */
export function matchesScope(record, { group, minTier, origin = ALL_ORIGINS, search }) {
  if (origin !== ALL_ORIGINS && recordOrigin(record) !== origin) return false;
  if (group !== ALL_GROUPS && marketGroup(record.market) !== group) return false;
  if (TIER_ORDER.indexOf(record.tier) < TIER_ORDER.indexOf(minTier)) return false;
  const text = normalizeName(search);
  if (text && !normalizeName(`${record.matchTitle} ${record.tournament ?? ''}`).includes(text)) return false;
  return true;
}

export function matchesStatus(record, status) {
  return status === STATUS_FILTERS.ALL || recordStatus(record) === status;
}

/** Cuántos registros hay en cada estado (para los chips). */
export function statusCounts(records) {
  const counts = Object.fromEntries(Object.values(STATUS_FILTERS).map((status) => [status, 0]));
  records.forEach((record) => {
    counts[STATUS_FILTERS.ALL] += 1;
    counts[recordStatus(record)] += 1;
  });
  return counts;
}

/** Página `page` (desde 0) de una lista. */
export function paginate(items, page, pageSize) {
  const pages = Math.max(1, Math.ceil(items.length / pageSize));
  const current = Math.min(Math.max(0, page), pages - 1);
  return { items: items.slice(current * pageSize, (current + 1) * pageSize), page: current, pages, total: items.length };
}
