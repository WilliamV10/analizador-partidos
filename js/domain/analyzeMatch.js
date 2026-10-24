/**
 * Orquestador del análisis de un partido. Función pura: (Match, config, contexto) -> MatchAnalysis.
 */
import { CONFIG } from '../config.js';
import { absenceImpact } from './absences.js';
import { adjustRows, competitionWeight, findLeagueEntry, leagueCoefficient, strengthLookup } from './adjustments.js';
import { summarize } from './aggregates.js';
import { buildAlerts } from './alerts.js';
import { applyContextToLambdas } from './context.js';
import { countModel } from './counts.js';
import { binaryEstimates } from './empirical.js';
import { firstHalfShare, halfTimeModel } from './halfTime.js';
import { marginDistribution } from './handicap.js';
import { blendLambdas, fitMarketLambdas, leagueAverageGoals, marketTargets, statsLambdas } from './lambdas.js';
import { buildQuoteIndex, classifyMarket } from './marketCatalog.js';
import { isAnomalous } from './matchRows.js';
import { projectPlayers } from './players.js';
import { scoreGrid } from './poisson.js';
import { clamp } from '../utils/math.js';
import { outcomeProbabilities } from './probabilities.js';
import { evaluateMarkets } from './value.js';

/** @typedef {import('../types.js').TeamMatchRow} TeamMatchRow */

function splitAnomalies(rows, teamName, threshold) {
  const valid = [];
  const excluded = [];
  rows.forEach((row) => {
    if (isAnomalous(row, threshold)) {
      excluded.push({ team: teamName, opponent: row.opponent, goalsFor: row.goalsFor, goalsAgainst: row.goalsAgainst });
    } else {
      valid.push(row);
    }
  });
  return { valid, excluded };
}

/**
 * Bloques de partidos de un equipo, sin marcadores anómalos ni partidos de peso 0
 * (amistosos). Los amistosos se quitan aquí y no solo en los λ: si no, contaminan
 * corners, tarjetas, porcentajes empíricos, el primer tiempo y el tamaño de muestra.
 */
function teamBlocks(team, threshold, leagues) {
  const blocks = { current: team.current, other: team.other, previous: team.previous };
  const counts = (row) => competitionWeight(row.competition, leagues.weights, leagues.defaultWeight) > 0;
  const excluded = [];
  const clean = Object.fromEntries(
    Object.entries(blocks).map(([name, rows]) => {
      const split = splitAnomalies(rows.filter(counts), team.name, threshold);
      excluded.push(...split.excluded);
      return [name, split.valid];
    }),
  );
  const recent = [...clean.current, ...clean.other];
  return { ...clean, recent, excluded };
}

function teamSummaries(blocks, isHomeTeam, goalLines) {
  const venueRows = blocks.recent.filter((row) => row.isHome === isHomeTeam);
  return {
    current: summarize(blocks.current, goalLines),
    other: summarize(blocks.other, goalLines),
    previous: summarize(blocks.previous, goalLines),
    recent: summarize(blocks.recent, goalLines),
    venue: summarize(venueRows, goalLines),
    venueRows,
  };
}

/* ---------- λ por estadísticas (con calendario, ligas, competición y bajas) ---------- */

function adjustedSummaries(blocks, isHomeTeam, adjustment, goalLines) {
  const recent = adjustRows(blocks.recent, adjustment);
  return {
    recent: summarize(recent, goalLines),
    venue: summarize(recent.filter((row) => row.isHome === isHomeTeam), goalLines),
  };
}

function lambdaConfigFor(match, config) {
  const entry = findLeagueEntry(match.tournament, config.leagues.homeAdvantage);
  if (!entry) return config.lambda;
  return { ...config.lambda, homeAdvantage: entry.homeAdvantage, awayDisadvantage: entry.awayDisadvantage };
}

/** Fecha del partido más reciente de los datos: referencia para el peso por antigüedad. */
function latestDate(rows) {
  return rows.reduce((latest, row) => (row.date && (!latest || row.date > latest) ? row.date : latest), null);
}

function adjustedStatsLambdas({ match, homeBlocks, awayBlocks, absences, config }) {
  const { goalLines } = config.display;
  const adjustment = {
    strengthOf: strengthLookup(match.standings, config.schedule),
    currentCoefficient: leagueCoefficient(match.tournament, config.leagues.coefficients),
    schedule: config.schedule,
    leagues: config.leagues,
    recency: config.recency,
    referenceDate: latestDate([...homeBlocks.recent, ...awayBlocks.recent]),
  };
  const average = config.lambda.multiplicative
    ? leagueAverageGoals(match.standings, config.schedule.minTeams)
    : null;
  const base = statsLambdas(
    adjustedSummaries(homeBlocks, true, adjustment, goalLines),
    adjustedSummaries(awayBlocks, false, adjustment, goalLines),
    lambdaConfigFor(match, config),
    average,
  );
  const { min, max } = config.lambda.fit;
  return {
    home: clamp(base.home * absences.home.factor, min, max),
    away: clamp(base.away * absences.away.factor, min, max),
  };
}

function marketLambdasFor(markets, config) {
  const targets = marketTargets(markets);
  if (!targets) return null;
  const fitted = fitMarketLambdas(targets, config.lambda.fit, config.poisson.maxGoals, config.poisson.dixonColesRho);
  return { home: fitted.home, away: fitted.away, targets };
}

/* ---------- Modelos de precios ---------- */

/** Grilla, probabilidades, diferencia de goles y primer tiempo para un par de λ. */
function goalModel(lambdas, halfTimeSplit, config) {
  const { goalLines, topScores } = config.display;
  const grid = scoreGrid(lambdas.home, lambdas.away, config.poisson.maxGoals, config.poisson.dixonColesRho);
  return {
    grid,
    probabilities: outcomeProbabilities(grid, { goalLines, topScores }),
    margins: marginDistribution(grid),
    halfTime: halfTimeModel(lambdas, halfTimeSplit, {
      maxGoals: config.poisson.maxGoals,
      goalLines: config.halfTime.goalLines,
    }),
  };
}

/** Qué estadística modela cada mercado de conteo y qué ajuste de Claude recibe. */
const COUNT_STATS = [
  { stat: 'corners', marketType: 'corners', extra: (context) => context?.cornersExtra ?? 0, usesReferee: false },
  { stat: 'cornersFirstHalf', marketType: null, extra: () => 0, usesReferee: false },
  { stat: 'yellows', marketType: 'cards', extra: (context) => context?.cardsExtra ?? 0, usesReferee: true },
];

function refereeFor(match) {
  const stats = match.refereeStats;
  return stats ? { perGame: stats.yellowsPerGame, games: stats.games } : null;
}

function linesFor(statConfig, markets, marketType) {
  const marketLines = markets.filter((market) => market.type === marketType).map((market) => market.line);
  return [...new Set([...statConfig.lines, ...marketLines])].sort((a, b) => a - b);
}

function countModels({ match, home, away, homeBlocks, awayBlocks, markets, context, config }) {
  return Object.fromEntries(
    COUNT_STATS.map(({ stat, marketType, extra, usesReferee }) => [
      stat,
      countModel({
        stat,
        home: { venueRows: home.venueRows, recentRows: homeBlocks.recent },
        away: { venueRows: away.venueRows, recentRows: awayBlocks.recent },
        extra: extra(context),
        markets: marketType ? markets.filter((market) => market.type === marketType) : [],
        referee: usesReferee ? refereeFor(match) : null,
        lines: linesFor(config.counts[stat], markets, marketType),
        teamLines: config.counts[stat].teamLines,
        statConfig: config.counts[stat],
        config: config.counts,
        empiricalConfig: config.empirical,
      }),
    ]),
  );
}

/**
 * @typedef {Object} MatchAnalysis
 * @property {import('../types.js').Match} match
 * @property {Object} summaries        por equipo: current, other, previous, recent, venue; y h2h
 * @property {{ stats: {home:number,away:number}, market: Object|null, blended: {home:number,away:number}, final: {home:number,away:number} }} lambdas
 * @property {{ homeLambda: number, awayLambda: number, cells: number[][] }} grid  grilla final
 * @property {import('./probabilities.js').Probabilities} probabilities       modelo final
 * @property {import('./probabilities.js').Probabilities} statsProbabilities  solo estadísticas
 * @property {Object} binary           estimaciones mezcladas con lo empírico
 * @property {import('./halfTime.js').HalfTimeModel} halfTime
 * @property {Record<string, import('./counts.js').CountModel|null>} counts  corners, cornersFirstHalf, yellows
 * @property {{ home: import('./players.js').PlayerProjection[], away: import('./players.js').PlayerProjection[] }} players
 * @property {{ home: Object, away: Object }} absences  impacto de las bajas en el λ por estadísticas
 * @property {import('./context.js').MatchContext|null} context
 * @property {import('./value.js').ValuePick[]} picks
 * @property {import('./marketCatalog.js').CanonicalMarket[]} markets
 * @property {{ get: (type: string, key: string, line?: number|null) => ({ odds: number, fairProbability: number }|null) }} quotes
 * @property {{ code: string, level: string, params: Object }[]} alerts
 * @property {typeof CONFIG} config    parámetros con los que se hizo el análisis
 */

/**
 * @param {import('../types.js').Match} match
 * @param {typeof CONFIG} [config]
 * @param {import('./context.js').MatchContext|null} [context]  bloque de Claude para este partido
 * @returns {MatchAnalysis}
 */
export function analyzeMatch(match, config = CONFIG, context = null) {
  const { goalLines } = config.display;
  const threshold = config.data.anomalousTotalGoals;

  const homeBlocks = teamBlocks(match.home, threshold, config.leagues);
  const awayBlocks = teamBlocks(match.away, threshold, config.leagues);
  const h2h = splitAnomalies(match.h2h, match.home.name, threshold);

  const home = teamSummaries(homeBlocks, true, goalLines);
  const away = teamSummaries(awayBlocks, false, goalLines);

  const players = {
    home: projectPlayers(match.home, away.recent, config.players),
    away: projectPlayers(match.away, home.recent, config.players),
  };
  const absences = {
    home: absenceImpact(players.home, match.lineupsConfirmed, config.absences),
    away: absenceImpact(players.away, match.lineupsConfirmed, config.absences),
  };

  const markets = match.odds.map(classifyMarket);
  const stats = adjustedStatsLambdas({ match, homeBlocks, awayBlocks, absences, config });
  const market = marketLambdasFor(markets, config);
  const blended = blendLambdas(stats, market, config.lambda.marketWeight);
  const final = applyContextToLambdas(blended, context, config.context);

  const halfTimeSplit = firstHalfShare([...homeBlocks.recent, ...awayBlocks.recent], config.halfTime);
  const finalGoals = goalModel(final, halfTimeSplit, config);
  const statsGoals = goalModel(stats, halfTimeSplit, config);

  const binary = binaryEstimates({
    probabilities: finalGoals.probabilities,
    homeVenueRows: home.venueRows,
    awayVenueRows: away.venueRows,
    h2hRows: h2h.valid,
    goalLines,
    config: config.empirical,
  });
  const counts = countModels({ match, home, away, homeBlocks, awayBlocks, markets, context, config });

  const recentSampleSizes = { home: home.recent?.n ?? 0, away: away.recent?.n ?? 0 };
  const picks = evaluateMarkets({
    markets,
    finalModel: { ...finalGoals, binary, counts },
    statsModel: { ...statsGoals, binary: null, counts: null },
    sampleSize: Math.min(recentSampleSizes.home, recentSampleSizes.away),
    config: config.value,
  });

  const alerts = buildAlerts(
    {
      match,
      recentSampleSizes,
      excludedRows: [...homeBlocks.excluded, ...awayBlocks.excluded, ...h2h.excluded],
      lambdas: { stats, market },
      statsProbabilities: statsGoals.probabilities,
      players,
    },
    config,
  );

  return {
    match,
    summaries: { home, away, h2h: summarize(h2h.valid, goalLines), h2hRows: h2h.valid },
    lambdas: { stats, market, blended, final },
    grid: finalGoals.grid,
    probabilities: finalGoals.probabilities,
    statsProbabilities: statsGoals.probabilities,
    binary,
    halfTime: finalGoals.halfTime,
    counts,
    players,
    absences,
    context,
    picks,
    markets,
    quotes: buildQuoteIndex(markets),
    alerts,
    config,
  };
}
