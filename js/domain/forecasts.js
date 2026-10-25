/**
 * Pronóstico del modelo: en cada partido, la selección más probable de tres mercados
 * (ganador 1X2, ambos anotan Sí/No y más/menos de 2.5), haya o no valor en la cuota.
 * Sirve para medir cuánto acierta el modelo, aparte de las apuestas con valor.
 *
 * Se calcula a partir de los registros del historial (cada selección guarda su
 * probabilidad), así que también funciona con registros guardados antes de esta función.
 */
import { FORECAST_MARKETS } from './history.js';
import { SETTLEMENT } from './settlement.js';

/** Registro del historial -> id del mercado de pronóstico (result, btts, goals25) o null. */
function forecastIdOf(record) {
  return (
    FORECAST_MARKETS.find(
      ({ market }) => market.type === record.market.type && (market.line ?? null) === (record.market.line ?? null),
    )?.id ?? null
  );
}

/**
 * @typedef {Object} ForecastEntry
 * @property {string} id           result, btts o goals25
 * @property {import('./history.js').HistoryRecord} record  la selección elegida (la más probable)
 * @property {boolean|null} hit    null mientras no se liquide
 */

/**
 * Un pronóstico por partido y mercado: la selección con más probabilidad.
 * @param {import('./history.js').HistoryRecord[]} records
 * @returns {ForecastEntry[]}
 */
export function forecastEntries(records) {
  const best = new Map();
  records.forEach((record) => {
    const id = forecastIdOf(record);
    if (!id) return;
    const key = `${record.matchId}|${id}`;
    const current = best.get(key);
    if (!current || record.probability > current.record.probability) best.set(key, { id, record });
  });
  return [...best.values()].map(({ id, record }) => ({
    id,
    record,
    hit: record.settlement ? record.settlement.status === SETTLEMENT.WIN : null,
  }));
}

function rate(entries) {
  const settled = entries.filter((entry) => entry.hit !== null);
  const hits = settled.filter((entry) => entry.hit).length;
  return {
    count: settled.length,
    hits,
    pending: entries.length - settled.length,
    hitRate: settled.length ? hits / settled.length : null,
    expected: settled.length ? settled.reduce((sum, entry) => sum + entry.record.probability, 0) / settled.length : null,
  };
}

/**
 * Acierto del pronóstico: total y por mercado. `expected` es el acierto que el propio
 * modelo esperaba (promedio de sus probabilidades): si `hitRate` queda muy por debajo,
 * el modelo se está sobrestimando.
 * @param {import('./history.js').HistoryRecord[]} records
 */
export function forecastPerformance(records) {
  const entries = forecastEntries(records);
  return {
    total: rate(entries),
    byMarket: FORECAST_MARKETS.map(({ id }) => ({ key: id, ...rate(entries.filter((entry) => entry.id === id)) })),
    entries,
  };
}

