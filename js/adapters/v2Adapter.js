/**
 * Adaptador del JSON v2 (script de un solo partido): la raíz ES el partido.
 */
import { buildMatch, parseStandings } from './common.js';

/** @returns {import('../types.js').Match[]} */
export function adaptSingleMatch(root) {
  return [
    buildMatch(root, {
      source: `v${root.version ?? 2}`,
      standings: parseStandings(root.posiciones),
      fallbackId: `v2-${root.partido}`,
    }),
  ];
}
