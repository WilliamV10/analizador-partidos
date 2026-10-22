/**
 * Capa 2: tablas editables de conocimiento sobre ligas y competiciones.
 * Edita estos valores para afinar el modelo; el resto del código no cambia.
 */

/**
 * Nivel relativo de cada liga (Premier = 1.00). Escala los partidos de
 * "otra competición" frente a la competición del partido.
 * `match` se compara con el nombre que trae Sofascore (sin acentos ni mayúsculas).
 */
export const LEAGUE_COEFFICIENTS = Object.freeze([
  { match: 'uefa champions league', coefficient: 1.0 },
  { match: 'premier league', coefficient: 1.0 },
  { match: 'laliga', coefficient: 0.97 },
  { match: 'serie a', coefficient: 0.95 },
  { match: 'bundesliga', coefficient: 0.93 },
  { match: 'ligue 1', coefficient: 0.88 },
  { match: 'uefa europa league', coefficient: 0.88 },
  { match: 'liga portugal', coefficient: 0.82 },
  { match: 'liga mx', coefficient: 0.8 },
  { match: 'uefa conference league', coefficient: 0.8 },
  { match: 'eredivisie', coefficient: 0.78 },
  { match: 'brasileirao', coefficient: 0.78 },
  { match: 'mls', coefficient: 0.74 },
  { match: 'super lig', coefficient: 0.75 },
  { match: 'pro league', coefficient: 0.75 },
  { match: 'championship', coefficient: 0.74 },
  { match: 'liga profesional', coefficient: 0.74 },
  { match: 'j1 league', coefficient: 0.7 },
  { match: 'bundesliga austria', coefficient: 0.7 },
  { match: 'concacaf champions', coefficient: 0.72 },
  { match: 'copa libertadores', coefficient: 0.76 },
  { match: 'afc champions', coefficient: 0.66 },
  { match: 'eliteserien', coefficient: 0.65 },
  { match: 'liga de expansion', coefficient: 0.55 },
]);

/**
 * Peso de cada partido según el tipo de competición (el primero que coincide gana).
 * Los amistosos no cuentan; previas y copas cuentan menos que la liga.
 */
export const COMPETITION_WEIGHTS = Object.freeze([
  { pattern: /friendl|amistos|club friendly/i, weight: 0 },
  { pattern: /qualif|preliminar|play-?off|previa/i, weight: 0.6 },
  { pattern: /\bcup\b|copa|pokal|coupe|coppa|taça|taca|beker|trophy|shield|super ?cup/i, weight: 0.7 },
]);

export const DEFAULT_COMPETITION_WEIGHT = 1;

/**
 * Ventaja de local por liga (sobrescribe lambda.homeAdvantage / awayDisadvantage).
 * La Liga MX es mayor por la altitud de varios estadios.
 */
export const HOME_ADVANTAGE_BY_LEAGUE = Object.freeze([
  { match: 'liga mx', homeAdvantage: 1.15, awayDisadvantage: 0.86 },
  { match: 'liga de expansion', homeAdvantage: 1.15, awayDisadvantage: 0.86 },
]);
