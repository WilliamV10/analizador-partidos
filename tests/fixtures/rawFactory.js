/**
 * Fábrica de JSON crudos con la misma forma que generan los scripts de Sofascore.
 * Los tests usan datos sintéticos (pequeños y legibles) en lugar de archivos reales.
 */

/** Un partido pasado tal como lo exporta el script ("Local 2-1 Visita" + stats local-visita). */
export function rawPastMatch({ home, away, score, halfTime = '0-0', side, competition = 'Liga Test', date = '2026-09-01', stats = {} }) {
  return {
    competicion: competition,
    temporada: `${competition} 2026`,
    fecha: date,
    condicion: side,
    partido: `${home} ${score} ${away}`,
    descanso: halfTime,
    stats: {
      'ALL Ball possession': '55%-45%',
      'ALL Expected goals': '1.50-0.90',
      'ALL Total shots': '14-9',
      'ALL Corner kicks': '6-4',
      'ALL Yellow cards': '2-3',
      'ALL Shots on target': '5-3',
      '1ST Corner kicks': '3-2',
      ...stats,
    },
  };
}

/** Historial de un equipo: alterna local/visita contra rivales genéricos. */
export function rawHistory(teamName, scores, competition = 'Liga Test') {
  return scores.map((score, index) => {
    const isHome = index % 2 === 0;
    const [teamGoals, rivalGoals] = score.split('-');
    const rival = `Rival ${index + 1}`;
    return rawPastMatch({
      home: isHome ? teamName : rival,
      away: isHome ? rival : teamName,
      score: isHome ? `${teamGoals}-${rivalGoals}` : `${rivalGoals}-${teamGoals}`,
      side: isHome ? 'local' : 'visita',
      competition,
      date: `2026-09-${String(30 - index).padStart(2, '0')}`,
    });
  });
}

/** Un partido completo con la forma de v2 (raíz) o de cada elemento de v4.partidos. */
export function rawMatch({
  id = 1001,
  home = 'Local FC',
  away = 'Visita FC',
  confirmed = false,
  status = 'Not started',
  homeScores = ['2-0', '1-1', '3-1', '0-1', '2-2', '1-0', '2-1', '0-0'],
  awayScores = ['1-1', '0-2', '1-0', '2-2', '0-1', '1-3', '1-1', '2-0'],
  odds = [
    'Full time: 1 6/5, X 12/5, 2 5/2',
    'Double chance: 1X 2/5, X2 4/5, 12 2/7',
    'Draw no bet: 1 4/6, 2 6/5',
    'Both teams to score: Yes 4/5, No 1/1',
    'Match goals 2.5: Over 10/11, Under 10/11',
    'Match goals 3.5: Over 2/1, Under 2/5',
    'First team to score: Local FC 8/11, No goal 12/1, Visita FC 6/5',
  ],
} = {}) {
  return {
    id,
    partido: `${home} vs ${away}`,
    torneo: 'Liga Test',
    tablaDe: 'Liga Test',
    jornada: 10,
    hora: '21/10/2026, 19:00:00',
    estado: status,
    marcador: '---',
    arbitro: 'Árbitro Test',
    estadio: 'Estadio Test',
    forma: {
      homeTeam: { position: 3, form: ['W', 'D', 'W', 'L', 'W'] },
      awayTeam: { position: 9, form: ['L', 'D', 'W', 'D', 'L'] },
    },
    alineacionesConfirmadas: confirmed,
    alineacionLocal: {
      formation: '4-3-3',
      titulares: ['Portero Local (G)', 'Defensa Uno (D)', 'Delantero Estrella (F)'],
      suplentes: ['Suplente Uno'],
      bajas: ['Lesionado Local - missing: Knee Injury', 'Dudoso Local - doubtful: Muscle Injury'],
    },
    alineacionVisita: { formation: '4-4-2', titulares: ['Portero Visita (G)'], suplentes: [], bajas: [] },
    cuotas: odds,
    local: {
      partidos: rawHistory(home, homeScores),
      partidosTempPasada: rawHistory(home, ['11-9', '1-0'], 'Liga Test'),
      ligaNombre: 'Copa Test',
      partidosLiga: rawHistory(home, ['2-1', '1-1'], 'Copa Test'),
      jugadores: [{ nombre: 'Delantero Estrella', pj: 8, titular: 8, min: 700, tirosPuerta: 14, tiros: 30, goles: 6, xG: 5.2, asist: 1 }],
    },
    visita: {
      partidos: rawHistory(away, awayScores),
      partidosTempPasada: [],
      jugadores: [],
    },
    h2h: [
      { fecha: '2026-03-01', torneo: 'Liga Test', partido: `${home} 2-1 ${away}`, descanso: '1-0', stats: { 'ALL Corner kicks': '7-3' } },
      { fecha: '2025-09-01', torneo: 'Liga Test', partido: `${away} 0-0 ${home}`, descanso: '0-0', stats: {} },
    ],
  };
}

export const STANDINGS = ['1. Líder FC 30pts PJ12 9-3-0 GF25 GC8', '3. Local FC 22pts PJ12 6-4-2 GF18 GC12'];

export function rawSingle(options) {
  return { version: 2, ...rawMatch(options), posiciones: STANDINGS };
}

export function rawMulti(matchesOptions = [{}, { id: 1002, home: 'Otro Local', away: 'Otra Visita' }]) {
  return {
    version: 4,
    generado: '2026-10-21T10:00:00Z',
    filtros: { fecha: '2026-10-21', torneo: 'Liga Test', hora: 'todas' },
    posiciones: { 'Liga Test': STANDINGS },
    partidos: matchesOptions.map((options) => rawMatch(options)),
  };
}
