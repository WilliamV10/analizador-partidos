/**
 * Probabilidad de ganar / devolver / perder de cada selección de un mercado canónico.
 *
 * Un "modelo de precios" es:
 *  - probabilities: salida de outcomeProbabilities (Poisson)
 *  - binary: estimaciones mezcladas con lo empírico (o null para usar solo Poisson)
 *  - margins: distribución de la diferencia de goles (hándicap asiático)
 *  - halfTime: modelo del primer tiempo
 *  - counts: modelos de corners y tarjetas (o null)
 */
import { asianHandicapOutcome } from './handicap.js';
import { overOutcome } from './probabilities.js';

/** @typedef {import('../types.js').Outcome} Outcome */

/**
 * @typedef {Object} PricingModel
 * @property {import('./probabilities.js').Probabilities} probabilities
 * @property {Object|null} binary
 * @property {Map<number, number>} margins
 * @property {import('./halfTime.js').HalfTimeModel} halfTime
 * @property {{ corners: import('./counts.js').CountModel|null, yellows: import('./counts.js').CountModel|null }|null} counts
 */

const binaryOutcome = (probability) => ({ win: probability, push: 0, loss: 1 - probability });

const invert = (outcome) => ({ win: outcome.loss, push: outcome.push, loss: outcome.win });

function overEstimate(binary, line) {
  return Number.isInteger(line) ? null : binary?.overs?.[line] ?? null;
}

/** Qué modelo de conteo valora cada mercado. */
const COUNT_MARKETS = { corners: 'corners', cards: 'yellows' };

function countEstimate(market, counts) {
  const stat = COUNT_MARKETS[market.type];
  return stat ? counts?.[stat]?.total[market.line] ?? null : null;
}

function overUnder(key, overOutcomeValue) {
  return key === 'over' ? overOutcomeValue : invert(overOutcomeValue);
}

const PRICERS = {
  result: (key, { probabilities }) => binaryOutcome(probabilities.result[key]),

  doubleChance: (key, { probabilities }) => binaryOutcome(probabilities.doubleChance[key]),

  drawNoBet: (key, { probabilities }) => {
    const { result } = probabilities;
    const win = result[key];
    return { win, push: result.draw, loss: 1 - win - result.draw };
  },

  btts: (key, { probabilities, binary }) => {
    const yes = binaryOutcome(binary?.btts.final ?? probabilities.btts);
    return key === 'yes' ? yes : invert(yes);
  },

  total: (key, { probabilities, binary }, market) => {
    const estimate = overEstimate(binary, market.line);
    return overUnder(
      key,
      estimate ? binaryOutcome(estimate.final) : overOutcome(probabilities.totalDistribution, market.line),
    );
  },

  firstGoal: (key, { probabilities }) => binaryOutcome(probabilities.firstGoal[key]),

  asianHandicap: (key, { margins }, market) => asianHandicapOutcome(margins, market.line, key),

  resultFirstHalf: (key, { halfTime }) => binaryOutcome(halfTime.result[key]),

  corners: (key, { counts }, market) => {
    const estimate = countEstimate(market, counts);
    return estimate ? overUnder(key, binaryOutcome(estimate.final)) : null;
  },

  cards: (key, { counts }, market) => {
    const estimate = countEstimate(market, counts);
    return estimate ? overUnder(key, binaryOutcome(estimate.final)) : null;
  },
};

/** Mercados que la versión actual sabe valorar. */
export const SUPPORTED_MARKET_TYPES = Object.freeze(Object.keys(PRICERS));

/**
 * @param {import('./marketCatalog.js').CanonicalMarket} market
 * @param {string} key
 * @param {PricingModel} model
 * @returns {Outcome|null}
 */
export function selectionOutcome(market, key, model) {
  const pricer = PRICERS[market.type];
  return pricer ? pricer(key, model, market) : null;
}

/**
 * Estimación empírica asociada a una selección (para medir acuerdo modelo vs. realidad).
 * @param {import('./marketCatalog.js').CanonicalMarket} market
 * @param {PricingModel} model
 * @returns {import('./empirical.js').Estimate|null}
 */
export function empiricalEvidence(market, model) {
  if (market.type === 'btts') return model.binary?.btts ?? null;
  if (market.type === 'total') return overEstimate(model.binary, market.line);
  return countEstimate(market, model.counts);
}
