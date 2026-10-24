/**
 * Pantalla de un partido: cabecera, avisos y pestañas. En escritorio va junto a la
 * lista de partidos del día (lista lateral + detalle).
 */
import { TEXTS } from '../../texts.js';
import { badge, eyebrow, formBadges, iconButton, tabs } from '../components.js';
import { h } from '../dom.js';
import { kickoffParts } from '../formatters.js';
import { renderCountsTab } from './matchTabs/counts.js';
import { renderMarketsTab } from './matchTabs/markets.js';
import { renderPlayersTab } from './matchTabs/players.js';
import { renderSummaryTab } from './matchTabs/summary.js';
import { renderTeamsTab } from './matchTabs/teams.js';
import { renderValueTab } from './matchTabs/value.js';
import { dayTitle, matchCard, valuePicks } from './shared.js';

/** Pestañas en orden. Para agregar una, súmala aquí y su texto en TEXTS.matchTabs. */
const MATCH_TABS = [
  { id: 'summary', render: renderSummaryTab },
  { id: 'value', render: renderValueTab, count: (analysis) => valuePicks(analysis).length },
  { id: 'markets', render: renderMarketsTab },
  { id: 'counts', render: renderCountsTab },
  { id: 'players', render: renderPlayersTab },
  { id: 'teams', render: renderTeamsTab },
];

export const DEFAULT_MATCH_TAB = MATCH_TABS[0].id;

function metaText(match) {
  const parts = kickoffParts(match.kickoff);
  return [match.tournament, match.round ? TEXTS.meta.roundShort(match.round) : null, parts?.date, parts?.time]
    .filter(Boolean)
    .join(' · ');
}

function teamColumn(team, side) {
  return h(
    'div',
    { class: `match-head__team match-head__team--${side}` },
    h('span', { class: 'faint note' }, [team.position ? `${team.position}° · ` : '', side === 'home' ? TEXTS.match.home : TEXTS.match.away]),
    h('h1', { class: 'display' }, team.name),
    formBadges(team.form),
  );
}

function header(analysis, actions) {
  const { match, context } = analysis;
  return h(
    'header',
    { class: 'match-head' },
    h(
      'div',
      { class: 'match-head__bar' },
      iconButton({ icon: 'back', label: TEXTS.match.back, onClick: actions.backToDay }),
      eyebrow(metaText(match)),
    ),
    h('div', { class: 'match-head__teams' }, teamColumn(match.home, 'home'), h('span', { class: 'match-head__vs' }, 'VS'), teamColumn(match.away, 'away')),
    h(
      'div',
      { class: 'match-head__badges' },
      badge(match.lineupsConfirmed ? TEXTS.sections.confirmed : TEXTS.sections.probable, match.lineupsConfirmed ? 'win' : 'warning'),
      context ? badge(TEXTS.context.applied(context.confidence), 'info') : null,
      match.referee ? badge(TEXTS.meta.referee(match.referee, match.refereeStats), 'none') : null,
    ),
  );
}

function sidebar(state, selectedId, actions) {
  return h(
    'aside',
    { class: 'split__aside', 'aria-label': TEXTS.sections.matches },
    h('h2', { class: 'display display--sm section-label' }, dayTitle(state.analyses)),
    h(
      'div',
      { class: 'stack stack--tight' },
      state.analyses.map((analysis) =>
        matchCard(analysis, { onOpen: actions.openMatch, selected: analysis.match.id === selectedId, compact: true }),
      ),
    ),
  );
}

/**
 * @param {Object} state
 * @param {Object} actions
 */
export function renderMatch(state, actions) {
  const analysis = state.analyses.find((candidate) => candidate.match.id === state.selectedId) ?? state.analyses[0];
  const active = MATCH_TABS.find((tab) => tab.id === state.matchTab) ?? MATCH_TABS[0];
  const items = MATCH_TABS.map((tab) => ({ id: tab.id, label: TEXTS.matchTabs[tab.id], count: tab.count?.(analysis) ?? null }));
  const withList = state.analyses.length > 1;
  return h(
    'div',
    { class: withList ? 'split' : 'stack' },
    withList ? sidebar(state, analysis.match.id, actions) : null,
    h(
      'article',
      { class: 'split__main stack', 'aria-label': analysis.match.title },
      header(analysis, actions),
      h('div', { class: 'sticky-tabs' }, tabs(items, active.id, actions.selectMatchTab, TEXTS.a11y.matchTabs)),
      h('div', { class: 'stack', role: 'tabpanel' }, active.render(analysis, state, actions)),
    ),
  );
}
