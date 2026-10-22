/**
 * Ranking global de picks de todos los partidos, con filtros por mercado, nivel y cuota mínima.
 */
import { ALL_MARKETS, availableMarketGroups, rankPicks } from '../../domain/ranking.js';
import { TIER_ORDER } from '../../domain/value.js';
import { TEXTS } from '../../texts.js';
import { card, emptyState, note } from '../components.js';
import { h } from '../dom.js';
import { picksTable } from './valueTable.js';

function selectField(label, value, options, onChange) {
  return h(
    'label',
    { class: 'field' },
    h('span', { class: 'field__label' }, label),
    h(
      'select',
      { class: 'field__input field__input--small', onChange: (event) => onChange(event.target.value) },
      options.map((option) => h('option', { value: option.value, selected: option.value === value }, option.label)),
    ),
  );
}

function oddsField(value, onChange) {
  return h(
    'label',
    { class: 'field' },
    h('span', { class: 'field__label' }, TEXTS.ranking.minOdds),
    h('input', {
      class: 'field__input field__input--small',
      type: 'number',
      inputmode: 'decimal',
      min: '1',
      step: '0.05',
      value: String(value),
      onChange: (event) => onChange(Number(event.target.value) || 1),
    }),
  );
}

function filtersBar(analyses, filters, onChange) {
  const marketOptions = [ALL_MARKETS, ...availableMarketGroups(analyses)].map((group) => ({
    value: group,
    label: TEXTS.marketGroups[group] ?? group,
  }));
  const tierOptions = TIER_ORDER.map((tier) => ({ value: tier, label: TEXTS.ranking.tierAtLeast(tier) }));
  return h(
    'div',
    { class: 'filters' },
    selectField(TEXTS.ranking.market, filters.market, marketOptions, (market) => onChange({ market })),
    selectField(TEXTS.ranking.minTier, filters.minTier, tierOptions, (minTier) => onChange({ minTier })),
    oddsField(filters.minOdds, (minOdds) => onChange({ minOdds })),
  );
}

/**
 * @param {import('../../domain/analyzeMatch.js').MatchAnalysis[]} analyses
 * @param {import('../../domain/ranking.js').PickFilters} filters
 * @param {(patch: Partial<import('../../domain/ranking.js').PickFilters>) => void} onChangeFilters
 * @param {import('./valueTable.js').Betting} betting
 */
export function renderPicksRanking(analyses, filters, onChangeFilters, betting) {
  const ranked = rankPicks(analyses, filters);
  const entries = ranked.map(({ analysis, pick }) => ({ pick, match: analysis.match, showMatch: true }));
  return card(
    { title: TEXTS.ranking.title(ranked.length), icon: '🏆' },
    filtersBar(analyses, filters, onChangeFilters),
    entries.length
      ? picksTable(entries, betting)
      : emptyState({ icon: '🔍', title: TEXTS.ranking.empty, text: TEXTS.ranking.emptyHint }),
    note(TEXTS.sections.valueNote),
  );
}
