/**
 * Almacén del historial en IndexedDB (dura entre sesiones, solo en este navegador).
 * Si IndexedDB no está disponible (modo privado estricto), usa memoria y lo indica.
 */

const DB_NAME = 'analizador-partidos';
const DB_VERSION = 1;
const STORE = 'records';

function promisify(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function openDatabase() {
  const request = indexedDB.open(DB_NAME, DB_VERSION);
  request.onupgradeneeded = () => {
    if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE, { keyPath: 'key' });
  };
  return promisify(request);
}

function transactionDone(transaction) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

function indexedDbStore(database) {
  const write = async (operate) => {
    const transaction = database.transaction(STORE, 'readwrite');
    operate(transaction.objectStore(STORE));
    await transactionDone(transaction);
  };
  return {
    persistent: true,
    getAll: () => promisify(database.transaction(STORE).objectStore(STORE).getAll()),
    putMany: (records) => write((store) => records.forEach((record) => store.put(record))),
    deleteMany: (keys) => write((store) => keys.forEach((key) => store.delete(key))),
    clear: () => write((store) => store.clear()),
  };
}

function memoryStore() {
  const records = new Map();
  return {
    persistent: false,
    getAll: async () => [...records.values()],
    putMany: async (list) => list.forEach((record) => records.set(record.key, record)),
    deleteMany: async (keys) => keys.forEach((key) => records.delete(key)),
    clear: async () => records.clear(),
  };
}

/**
 * @returns {Promise<{ persistent: boolean, getAll: () => Promise<Object[]>, putMany: (records: Object[]) => Promise<void>,
 *   deleteMany: (keys: string[]) => Promise<void>, clear: () => Promise<void> }>}
 */
export async function openHistoryStore() {
  try {
    return indexedDbStore(await openDatabase());
  } catch {
    return memoryStore();
  }
}
