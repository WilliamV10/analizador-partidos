/**
 * Pestaña Valor: cada cuota contra la probabilidad propia, como tarjetas
 * (Mi prob. vs Casa), filtrables por grupo de mercado y ordenables (más valor, más probable,
 * mayor cuota). El "+" registra la apuesta. En "Todos los mercados" no salen las selecciones
 * que la casa ve por debajo de 40 % ni las de cuota menor a 1.10 (la misma regla de los
 * pronósticos): solo meten ruido.
 */
import { isForecastWorthy } from '../../../domain/history.js';
import { marketGroup } from '../../../domain/marketCatalog.js';
import { TIERS } from '../../../domain/value.js';
import { TEXTS } from '../../../texts.js';
import { chips, compareBars, emptyState, iconButton, note, segmented, selectField, tierBadge } from '../../components.js';
import { h } from '../../dom.js';
import { odds, signedPercent } from '../../formatters.js';
import { pickMarket, pickName } from '../shared.js';

export const VALUE_MODES = Object.freeze({ VALUE: 'value', ALL: 'all' });

/** Cómo ordenar las tarjetas: por EV, por probabilidad propia o por cuota (de mayor a menor). */
export const VALUE_SORTS = Object.freeze({ VALUE: 'value', PROBABILITY: 'probability', ODDS: 'odds' });
const SORTERS = {
  [VALUE_SORTS.VALUE]: (a, b) => b.ev - a.ev,
  [VALUE_SORTS.PROBABILITY]: (a, b) => b.probability - a.probability || b.ev - a.ev,
  [VALUE_SORTS.ODDS]: (a, b) => b.odds - a.odds || b.ev - a.ev,
};
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
  const worthy = analysis.picks.filter((pick) => pick.tier !== TIERS.NONE || isForecastWorthy(pick, analysis.config.forecasts));
  const hidden = analysis.picks.length - worthy.length;
  const withoutValue = worthy.length - withValue.length;
  const all = state.valueMode === VALUE_MODES.ALL;
  const base = all ? worthy : withValue;
  const items = groupItems(base);
  const group = items.some((item) => item.id === state.valueGroup) ? state.valueGroup : ALL_GROUPS;
  const sort = SORTERS[state.valueSort] ? state.valueSort : VALUE_SORTS.VALUE;
  const shown = (group === ALL_GROUPS ? base : base.filter((pick) => marketGroup(pick.market) === group)).slice().sort(SORTERS[sort]);
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
    base.length > 1
      ? selectField({
          label: TEXTS.value.sortLabel,
          value: sort,
          options: Object.values(VALUE_SORTS).map((id) => ({ id, label: TEXTS.value.sorts[id] })),
          onChange: actions.setValueSort,
        })
      : null,
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
    all && hidden ? note(TEXTS.value.hidden(hidden)) : null,
    note(TEXTS.sections.valueNote),
  ];
}
