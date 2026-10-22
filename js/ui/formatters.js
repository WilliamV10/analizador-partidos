/**
 * Formato de números y fechas para la interfaz.
 */
import { isFiniteNumber } from '../utils/math.js';

export const EMPTY = '—';

export function percent(probability, digits = 0) {
  return isFiniteNumber(probability) ? `${(probability * 100).toFixed(digits)}%` : EMPTY;
}

export function signedPercent(value, digits = 1) {
  if (!isFiniteNumber(value)) return EMPTY;
  const formatted = (value * 100).toFixed(digits);
  return `${value > 0 ? '+' : ''}${formatted}%`;
}

export function odds(value) {
  return isFiniteNumber(value) ? value.toFixed(2) : EMPTY;
}

export function decimal(value, digits = 2) {
  return isFiniteNumber(value) ? value.toFixed(digits) : EMPTY;
}

/** "7 de 12" */
export function countOf(count, total) {
  return isFiniteNumber(total) && total > 0 ? `${count}/${total}` : EMPTY;
}

const KICKOFF = /^(\d{1,2})\/(\d{1,2})\/(\d{4}),\s*(\d{1,2}):(\d{2})/;

/** "21/10/2026, 19:00:00" -> { date: '21/10', time: '19:00' } (null si no se reconoce). */
export function kickoffParts(text) {
  const match = String(text ?? '').match(KICKOFF);
  if (!match) return null;
  const [, day, month, , hour, minute] = match;
  return { date: `${day}/${month}`, time: `${hour.padStart(2, '0')}:${minute}` };
}

/** "21/10/2026, 19:00:00" -> "21/10 19:00" */
export function kickoff(text) {
  const parts = kickoffParts(text);
  return parts ? `${parts.date} ${parts.time}` : text ?? EMPTY;
}
