/**
 * Ranking global de picks de todos los partidos, con filtros.
 */
import { marketGroup } from './marketCatalog.js';
import { TIER_ORDER } from './value.js';

export const ALL_MARKETS = 'all';

/**
 * @typedef {Object} PickFilters
 * @property {string} market    grupo de mercado (ver MARKET_GROUPS) o 'all'
 * @property {string} minTier   nivel mínimo (none, low, medium, high)
 * @property {number} minOdds
 */

/**
 * @typedef {Object} RankedPick
 * @property {import('./analyzeMatch.js').MatchAnalysis} analysis
 * @property {import('./value.js').ValuePick} pick
 */

function passes(pick, { market, minTier, minOdds }) {
  return (
    (market === ALL_MARKETS || marketGroup(pick.market) === market) &&
    TIER_ORDER.indexOf(pick.tier) >= TIER_ORDER.indexOf(minTier) &&
    pick.odds >= minOdds
  );
}

/**
 * @param {import('./analyzeMatch.js').MatchAnalysis[]} analyses
 * @param {PickFilters} filters
 * @returns {RankedPick[]}  ordenados por EV
 */
export function rankPicks(analyses, filters) {
  return analyses
    .flatMap((analysis) => analysis.picks.map((pick) => ({ analysis, pick })))
    .filter(({ pick }) => passes(pick, filters))
    .sort((a, b) => b.pick.ev - a.pick.ev);
}

/** Grupos de mercado presentes en los análisis (para no ofrecer filtros vacíos). */
export function availableMarketGroups(analyses) {
  return [...new Set(analyses.flatMap((analysis) => analysis.picks.map((pick) => marketGroup(pick.market))))];
}
