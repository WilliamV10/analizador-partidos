/**
 * Resumen del día: indicadores, filtros por hora, tarjetas de partido y mejores picks.
 */
import { probableCandidates } from '../../domain/combos.js';
import { probableConfig, probableMarketSelect } from './combo.js';
import { rankPicks } from '../../domain/ranking.js';
import { TIERS } from '../../domain/value.js';
import { TEXTS } from '../../texts.js';
import { button, chips, notice, pageHead, sectionLabel, segmented, signed, stats } from '../components.js';
import { h } from '../dom.js';
import { odds, percent, signedPercent } from '../formatters.js';
import { bestPick, dayTitle, kickoffTime, matchCard, pickName, tournamentLine, valuePicks } from './shared.js';

/** Picks que aparecen en "Mejores picks del día". */
const BEST_PICKS_SHOWN = 5;

export const DAY_FILTERS = Object.freeze({ ALL: 'all', VALUE: 'value' });

function filterItems(analyses) {
  const times = new Map();
  analyses.forEach((analysis) => {
    const time = kickoffTime(analysis.match);
    if (time) times.set(time, (times.get(time) ?? 0) + 1);
  });
  const timeItems = times.size > 1 ? [...times].sort().map(([time, count]) => ({ id: `time:${time}`, label: `${time} · ${count}` })) : [];
  return [
    { id: DAY_FILTERS.ALL, label: `${TEXTS.day.all} · ${analyses.length}` },
    ...timeItems,
    { id: DAY_FILTERS.VALUE, label: TEXTS.day.withValue },
  ];
}

function applyFilter(analyses, filter) {
  if (filter === DAY_FILTERS.VALUE) return analyses.filter((analysis) => bestPick(analysis));
  if (filter?.startsWith('time:')) return analyses.filter((analysis) => kickoffTime(analysis.match) === filter.slice(5));
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

/**
 * @param {Object} state
 * @param {{ openMatch: (id: string) => void, setDayFilter: (id: string) => void, openCombo: () => void }} actions
 */
export function renderDay(state, actions) {
  const { analyses, failures, dayFilter } = state;
  const shown = applyFilter(analyses, dayFilter);
  return [
    pageHead({ eyebrow: tournamentLine(analyses), title: dayTitle(analyses) }),
    failures.length ? h('div', { class: 'notices' }, failures.map((failure) => notice(TEXTS.errors.analysisFailed(failure.title, failure.message), 'error'))) : null,
    indicators(analyses),
    analyses.length > 1 ? chips(filterItems(analyses), dayFilter, actions.setDayFilter, TEXTS.day.filters) : null,
    sectionLabel(TEXTS.day.matchesLabel),
    shown.length
      ? h('div', { class: 'grid' }, shown.map((analysis) => matchCard(analysis, { onOpen: actions.openMatch })))
      : h('p', { class: 'note' }, TEXTS.day.noneForFilter),
    bestPicksList(state, actions),
    button({ label: TEXTS.day.buildCombo, icon: 'combo', variant: 'soft lg block', onClick: () => actions.openCombo(state.dayPicksMode) }),
  ];
}
