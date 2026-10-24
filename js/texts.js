/**
 * Todos los textos visibles de la interfaz, en español.
 * Ningún renderer escribe texto "a mano": lo toma de aquí.
 */

const plural = (n, singular, pluralForm) => (n === 1 ? singular : pluralForm);

const TIER_NAMES = { high: 'Alta', medium: 'Media', low: 'Media-baja', none: 'Sin valor' };

export const TEXTS = Object.freeze({
  app: {
    disclaimer: 'Son probabilidades, no certezas. Apuesta solo lo que estés dispuesto a perder.',
    copyFallback: 'El navegador no dejó copiar: se descargó como archivo de texto.',
  },
  nav: {
    day: 'Día',
    match: 'Partido',
    explore: 'Explorar',
    combo: 'Combinada',
    context: 'Contexto',
    history: 'Historial',
    settings: 'Ajustes',
  },
  weekdays: ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'],
  theme: {
    toDark: 'Cambiar a modo oscuro',
    toLight: 'Cambiar a modo claro',
  },
  a11y: {
    form: (form) => `Forma reciente: ${form.map((result) => ({ W: 'ganó', D: 'empató', L: 'perdió' })[result] ?? result).join(', ')}`,
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
    lastTitle: 'Último análisis',
    restored: (count, savedAt) =>
      `Se recuperó la última carga (${count} ${plural(count, 'partido', 'partidos')}, ${new Date(savedAt).toLocaleString()}). ` +
      'Usa «Limpiar» para borrarla o carga otros datos para reemplazarla.',
    working: 'Analizando…',
  },
  matchTabs: {
    summary: 'Resumen',
    value: 'Valor',
    markets: 'Mercados',
    counts: 'Corners y tarjetas',
    players: 'Jugadores',
    teams: 'Equipos y H2H',
  },
  match: {
    home: 'Local',
    away: 'Visita',
    draw: 'Empate',
    back: 'Volver',
    review: 'Revisar con Claude',
  },
  summary: {
    finalProbability: 'Probabilidad final',
    fairLine: ([home, draw, away]) => `Casa sin margen: ${home} · ${draw} · ${away}`,
    expectedGoals: 'Goles esperados',
    total: 'Total',
    weight: 'Peso',
    weightValue: (marketWeight) =>
      `${Math.round(marketWeight * 100)}% cuotas · ${Math.round((1 - marketWeight) * 100)}% estadísticas`,
    bestPick: 'Mejor pick',
    allPicks: 'Ver todos los picks',
    keys: 'Claves',
    homeAtHome: (name) => `${name} en casa (datos recientes)`,
    awayScored: (name) => `${name} anotó en`,
    countOf: (count, total) => `${count} de ${total}`,
    btts: (estimate) =>
      estimate.empirical === null
        ? 'Ambos anotan'
        : `Ambos anotan (real: ${Math.round(estimate.empirical * 100)}% en ${Math.round(estimate.n)})`,
  },
  value: {
    withValue: (count) => `Con valor · ${count}`,
    allMarkets: 'Todos los mercados',
    withoutValue: (count) => `Sin valor · ${count} ${plural(count, 'selección', 'selecciones')}`,
    modeLabel: 'Qué cuotas mostrar',
    groupLabel: 'Filtrar por mercado',
  },
  marketGroupsShort: {
    result: '1X2',
    goals: 'Goles',
    btts: 'Ambos anotan',
    firstGoal: 'Primer gol',
    handicap: 'Hándicap',
    halfTime: 'Descanso',
    corners: 'Corners',
    cards: 'Tarjetas',
    other: 'Otros',
  },
  markets: {
    mine: 'Mi prob. final',
    fair: 'Casa sin margen',
    market: 'Mercado',
    result: 'Resultado',
    resultRows: (names) => ({
      home: `Gana ${names.home}`,
      draw: 'Empate',
      away: `Gana ${names.away}`,
      homeDraw: `${names.home} o empate`,
      drawAway: `Empate o ${names.away}`,
      homeAway: `${names.home} o ${names.away}`,
    }),
    goals: 'Goles · más de',
    over: (line) => `Más de ${line}`,
    modelVsReal: 'Ver modelo y real por línea',
    whoScores: 'Quién anota',
    fairAndOdds: (fair, odds) => `casa ${fair} · ${odds}`,
    fairOdds: (odds) => `cuota justa ${odds}`,
    allLines: 'Ver todas las líneas',
    handicapNote: 'Probabilidad de ganar sin contar la devolución. Las líneas de cuarto (±0.25, ±0.75) se calculan como dos medias apuestas.',
    halfTimeAndFirstGoal: 'Medio tiempo y primer gol',
    halfTimeRows: {
      home: (names) => `${names.home} gana al descanso`,
      draw: () => 'Empate al descanso',
      away: (names) => `${names.away} gana al descanso`,
    },
    halfTimeOver: (line) => `Más de ${line} al descanso`,
    firstGoalRows: {
      home: (names) => `${names.home} anota primero`,
      none: () => 'Sin goles',
      away: (names) => `${names.away} anota primero`,
    },
  },
  counts: {
    corners: {
      expected: 'Corners esperados',
      lineTitle: (line) => `Corners · línea ${line}`,
      overLine: (line) => `Más de ${line} corners`,
      explain: (model) =>
        model.marketTotal === null
          ? `Solo estadísticas: lo que saca cada equipo y lo que concede el rival (total ${model.statsTotal.toFixed(1)}).`
          : `Estadísticas ${model.statsTotal.toFixed(1)} · casa ${model.marketTotal.toFixed(1)}: el esperado mezcla ambos.`,
    },
    cards: {
      expected: 'Tarjetas esperadas',
      lineTitle: (line) => `Tarjetas · línea ${line}`,
      overLine: (line) => `Más de ${line} tarjetas`,
      explain: (model) =>
        model.marketTotal === null
          ? `Solo estadísticas de amarillas (total ${model.statsTotal.toFixed(1)}).`
          : `Estadísticas ${model.statsTotal.toFixed(1)} · casa ${model.marketTotal.toFixed(1)}: el esperado mezcla ambos.`,
    },
    over: 'Más de',
    under: 'Menos de',
    chartLabel: (over, total, line) => `${over} de ${total} partidos pasaron ${line}`,
    chartCaption: (name, count, line) => `Total en los partidos de ${name} esta temporada · ${count} pasaron ${line}`,
    teamOver: (team, line) => `${team} más de ${line}`,
    firstHalfOver: (line) => `1er tiempo: más de ${line}`,
    firstHalfExpected: (total) => `Corners esperados en el 1er tiempo: ${total}.`,
    allLines: 'Ver todas las líneas (por equipo y 1er tiempo)',
    refereeUsed: (name, perGame, games, weight) =>
      `Árbitro ${name ?? ''}: ${perGame} amarillas por partido en ${games} (pesa ${weight}% en las estadísticas).`,
    noReferee: 'El JSON no trae el historial del árbitro: corre el script v4 actualizado para incluirlo.',
  },
  teams: {
    sideLabel: 'Equipo',
    recent: 'Últimos resultados · más reciente primero',
    h2hTitle: (count) => `H2H · últimos ${count}`,
    h2hRecord: (names, home, draws, away) => `${names.home} ${home} · Empates ${draws} · ${names.away} ${away}`,
    h2hSummary: (summary, homeName) =>
      `Ambos anotan ${summary.btts}/${summary.n} · Más de 2.5 ${summary.overs[2.5]}/${summary.n} · ` +
      `${homeName} promedia ${summary.avg.goalsFor?.toFixed(1) ?? '—'} a favor y ${summary.avg.goalsAgainst?.toFixed(1) ?? '—'} en contra.`,
    lineupTitle: (confirmed, team, formation) => `${confirmed ? 'XI confirmado' : 'XI probable'} · ${team}${formation ? ` ${formation}` : ''}`,
    unconfirmed: 'Sin confirmar',
  },
  contextScreen: {
    title: 'Contexto con Claude',
    matches: (count) => `${count} ${plural(count, 'partido', 'partidos')}`,
    steps: ['Copiar', 'Claude investiga', 'Pegar y aplicar'],
    copyTitle: '1 · Copiar para Claude',
    review: (count) => `Por revisar · ${count}`,
    all: (count) => `Todos · ${count}`,
    scopeLabel: 'Qué partidos copiar',
    copyButton: (count) => `Copiar ${count} ${plural(count, 'partido', 'partidos')}`,
    pasteTitle: '3 · Pegar el bloque de Claude',
    pasteLabel: 'Bloque de contexto de Claude',
    apply: 'Aplicar contexto',
    valid: (matched, total) => `Bloque válido · ${matched} de ${total} ${plural(total, 'partido reconocido', 'partidos reconocidos')}`,
    applied: 'Ajustes aplicados',
    removeAll: 'Quitar todos',
    toggle: (title) => `Usar el contexto de ${title}`,
    noneApplied: 'Todavía no hay contexto aplicado. Copia el resumen, pégalo en el chat con Claude y trae su bloque.',
  },
  confidenceTier: { alta: 'high', media: 'medium', baja: 'low' },
  explorer: {
    title: 'Explorar',
    intro:
      'Elige qué mirar y mueve el deslizador: probabilidad de exactamente N, N o más y N o menos. ' +
      'En «Ambos» ves la probabilidad de que los dos equipos anoten.',
    thisMatch: 'Este partido',
    allMatches: (count) => `Todos · ${count}`,
    scopeLabel: 'Un partido o todos',
    match: 'Partido',
    groups: { goals: 'Goles', corners: 'Corners', cards: 'Tarjetas', btts: 'Ambos' },
    groupLabel: 'Estadística',
    sideLabel: 'De quién',
    total: 'Total',
    firstHalf: '1er tiempo',
    units: { goals: ['gol', 'goles'], corners: ['corner', 'corners'], cards: ['tarjeta', 'tarjetas'], btts: ['', ''] },
    bttsYes: 'Ambos anotan: Sí',
    bttsNo: 'Ambos anotan: No',
    bttsDetail: 'Ambos anotan · detalle',
    houseYes: 'Casa · Sí',
    houseNo: 'Casa · No',
    bttsModel: 'Modelo (Poisson)',
    bttsReal: 'Lo ocurrido',
    bttsRealValue: (rate, n) => `${rate} en ${n} partidos`,
    bttsAndOver: 'Ambos anotan y más de 2.5',
    bttsFirstHalf: 'Ambos anotan en el 1er tiempo',
    bttsRankingHint: 'Partidos ordenados por la probabilidad de que ambos anoten. Toca uno para ver el detalle.',
    bttsRowDetail: (home, away, house) => `Local anota ${home} · visita anota ${away}${house ? ` · casa ${house}` : ''}`,
    valueLabel: (value, [singular, pluralForm]) => `${value} ${plural(value, singular, pluralForm)}`,
    sliderLabel: ([, pluralForm]) => `Cantidad de ${pluralForm}`,
    less: 'Uno menos',
    more: 'Uno más',
    exactly: (value, [singular, pluralForm]) => `Exactamente ${value} ${plural(value, singular, pluralForm)}`,
    atLeast: (value, [singular, pluralForm]) => `${value} ${plural(value, singular, pluralForm)} o más`,
    atMost: (value, [singular, pluralForm]) => `${value} ${plural(value, singular, pluralForm)} o menos`,
    fair: (odds) => `cuota justa ${odds}`,
    distribution: 'Distribución',
    chartLabel: 'Probabilidad de cada cantidad; resaltadas las que cumplen "o más"',
    expected: 'Esperado',
    houseOver: (line) => `Casa · más de ${line}`,
    houseUnder: (line) => `Casa · menos de ${line}`,
    houseLine: (fair, odds, mine) => `${fair} @ ${odds} (mío ${mine})`,
    rankingHint: (value, [singular, pluralForm]) =>
      `Partidos ordenados por la probabilidad de ${value} ${plural(value, singular, pluralForm)} o más. Toca uno para verlo en detalle.`,
    rowDetail: (mean, exactly, value) => `Esperado ${mean} · exactamente ${value}: ${exactly}`,
    method:
      'Goles: la grilla final del modelo. Corners y tarjetas: binomial negativa con el esperado final (ya mezclado con la cuota). ' +
      'No incluye la mezcla con lo ocurrido realmente de las pestañas Valor y Mercados: puede diferir uno o dos puntos. ' +
      'Ambos anotan (Sí/No, cada equipo anota) sí usa la probabilidad final, la misma de esas pestañas.',
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
    both: 'Ambos',
    sideLabel: 'Qué equipo',
    intro: 'Probabilidad de 1+ tiro a puerta (y 2+). Compara la cuota justa con la de tu casa: si te pagan más, hay valor.',
    line: (team, status, per90, goals) => `${team} · ${status} · ${per90} a puerta/90 · ${goals} ${plural(goals, 'gol', 'goles')}`,
    twoPlus: (two, fair) => `2+ ${two} · justa ${fair}`,
    notStarting: 'No juegan de inicio',
    detail: 'Ver tabla completa (tiros y tiros a puerta)',
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
    fallbackTitle: 'Partidos',
    matches: 'partidos',
    matchesLabel: 'Partidos',
    strongPicks: 'picks Alta o Media',
    unconfirmed: 'XI sin confirmar',
    all: 'Todos',
    withValue: 'Con valor',
    filters: 'Filtrar partidos',
    noneForFilter: 'Ningún partido con ese filtro.',
    noPick: 'Sin picks con valor',
    bestPicks: 'Mejores picks del día',
    versus: 'vs',
    buildCombo: 'Armar combinada con estos picks',
    valuePicks: 'Picks con valor',
    highPicks: (count) => `${count} de confianza alta`,
    bestEv: 'Mejor EV',
    alerts: 'Alertas',
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
    title: 'Combinada',
    safest: 'La más probable',
    bestValue: 'La de más valor',
    selections: (count) => `Selecciones · ${count}`,
    totalOdds: 'Cuota total',
    probability: 'Probabilidad',
    fairOdds: 'Cuota justa',
    suggested: 'Sugeridas',
    suggestionTotals: (probability, ev) => `Probabilidad ${probability} · EV ${ev}`,
    use: 'Usar esta combinada',
    canAdd: 'Puedes agregar',
    eligible: 'Picks elegibles',
    withThis: (odds, probability) => `Con esta: cuota ${odds} · prob. ${probability}`,
    single: (probability, ev) => `Prob. ${probability} · EV ${ev}`,
    add: 'Agregar a la combinada',
    remove: 'Quitar de la combinada',
    clear: 'Vaciar combinada',
    noCandidates: 'No hay picks que cumplan las reglas.',
    noCandidatesHint: 'Baja la cuota mínima o el nivel mínimo.',
    withoutCandidates: (titles) => `Sin picks elegibles: ${titles.join(', ')}.`,
    rules: 'Reglas',
    minOdds: 'Cuota mínima por selección',
    minOddsHint: '«Equipo anota» acepta desde 1.15',
    less: 'Bajar cuota mínima',
    more: 'Subir cuota mínima',
    minTier: 'Nivel mínimo',
    onePerMatch: 'Un pick por partido',
    independence: 'Asume que los partidos son independientes. Una combinada falla la mayoría de las veces aunque cada pick sea bueno: apuesta poco.',
    copy: 'Copiar combinada',
    copied: 'Combinada copiada.',
    copyTotals: (odds, probability, ev) => `Cuota ${odds} · probabilidad ${probability} · EV ${ev}`,
    moreCandidates: (count) => `Ver ${count} más`,
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
    historyInLoader: () => 'Eso es un archivo de resultados o un respaldo: cárgalo en el Historial, no aquí.',
    notResults: () => 'No es un archivo de resultados: debe venir del script "Copiar script" del Historial.',
    notBackup: () => 'No es un respaldo del historial de esta página.',
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
    roundShort: (round) => `J${round}`,
    referee: (name, stats) =>
      `Árbitro: ${name}${stats ? ` (${stats.yellowsPerGame.toFixed(1)} amarillas por partido en ${stats.games})` : ''}`,
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
  bets: {
    register: 'Registrar apuesta',
    registered: 'Apuesta registrada (toca para editar)',
    newTitle: 'Registrar apuesta',
    editTitle: 'Editar apuesta',
    saved: 'Apuesta registrada en el historial.',
    removed: 'Registro quitado.',
  },
  history: {
    title: 'Historial',
    eyebrow: 'Tus apuestas y los picks del modelo',
    back: '← Volver al análisis',
    loading: 'Cargando historial…',
    modes: { bets: 'Mis apuestas', model: 'Picks del modelo' },
    settled: 'Liquidadas',
    pending: (count) => `${count} ${plural(count, 'pendiente', 'pendientes')}`,
    profit: 'Ganancia',
    staked: (amount) => `Apostado: ${amount} u`,
    roi: 'ROI',
    hitRate: (value) => `Acierto ${value}`,
    clv: 'CLV',
    clvCount: (count) => `${count} con cuota de cierre`,
    byTier: 'Por confianza',
    byMarket: 'Por mercado',
    calibration: 'Calibración del modelo',
    calibrationNote:
      'Todas las predicciones liquidadas (con o sin apuesta). Si el modelo está bien calibrado, ' +
      '"Ocurrió" se parece a "Predicho" en cada rango. Hacen falta cientos de predicciones para que sea fiable.',
    noSettled: 'Todavía no hay nada liquidado.',
    records: (count) => `Registro (${count})`,
    empty: {
      bets: 'Todavía no registraste apuestas.',
      model: 'Todavía no hay picks con valor guardados.',
    },
    emptyHint: {
      bets: 'Toca "+" junto a un pick en la pestaña Valor de un partido.',
      model: 'Cada análisis guarda solo sus predicciones (partidos que aún no empiezan).',
    },
    columns: {
      count: 'N',
      hitRate: 'Acierto',
      profit: 'Ganancia',
      roi: 'ROI',
      clv: 'CLV',
      stake: 'Monto',
      status: 'Estado',
      range: 'Rango',
      predicted: 'Predicho',
      observed: 'Ocurrió',
    },
    status: {
      pending: 'Pendiente',
      win: 'Ganada',
      halfWin: 'Media ganada',
      push: 'Devuelta',
      halfLoss: 'Media perdida',
      loss: 'Perdida',
    },
    resultsTitle: 'Actualizar resultados',
    resultsSteps: [
      ['Copiar', 'Copia el script con los partidos pendientes.'],
      ['Sofascore', 'Pégalo en la consola (F12) de sofascore.com: descarga un .json.'],
      ['Liquidar', 'Sube ese archivo (o pega su texto) aquí.'],
    ],
    copyScript: (count) => `Copiar script (${count} ${plural(count, 'partido', 'partidos')})`,
    scriptCopied: (count) => `Script de ${count} ${plural(count, 'partido', 'partidos')} copiado. Pégalo en la consola de sofascore.com.`,
    scriptCopyFailed: 'No se pudo copiar: el script quedó en el cuadro de texto, cópialo a mano.',
    uploadResults: 'Subir resultados',
    settleButton: 'Liquidar con el texto pegado',
    settledNow: (count, finished, total) =>
      `${count} ${plural(count, 'selección liquidada', 'selecciones liquidadas')} ` +
      `(${finished} de ${total} ${plural(total, 'partido terminado', 'partidos terminados')}).`,
    nothingSettled: 'No se liquidó nada: los partidos no han terminado o no estaban en el historial.',
    backupTitle: 'Respaldo',
    export: 'Exportar',
    import: 'Importar',
    clear: 'Borrar historial',
    confirmClear: '¿Borrar todo el historial de este navegador? No se puede deshacer (exporta antes un respaldo).',
    exported: 'Respaldo descargado.',
    imported: (count) => `${count} ${plural(count, 'registro importado', 'registros importados')}.`,
    cleared: 'Historial borrado.',
    storageNote:
      'Se guarda solo en este navegador. Para pasarlo al celular u otro equipo, exporta e importa el respaldo.',
    memoryNote: 'Este navegador no permite guardar datos: el historial se perderá al cerrar la página. Exporta un respaldo.',
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
    eyebrow: 'Se guardan en este navegador',
    saved: 'Ajuste guardado y partidos recalculados.',
    reset: 'Valores por defecto restaurados.',
    resetButton: 'Restaurar valores por defecto',
    hint: 'Cada cambio recalcula todos los partidos cargados al soltar el control.',
    theme: 'Tema',
    themes: { dark: 'Oscuro', light: 'Claro', auto: 'Sistema' },
    defaultValue: (value) => `Por defecto: ${value}`,
    groups: {
      model: 'Modelo',
      value: 'Valor y confianza',
      combos: 'Combinadas',
      intelligence: 'Inteligencia de datos',
    },
    fields: {
      'lambda.marketWeight': 'Peso de las cuotas en los goles esperados',
      'lambda.xgWeight': 'Peso del xG frente a los goles reales',
      'counts.marketWeight': 'Peso de las cuotas en corners y tarjetas',
      'lambda.multiplicative': 'Goles esperados = ataque × defensa ÷ media de la liga',
      'poisson.dixonColesRho': 'Corrección de empates bajos (Dixon-Coles, 0 = sin corrección)',
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
      'value.maxEdge': 'Ventaja máxima creíble sobre la casa',
      'combos.minOdds': 'Cuota mínima por selección',
      'combos.maxSelections': 'Máximo de selecciones',
      'schedule.enabled': 'Ajustar por fuerza del rival (calendario)',
      'recency.enabled': 'Dar más peso a los partidos recientes',
      'recency.halfLifeDays': 'Días tras los que un partido pesa la mitad',
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

const signedLine = (line) => (line > 0 ? `+${line}` : line === 0 ? '±0' : String(line));

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

/** Texto natural de una selección ("Menos de 2.5 goles", "Ambos anotan: No"). */
const PICK_TITLES = {
  result: { home: (n) => `Gana ${n.home}`, draw: () => 'Empate', away: (n) => `Gana ${n.away}` },
  drawNoBet: { home: (n) => `${n.home}, empate no apuesta`, away: (n) => `${n.away}, empate no apuesta` },
  btts: { yes: () => 'Ambos anotan: Sí', no: () => 'Ambos anotan: No' },
  total: { over: (_, line) => `Más de ${line} goles`, under: (_, line) => `Menos de ${line} goles` },
  resultFirstHalf: {
    home: (n) => `${n.home} gana al descanso`,
    draw: () => 'Empate al descanso',
    away: (n) => `${n.away} gana al descanso`,
  },
  corners: { over: (_, line) => `Más de ${line} corners`, under: (_, line) => `Menos de ${line} corners` },
  cards: { over: (_, line) => `Más de ${line} tarjetas`, under: (_, line) => `Menos de ${line} tarjetas` },
};

export function pickTitle(market, key, names) {
  return PICK_TITLES[market.type]?.[key]?.(names, market.line) ?? selectionLabel(market, key, names);
}

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
