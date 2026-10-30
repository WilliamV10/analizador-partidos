/**
 * Casos de uso: leer el JSON del script de resultados y los respaldos del historial.
 */
import { toMatchResult } from '../adapters/results.js';
import { HISTORY_BACKUP_TYPE, isHistoryBackup, isResultsBlock } from '../io/formatDetector.js';
import { IMPORT_ERRORS, ImportError } from '../io/importError.js';
import { parseJsonText } from '../io/jsonParser.js';

/**
 * @param {string} text
 * @param {string} sourceName
 * @returns {import('../domain/settlement.js').MatchResult[]}
 */
export function importResults(text, sourceName) {
  const root = parseJsonText(text, sourceName);
  if (!isResultsBlock(root) || !Array.isArray(root.partidos)) {
    throw new ImportError(IMPORT_ERRORS.NOT_RESULTS, { source: sourceName });
  }
  return root.partidos.map(toMatchResult).filter((result) => result.id);
}

const BACKUP_VERSION = 1;

/** Respaldo del historial listo para guardar como archivo. */
export function exportBackup(records, now) {
  return JSON.stringify({ tipo: HISTORY_BACKUP_TYPE, version: BACKUP_VERSION, exportado: new Date(now).toISOString(), registros: records });
}

const isRecord = (record) =>
  record &&
  typeof record.key === 'string' &&
  typeof record.matchId === 'string' &&
  record.market &&
  (typeof record.odds === 'number' || record.odds === null);

/**
 * @param {string} text
 * @param {string} sourceName
 * @returns {import('../domain/history.js').HistoryRecord[]}
 */
export function importBackup(text, sourceName) {
  const root = parseJsonText(text, sourceName);
  if (!isHistoryBackup(root) || !Array.isArray(root.registros)) {
    throw new ImportError(IMPORT_ERRORS.NOT_BACKUP, { source: sourceName });
  }
  return root.registros.filter(isRecord);
}
