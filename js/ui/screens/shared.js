/**
 * Ayudas compartidas por las pantallas: nombres, mejor pick, fechas y piezas
 * pequeñas que se repiten (fila de pick, tarjeta de partido).
 */
import { ALERT_CODES } from '../../domain/alerts.js';
import { TIERS } from '../../domain/value.js';
import { TEXTS, marketLabel, pickTitle } from '../../texts.js';
import { badge, resultBar, resultLegend, signed, tierBadge } from '../components.js';
import { h } from '../dom.js';
import { decimal, kickoffParts, odds, signedPercent } from '../formatters.js';

/** @typedef {import('../../domain/analyzeMatch.js').MatchAnalysis} MatchAnalysis */

export function namesOf(match) {
  return { home: match.home.name, away: match.away.name };
}

/** @param {MatchAnalysis} analysis */
export function bestPick(analysis) {
  return analysis.picks.find((pick) => pick.tier !== TIERS.NONE) ?? null;
}

export function valuePicks(analysis) {
  return analysis.picks.filter((pick) => pick.tier !== TIERS.NONE);
}

/** Clave estable de un pick (combinadas y registro de apuestas). */
export function pickKey(match, pick) {
  return [match.id, pick.market.type, pick.market.line ?? '', pick.key].join('|');
}

/** Texto natural del pick ("Menos de 2.5 goles", "Ambos anotan: No"). */
export function pickName(pick, match) {
  return pickTitle(pick.market, pick.key, namesOf(match));
}

export function pickMarket(pick) {
  return marketLabel(pick.market);
}

export function needsReview(analysis) {
  return analysis.alerts.some((alert) => alert.code === ALERT_CODES.MARKET_DIVERGENCE);
}

/** "21/10/2026, 19:00:00" -> Date (local) o null. */
export function kickoffDate(text) {
  const match = String(text ?? '').match(/^(\d{1,2})\/(\d{1,2})\/(\d{4}),\s*(\d{1,2}):(\d{2})/);
  if (!match) return null;
  const [, day, month, year, hour, minute] = match.map(Number);
  return new Date(year, month - 1, day, hour, minute);
}

export function kickoffTime(match) {
  return kickoffParts(match.kickoff)?.time ?? null;
}

/** Título del día: "Miércoles 21/10" (o un rango si hay varios días). */
export function dayTitle(analyses) {
  const dates = analyses.map((analysis) => kickoffDate(analysis.match.kickoff)).filter(Boolean);
  if (!dates.length) return TEXTS.day.fallbackTitle;
  const days = [...new Set(dates.map((date) => date.toDateString()))].map((text) => new Date(text)).sort((a, b) => a - b);
  const short = (date) => kickoffParts(`${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}, 00:00`)?.date;
  if (days.length > 1) return `${short(days[0])} – ${short(days.at(-1))}`;
  return `${TEXTS.weekdays[days[0].getDay()]} ${short(days[0])}`;
}

/** "Liga MX · Apertura · J13" (torneos distintos se unen). */
export function tournamentLine(analyses) {
  const tournaments = [...new Set(analyses.map((analysis) => analysis.match.tournament).filter(Boolean))];
  const rounds = [...new Set(analyses.map((analysis) => analysis.match.round).filter(Boolean))];
  return [tournaments.join(', '), rounds.length === 1 ? TEXTS.meta.roundShort(rounds[0]) : null].filter(Boolean).join(' · ');
}

/** Badge de estado del partido (revisar con Claude, XI probable o confirmado). */
export function matchStatusBadge(analysis) {
  if (needsReview(analysis)) return badge(TEXTS.match.review, 'info');
  return analysis.match.lineupsConfirmed ? badge(TEXTS.sections.confirmed, 'win') : badge(TEXTS.sections.probable, 'warning');
}

/** Fila "MEDIA  Menos de 2.5 goles   @ 2.25  +4.4%". */
export function pickLine(analysis, pick = bestPick(analysis)) {
  if (!pick) return h('div', { class: 'match-card__pick' }, h('span', { class: 'match-card__pick-text muted' }, TEXTS.day.noPick));
  return h(
    'div',
    { class: 'match-card__pick' },
    tierBadge(pick.tier),
    h('span', { class: 'match-card__pick-text' }, pickName(pick, analysis.match)),
    h('span', { class: 'match-card__pick-odds' }, `@ ${odds(pick.odds)}`),
    h('span', { class: 'match-card__pick-ev' }, signed(pick.ev, signedPercent(pick.ev))),
  );
}

function teamWithPosition(team, side) {
  const position = team.position ? `${team.position}°` : null;
  return side === 'home'
    ? [position ? h('span', { class: 'faint' }, `${position} `) : null, team.name]
    : [team.name, position ? h('span', { class: 'faint' }, ` ${position}`) : null];
}

/**
 * Tarjeta de partido de la lista del día.
 * @param {MatchAnalysis} analysis
 * @param {{ onOpen: (id: string) => void, selected?: boolean, compact?: boolean }} options
 */
export function matchCard(analysis, { onOpen, selected = false, compact = false }) {
  const { match, probabilities, lambdas } = analysis;
  const names = namesOf(match);
  const time = kickoffTime(match) ?? '—';
  if (compact) {
    const { home, draw, away } = probabilities.result;
    const pct = (value) => Math.round(value * 100);
    return h(
      'button',
      { type: 'button', class: 'match-card match-card--compact', 'aria-current': selected ? 'true' : null, onClick: () => onOpen(match.id) },
      h(
        'span',
        { class: 'match-card__meta' },
        h('span', {}, time, needsReview(analysis) ? h('span', { class: 'tone-accent' }, ` · ${TEXTS.match.review}`) : null),
        h('span', {}, `${pct(home)} · ${pct(draw)} · ${pct(away)}`),
      ),
      h('span', { class: 'match-card__teams' }, match.title),
      pickLine(analysis),
    );
  }
  return h(
    'button',
    { type: 'button', class: 'match-card', 'aria-current': selected ? 'true' : null, onClick: () => onOpen(match.id) },
    h('span', { class: 'match-card__top' }, h('span', { class: 'match-card__time' }, time), matchStatusBadge(analysis)),
    h('span', { class: 'match-card__teams' }, teamWithPosition(match.home, 'home'), h('span', { class: 'faint' }, ' vs '), teamWithPosition(match.away, 'away')),
    resultBar(probabilities.result, names),
    resultLegend(probabilities.result, `xG ${decimal(lambdas.final.home)}–${decimal(lambdas.final.away)}`),
    pickLine(analysis),
  );
}
