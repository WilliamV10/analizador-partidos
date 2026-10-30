/**
 * Caso de uso: analizar varios partidos sin que uno con datos raros tumbe a los demás.
 *
 * Cada análisis se recuerda por partido: si la configuración y el bloque de contexto del
 * partido son los mismos objetos de la vez anterior, se reutiliza. Así, activar o quitar
 * el contexto de un partido solo vuelve a analizar ese (con 75 partidos, todos tardan ~1 s).
 */
import { analyzeMatch } from '../domain/analyzeMatch.js';
import { findContext } from '../domain/context.js';

/** Último análisis de cada partido, con la configuración y el contexto que lo produjeron. */
const lastAnalysis = new WeakMap();

function cachedAnalysis(match, config, context) {
  const cached = lastAnalysis.get(match);
  if (cached && cached.config === config && cached.context === context) return cached.analysis;
  const analysis = analyzeMatch(match, config, context);
  lastAnalysis.set(match, { config, context, analysis });
  return analysis;
}

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
      analyses.push(cachedAnalysis(match, config, findContext(contexts, match)));
    } catch (error) {
      failures.push({ title: match.title, message: error.message });
    }
  });
  return { analyses, failures };
}
