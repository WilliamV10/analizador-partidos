/**
 * Detecta qué script generó el JSON.
 *  - single: script de un partido (v2): la raíz tiene "partido", "local" y "visita".
 *  - multi:  script de varios partidos (v3/v4): la raíz tiene "partidos: [...]".
 */
import { IMPORT_ERRORS, ImportError } from './importError.js';

export const FORMAT_KINDS = Object.freeze({ SINGLE: 'single', MULTI: 'multi' });

export const CONTEXT_BLOCK_TYPE = 'contexto-claude';

export const RESULTS_BLOCK_TYPE = 'resultados-sofascore';
export const HISTORY_BACKUP_TYPE = 'historial-analizador';

const hasType = (root, type) => Boolean(root) && typeof root === 'object' && root.tipo === type;

/** El bloque que devuelve Claude también trae "partidos", pero se reconoce por su "tipo". */
export function isContextBlock(root) {
  return hasType(root, CONTEXT_BLOCK_TYPE);
}

/** JSON del script de resultados (también trae "partidos"). */
export function isResultsBlock(root) {
  return hasType(root, RESULTS_BLOCK_TYPE);
}

export function isHistoryBackup(root) {
  return hasType(root, HISTORY_BACKUP_TYPE);
}

/**
 * @param {unknown} root
 * @param {string} sourceName  nombre del archivo o "texto pegado" (para el mensaje de error)
 * @returns {{ kind: 'single'|'multi', version: number }}
 */
export function detectFormat(root, sourceName) {
  if (isContextBlock(root)) throw new ImportError(IMPORT_ERRORS.CONTEXT_IN_LOADER, { source: sourceName });
  if (isResultsBlock(root) || isHistoryBackup(root)) {
    throw new ImportError(IMPORT_ERRORS.HISTORY_IN_LOADER, { source: sourceName });
  }
  if (root && typeof root === 'object' && Array.isArray(root.partidos)) {
    return { kind: FORMAT_KINDS.MULTI, version: root.version ?? 3 };
  }
  if (root && typeof root === 'object' && typeof root.partido === 'string' && root.local && root.visita) {
    return { kind: FORMAT_KINDS.SINGLE, version: root.version ?? 2 };
  }
  throw new ImportError(IMPORT_ERRORS.UNKNOWN_FORMAT, { source: sourceName });
}
