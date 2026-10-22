/**
 * Tabla de valor: cada cuota contra la probabilidad propia, ordenada por EV.
 * También la usa el ranking global de picks (con la columna del partido).
 */
import { TIERS } from '../../domain/value.js';
import { TEXTS, marketLabel, selectionLabel } from '../../texts.js';
import { card, dataTable, emptyState, note, probabilityCell, signedCell, switchToggle, tierBadge } from '../components.js';
import { h } from '../dom.js';
import { odds, percent, signedPercent } from '../formatters.js';

/** Celda compacta: mercado arriba, selección y confianza abajo (cabe en el celular). */
function pickCell(pick, names, matchTitle) {
  return h(
    'div',
    { class: 'pick-cell' },
    matchTitle ? h('span', { class: 'pick-cell__match' }, matchTitle) : null,
    h('span', { class: 'pick-cell__market' }, marketLabel(pick.market)),
    h('span', { class: 'pick-cell__selection' }, selectionLabel(pick.market, pick.key, names)),
    tierBadge(pick.tier),
  );
}

function pickRow(pick, names, matchTitle = null) {
  return {
    className: `row--tier-${pick.tier}`,
    cells: [
      pickCell(pick, names, matchTitle),
      h('strong', {}, odds(pick.odds)),
      probabilityCell(pick.probability),
      percent(pick.fairProbability),
      signedCell(pick.ev, signedPercent(pick.ev)),
      signedCell(pick.edge, signedPercent(pick.edge)),
    ],
  };
}

const PICK_HEAD = [
  { label: TEXTS.columns.pick },
  { label: TEXTS.columns.odds, numeric: true },
  { label: TEXTS.columns.mine, numeric: true },
  { label: TEXTS.columns.fair, numeric: true },
  { label: TEXTS.columns.ev, numeric: true },
  { label: TEXTS.columns.edge, numeric: true },
];

/**
 * Tabla de picks. Cada entrada trae sus nombres (y opcionalmente el partido).
 * @param {{ pick: import('../../domain/value.js').ValuePick, names: { home: string, away: string }, matchTitle?: string }[]} entries
 */
export function picksTable(entries) {
  return dataTable({ head: PICK_HEAD, rows: entries.map(({ pick, names, matchTitle }) => pickRow(pick, names, matchTitle)) });
}

/**
 * @param {import('../../domain/analyzeMatch.js').MatchAnalysis} analysis
 * @param {{ onlyValue: boolean, onToggleOnlyValue: () => void }} options
 */
export function renderValueTable(analysis, { onlyValue, onToggleOnlyValue }) {
  const names = { home: analysis.match.home.name, away: analysis.match.away.name };
  const picks = onlyValue ? analysis.picks.filter((pick) => pick.tier !== TIERS.NONE) : analysis.picks;
  const body = picks.length
    ? picksTable(picks.map((pick) => ({ pick, names })))
    : emptyState({ icon: '🔍', title: TEXTS.sections.noValue, text: TEXTS.sections.noValueHint });
  return card(
    { title: TEXTS.sections.value, icon: '💎', actions: switchToggle(TEXTS.sections.onlyValue, onlyValue, onToggleOnlyValue) },
    body,
    note(TEXTS.sections.valueNote),
  );
}
