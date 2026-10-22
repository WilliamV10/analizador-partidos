/**
 * Alineaciones (XI por línea, suplentes) y bajas de ambos equipos.
 */
import { TEXTS } from '../../texts.js';
import { card, plainBadge } from '../components.js';
import { h } from '../dom.js';

/** Orden de las líneas del campo y posiciones sin dato al final. */
const LINES = ['G', 'D', 'M', 'F', null];

const ABSENCE_BADGE = { missing: 'none', doubtful: 'medium' };

function playerChip(player) {
  return h(
    'li',
    { class: 'player-chip' },
    h('span', { class: `player-chip__pos player-chip__pos--${player.position ?? 'X'}` }, player.position ?? '·'),
    player.name,
  );
}

function startersByLine(starters) {
  return LINES.map((position) => ({ position, players: starters.filter((player) => player.position === position) }))
    .filter((line) => line.players.length)
    .map((line) =>
      h(
        'div',
        { class: 'lineup__group' },
        h('p', { class: 'lineup__group-label' }, TEXTS.positions[line.position ?? 'unknown']),
        h('ul', { class: 'player-list' }, line.players.map(playerChip)),
      ),
    );
}

function absenceItem(absence) {
  const reason = TEXTS.absenceReasons[absence.reason] ?? absence.reason;
  return h(
    'li',
    {},
    absence.status ? plainBadge(TEXTS.absenceStatus[absence.status], ABSENCE_BADGE[absence.status]) : null,
    h('strong', {}, absence.name),
    reason ? h('span', { class: 'muted' }, reason) : null,
  );
}

function absences(lineup) {
  return h(
    'div',
    { class: 'lineup__group' },
    h('p', { class: 'lineup__group-label' }, TEXTS.sections.absences),
    lineup.absences.length
      ? h('ul', { class: 'absence-list' }, lineup.absences.map(absenceItem))
      : h('p', { class: 'muted note' }, TEXTS.sections.noAbsences),
  );
}

function substitutes(lineup) {
  if (!lineup.substitutes.length) return null;
  return h(
    'details',
    { class: 'disclosure' },
    h('summary', {}, `${TEXTS.sections.substitutes} (${lineup.substitutes.length})`),
    h('p', { class: 'muted note' }, lineup.substitutes.join(', ')),
  );
}

function teamLineup(team) {
  const { lineup } = team;
  return card(
    {
      title: team.name,
      icon: '👕',
      actions: lineup?.formation ? plainBadge(lineup.formation) : null,
    },
    lineup
      ? [startersByLine(lineup.starters), absences(lineup), substitutes(lineup)]
      : h('p', { class: 'muted' }, TEXTS.sections.noLineup),
  );
}

/** @param {import('../../types.js').Match} match */
export function renderLineups(match) {
  return h('div', { class: 'two-columns' }, teamLineup(match.home), teamLineup(match.away));
}
