/**
 * Resúmenes estadísticos de un bloque de partidos (promedios y conteos).
 */
import { mean, weightedMean } from '../utils/math.js';
import { totalGoals } from './matchRows.js';
import {
  bothScored,
  countWhere,
  drew,
  failedToScore,
  keptCleanSheet,
  lost,
  overGoals,
  won,
} from './events.js';

/** Métricas promediables: nombre -> cómo leerla de una fila. */
const METRICS = Object.freeze({
  goalsFor: (row) => row.goalsFor,
  goalsAgainst: (row) => row.goalsAgainst,
  xgFor: (row) => row.stats.xg?.for,
  xgAgainst: (row) => row.stats.xg?.against,
  shotsFor: (row) => row.stats.shots?.for,
  shotsAgainst: (row) => row.stats.shots?.against,
  shotsOnTargetFor: (row) => row.stats.shotsOnTarget?.for,
  shotsOnTargetAgainst: (row) => row.stats.shotsOnTarget?.against,
  cornersFor: (row) => row.stats.corners?.for,
  cornersAgainst: (row) => row.stats.corners?.against,
  yellowsFor: (row) => row.stats.yellows?.for,
  yellowsAgainst: (row) => row.stats.yellows?.against,
});

/** Promedios por métrica. Las filas ajustadas traen `weight`; las demás pesan 1. */
function averages(rows) {
  return Object.fromEntries(
    Object.entries(METRICS).map(([name, read]) => [
      name,
      weightedMean(rows.map((row) => ({ value: read(row), weight: row.weight ?? 1 }))),
    ]),
  );
}

function overCounts(rows, lines) {
  return Object.fromEntries(lines.map((line) => [line, countWhere(rows, overGoals(line))]));
}

function totalsOf(rows, stat) {
  return rows
    .filter((row) => row.stats[stat])
    .map((row) => row.stats[stat].for + row.stats[stat].against);
}

/**
 * @typedef {Object} TeamSummary
 * @property {number} n
 * @property {number} wins
 * @property {number} draws
 * @property {number} losses
 * @property {Record<keyof METRICS, number|null>} avg
 * @property {number} btts
 * @property {number} cleanSheets
 * @property {number} failedToScore
 * @property {Record<number, number>} overs
 * @property {number[]} cornerTotals
 * @property {number[]} yellowTotals
 * @property {number} averageTotalGoals
 */

/**
 * @param {import('../types.js').TeamMatchRow[]} rows
 * @param {number[]} goalLines
 * @returns {TeamSummary|null}
 */
export function summarize(rows, goalLines) {
  if (!rows?.length) return null;
  return {
    n: rows.length,
    wins: countWhere(rows, won),
    draws: countWhere(rows, drew),
    losses: countWhere(rows, lost),
    avg: averages(rows),
    btts: countWhere(rows, bothScored),
    cleanSheets: countWhere(rows, keptCleanSheet),
    failedToScore: countWhere(rows, failedToScore),
    overs: overCounts(rows, goalLines),
    cornerTotals: totalsOf(rows, 'corners'),
    yellowTotals: totalsOf(rows, 'yellows'),
    averageTotalGoals: mean(rows.map(totalGoals)),
  };
}
