/**
 * Lectura segura de texto JSON con mensajes útiles.
 */
import { IMPORT_ERRORS, ImportError } from './importError.js';

const CODE_FENCE = /^```[a-z]*\s*([\s\S]*?)\s*```$/i;

/**
 * Quita lo que suele colarse al copiar: comillas envolventes de
 * copy(JSON.stringify(...)), cercas de código markdown (```json) y espacios.
 */
function cleanPastedText(text) {
  const trimmed = String(text ?? '').trim();
  const fenced = trimmed.match(CODE_FENCE);
  if (fenced) return fenced[1];
  if (trimmed.startsWith("'") && trimmed.endsWith("'")) return trimmed.slice(1, -1);
  return trimmed;
}

/**
 * @param {string} text
 * @param {string} sourceName
 * @returns {unknown}
 */
export function parseJsonText(text, sourceName) {
  const cleaned = cleanPastedText(text);
  if (!cleaned) throw new ImportError(IMPORT_ERRORS.EMPTY_INPUT, { source: sourceName });
  try {
    return JSON.parse(cleaned);
  } catch (error) {
    throw new ImportError(IMPORT_ERRORS.INVALID_JSON, { source: sourceName, detail: error.message });
  }
}
