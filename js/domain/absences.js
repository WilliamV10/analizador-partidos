/**
 * Bajas cuantificadas: si un jugador que generaba una parte del xG del equipo
 * no juega, el λ por estadísticas del equipo baja en
 *   parte × (1 − reemplazo) × peso del estado (duda = media baja).
 * El λ de mercado no se toca: las cuotas ya suelen reflejar las bajas conocidas.
 */
import { sum } from '../utils/math.js';
import { PLAYER_STATUS } from './players.js';

/** Contribución ofensiva del jugador: su xG o, si no hay, sus goles. */
function contribution(player) {
  return player.xg ?? player.goals;
}

/** Estados que restan y cuánto. Banca y "no convocado" solo cuentan con XI confirmado. */
function statusWeight(status, lineupsConfirmed, config) {
  if (status === PLAYER_STATUS.OUT) return 1;
  if (status === PLAYER_STATUS.DOUBTFUL) return config.doubtfulWeight;
  if (lineupsConfirmed && (status === PLAYER_STATUS.BENCH || status === PLAYER_STATUS.NOT_LISTED)) return 1;
  return 0;
}

/**
 * @param {import('./players.js').PlayerProjection[]} projections  jugadores del equipo con su estado
 * @param {boolean} lineupsConfirmed
 * @param {typeof import('../config.js').CONFIG.absences} config
 * @returns {{ factor: number, missing: { name: string, share: number, status: string }[] }}
 */
export function absenceImpact(projections, lineupsConfirmed, config) {
  const total = sum(projections.map((projection) => contribution(projection.season)));
  if (!config.enabled || total <= 0) return { factor: 1, missing: [] };
  const missing = projections
    .map((projection) => ({
      name: projection.name,
      status: projection.status,
      share: contribution(projection.season) / total,
      weight: statusWeight(projection.status, lineupsConfirmed, config),
    }))
    .filter((player) => player.weight > 0 && player.share >= config.minShare);
  const loss = sum(missing.map((player) => player.share * player.weight * (1 - config.replacement)));
  return {
    factor: Math.max(config.minFactor, 1 - loss),
    missing: missing.map(({ name, share, status }) => ({ name, share, status })),
  };
}
