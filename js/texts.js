/**
 * Todos los textos visibles de la interfaz, en español.
 * Ningún renderer escribe texto "a mano": lo toma de aquí.
 */

const plural = (n, singular, pluralForm) => (n === 1 ? singular : pluralForm);

const TIER_NAMES = { high: 'Alta', medium: 'Media', low: 'Media-baja', none: 'Sin valor' };

export const TEXTS = Object.freeze({
  app: {
    disclaimer: 'Son probabilidades, no certezas. Apuesta solo lo que estés dispuesto a perder.',
  },
  theme: {
    auto: { icon: '🌗', label: 'Tema: automático (toca para claro)' },
    light: { icon: '☀️', label: 'Tema: claro (toca para oscuro)' },
    dark: { icon: '🌙', label: 'Tema: oscuro (toca para automático)' },
  },
  a11y: {
    resultBar: (names, { home, draw, away }) =>
      `${names.home} ${Math.round(home * 100)}%, empate ${Math.round(draw * 100)}%, ${names.away} ${Math.round(away * 100)}%`,
    matchTabs: 'Secciones del partido',
    views: 'Vistas',
  },
  loader: {
    pastedSource: 'texto pegado',
    loaded: (count) => `${count} ${plural(count, 'partido analizado', 'partidos analizados')}.`,
    summary: (analyses) => {
      const tournaments = [...new Set(analyses.map((analysis) => analysis.match.tournament).filter(Boolean))];
      const count = `${analyses.length} ${plural(analyses.length, 'partido', 'partidos')}`;
      return tournaments.length ? `${count} · ${tournaments.join(', ')}` : count;
    },
    filesSelected: (names) => `Archivos: ${names.join(', ')}`,
    working: 'Analizando…',
  },
  views: {
    day: 'Resumen',
    match: 'Partidos',
    picks: 'Picks',
    combos: 'Combinadas',
  },
  matchTabs: {
    overview: 'Resumen',
    value: 'Valor',
    markets: 'Goles y 1X2',
    counts: 'Corners y tarjetas',
    players: 'Jugadores',
    teams: 'Equipos',
    lineups: 'Alineaciones',
  },
  extra: {
    halfTime: 'Primer tiempo',
    halfTimeNote: ({ share, sample }) =>
      `λ 1er tiempo = λ × ${Math.round(share * 100)}% (goles antes del descanso; muestra: ${Math.round(sample)} goles).`,
    handicap: 'Hándicap asiático',
    handicapHead: (home) => `Línea ${home}`,
    handicapLine: (line) => (line > 0 ? `+${line}` : String(line)),
    handicapNote:
      'Probabilidad de ganar sin contar la devolución. Las líneas de cuarto (±0.25, ±0.75) se dividen en dos medias apuestas. ' +
      'Resaltadas: las que tienen cuota.',
    corners: 'Corners',
    teamCorners: 'Corners por equipo',
    firstHalfCorners: 'Corners del 1er tiempo',
    overCorners: (line) => `Más de ${line} corners`,
    teamOverCorners: (team, line) => `${team} más de ${line}`,
    cards: 'Tarjetas amarillas',
    teamCards: 'Amarillas por equipo',
    overCards: (line) => `Más de ${line} amarillas`,
    teamOverCards: (team, line) => `${team} más de ${line}`,
    expected: (total, names, home, away) => `Esperado: ${total} (${names.home} ${home} · ${names.away} ${away}).`,
    countNote:
      'Esperado = promedio de lo que produce cada equipo en su condición y lo que concede el rival en la suya. ' +
      'Modelo = binomial negativa (más variable que Poisson). Real = local en casa y visita fuera.',
    cardsNote: 'El JSON no trae datos del árbitro ni de rojas: se usan solo amarillas.',
    noData: 'El JSON no trae esta estadística para estos equipos.',
  },
  players: {
    player: 'Jugador',
    minutes: "Min.",
    sotOne: 'TaP 1+',
    sotTwo: 'TaP 2+',
    shotsOne: 'Tiros 1+',
    shotsTwo: 'Tiros 2+',
    sotPer90: 'TaP/90',
    goalsXg: 'Goles (xG)',
    empty: 'El JSON no trae jugadores de este equipo.',
    note: (config) =>
      `TaP = tiros a puerta. Minutos esperados: titular ${config.minutes.starter}', suplente ${config.minutes.bench}', ` +
      `duda ${config.minutes.doubtful}'. Ajustado por lo que concede el rival. ` +
      `Con menos de ${config.shrinkMinutes}' jugados, el ritmo se acerca a la media del puesto.`,
  },
  playerStatus: {
    starter: 'Titular',
    bench: 'Suplente',
    doubtful: 'Duda',
    out: 'Baja',
    notListed: 'No convocado',
    unknown: 'Sin XI',
  },
  kpis: {
    expectedGoals: 'Goles esperados',
    btts: 'Ambos anotan',
    over25: 'Más de 2.5',
    bestPick: 'Mejor pick',
    modelVsReal: (estimate) =>
      estimate?.empirical === null || estimate?.empirical === undefined
        ? `Modelo ${Math.round((estimate?.model ?? 0) * 100)}%`
        : `Modelo ${Math.round(estimate.model * 100)}% · Real ${Math.round(estimate.empirical * 100)}%`,
  },
  day: {
    title: 'Partidos del día',
    matches: 'Partidos',
    valuePicks: 'Picks con valor',
    highPicks: (count) => `${count} de confianza alta`,
    bestEv: 'Mejor EV',
    alerts: 'Alertas',
  },
  ranking: {
    title: (count) => `Ranking de picks (${count})`,
    market: 'Mercado',
    minTier: 'Confianza',
    minOdds: 'Cuota mínima',
    tierAtLeast: (tier) => (tier === 'none' ? 'Todos' : `${TIER_NAMES[tier]} o más`),
    empty: 'Ningún pick pasa los filtros.',
    emptyHint: 'Baja la cuota mínima o el nivel de confianza.',
  },
  marketGroups: {
    all: 'Todos',
    result: '1X2 y derivados',
    goals: 'Goles (Over/Under)',
    btts: 'Ambos anotan',
    firstGoal: 'Primer gol',
    handicap: 'Hándicap asiático',
    halfTime: 'Primer tiempo',
    corners: 'Corners',
    cards: 'Tarjetas',
    other: 'Otros',
  },
  combos: {
    title: 'Combinadas',
    safest: 'Más probables',
    bestValue: 'Más valor',
    selections: (count) => `${count} selecciones`,
    totalOdds: 'Cuota',
    probability: 'Prob.',
    empty: 'No hay suficientes picks para armar una combinada.',
    rules: (config, candidates) =>
      `Un pick por partido, EV positivo, confianza ${TIER_NAMES[config.minTier].toLowerCase()} o más, ` +
      `cuota ≥ ${config.minOdds.toFixed(2)}, de ${config.minSelections} a ${config.maxSelections} selecciones. ` +
      `Partidos con picks elegibles: ${candidates}. Se asume independencia entre partidos.`,
  },
  errors: {
    emptyInput: () => 'No hay JSON para analizar: pega el texto o elige un archivo.',
    invalidJson: ({ source, detail }) => `El JSON de "${source}" no es válido (${detail}). ¿Se copió completo?`,
    unknownFormat: ({ source }) =>
      `"${source}" no parece salir del script de Sofascore (no tiene "partido" ni "partidos").`,
    noMatches: () => 'El JSON no trae partidos.',
    expectedSingle: ({ count }) =>
      `Elegiste "Un partido", pero el JSON trae ${count} partidos. Cambia el modo a Auto o Varios.`,
    contextInLoader: () => 'Eso es un bloque de contexto de Claude: pégalo en el panel "Contexto de Claude", no aquí.',
    notContext: () => 'No es un bloque de contexto válido: debe tener "tipo": "contexto-claude" y una lista "partidos".',
    unexpected: (message) => `Error inesperado: ${message}`,
    analysisFailed: (title, message) => `No se pudo analizar ${title}: ${message}`,
  },
  alerts: {
    matchStarted: ({ status, score }) =>
      `El partido ya empezó (${status}${score && score !== '---' ? `, ${score}` : ''}): las cuotas pueden ser en vivo.`,
    lineupsNotConfirmed: () => 'Alineaciones no confirmadas: vuelve a correr el script ~1 h antes del partido.',
    noLineups: () => 'No hay alineaciones en el JSON.',
    noResultOdds: () => 'No hay cuotas 1X2: el modelo usa solo estadísticas (menos fiable).',
    smallSample: ({ team, n }) => `Muestra chica para ${team}: solo ${n} ${plural(n, 'partido', 'partidos')}.`,
    anomalousExcluded: ({ rows }) =>
      `Se excluyeron ${rows.length} ${plural(rows.length, 'marcador anómalo', 'marcadores anómalos')} (probables penales): ` +
      rows.map((row) => `${row.team} ${row.goalsFor}-${row.goalsAgainst} ${row.opponent}`).join('; '),
    duplicateMarkets: ({ names }) => `Cuotas repetidas (${names.join(', ')}): se usó la última (pre-partido).`,
    marketDivergence: ({ goalsGap, resultGap }) =>
      `Estadísticas y mercado no coinciden (goles ±${goalsGap.toFixed(2)}, 1X2 ±${Math.round(resultGap * 100)} pts): ` +
      'probablemente falta información. Revisar con Claude.',
    keyPlayerOut: ({ team, player, status, role }) =>
      `${team}: ${role === 'scorer' ? 'su goleador' : 'su máximo rematador'} ${player} está ` +
      `${{ out: 'de baja', doubtful: 'en duda', bench: 'en la banca', notListed: 'fuera de la convocatoria' }[status] ?? status}.`,
  },
  tiers: TIER_NAMES,
  positions: { G: 'Portero', D: 'Defensas', M: 'Medios', F: 'Delanteros', unknown: 'Sin posición' },
  form: { W: 'G', D: 'E', L: 'P' },
  sections: {
    overview: 'Goles esperados',
    topScores: 'Marcadores más probables',
    value: 'Picks con valor',
    onlyValue: 'Solo picks con valor',
    noValue: 'Ninguna cuota tiene valor según el modelo.',
    noValueHint: 'Desactiva "Solo picks con valor" para ver todas las cuotas.',
    scoreGrid: 'Mapa de marcadores',
    scoreGridRows: (name) => `Filas: goles de ${name}`,
    scoreGridColumns: (name) => `Columnas: goles de ${name}`,
    valueNote:
      'Casa = probabilidad de la cuota sin margen. Mi prob. no cuenta la devolución (empate no apuesta). ' +
      'EV = ganancia esperada por cada 1 apostado. Ventaja = mi prob. − casa.',
    result: 'Resultado',
    resultNote: (marketWeight) =>
      `Final = ${Math.round(marketWeight * 100)}% cuotas + ${Math.round((1 - marketWeight) * 100)}% estadísticas. ` +
      'Estadísticas = solo los datos de los equipos.',
    goals: 'Goles',
    goalsNote:
      'Modelo = Poisson. Real = lo ocurrido (local en casa, visita fuera y H2H a medio peso). Final = mezcla de ambos.',
    teams: 'Estadísticas por bloque',
    recentResults: 'Últimos resultados',
    h2h: 'H2H',
    noH2h: 'Sin partidos H2H en el JSON.',
    lineups: 'Alineaciones y bajas',
    substitutes: 'Suplentes',
    absences: 'Bajas',
    noAbsences: 'Sin bajas reportadas',
    noLineup: 'Sin alineación',
    confirmed: 'XI confirmado',
    probable: 'XI probable',
    matches: 'Partidos',
  },
  columns: {
    pick: 'Pick',
    odds: 'Cuota',
    fair: 'Casa',
    mine: 'Mi prob.',
    edge: 'Ventaja',
    ev: 'EV',
    home: 'Local',
    away: 'Visita',
    total: 'Total',
    stats: 'Estadísticas',
    market2: 'Mercado',
    final: 'Final',
    model: 'Modelo',
    real: 'Real',
    block: 'Bloque',
    played: 'PJ',
    record: 'G-E-P',
    goalsFor: 'GF',
    goalsAgainst: 'GC',
    xgFor: 'xG',
    xgAgainst: 'xGC',
    shotsOnTarget: 'T. puerta',
    corners: 'Corners',
    yellows: 'Amarillas',
    btts: 'Ambos',
    over25: '+2.5',
    time: 'Hora',
    match: 'Partido',
    result: '1 · X · 2',
    expectedGoals: 'Goles esp.',
    bestPick: 'Mejor pick',
    alerts: 'Alertas',
  },
  lambdaRows: { stats: 'Estadísticas', market: 'Mercado (cuotas)', blended: 'Antes del contexto', final: 'Final' },
  adjustments: {
    absences: (team, factor, names) =>
      `${team}: −${Math.round((1 - factor) * 100)}% en estadísticas por bajas (${names.join(', ')}).`,
  },
  blocks: {
    current: 'Temporada actual',
    other: (name) => name ?? 'Otra competición',
    venueHome: 'Local en casa',
    venueAway: 'Visita fuera',
    previous: 'Temporada pasada',
  },
  resultRows: {
    home: (names) => `Gana ${names.home}`,
    draw: () => 'Empate',
    away: (names) => `Gana ${names.away}`,
    homeDraw: (names) => `${names.home} o empate (1X)`,
    drawAway: (names) => `Empate o ${names.away} (X2)`,
    homeAway: () => 'Cualquiera gana (12)',
  },
  goalRows: {
    over: (line) => `Más de ${line} goles`,
    btts: 'Ambos anotan',
    homeScores: (names) => `${names.home} anota`,
    awayScores: (names) => `${names.away} anota`,
  },
  meta: {
    round: (round) => `Jornada ${round}`,
    referee: (name) => `Árbitro: ${name}`,
    position: (position) => `${position}° en la tabla`,
    versus: 'vs',
    expectedGoalsTitle: 'Goles esperados (final)',
  },
  claudePrompt: {
    intro:
      'Analizo estos partidos con un modelo Poisson (cuotas + estadísticas de Sofascore). Investiga lo que el modelo ' +
      'no sabe: lesiones y bajas de última hora, rotaciones, motivación (descenso, título, copa en la semana), ' +
      'cambio de DT, clima, árbitro y nivel real de la liga. Ajusta SOLO por información que el mercado ' +
      'probablemente todavía no refleja.',
    rules:
      'Devuélveme únicamente este bloque JSON (mismo id y partido). "ajustes" son multiplicadores relativos sobre ' +
      'los goles esperados finales (−0.08 = −8 %, tope ±0.30); "defensaX" cambia los goles que RECIBE ese equipo. ' +
      '"tarjetasExtra" y "cornersExtra" se suman al total esperado. "notas": frases cortas. "confianza": baja, media o alta.',
    none: 'ninguna',
    confirmed: 'XI confirmado',
    probable: 'XI probable',
    lambdas: 'Goles esperados',
    stats: 'estadísticas',
    market: 'mercado',
    final: 'final',
    bookmaker: 'casa',
    over25: 'Más de 2.5',
    btts: 'Ambos anotan',
    absences: 'Bajas',
    alerts: 'Alertas',
    bestPick: 'Mejor pick',
  },
  contextPanel: {
    copied: (count) => `Texto de ${count} ${plural(count, 'partido', 'partidos')} copiado. Pégalo en el chat con Claude.`,
    copyFailed: 'No se pudo copiar automáticamente: selecciona el texto del cuadro y cópialo a mano.',
    applied: (matched, total) =>
      `Contexto aplicado a ${matched} de ${total} ${plural(total, 'partido', 'partidos')}.`,
    noneMatched: 'Ningún partido del bloque coincide con los cargados (revisa id o nombres).',
    cleared: 'Contexto quitado.',
    needMatches: 'Primero carga y analiza partidos.',
  },
  settings: {
    title: 'Ajustes del modelo',
    saved: 'Ajustes guardados en este navegador.',
    reset: 'Valores por defecto restaurados.',
    defaultValue: (value) => `Por defecto: ${value}`,
    groups: {
      model: 'Modelo',
      value: 'Valor y confianza',
      combos: 'Combinadas',
      intelligence: 'Inteligencia de datos',
    },
    fields: {
      'lambda.marketWeight': 'Peso de las cuotas en los goles esperados',
      'lambda.homeAdvantage': 'Ventaja de local (multiplicador)',
      'lambda.awayDisadvantage': 'Desventaja de visita (multiplicador)',
      'lambda.venueSplitWeight': 'Peso de casa/fuera en las estadísticas',
      'empirical.priorStrength': 'Partidos virtuales del modelo (mezcla empírica)',
      'empirical.maxWeight': 'Peso máximo de lo ocurrido realmente',
      'value.highEv': 'EV mínimo para confianza alta',
      'value.mediumEv': 'EV mínimo para confianza media',
      'value.minProbability': 'Probabilidad mínima para recomendar',
      'value.minOdds': 'Cuota mínima para recomendar',
      'value.minSampleHigh': 'Muestra mínima para confianza alta',
      'combos.minOdds': 'Cuota mínima por selección',
      'combos.maxSelections': 'Máximo de selecciones',
      'schedule.enabled': 'Ajustar por fuerza del rival (calendario)',
      'absences.enabled': 'Restar goles por bajas importantes',
      'absences.replacement': 'Aporte que recupera el reemplazo',
      'context.maxAdjustment': 'Tope de cada ajuste de Claude',
    },
  },
  context: {
    applied: (confidence) => `Contexto de Claude${confidence ? ` · ${confidence}` : ''}`,
    title: 'Contexto de Claude',
    adjustmentsSummary: ({ homeAttack, awayAttack, homeDefence, awayDefence }, { cornersExtra, cardsExtra }) => {
      const pct = (value) => `${value > 0 ? '+' : ''}${Math.round(value * 100)}%`;
      const parts = [
        homeAttack && `ataque local ${pct(homeAttack)}`,
        awayAttack && `ataque visita ${pct(awayAttack)}`,
        homeDefence && `goles que recibe el local ${pct(homeDefence)}`,
        awayDefence && `goles que recibe la visita ${pct(awayDefence)}`,
        cornersExtra && `corners ${cornersExtra > 0 ? '+' : ''}${cornersExtra}`,
        cardsExtra && `tarjetas ${cardsExtra > 0 ? '+' : ''}${cardsExtra}`,
      ].filter(Boolean);
      return parts.length ? `Ajustes aplicados: ${parts.join(', ')}.` : 'Sin ajustes numéricos: solo notas.';
    },
  },
  absenceStatus: { missing: 'Baja', doubtful: 'Duda' },
  absenceReasons: {
    red_card_suspension: 'suspendido por roja',
    yellow_card_suspension: 'suspendido por amarillas',
    suspension: 'suspendido',
    international_duty: 'convocado con su selección',
  },
});

const MARKET_LABELS = {
  result: () => '1X2',
  doubleChance: () => 'Doble oportunidad',
  drawNoBet: () => 'Empate no apuesta',
  btts: () => 'Ambos anotan',
  total: (market) => `Goles ${market.line}`,
  firstGoal: () => 'Primer gol',
  resultFirstHalf: () => '1X2 primer tiempo',
  asianHandicap: () => 'Hándicap asiático',
  corners: (market) => `Corners ${market.line}`,
  cards: (market) => `Tarjetas ${market.line}`,
};

const signedLine = (line) => (line > 0 ? `+${line}` : String(line));

const SELECTION_LABELS = {
  result: { home: (n) => n.home, draw: () => 'Empate', away: (n) => n.away },
  doubleChance: {
    homeDraw: (n) => `${n.home} o empate`,
    drawAway: (n) => `Empate o ${n.away}`,
    homeAway: () => 'Local o visita',
  },
  drawNoBet: { home: (n) => n.home, away: (n) => n.away },
  btts: { yes: () => 'Sí', no: () => 'No' },
  total: { over: (_, line) => `Más de ${line}`, under: (_, line) => `Menos de ${line}` },
  firstGoal: { home: (n) => `${n.home} anota primero`, none: () => 'Sin goles', away: (n) => `${n.away} anota primero` },
  resultFirstHalf: { home: (n) => n.home, draw: () => 'Empate', away: (n) => n.away },
  asianHandicap: { home: (n, line) => `${n.home} ${signedLine(line)}`, away: (n, line) => `${n.away} ${signedLine(-line)}` },
  corners: { over: (_, line) => `Más de ${line}`, under: (_, line) => `Menos de ${line}` },
  cards: { over: (_, line) => `Más de ${line}`, under: (_, line) => `Menos de ${line}` },
};

export function marketLabel(market) {
  return MARKET_LABELS[market.type]?.(market) ?? market.name;
}

/**
 * @param {{ type: string, line: number|null }} market
 * @param {string} key
 * @param {{ home: string, away: string }} names
 */
export function selectionLabel(market, key, names) {
  return SELECTION_LABELS[market.type]?.[key]?.(names, market.line) ?? key;
}
