import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { fairProbabilities, overround, parseMarketLine, parseMarketLines, toDecimalOdds } from '../js/domain/odds.js';

describe('toDecimalOdds', () => {
  it('convierte fraccionales a decimal (fracción + 1)', () => {
    assert.equal(toDecimalOdds('5/2'), 3.5);
    assert.equal(toDecimalOdds('24/25'), 1.96);
    assert.equal(toDecimalOdds('1/1'), 2);
  });

  it('acepta decimales y "Evens"', () => {
    assert.equal(toDecimalOdds('2.10'), 2.1);
    assert.equal(toDecimalOdds('Evens'), 2);
  });

  it('devuelve null en valores inválidos', () => {
    assert.equal(toDecimalOdds('abc'), null);
    assert.equal(toDecimalOdds('1/0'), null);
    assert.equal(toDecimalOdds('0.9'), null);
  });
});

describe('parseMarketLine', () => {
  it('separa nombre y selecciones, incluso con nombres de equipo con espacios', () => {
    const market = parseMarketLine('First team to score: Atlas FC 6/5, No goal 14/1, Club América 8/11');
    assert.equal(market.name, 'First team to score');
    assert.deepEqual(
      market.selections.map((selection) => selection.label),
      ['Atlas FC', 'No goal', 'Club América'],
    );
    assert.equal(market.selections[0].odds, 2.2);
  });

  it('devuelve null si no hay ": "', () => {
    assert.equal(parseMarketLine('basura'), null);
  });
});

describe('parseMarketLines', () => {
  it('ante mercados repetidos se queda el último y los reporta', () => {
    const { markets, duplicates } = parseMarketLines([
      'Full time: 1 1/5, X 5/1, 2 14/1',
      'Full time: 1 21/50, X 4/1, 2 11/2',
    ]);
    assert.equal(markets.length, 1);
    assert.equal(markets[0].selections[0].odds, 1.42);
    assert.deepEqual(duplicates, ['Full time']);
  });
});

describe('fairProbabilities', () => {
  it('quita el margen y suma 1', () => {
    const fair = fairProbabilities([3.5, 3.6, 1.96]);
    assert.ok(Math.abs(fair.reduce((a, b) => a + b, 0) - 1) < 1e-12);
    assert.ok(overround([3.5, 3.6, 1.96]) > 0);
  });

  it('en doble oportunidad suma 2', () => {
    const fair = fairProbabilities([1.8, 1.29, 1.29], 2);
    assert.ok(Math.abs(fair.reduce((a, b) => a + b, 0) - 2) < 1e-12);
  });
});
