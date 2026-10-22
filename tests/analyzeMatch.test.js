import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { importMatches } from '../js/app/importMatches.js';
import { ALERT_CODES } from '../js/domain/alerts.js';
import { analyzeMatch } from '../js/domain/analyzeMatch.js';
import { rawSingle } from './fixtures/rawFactory.js';

const analyze = (options) => analyzeMatch(importMatches([{ name: 't', text: JSON.stringify(rawSingle(options)) }])[0]);

describe('analyzeMatch (integración)', () => {
  const analysis = analyze();

  it('calcula λ de estadísticas, de mercado y final', () => {
    const { stats, market, final } = analysis.lambdas;
    assert.ok(stats.home > 0 && stats.away > 0);
    assert.ok(market.home > 0 && market.away > 0);
    assert.ok(final.home > Math.min(stats.home, market.home) - 1e-9);
    assert.ok(final.home < Math.max(stats.home, market.home) + 1e-9);
  });

  it('las probabilidades 1X2 suman 1', () => {
    const { home, draw, away } = analysis.probabilities.result;
    assert.ok(Math.abs(home + draw + away - 1) < 1e-9);
  });

  it('ordena los picks por EV de mayor a menor', () => {
    const evs = analysis.picks.map((pick) => pick.ev);
    assert.deepEqual(evs, [...evs].sort((a, b) => b - a));
    assert.ok(analysis.picks.length > 0);
  });

  it('excluye el 11-9 de penales y lo avisa', () => {
    const codes = analysis.alerts.map((alert) => alert.code);
    assert.ok(codes.includes(ALERT_CODES.ANOMALOUS_EXCLUDED));
    assert.ok(codes.includes(ALERT_CODES.LINEUPS_NOT_CONFIRMED));
    assert.equal(analysis.summaries.home.previous.n, 1);
  });

  it('sin cuotas usa solo estadísticas y lo avisa', () => {
    const withoutOdds = analyze({ odds: [] });
    assert.equal(withoutOdds.lambdas.market, null);
    assert.deepEqual(withoutOdds.lambdas.final, withoutOdds.lambdas.stats);
    assert.ok(withoutOdds.alerts.some((alert) => alert.code === ALERT_CODES.NO_RESULT_ODDS));
  });

  it('avisa si el partido ya empezó', () => {
    const live = analyze({ status: '1st half', confirmed: true });
    assert.ok(live.alerts.some((alert) => alert.code === ALERT_CODES.MATCH_STARTED));
    assert.ok(!live.alerts.some((alert) => alert.code === ALERT_CODES.LINEUPS_NOT_CONFIRMED));
  });
});
