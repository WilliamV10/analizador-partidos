/**
 * Pestaña Jugadores: probabilidad de 1+ y 2+ tiros a puerta (y tiros totales en el
 * detalle), con su estado en la alineación. Abajo, quiénes no juegan de inicio.
 */
import { PLAYER_STATUS } from '../../../domain/players.js';
import { TEXTS } from '../../../texts.js';
import { card, dataTable, emptyState, note, segmented, teamShort } from '../../components.js';
import { h } from '../../dom.js';
import { EMPTY, decimal, odds, percent } from '../../formatters.js';
import { namesOf } from '../shared.js';

export const PLAYER_SIDES = Object.freeze({ BOTH: 'both', HOME: 'home', AWAY: 'away' });

const MINUTES_PER_MATCH = 90;
/** Desde esta probabilidad de 1+ a puerta el número se resalta. */
const HOT_PROBABILITY = 0.7;
/** Estados que significan "no empieza" (van a la tarjeta de ausentes). */
const NOT_STARTING = new Set([PLAYER_STATUS.OUT, PLAYER_STATUS.BENCH, PLAYER_STATUS.NOT_LISTED, PLAYER_STATUS.DOUBTFUL]);

const per90 = (count, minutes) => (minutes > 0 ? decimal((count / minutes) * MINUTES_PER_MATCH) : EMPTY);
const fairOdds = (probability) => (probability > 0 ? odds(1 / probability) : EMPTY);

function playerRow(projection, side, teamName) {
  const { season, shotsOnTarget } = projection;
  const hot = shotsOnTarget.one >= HOT_PROBABILITY;
  return h(
    'li',
    { class: 'card player-row' },
    h('span', { class: `player-row__crest player-row__crest--${side}` }, teamShort(teamName)),
    h(
      'div',
      { class: 'card--button__text' },
      h('span', { class: 'player-row__name' }, projection.name),
      h(
        'span',
        { class: 'player-row__sub' },
        TEXTS.players.line(teamName, TEXTS.playerStatus[projection.status], per90(season.shotsOnTarget, season.minutes), season.goals),
      ),
    ),
    h(
      'div',
      { class: 'player-row__side' },
      h('span', { class: `player-row__probability${hot ? ' player-row__probability--hot' : ''}` }, percent(shotsOnTarget.one)),
      h('span', { class: 'player-row__hint' }, TEXTS.players.twoPlus(percent(shotsOnTarget.two), fairOdds(shotsOnTarget.one))),
    ),
  );
}

function entriesFor(analysis, side) {
  const { players, match, config } = analysis;
  const names = namesOf(match);
  const of = (teamSide) => players[teamSide].slice(0, config.players.shown).map((projection) => ({ projection, side: teamSide, team: names[teamSide] }));
  const entries = side === PLAYER_SIDES.BOTH ? [...of('home'), ...of('away')] : of(side);
  return entries.sort((a, b) => b.projection.shotsOnTarget.one - a.projection.shotsOnTarget.one);
}

function absentCard(entries) {
  const absent = entries.filter(({ projection }) => NOT_STARTING.has(projection.status));
  if (!absent.length) return null;
  return card(
    { label: TEXTS.players.notStarting },
    h(
      'ul',
      { class: 'line-list' },
      absent.map(({ projection, team }) =>
        h(
          'li',
          { class: 'line-list__row' },
          h('span', {}, h('strong', {}, projection.name), h('span', { class: 'muted' }, ` · ${team}`)),
          h('span', { class: projection.status === PLAYER_STATUS.OUT ? 'negative' : 'muted' }, TEXTS.playerStatus[projection.status]),
        ),
      ),
    ),
  );
}

/** Tabla completa (tiros totales y a puerta) para quien quiera el detalle. */
function detailTable(entries) {
  return h(
    'details',
    { class: 'disclosure' },
    h('summary', { class: 'link' }, TEXTS.players.detail),
    dataTable({
      head: [
        { label: TEXTS.players.player },
        { label: TEXTS.players.minutes, numeric: true },
        { label: TEXTS.players.sotOne, numeric: true },
        { label: TEXTS.players.sotTwo, numeric: true },
        { label: TEXTS.players.shotsOne, numeric: true },
        { label: TEXTS.players.shotsTwo, numeric: true },
        { label: TEXTS.players.goalsXg, numeric: true },
      ],
      rows: entries.map(({ projection }) => ({
        cells: [
          projection.name,
          Math.round(projection.expectedMinutes),
          percent(projection.shotsOnTarget.one),
          percent(projection.shotsOnTarget.two),
          percent(projection.shots.one),
          percent(projection.shots.two),
          `${projection.season.goals} (${decimal(projection.season.xg, 1)})`,
        ],
      })),
    }),
  );
}

/**
 * @param {import('../../../domain/analyzeMatch.js').MatchAnalysis} analysis
 * @param {{ playerSide: string }} state
 * @param {{ setPlayerSide: Function }} actions
 */
export function renderPlayersTab(analysis, state, actions) {
  const names = namesOf(analysis.match);
  const side = Object.values(PLAYER_SIDES).includes(state.playerSide) ? state.playerSide : PLAYER_SIDES.BOTH;
  const entries = entriesFor(analysis, side);
  const playing = entries.filter(({ projection }) => projection.expectedMinutes > 0);
  return [
    segmented(
      [
        { id: PLAYER_SIDES.BOTH, label: TEXTS.players.both },
        { id: PLAYER_SIDES.HOME, label: names.home },
        { id: PLAYER_SIDES.AWAY, label: names.away },
      ],
      side,
      actions.setPlayerSide,
      TEXTS.players.sideLabel,
    ),
    note(TEXTS.players.intro),
    playing.length
      ? h('ul', { class: 'grid grid--players' }, playing.map(({ projection, side: teamSide, team }) => playerRow(projection, teamSide, team)))
      : emptyState({ icon: 'search', title: TEXTS.players.empty }),
    absentCard(entries),
    entries.length ? detailTable(entries) : null,
    note(TEXTS.players.note(analysis.config.players)),
  ];
}
