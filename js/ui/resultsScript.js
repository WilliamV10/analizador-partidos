/**
 * Arma el texto del script de resultados con los ids pendientes ya incluidos.
 * Va dentro de un bloque { } para poder pegarlo varias veces sin recargar.
 */
import { RESULTS_BLOCK_TYPE } from '../io/formatDetector.js';
import { sofascoreResultsScript } from './resultsScriptSource.js';

/** @param {string[]} matchIds */
export function buildResultsScript(matchIds) {
  const ids = JSON.stringify(matchIds.map((id) => (/^\d+$/.test(id) ? Number(id) : id)));
  return [
    '// Analizador de partidos: resultados de Sofascore. Pégalo en la consola (F12) de sofascore.com.',
    '{',
    `(${sofascoreResultsScript.toString()})(${ids}, ${JSON.stringify(RESULTS_BLOCK_TYPE)});`,
    '}',
  ].join('\n');
}
