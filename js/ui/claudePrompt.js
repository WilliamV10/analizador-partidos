/**
 * Texto compacto para pedirle contexto a Claude ("Copiar para Claude").
 * Resume cada partido y explica el formato exacto del bloque que debe devolver.
 */
import { TIERS } from '../domain/value.js';
import { CONTEXT_BLOCK_TYPE } from '../io/formatDetector.js';
import { TEXTS, marketLabel, selectionLabel } from '../texts.js';
import { decimal, kickoff, odds, percent } from './formatters.js';

const PROMPT = TEXTS.claudePrompt;

function pair(lambdas) {
  return lambdas ? `${decimal(lambdas.home)}-${decimal(lambdas.away)}` : '—';
}

function absencesLine(team) {
  const absences = team.lineup?.absences ?? [];
  if (!absences.length) return `${team.name}: ${PROMPT.none}`;
  return `${team.name}: ${absences.map((absence) => `${absence.name} (${TEXTS.absenceStatus[absence.status] ?? absence.reason ?? '?'})`).join(', ')}`;
}

function bestPickLine(analysis) {
  const pick = analysis.picks.find((candidate) => candidate.tier !== TIERS.NONE);
  if (!pick) return PROMPT.none;
  const names = { home: analysis.match.home.name, away: analysis.match.away.name };
  return `${marketLabel(pick.market)}: ${selectionLabel(pick.market, pick.key, names)} @ ${odds(pick.odds)} (${TEXTS.tiers[pick.tier]})`;
}

function alertsLine(analysis) {
  if (!analysis.alerts.length) return PROMPT.none;
  return analysis.alerts.map((alert) => TEXTS.alerts[alert.code]?.(alert.params) ?? alert.code).join(' | ');
}

function matchBlock(analysis) {
  const { match, lambdas, probabilities, statsProbabilities, binary } = analysis;
  const fair = lambdas.market?.targets;
  const result = (values) => `${percent(values.home)}/${percent(values.draw)}/${percent(values.away)}`;
  return [
    `### ${match.title} [id ${match.id}]`,
    `${match.tournament ?? ''} · ${kickoff(match.kickoff)} · ${match.lineupsConfirmed ? PROMPT.confirmed : PROMPT.probable}`,
    `${PROMPT.lambdas}: ${PROMPT.stats} ${pair(lambdas.stats)} | ${PROMPT.market} ${pair(lambdas.market)} | ${PROMPT.final} ${pair(lambdas.final)}`,
    `1X2 ${PROMPT.stats} ${result(statsProbabilities.result)} · ${PROMPT.final} ${result(probabilities.result)}${fair ? ` · ${PROMPT.bookmaker} ${result(fair)}` : ''}`,
    `${PROMPT.over25} ${percent(binary.overs[2.5]?.final)} · ${PROMPT.btts} ${percent(binary.btts.final)}`,
    `${PROMPT.absences}: ${absencesLine(match.home)}; ${absencesLine(match.away)}`,
    `${PROMPT.alerts}: ${alertsLine(analysis)}`,
    `${PROMPT.bestPick}: ${bestPickLine(analysis)}`,
  ].join('\n');
}

function exampleBlock(analyses) {
  const example = {
    tipo: CONTEXT_BLOCK_TYPE,
    version: 1,
    partidos: analyses.map((analysis) => ({
      id: Number(analysis.match.id) || analysis.match.id,
      partido: analysis.match.title,
      ajustes: { ataqueLocal: 0, ataqueVisita: 0, defensaLocal: 0, defensaVisita: 0 },
      tarjetasExtra: 0,
      cornersExtra: 0,
      notas: [],
      confianza: 'media',
    })),
  };
  return JSON.stringify(example, null, 2);
}

/**
 * @param {import('../domain/analyzeMatch.js').MatchAnalysis[]} analyses
 * @returns {string}
 */
export function buildClaudePrompt(analyses) {
  return [PROMPT.intro, ...analyses.map(matchBlock), PROMPT.rules, '```json', exampleBlock(analyses), '```'].join('\n\n');
}
