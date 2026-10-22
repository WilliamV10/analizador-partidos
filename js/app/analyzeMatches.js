/**
 * Caso de uso: analizar varios partidos sin que uno con datos raros tumbe a los demás.
 */
import { analyzeMatch } from '../domain/analyzeMatch.js';
import { findContext } from '../domain/context.js';

/**
 * @param {import('../types.js').Match[]} matches
 * @param {typeof import('../config.js').CONFIG} config
 * @param {import('../domain/context.js').MatchContext[]} [contexts]  bloque de Claude (opcional)
 * @returns {{ analyses: import('../domain/analyzeMatch.js').MatchAnalysis[], failures: { title: string, message: string }[] }}
 */
export function analyzeMatches(matches, config, contexts = []) {
  const analyses = [];
  const failures = [];
  matches.forEach((match) => {
    try {
      analyses.push(analyzeMatch(match, config, findContext(contexts, match)));
    } catch (error) {
      failures.push({ title: match.title, message: error.message });
    }
  });
  return { analyses, failures };
}
