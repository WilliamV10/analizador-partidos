/** Utilidades de texto puras. */

/** Minúsculas, sin acentos ni signos: "Atlético-MG" -> "atleticomg". */
export function normalizeName(name) {
  return String(name ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9ñ]/g, '');
}

/** Coincidencia aproximada: iguales o uno contiene al otro (tras normalizar). */
export function namesMatch(first, second) {
  const a = normalizeName(first);
  const b = normalizeName(second);
  if (!a || !b) return false;
  return a === b || a.includes(b) || b.includes(a);
}
