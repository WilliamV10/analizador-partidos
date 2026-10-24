/**
 * Historial: rendimiento (apuestas propias o picks del modelo), carga de resultados,
 * desglose por nivel y mercado, registro, calibración y respaldo.
 */
import { PERFORMANCE_MODES, analyzePerformance } from '../../domain/performance.js';
import { SETTLEMENT, profitPerUnit } from '../../domain/settlement.js';
import { TEXTS, marketLabel, pickTitle } from '../../texts.js';
import { badge, button, card, dataTable, emptyState, iconButton, note, pageHead, segmented, signed, stats, tierBadge } from '../components.js';
import { h } from '../dom.js';
import { EMPTY, decimal, kickoff, odds, percent, signedPercent } from '../formatters.js';

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
  { label: TEXTS.history.columns.clv, numeric: true },
];

function summaryRow(label, summary) {
  return {
    cells: [
      label,
      summary.count,
      percent(summary.hitRate),
      signed(summary.profit, units(summary.profit)),
      signed(summary.roi, signedPercent(summary.roi)),
      signed(summary.clv, signedPercent(summary.clv)),
    ],
  };
}

function breakdown(title, rows) {
  return card({ label: title }, rows.length ? dataTable({ head: SUMMARY_HEAD, rows }) : note(TEXTS.history.noSettled));
}

function calibrationCard(rows) {
  const body = rows.length
    ? dataTable({
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

function recordPick(record) {
  const names = { home: record.home, away: record.away };
  return h(
    'div',
    { class: 'leg__text' },
    h('p', { class: 'note' }, `${kickoff(record.kickoff)} · ${record.matchTitle}`),
    h('p', { class: 'leg__title' }, pickTitle(record.market, record.selection, names)),
    h('div', { class: 'leg__meta' }, tierBadge(record.tier), marketLabel(record.market)),
  );
}

function statusCell(record) {
  if (!record.settlement) return badge(TEXTS.history.status.pending, 'none');
  const { status, score } = record.settlement;
  return h('span', { class: 'stack stack--tight' }, badge(TEXTS.history.status[status], STATUS_BADGE[status]), h('span', { class: 'note' }, score));
}

function entryRow({ record, odds: takenOdds, stake }, mode, onEditBet) {
  const profit = record.settlement ? stake * profitPerUnit(record.settlement.status, takenOdds) : null;
  const clv = record.closingOdds ? takenOdds / record.closingOdds - 1 : null;
  return {
    cells: [
      recordPick(record),
      h('strong', {}, odds(takenOdds)),
      decimal(stake),
      statusCell(record),
      signed(profit, units(profit)),
      signed(clv, clv === null ? EMPTY : `${signedPercent(clv)} (${odds(record.closingOdds)})`),
      mode === PERFORMANCE_MODES.BETS ? iconButton({ icon: 'edit', label: TEXTS.bets.editTitle, onClick: () => onEditBet(record) }) : null,
    ],
  };
}

function recordsCard(entries, mode, limit, onEditBet) {
  const recent = [...entries].sort((a, b) => b.record.analyzedAt - a.record.analyzedAt).slice(0, limit);
  const body = recent.length
    ? dataTable({
        head: [
          { label: TEXTS.columns.pick },
          { label: TEXTS.columns.odds, numeric: true },
          { label: TEXTS.history.columns.stake, numeric: true },
          { label: TEXTS.history.columns.status },
          { label: TEXTS.history.columns.profit, numeric: true },
          { label: TEXTS.history.columns.clv, numeric: true },
          { label: '' },
        ],
        rows: recent.map((entry) => entryRow(entry, mode, onEditBet)),
      })
    : emptyState({ icon: 'history', title: TEXTS.history.empty[mode], text: TEXTS.history.emptyHint[mode] });
  return card({ label: TEXTS.history.records(entries.length) }, body);
}

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
  return card(
    { title: TEXTS.history.resultsTitle },
    h(
      'ol',
      { class: 'steps' },
      TEXTS.history.resultsSteps.map(([title], index) => h('li', { class: 'step' }, h('span', { class: 'step__number' }, index + 1), title)),
    ),
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

/**
 * @param {Object} state
 * @param {Object} actions
 */
export function renderHistory(state, actions) {
  const { history, historyMode, config } = state;
  if (!history.ready) return emptyState({ icon: 'history', title: TEXTS.history.loading });
  const performance = analyzePerformance(history.records, historyMode, config.history);
  const counts = {
    [PERFORMANCE_MODES.BETS]: history.records.filter((record) => record.bet).length,
    [PERFORMANCE_MODES.MODEL]: analyzePerformance(history.records, PERFORMANCE_MODES.MODEL, config.history).tracked,
  };
  return [
    pageHead({ eyebrow: TEXTS.history.eyebrow, title: TEXTS.history.title }),
    history.status?.message ? h('p', { class: 'status', 'data-kind': history.status.kind, role: 'status' }, history.status.message) : null,
    segmented(
      Object.values(PERFORMANCE_MODES).map((mode) => ({ id: mode, label: `${TEXTS.history.modes[mode]} · ${counts[mode]}` })),
      historyMode,
      actions.setHistoryMode,
      TEXTS.history.title,
    ),
    h(
      'div',
      { class: 'grid grid--wide' },
      h('div', { class: 'stack' }, indicators(performance), resultsCard(state.pendingCount, actions)),
      h(
        'div',
        { class: 'stack' },
        breakdown(TEXTS.history.byTier, performance.byTier.map((row) => summaryRow(TEXTS.tiers[row.key], row))),
        breakdown(TEXTS.history.byMarket, performance.byMarket.map((row) => summaryRow(TEXTS.marketGroups[row.key] ?? row.key, row))),
      ),
    ),
    recordsCard(performance.entries, historyMode, config.history.recentShown, actions.editBet),
    h('div', { class: 'grid grid--wide' }, calibrationCard(performance.calibration), backupCard(history.persistent, actions)),
  ];
}
