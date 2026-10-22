/**
 * Eventos de un partido evaluados sobre una fila (perspectiva del equipo).
 * Se usan para contar lo ocurrido realmente (porcentajes empíricos).
 */
import { totalGoals } from './matchRows.js';

export const won = (row) => row.goalsFor > row.goalsAgainst;
export const drew = (row) => row.goalsFor === row.goalsAgainst;
export const lost = (row) => row.goalsFor < row.goalsAgainst;
export const bothScored = (row) => row.goalsFor > 0 && row.goalsAgainst > 0;
export const scored = (row) => row.goalsFor > 0;
export const conceded = (row) => row.goalsAgainst > 0;
export const keptCleanSheet = (row) => row.goalsAgainst === 0;
export const failedToScore = (row) => row.goalsFor === 0;
export const overGoals = (line) => (row) => totalGoals(row) > line;

export function countWhere(rows, predicate) {
  return rows.filter(predicate).length;
}
