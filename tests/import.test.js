import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parseAbsence, parseLineupPlayer, parseStandingLine } from '../js/adapters/common.js';
import { IMPORT_MODES, importMatches } from '../js/app/importMatches.js';
import { readFileSync } from 'node:fs';
import { buildSofascoreBookmarklet, buildSofascoreScript } from '../js/app/scriptBuilder.js';
import { detectFormat } from '../js/io/formatDetector.js';
import { IMPORT_ERRORS, ImportError } from '../js/io/importError.js';
import { rawMulti, rawSingle } from './fixtures/rawFactory.js';

const source = (root, name = 'test.json') => ({ name, text: JSON.stringify(root) });

describe('detectFormat', () => {
  it('distingue un partido (v2) de varios (v3/v4)', () => {
    assert.equal(detectFormat(rawSingle(), 'a').kind, 'single');
    assert.equal(detectFormat(rawMulti(), 'b').kind, 'multi');
  });

  it('rechaza JSON ajenos', () => {
    assert.throws(() => detectFormat({ hola: 1 }, 'x'), (error) => error instanceof ImportError && error.code === IMPORT_ERRORS.UNKNOWN_FORMAT);
  });
});

describe('importMatches', () => {
  it('adapta v2 al modelo interno', () => {
    const [match] = importMatches([source(rawSingle())]);
    assert.equal(match.title, 'Local FC vs Visita FC');
    assert.equal(match.home.position, 3);
    assert.equal(match.home.lineup.starters[0].position, 'G');
    assert.equal(match.home.lineup.absences[1].status, 'doubtful');
    assert.equal(match.home.current.length, 8);
    assert.equal(match.home.other.length, 2);
    assert.equal(match.odds.length, 7);
    assert.equal(match.standings.length, 2);
  });

  it('v2 usa el id de Sofascore si viene (para poder liquidarlo)', () => {
    assert.equal(importMatches([source({ ...rawSingle(), id: 16318042 })])[0].id, '16318042');
    const { id: _ignored, ...withoutId } = rawSingle();
    assert.match(importMatches([source(withoutId)])[0].id, /^v2-/);
  });

  it('orienta el H2H desde el local', () => {
    const [match] = importMatches([source(rawSingle())]);
    assert.deepEqual(
      match.h2h.map((row) => [row.isHome, row.goalsFor, row.goalsAgainst]),
      [
        [true, 2, 1],
        [false, 0, 0],
      ],
    );
  });

  it('adapta v4 con varios partidos y quita duplicados entre archivos', () => {
    const matches = importMatches([source(rawMulti(), 'a.json'), source(rawMulti(), 'b.json')]);
    assert.equal(matches.length, 2);
  });

  it('en modo "un partido" rechaza archivos con varios', () => {
    assert.throws(
      () => importMatches([source(rawMulti())], IMPORT_MODES.SINGLE),
      (error) => error.code === IMPORT_ERRORS.EXPECTED_SINGLE && error.params.count === 2,
    );
  });

  it('reporta JSON inválido y entrada vacía', () => {
    assert.throws(() => importMatches([{ name: 'x', text: '{malo' }]), (error) => error.code === IMPORT_ERRORS.INVALID_JSON);
    assert.throws(() => importMatches([{ name: 'x', text: '  ' }]), (error) => error.code === IMPORT_ERRORS.EMPTY_INPUT);
  });
});

describe('lectores de texto del script', () => {
  it('posición del jugador, bajas y tabla', () => {
    assert.deepEqual(parseLineupPlayer('Camilo Vargas (G)'), { name: 'Camilo Vargas', position: 'G' });
    assert.deepEqual(parseAbsence('Duk - missing: Knee Injury'), { name: 'Duk', status: 'missing', reason: 'Knee Injury' });
    assert.equal(parseStandingLine('1. Club América 24pts PJ11 7-3-1 GF27 GC14').goalsFor, 27);
  });
});

describe('buildSofascoreScript', () => {
  // Igual que el minificado real: (CFG=>{...})(__CFG__);
  const minified = "(CFG=>{window._resultado=CFG;console.log('%c[sofa]','color:red')})(__CFG__);";

  it('pone las ligas con su horario, el día y el modo en una sola línea', () => {
    const script = buildSofascoreScript(minified, {
      mode: 'historico',
      day: 'fecha',
      date: '2026-11-08',
      leagues: [{ name: "Ligue d'or", from: '18:00', to: '23:30' }, { name: '17' }, { name: '  ' }],
      from: '14:00',
      to: '',
      maxMatches: 30,
    });
    assert.ok(!script.includes('\n'));
    const window = {};
    new Function('window', 'console', script)(window, { log() {} });
    assert.deepEqual(window._resultado, {
      TORNEOS: [{ liga: "Ligue d'or", desde: '18:00', hasta: '23:30' }, 17],
      MODO: 'historico',
      FECHA: '2026-11-08',
      DIAS: 0,
      HORA_DESDE: '14:00',
      HORA_HASTA: null,
      MAX_PARTIDOS: 30,
    });
  });

  it('como marcador: empieza con javascript: y escribe el % como %25', () => {
    const bookmarklet = buildSofascoreBookmarklet(minified, { mode: 'proximos', day: 'hoy', leagues: [{ name: 'MLS' }] });
    assert.ok(bookmarklet.startsWith('javascript:'));
    assert.ok(bookmarklet.includes("'%25c[sofa]'"));
    assert.equal(decodeURIComponent(bookmarklet.slice('javascript:'.length)).includes("'%c[sofa]'"), true);
  });

  it('el minificado real tiene dónde poner la configuración y es JavaScript válido', () => {
    const real = readFileSync(new URL('../scripts/sofascore_v5.min.js', import.meta.url), 'utf8');
    assert.equal(real.trim().split('\n').length, 1);
    new Function(buildSofascoreScript(real, { mode: 'proximos', day: 'hoy', leagues: [{ name: 'MLS' }] }));
  });
});
