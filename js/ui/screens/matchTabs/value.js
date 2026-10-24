/**
 * Pestaña Valor: cada cuota contra la probabilidad propia, como tarjetas
 * (Mi prob. vs Casa), filtrables por grupo de mercado. El "+" registra la apuesta.
 */
import { marketGroup } from '../../../domain/marketCatalog.js';
import { TIERS } from '../../../domain/value.js';
import { TEXTS } from '../../../texts.js';
import { chips, compareBars, emptyState, iconButton, note, segmented, tierBadge } from '../../components.js';
import { h } from '../../dom.js';
import { odds, signedPercent } from '../../formatters.js';
import { pickMarket, pickName } from '../shared.js';

export const VALUE_MODES = Object.freeze({ VALUE: 'value', ALL: 'all' });
const ALL_GROUPS = 'all';

/**
 * @param {import('../../../types.js').Match} match
 * @param {import('../../../domain/value.js').ValuePick} pick
 * @param {{ isRegistered: Function, onRegister: Function }} betting
 */
export function pickCard(match, pick, betting) {
  const registered = betting.isRegistered(match, pick);
  return h(
    'article',
    { class: 'card' },
    h(
      'div',
      { class: 'pick-card__head' },
      h(
        'div',
        { class: 'pick-card__title' },
        h('p', { class: 'note' }, pickMarket(pick)),
        h('h3', { class: 'pick-card__name' }, pickName(pick, match)),
      ),
      h('span', { class: 'pick-card__odds' }, odds(pick.odds)),
      iconButton({
        icon: registered ? 'check' : 'plus',
        label: registered ? TEXTS.bets.registered : TEXTS.bets.register,
        variant: `icon-button--boxed${registered ? ' is-on' : ''}`,
        onClick: () => betting.onRegister(match, pick),
      }),
    ),
    compareBars([
      { label: TEXTS.columns.mine, value: pick.probability },
      { label: TEXTS.columns.fair, value: pick.fairProbability, tone: 'muted' },
    ]),
    h(
      'div',
      { class: 'pick-card__foot' },
      tierBadge(pick.tier),
      h(
        'span',
        {},
        `${TEXTS.columns.ev} `,
        h('span', { class: `pick-card__ev${pick.ev < 0 ? ' pick-card__ev--negative' : ''}` }, signedPercent(pick.ev)),
      ),
    ),
  );
}

function groupItems(picks) {
  const groups = [...new Set(picks.map((pick) => marketGroup(pick.market)))];
  return [{ id: ALL_GROUPS, label: TEXTS.marketGroups.all }, ...groups.map((group) => ({ id: group, label: TEXTS.marketGroupsShort[group] ?? TEXTS.marketGroups[group] ?? group }))];
}

/**
 * @param {import('../../../domain/analyzeMatch.js').MatchAnalysis} analysis
 * @param {{ valueMode: string, valueGroup: string }} state
 * @param {{ setValueMode: Function, setValueGroup: Function, betting: Object }} actions
 */
export function renderValueTab(analysis, state, actions) {
  const withValue = analysis.picks.filter((pick) => pick.tier !== TIERS.NONE);
  const withoutValue = analysis.picks.length - withValue.length;
  const base = state.valueMode === VALUE_MODES.ALL ? analysis.picks : withValue;
  const items = groupItems(base);
  const group = items.some((item) => item.id === state.valueGroup) ? state.valueGroup : ALL_GROUPS;
  const shown = group === ALL_GROUPS ? base : base.filter((pick) => marketGroup(pick.market) === group);
  return [
    segmented(
      [
        { id: VALUE_MODES.VALUE, label: TEXTS.value.withValue(withValue.length) },
        { id: VALUE_MODES.ALL, label: TEXTS.value.allMarkets },
      ],
      state.valueMode,
      actions.setValueMode,
      TEXTS.value.modeLabel,
    ),
    items.length > 2 ? chips(items, group, actions.setValueGroup, TEXTS.value.groupLabel) : null,
    shown.length
      ? h('div', { class: 'grid' }, shown.map((pick) => pickCard(analysis.match, pick, actions.betting)))
      : emptyState({ title: TEXTS.sections.noValue, text: TEXTS.sections.noValueHint }),
    state.valueMode === VALUE_MODES.VALUE && withoutValue
      ? h(
          'button',
          { type: 'button', class: 'card card--button', onClick: () => actions.setValueMode(VALUE_MODES.ALL) },
          h('span', { class: 'card--button__text card__title' }, TEXTS.value.withoutValue(withoutValue)),
        )
      : null,
    note(TEXTS.sections.valueNote),
  ];
}
