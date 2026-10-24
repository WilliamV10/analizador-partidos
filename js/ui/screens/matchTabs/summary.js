/**
 * Pestaña Resumen: avisos, probabilidad final, goles esperados, marcadores,
 * mejor pick, claves del partido y contexto de Claude.
 */
import { TEXTS } from '../../../texts.js';
import { card, kvList, link, notice, probabilityTrio, resultBar, sectionLabel, signed, stats, tierBadge } from '../../components.js';
import { h } from '../../dom.js';
import { decimal, odds, percent, signedPercent } from '../../formatters.js';
import { bestPick, namesOf, pickMarket, pickName } from '../shared.js';

/** @typedef {import('../../../domain/analyzeMatch.js').MatchAnalysis} MatchAnalysis */

function alertNotices(alerts) {
  if (!alerts.length) return null;
  return h(
    'div',
    { class: 'notices' },
    alerts.map((alert) => notice(TEXTS.alerts[alert.code]?.(alert.params) ?? alert.code, alert.level === 'warning' ? 'warning' : 'info')),
  );
}

/** @param {MatchAnalysis} analysis */
function finalProbabilityCard(analysis) {
  const names = namesOf(analysis.match);
  const fair = analysis.lambdas.market?.targets;
  return card(
    { label: TEXTS.summary.finalProbability },
    probabilityTrio(analysis.probabilities.result, names),
    resultBar(analysis.probabilities.result, names),
    fair ? h('p', { class: 'note' }, TEXTS.summary.fairLine([fair.home, fair.draw, fair.away].map((value) => percent(value)))) : null,
  );
}

const pair = (lambdas) => (lambdas ? `${decimal(lambdas.home)} – ${decimal(lambdas.away)}` : '—');

/** @param {MatchAnalysis} analysis */
function expectedGoalsCard(analysis) {
  const { lambdas, match, config, absences } = analysis;
  const names = namesOf(match);
  const marketShare = lambdas.market ? config.lambda.marketWeight : 0;
  const absenceLines = [
    { team: names.home, impact: absences.home },
    { team: names.away, impact: absences.away },
  ]
    .filter(({ impact }) => impact.factor < 1)
    .map(({ team, impact }) => TEXTS.adjustments.absences(team, impact.factor, impact.missing.map((player) => player.name)));
  return card(
    { label: TEXTS.summary.expectedGoals },
    stats([
      { value: decimal(lambdas.final.home), label: names.home, center: true },
      { value: decimal(lambdas.final.away), label: names.away, center: true },
      { value: decimal(lambdas.final.home + lambdas.final.away), label: TEXTS.summary.total, center: true, tone: 'accent' },
    ]),
    kvList([
      [TEXTS.lambdaRows.stats, pair(lambdas.stats)],
      [TEXTS.lambdaRows.market, pair(lambdas.market)],
      analysis.context ? [TEXTS.lambdaRows.blended, pair(lambdas.blended)] : null,
      [TEXTS.summary.weight, TEXTS.summary.weightValue(marketShare)],
    ]),
    absenceLines.length ? h('ul', { class: 'bullets' }, absenceLines.map((line) => h('li', {}, line))) : null,
  );
}

/** @param {MatchAnalysis} analysis */
function topScores(analysis) {
  const scores = analysis.probabilities.topScores;
  return [
    sectionLabel(TEXTS.sections.topScores),
    h(
      'ol',
      { class: 'scores' },
      scores.map((score, index) =>
        h(
          'li',
          { class: `score${index === 0 ? ' score--top' : ''}` },
          h('span', { class: 'score__value' }, `${score.home}-${score.away}`),
          h('span', { class: 'score__probability' }, percent(score.probability)),
        ),
      ),
    ),
  ];
}

/** @param {MatchAnalysis} analysis */
function bestPickCard(analysis, actions) {
  const pick = bestPick(analysis);
  if (!pick) return card({ label: TEXTS.summary.bestPick }, h('p', { class: 'muted' }, TEXTS.sections.noValue));
  return card(
    { label: TEXTS.summary.bestPick, actions: tierBadge(pick.tier), variant: 'accent' },
    h('p', { class: 'note' }, pickMarket(pick)),
    h(
      'div',
      { class: 'pick-card__head' },
      h('h3', { class: 'pick-card__title display display--sm' }, pickName(pick, analysis.match)),
      h('span', { class: 'pick-card__odds' }, odds(pick.odds)),
    ),
    stats(
      [
        { value: percent(pick.probability), label: TEXTS.columns.mine, small: true },
        { value: percent(pick.fairProbability), label: TEXTS.columns.fair, small: true },
        { value: signed(pick.ev, signedPercent(pick.ev)), label: TEXTS.columns.ev, small: true },
      ],
      3,
    ),
    link({ label: TEXTS.summary.allPicks, onClick: () => actions.selectMatchTab('value') }),
  );
}

const record = (summary) => (summary ? `${summary.wins}G ${summary.draws}E ${summary.losses}P` : '—');

/** @param {MatchAnalysis} analysis */
function keysCard(analysis) {
  const { summaries, binary, match } = analysis;
  const names = namesOf(match);
  const awayRecent = summaries.away.recent;
  const btts = binary.btts;
  const rows = [
    { dot: 'home', label: TEXTS.summary.homeAtHome(names.home), value: record(summaries.home.venue) },
    awayRecent
      ? { dot: 'away', label: TEXTS.summary.awayScored(names.away), value: TEXTS.summary.countOf(awayRecent.n - awayRecent.failedToScore, awayRecent.n) }
      : null,
    { dot: '', label: TEXTS.summary.btts(btts), value: percent(btts.final) },
    { dot: '', label: TEXTS.goalRows.over(2.5), value: percent(binary.overs[2.5]?.final) },
  ].filter(Boolean);
  return card(
    { label: TEXTS.summary.keys },
    h(
      'ul',
      { class: 'dot-list' },
      rows.map((row) =>
        h(
          'li',
          { class: 'dot-list__item' },
          h('span', { class: `dot-list__dot${row.dot ? ` dot-list__dot--${row.dot}` : ''}` }),
          h('span', {}, row.label),
          h('span', { class: 'dot-list__value' }, row.value),
        ),
      ),
    ),
  );
}

/** @param {MatchAnalysis} analysis */
function contextCard(analysis) {
  const { context } = analysis;
  if (!context) return null;
  return card(
    { label: TEXTS.context.title, actions: context.confidence ? tierBadge(TEXTS.confidenceTier[context.confidence] ?? 'none') : null },
    context.notes.length ? h('ul', { class: 'bullets' }, context.notes.map((text) => h('li', {}, text))) : null,
    h('p', { class: 'note' }, TEXTS.context.adjustmentsSummary(context.adjustments, context)),
  );
}

/**
 * @param {MatchAnalysis} analysis
 * @param {Object} _state
 * @param {{ selectMatchTab: (id: string) => void }} actions
 */
export function renderSummaryTab(analysis, _state, actions) {
  return [
    alertNotices(analysis.alerts),
    h(
      'div',
      { class: 'grid' },
      finalProbabilityCard(analysis),
      expectedGoalsCard(analysis),
      h('div', { class: 'stack' }, topScores(analysis)),
      bestPickCard(analysis, actions),
      keysCard(analysis),
      contextCard(analysis),
    ),
  ];
}
