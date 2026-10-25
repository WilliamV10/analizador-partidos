/**
 * Parámetros del modelo.
 * Regla del proyecto: ningún número "mágico" del análisis vive fuera de este archivo.
 * Cambiar un valor aquí cambia el comportamiento en toda la app (y en los tests que lo usan).
 * Las tablas por liga están en js/config/leagues.js. Algunos valores se pueden
 * sobrescribir desde el panel de ajustes (ver js/app/settings.js).
 */
import {
  COMPETITION_WEIGHTS,
  DEFAULT_COMPETITION_WEIGHT,
  HOME_ADVANTAGE_BY_LEAGUE,
  LEAGUE_COEFFICIENTS,
} from './config/leagues.js';

function deepFreeze(object) {
  Object.values(object).forEach((value) => {
    if (value && typeof value === 'object') deepFreeze(value);
  });
  return Object.freeze(object);
}

export const CONFIG = deepFreeze({
  lambda: {
    /** Peso de las cuotas en los goles esperados finales (el resto son estadísticas). */
    marketWeight: 0.6,
    /** Peso del xG frente a los goles reales al medir ataque y defensa (el xG tiene menos ruido). */
    xgWeight: 0.65,
    /**
     * true: goles esperados = ataque × defensa rival ÷ media de la liga (la media sale de la tabla).
     * false: promedio de ataque y defensa. Sin tabla se usa siempre el promedio.
     */
    multiplicative: true,
    /** Multiplicadores de localía aplicados al cálculo estadístico global. */
    homeAdvantage: 1.1,
    awayDisadvantage: 0.9,
    /** Peso de los partidos "local en casa / visita fuera" dentro del cálculo estadístico. */
    venueSplitWeight: 0.35,
    /** Mínimo de partidos en casa/fuera para usar ese split. */
    minVenueSample: 4,
    /** Goles esperados por defecto cuando no hay datos ni cuotas. */
    fallbackGoals: 1.35,
    /** Búsqueda de los goles esperados que reproducen las cuotas. */
    fit: { min: 0.2, max: 4.5, coarseStep: 0.05, fineStep: 0.01 },
  },
  poisson: {
    maxGoals: 10,
    /**
     * Corrección de Dixon-Coles: < 0 sube el 0-0 y el 1-1 y baja el 1-0 y el 0-1
     * (los estudios dan entre −0.05 y −0.13). 0 = Poisson independiente.
     */
    dixonColesRho: -0.08,
  },
  recency: {
    /** Peso por antigüedad en los λ por estadísticas. */
    enabled: true,
    /** Días tras los que un partido pesa la mitad. */
    halfLifeDays: 120,
  },
  empirical: {
    /**
     * "Partidos virtuales" que se le dan al modelo al mezclarlo con lo ocurrido realmente.
     * Un porcentaje de 10 partidos tiene ±15 % de error, así que lo empírico debe pesar poco
     * (10 partidos reales → 25 % de peso).
     */
    priorStrength: 30,
    /** Peso máximo que puede tener lo ocurrido realmente frente al modelo. */
    maxWeight: 0.3,
    /** Peso de cada partido H2H frente a uno de la temporada. */
    h2hWeight: 0.5,
  },
  data: {
    /** Partidos con este total de goles o más se excluyen (suelen ser marcadores de penales). */
    anomalousTotalGoals: 12,
    /** Menos partidos que esto en el bloque reciente genera alerta de muestra chica. */
    smallSample: 6,
  },
  value: {
    highEv: 0.08,
    mediumEv: 0.04,
    /** Por debajo de esta probabilidad no se recomienda (cuotas largas: el error del modelo pesa demasiado). */
    minProbability: 0.3,
    /** Por debajo de esta cuota no se recomienda (no compensa el riesgo). */
    minOdds: 1.15,
    /** Diferencia máxima modelo vs. realidad para que un pick pueda ser de confianza alta. */
    maxModelEmpiricalGap: 0.1,
    /** Diferencia máxima estadísticas vs. mercado para que un pick 1X2 pueda ser de confianza alta. */
    maxStatsMarketGap: 0.12,
    /** Muestra mínima para confianza alta. */
    minSampleHigh: 8,
    /** Ventaja máxima creíble sobre la casa (probabilidad propia − justa). Más que esto = nivel bajo. */
    maxEdge: 0.15,
  },
  schedule: {
    /** Ajuste por calendario: corrige cada partido por la fuerza del rival en la tabla. */
    enabled: true,
    /** Exponente sobre la fuerza (0.5 = raíz: suaviza el ajuste). */
    exponent: 0.5,
    minStrength: 0.5,
    maxStrength: 1.8,
    /** Equipos mínimos en la tabla para confiar en ella. */
    minTeams: 6,
  },
  leagues: {
    coefficients: LEAGUE_COEFFICIENTS,
    weights: COMPETITION_WEIGHTS,
    defaultWeight: DEFAULT_COMPETITION_WEIGHT,
    homeAdvantage: HOME_ADVANTAGE_BY_LEAGUE,
  },
  absences: {
    /** Bajas cuantificadas: restan al λ por estadísticas la parte del xG que se pierde. */
    enabled: true,
    /** Parte del aporte que recupera el reemplazo. */
    replacement: 0.5,
    /** Una duda cuenta como esta fracción de baja. */
    doubtfulWeight: 0.5,
    /** Aporte mínimo (parte del xG del equipo) para tener en cuenta a un jugador. */
    minShare: 0.05,
    /** El λ nunca baja más que esto por bajas. */
    minFactor: 0.7,
  },
  alerts: {
    /** Diferencia de goles totales (estadísticas vs. mercado) que dispara "revisar con Claude". */
    divergenceGoals: 0.6,
    /** Diferencia máxima en una probabilidad 1X2 (estadísticas vs. casa) que dispara la alerta. */
    divergenceProbability: 0.15,
  },
  halfTime: {
    /** Proporción de goles en el 1er tiempo cuando no hay datos. */
    defaultShare: 0.45,
    /** "Goles virtuales" del valor por defecto al mezclarlo con lo ocurrido. */
    priorGoals: 20,
    goalLines: [0.5, 1.5, 2.5],
  },
  counts: {
    maxCount: 40,
    /** Peso del total que implica la cuota de corners/tarjetas (el resto son estadísticas). */
    marketWeight: 0.5,
    /** Partidos mínimos en casa/fuera con el dato; si no, se usan todos los recientes. */
    minVenueSample: 4,
    /** dispersión = varianza / media (1 = Poisson). */
    corners: { dispersion: 1.3, lines: [7.5, 8.5, 9.5, 10.5, 11.5, 12.5], teamLines: [2.5, 3.5, 4.5, 5.5, 6.5] },
    cornersFirstHalf: { dispersion: 1.3, lines: [3.5, 4.5, 5.5], teamLines: [1.5, 2.5, 3.5] },
    yellows: {
      dispersion: 1.4,
      lines: [2.5, 3.5, 4.5, 5.5, 6.5],
      teamLines: [0.5, 1.5, 2.5, 3.5],
      /** Mezcla con el promedio del árbitro: peso = partidos / (partidos + priorGames), máximo maxWeight. */
      referee: { maxWeight: 0.35, priorGames: 40 },
    },
  },
  players: {
    /** Minutos esperados según el estado en la alineación. */
    minutes: { starter: 80, bench: 25, doubtful: 40, out: 0, notListed: 0 },
    /** Con menos minutos que esto, el ritmo se encoge hacia la media del puesto. */
    shrinkMinutes: 450,
    /** Media por 90' de cada puesto (G, D, M, F; unknown = sin dato). */
    priorPer90: {
      shotsOnTarget: { G: 0.02, D: 0.25, M: 0.5, F: 1.0, unknown: 0.55 },
      shots: { G: 0.05, D: 0.7, M: 1.4, F: 2.6, unknown: 1.5 },
    },
    /** Lo que concede un equipo medio por partido (para el ajuste por rival). */
    leagueAverage: { shotsOnTarget: 4.5, shots: 12.5 },
    /** Jugadores que se muestran por equipo. */
    shown: 10,
  },
  context: {
    /** Tope de cada ajuste del bloque de Claude (0.3 = ±30 %). */
    maxAdjustment: 0.3,
  },
  combos: {
    minSelections: 2,
    maxSelections: 4,
    /** Nivel mínimo de cada selección. */
    minTier: 'medium',
    minOdds: 1.5,
    /** Excepciones de cuota mínima por tipo de mercado (ej. "equipo anota"). */
    minOddsByType: { teamScores: 1.15 },
    /** Picks elegibles por partido que se prueban al armar combinadas. */
    candidatesPerMatch: 2,
    /** Combinadas que se muestran por criterio. */
    shown: 3,
  },
  history: {
    /** Partidos pendientes que entran en un script de resultados (Sofascore limita peticiones). */
    maxScriptMatches: 40,
    /** Rangos de probabilidad en la tabla de calibración (10 = de 10 en 10 %). */
    calibrationBins: 10,
    /** Registros por página en la lista del historial. */
    pageSize: 20,
    /** Monto por defecto al registrar una apuesta (unidades). */
    defaultStake: 1,
  },
  explorer: {
    /** Valor máximo del deslizador de cada estadística en la pantalla Explorar. */
    maxValue: {
      goals: 8,
      goalsHome: 6,
      goalsAway: 6,
      goalsFirstHalf: 5,
      corners: 20,
      cornersHome: 14,
      cornersAway: 14,
      cornersFirstHalf: 10,
      cards: 10,
      cardsHome: 7,
      cardsAway: 7,
    },
  },
  display: {
    goalLines: [0.5, 1.5, 2.5, 3.5, 4.5, 5.5],
    topScores: 8,
    /** Marcadores 0..N-1 por lado en el mapa de calor. */
    scoreGridSize: 6,
    /** Líneas de hándicap asiático (del local) que se muestran además de las que trae la casa. */
    handicapLines: [-1.5, -1, -0.5, 0, 0.5, 1, 1.5],
  },
});
