/**
 * Capa 3: contexto que devuelve Claude (lesiones, rotaciones, motivación, clima...).
 *
 * Los ajustes son multiplicadores relativos sobre el λ final (−0.08 = −8 %):
 *   λ local  × (1 + ataqueLocal)  × (1 + defensaVisita)
 *   λ visita × (1 + ataqueVisita) × (1 + defensaLocal)
 * `defensaX` cambia los goles que RECIBE ese equipo. Cada ajuste se limita a
 * ±maxAdjustment para que un bloque mal escrito no desfigure el modelo.
 */
import { clamp } from '../utils/math.js';
import { namesMatch } from '../utils/text.js';

/**
 * @typedef {Object} MatchContext
 * @property {string|null} id
 * @property {string|null} title
 * @property {{ homeAttack: number, awayAttack: number, homeDefence: number, awayDefence: number }} adjustments
 * @property {number} cardsExtra
 * @property {number} cornersExtra
 * @property {string[]} notes
 * @property {string|null} confidence
 */

/**
 * Busca el contexto de un partido: primero por id y, si no hay id, por título aproximado.
 * @param {MatchContext[]} contexts
 * @param {import('../types.js').Match} match
 * @returns {MatchContext|null}
 */
export function findContext(contexts, match) {
  if (!contexts?.length) return null;
  const byId = contexts.find((context) => context.id !== null && context.id === match.id);
  if (byId) return byId;
  return (
    contexts.find((context) => context.id === null && context.title && titleMatches(context.title, match)) ?? null
  );
}

function titleMatches(title, match) {
  const [home = '', away = ''] = title.split(/\s+vs\.?\s+/i);
  return namesMatch(home, match.home.name) && namesMatch(away, match.away.name);
}

/**
 * @param {{ home: number, away: number }} lambdas
 * @param {MatchContext|null} context
 * @param {typeof import('../config.js').CONFIG.context} config
 * @returns {{ home: number, away: number }}
 */
export function applyContextToLambdas(lambdas, context, config) {
  if (!context) return lambdas;
  const limit = (value) => 1 + clamp(value, -config.maxAdjustment, config.maxAdjustment);
  const { homeAttack, awayAttack, homeDefence, awayDefence } = context.adjustments;
  return {
    home: lambdas.home * limit(homeAttack) * limit(awayDefence),
    away: lambdas.away * limit(awayAttack) * limit(homeDefence),
  };
}
