/**
 * Lista lateral de partidos cargados (solo cuando hay más de uno).
 */
import { TIERS } from '../../domain/value.js';
import { TEXTS, marketLabel, selectionLabel } from '../../texts.js';
import { tierBadge } from '../components.js';
import { h } from '../dom.js';
import { kickoff, odds, percent } from '../formatters.js';

export function bestPick(analysis) {
  return analysis.picks.find((pick) => pick.tier !== TIERS.NONE) ?? null;
}

function pickSummary(analysis) {
  const pick = bestPick(analysis);
  if (!pick) return h('span', { class: 'match-item__pick muted' }, TEXTS.tiers.none);
  const names = { home: analysis.match.home.name, away: analysis.match.away.name };
  return h(
    'span',
    { class: 'match-item__pick' },
    tierBadge(pick.tier),
    h('span', {}, `${marketLabel(pick.market)}: ${selectionLabel(pick.market, pick.key, names)}`),
    h('strong', {}, `@ ${odds(pick.odds)}`),
  );
}

function probabilityStrip({ home, draw, away }) {
  return [
    h(
      'span',
      { class: 'match-item__bar', 'aria-hidden': 'true' },
      [home, draw, away].map((probability) => h('span', { style: `flex:${probability}` })),
    ),
    h(
      'span',
      { class: 'match-item__probs' },
      h('span', {}, `1 · ${percent(home)}`),
      h('span', {}, `X · ${percent(draw)}`),
      h('span', {}, `2 · ${percent(away)}`),
    ),
  ];
}

function listItem(analysis, isSelected, onSelect) {
  const { match, probabilities } = analysis;
  return h(
    'li',
    {},
    h(
      'button',
      {
        type: 'button',
        class: `match-item${isSelected ? ' is-selected' : ''}`,
        'aria-current': isSelected ? 'true' : null,
        onClick: () => onSelect(match.id),
      },
      h(
        'span',
        { class: 'match-item__top' },
        h('span', { class: 'match-item__time' }, kickoff(match.kickoff)),
        h('span', { class: 'match-item__tournament' }, match.tournament ?? ''),
      ),
      h('span', { class: 'match-item__title' }, match.title),
      probabilityStrip(probabilities.result),
      pickSummary(analysis),
    ),
  );
}

/**
 * @param {import('../../domain/analyzeMatch.js').MatchAnalysis[]} analyses
 * @param {string|null} selectedId
 * @param {(id: string) => void} onSelect
 */
export function renderMatchList(analyses, selectedId, onSelect) {
  return h(
    'nav',
    { class: 'match-list', 'aria-label': TEXTS.sections.matches },
    h('h3', { class: 'section-title' }, `${TEXTS.sections.matches} (${analyses.length})`),
    h('ul', {}, analyses.map((analysis) => listItem(analysis, analysis.match.id === selectedId, onSelect))),
  );
}
