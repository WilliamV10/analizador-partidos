/**
 * Estadísticas por bloque (temporada actual, otra competición, casa/fuera, temporada pasada),
 * últimos resultados y H2H.
 */
import { TEXTS } from '../../texts.js';
import { card, dataTable, note, subtitle } from '../components.js';
import { h } from '../dom.js';
import { EMPTY, countOf, decimal } from '../formatters.js';

const RECENT_RESULTS = 12;

const STATS_HEAD = [
  { label: TEXTS.columns.block },
  { label: TEXTS.columns.played, numeric: true },
  { label: TEXTS.columns.record, numeric: true },
  { label: TEXTS.columns.goalsFor, numeric: true },
  { label: TEXTS.columns.goalsAgainst, numeric: true },
  { label: TEXTS.columns.xgFor, numeric: true },
  { label: TEXTS.columns.xgAgainst, numeric: true },
  { label: TEXTS.columns.shotsOnTarget, numeric: true },
  { label: TEXTS.columns.corners, numeric: true },
  { label: TEXTS.columns.yellows, numeric: true },
  { label: TEXTS.columns.btts, numeric: true },
  { label: TEXTS.columns.over25, numeric: true },
];

function pairText(forValue, againstValue, digits = 1) {
  if (forValue === null && againstValue === null) return EMPTY;
  return `${decimal(forValue, digits)}-${decimal(againstValue, digits)}`;
}

function summaryRow(label, summary) {
  if (!summary) return null;
  const { avg } = summary;
  return {
    cells: [
      label,
      summary.n,
      `${summary.wins}-${summary.draws}-${summary.losses}`,
      decimal(avg.goalsFor),
      decimal(avg.goalsAgainst),
      decimal(avg.xgFor),
      decimal(avg.xgAgainst),
      pairText(avg.shotsOnTargetFor, avg.shotsOnTargetAgainst),
      pairText(avg.cornersFor, avg.cornersAgainst),
      decimal(avg.yellowsFor, 1),
      countOf(summary.btts, summary.n),
      countOf(summary.overs[2.5], summary.n),
    ],
  };
}

function resultChip(row) {
  const variant = row.goalsFor > row.goalsAgainst ? 'win' : row.goalsFor === row.goalsAgainst ? 'draw' : 'loss';
  const venue = row.isHome ? 'L' : 'V';
  return h(
    'li',
    { class: `result-chip result-chip--${variant}`, title: `${row.date ?? ''} vs ${row.opponent}` },
    `${row.goalsFor}-${row.goalsAgainst} ${venue}`,
  );
}

function teamCard(team, summaries, isHomeTeam) {
  const venueLabel = isHomeTeam ? TEXTS.blocks.venueHome : TEXTS.blocks.venueAway;
  const rows = [
    summaryRow(TEXTS.blocks.current, summaries.current),
    summaryRow(TEXTS.blocks.other(team.otherName), summaries.other),
    summaryRow(venueLabel, summaries.venue),
    summaryRow(TEXTS.blocks.previous, summaries.previous),
  ].filter(Boolean);
  return card(
    { title: team.name, icon: isHomeTeam ? '🏠' : '✈️' },
    dataTable({ head: STATS_HEAD, rows }),
    subtitle(TEXTS.sections.recentResults),
    h('ul', { class: 'chips' }, team.current.slice(0, RECENT_RESULTS).map(resultChip)),
  );
}

function h2hLine(row, homeName) {
  const text = row.isHome
    ? `${homeName} ${row.goalsFor}-${row.goalsAgainst} ${row.opponent}`
    : `${row.opponent} ${row.goalsAgainst}-${row.goalsFor} ${homeName}`;
  return h('li', {}, h('span', { class: 'muted' }, `${row.date ?? ''} `), text);
}

function h2hCard(analysis) {
  const { h2h, h2hRows } = analysis.summaries;
  const homeName = analysis.match.home.name;
  if (!h2h) return card({ title: TEXTS.sections.h2h, icon: '⚔️' }, note(TEXTS.sections.noH2h));
  return card(
    { title: `${TEXTS.sections.h2h} (${homeName})`, icon: '⚔️' },
    dataTable({ head: STATS_HEAD, rows: [summaryRow(TEXTS.sections.h2h, h2h)] }),
    h('ul', { class: 'plain-list' }, h2hRows.map((row) => h2hLine(row, homeName))),
  );
}

/** @param {import('../../domain/analyzeMatch.js').MatchAnalysis} analysis */
export function renderTeamStats(analysis) {
  const { match, summaries } = analysis;
  return h(
    'div',
    { class: 'stack' },
    teamCard(match.home, summaries.home, true),
    teamCard(match.away, summaries.away, false),
    h2hCard(analysis),
  );
}
