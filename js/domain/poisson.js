/**
 * Modelo de Poisson para el marcador, con la corrección de Dixon-Coles:
 * dos Poisson independientes subestiman el 0-0 y el 1-1 y sobrestiman el 1-0 y el 0-1.
 * El factor τ(rho) corrige solo esas cuatro celdas (rho < 0 = más empates bajos).
 */

/** Probabilidades P(0..maxGoals) de una Poisson con media lambda. */
export function poissonVector(lambda, maxGoals) {
  const probabilities = [];
  let probability = Math.exp(-lambda);
  for (let goals = 0; goals <= maxGoals; goals += 1) {
    probabilities.push(probability);
    probability *= lambda / (goals + 1);
  }
  return probabilities;
}

/**
 * Factor de Dixon-Coles para el marcador (h, a). Vale 1 fuera de 0-0, 1-0, 0-1 y 1-1;
 * nunca es negativo.
 */
export function dixonColesTau(homeGoals, awayGoals, homeLambda, awayLambda, rho) {
  if (!rho || homeGoals > 1 || awayGoals > 1) return 1;
  let tau = 1;
  if (homeGoals === 0 && awayGoals === 0) tau = 1 - homeLambda * awayLambda * rho;
  else if (homeGoals === 0) tau = 1 + homeLambda * rho;
  else if (awayGoals === 0) tau = 1 + awayLambda * rho;
  else tau = 1 - rho;
  return Math.max(0, tau);
}

/**
 * Grilla de marcadores: cells[h][a] = P(local h, visita a), normalizada a 1.
 * @param {number} [rho=0]  corrección de Dixon-Coles (0 = Poisson independiente)
 * @returns {{ homeLambda: number, awayLambda: number, cells: number[][] }}
 */
export function scoreGrid(homeLambda, awayLambda, maxGoals, rho = 0) {
  const home = poissonVector(homeLambda, maxGoals);
  const away = poissonVector(awayLambda, maxGoals);
  const cells = home.map((ph, h) =>
    away.map((pa, a) => ph * pa * dixonColesTau(h, a, homeLambda, awayLambda, rho)),
  );
  const total = cells.flat().reduce((acc, value) => acc + value, 0);
  return {
    homeLambda,
    awayLambda,
    cells: cells.map((row) => row.map((value) => value / total)),
  };
}

/** Suma de las celdas que cumplen el predicado (homeGoals, awayGoals) => boolean. */
export function probabilityWhere(grid, predicate) {
  let total = 0;
  grid.cells.forEach((row, homeGoals) => {
    row.forEach((probability, awayGoals) => {
      if (predicate(homeGoals, awayGoals)) total += probability;
    });
  });
  return total;
}

/** Distribución del total de goles: dist[t] = P(total = t). */
export function totalGoalsDistribution(grid) {
  const distribution = [];
  grid.cells.forEach((row, homeGoals) => {
    row.forEach((probability, awayGoals) => {
      const total = homeGoals + awayGoals;
      distribution[total] = (distribution[total] ?? 0) + probability;
    });
  });
  return distribution;
}
