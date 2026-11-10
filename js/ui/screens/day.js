/**
 * Resumen del día: indicadores, filtros por hora, tarjetas de partido y mejores picks.
 */
import { probableCandidates } from '../../domain/combos.js';
import { confidentForecasts } from '../../domain/history.js';
import { matchSignals } from '../../domain/signals.js';
import { STRATEGIES, evaluateStrategy, passes } from '../../domain/strategies.js';
import { probableConfig, probableMarketSelect } from './combo.js';
import { rankPicks } from '../../domain/ranking.js';
import { TIERS } from '../../domain/value.js';
import { TEXTS } from '../../texts.js';
import { button, chips, growingList, notice, pageHead, sectionLabel, segmented, signed, stats } from '../components.js';
import { h } from '../dom.js';
import { kickoffParts, odds, percent, signedPercent } from '../formatters.js';
import { bestPick, dayTitle, inLeague, kickoffDate, spansDays, kickoffTime, leagueSelect, matchCard, pickName, tournamentLine, valuePicks } from './shared.js';

/** Picks que aparecen en "Mejores picks del día". */
const BEST_PICKS_SHOWN = 5;

export const DAY_FILTERS = Object.freeze({ ALL: 'all', VALUE: 'value' });

/** Con más horarios distintos que esto, los filtros se agrupan por franja (mañana, tarde, noche). */
const MAX_TIME_CHIPS = 6;
/** Franjas del día: desde qué hora empieza cada una (hora local). */
const DAY_PARTS = [
  { id: 'morning', from: 0 },
  { id: 'afternoon', from: 12 },
  { id: 'night', from: 18 },
];

function dayPartOf(time) {
  const hour = Number(String(time).split(':')[0]);
  return [...DAY_PARTS].reverse().find((part) => hour >= part.from)?.id ?? null;
}

/** "30/10" de un partido (para filtrar por día cuando hay varios). */
const dayOf = (analysis) => kickoffParts(analysis.match.kickoff)?.date ?? null;

function filterItems(analyses) {
  const days = new Map();
  analyses.forEach((analysis) => {
    const day = dayOf(analysis);
    if (day) days.set(day, (days.get(day) ?? 0) + 1);
  });
  // Con partidos de varios días, un filtro por día (en el orden en que se juegan).
  const dayItems =
    days.size > 1
      ? [...days.keys()]
          .sort((a, b) => {
            const first = (day) => analyses.find((analysis) => dayOf(analysis) === day);
            return kickoffDate(first(a).match.kickoff) - kickoffDate(first(b).match.kickoff);
          })
          .map((day) => {
            const date = kickoffDate(analyses.find((analysis) => dayOf(analysis) === day).match.kickoff);
            return { id: `day:${day}`, label: `${TEXTS.weekdaysShort[date.getDay()]} ${day} · ${days.get(day)}` };
          })
      : [];
  const times = new Map();
  analyses.forEach((analysis) => {
    const time = kickoffTime(analysis.match);
    if (time) times.set(time, (times.get(time) ?? 0) + 1);
  });
  const parts = new Map();
  times.forEach((count, time) => parts.set(dayPartOf(time), (parts.get(dayPartOf(time)) ?? 0) + count));
  const exact = times.size > 1 && times.size <= MAX_TIME_CHIPS;
  const timeItems = exact
    ? [...times].sort().map(([time, count]) => ({ id: `time:${time}`, label: `${time} · ${count}` }))
    : parts.size > 1
      ? DAY_PARTS.filter((part) => parts.has(part.id)).map((part) => ({ id: `part:${part.id}`, label: `${TEXTS.day.parts[part.id]} · ${parts.get(part.id)}` }))
      : [];
  return [
    { id: DAY_FILTERS.ALL, label: `${TEXTS.day.all} · ${analyses.length}` },
    ...dayItems,
    ...timeItems,
    { id: DAY_FILTERS.VALUE, label: TEXTS.day.withValue },
  ];
}

function applyFilter(analyses, filter) {
  if (filter === DAY_FILTERS.VALUE) return analyses.filter((analysis) => bestPick(analysis));
  if (filter?.startsWith('time:')) return analyses.filter((analysis) => kickoffTime(analysis.match) === filter.slice(5));
  if (filter?.startsWith('day:')) return analyses.filter((analysis) => dayOf(analysis) === filter.slice(4));
  if (filter?.startsWith('part:')) return analyses.filter((analysis) => dayPartOf(kickoffTime(analysis.match)) === filter.slice(5));
  return analyses;
}

function indicators(analyses) {
  const strong = analyses.flatMap(valuePicks).filter((pick) => pick.tier === TIERS.HIGH || pick.tier === TIERS.MEDIUM).length;
  const unconfirmed = analyses.filter((analysis) => !analysis.match.lineupsConfirmed).length;
  return stats([
    { value: String(analyses.length), label: TEXTS.day.matches },
    { value: String(strong), label: TEXTS.day.strongPicks, tone: 'accent' },
    { value: String(unconfirmed), label: TEXTS.day.unconfirmed, tone: unconfirmed ? 'warning' : '' },
  ]);
}

export const DAY_PICK_MODES = Object.freeze({ VALUE: 'value', PROBABLE: 'probable' });

/** Lado derecho de cada fila: EV (por valor) o probabilidad (más probables). */
function rankSide(pick, mode) {
  if (mode === DAY_PICK_MODES.PROBABLE) {
    return [h('strong', { class: 'tone-accent' }, percent(pick.probability)), h('span', { class: 'muted' }, `@ ${odds(pick.odds)}`)];
  }
  return [h('strong', {}, signed(pick.ev, signedPercent(pick.ev))), h('span', { class: 'muted' }, `@ ${odds(pick.odds)}`)];
}

function rankDetail(analysis, pick, mode) {
  if (mode === DAY_PICK_MODES.PROBABLE) return `${analysis.match.title} · ${TEXTS.columns.ev} ${signedPercent(pick.ev)}`;
  return `${analysis.match.title} · ${percent(pick.probability)} ${TEXTS.day.versus} ${percent(pick.fairProbability)}`;
}

function bestPicksList(state, actions) {
  const { analyses, dayPicksMode: mode } = state;
  const ranked = (
    mode === DAY_PICK_MODES.PROBABLE
      ? probableCandidates(analyses, probableConfig(state.config, state.probableRules, state.probableMarket))
      : rankPicks(analyses, { market: 'all', minTier: TIERS.LOW, minOdds: 1 })
  ).slice(0, BEST_PICKS_SHOWN);
  const onOpenMatch = actions.openMatch;
  return [
    sectionLabel(TEXTS.day.bestPicks),
    segmented(
      [
        { id: DAY_PICK_MODES.VALUE, label: TEXTS.combos.modes.value },
        { id: DAY_PICK_MODES.PROBABLE, label: TEXTS.combos.modes.probable },
      ],
      mode,
      actions.setDayPicksMode,
      TEXTS.combos.modeLabel,
    ),
    mode === DAY_PICK_MODES.PROBABLE ? probableMarketSelect(state.config, state.probableMarket, actions.setProbableMarket) : null,
    ranked.length
      ? h(
      'ol',
      { class: 'rank-list' },
      ranked.map(({ analysis, pick }, index) =>
        h(
          'li',
          {},
          h(
            'button',
            { type: 'button', class: 'rank-item', onClick: () => onOpenMatch(analysis.match.id) },
            h('span', { class: 'rank-item__index' }, index + 1),
            h(
              'span',
              { class: 'rank-item__text' },
              h('span', { class: 'rank-item__title' }, pickName(pick, analysis.match)),
              h('span', { class: 'rank-item__sub' }, rankDetail(analysis, pick, mode)),
            ),
            h('span', { class: 'rank-item__side' }, rankSide(pick, mode)),
          ),
        ),
      ),
    )
      : h('p', { class: 'note' }, TEXTS.day.noPicksForMode),
  ];
}

/** Acceso a Estrategias (en el celular no está en la barra inferior), con cuántos partidos pasan alguna. */
function strategiesLink(analyses, config, onOpen) {
  const count = analyses.filter((analysis) => {
    const signals = matchSignals(analysis);
    return STRATEGIES.some((strategy) => passes(evaluateStrategy(strategy, analysis, signals, config.strategies?.[strategy.id])));
  }).length;
  return button({ label: TEXTS.strategies.dayLink(count), icon: 'check', variant: 'soft block', onClick: onOpen });
}

/** Pronósticos con confianza: lo más probable de ganador, ambos anotan y 2.5 con probabilidad alta. */
function confidentList(analyses, config, onOpenMatch) {
  const { confidentProbability, shown } = config.forecasts;
  const entries = confidentForecasts(analyses, confidentProbability);
  const row = ({ analysis, forecast }, index) =>
    h(
      'li',
      {},
      h(
        'button',
        { type: 'button', class: 'rank-item', onClick: () => onOpenMatch(analysis.match.id) },
        h('span', { class: 'rank-item__index' }, index + 1),
        h(
          'span',
          { class: 'rank-item__text' },
          h('span', { class: 'rank-item__title' }, pickName({ market: forecast.market, key: forecast.selection }, analysis.match)),
          h('span', { class: 'rank-item__sub' }, `${analysis.match.title} · ${TEXTS.history.forecasts.markets[forecast.id]}`),
        ),
        h(
          'span',
          { class: 'rank-item__side' },
          h('strong', { class: 'tone-accent' }, percent(forecast.probability)),
          h('span', { class: 'muted' }, forecast.odds ? `@ ${odds(forecast.odds)}` : TEXTS.day.fairOdds(odds(1 / forecast.probability))),
        ),
      ),
    );
  return [
    sectionLabel(TEXTS.day.confidentForecasts),
    entries.length
      ? growingList({ items: entries, render: row, first: shown, batch: shown * 2, tag: 'ol', className: 'rank-list', moreLabel: TEXTS.day.moreForecasts })
      : h('p', { class: 'note' }, TEXTS.day.noConfidentForecasts(percent(confidentProbability))),
    h('p', { class: 'note' }, TEXTS.day.confidentNote(percent(confidentProbability))),
  ];
}

/**
 * @param {Object} state
 * @param {{ openMatch: (id: string) => void, setDayFilter: (id: string) => void, openCombo: () => void }} actions
 */
export function renderDay(state, actions) {
  const { failures, dayFilter } = state;
  const analyses = inLeague(state.analyses, state.league);
  const shown = applyFilter(analyses, dayFilter);
  const showDate = spansDays(analyses);
  return [
    pageHead({ eyebrow: tournamentLine(analyses), title: dayTitle(analyses) }),
    failures.length ? h('div', { class: 'notices' }, failures.map((failure) => notice(TEXTS.errors.analysisFailed(failure.title, failure.message), 'error'))) : null,
    leagueSelect(state.analyses, state.league, actions.setLeague),
    indicators(analyses),
    strategiesLink(analyses, state.config, actions.openStrategies),
    // Primero el resumen (picks y pronósticos); la lista de partidos, que puede ser larga, al final.
    bestPicksList({ ...state, analyses }, actions),
    button({ label: TEXTS.day.buildCombo, icon: 'combo', variant: 'soft lg block', onClick: () => actions.openCombo(state.dayPicksMode) }),
    confidentList(analyses, state.config, actions.openMatch),
    sectionLabel(TEXTS.day.matchesLabel),
    analyses.length > 1 ? chips(filterItems(analyses), dayFilter, actions.setDayFilter, TEXTS.day.filters) : null,
    shown.length
      ? growingList({
          items: shown,
          render: (analysis) => matchCard(analysis, { onOpen: actions.openMatch, showDate }),
          first: state.config.display.dayMatchesShown,
          batch: state.config.display.dayMatchesShown,
          tag: 'div',
          className: 'grid',
          moreLabel: TEXTS.day.moreMatches,
        })
      : h('p', { class: 'note' }, TEXTS.day.noneForFilter),
  ];
}
