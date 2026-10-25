/**
 * Historial en tres modos:
 *  - Mis apuestas: lo que registró el usuario (cuota y monto propios).
 *  - Picks del modelo: todas las selecciones con valor, a 1 unidad.
 *  - Pronósticos: el resultado más probable de cada partido (ganador, ambos anotan,
 *    más/menos 2.5), haya valor o no, para medir cuánto acierta el modelo.
 * Filtros (estado, mercado, nivel, búsqueda), lista paginada, desglose, calibración,
 * carga de resultados y respaldo.
 */
import { forecastPerformance } from '../../domain/forecasts.js';
import { ALL_GROUPS, STATUS_FILTERS, matchesScope, matchesStatus, paginate, statusCounts } from '../../domain/historyFilters.js';
import { marketGroup } from '../../domain/marketCatalog.js';
import { PERFORMANCE_MODES, analyzePerformance } from '../../domain/performance.js';
import { SETTLEMENT, profitPerUnit } from '../../domain/settlement.js';
import { TIER_ORDER } from '../../domain/value.js';
import { TEXTS, marketLabel, pickTitle } from '../../texts.js';
import {
  badge,
  button,
  card,
  chips,
  dataTable,
  emptyState,
  iconButton,
  note,
  pageHead,
  pagination,
  segmented,
  signed,
  stats,
  tierBadge,
  track,
} from '../components.js';
import { h } from '../dom.js';
import { EMPTY, decimal, kickoff, odds, percent, signedPercent } from '../formatters.js';
import { icon } from '../icons.js';
import { kickoffDate } from './shared.js';

/** Los dos modos de rendimiento más el de pronósticos. */
export const HISTORY_MODES = Object.freeze({ ...PERFORMANCE_MODES, FORECASTS: 'forecasts' });

const STATUS_BADGE = {
  [SETTLEMENT.WIN]: 'win',
  [SETTLEMENT.HALF_WIN]: 'win',
  [SETTLEMENT.PUSH]: 'none',
  [SETTLEMENT.HALF_LOSS]: 'warning',
  [SETTLEMENT.LOSS]: 'loss',
};

function units(value) {
  return value === null || value === undefined ? EMPTY : `${value > 0 ? '+' : ''}${decimal(value)} u`;
}

const namesOf = (record) => ({ home: record.home, away: record.away });

/* ---------- Filtros ---------- */

function groupsOf(records) {
  const order = Object.keys(TEXTS.marketGroupsShort);
  return [...new Set(records.map((record) => marketGroup(record.market)))].sort((a, b) => order.indexOf(a) - order.indexOf(b));
}

/** Campo de búsqueda fijo: se reutiliza en cada dibujo para no perder lo escrito. */
const searchInput = h('input', {
  class: 'input',
  type: 'search',
  enterkeyhint: 'search',
  placeholder: TEXTS.history.filters.searchPlaceholder,
  'aria-label': TEXTS.history.filters.search,
});

/**
 * @param {Object[]} allRecords   todos los registros (para ofrecer solo grupos que existen)
 * @param {Object[]} modeRecords  registros del modo activo ya filtrados (para contar por estado)
 */
function filtersCard(allRecords, modeRecords, filters, mode, actions) {
  const counts = statusCounts(modeRecords);
  searchInput.value = filters.search;
  searchInput.onchange = () => actions.setHistoryFilters({ search: searchInput.value.trim() });
  const groups = groupsOf(allRecords);
  return card(
    { label: TEXTS.history.filters.title, actions: hasActiveFilters(filters) ? button({ label: TEXTS.history.filters.clear, variant: 'sm', onClick: actions.clearHistoryFilters }) : null },
    h('div', { class: 'filters' }, [
      h('label', { class: 'search' }, icon('search', 18), searchInput),
      chips(
        Object.values(STATUS_FILTERS).map((status) => ({ id: status, label: `${TEXTS.history.filters.status[status]} · ${counts[status]}` })),
        filters.status,
        (status) => actions.setHistoryFilters({ status }),
        TEXTS.history.filters.statusLabel,
      ),
      groups.length > 1
        ? chips(
            [ALL_GROUPS, ...groups].map((group) => ({ id: group, label: group === ALL_GROUPS ? TEXTS.marketGroups.all : TEXTS.marketGroupsShort[group] ?? group })),
            filters.group,
            (group) => actions.setHistoryFilters({ group }),
            TEXTS.history.filters.groupLabel,
          )
        : null,
      mode === HISTORY_MODES.FORECASTS
        ? null
        : chips(
            TIER_ORDER.map((tier) => ({ id: tier, label: tier === 'none' ? TEXTS.history.filters.anyTier : TEXTS.tiers[tier] })),
            filters.minTier,
            (minTier) => actions.setHistoryFilters({ minTier }),
            TEXTS.history.filters.tierLabel,
          ),
    ]),
  );
}

function hasActiveFilters(filters) {
  return filters.status !== STATUS_FILTERS.ALL || filters.group !== ALL_GROUPS || filters.minTier !== 'none' || Boolean(filters.search);
}

/* ---------- Registros ---------- */

function statusBadge(record) {
  if (!record.settlement) return badge(TEXTS.history.status.pending, 'none');
  return badge(TEXTS.history.status[record.settlement.status], STATUS_BADGE[record.settlement.status]);
}

/**
 * Una fila del registro: el pick a la izquierda; cuota, estado y ganancia a la derecha.
 * @param {{ record: Object, odds: number|null, stake: number|null }} entry
 */
function recordRow({ record, odds: takenOdds, stake }, { showMoney, onEditBet, extra = null }) {
  const profit = showMoney && record.settlement && takenOdds ? stake * profitPerUnit(record.settlement.status, takenOdds) : null;
  const clv = showMoney && record.closingOdds && takenOdds ? takenOdds / record.closingOdds - 1 : null;
  return h(
    'li',
    { class: 'record' },
    h(
      'div',
      { class: 'record__main' },
      h('span', { class: 'note' }, `${kickoff(record.kickoff)} · ${record.matchTitle}`),
      h('span', { class: 'record__title' }, pickTitle(record.market, record.selection, namesOf(record))),
      h('span', { class: 'record__meta' }, record.tier !== 'none' ? tierBadge(record.tier) : null, marketLabel(record.market), extra),
    ),
    h(
      'div',
      { class: 'record__side' },
      h('span', { class: 'record__odds' }, takenOdds ? odds(takenOdds) : EMPTY),
      statusBadge(record),
    ),
    h(
      'div',
      { class: 'record__actions' },
      record.settlement ? h('span', {}, TEXTS.history.score(record.settlement.score)) : null,
      showMoney && stake ? h('span', {}, TEXTS.history.stake(decimal(stake))) : null,
      profit !== null ? h('span', { class: 'record__profit' }, signed(profit, units(profit))) : null,
      clv !== null ? h('span', {}, TEXTS.history.clvValue(signedPercent(clv), odds(record.closingOdds))) : null,
      onEditBet ? iconButton({ icon: 'edit', label: TEXTS.bets.editTitle, onClick: () => onEditBet(record) }) : null,
    ),
  );
}

function recordsCard({ title, entries, page, pageSize, onPage, renderRow, empty }) {
  const when = (record) => kickoffDate(record.kickoff)?.getTime() ?? record.analyzedAt;
  const sorted = [...entries].sort((a, b) => when(b.record) - when(a.record));
  const current = paginate(sorted, page, pageSize);
  return card(
    { label: title(entries.length) },
    current.items.length ? h('ul', { class: 'records' }, current.items.map(renderRow)) : empty,
    pagination({ ...current, pageSize, onPage }),
  );
}

/* ---------- Apuestas y picks del modelo ---------- */

function indicators(performance) {
  const { total, pending } = performance;
  return stats(
    [
      { value: String(total.count), label: TEXTS.history.settled, hint: TEXTS.history.pending(pending) },
      { value: signed(total.profit, units(total.count ? total.profit : null)), label: TEXTS.history.profit, hint: TEXTS.history.staked(decimal(total.staked)) },
      { value: signed(total.roi, signedPercent(total.roi)), label: TEXTS.history.roi, hint: TEXTS.history.hitRate(percent(total.hitRate)) },
      { value: signed(total.clv, signedPercent(total.clv)), label: TEXTS.history.clv, hint: TEXTS.history.clvCount(total.clvCount) },
    ],
    2,
  );
}

const SUMMARY_HEAD = [
  { label: '' },
  { label: TEXTS.history.columns.count, numeric: true },
  { label: TEXTS.history.columns.hitRate, numeric: true },
  { label: TEXTS.history.columns.profit, numeric: true },
  { label: TEXTS.history.columns.roi, numeric: true },
];

function summaryRow(label, summary) {
  return { cells: [label, summary.count, percent(summary.hitRate), signed(summary.profit, units(summary.profit)), signed(summary.roi, signedPercent(summary.roi))] };
}

function breakdown(title, rows) {
  return card({ label: title }, rows.length ? dataTable({ head: SUMMARY_HEAD, rows, variant: 'summary' }) : note(TEXTS.history.noSettled));
}

function calibrationCard(rows) {
  const body = rows.length
    ? dataTable({
        variant: 'summary',
        head: [
          { label: TEXTS.history.columns.range },
          { label: TEXTS.history.columns.predicted, numeric: true },
          { label: TEXTS.history.columns.observed, numeric: true },
          { label: TEXTS.history.columns.count, numeric: true },
        ],
        rows: rows.map((row) => ({
          cells: [`${Math.round(row.from * 100)}–${Math.round(row.to * 100)}%`, percent(row.predicted), h('strong', {}, percent(row.observed)), row.count],
        })),
      })
    : note(TEXTS.history.noSettled);
  return card({ label: TEXTS.history.calibration }, body, note(TEXTS.history.calibrationNote));
}

function performanceView(performance, state, actions) {
  const { historyMode: mode, historyFilters: filters, config } = state;
  const listed = performance.entries.filter((entry) => matchesStatus(entry.record, filters.status));
  return [
    indicators(performance),
    recordsCard({
      title: TEXTS.history.records,
      entries: listed,
      page: state.historyPage,
      pageSize: config.history.pageSize,
      onPage: actions.setHistoryPage,
      renderRow: (entry) => recordRow(entry, { showMoney: true, onEditBet: mode === PERFORMANCE_MODES.BETS ? actions.editBet : null }),
      empty: emptyState({ icon: 'history', title: TEXTS.history.empty[mode], text: TEXTS.history.emptyHint[mode] }),
    }),
    h(
      'div',
      { class: 'grid grid--wide' },
      breakdown(TEXTS.history.byTier, performance.byTier.map((row) => summaryRow(TEXTS.tiers[row.key], row))),
      breakdown(TEXTS.history.byMarket, performance.byMarket.map((row) => summaryRow(TEXTS.marketGroups[row.key] ?? row.key, row))),
    ),
    calibrationCard(performance.calibration),
  ];
}

/* ---------- Pronósticos ---------- */

function hitRateCard(label, summary) {
  return card(
    { label },
    h(
      'div',
      { class: 'hit-rate' },
      h(
        'div',
        { class: 'hit-rate__head' },
        h('span', { class: 'hit-rate__value tone-accent' }, percent(summary.hitRate)),
        h('span', { class: 'note' }, TEXTS.history.forecasts.hits(summary.hits, summary.count)),
      ),
      track({ value: summary.hitRate ?? 0, marker: summary.expected }),
      h('span', { class: 'note' }, summary.count ? TEXTS.history.forecasts.expected(percent(summary.expected)) : TEXTS.history.forecasts.pendingOnly(summary.pending)),
    ),
  );
}

function forecastsView(performance, state, actions) {
  const { historyFilters: filters, config } = state;
  const listed = performance.entries.filter((entry) => matchesStatus(entry.record, filters.status));
  return [
    h(
      'div',
      { class: 'grid' },
      hitRateCard(TEXTS.history.forecasts.total, performance.total),
      performance.byMarket.map((row) => hitRateCard(TEXTS.history.forecasts.markets[row.key], row)),
    ),
    note(TEXTS.history.forecasts.note),
    recordsCard({
      title: TEXTS.history.forecasts.records,
      entries: listed.map((entry) => ({ ...entry, odds: entry.record.odds, stake: null })),
      page: state.historyPage,
      pageSize: config.history.pageSize,
      onPage: actions.setHistoryPage,
      renderRow: (entry) => recordRow(entry, { showMoney: false, extra: h('span', {}, TEXTS.history.forecasts.probability(percent(entry.record.probability))) }),
      empty: emptyState({ icon: 'history', title: TEXTS.history.forecasts.empty, text: TEXTS.history.forecasts.emptyHint }),
    }),
  ];
}

/* ---------- Resultados y respaldo ---------- */

function fileButton(label, onFiles) {
  return h(
    'label',
    { class: 'button' },
    h('input', { class: 'visually-hidden', type: 'file', accept: '.json,application/json', onChange: (event) => onFiles(event.target.files) }),
    label,
  );
}

const resultsInput = h('textarea', {
  class: 'textarea',
  rows: '3',
  spellcheck: 'false',
  placeholder: '{"tipo":"resultados-sofascore","version":1,"partidos":[…]}',
  'aria-label': TEXTS.history.resultsTitle,
});

function resultsCard(pendingCount, actions) {
  return h(
    'details',
    { class: 'card disclosure disclosure--card', open: pendingCount > 0 ? true : null },
    h('summary', { class: 'card__head' }, h('h3', { class: 'card__title' }, TEXTS.history.resultsTitle), badge(TEXTS.history.pending(pendingCount), pendingCount ? 'warning' : 'none')),
    note(TEXTS.history.resultsSteps.map(([title, text]) => `${title}: ${text}`).join(' ')),
    h(
      'div',
      { class: 'button-row' },
      button({ label: TEXTS.history.copyScript(pendingCount), icon: 'copy', variant: 'primary', disabled: pendingCount === 0, onClick: actions.copyResultsScript }),
      fileButton(TEXTS.history.uploadResults, (files) => actions.loadResults({ text: '', files })),
    ),
    resultsInput,
    button({ label: TEXTS.history.settleButton, onClick: () => actions.loadResults({ text: resultsInput.value, files: [] }) }),
  );
}

function backupCard(persistent, actions) {
  return card(
    { label: TEXTS.history.backupTitle },
    h(
      'div',
      { class: 'button-row' },
      button({ label: TEXTS.history.export, onClick: actions.exportHistory }),
      fileButton(TEXTS.history.import, actions.importHistory),
      button({ label: TEXTS.history.clear, variant: 'danger', onClick: actions.clearHistory }),
    ),
    note(persistent ? TEXTS.history.storageNote : TEXTS.history.memoryNote),
  );
}

/* ---------- Pantalla ---------- */

function modeCounts(records, config) {
  return {
    [HISTORY_MODES.BETS]: records.filter((record) => record.bet).length,
    [HISTORY_MODES.MODEL]: analyzePerformance(records, PERFORMANCE_MODES.MODEL, config.history).tracked,
    [HISTORY_MODES.FORECASTS]: forecastPerformance(records).entries.length,
  };
}

/**
 * @param {Object} state   history, historyMode, historyFilters, historyPage, config, pendingCount
 * @param {Object} actions
 */
export function renderHistory(state, actions) {
  const { history, historyMode: mode, historyFilters: filters, config } = state;
  if (!history.ready) return emptyState({ icon: 'history', title: TEXTS.history.loading });
  const isForecasts = mode === HISTORY_MODES.FORECASTS;
  const scoped = history.records.filter((record) => matchesScope(record, isForecasts ? { ...filters, minTier: 'none' } : filters));
  const performance = isForecasts ? forecastPerformance(scoped) : analyzePerformance(scoped, mode, config.history);
  const counts = modeCounts(history.records, config);
  return [
    pageHead({ eyebrow: TEXTS.history.eyebrow, title: TEXTS.history.title }),
    history.status?.message ? h('p', { class: 'status', 'data-kind': history.status.kind, role: 'status' }, history.status.message) : null,
    segmented(
      Object.values(HISTORY_MODES).map((id) => ({ id, label: TEXTS.history.modes[id], hint: counts[id] })),
      mode,
      actions.setHistoryMode,
      TEXTS.history.title,
    ),
    resultsCard(state.pendingCount, actions),
    filtersCard(history.records, performance.entries.map((entry) => entry.record), filters, mode, actions),
    isForecasts ? forecastsView(performance, state, actions) : performanceView(performance, state, actions),
    backupCard(history.persistent, actions),
  ];
}
