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

/** Pasos de la búsqueda del factor de margen (bisección: de sobra para 10 decimales). */
const MARGIN_SEARCH_STEPS = 50;

/**
 * Probabilidades "justas": las implícitas sin el margen de la casa.
 *
 * Método de razón de cuotas: cada implícita q pasa a q / (c + q − c·q), con el mismo factor
 * c ≥ 1 para todas, elegido para que sumen `fairTotal`. A diferencia de repartir el margen en
 * proporción (lo que se hacía antes), le quita más a las cuotas largas, que es donde las casas
 * cargan más margen. En el historial (9.450 selecciones) acierta mejor: a las cuotas de 4 o más
 * les daba 10,9 % y ocurrieron 9,2 %; con este método, 9,4 %.
 * Si las cuotas no tienen margen (suman `fairTotal` o menos), se normalizan en proporción.
 * @param {number[]} oddsList
 * @param {number} [fairTotal=1]  suma esperada (2 en doble oportunidad: cada resultado cuenta dos veces)
 */
export function fairProbabilities(oddsList, fairTotal = 1) {
  const implied = oddsList.map((odds) => 1 / odds);
  const total = implied.reduce((acc, value) => acc + value, 0);
  if (!(total > fairTotal) || implied.some((value) => !(value > 0 && value < 1))) {
    return implied.map((value) => (value / total) * fairTotal);
  }
  const withFactor = (factor) => implied.map((value) => value / (factor + value - factor * value));
  let low = 1;
  let high = 2;
  const sum = (values) => values.reduce((acc, value) => acc + value, 0);
  while (sum(withFactor(high)) > fairTotal) high *= 2;
  for (let step = 0; step < MARGIN_SEARCH_STEPS; step += 1) {
    const middle = (low + high) / 2;
    if (sum(withFactor(middle)) > fairTotal) low = middle;
    else high = middle;
  }
  return withFactor((low + high) / 2);
}
