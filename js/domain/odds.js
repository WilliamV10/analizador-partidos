/**
 * Lectura de cuotas del script de Sofascore y conversión a probabilidades.
 * Formato de entrada: "Full time: 1 5/2, X 13/5, 2 24/25"
 */

const FRACTION = /^(\d+(?:\.\d+)?)\/(\d+(?:\.\d+)?)$/;
const DECIMAL = /^\d+(?:\.\d+)?$/;
const EVENS = /^(evs|evens)$/i;

/** Convierte una cuota fraccional ("5/2"), decimal ("3.5") o "Evens" a decimal. */
export function toDecimalOdds(text) {
  const value = String(text ?? '').trim();
  const fraction = value.match(FRACTION);
  if (fraction) {
    const denominator = Number(fraction[2]);
    return denominator > 0 ? 1 + Number(fraction[1]) / denominator : null;
  }
  if (EVENS.test(value)) return 2;
  if (DECIMAL.test(value)) {
    const decimal = Number(value);
    return decimal > 1 ? decimal : null;
  }
  return null;
}

function parseSelection(part) {
  const lastSpace = part.lastIndexOf(' ');
  if (lastSpace < 0) return null;
  const odds = toDecimalOdds(part.slice(lastSpace + 1));
  if (odds === null) return null;
  return { label: part.slice(0, lastSpace).trim(), odds };
}

/**
 * @param {string} line
 * @returns {import('../types.js').RawMarket|null}
 */
export function parseMarketLine(line) {
  const separator = String(line).indexOf(': ');
  if (separator < 0) return null;
  const name = line.slice(0, separator).trim();
  const selections = line
    .slice(separator + 2)
    .split(', ')
    .map(parseSelection)
    .filter(Boolean);
  return selections.length ? { name, selections } : null;
}

/**
 * Lee todas las líneas de cuotas. Si un mercado aparece dos veces se queda la última
 * (en partidos en vivo Sofascore manda primero la cuota en vivo y después la previa).
 * @param {string[]} lines
 * @returns {{ markets: import('../types.js').RawMarket[], duplicates: string[] }}
 */
export function parseMarketLines(lines = []) {
  const byName = new Map();
  const duplicates = new Set();
  lines.forEach((line) => {
    const market = parseMarketLine(line);
    if (!market) return;
    if (byName.has(market.name)) duplicates.add(market.name);
    byName.set(market.name, market);
  });
  return { markets: [...byName.values()], duplicates: [...duplicates] };
}

/** Margen de la casa: suma de probabilidades implícitas menos 1. */
export function overround(oddsList) {
  return oddsList.reduce((total, odds) => total + 1 / odds, 0) - 1;
}

/**
 * Probabilidades "justas": implícitas normalizadas para quitar el margen (método proporcional).
 * @param {number[]} oddsList
 * @param {number} [fairTotal=1]  suma esperada (2 en doble oportunidad: cada resultado cuenta dos veces)
 */
export function fairProbabilities(oddsList, fairTotal = 1) {
  const implied = oddsList.map((odds) => 1 / odds);
  const total = implied.reduce((acc, value) => acc + value, 0);
  return implied.map((value) => (value / total) * fairTotal);
}
