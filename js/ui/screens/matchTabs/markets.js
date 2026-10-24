/**
 * Pestaña Mercados: resultado, goles, quién anota, hándicap asiático, medio tiempo
 * y primer gol. Barras = mi probabilidad final; marca blanca = la casa sin margen.
 */
import { asianHandicapOutcome, marginDistribution } from '../../../domain/handicap.js';
import { expectedValue, winProbability } from '../../../domain/value.js';
import { TEXTS } from '../../../texts.js';
import { barRow, card, dataTable, note, signed, stats } from '../../components.js';
import { h } from '../../dom.js';
import { EMPTY, odds, percent, signedPercent } from '../../formatters.js';
import { namesOf } from '../shared.js';

/** @typedef {import('../../../domain/analyzeMatch.js').MatchAnalysis} MatchAnalysis */

const fairOdds = (probability) => (probability > 0 ? odds(1 / probability) : EMPTY);

function legend() {
  return h(
    'div',
    { class: 'legend' },
    h('span', { class: 'legend__item' }, h('span', { class: 'legend__swatch' }), TEXTS.markets.mine),
    h('span', { class: 'legend__item' }, h('span', { class: 'legend__marker' }), TEXTS.markets.fair),
  );
}

function quoteRow(analysis, { label, value, type, key, line = null, tone = '' }) {
  const quote = analysis.quotes.get(type, key, line);
  return barRow({ label, value, marker: quote?.fairProbability ?? null, odds: quote ? odds(quote.odds) : null, tone });
}

/** @param {MatchAnalysis} analysis */
function resultCard(analysis) {
  const names = namesOf(analysis.match);
  const { result, doubleChance } = analysis.probabilities;
  const rows = TEXTS.markets.resultRows(names);
  return card(
    { label: TEXTS.markets.result },
    h(
      'div',
      { class: 'bars' },
      quoteRow(analysis, { label: rows.home, value: result.home, type: 'result', key: 'home' }),
      quoteRow(analysis, { label: rows.draw, value: result.draw, type: 'result', key: 'draw' }),
      quoteRow(analysis, { label: rows.away, value: result.away, type: 'result', key: 'away' }),
      h('hr', { class: 'bars__divider' }),
      quoteRow(analysis, { label: rows.homeDraw, value: doubleChance.homeDraw, type: 'doubleChance', key: 'homeDraw' }),
      quoteRow(analysis, { label: rows.drawAway, value: doubleChance.drawAway, type: 'doubleChance', key: 'drawAway' }),
      quoteRow(analysis, { label: rows.homeAway, value: doubleChance.homeAway, type: 'doubleChance', key: 'homeAway' }),
    ),
  );
}

/** Modelo, real y final por línea (detalle plegable). */
function goalDetails(analysis) {
  const rows = Object.entries(analysis.binary.overs).map(([line, estimate]) => ({
    cells: [
      TEXTS.goalRows.over(line),
      h('strong', {}, percent(estimate.final)),
      percent(estimate.model),
      estimate.empirical === null ? EMPTY : `${percent(estimate.empirical)} (${Math.round(estimate.n)})`,
    ],
  }));
  return h(
    'details',
    { class: 'disclosure' },
    h('summary', { class: 'link' }, TEXTS.markets.modelVsReal),
    dataTable({
      head: [
        { label: '' },
        { label: TEXTS.columns.final, numeric: true },
        { label: TEXTS.columns.model, numeric: true },
        { label: TEXTS.columns.real, numeric: true },
      ],
      rows,
    }),
    note(TEXTS.sections.goalsNote),
  );
}

/** @param {MatchAnalysis} analysis */
function goalsCard(analysis) {
  return card(
    { label: TEXTS.markets.goals },
    h(
      'div',
      { class: 'bars' },
      Object.entries(analysis.binary.overs).map(([line, estimate]) =>
        quoteRow(analysis, { label: TEXTS.markets.over(line), value: estimate.final, type: 'total', key: 'over', line: Number(line) }),
      ),
    ),
    goalDetails(analysis),
  );
}

/** @param {MatchAnalysis} analysis */
function scorersCard(analysis) {
  const names = namesOf(analysis.match);
  const { btts, homeScores, awayScores } = analysis.binary;
  const bttsQuote = analysis.quotes.get('btts', 'yes');
  return card(
    { label: TEXTS.markets.whoScores },
    stats(
      [
        {
          value: percent(btts.final),
          label: TEXTS.goalRows.btts,
          hint: bttsQuote ? TEXTS.markets.fairAndOdds(percent(bttsQuote.fairProbability), odds(bttsQuote.odds)) : null,
          center: true,
        },
        { value: percent(homeScores.final), label: TEXTS.goalRows.homeScores(names), hint: TEXTS.markets.fairOdds(fairOdds(homeScores.final)), center: true },
        { value: percent(awayScores.final), label: TEXTS.goalRows.awayScores(names), hint: TEXTS.markets.fairOdds(fairOdds(awayScores.final)), center: true },
      ],
      3,
    ),
  );
}

function handicapSide(analysis, margins, market, side) {
  const names = namesOf(analysis.match);
  const quote = analysis.quotes.get('asianHandicap', side, market.line);
  const outcome = asianHandicapOutcome(margins, market.line, side);
  const line = side === 'home' ? market.line : -market.line;
  const ev = quote ? expectedValue(outcome, quote.odds) : null;
  return h(
    'div',
    { class: 'option' },
    h('span', { class: 'option__label' }, `${names[side]} ${line > 0 ? '+' : ''}${line}`),
    h('span', { class: 'option__value' }, percent(winProbability(outcome)), quote ? h('small', {}, `@ ${odds(quote.odds)}`) : null),
    quote
      ? h('span', { class: 'note' }, `${TEXTS.columns.fair.toLowerCase()} ${percent(quote.fairProbability)} · ${TEXTS.columns.ev} `, signed(ev, signedPercent(ev)))
      : null,
  );
}

function handicapTable(analysis, margins) {
  const names = namesOf(analysis.match);
  const marketLines = analysis.markets.filter((market) => market.type === 'asianHandicap').map((market) => market.line);
  const lines = [...new Set([...analysis.config.display.handicapLines, ...marketLines])].sort((a, b) => a - b);
  return dataTable({
    head: [
      { label: TEXTS.extra.handicapHead(names.home) },
      { label: names.home, numeric: true },
      { label: names.away, numeric: true },
    ],
    rows: lines.map((line) => ({
      cells: [
        TEXTS.extra.handicapLine(line),
        percent(winProbability(asianHandicapOutcome(margins, line, 'home'))),
        percent(winProbability(asianHandicapOutcome(margins, line, 'away'))),
      ],
    })),
  });
}

/** @param {MatchAnalysis} analysis */
function handicapCard(analysis) {
  const margins = marginDistribution(analysis.grid);
  const market = analysis.markets.find((candidate) => candidate.type === 'asianHandicap');
  return card(
    { label: TEXTS.extra.handicap },
    market ? h('div', { class: 'options' }, handicapSide(analysis, margins, market, 'home'), handicapSide(analysis, margins, market, 'away')) : null,
    h('details', { class: 'disclosure', open: market ? null : true }, h('summary', { class: 'link' }, TEXTS.markets.allLines), handicapTable(analysis, margins)),
    note(TEXTS.markets.handicapNote),
  );
}

/** @param {MatchAnalysis} analysis */
function halfTimeCard(analysis) {
  const names = namesOf(analysis.match);
  const { halfTime, probabilities, quotes } = analysis;
  const quoteCells = (quote) => [quote ? percent(quote.fairProbability) : EMPTY, quote ? odds(quote.odds) : EMPTY];
  const highlight = (value, quote) => h('strong', { class: quote && value > quote.fairProbability ? 'tone-accent' : null }, percent(value));
  const row = (label, value, quote) => ({ cells: [label, highlight(value, quote), ...quoteCells(quote)] });
  const rows = [
    ...['home', 'draw', 'away'].map((key) =>
      row(TEXTS.markets.halfTimeRows[key](names), halfTime.result[key], quotes.get('resultFirstHalf', key)),
    ),
    ...Object.entries(halfTime.overs).map(([line, value]) => row(TEXTS.markets.halfTimeOver(line), value, null)),
    ...['home', 'none', 'away'].map((key) => row(TEXTS.markets.firstGoalRows[key](names), probabilities.firstGoal[key], quotes.get('firstGoal', key))),
  ];
  return card(
    { label: TEXTS.markets.halfTimeAndFirstGoal },
    dataTable({
      head: [
        { label: TEXTS.markets.market },
        { label: TEXTS.columns.final, numeric: true },
        { label: TEXTS.columns.fair, numeric: true },
        { label: TEXTS.columns.odds, numeric: true },
      ],
      rows,
    }),
    note(TEXTS.extra.halfTimeNote(halfTime)),
  );
}

/** @param {MatchAnalysis} analysis */
export function renderMarketsTab(analysis) {
  return [
    legend(),
    h('div', { class: 'grid' }, resultCard(analysis), goalsCard(analysis), scorersCard(analysis), handicapCard(analysis), halfTimeCard(analysis)),
  ];
}
