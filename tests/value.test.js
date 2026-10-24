import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { CONFIG } from '../js/config.js';
import { blendWithEmpirical, empiricalRate } from '../js/domain/empirical.js';
import { TIERS, confidenceTier, expectedValue, winProbability } from '../js/domain/value.js';

describe('expectedValue / winProbability', () => {
  it('la devolución (empate no apuesta) no suma ni resta', () => {
    const outcome = { win: 0.45, push: 0.25, loss: 0.3 };
    assert.ok(Math.abs(expectedValue(outcome, 2) - (0.45 - 0.3)) < 1e-12);
    assert.ok(Math.abs(winProbability(outcome) - 0.6) < 1e-12);
  });
});

describe('confidenceTier', () => {
  const base = { odds: 1.8, probability: 0.6, gap: 0.02, sample: 20, maxGap: 0.1, capWhenInconsistent: TIERS.MEDIUM };

  it('sin valor si el EV no es positivo', () => {
    assert.equal(confidenceTier({ ...base, ev: -0.01 }, CONFIG.value), TIERS.NONE);
  });

  it('sin valor en cuotas largas o demasiado cortas', () => {
    assert.equal(confidenceTier({ ...base, ev: 0.3, probability: 0.1, odds: 12 }, CONFIG.value), TIERS.NONE);
    assert.equal(confidenceTier({ ...base, ev: 0.02, probability: 0.97, odds: 1.05 }, CONFIG.value), TIERS.NONE);
  });

  it('alta con EV alto, muestra suficiente y fuentes de acuerdo', () => {
    assert.equal(confidenceTier({ ...base, ev: 0.1 }, CONFIG.value), TIERS.HIGH);
  });

  it('se limita cuando las fuentes no coinciden', () => {
    assert.equal(confidenceTier({ ...base, ev: 0.1, gap: 0.3 }, CONFIG.value), TIERS.MEDIUM);
    assert.equal(
      confidenceTier({ ...base, ev: 0.1, gap: 0.3, capWhenInconsistent: TIERS.LOW }, CONFIG.value),
      TIERS.LOW,
    );
  });

  it('media o media-baja según el EV', () => {
    assert.equal(confidenceTier({ ...base, ev: 0.05 }, CONFIG.value), TIERS.MEDIUM);
    assert.equal(confidenceTier({ ...base, ev: 0.01 }, CONFIG.value), TIERS.LOW);
  });
});

describe('empírico', () => {
  const rows = (pattern) => pattern.split('').map((char) => ({ hit: char === '1' }));
  const predicate = (row) => row.hit;

  it('pondera el H2H', () => {
    const rate = empiricalRate([
      { rows: rows('1100'), predicate, weight: 1 },
      { rows: rows('11'), predicate, weight: 0.5 },
    ]);
    assert.equal(rate.n, 5);
    assert.equal(rate.rate, 3 / 5);
  });

  it('el peso de lo empírico tiene tope', () => {
    const estimate = blendWithEmpirical(0.5, { rate: 1, n: 1000 }, CONFIG.empirical);
    assert.equal(estimate.weight, CONFIG.empirical.maxWeight);
    assert.ok(Math.abs(estimate.final - (0.5 + 0.5 * CONFIG.empirical.maxWeight)) < 1e-9);
  });

  it('sin datos devuelve el modelo', () => {
    assert.equal(blendWithEmpirical(0.42, { rate: null, n: 0 }, CONFIG.empirical).final, 0.42);
  });
});
