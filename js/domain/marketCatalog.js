/**
 * Catálogo de mercados: traduce los nombres de Sofascore a tipos canónicos
 * con claves de selección estables (home, draw, away, over, under, yes, no...).
 *
 * Los mercados de 1X2 se etiquetan por posición porque versiones viejas del script
 * mandaban etiquetas mal puestas (ej. "1st half: X 7/4, X 15/8, 2 13/8").
 */
import { fairProbabilities } from './odds.js';

/**
 * @typedef {Object} CanonicalMarket
 * @property {string} type       result | doubleChance | drawNoBet | btts | total | firstGoal | resultFirstHalf
 *                               | asianHandicap | corners | cards | unsupported
 * @property {string} name       nombre original
 * @property {number|null} line  línea (totales, corners, tarjetas) o hándicap del local (asiático)
 * @property {number} fairTotal  suma de probabilidades justas del mercado (2 en doble oportunidad)
 * @property {{ key: string, label: string, odds: number }[]} selections
 */

const NUMBER = '([+-]?\\d+(?:\\.\\d+)?)';
const LINE_IN_LABEL = new RegExp(`\\(${NUMBER}\\)`);
const OVER_UNDER = { over: 'over', under: 'under' };

/**
 * Definiciones de mercados. `pattern` reconoce el nombre (y captura la línea si la hay).
 * Con `keys` las selecciones se etiquetan por posición; con `labels`, por su texto.
 */
const DEFINITIONS = [
  { type: 'result', pattern: /^Full time$/, keys: ['home', 'draw', 'away'] },
  { type: 'resultFirstHalf', pattern: /^1st half$/, keys: ['home', 'draw', 'away'] },
  { type: 'doubleChance', pattern: /^Double chance$/, keys: ['homeDraw', 'drawAway', 'homeAway'], fairTotal: 2 },
  { type: 'drawNoBet', pattern: /^Draw no bet$/, keys: ['home', 'away'] },
  { type: 'firstGoal', pattern: /^First team to score$/, keys: ['home', 'none', 'away'] },
  { type: 'asianHandicap', pattern: new RegExp(`^Asian handicap(?:\\s*\\(?${NUMBER}\\)?)?$`), keys: ['home', 'away'] },
  { type: 'btts', pattern: /^Both teams to score$/, labels: { yes: 'yes', no: 'no' } },
  { type: 'total', pattern: new RegExp(`^Match goals ${NUMBER}$`), labels: OVER_UNDER },
  { type: 'corners', pattern: new RegExp(`^Corners 2-Way ${NUMBER}$`), labels: OVER_UNDER },
  { type: 'cards', pattern: new RegExp(`^Cards in match ${NUMBER}$`), labels: OVER_UNDER },
];

function unsupported(market) {
  return { type: 'unsupported', name: market.name, line: null, fairTotal: 1, selections: [] };
}

/** Línea del nombre ("Match goals 2.5") o, en el hándicap, de la primera selección ("(-0.25) Atlas"). */
function lineOf(market, definition, nameMatch) {
  if (nameMatch[1] !== undefined) return Number(nameMatch[1]);
  if (definition.type !== 'asianHandicap') return null;
  const fromLabel = market.selections[0]?.label.match(LINE_IN_LABEL);
  return fromLabel ? Number(fromLabel[1]) : null;
}

function keySelections(market, definition) {
  if (definition.keys) {
    if (market.selections.length !== definition.keys.length) return null;
    return market.selections.map((selection, index) => ({ ...selection, key: definition.keys[index] }));
  }
  const selections = market.selections.map((selection) => ({
    ...selection,
    key: definition.labels[selection.label.toLowerCase()],
  }));
  return selections.every((selection) => selection.key) ? selections : null;
}

/**
 * @param {import('../types.js').RawMarket} market
 * @returns {CanonicalMarket}
 */
export function classifyMarket(market) {
  for (const definition of DEFINITIONS) {
    const nameMatch = market.name.match(definition.pattern);
    if (!nameMatch) continue;
    const selections = keySelections(market, definition);
    const line = lineOf(market, definition, nameMatch);
    if (!selections || (definition.type === 'asianHandicap' && line === null)) return unsupported(market);
    return { type: definition.type, name: market.name, line, fairTotal: definition.fairTotal ?? 1, selections };
  }
  return unsupported(market);
}

/** Grupo de cada tipo de mercado (para filtrar el ranking de picks). */
export const MARKET_GROUPS = Object.freeze({
  result: 'result',
  doubleChance: 'result',
  drawNoBet: 'result',
  total: 'goals',
  btts: 'btts',
  firstGoal: 'firstGoal',
  asianHandicap: 'handicap',
  resultFirstHalf: 'halfTime',
  corners: 'corners',
  cards: 'cards',
});

export function marketGroup(market) {
  return MARKET_GROUPS[market.type] ?? 'other';
}

export function findMarket(markets, type, line = null) {
  return markets.find((market) => market.type === type && (line === null || market.line === line)) ?? null;
}

/**
 * Índice de cotizaciones: (tipo, clave, línea) -> { odds, fairProbability }.
 * Útil para mostrar la cuota de la casa junto a cada probabilidad del modelo.
 * @param {CanonicalMarket[]} markets
 */
export function buildQuoteIndex(markets) {
  const index = new Map();
  markets
    .filter((market) => market.type !== 'unsupported')
    .forEach((market) => {
      const fair = fairProbabilities(market.selections.map((selection) => selection.odds), market.fairTotal);
      market.selections.forEach((selection, position) => {
        index.set(quoteKey(market.type, selection.key, market.line), {
          odds: selection.odds,
          fairProbability: fair[position],
        });
      });
    });
  return {
    get: (type, key, line = null) => index.get(quoteKey(type, key, line)) ?? null,
  };
}

function quoteKey(type, key, line) {
  return `${type}|${key}|${line ?? ''}`;
}

/** Mercado de goles cuya línea está más cerca de la indicada (por defecto 2.5). */
export function closestTotalMarket(markets, target = 2.5) {
  return markets
    .filter((market) => market.type === 'total')
    .sort((a, b) => Math.abs(a.line - target) - Math.abs(b.line - target))[0] ?? null;
}
