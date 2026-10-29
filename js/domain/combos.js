/**
 * Combinadas automáticas, con dos criterios:
 *  - Valor: un pick por partido, solo selecciones con valor (EV positivo y nivel mínimo).
 *  - Probabilidad: las selecciones más probables de los mercados populares (ganador,
 *    doble oportunidad, ambos anotan, goles 1.5/2.5/3.5, hándicap, corners), haya valor
 *    o no, con una cuota mínima para que no entren cuotas regaladas (ej. 1.04).
 *
 * Se asume independencia entre partidos. Con devoluciones (empate no apuesta),
 * cada selección paga `cuota` si gana, 1 si devuelve y 0 si pierde, así que:
 *   EV = Π (win·cuota + push) − 1
 */
import { TIER_ORDER } from './value.js';

/**
 * @typedef {Object} ComboLeg
 * @property {import('./analyzeMatch.js').MatchAnalysis} analysis
 * @property {import('./value.js').ValuePick} pick
 */

/**
 * @typedef {Object} Combo
 * @property {ComboLeg[]} legs
 * @property {number} odds         cuota total
 * @property {number} probability  probabilidad de acertar todas (sin contar devoluciones)
 * @property {number} ev
 */

function minOddsFor(pick, config) {
  return config.minOddsByType[pick.market.type] ?? config.minOdds;
}

function isCandidate(pick, config) {
  return (
    pick.ev > 0 &&
    TIER_ORDER.indexOf(pick.tier) >= TIER_ORDER.indexOf(config.minTier) &&
    pick.odds >= minOddsFor(pick, config)
  );
}

/** Mejores picks elegibles de cada partido (los partidos sin ninguno quedan fuera). */
function candidatesByMatch(analyses, config) {
  return analyses
    .map((analysis) =>
      analysis.picks
        .filter((pick) => isCandidate(pick, config))
        .slice(0, config.candidatesPerMatch)
        .map((pick) => ({ analysis, pick })),
    )
    .filter((legs) => legs.length);
}

/** Todas las combinaciones con a lo sumo un pick por partido y tamaño en [min, max]. */
function enumerate(groups, { minSelections, maxSelections }) {
  const results = [];
  const walk = (start, chosen) => {
    if (chosen.length >= minSelections) results.push(chosen);
    if (chosen.length === maxSelections) return;
    for (let index = start; index < groups.length; index += 1) {
      groups[index].forEach((leg) => walk(index + 1, [...chosen, leg]));
    }
  };
  walk(0, []);
  return results;
}

/**
 * Todos los picks que pueden entrar en una combinada con estas reglas, por EV.
 * @param {import('./analyzeMatch.js').MatchAnalysis[]} analyses
 * @param {typeof import('../config.js').CONFIG.combos} config  minOdds y minTier pueden venir de la interfaz
 * @returns {ComboLeg[]}
 */
export function comboCandidates(analyses, config) {
  return analyses
    .flatMap((analysis) => analysis.picks.filter((pick) => isCandidate(pick, config)).map((pick) => ({ analysis, pick })))
    .sort((a, b) => b.pick.ev - a.pick.ev);
}

/**
 * ¿La selección entra en "más probables"? Mercado popular, cuota y probabilidad mínimas.
 * @param {import('./value.js').ValuePick} pick
 * @param {typeof import('../config.js').CONFIG.probable} config
 */
export function isProbableCandidate(pick, config) {
  const { type, line } = pick.market;
  if (!config.markets.includes(type)) return false;
  if (type === 'total' && !config.totalLines.includes(line)) return false;
  return pick.odds >= config.minOdds && pick.probability >= config.minProbability;
}

/**
 * Selecciones de los mercados populares ordenadas por probabilidad (a igual probabilidad, por EV).
 * @param {import('./analyzeMatch.js').MatchAnalysis[]} analyses
 * @param {typeof import('../config.js').CONFIG.probable} config
 * @returns {ComboLeg[]}
 */
export function probableCandidates(analyses, config) {
  return analyses
    .flatMap((analysis) => analysis.picks.filter((pick) => isProbableCandidate(pick, config)).map((pick) => ({ analysis, pick })))
    .sort((a, b) => b.pick.probability - a.pick.probability || b.pick.ev - a.pick.ev);
}

/**
 * Combinadas más probables: un pick por partido entre los más probables de cada uno,
 * con cuota total mínima (si no, ganaría siempre la combinada más corta y sin sentido).
 * @param {import('./analyzeMatch.js').MatchAnalysis[]} analyses
 * @param {typeof import('../config.js').CONFIG.probable} config
 * @param {{ minSelections: number, maxSelections: number, shown: number }} sizes
 * @returns {Combo[]}
 */
export function buildProbableCombos(analyses, config, sizes) {
  const groups = analyses
    .map((analysis) => probableCandidates([analysis], config).slice(0, config.candidatesPerMatch))
    .filter((legs) => legs.length);
  return enumerate(groups, sizes)
    .map(priceCombo)
    .filter((combo) => combo.odds >= config.minComboOdds)
    .sort((a, b) => b.probability - a.probability || b.ev - a.ev)
    .slice(0, sizes.shown);
}

/** @returns {Combo} */
export function priceCombo(legs) {
  const product = (read) => legs.reduce((total, leg) => total * read(leg.pick), 1);
  return {
    legs,
    odds: product((pick) => pick.odds),
    probability: product((pick) => pick.probability),
    ev: product((pick) => pick.outcome.win * pick.odds + pick.outcome.push) - 1,
  };
}

/**
 * @param {import('./analyzeMatch.js').MatchAnalysis[]} analyses
 * @param {typeof import('../config.js').CONFIG.combos} config
 * @returns {{ safest: Combo[], bestValue: Combo[], candidates: number }}
 */
export function buildCombos(analyses, config) {
  const groups = candidatesByMatch(analyses, config);
  const combos = enumerate(groups, config).map(priceCombo);
  const top = (compare) => [...combos].sort(compare).slice(0, config.shown);
  return {
    safest: top((a, b) => b.probability - a.probability || b.ev - a.ev),
    bestValue: top((a, b) => b.ev - a.ev),
    candidates: groups.length,
  };
}
