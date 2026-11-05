/**
 * Calibración con el historial: qué peso darle al modelo frente a la casa en cada grupo de
 * mercado (value.modelWeight), según lo que pasó en las selecciones ya liquidadas.
 *
 * Para cada grupo se prueba el peso de 0 a 1 y se elige el que mejor acierta (menor log loss)
 * con prob. = peso × modelo + (1 − peso) × casa (y luego acercada al 50 % si el grupo lo usa).
 * La sugerencia se acerca al peso por defecto mientras haya pocas selecciones (PRIOR_RECORDS),
 * para no mover el modelo por una racha. Se ancla al de por defecto (no al actual) para que,
 * con los mismos datos, aplicar la sugerencia otra vez no la siga moviendo.
 */
import { marketGroup } from './marketCatalog.js';

/** Desde aquí los registros guardan la probabilidad ya mezclada con la casa; antes, la del modelo. */
const BLEND_SINCE = Date.UTC(2026, 10, 3);
/** Selecciones "virtuales" con el peso actual: con menos datos que esto, la sugerencia se mueve poco. */
const PRIOR_RECORDS = 300;
/** Mínimo de selecciones liquidadas para sugerir algo en un grupo. */
export const MIN_RECORDS = 80;
const STEP = 0.05;

/** Probabilidad del modelo sin mezclar, o null si el registro no la tiene. */
function rawProbability(record) {
  if (Number.isFinite(record.modelProbability)) return record.modelProbability;
  return record.analyzedAt < BLEND_SINCE ? record.probability : null;
}

const WON = { win: 1, loss: 0 };

function logLoss(rows, weight, towardHalf) {
  const total = rows.reduce((sum, { model, fair, won }) => {
    const blended = 0.5 + towardHalf * (weight * model + (1 - weight) * fair - 0.5);
    const probability = Math.min(0.999, Math.max(0.001, blended));
    return sum - (won ? Math.log(probability) : Math.log(1 - probability));
  }, 0);
  return total / rows.length;
}

const roundToStep = (value) => Number((Math.round(value / STEP) * STEP).toFixed(2));

/**
 * @typedef {Object} WeightSuggestion
 * @property {string} group
 * @property {number} count       selecciones liquidadas usadas
 * @property {number} current     peso actual
 * @property {number|null} best   el que mejor acertó en el historial (sin acercar al actual)
 * @property {number|null} suggested  el sugerido (null si hay pocos datos)
 * @property {number|null} improvement  cuánto baja el log loss con el sugerido (positivo = mejor)
 */

/**
 * @param {import('./history.js').HistoryRecord[]} records
 * @param {typeof import('../config.js').CONFIG.value} config     la configuración actual
 * @param {Record<string, number>} defaults  pesos por defecto (CONFIG.value.modelWeight)
 * @returns {WeightSuggestion[]}
 */
export function suggestModelWeights(records, config, defaults = config.modelWeight) {
  const byGroup = new Map();
  records.forEach((record) => {
    const won = WON[record.settlement?.status];
    const model = rawProbability(record);
    if (won === undefined || model === null || !Number.isFinite(record.fairProbability)) return;
    const group = marketGroup(record.market);
    if (!byGroup.has(group)) byGroup.set(group, []);
    byGroup.get(group).push({ model, fair: record.fairProbability, won });
  });
  return Object.keys(config.modelWeight).map((group) => {
    const rows = byGroup.get(group) ?? [];
    const current = config.modelWeight[group];
    if (rows.length < MIN_RECORDS) return { group, count: rows.length, current, best: null, suggested: null, improvement: null };
    const towardHalf = config.towardHalf?.[group] ?? 1;
    let best = current;
    for (let weight = 0; weight <= 1 + 1e-9; weight += STEP) {
      if (logLoss(rows, weight, towardHalf) < logLoss(rows, best, towardHalf)) best = roundToStep(weight);
    }
    const anchor = defaults[group] ?? current;
    const suggested = roundToStep((rows.length * best + PRIOR_RECORDS * anchor) / (rows.length + PRIOR_RECORDS));
    return {
      group,
      count: rows.length,
      current,
      best,
      suggested,
      improvement: logLoss(rows, current, towardHalf) - logLoss(rows, suggested, towardHalf),
    };
  });
}
