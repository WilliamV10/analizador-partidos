import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { CONFIG } from '../js/config.js';
import { blendLambdas, fitMarketLambdas, statsLambdas } from '../js/domain/lambdas.js';
import { scoreGrid } from '../js/domain/poisson.js';
import { outcomeProbabilities } from '../js/domain/probabilities.js';

const summary = (n, goalsFor, goalsAgainst, xgFor = goalsFor, xgAgainst = goalsAgainst) => ({
  n,
  avg: { goalsFor, goalsAgainst, xgFor, xgAgainst },
});

describe('fitMarketLambdas', () => {
  it('recupera los λ que generaron las probabilidades', () => {
    const truth = { home: 1.4, away: 1.1 };
    const probabilities = outcomeProbabilities(scoreGrid(truth.home, truth.away, 10), { goalLines: [2.5], topScores: 1 });
    const targets = { ...probabilities.result, totalLine: 2.5, over: probabilities.overs[2.5] };
    const fitted = fitMarketLambdas(targets, CONFIG.lambda.fit, CONFIG.poisson.maxGoals);
    assert.ok(Math.abs(fitted.home - truth.home) <= 0.02, `home ${fitted.home}`);
    assert.ok(Math.abs(fitted.away - truth.away) <= 0.02, `away ${fitted.away}`);
  });
});

describe('statsLambdas', () => {
  const config = { ...CONFIG.lambda, venueSplitWeight: 0 };

  it('cruza ataque propio con defensa rival y aplica localía', () => {
    const lambdas = statsLambdas(
      { recent: summary(10, 2, 1), venue: null },
      { recent: summary(10, 1, 2), venue: null },
      config,
    );
    assert.equal(lambdas.home, 2 * config.homeAdvantage);
    assert.equal(lambdas.away, 1 * config.awayDisadvantage);
  });

  it('usa el split casa/fuera solo si hay muestra suficiente', () => {
    const withVenue = { ...CONFIG.lambda, venueSplitWeight: 0.5 };
    const home = { recent: summary(10, 1, 1), venue: summary(5, 3, 1) };
    const away = { recent: summary(10, 1, 1), venue: summary(5, 1, 3) };
    const lambdas = statsLambdas(home, away, withVenue);
    assert.equal(lambdas.home, 0.5 * 1 * withVenue.homeAdvantage + 0.5 * 3);
    const small = statsLambdas({ ...home, venue: summary(2, 3, 1) }, away, withVenue);
    assert.equal(small.home, 1 * withVenue.homeAdvantage);
  });

  it('cae al valor por defecto sin datos', () => {
    const lambdas = statsLambdas({ recent: null, venue: null }, { recent: null, venue: null }, config);
    assert.equal(lambdas.home, config.fallbackGoals);
  });
});

describe('blendLambdas', () => {
  it('pondera mercado y estadísticas', () => {
    const blended = blendLambdas({ home: 1, away: 1 }, { home: 2, away: 0 }, 0.6);
    assert.ok(Math.abs(blended.home - 1.6) < 1e-12);
    assert.ok(Math.abs(blended.away - 0.4) < 1e-12);
  });

  it('sin mercado usa solo estadísticas', () => {
    assert.deepEqual(blendLambdas({ home: 1.2, away: 0.9 }, null, 0.6), { home: 1.2, away: 0.9 });
  });
});
