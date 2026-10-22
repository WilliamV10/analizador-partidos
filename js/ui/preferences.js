/**
 * Preferencias del usuario en localStorage. Nunca lanza: en modo privado o con
 * el almacenamiento bloqueado simplemente devuelve el valor por defecto.
 */

export function readPreference(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value === null ? fallback : value;
  } catch {
    return fallback;
  }
}

export function writePreference(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* Sin almacenamiento: la preferencia dura solo esta sesión. */
  }
}

export function readJsonPreference(key, fallback) {
  try {
    return JSON.parse(readPreference(key, 'null')) ?? fallback;
  } catch {
    return fallback;
  }
}

export function writeJsonPreference(key, value) {
  writePreference(key, JSON.stringify(value));
}

export function removePreference(key) {
  try {
    localStorage.removeItem(key);
  } catch {
    /* Nada que borrar. */
  }
}
