/**
 * Resumen: indicadores clave, goles esperados (estadísticas / mercado / final)
 * y mapa de calor de marcadores.
 */
import { TIERS } from '../../domain/value.js';
import { TEXTS, marketLabel, selectionLabel } from '../../texts.js';
import { card, dataTable, kpi, note, plainBadge, subtitle } from '../components.js';
import { h } from '../dom.js';
import { EMPTY, decimal, odds, percent } from '../formatters.js';

/** Proporción del máximo a partir de la cual el texto de la celda va en blanco. */
const HOT_CELL = 0.55;
/** Por debajo de esta probabilidad la celda se deja sin número (sería "0%"). */
const MIN_SHOWN = 0.005;

function lambdaRow(label, lambdas, className) {
  if (!lambdas) return { cells: [label, EMPTY, EMPTY, EMPTY], className };
  return {
    cells: [label, decimal(lambdas.home), decimal(lambdas.away), decimal(lambdas.home + lambdas.away)],
    className,
  };
}

function bestPickKpi(analysis, names) {
  const pick = analysis.picks.find((candidate) => candidate.tier !== TIERS.NONE);
  if (!pick) return kpi(TEXTS.kpis.bestPick, EMPTY, TEXTS.tiers.none);
  return kpi(
    TEXTS.kpis.bestPick,
    `@ ${odds(pick.odds)}`,
    `${marketLabel(pick.market)}: ${selectionLabel(pick.market, pick.key, names)}`,
  );
}

function keyIndicators(analysis, names) {
  const { lambdas, binary } = analysis;
  const total = lambdas.final.home + lambdas.final.away;
  return h(
    'div',
    { class: 'kpis' },
    kpi(TEXTS.kpis.expectedGoals, decimal(total), `${decimal(lambdas.final.home)} – ${decimal(lambdas.final.away)}`),
    kpi(TEXTS.kpis.btts, percent(binary.btts.final), TEXTS.kpis.modelVsReal(binary.btts)),
    kpi(TEXTS.kpis.over25, percent(binary.overs[2.5]?.final), TEXTS.kpis.modelVsReal(binary.overs[2.5])),
    bestPickKpi(analysis, names),
  );
}

function scoreCell(probability, max, isTop) {
  const intensity = max > 0 ? probability / max : 0;
  const classes = ['score-grid__cell', intensity >= HOT_CELL ? 'is-hot' : '', isTop ? 'is-top' : ''].filter(Boolean);
  return h(
    'span',
    { class: classes.join(' '), style: `--p:${(intensity * 0.85).toFixed(3)}`, title: percent(probability, 1) },
    probability < MIN_SHOWN ? '' : percent(probability),
  );
}

/** Matriz local (filas) x visita (columnas) con color proporcional a la probabilidad. */
function scoreHeatmap(grid, size, names) {
  const rows = grid.cells.slice(0, size).map((row) => row.slice(0, size));
  const max = Math.max(...rows.flat());
  const axis = (value, side) => h('span', { class: `score-grid__axis score-grid__axis--${side}` }, value);
  return h(
    'div',
    {},
    h(
      'div',
      { class: 'score-grid', style: `--size:${size}`, role: 'img', 'aria-label': TEXTS.sections.scoreGrid },
      h('span', { class: 'score-grid__axis score-grid__corner' }, '↓ →'),
      rows[0].map((_, away) => axis(away, 'away')),
      rows.map((row, home) => [axis(home, 'home'), row.map((probability) => scoreCell(probability, max, probability === max))]),
    ),
    h(
      'div',
      { class: 'score-grid__legend' },
      h('span', {}, TEXTS.sections.scoreGridRows(names.home)),
      h('span', {}, TEXTS.sections.scoreGridColumns(names.away)),
    ),
  );
}

/** Bajas que restaron goles esperados al cálculo por estadísticas. */
function absenceAdjustments(analysis) {
  const sides = [
    { team: analysis.match.home.name, impact: analysis.absences.home },
    { team: analysis.match.away.name, impact: analysis.absences.away },
  ].filter(({ impact }) => impact.factor < 1);
  if (!sides.length) return null;
  return h(
    'ul',
    { class: 'plain-list' },
    sides.map(({ team, impact }) =>
      h('li', {}, '🩹 ', TEXTS.adjustments.absences(team, impact.factor, impact.missing.map((player) => player.name))),
    ),
  );
}

function contextCard(context) {
  if (!context) return null;
  const { homeAttack, awayAttack, homeDefence, awayDefence } = context.adjustments;
  return card(
    { title: TEXTS.context.title, icon: '🧠', actions: context.confidence ? plainBadge(context.confidence) : null },
    context.notes.length ? h('ul', { class: 'plain-list' }, context.notes.map((text) => h('li', {}, `• ${text}`))) : null,
    note(TEXTS.context.adjustmentsSummary({ homeAttack, awayAttack, homeDefence, awayDefence }, context)),
  );
}

function topScores(scores) {
  return h(
    'ul',
    { class: 'chips', 'aria-label': TEXTS.sections.topScores },
    scores.map((score) => h('li', { class: 'chip' }, h('strong', {}, `${score.home}-${score.away}`), ` ${percent(score.probability)}`)),
  );
}

/** @param {import('../../domain/analyzeMatch.js').MatchAnalysis} analysis */
export function renderOverview(analysis) {
  const { lambdas, probabilities, match, grid, config } = analysis;
  const names = { home: match.home.name, away: match.away.name };
  return h(
    'div',
    { class: 'stack' },
    keyIndicators(analysis, names),
    contextCard(analysis.context),
    h(
      'div',
      { class: 'two-columns' },
      card(
        { title: TEXTS.sections.overview, icon: '⚽' },
        dataTable({
          head: [
            { label: '' },
            { label: TEXTS.columns.home, numeric: true },
            { label: TEXTS.columns.away, numeric: true },
            { label: TEXTS.columns.total, numeric: true },
          ],
          rows: [
            lambdaRow(TEXTS.lambdaRows.stats, lambdas.stats),
            lambdaRow(TEXTS.lambdaRows.market, lambdas.market),
            analysis.context ? lambdaRow(TEXTS.lambdaRows.blended, lambdas.blended) : null,
            lambdaRow(TEXTS.lambdaRows.final, lambdas.final, 'row--highlight row--strong'),
          ].filter(Boolean),
        }),
        absenceAdjustments(analysis),
        note(TEXTS.sections.resultNote(config.lambda.marketWeight)),
        subtitle(TEXTS.sections.topScores),
        topScores(probabilities.topScores),
      ),
      card({ title: TEXTS.sections.scoreGrid, icon: '▦' }, scoreHeatmap(grid, config.display.scoreGridSize, names)),
    ),
  );
}
