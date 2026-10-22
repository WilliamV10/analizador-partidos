/**
 * Modelo de Poisson independiente para el marcador.
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
 * Grilla de marcadores: cells[h][a] = P(local h, visita a), normalizada a 1.
 * @returns {{ homeLambda: number, awayLambda: number, cells: number[][] }}
 */
export function scoreGrid(homeLambda, awayLambda, maxGoals) {
  const home = poissonVector(homeLambda, maxGoals);
  const away = poissonVector(awayLambda, maxGoals);
  const cells = home.map((ph) => away.map((pa) => ph * pa));
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
