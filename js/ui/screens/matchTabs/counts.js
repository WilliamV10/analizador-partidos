/**
 * Pestaña Corners y tarjetas: esperado por equipo, la línea de la casa (más/menos
 * con EV), cómo quedaron los partidos recientes contra esa línea y todas las líneas.
 */
import { TIERS } from '../../../domain/value.js';
import { TEXTS } from '../../../texts.js';
import { card, dataTable, note, signed, stats, tierBadge } from '../../components.js';
import { h } from '../../dom.js';
import { EMPTY, decimal, odds, percent, signedPercent } from '../../formatters.js';
import { namesOf } from '../shared.js';

/** @typedef {import('../../../domain/analyzeMatch.js').MatchAnalysis} MatchAnalysis */

/** Qué estadística modela cada mercado de la casa. */
const COUNT_KINDS = [
  { stat: 'corners', marketType: 'corners', texts: () => TEXTS.counts.corners },
  { stat: 'yellows', marketType: 'cards', texts: () => TEXTS.counts.cards },
];

const totalOf = (stat) => (row) => (row.stats[stat] ? row.stats[stat].for + row.stats[stat].against : null);

/** Línea de la casa más pareja para esa estadística (o la del modelo más cercana al esperado). */
function mainLine(analysis, kind, model) {
  const markets = analysis.markets.filter((market) => market.type === kind.marketType);
  const quoted = markets
    .map((market) => market.line)
    .sort((a, b) => Math.abs(a - model.expected.total) - Math.abs(b - model.expected.total));
  if (quoted.length) return quoted[0];
  const lines = Object.keys(model.total).map(Number);
  return lines.sort((a, b) => Math.abs(a - model.expected.total) - Math.abs(b - model.expected.total))[0];
}

function sideOption(analysis, kind, model, line, side) {
  const estimate = model.total[line];
  const probability = side === 'over' ? estimate.final : 1 - estimate.final;
  const pick = analysis.picks.find((candidate) => candidate.market.type === kind.marketType && candidate.market.line === line && candidate.key === side);
  const quote = analysis.quotes.get(kind.marketType, side, line);
  const label = `${side === 'over' ? TEXTS.counts.over : TEXTS.counts.under} ${line}${quote ? ` · ${odds(quote.odds)}` : ''}`;
  return h(
    'div',
    { class: `option${pick && pick.tier !== TIERS.NONE ? ' option--best' : ''}` },
    h('span', { class: 'option__label' }, label),
    h('span', { class: 'option__value' }, percent(probability), quote ? h('small', {}, `${TEXTS.day.versus} ${percent(quote.fairProbability)}`) : null),
    pick ? h('span', { class: 'option__ev' }, `${TEXTS.columns.ev} `, signed(pick.ev, signedPercent(pick.ev))) : null,
  );
}

/** Columnas: total de cada partido reciente del local contra la línea. */
function columnsChart(rows, stat, line) {
  const totals = rows.map(totalOf(stat)).filter((value) => value !== null);
  if (!totals.length) return null;
  const max = Math.max(line + 2, ...totals);
  return h(
    'div',
    { class: 'columns-chart', role: 'img', 'aria-label': TEXTS.counts.chartLabel(totals.filter((value) => value > line).length, totals.length, line) },
    totals.map((value) =>
      h('span', { class: `columns-chart__bar${value > line ? ' columns-chart__bar--over' : ''}`, style: `height:${((value / max) * 100).toFixed(1)}%`, title: String(value) }),
    ),
    h('span', { class: 'columns-chart__line', style: `bottom:${((line / max) * 100).toFixed(1)}%` }),
  );
}

function overCount(rows, stat, line) {
  const totals = rows.map(totalOf(stat)).filter((value) => value !== null);
  return totals.length ? `${totals.filter((value) => value > line).length}/${totals.length}` : EMPTY;
}

/** Todas las líneas: total, por equipo y (corners) primer tiempo. */
function allLines(analysis, kind, model) {
  const names = namesOf(analysis.match);
  const row = (label, estimate, quote = null) => ({
    cells: [
      label,
      h('strong', {}, percent(estimate.final)),
      quote ? percent(quote.fairProbability) : EMPTY,
      quote ? odds(quote.odds) : EMPTY,
      percent(estimate.model),
      estimate.empirical === null ? EMPTY : `${percent(estimate.empirical)} (${Math.round(estimate.n)})`,
    ],
  });
  const texts = kind.texts();
  const firstHalf = kind.stat === 'corners' ? analysis.counts.cornersFirstHalf : null;
  const rows = [
    ...Object.entries(model.total).map(([line, estimate]) => row(texts.overLine(line), estimate, analysis.quotes.get(kind.marketType, 'over', Number(line)))),
    ...Object.entries(model.home).map(([line, estimate]) => row(TEXTS.counts.teamOver(names.home, line), estimate)),
    ...Object.entries(model.away).map(([line, estimate]) => row(TEXTS.counts.teamOver(names.away, line), estimate)),
    ...(firstHalf ? Object.entries(firstHalf.total).map(([line, estimate]) => row(TEXTS.counts.firstHalfOver(line), estimate)) : []),
  ];
  return h(
    'details',
    { class: 'disclosure' },
    h('summary', { class: 'link' }, TEXTS.counts.allLines),
    dataTable({
      head: [
        { label: '' },
        { label: TEXTS.columns.final, numeric: true },
        { label: TEXTS.columns.fair, numeric: true },
        { label: TEXTS.columns.odds, numeric: true },
        { label: TEXTS.columns.model, numeric: true },
        { label: TEXTS.columns.real, numeric: true },
      ],
      rows,
    }),
    firstHalf ? note(TEXTS.counts.firstHalfExpected(decimal(firstHalf.expected.total, 1))) : null,
  );
}

function expectedCard(analysis, kind, model) {
  const names = namesOf(analysis.match);
  const texts = kind.texts();
  const { home, away, total } = model.expected;
  const homeRows = analysis.summaries.home.venueRows;
  return card(
    { label: texts.expected },
    stats(
      [
        { value: decimal(home, 1), label: names.home, tone: 'home' },
        { value: decimal(total, 1), label: TEXTS.summary.total, center: true },
        { value: decimal(away, 1), label: names.away, tone: 'away' },
      ],
      3,
    ),
    h(
      'div',
      { class: 'result-bar', 'aria-hidden': 'true' },
      h('span', { class: 'result-bar__segment result-bar__segment--home', style: `flex-grow:${home.toFixed(3)}` }),
      h('span', { class: 'result-bar__segment result-bar__segment--away', style: `flex-grow:${away.toFixed(3)}` }),
    ),
    note(texts.explain(model, homeRows.length)),
  );
}

function lineCard(analysis, kind, model) {
  const names = namesOf(analysis.match);
  const texts = kind.texts();
  const line = mainLine(analysis, kind, model);
  if (line === undefined || !model.total[line]) return null;
  const best = analysis.picks.find((pick) => pick.market.type === kind.marketType && pick.market.line === line && pick.tier !== TIERS.NONE);
  const homeRows = analysis.summaries.home.recent ? analysis.match.home.current : [];
  return card(
    { label: texts.lineTitle(line), actions: best ? tierBadge(best.tier) : null },
    h('div', { class: 'options' }, sideOption(analysis, kind, model, line, 'over'), sideOption(analysis, kind, model, line, 'under')),
    homeRows.length ? note(TEXTS.counts.chartCaption(names.home, overCount(homeRows, kind.stat, line), line)) : null,
    columnsChart(homeRows, kind.stat, line),
    stats(
      [
        { value: overCount(analysis.summaries.home.venueRows, kind.stat, line), label: names.home, small: true, center: true },
        { value: overCount(analysis.summaries.away.venueRows, kind.stat, line), label: names.away, small: true, center: true },
        { value: overCount(analysis.summaries.h2hRows, kind.stat, line), label: TEXTS.sections.h2h, small: true, center: true },
      ],
      3,
    ),
    kind.stat === 'yellows' ? note(refereeNote(analysis, model)) : null,
    allLines(analysis, kind, model),
  );
}

function refereeNote(analysis, model) {
  if (model.referee) return TEXTS.counts.refereeUsed(analysis.match.referee, decimal(model.referee.perGame, 1), model.referee.games, Math.round(model.referee.weight * 100));
  return TEXTS.counts.noReferee;
}

/** @param {MatchAnalysis} analysis */
export function renderCountsTab(analysis) {
  const sections = COUNT_KINDS.map((kind) => {
    const model = analysis.counts[kind.stat];
    if (!model) return card({ label: kind.texts().expected }, note(TEXTS.extra.noData));
    return h('div', { class: 'stack' }, expectedCard(analysis, kind, model), lineCard(analysis, kind, model));
  });
  return [h('div', { class: 'grid' }, sections), note(TEXTS.extra.countNote)];
}
