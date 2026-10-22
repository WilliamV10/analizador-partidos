/**
 * Adaptador del JSON v3/v4 (script de varios partidos):
 * { version, generado, filtros, posiciones: { [torneo]: string[] }, partidos: [...] }
 */
import { buildMatch, parseStandings } from './common.js';

function standingsFor(rawMatch, positions) {
  if (!positions || typeof positions !== 'object') return [];
  if (Array.isArray(positions)) return parseStandings(positions);
  const table = positions[rawMatch.tablaDe] ?? positions[rawMatch.torneo] ?? Object.values(positions)[0];
  return parseStandings(table);
}

/** @returns {import('../types.js').Match[]} */
export function adaptMultipleMatches(root) {
  const source = `v${root.version ?? 3}`;
  return root.partidos.map((rawMatch, index) =>
    buildMatch(rawMatch, {
      source,
      standings: standingsFor(rawMatch, root.posiciones),
      fallbackId: `${source}-${index}-${rawMatch.partido}`,
    }),
  );
}
