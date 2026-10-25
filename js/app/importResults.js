/**
 * Casos de uso: leer el JSON del script de resultados y los respaldos del historial.
 */
import { classifyMarket } from '../domain/marketCatalog.js';
import { parseNumberPair } from '../domain/matchRows.js';
import { parseMarketLines } from '../domain/odds.js';
import { HISTORY_BACKUP_TYPE, isHistoryBackup, isResultsBlock } from '../io/formatDetector.js';
import { IMPORT_ERRORS, ImportError } from '../io/importError.js';
import { parseJsonText } from '../io/jsonParser.js';

const FIRST_GOAL = new Set(['home', 'away', 'none']);

function toPair(text) {
  const pair = parseNumberPair(text);
  return pair ? { home: pair[0], away: pair[1] } : null;
}

/** @returns {import('../domain/settlement.js').MatchResult} */
function normalizeResult(raw) {
  return {
    id: String(raw?.id ?? ''),
    finished: raw?.terminado === true,
    score: toPair(raw?.marcador),
    halfTime: toPair(raw?.descanso),
    corners: toPair(raw?.corners),
    yellows: toPair(raw?.amarillas),
    firstGoal: FIRST_GOAL.has(raw?.primerGol) ? raw.primerGol : null,
    markets: parseMarketLines(Array.isArray(raw?.cuotas) ? raw.cuotas : []).markets.map(classifyMarket),
  };
}

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
  return root.partidos.map(normalizeResult).filter((result) => result.id);
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
