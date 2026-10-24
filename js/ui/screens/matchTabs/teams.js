/**
 * Pestaña Equipos y H2H: estadísticas por bloque (temporada, casa/fuera, otra
 * competición, temporada pasada), últimos resultados, H2H y alineación con bajas.
 */
import { TEXTS } from '../../../texts.js';
import { badge, card, note, sectionLabel, segmented } from '../../components.js';
import { h } from '../../dom.js';
import { EMPTY, decimal } from '../../formatters.js';
import { namesOf } from '../shared.js';

const RECENT_RESULTS = 12;
const SIDES = ['home', 'away'];

const record = (summary) => `${summary.n} PJ · ${summary.wins}G ${summary.draws}E ${summary.losses}P`;
const range = (forValue, againstValue) =>
  forValue === null && againstValue === null ? EMPTY : `${decimal(forValue, 1)}–${decimal(againstValue, 1)}`;
const countOf = (count, total) => (total ? `${count}/${total}` : EMPTY);

function tile(label, value, tone = '') {
  return h('div', { class: 'tile' }, h('span', { class: 'tile__label' }, label), h('span', { class: `tile__value${tone ? ` ${tone}` : ''}` }, value));
}

/** Tarjeta de un bloque de partidos (8 indicadores). */
function blockCard(title, summary, { collapsed = false } = {}) {
  if (!summary) return null;
  const { avg } = summary;
  const columns = TEXTS.columns;
  const xgAgainstTone = avg.xgAgainst !== null && avg.goalsAgainst !== null && avg.xgAgainst > avg.goalsAgainst + 0.2 ? 'negative' : '';
  const body = h(
    'div',
    { class: 'tiles' },
    tile(columns.goalsFor, decimal(avg.goalsFor)),
    tile(columns.goalsAgainst, decimal(avg.goalsAgainst)),
    tile(columns.xgFor, decimal(avg.xgFor)),
    tile(columns.xgAgainst, decimal(avg.xgAgainst), xgAgainstTone),
    tile(columns.shotsOnTarget, range(avg.shotsOnTargetFor, avg.shotsOnTargetAgainst)),
    tile(columns.corners, range(avg.cornersFor, avg.cornersAgainst)),
    tile(columns.btts, countOf(summary.btts, summary.n)),
    tile(columns.over25, countOf(summary.overs[2.5], summary.n)),
  );
  if (collapsed) {
    return h(
      'details',
      { class: 'card disclosure disclosure--card' },
      h('summary', { class: 'card__head' }, h('h3', { class: 'card__title' }, title), h('span', { class: 'muted note' }, record(summary))),
      body,
    );
  }
  return card({ title, actions: h('span', { class: 'muted note' }, record(summary)) }, body);
}

function resultChips(rows) {
  if (!rows.length) return null;
  return [
    sectionLabel(TEXTS.teams.recent),
    h(
      'ul',
      { class: 'result-chips' },
      rows.slice(0, RECENT_RESULTS).map((row) => {
        const outcome = row.goalsFor > row.goalsAgainst ? 'win' : row.goalsFor === row.goalsAgainst ? 'draw' : 'loss';
        return h(
          'li',
          { class: `result-chip result-chip--${outcome}`, title: `${row.date ?? ''} · ${row.isHome ? TEXTS.match.home : TEXTS.match.away} vs ${row.opponent}` },
          `${row.goalsFor}-${row.goalsAgainst} ${TEXTS.form[{ win: 'W', draw: 'D', loss: 'L' }[outcome]]}`,
        );
      }),
    ),
  ];
}

function h2hCard(analysis) {
  const { h2h, h2hRows } = analysis.summaries;
  const names = namesOf(analysis.match);
  if (!h2h) return card({ label: TEXTS.sections.h2h }, note(TEXTS.sections.noH2h));
  const homeWins = h2h.wins;
  const awayWins = h2h.losses;
  const monthYear = (date) => (date ? `${date.slice(5, 7)}/${date.slice(0, 4)}` : '');
  return card(
    { label: TEXTS.teams.h2hTitle(h2hRows.length) },
    h('p', { class: 'note' }, TEXTS.teams.h2hRecord(names, homeWins, h2h.draws, awayWins)),
    h(
      'div',
      { class: 'result-bar', 'aria-hidden': 'true' },
      h('span', { class: 'result-bar__segment result-bar__segment--home', style: `flex-grow:${homeWins}` }),
      h('span', { class: 'result-bar__segment result-bar__segment--draw', style: `flex-grow:${h2h.draws}` }),
      h('span', { class: 'result-bar__segment result-bar__segment--away', style: `flex-grow:${awayWins}` }),
    ),
    h(
      'ul',
      {},
      h2hRows.map((row) => {
        const [left, leftGoals, rightGoals, right] = row.isHome
          ? [names.home, row.goalsFor, row.goalsAgainst, row.opponent]
          : [row.opponent, row.goalsAgainst, row.goalsFor, names.home];
        return h('li', { class: 'h2h-row' }, h('span', { class: 'h2h-row__date' }, monthYear(row.date)), h('span', {}, `${left} `, h('strong', {}, `${leftGoals}-${rightGoals}`), ` ${right}`));
      }),
    ),
    note(TEXTS.teams.h2hSummary(h2h, names.home)),
  );
}

function lineupCard(team, confirmed) {
  const { lineup } = team;
  if (!lineup) return card({ label: TEXTS.teams.lineupTitle(confirmed, team.name, null) }, note(TEXTS.sections.noLineup));
  return card(
    {
      label: TEXTS.teams.lineupTitle(confirmed, team.name, lineup.formation),
      actions: confirmed ? badge(TEXTS.sections.confirmed, 'win') : badge(TEXTS.teams.unconfirmed, 'warning'),
    },
    lineup.starters.length ? h('p', { class: 'lineup-names' }, lineup.starters.map((player) => player.name).join(' · ')) : null,
    lineup.absences.length
      ? h(
          'ul',
          { class: 'line-list' },
          lineup.absences.map((absence) =>
            h(
              'li',
              { class: 'line-list__row' },
              h('strong', {}, absence.name),
              h(
                'span',
                { class: absence.status === 'missing' ? 'negative' : 'tone-warning' },
                [TEXTS.absenceStatus[absence.status], TEXTS.absenceReasons[absence.reason] ?? absence.reason].filter(Boolean).join(' · '),
              ),
            ),
          ),
        )
      : note(TEXTS.sections.noAbsences),
    lineup.substitutes.length
      ? h('details', { class: 'disclosure' }, h('summary', { class: 'link' }, `${TEXTS.sections.substitutes} (${lineup.substitutes.length})`), h('p', { class: 'lineup-names' }, lineup.substitutes.join(' · ')))
      : null,
  );
}

/**
 * @param {import('../../../domain/analyzeMatch.js').MatchAnalysis} analysis
 * @param {{ teamSide: string }} state
 * @param {{ setTeamSide: Function }} actions
 */
export function renderTeamsTab(analysis, state, actions) {
  const side = SIDES.includes(state.teamSide) ? state.teamSide : 'home';
  const team = analysis.match[side];
  const summaries = analysis.summaries[side];
  const names = namesOf(analysis.match);
  return [
    segmented(SIDES.map((id) => ({ id, label: names[id] })), side, actions.setTeamSide, TEXTS.teams.sideLabel),
    h(
      'div',
      { class: 'grid' },
      h(
        'div',
        { class: 'stack' },
        blockCard(TEXTS.blocks.current, summaries.current),
        blockCard(side === 'home' ? TEXTS.blocks.venueHome : TEXTS.blocks.venueAway, summaries.venue),
        blockCard(TEXTS.blocks.other(team.otherName), summaries.other, { collapsed: true }),
        blockCard(TEXTS.blocks.previous, summaries.previous, { collapsed: true }),
        resultChips(team.current),
      ),
      h('div', { class: 'stack' }, h2hCard(analysis), lineupCard(team, analysis.match.lineupsConfirmed)),
    ),
  ];
}
