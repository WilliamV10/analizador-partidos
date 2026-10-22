/**
 * Conversión de partidos crudos ("Club Necaxa 0-2 Atlas FC" + stats "local-visita")
 * a filas desde la perspectiva de un equipo (a favor / en contra).
 */

const SCORE_LINE = /^(.*?) (\d+)-(\d+) (.*)$/;
const NUMBER_PAIR = /^(\d+(?:\.\d+)?)%?-(\d+(?:\.\d+)?)%?$/;

/** Stats de Sofascore que usamos y su nombre interno. */
const STAT_FIELDS = Object.freeze({
  'ALL Expected goals': 'xg',
  'ALL Total shots': 'shots',
  'ALL Shots on target': 'shotsOnTarget',
  'ALL Corner kicks': 'corners',
  '1ST Corner kicks': 'cornersFirstHalf',
  'ALL Yellow cards': 'yellows',
  'ALL Ball possession': 'possession',
});

/** "Club Necaxa 0-2 Atlas FC" -> { homeName, awayName, homeGoals, awayGoals } */
export function parseScoreLine(text) {
  const match = String(text ?? '').match(SCORE_LINE);
  if (!match) return null;
  return {
    homeName: match[1].trim(),
    homeGoals: Number(match[2]),
    awayGoals: Number(match[3]),
    awayName: match[4].trim(),
  };
}

/** "1.81-2.18" o "49%-51%" -> [1.81, 2.18] */
export function parseNumberPair(text) {
  const match = String(text ?? '').trim().match(NUMBER_PAIR);
  return match ? [Number(match[1]), Number(match[2])] : null;
}

function orient(pair, isHome) {
  return isHome ? { for: pair[0], against: pair[1] } : { for: pair[1], against: pair[0] };
}

function parseStats(rawStats = {}, isHome) {
  const stats = {};
  Object.entries(STAT_FIELDS).forEach(([rawKey, field]) => {
    const pair = parseNumberPair(rawStats[rawKey]);
    if (pair) stats[field] = orient(pair, isHome);
  });
  return stats;
}

/**
 * @param {Object} raw            partido crudo del script
 * @param {Object} options
 * @param {boolean} options.isHome
 * @param {import('../types.js').TeamMatchRow['block']} options.block
 * @returns {import('../types.js').TeamMatchRow|null}
 */
export function toTeamRow(raw, { isHome, block }) {
  const score = parseScoreLine(raw?.partido);
  if (!score) return null;
  const halfTime = parseNumberPair(raw.descanso);
  const goals = orient([score.homeGoals, score.awayGoals], isHome);
  const halfTimeGoals = halfTime ? orient(halfTime, isHome) : null;
  return {
    date: raw.fecha ?? null,
    isHome,
    opponent: isHome ? score.awayName : score.homeName,
    competition: raw.competicion ?? raw.torneo ?? null,
    season: raw.temporada ?? null,
    block,
    goalsFor: goals.for,
    goalsAgainst: goals.against,
    htGoalsFor: halfTimeGoals?.for ?? null,
    htGoalsAgainst: halfTimeGoals?.against ?? null,
    stats: parseStats(raw.stats, isHome),
  };
}

/** Marcadores imposibles en tiempo regular (ej. 11-9 por penales). */
export function isAnomalous(row, totalGoalsThreshold) {
  return row.goalsFor + row.goalsAgainst >= totalGoalsThreshold;
}

export function totalGoals(row) {
  return row.goalsFor + row.goalsAgainst;
}
