/**
 * Historial: rendimiento (apuestas propias o picks del modelo), calibración,
 * carga de resultados y respaldo.
 */
import { PERFORMANCE_MODES, analyzePerformance } from '../../domain/performance.js';
import { SETTLEMENT, profitPerUnit } from '../../domain/settlement.js';
import { TEXTS, marketLabel, selectionLabel } from '../../texts.js';
import { card, dataTable, emptyState, kpi, note, plainBadge, probabilityCell, signedCell, tabs, tierBadge } from '../components.js';
import { h, replaceContent } from '../dom.js';
import { EMPTY, decimal, kickoff, odds, percent, signedPercent } from '../formatters.js';

const STATUS_BADGE = {
  [SETTLEMENT.WIN]: 'high',
  [SETTLEMENT.HALF_WIN]: 'high',
  [SETTLEMENT.PUSH]: 'low',
  [SETTLEMENT.HALF_LOSS]: 'medium',
  [SETTLEMENT.LOSS]: 'loss',
};

function units(value) {
  return value === null ? EMPTY : `${value > 0 ? '+' : ''}${decimal(value)} u`;
}

/* ---------- Indicadores ---------- */

function indicators(performance) {
  const { total, pending } = performance;
  return h(
    'div',
    { class: 'kpis' },
    kpi(TEXTS.history.settled, String(total.count), TEXTS.history.pending(pending)),
    kpi(TEXTS.history.profit, signedCell(total.profit, units(total.count ? total.profit : null)), TEXTS.history.staked(decimal(total.staked))),
    kpi(TEXTS.history.roi, signedCell(total.roi, signedPercent(total.roi)), TEXTS.history.hitRate(percent(total.hitRate))),
    kpi(TEXTS.history.clv, signedCell(total.clv, signedPercent(total.clv)), TEXTS.history.clvCount(total.clvCount)),
  );
}

/* ---------- Tablas de resumen ---------- */

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
      signedCell(summary.profit, units(summary.profit)),
      signedCell(summary.roi, signedPercent(summary.roi)),
      signedCell(summary.clv, signedPercent(summary.clv)),
    ],
  };
}

function breakdown(title, icon, rows) {
  return card({ title, icon }, rows.length ? dataTable({ head: SUMMARY_HEAD, rows }) : note(TEXTS.history.noSettled));
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
          cells: [
            `${Math.round(row.from * 100)}–${Math.round(row.to * 100)}%`,
            percent(row.predicted),
            probabilityCell(row.observed),
            row.count,
          ],
        })),
      })
    : note(TEXTS.history.noSettled);
  return card({ title: TEXTS.history.calibration, icon: '🎯' }, body, note(TEXTS.history.calibrationNote));
}

/* ---------- Registro ---------- */

function recordPick(record) {
  const names = { home: record.home, away: record.away };
  return h(
    'div',
    { class: 'pick-cell' },
    h('span', { class: 'pick-cell__match' }, `${kickoff(record.kickoff)} · ${record.matchTitle}`),
    h('span', { class: 'pick-cell__market' }, marketLabel(record.market)),
    h('span', { class: 'pick-cell__selection' }, selectionLabel(record.market, record.selection, names)),
    tierBadge(record.tier),
  );
}

function statusCell(record) {
  if (!record.settlement) return plainBadge(TEXTS.history.status.pending, 'none');
  const { status, score } = record.settlement;
  return h('div', { class: 'pick-cell' }, plainBadge(TEXTS.history.status[status], STATUS_BADGE[status]), h('span', { class: 'muted' }, score));
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
      signedCell(profit, units(profit)),
      signedCell(clv, clv === null ? EMPTY : `${signedPercent(clv)} (${odds(record.closingOdds)})`),
      mode === PERFORMANCE_MODES.BETS
        ? h('button', { type: 'button', class: 'bet-button is-registered', title: TEXTS.bets.editTitle, onClick: () => onEditBet(record) }, '✎')
        : null,
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
    : emptyState({ icon: '📒', title: TEXTS.history.empty[mode], text: TEXTS.history.emptyHint[mode] });
  return card({ title: TEXTS.history.records(entries.length), icon: '🧾' }, body);
}

/* ---------- Resultados y respaldo ---------- */

function fileButton(label, onFiles) {
  return h(
    'label',
    { class: 'button button--ghost' },
    h('input', { class: 'visually-hidden', type: 'file', accept: '.json,application/json', onChange: (event) => onFiles(event.target.files) }),
    label,
  );
}

function resultsCard(pendingCount, actions) {
  const textarea = h('textarea', {
    class: 'field__input field__input--code',
    rows: '3',
    spellcheck: 'false',
    placeholder: '{"tipo":"resultados-sofascore","version":1,"partidos":[...]}',
  });
  return card(
    { title: TEXTS.history.resultsTitle, icon: '🔄' },
    h(
      'ol',
      { class: 'steps' },
      TEXTS.history.resultsSteps.map(([title, text]) => h('li', {}, h('strong', {}, title), text)),
    ),
    h(
      'div',
      { class: 'stack stack--tight results-loader' },
      h(
        'div',
        { class: 'button-row' },
        h(
          'button',
          { type: 'button', class: 'button button--primary', disabled: pendingCount === 0, onClick: actions.copyResultsScript },
          TEXTS.history.copyScript(pendingCount),
        ),
        fileButton(TEXTS.history.uploadResults, (files) => actions.loadResults({ text: '', files })),
      ),
      textarea,
      h(
        'div',
        { class: 'button-row' },
        h('button', { type: 'button', class: 'button button--ghost', onClick: () => actions.loadResults({ text: textarea.value, files: [] }) }, TEXTS.history.settleButton),
      ),
    ),
  );
}

function backupCard(persistent, actions) {
  return card(
    { title: TEXTS.history.backupTitle, icon: '💾' },
    h(
      'div',
      { class: 'button-row' },
      h('button', { type: 'button', class: 'button button--ghost', onClick: actions.exportHistory }, TEXTS.history.export),
      fileButton(TEXTS.history.import, actions.importHistory),
      h('button', { type: 'button', class: 'button button--ghost button--danger', onClick: actions.clearHistory }, TEXTS.history.clear),
    ),
    note(persistent ? TEXTS.history.storageNote : TEXTS.history.memoryNote),
  );
}

/* ---------- Vista ---------- */

function statusLine(status) {
  if (!status?.message) return null;
  return h('p', { class: 'status history__status', 'data-kind': status.kind, role: 'status' }, status.message);
}

function header(actions) {
  return h(
    'div',
    { class: 'history__header' },
    h('h2', { class: 'card__title history__title' }, h('span', { class: 'card__title-icon', 'aria-hidden': 'true' }, '📒'), TEXTS.history.title),
    h('button', { type: 'button', class: 'button button--ghost button--small', onClick: actions.closeHistory }, TEXTS.history.back),
  );
}

/**
 * @param {HTMLElement} root
 * @param {{ history: { records: Object[], persistent: boolean, ready: boolean, status: Object|null }, historyMode: string, config: Object, pendingCount: number }} state
 * @param {Object} actions
 */
export function renderHistory(root, state, actions) {
  const { history, historyMode, config } = state;
  if (!history.ready) {
    replaceContent(root, emptyState({ icon: '⏳', title: TEXTS.history.loading }));
    return;
  }
  const performance = analyzePerformance(history.records, historyMode, config.history);
  const counts = {
    [PERFORMANCE_MODES.BETS]: history.records.filter((record) => record.bet).length,
    [PERFORMANCE_MODES.MODEL]: analyzePerformance(history.records, PERFORMANCE_MODES.MODEL, config.history).tracked,
  };
  replaceContent(
    root,
    h(
      'div',
      { class: 'stack' },
      header(actions),
      statusLine(history.status),
      tabs(
        Object.values(PERFORMANCE_MODES).map((mode) => ({ id: mode, label: TEXTS.history.modes[mode], count: counts[mode] })),
        historyMode,
        actions.setHistoryMode,
        { primary: true, label: TEXTS.history.title },
      ),
      indicators(performance),
      resultsCard(state.pendingCount, actions),
      h(
        'div',
        { class: 'two-columns' },
        breakdown(TEXTS.history.byTier, '🏷️', performance.byTier.map((row) => summaryRow(TEXTS.tiers[row.key], row))),
        breakdown(TEXTS.history.byMarket, '📊', performance.byMarket.map((row) => summaryRow(TEXTS.marketGroups[row.key] ?? row.key, row))),
      ),
      recordsCard(performance.entries, historyMode, config.history.recentShown, actions.editBet),
      calibrationCard(performance.calibration),
      backupCard(history.persistent, actions),
    ),
  );
}
