/**
 * Tablas de probabilidades: resultado (1X2, doble oportunidad) y goles (Over, ambos anotan, equipo anota).
 */
import { TEXTS } from '../../texts.js';
import { card, dataTable, note, probabilityCell } from '../components.js';
import { EMPTY, odds, percent } from '../formatters.js';

function namesOf(match) {
  return { home: match.home.name, away: match.away.name };
}

/** Columnas "Casa" (prob. sin margen) y "Cuota" de una cotización, o vacías. */
export function quoteCells(quote) {
  return [quote ? percent(quote.fairProbability) : EMPTY, quote ? odds(quote.odds) : EMPTY];
}

const RESULT_ROWS = [
  { group: 'result', key: 'home', type: 'result', variant: 'home' },
  { group: 'result', key: 'draw', type: 'result', variant: null },
  { group: 'result', key: 'away', type: 'result', variant: 'away' },
  { group: 'doubleChance', key: 'homeDraw', type: 'doubleChance', variant: 'home' },
  { group: 'doubleChance', key: 'drawAway', type: 'doubleChance', variant: 'away' },
  { group: 'doubleChance', key: 'homeAway', type: 'doubleChance', variant: null },
];

/** @param {import('../../domain/analyzeMatch.js').MatchAnalysis} analysis */
export function renderResultTable(analysis) {
  const names = namesOf(analysis.match);
  const rows = RESULT_ROWS.map(({ group, key, type, variant }) => ({
    className: group === 'doubleChance' ? 'row--separated' : null,
    cells: [
      TEXTS.resultRows[key](names),
      probabilityCell(analysis.probabilities[group][key], variant),
      ...quoteCells(analysis.quotes.get(type, key)),
      percent(analysis.statsProbabilities[group][key]),
    ],
  }));
  return card(
    { title: TEXTS.sections.result, icon: '🏁' },
    dataTable({
      head: [
        { label: '' },
        { label: TEXTS.columns.final, numeric: true },
        { label: TEXTS.columns.fair, numeric: true },
        { label: TEXTS.columns.odds, numeric: true },
        { label: TEXTS.columns.stats, numeric: true },
      ],
      rows,
    }),
    note(TEXTS.sections.resultNote(analysis.config.lambda.marketWeight)),
  );
}

/** Columnas: Final, Casa, Cuota, Modelo, Real (lo importante primero: cabe en el celular). */
export function estimateRow(label, estimate, quote, className = null) {
  const real = estimate.empirical === null ? EMPTY : `${percent(estimate.empirical)} (${Math.round(estimate.n)})`;
  return {
    className,
    cells: [label, probabilityCell(estimate.final), ...quoteCells(quote), percent(estimate.model), real],
  };
}

export const ESTIMATE_HEAD = [
  { label: '' },
  { label: TEXTS.columns.final, numeric: true },
  { label: TEXTS.columns.fair, numeric: true },
  { label: TEXTS.columns.odds, numeric: true },
  { label: TEXTS.columns.model, numeric: true },
  { label: TEXTS.columns.real, numeric: true },
];

function goalLineRows(analysis) {
  return Object.entries(analysis.binary.overs).map(([line, estimate]) =>
    estimateRow(TEXTS.goalRows.over(line), estimate, analysis.quotes.get('total', 'over', Number(line))),
  );
}

function scoringRows(analysis) {
  const names = namesOf(analysis.match);
  return [
    { label: TEXTS.goalRows.btts, estimate: analysis.binary.btts, quote: analysis.quotes.get('btts', 'yes') },
    { label: TEXTS.goalRows.homeScores(names), estimate: analysis.binary.homeScores, quote: null },
    { label: TEXTS.goalRows.awayScores(names), estimate: analysis.binary.awayScores, quote: null },
  ].map(({ label, estimate, quote }) => estimateRow(label, estimate, quote, 'row--separated'));
}

/** @param {import('../../domain/analyzeMatch.js').MatchAnalysis} analysis */
export function renderGoalsTable(analysis) {
  return card(
    { title: TEXTS.sections.goals, icon: '🥅' },
    dataTable({ head: ESTIMATE_HEAD, rows: [...goalLineRows(analysis), ...scoringRows(analysis)] }),
    note(TEXTS.sections.goalsNote),
  );
}
