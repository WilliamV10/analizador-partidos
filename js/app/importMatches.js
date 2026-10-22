/**
 * Caso de uso: textos JSON -> partidos en el modelo interno.
 * Une lectura, detección de formato y adaptadores; no sabe nada del DOM.
 */
import { adaptSingleMatch } from '../adapters/v2Adapter.js';
import { adaptMultipleMatches } from '../adapters/v4Adapter.js';
import { FORMAT_KINDS, detectFormat } from '../io/formatDetector.js';
import { IMPORT_ERRORS, ImportError } from '../io/importError.js';
import { parseJsonText } from '../io/jsonParser.js';

export const IMPORT_MODES = Object.freeze({ AUTO: 'auto', SINGLE: 'single', MULTI: 'multi' });

const ADAPTERS = {
  [FORMAT_KINDS.SINGLE]: adaptSingleMatch,
  [FORMAT_KINDS.MULTI]: adaptMultipleMatches,
};

function adaptSource({ name, text }) {
  const root = parseJsonText(text, name);
  const format = detectFormat(root, name);
  return ADAPTERS[format.kind](root);
}

/** Si el mismo partido llega en dos archivos, se queda el último (datos más nuevos). */
function uniqueById(matches) {
  return [...new Map(matches.map((match) => [match.id, match])).values()];
}

/**
 * @param {{ name: string, text: string }[]} sources
 * @param {string} mode  uno de IMPORT_MODES
 * @returns {import('../types.js').Match[]}
 */
export function importMatches(sources, mode = IMPORT_MODES.AUTO) {
  const filled = sources.filter((source) => String(source.text ?? '').trim());
  if (!filled.length) throw new ImportError(IMPORT_ERRORS.EMPTY_INPUT, { source: '' });
  const matches = uniqueById(filled.flatMap(adaptSource));
  if (!matches.length) throw new ImportError(IMPORT_ERRORS.NO_MATCHES);
  if (mode === IMPORT_MODES.SINGLE && matches.length > 1) {
    throw new ImportError(IMPORT_ERRORS.EXPECTED_SINGLE, { count: matches.length });
  }
  return matches;
}
