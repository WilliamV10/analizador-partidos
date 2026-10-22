import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildQuoteIndex, classifyMarket, closestTotalMarket } from '../js/domain/marketCatalog.js';
import { parseMarketLine } from '../js/domain/odds.js';

const classify = (line) => classifyMarket(parseMarketLine(line));

describe('classifyMarket', () => {
  it('etiqueta el 1X2 por posición aunque las etiquetas vengan mal (script v3)', () => {
    const market = classify('1st half: X 7/4, X 15/8, 2 13/8');
    assert.equal(market.type, 'resultFirstHalf');
    assert.deepEqual(market.selections.map((s) => s.key), ['home', 'draw', 'away']);
  });

  it('reconoce líneas de goles', () => {
    const market = classify('Match goals 2.5: Over 13/20, Under 6/5');
    assert.equal(market.type, 'total');
    assert.equal(market.line, 2.5);
    assert.deepEqual(market.selections.map((s) => s.key), ['over', 'under']);
  });

  it('marca la doble oportunidad con suma justa 2', () => {
    assert.equal(classify('Double chance: 1X 4/5, X2 2/7, 12 2/7').fairTotal, 2);
  });

  it('deja como no soportado lo desconocido', () => {
    assert.equal(classify('Correct score: 1-0 6/1, 0-0 8/1').type, 'unsupported');
  });

  it('reconoce corners, tarjetas y hándicap asiático con su línea', () => {
    assert.equal(classify('Corners 2-Way 10.5: Over 1/1, Under 8/11').line, 10.5);
    assert.equal(classify('Cards in match 4.5: Over 1/1, Under 8/11').type, 'cards');
    assert.equal(classify('Asian handicap -0.25: (-0.25) Local 1/1, (0.25) Visita 8/11').line, -0.25);
  });
});

describe('closestTotalMarket', () => {
  it('elige la línea más cercana a 2.5', () => {
    const markets = ['Match goals 1.5: Over 1/5, Under 7/2', 'Match goals 3.5: Over 6/4, Under 1/2'].map(classify);
    assert.equal(closestTotalMarket(markets).line, 1.5);
  });
});

describe('buildQuoteIndex', () => {
  it('encuentra cuota y probabilidad justa por tipo, clave y línea', () => {
    const index = buildQuoteIndex([classify('Match goals 2.5: Over 1/1, Under 1/1')]);
    const quote = index.get('total', 'over', 2.5);
    assert.equal(quote.odds, 2);
    assert.equal(quote.fairProbability, 0.5);
    assert.equal(index.get('total', 'over', 3.5), null);
  });
});
