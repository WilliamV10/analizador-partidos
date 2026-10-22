/**
 * Valor de cada cuota: probabilidad propia vs. probabilidad justa de la casa,
 * valor esperado (EV) y nivel de confianza.
 */
import { fairProbabilities } from './odds.js';
import { empiricalEvidence, selectionOutcome } from './selections.js';

export const TIERS = Object.freeze({ HIGH: 'high', MEDIUM: 'medium', LOW: 'low', NONE: 'none' });

/** Ganancia esperada por unidad apostada. La devolución (push) aporta 0. */
export function expectedValue(outcome, odds) {
  return outcome.win * (odds - 1) - outcome.loss;
}

/** Probabilidad de ganar excluyendo la devolución (comparable con la cuota justa). */
export function winProbability(outcome) {
  const decided = outcome.win + outcome.loss;
  return decided > 0 ? outcome.win / decided : 0;
}

/** Niveles de menor a mayor confianza. */
export const TIER_ORDER = Object.freeze([TIERS.NONE, TIERS.LOW, TIERS.MEDIUM, TIERS.HIGH]);

function capTier(tier, cap) {
  return TIER_ORDER.indexOf(tier) > TIER_ORDER.indexOf(cap) ? cap : tier;
}

function baseTier(ev, sample, config) {
  if (ev >= config.highEv && sample >= config.minSampleHigh) return TIERS.HIGH;
  if (ev >= config.mediumEv) return TIERS.MEDIUM;
  return TIERS.LOW;
}

/**
 * Nivel de confianza de un pick.
 *  - Sin valor si el EV no es positivo, la probabilidad es demasiado baja (cuotas largas)
 *    o la cuota es demasiado corta.
 *  - Si las fuentes no coinciden (gap > maxGap), el nivel se limita a `capWhenInconsistent`.
 * @param {{ ev: number, odds: number, probability: number, gap: number|null, sample: number, maxGap: number, capWhenInconsistent: string }} evidence
 * @param {typeof import('../config.js').CONFIG.value} config
 */
export function confidenceTier({ ev, odds, probability, gap, sample, maxGap, capWhenInconsistent }, config) {
  const recommendable = ev > 0 && probability >= config.minProbability && odds >= config.minOdds;
  if (!recommendable) return TIERS.NONE;
  const tier = baseTier(ev, sample, config);
  const consistent = gap === null || gap <= maxGap;
  return consistent ? tier : capTier(tier, capWhenInconsistent);
}

/**
 * @typedef {Object} ValuePick
 * @property {import('./marketCatalog.js').CanonicalMarket} market
 * @property {string} key
 * @property {number} odds
 * @property {number} probability      propia, sin contar devolución
 * @property {number} fairProbability  de la casa, sin margen
 * @property {number} edge             probability - fairProbability
 * @property {number} ev
 * @property {import('../types.js').Outcome} outcome
 * @property {number|null} gap         desacuerdo entre fuentes (modelo/realidad o stats/mercado)
 * @property {number} sample
 * @property {string} tier
 */

/**
 * Qué tan respaldado está un pick:
 *  - goles / ambos anotan: acuerdo entre el modelo y lo ocurrido realmente;
 *  - 1X2 y derivados: acuerdo entre las estadísticas y el mercado. Si no coinciden,
 *    el "valor" sale solo de que las estadísticas contradicen a la casa: se limita a media-baja.
 */
function evidenceFor(market, selection, fairProbability, context) {
  const empirical = empiricalEvidence(market, context.finalModel);
  if (empirical) {
    return {
      gap: empirical.empirical === null ? null : Math.abs(empirical.model - empirical.empirical),
      sample: empirical.n,
      maxGap: context.config.maxModelEmpiricalGap,
      capWhenInconsistent: TIERS.MEDIUM,
    };
  }
  const statsOutcome = selectionOutcome(market, selection.key, context.statsModel);
  return {
    gap: statsOutcome ? Math.abs(winProbability(statsOutcome) - fairProbability) : null,
    sample: context.sampleSize,
    maxGap: context.config.maxStatsMarketGap,
    capWhenInconsistent: TIERS.LOW,
  };
}

function evaluateMarket(market, context) {
  const fair = fairProbabilities(
    market.selections.map((selection) => selection.odds),
    market.fairTotal,
  );
  return market.selections
    .map((selection, index) => {
      const outcome = selectionOutcome(market, selection.key, context.finalModel);
      if (!outcome) return null;
      const probability = winProbability(outcome);
      const ev = expectedValue(outcome, selection.odds);
      const evidence = evidenceFor(market, selection, fair[index], context);
      return {
        market,
        key: selection.key,
        odds: selection.odds,
        probability,
        fairProbability: fair[index],
        edge: probability - fair[index],
        ev,
        outcome,
        gap: evidence.gap,
        sample: evidence.sample,
        tier: confidenceTier({ ev, odds: selection.odds, probability, ...evidence }, context.config),
      };
    })
    .filter(Boolean);
}

/**
 * Evalúa todas las selecciones de todos los mercados soportados, ordenadas por EV.
 * @param {Object} context
 * @param {import('./marketCatalog.js').CanonicalMarket[]} context.markets
 * @param {{ probabilities: Object, binary: Object }} context.finalModel
 * @param {{ probabilities: Object, binary: null }} context.statsModel
 * @param {number} context.sampleSize
 * @param {typeof import('../config.js').CONFIG.value} context.config
 * @returns {ValuePick[]}
 */
export function evaluateMarkets(context) {
  return context.markets
    .flatMap((market) => evaluateMarket(market, context))
    .sort((a, b) => b.ev - a.ev);
}
