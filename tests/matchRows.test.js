import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { isAnomalous, parseNumberPair, parseScoreLine, toTeamRow } from '../js/domain/matchRows.js';
import { rawPastMatch } from './fixtures/rawFactory.js';

describe('parseScoreLine', () => {
  it('lee equipos y goles', () => {
    assert.deepEqual(parseScoreLine('Club Necaxa 0-2 Atlas FC'), {
      homeName: 'Club Necaxa',
      homeGoals: 0,
      awayGoals: 2,
      awayName: 'Atlas FC',
    });
  });

  it('no se confunde con números en el nombre del equipo', () => {
    const score = parseScoreLine('Schalke 04 2-1 VfL Bochum');
    assert.equal(score.homeName, 'Schalke 04');
    assert.equal(score.homeGoals, 2);
  });
});

describe('parseNumberPair', () => {
  it('lee decimales y porcentajes', () => {
    assert.deepEqual(parseNumberPair('1.81-2.18'), [1.81, 2.18]);
    assert.deepEqual(parseNumberPair('49%-51%'), [49, 51]);
    assert.equal(parseNumberPair('n/a'), null);
  });
});

describe('toTeamRow', () => {
  const raw = rawPastMatch({ home: 'A', away: 'B', score: '0-2', side: 'visita', halfTime: '0-1', stats: { 'ALL Corner kicks': '10-6' } });

  it('voltea goles y stats cuando el equipo jugó de visita', () => {
    const row = toTeamRow(raw, { isHome: false, block: 'current' });
    assert.equal(row.goalsFor, 2);
    assert.equal(row.goalsAgainst, 0);
    assert.equal(row.htGoalsFor, 1);
    assert.deepEqual(row.stats.corners, { for: 6, against: 10 });
    assert.equal(row.opponent, 'A');
  });

  it('devuelve null si no hay marcador', () => {
    assert.equal(toTeamRow({ partido: 'A vs B' }, { isHome: true, block: 'current' }), null);
  });
});

describe('isAnomalous', () => {
  it('detecta marcadores de penales', () => {
    assert.equal(isAnomalous({ goalsFor: 11, goalsAgainst: 9 }, 12), true);
    assert.equal(isAnomalous({ goalsFor: 5, goalsAgainst: 3 }, 12), false);
  });
});
