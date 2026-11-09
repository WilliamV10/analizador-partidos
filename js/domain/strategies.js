/**
 * Estrategias: un mercado (ej. gana local) y una lista de filtros sobre las señales del
 * partido (domain/signals.js). Un partido "pasa" si cumple todos los filtros; "casi" si falla
 * uno. Un filtro sin dato (ej. sin árbitro conocido) cuenta como no cumplido.
 *
 * Cada filtro compara una señal con un umbral (`min`: la señal debe ser ≥ umbral; `max`: ≤).
 * Los umbrales por defecto están aquí y se pueden cambiar (config.strategies, pantalla
 * Estrategias). Las selecciones de las estrategias que un partido pasa quedan marcadas en el
 * historial, para medir cada estrategia con el tiempo.
 */

/**
 * @typedef {Object} StrategyFilter
 * @property {string} id
 * @property {'min'|'max'} kind
 * @property {number} value          umbral por defecto
 * @property {'percent'|'decimal'|'integer'|'odds'} format
 * @property {number} step
 * @property {(signals: Object, analysis: Object) => number|null} read
 */

const min = (id, value, format, step, read) => ({ id, kind: 'min', value, format, step, read });
const max = (id, value, format, step, read) => ({ id, kind: 'max', value, format, step, read });
const lowest = (...values) => (values.some((value) => value === null || value === undefined) ? null : Math.min(...values));
const highest = (...values) => (values.some((value) => value === null || value === undefined) ? null : Math.max(...values));
const gap = (a, b) => (a === null || a === undefined || b === null || b === undefined ? null : a - b);
const quoteOdds = (type, key, line = null) => (signals, analysis) => analysis.quotes.get(type, key, line)?.odds ?? null;

/** Línea de tarjetas de la casa más cercana a 4.5 (la que se usa en la estrategia de tarjetas). */
function cardsLine(analysis) {
  const lines = analysis.markets.filter((market) => market.type === 'cards').map((market) => market.line);
  if (!lines.length) return null;
  return lines.reduce((best, line) => (Math.abs(line - 4.5) < Math.abs(best - 4.5) ? line : best));
}

/** @type {readonly { id: string, market: (analysis: Object) => { type: string, key: string, line: number|null }|null, filters: StrategyFilter[] }[]} */
export const STRATEGIES = Object.freeze([
  {
    id: 'homeWin',
    market: () => ({ type: 'result', key: 'home', line: null }),
    filters: [
      min('modelHome', 0.5, 'percent', 0.05, (s) => s.model.home),
      min('odds', 1.4, 'odds', 0.05, quoteOdds('result', 'home')),
      min('homeForm', 8, 'integer', 1, (s) => s.home.formPoints),
      max('awayForm', 6, 'integer', 1, (s) => s.away.formPoints),
      min('homeWinsAtHome', 0.5, 'percent', 0.05, (s) => s.home.venue?.win),
      max('awayWinsAway', 0.34, 'percent', 0.05, (s) => s.away.venue?.win),
      min('ppgGap', 0.4, 'decimal', 0.1, (s) => gap(s.home.ppg, s.away.ppg)),
      min('homeScoresAtHome', 1.5, 'decimal', 0.1, (s) => s.home.venue?.goalsFor),
      min('awayConcedesAway', 1.5, 'decimal', 0.1, (s) => s.away.venue?.goalsAgainst),
      min('homeAbsences', 0.95, 'percent', 0.01, (s) => s.home.absences),
    ],
  },
  {
    id: 'btts',
    market: () => ({ type: 'btts', key: 'yes', line: null }),
    filters: [
      min('modelBtts', 0.55, 'percent', 0.05, (s) => s.model.btts),
      min('leagueGoals', 2.8, 'decimal', 0.1, (s) => s.league?.goals),
      min('bttsVenue', 0.6, 'percent', 0.05, (s) => lowest(s.home.venue?.btts, s.away.venue?.btts)),
      min('scoredVenue', 0.75, 'percent', 0.05, (s) => lowest(s.home.venue?.scored, s.away.venue?.scored)),
      min('concededVenue', 0.6, 'percent', 0.05, (s) => lowest(s.home.venue?.conceded, s.away.venue?.conceded)),
      max('cleanSheets', 0.3, 'percent', 0.05, (s) => highest(s.home.venue?.clean, s.away.venue?.clean)),
      min('absences', 0.95, 'percent', 0.01, (s) => lowest(s.home.absences, s.away.absences)),
    ],
  },
  {
    id: 'draw',
    market: () => ({ type: 'result', key: 'draw', line: null }),
    filters: [
      max('leagueGoals', 2.9, 'decimal', 0.1, (s) => s.league?.goals),
      min('leagueDraws', 0.24, 'percent', 0.01, (s) => s.league?.draws),
      max('positionGap', 5, 'integer', 1, (s) => (s.home.position && s.away.position ? Math.abs(s.home.position - s.away.position) : null)),
      max('probabilityGap', 0.12, 'percent', 0.01, (s) => Math.abs(s.model.home - s.model.away)),
      max('expectedGoals', 2.5, 'decimal', 0.1, (s) => s.model.goals),
      min('closeMatches', 0.6, 'percent', 0.05, (s) => lowest(s.home.venue?.close, s.away.venue?.close)),
      min('h2hDraws', 0.2, 'percent', 0.05, (s) => s.h2h?.draws ?? null),
    ],
  },
  {
    id: 'under25',
    market: () => ({ type: 'total', key: 'under', line: 2.5 }),
    filters: [
      max('leagueGoals', 2.9, 'decimal', 0.1, (s) => s.league?.goals),
      max('expectedGoals', 2.4, 'decimal', 0.1, (s) => s.model.goals),
      min('modelUnder', 0.5, 'percent', 0.05, (s) => (s.model.over25 === null ? null : 1 - s.model.over25)),
      min('underVenue', 0.5, 'percent', 0.05, (s) => lowest(s.home.venue?.under25, s.away.venue?.under25)),
      max('goalsVenue', 2.6, 'decimal', 0.1, (s) =>
        highest(
          s.home.venue ? s.home.venue.goalsFor + s.home.venue.goalsAgainst : null,
          s.away.venue ? s.away.venue.goalsFor + s.away.venue.goalsAgainst : null,
        ),
      ),
    ],
  },
  {
    id: 'cards',
    market: (analysis) => {
      const line = cardsLine(analysis);
      return line === null ? null : { type: 'cards', key: 'over', line };
    },
    filters: [
      min('refereeYellows', 4.5, 'decimal', 0.1, (s) => (s.referee && s.referee.games >= 10 ? s.referee.yellows : null)),
      min('teamsYellows', 4, 'decimal', 0.1, (s) => (s.home.yellows === null || s.away.yellows === null ? null : s.home.yellows + s.away.yellows)),
      max('probabilityGap', 0.15, 'percent', 0.01, (s) => Math.abs(s.model.home - s.model.away)),
      max('positionGap', 6, 'integer', 1, (s) => (s.home.position && s.away.position ? Math.abs(s.home.position - s.away.position) : null)),
    ],
  },
]);

/** Umbrales por defecto: { estrategia: { filtro: valor } } (van a config.strategies). */
export function strategyDefaults() {
  return Object.fromEntries(STRATEGIES.map((strategy) => [strategy.id, Object.fromEntries(strategy.filters.map((filter) => [filter.id, filter.value]))]));
}

/**
 * @typedef {Object} StrategyCheck
 * @property {StrategyFilter} filter
 * @property {number} threshold
 * @property {number|null} value   la señal del partido (null = sin dato)
 * @property {boolean} pass
 */

/**
 * @typedef {Object} StrategyResult
 * @property {string} strategy
 * @property {Object} analysis
 * @property {{ type: string, key: string, line: number|null }|null} selection
 * @property {Object|null} pick      la selección con su cuota y probabilidad (null si la casa no la ofrece)
 * @property {StrategyCheck[]} checks
 * @property {number} failed
 */

/**
 * Evalúa una estrategia en un partido.
 * @param {typeof STRATEGIES[number]} strategy
 * @param {Object} analysis
 * @param {Object} signals    matchSignals(analysis)
 * @param {Record<string, number>} thresholds
 * @returns {StrategyResult}
 */
export function evaluateStrategy(strategy, analysis, signals, thresholds = {}) {
  const selection = strategy.market(analysis);
  const pick = selection
    ? analysis.picks.find(
        (candidate) => candidate.market.type === selection.type && (candidate.market.line ?? null) === selection.line && candidate.key === selection.key,
      ) ?? null
    : null;
  const checks = strategy.filters.map((filter) => {
    const threshold = thresholds[filter.id] ?? filter.value;
    const raw = filter.read(signals, analysis);
    const value = Number.isFinite(raw) ? raw : null;
    const pass = value !== null && (filter.kind === 'min' ? value >= threshold - 1e-9 : value <= threshold + 1e-9);
    return { filter, threshold, value, pass };
  });
  return { strategy: strategy.id, analysis, selection, pick, checks, failed: checks.filter((check) => !check.pass).length };
}

/** ¿El partido pasa la estrategia? (todos los filtros y la selección existe en la casa). */
export const passes = (result) => result.failed === 0 && result.pick !== null;

/**
 * Ids de las estrategias que pasa un partido (para marcar sus selecciones en el historial).
 * @returns {Map<string, string[]>}  clave de selección "tipo|línea|key" -> estrategias
 */
export function strategyTags(analysis, signals, config) {
  const tags = new Map();
  STRATEGIES.forEach((strategy) => {
    const result = evaluateStrategy(strategy, analysis, signals, config?.[strategy.id]);
    if (!passes(result)) return;
    const key = `${result.selection.type}|${result.selection.line ?? ''}|${result.selection.key}`;
    tags.set(key, [...(tags.get(key) ?? []), strategy.id]);
  });
  return tags;
}

/**
 * Cómo le fue a cada estrategia en el historial: las selecciones marcadas con ella, a 1 unidad.
 * @param {Object[]} records
 * @param {(status: string, odds: number) => number} profitPerUnit
 * @returns {Record<string, { tracked: number, settled: number, hits: number, hitRate: number|null, profit: number, roi: number|null }>}
 */
export function strategyPerformance(records, profitPerUnit) {
  const result = Object.fromEntries(STRATEGIES.map((strategy) => [strategy.id, { tracked: 0, settled: 0, hits: 0, decided: 0, profit: 0 }]));
  records.forEach((record) => {
    (record.strategies ?? []).forEach((id) => {
      const row = result[id];
      if (!row) return;
      row.tracked += 1;
      if (!record.settlement || !record.odds) return;
      row.settled += 1;
      row.profit += profitPerUnit(record.settlement.status, record.odds);
      if (record.settlement.status !== 'push') {
        row.decided += 1;
        if (record.settlement.status === 'win' || record.settlement.status === 'halfWin') row.hits += 1;
      }
    });
  });
  return Object.fromEntries(
    Object.entries(result).map(([id, row]) => [
      id,
      { ...row, hitRate: row.decided ? row.hits / row.decided : null, roi: row.settled ? row.profit / row.settled : null },
    ]),
  );
}
