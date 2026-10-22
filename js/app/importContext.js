/**
 * Caso de uso: texto del bloque "contexto-claude" -> MatchContext[].
 * Valida y normaliza; los campos raros o ausentes quedan en 0 / vacíos.
 */
import { isContextBlock } from '../io/formatDetector.js';
import { IMPORT_ERRORS, ImportError } from '../io/importError.js';
import { parseJsonText } from '../io/jsonParser.js';

const toNumber = (value) => (Number.isFinite(Number(value)) ? Number(value) : 0);

/** @returns {import('../domain/context.js').MatchContext} */
function normalizeEntry(raw) {
  const adjustments = raw?.ajustes ?? {};
  return {
    id: raw?.id === undefined || raw?.id === null ? null : String(raw.id),
    title: typeof raw?.partido === 'string' ? raw.partido : null,
    adjustments: {
      homeAttack: toNumber(adjustments.ataqueLocal),
      awayAttack: toNumber(adjustments.ataqueVisita),
      homeDefence: toNumber(adjustments.defensaLocal),
      awayDefence: toNumber(adjustments.defensaVisita),
    },
    cardsExtra: toNumber(raw?.tarjetasExtra),
    cornersExtra: toNumber(raw?.cornersExtra),
    notes: Array.isArray(raw?.notas) ? raw.notas.map(String) : [],
    confidence: typeof raw?.confianza === 'string' ? raw.confianza : null,
  };
}

/**
 * @param {string} text
 * @param {string} sourceName
 * @returns {import('../domain/context.js').MatchContext[]}
 */
export function importContext(text, sourceName) {
  const root = parseJsonText(text, sourceName);
  if (!isContextBlock(root) || !Array.isArray(root.partidos)) {
    throw new ImportError(IMPORT_ERRORS.NOT_CONTEXT, { source: sourceName });
  }
  return root.partidos.map(normalizeEntry).filter((entry) => entry.id !== null || entry.title !== null);
}
