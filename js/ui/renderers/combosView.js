/**
 * Combinadas automáticas: las más probables y las de más valor.
 */
import { buildCombos } from '../../domain/combos.js';
import { TEXTS, marketLabel, selectionLabel } from '../../texts.js';
import { card, emptyState, note, tierBadge } from '../components.js';
import { h } from '../dom.js';
import { odds, percent, signedPercent } from '../formatters.js';

function legItem({ analysis, pick }) {
  const names = { home: analysis.match.home.name, away: analysis.match.away.name };
  return h(
    'li',
    { class: 'combo__leg' },
    h(
      'div',
      { class: 'pick-cell' },
      h('span', { class: 'pick-cell__match' }, analysis.match.title),
      h('span', { class: 'pick-cell__selection' }, `${marketLabel(pick.market)}: ${selectionLabel(pick.market, pick.key, names)}`),
    ),
    h('div', { class: 'combo__leg-side' }, tierBadge(pick.tier), h('strong', {}, odds(pick.odds))),
  );
}

function comboCard(combo, index) {
  return h(
    'article',
    { class: 'combo' },
    h(
      'header',
      { class: 'combo__header' },
      h('span', { class: 'combo__index' }, `#${index + 1}`),
      h('span', { class: 'muted' }, TEXTS.combos.selections(combo.legs.length)),
    ),
    h('ol', { class: 'combo__legs' }, combo.legs.map(legItem)),
    h(
      'dl',
      { class: 'combo__totals' },
      h('div', {}, h('dt', {}, TEXTS.combos.totalOdds), h('dd', {}, odds(combo.odds))),
      h('div', {}, h('dt', {}, TEXTS.combos.probability), h('dd', {}, percent(combo.probability, 1))),
      h('div', {}, h('dt', {}, TEXTS.columns.ev), h('dd', { class: 'positive' }, signedPercent(combo.ev))),
    ),
  );
}

function comboSection(title, icon, combos) {
  return card({ title, icon }, h('div', { class: 'grid-auto' }, combos.map(comboCard)));
}

/**
 * @param {import('../../domain/analyzeMatch.js').MatchAnalysis[]} analyses
 * @param {typeof import('../../config.js').CONFIG.combos} config
 */
export function renderCombos(analyses, config) {
  const { safest, bestValue, candidates } = buildCombos(analyses, config);
  if (!safest.length) {
    return card(
      { title: TEXTS.combos.title, icon: '🧩' },
      emptyState({ icon: '🧩', title: TEXTS.combos.empty, text: TEXTS.combos.rules(config, candidates) }),
    );
  }
  return h(
    'div',
    { class: 'stack' },
    comboSection(TEXTS.combos.safest, '🛡️', safest),
    comboSection(TEXTS.combos.bestValue, '📈', bestValue),
    note(TEXTS.combos.rules(config, candidates)),
  );
}
