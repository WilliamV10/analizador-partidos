/** Utilidades numéricas puras. */

export function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

export function sum(values) {
  return values.filter(isFiniteNumber).reduce((total, value) => total + value, 0);
}

/** Promedio ignorando valores nulos o no numéricos. Devuelve null si no hay datos. */
export function mean(values) {
  const numbers = values.filter(isFiniteNumber);
  return numbers.length ? sum(numbers) / numbers.length : null;
}

/**
 * Promedio ponderado ignorando valores no numéricos. null si no hay peso.
 * @param {{ value: unknown, weight: number }[]} entries
 */
export function weightedMean(entries) {
  let total = 0;
  let weights = 0;
  entries.forEach(({ value, weight }) => {
    if (!isFiniteNumber(value) || !(weight > 0)) return;
    total += value * weight;
    weights += weight;
  });
  return weights > 0 ? total / weights : null;
}

export function round(value, digits = 2) {
  if (!isFiniteNumber(value)) return null;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

/** Genera [start, start+step, ..., end] evitando errores de coma flotante. */
export function range(start, end, step) {
  const values = [];
  const count = Math.floor((end - start) / step + 1e-9);
  for (let index = 0; index <= count; index += 1) {
    values.push(round(start + index * step, 6));
  }
  return values;
}
