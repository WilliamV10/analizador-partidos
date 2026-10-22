import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { probabilityWhere, scoreGrid, totalGoalsDistribution } from '../js/domain/poisson.js';
import { outcomeProbabilities, overOutcome } from '../js/domain/probabilities.js';

const close = (actual, expected, tolerance = 1e-3) =>
  assert.ok(Math.abs(actual - expected) < tolerance, `${actual} ≉ ${expected}`);

describe('scoreGrid', () => {
  it('suma 1', () => {
    const grid = scoreGrid(1.6, 1.1, 10);
    close(grid.cells.flat().reduce((a, b) => a + b, 0), 1, 1e-12);
  });

  it('es simétrica con λ iguales', () => {
    const grid = scoreGrid(1.3, 1.3, 10);
    close(probabilityWhere(grid, (h, a) => h > a), probabilityWhere(grid, (h, a) => h < a), 1e-12);
  });

  it('ambos anotan coincide con la fórmula cerrada', () => {
    const grid = scoreGrid(1.25, 1.75, 10);
    close(probabilityWhere(grid, (h, a) => h > 0 && a > 0), (1 - Math.exp(-1.25)) * (1 - Math.exp(-1.75)));
  });
});

describe('outcomeProbabilities', () => {
  const display = { goalLines: [0.5, 1.5, 2.5], topScores: 3 };
  const probabilities = outcomeProbabilities(scoreGrid(1.25, 1.7, 10), display);

  it('1X2 suma 1 y la doble oportunidad es consistente', () => {
    const { home, draw, away } = probabilities.result;
    close(home + draw + away, 1, 1e-12);
    close(probabilities.doubleChance.homeDraw, home + draw, 1e-12);
  });

  it('el primer gol más "sin goles" suma 1', () => {
    const { home, none, away } = probabilities.firstGoal;
    close(home + none + away, 1, 1e-12);
  });

  it('el marcador más probable con (1.25, 1.70) es 1-1', () => {
    assert.deepEqual([probabilities.topScores[0].home, probabilities.topScores[0].away], [1, 1]);
  });
});

describe('overOutcome', () => {
  it('en línea entera hay devolución', () => {
    const distribution = totalGoalsDistribution(scoreGrid(1.4, 1.2, 10));
    const outcome = overOutcome(distribution, 2);
    assert.ok(outcome.push > 0);
    close(outcome.win + outcome.push + outcome.loss, 1, 1e-12);
  });
});
