/**
 * Última carga del usuario (los JSON tal como se subieron, el modo y el bloque de Claude)
 * en IndexedDB, para que al cerrar o recargar la página no haya que subirlos otra vez.
 * Se borra con "Limpiar" y se reemplaza al cargar otros datos.
 * Nunca lanza: sin IndexedDB (modo privado estricto) simplemente no se guarda nada.
 */

const DB_NAME = 'analizador-sesion';
const DB_VERSION = 1;
const STORE = 'session';
const KEY = 'current';

function promisify(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

let databasePromise = null;

function database() {
  if (!databasePromise) {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE);
    };
    databasePromise = promisify(request);
  }
  return databasePromise;
}

async function run(mode, operate) {
  const transaction = (await database()).transaction(STORE, mode);
  return promisify(operate(transaction.objectStore(STORE)));
}

/**
 * @typedef {Object} SavedSession
 * @property {{ name: string, text: string }[]} sources
 * @property {string} mode
 * @property {string|null} contextText  bloque de Claude aplicado (texto pegado)
 * @property {number} savedAt
 */

/** @returns {Promise<SavedSession|null>} */
export async function loadSession() {
  try {
    const session = await run('readonly', (store) => store.get(KEY));
    return Array.isArray(session?.sources) && session.sources.length ? session : null;
  } catch {
    return null;
  }
}

/** @param {SavedSession} session */
export async function saveSession(session) {
  try {
    await run('readwrite', (store) => store.put(session, KEY));
  } catch {
    /* Sin almacenamiento: la carga dura solo esta sesión. */
  }
}

/** Cambia solo el bloque de Claude de la sesión guardada. */
export async function saveSessionContext(contextText) {
  const session = await loadSession();
  if (session) await saveSession({ ...session, contextText });
}

export async function clearSession() {
  try {
    await run('readwrite', (store) => store.delete(KEY));
  } catch {
    /* Nada que borrar. */
  }
}
