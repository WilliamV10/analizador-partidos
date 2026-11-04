/**
 * Valor de cada cuota: probabilidad propia vs. probabilidad justa de la casa,
 * valor esperado (EV) y nivel de confianza.
 *
 * La probabilidad propia se acerca a la de la casa antes de calcular el valor
 * (`value.modelWeight`, por grupo de mercado): cuando el modelo cree mucho más que la casa
 * suele ser porque se equivoca hacia arriba, y en los mercados donde la casa acierta mejor
 * (1X2, hándicap, corners, tarjetas) el modelo pesa poco.
 */
import { marketGroup } from './marketCatalog.js';
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
 *  - Si el modelo se aleja demasiado de la casa (edge > maxEdge) no se recomienda: una
 *    diferencia así casi siempre es un error o un dato que falta (ej. equipos de ligas
 *    distintas en Champions), no valor real. En el historial, esos picks perdieron.
 * @param {{ ev: number, odds: number, probability: number, edge?: number, gap: number|null, sample: number, maxGap: number, capWhenInconsistent: string }} evidence
 * @param {typeof import('../config.js').CONFIG.value} config
 */
export function confidenceTier({ ev, odds, probability, edge = 0, gap, sample, maxGap, capWhenInconsistent }, config) {
  // edge: ventaja del modelo SIN acercarlo a la casa (lo que delata un error o un dato que falta).
  const credible = config.maxEdge === undefined || edge <= config.maxEdge;
  const recommendable = ev > 0 && probability >= config.minProbability && odds >= config.minOdds && credible;
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
 * @property {number} probability      propia ya acercada a la casa, sin contar devolución
 * @property {number} modelProbability la del modelo antes de acercarla a la casa
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

/**
 * Acerca el resultado del modelo a la casa: la parte decidida (gana o pierde) se reparte con
 * la probabilidad mezclada; la devolución (empate no apuesta, hándicap) queda igual.
 * `towardHalf` < 1 acerca además esa probabilidad al 50 % (mercados donde todos se pasan de seguros).
 */
export function shrinkToMarket(outcome, fairProbability, weight, towardHalf = 1) {
  const decided = outcome.win + outcome.loss;
  const blended = weight * winProbability(outcome) + (1 - weight) * fairProbability;
  const probability = 0.5 + towardHalf * (blended - 0.5);
  return { win: probability * decided, push: outcome.push, loss: (1 - probability) * decided };
}

function modelWeightFor(market, config) {
  return config.modelWeight?.[marketGroup(market)] ?? config.defaultModelWeight ?? 1;
}

/** Factor para acercar al 50 % (1 = sin cambio). */
export function towardHalfFor(group, config) {
  return config.towardHalf?.[group] ?? 1;
}

function evaluateMarket(market, context) {
  const fair = fairProbabilities(
    market.selections.map((selection) => selection.odds),
    market.fairTotal,
  );
  const weight = modelWeightFor(market, context.config);
  const towardHalf = towardHalfFor(marketGroup(market), context.config);
  return market.selections
    .map((selection, index) => {
      const modelOutcome = selectionOutcome(market, selection.key, context.finalModel);
      if (!modelOutcome) return null;
      const modelProbability = winProbability(modelOutcome);
      const outcome = shrinkToMarket(modelOutcome, fair[index], weight, towardHalf);
      const probability = winProbability(outcome);
      const ev = expectedValue(outcome, selection.odds);
      const evidence = evidenceFor(market, selection, fair[index], context);
      return {
        market,
        key: selection.key,
        odds: selection.odds,
        probability,
        modelProbability,
        fairProbability: fair[index],
        edge: probability - fair[index],
        ev,
        outcome,
        gap: evidence.gap,
        sample: evidence.sample,
        tier: confidenceTier({ ev, odds: selection.odds, probability, edge: modelProbability - fair[index], ...evidence }, context.config),
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
