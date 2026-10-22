/**
 * Vista completa de un partido: cabecera, alertas y secciones en pestañas.
 */
import { TIERS } from '../../domain/value.js';
import { TEXTS } from '../../texts.js';
import { tabs } from '../components.js';
import { h } from '../dom.js';
import { renderAlerts } from './alertsPanel.js';
import { renderCardsCard, renderCornersCard, renderHalfTimeTable, renderHandicapTable } from './extraMarkets.js';
import { renderPlayers } from './playersTable.js';
import { renderLineups } from './lineups.js';
import { renderMatchHeader } from './matchHeader.js';
import { renderOverview } from './overview.js';
import { renderGoalsTable, renderResultTable } from './probabilityTables.js';
import { renderTeamStats } from './teamStats.js';
import { renderValueTable } from './valueTable.js';

/** Pestañas del partido en orden. `render` recibe (analysis, options). */
const MATCH_TABS = [
  { id: 'overview', render: (analysis) => renderOverview(analysis) },
  {
    id: 'value',
    count: (analysis) => analysis.picks.filter((pick) => pick.tier !== TIERS.NONE).length,
    render: (analysis, options) => renderValueTable(analysis, options),
  },
  {
    id: 'markets',
    render: (analysis) =>
      h(
        'div',
        { class: 'stack' },
        renderResultTable(analysis),
        renderGoalsTable(analysis),
        renderHalfTimeTable(analysis),
        renderHandicapTable(analysis),
      ),
  },
  {
    id: 'counts',
    render: (analysis) => h('div', { class: 'stack' }, renderCornersCard(analysis), renderCardsCard(analysis)),
  },
  { id: 'players', render: (analysis) => renderPlayers(analysis) },
  { id: 'teams', render: (analysis) => renderTeamStats(analysis) },
  { id: 'lineups', render: (analysis) => renderLineups(analysis.match) },
];

export const DEFAULT_MATCH_TAB = MATCH_TABS[0].id;
export const MATCH_TAB_IDS = Object.freeze(MATCH_TABS.map((tab) => tab.id));

/**
 * @param {import('../../domain/analyzeMatch.js').MatchAnalysis} analysis
 * @param {{ matchTab: string, onSelectTab: (id: string) => void, onlyValue: boolean, onToggleOnlyValue: () => void }} options
 */
export function renderMatchDetail(analysis, options) {
  const active = MATCH_TABS.find((tab) => tab.id === options.matchTab) ?? MATCH_TABS[0];
  const items = MATCH_TABS.map((tab) => ({ id: tab.id, label: TEXTS.matchTabs[tab.id], count: tab.count?.(analysis) ?? null }));
  return h(
    'article',
    { class: 'match-detail stack', id: 'match-detail', tabindex: '-1' },
    renderMatchHeader(analysis),
    renderAlerts(analysis.alerts),
    tabs(items, active.id, options.onSelectTab, { label: TEXTS.a11y.matchTabs }),
    h('div', { role: 'tabpanel' }, active.render(analysis, options)),
  );
}
