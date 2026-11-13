import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { CONFIG } from '../js/config.js';
import { blendWithEmpirical, empiricalRate } from '../js/domain/empirical.js';
import { suggestModelWeights } from '../js/domain/calibration.js';
import { isProbableCandidate } from '../js/domain/combos.js';
import { isForecastWorthy } from '../js/domain/history.js';
import { TIERS, confidenceTier, expectedValue, shrinkToMarket, winProbability } from '../js/domain/value.js';

describe('expectedValue / winProbability', () => {
  it('la devolución (empate no apuesta) no suma ni resta', () => {
    const outcome = { win: 0.45, push: 0.25, loss: 0.3 };
    assert.ok(Math.abs(expectedValue(outcome, 2) - (0.45 - 0.3)) < 1e-12);
    assert.ok(Math.abs(winProbability(outcome) - 0.6) < 1e-12);
  });
});

describe('shrinkToMarket', () => {
  it('mezcla la probabilidad de ganar con la de la casa y deja igual la devolución', () => {
    const shrunk = shrinkToMarket({ win: 0.45, push: 0.25, loss: 0.3 }, 0.5, 0.5);
    assert.ok(Math.abs(winProbability(shrunk) - (0.5 * 0.6 + 0.5 * 0.5)) < 1e-12);
    assert.equal(shrunk.push, 0.25);
    assert.ok(Math.abs(shrunk.win + shrunk.loss - 0.75) < 1e-12);
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

  it('sin valor si el modelo se aleja demasiado de la casa o es poco probable', () => {
    assert.equal(confidenceTier({ ...base, ev: 0.3, edge: CONFIG.value.maxEdge + 0.01 }, CONFIG.value), TIERS.NONE);
    assert.equal(confidenceTier({ ...base, ev: 0.6, probability: 0.44, odds: 3.75 }, CONFIG.value), TIERS.NONE);
  });

  it('media o media-baja según el EV', () => {
    const { highEv, mediumEv } = CONFIG.value;
    assert.equal(confidenceTier({ ...base, ev: (highEv + mediumEv) / 2 }, CONFIG.value), TIERS.MEDIUM);
    assert.equal(confidenceTier({ ...base, ev: mediumEv / 2 }, CONFIG.value), TIERS.LOW);
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

describe('suggestModelWeights', () => {
  // La casa acierta (lo que dice pasa) y el modelo se pasa de seguro: conviene pesar menos al modelo.
  const records = Array.from({ length: 400 }, (_, index) => {
    const won = index % 10 < 6;
    return {
      market: { type: 'result', line: null },
      settlement: { status: won ? 'win' : 'loss' },
      modelProbability: 0.85,
      fairProbability: 0.6,
      probability: 0.7,
      analyzedAt: Date.now(),
    };
  });

  it('sugiere bajar el peso del modelo donde la casa acierta mejor', () => {
    const result = suggestModelWeights(records, CONFIG.value).find((row) => row.group === 'result');
    assert.equal(result.best, 0);
    assert.ok(result.suggested < CONFIG.value.modelWeight.result);
    assert.ok(result.improvement > 0);
  });

  it('con pocos datos no sugiere nada', () => {
    const result = suggestModelWeights(records.slice(0, 20), CONFIG.value).find((row) => row.group === 'result');
    assert.equal(result.suggested, null);
  });
});

describe('isProbableCandidate', () => {
  const pick = { market: { type: 'doubleChance', line: null }, odds: 1.3, probability: 0.7, ev: -0.09 };

  it('deja fuera lo probable que paga mucho menos de lo justo', () => {
    assert.equal(isProbableCandidate(pick, CONFIG.probable), false);
    assert.equal(isProbableCandidate({ ...pick, ev: -0.01 }, CONFIG.probable), true);
    assert.equal(isProbableCandidate(pick, { ...CONFIG.probable, minEv: -1 }), true);
  });
});

describe('isForecastWorthy', () => {
  it('descarta los pronósticos que la casa ve por debajo de 40 % o con cuota menor a 1.10', () => {
    assert.equal(isForecastWorthy({ probability: 0.45, fairProbability: 0.38, odds: 2.4 }), false);
    assert.equal(isForecastWorthy({ probability: 0.92, fairProbability: 0.9, odds: 1.05 }), false);
    assert.equal(isForecastWorthy({ probability: 0.6, fairProbability: 0.55, odds: 1.7 }), true);
    assert.equal(isForecastWorthy({ probability: 0.42, fairProbability: null, odds: null }), true);
  });
});
