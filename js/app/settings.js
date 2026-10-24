/**
 * Ajustes editables: qué parámetros de config.js se pueden cambiar desde la interfaz,
 * con sus límites, y cómo se combinan con los valores por defecto.
 * Los valores guardados se validan siempre: un localStorage manipulado no rompe el modelo.
 */
import { clamp } from '../utils/math.js';

/**
 * @typedef {Object} SettingField
 * @property {string} path     ruta dentro de CONFIG ("lambda.marketWeight")
 * @property {'number'|'percent'|'boolean'} kind
 * @property {number} [min]
 * @property {number} [max]
 * @property {number} [step]
 */

/** Grupos de campos (los textos de cada uno están en TEXTS.settings). */
export const SETTING_GROUPS = Object.freeze([
  {
    id: 'model',
    fields: [
      { path: 'lambda.marketWeight', kind: 'percent', min: 0, max: 1, step: 0.05 },
      { path: 'lambda.xgWeight', kind: 'percent', min: 0, max: 1, step: 0.05 },
      { path: 'counts.marketWeight', kind: 'percent', min: 0, max: 1, step: 0.05 },
      { path: 'lambda.multiplicative', kind: 'boolean' },
      { path: 'poisson.dixonColesRho', kind: 'number', min: -0.2, max: 0, step: 0.01 },
      { path: 'lambda.homeAdvantage', kind: 'number', min: 1, max: 1.4, step: 0.01 },
      { path: 'lambda.awayDisadvantage', kind: 'number', min: 0.6, max: 1, step: 0.01 },
      { path: 'lambda.venueSplitWeight', kind: 'percent', min: 0, max: 0.8, step: 0.05 },
      { path: 'empirical.priorStrength', kind: 'number', min: 0, max: 50, step: 1 },
      { path: 'empirical.maxWeight', kind: 'percent', min: 0, max: 0.8, step: 0.05 },
    ],
  },
  {
    id: 'value',
    fields: [
      { path: 'value.highEv', kind: 'percent', min: 0.01, max: 0.3, step: 0.01 },
      { path: 'value.mediumEv', kind: 'percent', min: 0, max: 0.2, step: 0.01 },
      { path: 'value.minProbability', kind: 'percent', min: 0, max: 0.7, step: 0.05 },
      { path: 'value.minOdds', kind: 'number', min: 1.01, max: 2, step: 0.01 },
      { path: 'value.minSampleHigh', kind: 'number', min: 0, max: 30, step: 1 },
      { path: 'value.maxEdge', kind: 'percent', min: 0.05, max: 0.5, step: 0.01 },
    ],
  },
  {
    id: 'combos',
    fields: [
      { path: 'combos.minOdds', kind: 'number', min: 1.01, max: 3, step: 0.05 },
      { path: 'combos.maxSelections', kind: 'number', min: 2, max: 6, step: 1 },
    ],
  },
  {
    id: 'intelligence',
    fields: [
      { path: 'schedule.enabled', kind: 'boolean' },
      { path: 'recency.enabled', kind: 'boolean' },
      { path: 'recency.halfLifeDays', kind: 'number', min: 30, max: 365, step: 10 },
      { path: 'absences.enabled', kind: 'boolean' },
      { path: 'absences.replacement', kind: 'percent', min: 0, max: 1, step: 0.05 },
      { path: 'context.maxAdjustment', kind: 'percent', min: 0, max: 0.5, step: 0.05 },
    ],
  },
]);

const FIELDS = SETTING_GROUPS.flatMap((group) => group.fields);

export function readPath(object, path) {
  return path.split('.').reduce((value, key) => value?.[key], object);
}

/** Copia de `object` con `value` en `path` (sin mutar el original). */
function withPath(object, [key, ...rest], value) {
  return { ...object, [key]: rest.length ? withPath(object[key] ?? {}, rest, value) : value };
}

/** Valor válido para el campo o undefined si no se puede usar. */
export function sanitize(field, value) {
  if (field.kind === 'boolean') return typeof value === 'boolean' ? value : undefined;
  const number = Number(value);
  if (value === '' || value === null || !Number.isFinite(number)) return undefined;
  return clamp(number, field.min, field.max);
}

/**
 * Config efectiva = valores por defecto + cambios válidos del usuario.
 * @param {typeof import('../config.js').CONFIG} base
 * @param {Record<string, unknown>} overrides  { "lambda.marketWeight": 0.5, ... }
 */
export function applySettings(base, overrides = {}) {
  return FIELDS.reduce((config, field) => {
    const value = sanitize(field, overrides[field.path]);
    return value === undefined ? config : withPath(config, field.path.split('.'), value);
  }, base);
}

/** Solo los cambios válidos y distintos del valor por defecto (lo que vale la pena guardar). */
export function cleanOverrides(base, overrides = {}) {
  return Object.fromEntries(
    FIELDS.map((field) => [field.path, sanitize(field, overrides[field.path])]).filter(
      ([path, value]) => value !== undefined && value !== readPath(base, path),
    ),
  );
}
