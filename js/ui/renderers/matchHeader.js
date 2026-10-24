/**
 * Cabecera del partido: equipos, posición, forma, hora, goles esperados y barra 1X2.
 */
import { TEXTS } from '../../texts.js';
import { formBadge, plainBadge, resultBar, teamCrest } from '../components.js';
import { h } from '../dom.js';
import { decimal, kickoffParts } from '../formatters.js';

function teamBlock(team) {
  return h(
    'div',
    { class: 'team-block' },
    teamCrest(team.name),
    h('div', { class: 'team-block__name' }, team.name),
    team.position ? h('span', { class: 'team-block__position' }, TEXTS.meta.position(team.position)) : null,
    team.form.length ? h('div', { class: 'team-block__form' }, team.form.map(formBadge)) : null,
  );
}

function metaLine(match) {
  const parts = [
    match.tournament ? h('span', { class: 'match-hero__tournament' }, match.tournament) : null,
    match.round ? h('span', {}, TEXTS.meta.round(match.round)) : null,
    match.venue ? h('span', {}, match.venue) : null,
    match.referee ? h('span', {}, TEXTS.meta.referee(match.referee, match.refereeStats)) : null,
  ];
  return h('p', { class: 'match-hero__meta' }, parts);
}

function centerBlock(match, lambdas) {
  const parts = kickoffParts(match.kickoff);
  return h(
    'div',
    { class: 'match-hero__center' },
    h('span', { class: 'match-hero__time' }, parts?.time ?? TEXTS.meta.versus),
    parts ? h('span', { class: 'match-hero__date' }, parts.date) : null,
    h(
      'span',
      { class: 'match-hero__xg', title: TEXTS.meta.expectedGoalsTitle },
      `${decimal(lambdas.home)} – ${decimal(lambdas.away)}`,
    ),
  );
}

function statusBadges(match, context) {
  return h(
    'div',
    { class: 'match-hero__badges' },
    plainBadge(match.lineupsConfirmed ? TEXTS.sections.confirmed : TEXTS.sections.probable, match.lineupsConfirmed ? 'high' : 'medium'),
    context ? plainBadge(TEXTS.context.applied(context.confidence), 'accent') : null,
  );
}

/** @param {import('../../domain/analyzeMatch.js').MatchAnalysis} analysis */
export function renderMatchHeader(analysis) {
  const { match, lambdas, probabilities } = analysis;
  const names = { home: match.home.name, away: match.away.name };
  return h(
    'header',
    { class: 'match-hero' },
    metaLine(match),
    h('div', { class: 'match-hero__teams' }, teamBlock(match.home), centerBlock(match, lambdas.final), teamBlock(match.away)),
    resultBar(probabilities.result, names),
    statusBadges(match, analysis.context ?? null),
  );
}
