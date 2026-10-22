/**
 * Error de importación con código estable; la interfaz traduce el código a texto.
 */
export const IMPORT_ERRORS = Object.freeze({
  EMPTY_INPUT: 'emptyInput',
  INVALID_JSON: 'invalidJson',
  UNKNOWN_FORMAT: 'unknownFormat',
  NO_MATCHES: 'noMatches',
  EXPECTED_SINGLE: 'expectedSingle',
  CONTEXT_IN_LOADER: 'contextInLoader',
  NOT_CONTEXT: 'notContext',
  HISTORY_IN_LOADER: 'historyInLoader',
  NOT_RESULTS: 'notResults',
  NOT_BACKUP: 'notBackup',
});

export class ImportError extends Error {
  /**
   * @param {string} code    uno de IMPORT_ERRORS
   * @param {Object} params  datos para el mensaje
   */
  constructor(code, params = {}) {
    super(code);
    this.name = 'ImportError';
    this.code = code;
    this.params = params;
  }
}
