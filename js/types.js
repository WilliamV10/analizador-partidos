/**
 * Modelo interno de datos (independiente del formato del JSON de Sofascore).
 * Los adaptadores (js/adapters) convierten cualquier formato a estas estructuras;
 * el resto de la app solo conoce estos tipos.
 */

/**
 * @typedef {{ for: number, against: number }} StatPair
 */

/**
 * Un partido pasado visto desde la perspectiva de un equipo.
 * @typedef {Object} TeamMatchRow
 * @property {string|null} date
 * @property {boolean} isHome
 * @property {string} opponent
 * @property {string|null} competition
 * @property {string|null} season
 * @property {'current'|'other'|'previous'|'h2h'} block
 * @property {number} goalsFor
 * @property {number} goalsAgainst
 * @property {number|null} htGoalsFor
 * @property {number|null} htGoalsAgainst
 * @property {Partial<Record<'xg'|'shots'|'shotsOnTarget'|'corners'|'cornersFirstHalf'|'yellows'|'possession', StatPair>>} stats
 */

/**
 * @typedef {Object} LineupPlayer
 * @property {string} name
 * @property {string|null} position  G, D, M o F
 */

/**
 * @typedef {Object} Absence
 * @property {string} name
 * @property {'missing'|'doubtful'|null} status
 * @property {string|null} reason
 */

/**
 * @typedef {Object} Lineup
 * @property {string|null} formation
 * @property {LineupPlayer[]} starters
 * @property {string[]} substitutes
 * @property {Absence[]} absences
 */

/**
 * @typedef {Object} Player
 * @property {string} name
 * @property {number} appearances
 * @property {number} starts
 * @property {number} minutes
 * @property {number} shotsOnTarget
 * @property {number} shots
 * @property {number} goals
 * @property {number|null} xg
 * @property {number} assists
 */

/**
 * @typedef {Object} Team
 * @property {string} name
 * @property {number|null} position
 * @property {string[]} form           W/D/L, el más reciente al final
 * @property {Lineup|null} lineup
 * @property {TeamMatchRow[]} current   temporada actual de la competición del partido
 * @property {TeamMatchRow[]} other     otra competición (liga local o torneo anterior)
 * @property {string|null} otherName
 * @property {TeamMatchRow[]} previous  temporada pasada de la competición
 * @property {Player[]} players
 */

/**
 * @typedef {Object} RawMarket
 * @property {string} name
 * @property {{ label: string, odds: number }[]} selections
 */

/**
 * @typedef {Object} Standing
 * @property {number} position
 * @property {string} team
 * @property {number} points
 * @property {number} played
 * @property {number} wins
 * @property {number} draws
 * @property {number} losses
 * @property {number} goalsFor
 * @property {number} goalsAgainst
 */

/**
 * Historial del árbitro en todas sus competiciones (de Sofascore).
 * @typedef {Object} RefereeStats
 * @property {number} games
 * @property {number} yellows
 * @property {number} reds
 * @property {number} yellowsPerGame
 */

/**
 * @typedef {Object} Match
 * @property {string} id
 * @property {string} source            formato de origen: v2, v3 o v4
 * @property {string} title             "Local vs Visita"
 * @property {string|null} tournament
 * @property {number|null} round
 * @property {string|null} kickoff      texto tal como viene del script
 * @property {string|null} status
 * @property {string|null} score
 * @property {string|null} referee
 * @property {RefereeStats|null} refereeStats
 * @property {string|null} venue
 * @property {boolean} lineupsConfirmed
 * @property {Team} home
 * @property {Team} away
 * @property {TeamMatchRow[]} h2h        desde la perspectiva del local
 * @property {RawMarket[]} odds
 * @property {string[]} duplicateMarkets
 * @property {Standing[]} standings
 */

/**
 * Resultado de una apuesta: probabilidades de ganar, devolución y perder.
 * @typedef {{ win: number, push: number, loss: number }} Outcome
 */

export {};
