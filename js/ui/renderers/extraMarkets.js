/**
 * Mercados de la fase 3: primer tiempo, hándicap asiático, corners y tarjetas.
 */
import { asianHandicapOutcome, marginDistribution } from '../../domain/handicap.js';
import { winProbability } from '../../domain/value.js';
import { TEXTS } from '../../texts.js';
import { card, dataTable, note, probabilityCell, subtitle } from '../components.js';
import { h } from '../dom.js';
import { EMPTY, decimal, odds } from '../formatters.js';
import { ESTIMATE_HEAD, estimateRow, quoteCells } from './probabilityTables.js';

function namesOf(match) {
  return { home: match.home.name, away: match.away.name };
}

/* ---------- Primer tiempo ---------- */

/** @param {import('../../domain/analyzeMatch.js').MatchAnalysis} analysis */
export function renderHalfTimeTable(analysis) {
  const { halfTime, quotes } = analysis;
  const names = namesOf(analysis.match);
  const resultRows = ['home', 'draw', 'away'].map((key) => ({
    cells: [
      TEXTS.resultRows[key](names),
      probabilityCell(halfTime.result[key], key === 'draw' ? null : key),
      ...quoteCells(quotes.get('resultFirstHalf', key)),
    ],
  }));
  const goalRows = Object.entries(halfTime.overs).map(([line, probability]) => ({
    className: 'row--separated',
    cells: [TEXTS.goalRows.over(line), probabilityCell(probability), EMPTY, EMPTY],
  }));
  return card(
    { title: TEXTS.extra.halfTime, icon: '⏱️' },
    dataTable({
      head: [
        { label: '' },
        { label: TEXTS.columns.final, numeric: true },
        { label: TEXTS.columns.fair, numeric: true },
        { label: TEXTS.columns.odds, numeric: true },
      ],
      rows: [...resultRows, ...goalRows],
    }),
    note(TEXTS.extra.halfTimeNote(halfTime)),
  );
}

/* ---------- Hándicap asiático ---------- */

function handicapLines(analysis) {
  const marketLines = analysis.markets.filter((market) => market.type === 'asianHandicap').map((market) => market.line);
  return [...new Set([...analysis.config.display.handicapLines, ...marketLines])].sort((a, b) => a - b);
}

function handicapRow(analysis, margins, line) {
  const homeQuote = analysis.quotes.get('asianHandicap', 'home', line);
  const awayQuote = analysis.quotes.get('asianHandicap', 'away', line);
  const homeProbability = winProbability(asianHandicapOutcome(margins, line, 'home'));
  const awayProbability = winProbability(asianHandicapOutcome(margins, line, 'away'));
  return {
    className: homeQuote ? 'row--highlight' : null,
    cells: [
      TEXTS.extra.handicapLine(line),
      probabilityCell(homeProbability, 'home'),
      homeQuote ? odds(homeQuote.odds) : EMPTY,
      probabilityCell(awayProbability, 'away'),
      awayQuote ? odds(awayQuote.odds) : EMPTY,
    ],
  };
}

/** @param {import('../../domain/analyzeMatch.js').MatchAnalysis} analysis */
export function renderHandicapTable(analysis) {
  const names = namesOf(analysis.match);
  const margins = marginDistribution(analysis.grid);
  return card(
    { title: TEXTS.extra.handicap, icon: '⚖️' },
    dataTable({
      head: [
        { label: TEXTS.extra.handicapHead(names.home) },
        { label: names.home, numeric: true },
        { label: TEXTS.columns.odds, numeric: true },
        { label: names.away, numeric: true },
        { label: TEXTS.columns.odds, numeric: true },
      ],
      rows: handicapLines(analysis).map((line) => handicapRow(analysis, margins, line)),
    }),
    note(TEXTS.extra.handicapNote),
  );
}

/* ---------- Corners y tarjetas ---------- */

function lineRows(estimates, label, quoteFor = () => null) {
  return Object.entries(estimates).map(([line, estimate]) => estimateRow(label(line), estimate, quoteFor(Number(line))));
}

function expectedLine(model, names) {
  return h(
    'p',
    { class: 'note' },
    TEXTS.extra.expected(decimal(model.expected.total, 1), names, decimal(model.expected.home, 1), decimal(model.expected.away, 1)),
  );
}

/** Tabla por equipo (local y visita) para las líneas individuales. */
function teamLinesTable(model, names, labelFor) {
  return dataTable({
    head: ESTIMATE_HEAD,
    rows: [
      ...lineRows(model.home, (line) => labelFor(names.home, line)),
      ...lineRows(model.away, (line) => labelFor(names.away, line)).map((row) => ({ ...row, className: 'row--separated' })),
    ],
  });
}

/** @param {import('../../domain/analyzeMatch.js').MatchAnalysis} analysis */
export function renderCornersCard(analysis) {
  const { corners, cornersFirstHalf } = analysis.counts;
  const names = namesOf(analysis.match);
  if (!corners) return card({ title: TEXTS.extra.corners, icon: '🚩' }, note(TEXTS.extra.noData));
  return card(
    { title: TEXTS.extra.corners, icon: '🚩' },
    expectedLine(corners, names),
    dataTable({
      head: ESTIMATE_HEAD,
      rows: lineRows(corners.total, TEXTS.extra.overCorners, (line) => analysis.quotes.get('corners', 'over', line)),
    }),
    subtitle(TEXTS.extra.teamCorners),
    teamLinesTable(corners, names, TEXTS.extra.teamOverCorners),
    cornersFirstHalf
      ? [
          subtitle(TEXTS.extra.firstHalfCorners),
          expectedLine(cornersFirstHalf, names),
          dataTable({ head: ESTIMATE_HEAD, rows: lineRows(cornersFirstHalf.total, TEXTS.extra.overCorners) }),
          teamLinesTable(cornersFirstHalf, names, TEXTS.extra.teamOverCorners),
        ]
      : null,
    note(TEXTS.extra.countNote),
  );
}

/** @param {import('../../domain/analyzeMatch.js').MatchAnalysis} analysis */
export function renderCardsCard(analysis) {
  const { yellows } = analysis.counts;
  const names = namesOf(analysis.match);
  if (!yellows) return card({ title: TEXTS.extra.cards, icon: '🟨' }, note(TEXTS.extra.noData));
  return card(
    { title: TEXTS.extra.cards, icon: '🟨' },
    expectedLine(yellows, names),
    dataTable({
      head: ESTIMATE_HEAD,
      rows: lineRows(yellows.total, TEXTS.extra.overCards, (line) => analysis.quotes.get('cards', 'over', line)),
    }),
    subtitle(TEXTS.extra.teamCards),
    teamLinesTable(yellows, names, TEXTS.extra.teamOverCards),
    note(TEXTS.extra.cardsNote),
  );
}
