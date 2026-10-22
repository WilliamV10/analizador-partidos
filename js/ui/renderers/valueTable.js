/**
 * Tabla de valor: cada cuota contra la probabilidad propia, ordenada por EV.
 * También la usa el ranking global de picks (con el nombre del partido).
 * La última columna registra la apuesta en el historial.
 */
import { TIERS } from '../../domain/value.js';
import { TEXTS, marketLabel, selectionLabel } from '../../texts.js';
import { card, dataTable, emptyState, note, probabilityCell, signedCell, switchToggle, tierBadge } from '../components.js';
import { h } from '../dom.js';
import { odds, percent, signedPercent } from '../formatters.js';

/**
 * @typedef {Object} Betting
 * @property {(match: Object, pick: Object) => boolean} isRegistered
 * @property {(match: Object, pick: Object) => void} onRegister
 */

function namesOf(match) {
  return { home: match.home.name, away: match.away.name };
}

/** Celda compacta: mercado arriba, selección y confianza abajo (cabe en el celular). */
function pickCell(pick, match, showMatch) {
  return h(
    'div',
    { class: 'pick-cell' },
    showMatch ? h('span', { class: 'pick-cell__match' }, match.title) : null,
    h('span', { class: 'pick-cell__market' }, marketLabel(pick.market)),
    h('span', { class: 'pick-cell__selection' }, selectionLabel(pick.market, pick.key, namesOf(match))),
    tierBadge(pick.tier),
  );
}

function registerButton(match, pick, betting) {
  const registered = betting.isRegistered(match, pick);
  return h(
    'button',
    {
      type: 'button',
      class: `bet-button${registered ? ' is-registered' : ''}`,
      title: registered ? TEXTS.bets.registered : TEXTS.bets.register,
      'aria-label': registered ? TEXTS.bets.registered : TEXTS.bets.register,
      onClick: () => betting.onRegister(match, pick),
    },
    registered ? '✓' : '+',
  );
}

function pickRow({ pick, match, showMatch }, betting) {
  return {
    className: `row--tier-${pick.tier}`,
    cells: [
      pickCell(pick, match, showMatch),
      h('strong', {}, odds(pick.odds)),
      probabilityCell(pick.probability),
      percent(pick.fairProbability),
      signedCell(pick.ev, signedPercent(pick.ev)),
      signedCell(pick.edge, signedPercent(pick.edge)),
      registerButton(match, pick, betting),
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
  { label: '' },
];

/**
 * @param {{ pick: import('../../domain/value.js').ValuePick, match: import('../../types.js').Match, showMatch?: boolean }[]} entries
 * @param {Betting} betting
 */
export function picksTable(entries, betting) {
  return dataTable({ head: PICK_HEAD, rows: entries.map((entry) => pickRow(entry, betting)) });
}

/**
 * @param {import('../../domain/analyzeMatch.js').MatchAnalysis} analysis
 * @param {{ onlyValue: boolean, onToggleOnlyValue: () => void, betting: Betting }} options
 */
export function renderValueTable(analysis, { onlyValue, onToggleOnlyValue, betting }) {
  const picks = onlyValue ? analysis.picks.filter((pick) => pick.tier !== TIERS.NONE) : analysis.picks;
  const body = picks.length
    ? picksTable(picks.map((pick) => ({ pick, match: analysis.match })), betting)
    : emptyState({ icon: '🔍', title: TEXTS.sections.noValue, text: TEXTS.sections.noValueHint });
  return card(
    { title: TEXTS.sections.value, icon: '💎', actions: switchToggle(TEXTS.sections.onlyValue, onlyValue, onToggleOnlyValue) },
    body,
    note(TEXTS.sections.valueNote),
  );
}
