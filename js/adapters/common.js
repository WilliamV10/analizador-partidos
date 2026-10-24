/**
 * Piezas compartidas por los adaptadores: el JSON v2 (un partido) y v3/v4 (varios)
 * describen cada partido casi igual, así que la conversión vive aquí una sola vez.
 */
import { parseMarketLines } from '../domain/odds.js';
import { parseScoreLine, toTeamRow } from '../domain/matchRows.js';
import { namesMatch } from '../utils/text.js';

const POSITION_SUFFIX = /^(.*?)\s*\(([GDMF])\)$/;
const ABSENCE = /^(.*?) - (missing|doubtful): (.*)$/;
const STANDING = /^(\d+)\.\s+(.+?)\s+(-?\d+)pts\s+PJ(\d+)\s+(\d+)-(\d+)-(\d+)\s+GF(\d+)\s+GC(\d+)$/;
const TITLE_SEPARATOR = ' vs ';

const toNumber = (value, fallback = 0) => (Number.isFinite(Number(value)) ? Number(value) : fallback);

/** "Camilo Vargas (G)" -> { name: 'Camilo Vargas', position: 'G' } */
export function parseLineupPlayer(text) {
  const match = String(text).match(POSITION_SUFFIX);
  return match ? { name: match[1].trim(), position: match[2] } : { name: String(text).trim(), position: null };
}

/** "Duk - missing: Knee Injury" -> { name: 'Duk', status: 'missing', reason: 'Knee Injury' } */
export function parseAbsence(text) {
  const match = String(text).match(ABSENCE);
  return match
    ? { name: match[1].trim(), status: match[2], reason: match[3].trim() }
    : { name: String(text).trim(), status: null, reason: null };
}

/** @returns {import('../types.js').Lineup|null} */
export function parseLineup(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const starters = (raw.titulares ?? []).map(parseLineupPlayer);
  const substitutes = (raw.suplentes ?? []).map((name) => parseLineupPlayer(name).name);
  const absences = (raw.bajas ?? []).map(parseAbsence);
  if (!starters.length && !substitutes.length && !absences.length && !raw.formation) return null;
  return { formation: raw.formation ?? null, starters, substitutes, absences };
}

/** @returns {import('../types.js').Player} */
export function parsePlayer(raw) {
  return {
    name: String(raw.nombre ?? ''),
    appearances: toNumber(raw.pj),
    starts: toNumber(raw.titular),
    minutes: toNumber(raw.min),
    shotsOnTarget: toNumber(raw.tirosPuerta),
    shots: toNumber(raw.tiros),
    goals: toNumber(raw.goles),
    xg: raw.xG === undefined || raw.xG === null ? null : toNumber(raw.xG, null),
    assists: toNumber(raw.asist),
  };
}

/**
 * Historial del árbitro: { partidos, amarillas, rojas } -> { games, yellows, reds, yellowsPerGame }.
 * @returns {import('../types.js').RefereeStats|null}
 */
export function parseRefereeStats(raw) {
  const games = toNumber(raw?.partidos);
  if (!(games > 0) || !Number.isFinite(Number(raw?.amarillas))) return null;
  const yellows = toNumber(raw.amarillas);
  return { games, yellows, reds: toNumber(raw.rojas), yellowsPerGame: yellows / games };
}

/** "1. Club América 24pts PJ11 7-3-1 GF27 GC14" -> Standing */
export function parseStandingLine(line) {
  const match = String(line).trim().match(STANDING);
  if (!match) return null;
  const [, position, team, points, played, wins, draws, losses, goalsFor, goalsAgainst] = match;
  return {
    position: Number(position),
    team: team.trim(),
    points: Number(points),
    played: Number(played),
    wins: Number(wins),
    draws: Number(draws),
    losses: Number(losses),
    goalsFor: Number(goalsFor),
    goalsAgainst: Number(goalsAgainst),
  };
}

export function parseStandings(lines) {
  return Array.isArray(lines) ? lines.map(parseStandingLine).filter(Boolean) : [];
}

export function splitTitle(title) {
  const [home = '', away = ''] = String(title ?? '').split(TITLE_SEPARATOR);
  return { home: home.trim(), away: away.trim() };
}

function toRows(rawRows, block) {
  return (rawRows ?? [])
    .map((raw) => toTeamRow(raw, { isHome: raw.condicion === 'local', block }))
    .filter(Boolean);
}

/** ¿El partido H2H se jugó con nuestro local como local? null si no se puede saber. */
function playedAtHome(rawH2h, homeName) {
  const score = parseScoreLine(rawH2h?.partido);
  if (!score) return null;
  if (score.homeName === homeName) return true;
  if (score.awayName === homeName) return false;
  if (namesMatch(score.homeName, homeName)) return true;
  if (namesMatch(score.awayName, homeName)) return false;
  return null;
}

function toH2hRows(rawRows, homeName) {
  return (rawRows ?? [])
    .map((raw) => {
      const isHome = playedAtHome(raw, homeName);
      return isHome === null ? null : toTeamRow(raw, { isHome, block: 'h2h' });
    })
    .filter(Boolean);
}

function buildTeam({ name, rawTeam = {}, rawLineup, rawForm }) {
  return {
    name,
    position: Number.isFinite(rawForm?.position) ? rawForm.position : null,
    form: Array.isArray(rawForm?.form) ? rawForm.form : [],
    lineup: parseLineup(rawLineup),
    current: toRows(rawTeam.partidos, 'current'),
    other: toRows(rawTeam.partidosLiga, 'other'),
    otherName: rawTeam.ligaNombre ?? null,
    previous: toRows(rawTeam.partidosTempPasada, 'previous'),
    players: (rawTeam.jugadores ?? []).map(parsePlayer),
  };
}

/**
 * Convierte un partido crudo (mismo esquema en v2 y v3/v4) al modelo interno.
 * @param {Object} raw
 * @param {{ source: string, standings: import('../types.js').Standing[], fallbackId: string }} options
 * @returns {import('../types.js').Match}
 */
export function buildMatch(raw, { source, standings, fallbackId }) {
  const names = splitTitle(raw.partido);
  const { markets, duplicates } = parseMarketLines(raw.cuotas);
  return {
    id: String(raw.id ?? fallbackId),
    source,
    title: `${names.home} vs ${names.away}`,
    tournament: raw.torneo ?? null,
    round: Number.isFinite(raw.jornada) ? raw.jornada : null,
    kickoff: raw.hora ?? null,
    status: raw.estado ?? null,
    score: raw.marcador ?? null,
    referee: raw.arbitro ?? null,
    refereeStats: parseRefereeStats(raw.arbitroStats),
    venue: raw.estadio ?? null,
    lineupsConfirmed: raw.alineacionesConfirmadas === true,
    home: buildTeam({
      name: names.home,
      rawTeam: raw.local,
      rawLineup: raw.alineacionLocal,
      rawForm: raw.forma?.homeTeam,
    }),
    away: buildTeam({
      name: names.away,
      rawTeam: raw.visita,
      rawLineup: raw.alineacionVisita,
      rawForm: raw.forma?.awayTeam,
    }),
    h2h: toH2hRows(raw.h2h, names.home),
    odds: markets,
    duplicateMarkets: duplicates,
    standings,
  };
}
