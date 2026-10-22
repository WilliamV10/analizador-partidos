/**
 * Alertas automáticas. El dominio devuelve códigos + parámetros;
 * la interfaz decide cómo mostrarlos (ver js/texts.js).
 */
import { PLAYER_STATUS } from './players.js';

export const ALERT_LEVELS = Object.freeze({ WARNING: 'warning', INFO: 'info' });

export const ALERT_CODES = Object.freeze({
  MATCH_STARTED: 'matchStarted',
  LINEUPS_NOT_CONFIRMED: 'lineupsNotConfirmed',
  NO_LINEUPS: 'noLineups',
  NO_RESULT_ODDS: 'noResultOdds',
  SMALL_SAMPLE: 'smallSample',
  ANOMALOUS_EXCLUDED: 'anomalousExcluded',
  DUPLICATE_MARKETS: 'duplicateMarkets',
  MARKET_DIVERGENCE: 'marketDivergence',
  KEY_PLAYER_OUT: 'keyPlayerOut',
});

const NOT_STARTED = 'Not started';

const alert = (code, level, params = {}) => ({ code, level, params });

function hasStarters(team) {
  return (team.lineup?.starters?.length ?? 0) > 0;
}

/**
 * Estadísticas y mercado muy distintos: a la página probablemente le falta información
 * (bajas, rotaciones, nivel real de la liga) y conviene revisar con Claude.
 */
function divergenceAlert(lambdas, statsProbabilities, config) {
  const { market, stats } = lambdas;
  if (!market) return null;
  const goalsGap = Math.abs(stats.home + stats.away - (market.home + market.away));
  const resultGap = Math.max(
    ...['home', 'draw', 'away'].map((key) => Math.abs(statsProbabilities.result[key] - market.targets[key])),
  );
  if (goalsGap < config.divergenceGoals && resultGap < config.divergenceProbability) return null;
  return alert(ALERT_CODES.MARKET_DIVERGENCE, ALERT_LEVELS.WARNING, { goalsGap, resultGap });
}

function isUnavailable(status, lineupsConfirmed) {
  if (status === PLAYER_STATUS.OUT || status === PLAYER_STATUS.DOUBTFUL) return true;
  return lineupsConfirmed && (status === PLAYER_STATUS.BENCH || status === PLAYER_STATUS.NOT_LISTED);
}

function leaderBy(projections, read) {
  return projections.reduce((best, projection) => (read(projection) > (best ? read(best) : 0) ? projection : best), null);
}

/** El goleador o el máximo rematador del equipo está de baja, en duda o en la banca. */
function keyPlayerAlerts(teamName, projections, lineupsConfirmed) {
  const leaders = [
    { role: 'scorer', player: leaderBy(projections, (projection) => projection.season.goals) },
    { role: 'shooter', player: leaderBy(projections, (projection) => projection.season.shotsOnTarget) },
  ].filter(({ player }) => player && isUnavailable(player.status, lineupsConfirmed));
  const unique = leaders.filter((leader, index) => leaders.findIndex((other) => other.player === leader.player) === index);
  return unique.map(({ role, player }) =>
    alert(ALERT_CODES.KEY_PLAYER_OUT, ALERT_LEVELS.WARNING, { team: teamName, player: player.name, status: player.status, role }),
  );
}

/**
 * @param {Object} input
 * @param {import('../types.js').Match} input.match
 * @param {{ home: number, away: number }} input.recentSampleSizes
 * @param {{ team: string, opponent: string, goalsFor: number, goalsAgainst: number }[]} input.excludedRows
 * @param {{ stats: Object, market: Object|null }} input.lambdas
 * @param {import('./probabilities.js').Probabilities} input.statsProbabilities
 * @param {{ home: Object[], away: Object[] }} input.players  proyecciones con estado de cada jugador
 * @param {{ data: Object, alerts: Object }} config
 */
export function buildAlerts({ match, recentSampleSizes, excludedRows, lambdas, statsProbabilities, players }, config) {
  const hasMarketLambdas = Boolean(lambdas.market);
  const alerts = [];
  if (match.status && match.status !== NOT_STARTED) {
    alerts.push(alert(ALERT_CODES.MATCH_STARTED, ALERT_LEVELS.WARNING, { status: match.status, score: match.score }));
  }
  if (!hasStarters(match.home) && !hasStarters(match.away)) {
    alerts.push(alert(ALERT_CODES.NO_LINEUPS, ALERT_LEVELS.WARNING));
  } else if (!match.lineupsConfirmed) {
    alerts.push(alert(ALERT_CODES.LINEUPS_NOT_CONFIRMED, ALERT_LEVELS.WARNING));
  }
  if (!hasMarketLambdas) {
    alerts.push(alert(ALERT_CODES.NO_RESULT_ODDS, ALERT_LEVELS.WARNING));
  }
  [
    [match.home.name, recentSampleSizes.home],
    [match.away.name, recentSampleSizes.away],
  ].forEach(([team, n]) => {
    if (n < config.data.smallSample) alerts.push(alert(ALERT_CODES.SMALL_SAMPLE, ALERT_LEVELS.WARNING, { team, n }));
  });
  const divergence = divergenceAlert(lambdas, statsProbabilities, config.alerts);
  if (divergence) alerts.push(divergence);
  alerts.push(
    ...keyPlayerAlerts(match.home.name, players.home, match.lineupsConfirmed),
    ...keyPlayerAlerts(match.away.name, players.away, match.lineupsConfirmed),
  );
  if (excludedRows.length) {
    alerts.push(alert(ALERT_CODES.ANOMALOUS_EXCLUDED, ALERT_LEVELS.INFO, { rows: excludedRows }));
  }
  if (match.duplicateMarkets?.length) {
    alerts.push(alert(ALERT_CODES.DUPLICATE_MARKETS, ALERT_LEVELS.INFO, { names: match.duplicateMarkets }));
  }
  return alerts;
}
