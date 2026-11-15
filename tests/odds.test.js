import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { legName, parseSurebets, splitStakes } from '../js/domain/surebets.js';
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

describe('fairProbabilities (razón de cuotas)', () => {
  it('suma lo esperado y le quita más margen a la cuota larga', () => {
    const odds = [1.2, 4.5];
    const fair = fairProbabilities(odds);
    assert.ok(Math.abs(fair[0] + fair[1] - 1) < 1e-9);
    const proportional = (1 / 4.5) / (1 / 1.2 + 1 / 4.5);
    assert.ok(fair[1] < proportional);
    assert.ok(fair[1] < 1 / 4.5);
  });

  it('doble oportunidad suma 2 y sin margen queda igual', () => {
    const fair = fairProbabilities([1.3, 1.25, 1.9], 2);
    assert.ok(Math.abs(fair.reduce((a, b) => a + b, 0) - 2) < 1e-9);
    assert.deepEqual(fairProbabilities([2, 2]), [0.5, 0.5]);
  });
});

describe('apuestas seguras', () => {
  it('reparte para ganar lo pedido en cualquier resultado', () => {
    const result = splitStakes([2.95, 1.76], 'win', 55, 0.01);
    assert.ok(result.margin > 0);
    assert.ok(result.profits.every((profit) => profit >= 55 - 0.01));
    const total = splitStakes([2.95, 1.76], 'total', 100, 0.01);
    assert.ok(Math.abs(total.total - 100) < 0.02);
    assert.ok(Math.abs(total.payouts[0] - total.payouts[1]) < 0.05);
  });

  it('lee el JSON del script y nombra las selecciones', () => {
    const data = parseSurebets(JSON.stringify({ seguras: [{ partido: 'A vs B', legs: [{ mk: '1X2', sel: '1', cuota: 2 }, { mk: 'DC', sel: 'X2', cuota: 2.1 }] }] }));
    assert.equal(data.safe.length, 1);
    assert.equal(legName({ mk: 'AH -0.5', sel: 'Visita' }, 'A vs B'), 'Hándicap B +0.5');
    assert.equal(legName({ mk: 'DC', sel: 'X2' }, 'A vs B'), 'Empate o B');
    assert.equal(legName({ mk: 'OU 2.5', sel: 'Más' }, 'A vs B'), 'Más de 2.5 goles');
    assert.throws(() => parseSurebets('{"hola":1}'));
  });
});
