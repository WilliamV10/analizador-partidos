/**
 * Proyección de tiros por jugador.
 *
 *   λ = ritmo por 90' × minutos esperados / 90 × √(lo que concede el rival / media de liga)
 *   P(1+) = 1 − e^(−λ)        P(2+) = 1 − e^(−λ)·(1 + λ)
 *
 * Con poca muestra (menos de `shrinkMinutes`), el ritmo se encoge hacia la media del puesto.
 * Los minutos esperados salen de la alineación (titular, suplente, baja) o, sin
 * alineación, del promedio histórico del jugador.
 */
import { namesMatch } from '../utils/text.js';

export const PLAYER_STATUS = Object.freeze({
  STARTER: 'starter',
  BENCH: 'bench',
  DOUBTFUL: 'doubtful',
  OUT: 'out',
  NOT_LISTED: 'notListed',
  UNKNOWN: 'unknown',
});

const MINUTES_PER_MATCH = 90;

/** Estado del jugador según la alineación del partido. */
export function playerStatus(name, lineup) {
  if (!lineup) return PLAYER_STATUS.UNKNOWN;
  const absence = lineup.absences.find((candidate) => namesMatch(candidate.name, name));
  if (absence) return absence.status === 'doubtful' ? PLAYER_STATUS.DOUBTFUL : PLAYER_STATUS.OUT;
  if (lineup.starters.some((starter) => namesMatch(starter.name, name))) return PLAYER_STATUS.STARTER;
  if (lineup.substitutes.some((substitute) => namesMatch(substitute, name))) return PLAYER_STATUS.BENCH;
  return lineup.starters.length ? PLAYER_STATUS.NOT_LISTED : PLAYER_STATUS.UNKNOWN;
}

function positionOf(name, lineup) {
  return lineup?.starters.find((starter) => namesMatch(starter.name, name))?.position ?? null;
}

function expectedMinutes(player, status, config) {
  if (status !== PLAYER_STATUS.UNKNOWN) return config.minutes[status];
  if (!player.appearances) return 0;
  return Math.min(MINUTES_PER_MATCH, player.minutes / player.appearances);
}

/** Ritmo por 90' encogido hacia la media del puesto mientras la muestra sea chica. */
function ratePer90(count, minutes, priorRate, shrinkMinutes) {
  const virtualMatches = Math.max(0, shrinkMinutes - minutes) / MINUTES_PER_MATCH;
  const playedMatches = minutes / MINUTES_PER_MATCH;
  const denominator = playedMatches + virtualMatches;
  return denominator > 0 ? (count + priorRate * virtualMatches) / denominator : priorRate;
}

function opponentFactor(conceded, leagueAverage) {
  return conceded && leagueAverage ? Math.sqrt(conceded / leagueAverage) : 1;
}

function atLeast(lambda) {
  const none = Math.exp(-lambda);
  return { lambda, one: 1 - none, two: 1 - none * (1 + lambda) };
}

/**
 * @typedef {Object} PlayerProjection
 * @property {string} name
 * @property {string|null} position
 * @property {string} status          ver PLAYER_STATUS
 * @property {number} expectedMinutes
 * @property {import('../types.js').Player} season
 * @property {{ lambda: number, one: number, two: number }} shotsOnTarget
 * @property {{ lambda: number, one: number, two: number }} shots
 */

/**
 * @param {import('../types.js').Team} team
 * @param {import('./aggregates.js').TeamSummary|null} opponentSummary  resumen reciente del rival
 * @param {typeof import('../config.js').CONFIG.players} config
 * @returns {PlayerProjection[]}  ordenados por tiros a puerta esperados
 */
export function projectPlayers(team, opponentSummary, config) {
  const factors = {
    shotsOnTarget: opponentFactor(opponentSummary?.avg.shotsOnTargetAgainst, config.leagueAverage.shotsOnTarget),
    shots: opponentFactor(opponentSummary?.avg.shotsAgainst, config.leagueAverage.shots),
  };
  return team.players
    .map((player) => {
      const status = playerStatus(player.name, team.lineup);
      const position = positionOf(player.name, team.lineup);
      const minutes = expectedMinutes(player, status, config);
      const project = (stat) => {
        const prior = config.priorPer90[stat][position ?? 'unknown'];
        const rate = ratePer90(player[stat], player.minutes, prior, config.shrinkMinutes);
        return atLeast(rate * (minutes / MINUTES_PER_MATCH) * factors[stat]);
      };
      return {
        name: player.name,
        position,
        status,
        expectedMinutes: minutes,
        season: player,
        shotsOnTarget: project('shotsOnTarget'),
        shots: project('shots'),
      };
    })
    .filter((projection) => projection.season.minutes > 0 || projection.status === PLAYER_STATUS.STARTER)
    .sort((a, b) => b.shotsOnTarget.lambda - a.shotsOnTarget.lambda);
}
