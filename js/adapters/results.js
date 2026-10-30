/**
 * Resultado de un partido (del script de resultados o del bloque "resultado" del
 * script v5 en modo histórico) -> MatchResult para liquidar selecciones.
 */
import { classifyMarket } from '../domain/marketCatalog.js';
import { parseNumberPair } from '../domain/matchRows.js';
import { parseMarketLines } from '../domain/odds.js';

const FIRST_GOAL = new Set(['home', 'away', 'none']);

function toPair(text) {
  const pair = parseNumberPair(text);
  return pair ? { home: pair[0], away: pair[1] } : null;
}

/**
 * @param {Object} raw  { id, terminado, marcador, descanso, corners, amarillas, primerGol, cuotas }
 * @returns {import('../domain/settlement.js').MatchResult}
 */
export function toMatchResult(raw) {
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
