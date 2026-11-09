/**
 * Señales de un partido: lo que sirve para filtrar estrategias (forma, tabla, cómo le va a
 * cada equipo en su condición, perfil de la liga, árbitro, bajas, lo que dice el modelo).
 * Se calculan del análisis y se guardan en el historial (en las selecciones del 1X2), para
 * poder revisar más adelante qué filtros funcionaron.
 *
 * Todas son números chicos (tasas de 0 a 1, promedios por partido) o null si falta el dato.
 */
import { namesMatch } from '../utils/text.js';

export const SIGNALS_VERSION = 1;

const round = (value, digits = 2) => (Number.isFinite(value) ? Number(value.toFixed(digits)) : null);
const rate = (count, n) => (n > 0 ? round(count / n) : null);

/** Puntos de los últimos 5 (G = 3, E = 1) y la racha en texto ("GGEPG", el más reciente al final). */
function formOf(form) {
  const last = (form ?? []).slice(-5);
  if (!last.length) return { formPoints: null, form: null };
  const points = last.reduce((sum, result) => sum + ({ W: 3, D: 1 }[result] ?? 0), 0);
  return { formPoints: points, form: last.join('') };
}

/** Cómo le va al equipo en su condición (local en casa o visita fuera): tasas y promedios. */
function venueOf(summary, rows, goalLine = 2.5) {
  if (!summary?.n) return null;
  const { n } = summary;
  const close = rows.filter((row) => Math.abs(row.goalsFor - row.goalsAgainst) <= 1).length;
  return {
    n,
    win: rate(summary.wins, n),
    draw: rate(summary.draws, n),
    scored: rate(n - summary.failedToScore, n),
    conceded: rate(n - summary.cleanSheets, n),
    clean: rate(summary.cleanSheets, n),
    btts: rate(summary.btts, n),
    under25: rate(n - (summary.overs?.[goalLine] ?? 0), n),
    close: rate(close, n),
    goalsFor: round(summary.avg?.goalsFor),
    goalsAgainst: round(summary.avg?.goalsAgainst),
    yellows: round(summary.avg?.yellowsFor),
  };
}

/** Promedio de goles y de empates de la liga, con la tabla de posiciones. */
function leagueOf(standings) {
  const played = standings.reduce((sum, row) => sum + (row.played || 0), 0);
  if (!standings.length || played <= 0) return null;
  const goals = standings.reduce((sum, row) => sum + (row.goalsFor || 0), 0);
  const draws = standings.reduce((sum, row) => sum + (row.draws || 0), 0);
  // Cada partido aparece dos veces en la tabla (una por equipo).
  return { goals: round((2 * goals) / played), draws: round(draws / played), teams: standings.length };
}

function tableOf(team, standings) {
  const row = standings.find((candidate) => namesMatch(candidate.team, team.name));
  return {
    position: row?.position ?? team.position ?? null,
    ppg: row && row.played > 0 ? round(row.points / row.played) : null,
  };
}

function teamOf(analysis, side) {
  const team = analysis.match[side];
  const summaries = analysis.summaries[side];
  return {
    ...tableOf(team, analysis.match.standings ?? []),
    ...formOf(team.form),
    venue: venueOf(summaries.venue, summaries.venueRows ?? []),
    yellows: round(summaries.recent?.avg?.yellowsFor),
    absences: round(analysis.absences?.[side]?.factor ?? 1),
  };
}

/**
 * @param {import('./analyzeMatch.js').MatchAnalysis} analysis
 */
export function matchSignals(analysis) {
  const { match, probabilities, binary, lambdas, summaries } = analysis;
  const fair = (key) => analysis.quotes.get('result', key)?.fairProbability ?? null;
  const h2h = summaries.h2h;
  return {
    version: SIGNALS_VERSION,
    league: leagueOf(match.standings ?? []),
    home: teamOf(analysis, 'home'),
    away: teamOf(analysis, 'away'),
    model: {
      home: round(probabilities.result.home),
      draw: round(probabilities.result.draw),
      away: round(probabilities.result.away),
      goals: round(lambdas.final.home + lambdas.final.away),
      btts: round(binary.btts.final),
      over25: round(binary.overs?.[2.5]?.final ?? probabilities.overs?.[2.5]),
    },
    market: { home: round(fair('home')), draw: round(fair('draw')), away: round(fair('away')) },
    referee: match.refereeStats ? { games: match.refereeStats.games, yellows: round(match.refereeStats.yellowsPerGame) } : null,
    h2h: h2h?.n ? { n: h2h.n, draws: rate(h2h.draws, h2h.n) } : null,
  };
}
