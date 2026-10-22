/**
 * Jugadores: probabilidad de 1+ y 2+ tiros (a puerta y totales) con su estado en la alineación.
 */
import { PLAYER_STATUS } from '../../domain/players.js';
import { TEXTS } from '../../texts.js';
import { card, dataTable, emptyState, note, plainBadge, probabilityCell } from '../components.js';
import { h } from '../dom.js';
import { decimal } from '../formatters.js';

const STATUS_BADGE = {
  [PLAYER_STATUS.STARTER]: 'high',
  [PLAYER_STATUS.BENCH]: 'low',
  [PLAYER_STATUS.DOUBTFUL]: 'medium',
  [PLAYER_STATUS.OUT]: 'none',
  [PLAYER_STATUS.NOT_LISTED]: 'none',
  [PLAYER_STATUS.UNKNOWN]: 'none',
};

const MINUTES_PER_MATCH = 90;

function per90(count, minutes) {
  return minutes > 0 ? decimal((count / minutes) * MINUTES_PER_MATCH) : '—';
}

function playerCell(projection) {
  return h(
    'div',
    { class: 'pick-cell' },
    h('span', { class: 'pick-cell__selection' }, projection.name, projection.position ? h('span', { class: 'muted' }, ` (${projection.position})`) : null),
    plainBadge(TEXTS.playerStatus[projection.status], STATUS_BADGE[projection.status]),
  );
}

function playerRow(projection) {
  const { season } = projection;
  const unavailable = projection.expectedMinutes === 0;
  return {
    className: unavailable ? 'row--tier-none' : null,
    cells: [
      playerCell(projection),
      Math.round(projection.expectedMinutes),
      probabilityCell(projection.shotsOnTarget.one),
      probabilityCell(projection.shotsOnTarget.two),
      probabilityCell(projection.shots.one),
      probabilityCell(projection.shots.two),
      per90(season.shotsOnTarget, season.minutes),
      `${season.goals} (${decimal(season.xg, 1)})`,
    ],
  };
}

const HEAD = [
  { label: TEXTS.players.player },
  { label: TEXTS.players.minutes, numeric: true },
  { label: TEXTS.players.sotOne, numeric: true },
  { label: TEXTS.players.sotTwo, numeric: true },
  { label: TEXTS.players.shotsOne, numeric: true },
  { label: TEXTS.players.shotsTwo, numeric: true },
  { label: TEXTS.players.sotPer90, numeric: true },
  { label: TEXTS.players.goalsXg, numeric: true },
];

function teamCard(team, projections, shown) {
  return card(
    { title: team.name, icon: '🎯' },
    projections.length
      ? dataTable({ head: HEAD, rows: projections.slice(0, shown).map(playerRow) })
      : emptyState({ icon: '👤', title: TEXTS.players.empty }),
  );
}

/** @param {import('../../domain/analyzeMatch.js').MatchAnalysis} analysis */
export function renderPlayers(analysis) {
  const { match, players, config } = analysis;
  return h(
    'div',
    { class: 'stack' },
    teamCard(match.home, players.home, config.players.shown),
    teamCard(match.away, players.away, config.players.shown),
    note(TEXTS.players.note(config.players)),
  );
}
