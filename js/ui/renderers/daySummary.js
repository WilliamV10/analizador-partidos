/**
 * Resumen del día: indicadores globales y una fila por partido (hora, 1X2, goles, mejor pick, alertas).
 */
import { TIERS } from '../../domain/value.js';
import { TEXTS, marketLabel, selectionLabel } from '../../texts.js';
import { card, dataTable, kpi, tierBadge } from '../components.js';
import { h } from '../dom.js';
import { EMPTY, decimal, kickoff, odds, percent, signedPercent } from '../formatters.js';
import { bestPick } from './matchList.js';

function namesOf(match) {
  return { home: match.home.name, away: match.away.name };
}

function dayIndicators(analyses) {
  const valuePicks = analyses.flatMap((analysis) => analysis.picks.filter((pick) => pick.tier !== TIERS.NONE));
  const high = valuePicks.filter((pick) => pick.tier === TIERS.HIGH).length;
  const best = valuePicks.reduce((top, pick) => (top === null || pick.ev > top.ev ? pick : top), null);
  const alerts = analyses.reduce((total, analysis) => total + analysis.alerts.length, 0);
  return h(
    'div',
    { class: 'kpis' },
    kpi(TEXTS.day.matches, String(analyses.length)),
    kpi(TEXTS.day.valuePicks, String(valuePicks.length), TEXTS.day.highPicks(high)),
    kpi(TEXTS.day.bestEv, best ? signedPercent(best.ev) : EMPTY, best ? `@ ${odds(best.odds)}` : null),
    kpi(TEXTS.day.alerts, String(alerts)),
  );
}

function pickCell(analysis) {
  const pick = bestPick(analysis);
  if (!pick) return h('span', { class: 'muted' }, TEXTS.tiers.none);
  return h(
    'div',
    { class: 'pick-cell' },
    h('span', { class: 'pick-cell__market' }, marketLabel(pick.market)),
    h('span', { class: 'pick-cell__selection' }, `${selectionLabel(pick.market, pick.key, namesOf(analysis.match))} @ ${odds(pick.odds)}`),
    tierBadge(pick.tier),
  );
}

function matchRow(analysis, onOpen) {
  const { match, probabilities, lambdas } = analysis;
  const { home, draw, away } = probabilities.result;
  return {
    cells: [
      h('span', { class: 'match-item__time' }, kickoff(match.kickoff)),
      h('button', { type: 'button', class: 'link-button', onClick: () => onOpen(match.id) }, match.title),
      `${percent(home)} · ${percent(draw)} · ${percent(away)}`,
      decimal(lambdas.final.home + lambdas.final.away),
      pickCell(analysis),
      analysis.alerts.length ? `⚠️ ${analysis.alerts.length}` : EMPTY,
    ],
  };
}

/**
 * @param {import('../../domain/analyzeMatch.js').MatchAnalysis[]} analyses
 * @param {(id: string) => void} onOpen
 */
export function renderDaySummary(analyses, onOpen) {
  return h(
    'div',
    { class: 'stack' },
    dayIndicators(analyses),
    card(
      { title: TEXTS.day.title, icon: '📅' },
      dataTable({
        head: [
          { label: TEXTS.columns.time },
          { label: TEXTS.columns.match },
          { label: TEXTS.columns.result, numeric: true },
          { label: TEXTS.columns.expectedGoals, numeric: true },
          { label: TEXTS.columns.bestPick },
          { label: TEXTS.columns.alerts, numeric: true },
        ],
        rows: analyses.map((analysis) => matchRow(analysis, onOpen)),
      }),
    ),
  );
}
