/**
 * Caso de uso: historial de predicciones y apuestas.
 * Mantiene los registros en memoria y los guarda en el almacén (IndexedDB).
 */
import { mergePredictions, pendingMatchIds, pickRecord, predictionRecords, preferRecord } from '../domain/history.js';
import { applyResults } from '../domain/settlement.js';

/**
 * @param {Awaited<ReturnType<typeof import('../io/historyDb.js').openHistoryStore>>} store
 * @param {() => number} [clock]
 */
export function createHistory(store, clock = () => Date.now()) {
  const records = new Map();

  async function save(changed) {
    if (!changed.length) return 0;
    changed.forEach((record) => records.set(record.key, record));
    await store.putMany(changed);
    return changed.length;
  }

  return {
    persistent: store.persistent,

    async load() {
      (await store.getAll()).forEach((record) => records.set(record.key, record));
    },

    /** @returns {import('../domain/history.js').HistoryRecord[]} */
    list: () => [...records.values()],

    get: (key) => records.get(key) ?? null,

    /** Guarda (o actualiza) las predicciones de los partidos analizados. */
    recordAnalyses(analyses) {
      return save(mergePredictions(records, predictionRecords(analyses, clock())));
    },

    /**
     * Registro guardado de un pick o, si no existe (partido ya empezado), uno nuevo sin guardar.
     * @param {import('../types.js').Match} match
     * @param {import('../domain/value.js').ValuePick} pick
     */
    recordFor(match, pick) {
      const fresh = pickRecord(match, pick, clock());
      return records.get(fresh.key) ?? fresh;
    },

    /**
     * Registra o edita la apuesta del usuario en un registro.
     * @param {import('../domain/history.js').HistoryRecord} record
     * @param {{ odds: number, stake: number }} bet
     */
    saveBet(record, bet) {
      const current = records.get(record.key) ?? record;
      const placedAt = current.bet?.placedAt ?? clock();
      return save([{ ...current, bet: { odds: bet.odds, stake: bet.stake, placedAt } }]);
    },

    removeBet(key) {
      const record = records.get(key);
      return record ? save([{ ...record, bet: null }]) : Promise.resolve(0);
    },

    /** Liquida lo pendiente con los resultados del script. Devuelve cuántos registros se liquidaron. */
    settle(results) {
      return save(applyResults([...records.values()], results, clock()));
    },

    pendingMatchIds: (limit) => pendingMatchIds([...records.values()], limit),

    /** Une un respaldo importado con lo guardado (gana el registro con más información). */
    merge(imported) {
      return save(imported.map((record) => preferRecord(records.get(record.key), record)).filter((record) => records.get(record.key) !== record));
    },

    async clear() {
      records.clear();
      await store.clear();
    },
  };
}
