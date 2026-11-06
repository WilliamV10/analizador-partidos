/**
 * Caso de uso: armar el script de Sofascore con lo elegido en la página (ligas, horario de
 * cada una, día, modo), listo para copiar y pegar. Sirve sobre todo en el celular: el script
 * sale en UNA línea corta (el v5 minificado, scripts/sofascore_v5.min.js) que entra completa
 * en el portapapeles.
 *
 * El minificado es  (CFG=>{...})(__CFG__) : aquí solo se cambia __CFG__ por un objeto con lo
 * elegido; lo demás usa los valores de CONFIGURACION del v5. Dos formatos:
 *  - consola: se pega en la consola de sofascore.com;
 *  - marcador: "javascript:..." para guardarlo como favorito y abrirlo estando en sofascore.com.
 */

const CFG_PLACEHOLDER = '__CFG__';

/**
 * @typedef {Object} ScriptOptions
 * @property {'proximos'|'historico'} mode
 * @property {'hoy'|'manana'|'ayer'|'fecha'|'dias'} day
 * @property {string} [date]        AAAA-MM-DD si day = 'fecha'
 * @property {number} [days]        si day = 'dias' (hoy + N días, o los últimos N en histórico)
 * @property {{ name: string, from?: string, to?: string }[]} leagues
 * @property {string} [from]        horario de las ligas sin horario propio ('14:00' o vacío)
 * @property {string} [to]
 * @property {number} [maxMatches]
 */

const HOUR = /^\d{1,2}:\d{2}$/;
const hourOrNull = (value) => (HOUR.test(String(value ?? '').trim()) ? String(value).trim() : null);

/** Una liga como la entiende el script: 'Premier League', 17 o { liga, desde, hasta }. */
function leagueEntry({ name, from, to }) {
  const clean = String(name ?? '').trim();
  const reference = /^\d+$/.test(clean) ? Number(clean) : clean;
  const desde = hourOrNull(from);
  const hasta = hourOrNull(to);
  return desde || hasta ? { liga: reference, desde, hasta } : reference;
}

/**
 * Valores de CONFIGURACION según lo elegido (los que no están aquí quedan como en el v5).
 * @param {ScriptOptions} options
 */
export function configValues(options) {
  const fixedDay = { hoy: 'hoy', manana: 'manana', ayer: 'ayer' }[options.day];
  return {
    TORNEOS: (options.leagues ?? []).filter((league) => String(league.name ?? '').trim()).map(leagueEntry),
    MODO: options.mode === 'historico' ? 'historico' : 'proximos',
    FECHA: fixedDay ?? (options.day === 'fecha' && /^\d{4}-\d{2}-\d{2}$/.test(options.date ?? '') ? options.date : null),
    DIAS: options.day === 'dias' ? Math.max(0, Math.min(14, Math.round(Number(options.days) || 0))) : 0,
    HORA_DESDE: hourOrNull(options.from),
    HORA_HASTA: hourOrNull(options.to),
    MAX_PARTIDOS: Math.max(1, Math.min(150, Math.round(Number(options.maxMatches) || 40))),
  };
}

/**
 * Script para pegar en la consola: una sola línea.
 * @param {string} minified  texto de scripts/sofascore_v5.min.js
 * @param {ScriptOptions} options
 */
export function buildSofascoreScript(minified, options) {
  const code = minified.trim();
  if (!code.includes(CFG_PLACEHOLDER)) throw new Error('El script minificado no tiene __CFG__: vuelve a generarlo.');
  return code.replace(CFG_PLACEHOLDER, JSON.stringify(configValues(options)));
}

/**
 * El mismo script como marcador ("javascript:..."): en una URL el % se escribe %25.
 * @param {string} minified
 * @param {ScriptOptions} options
 */
export function buildSofascoreBookmarklet(minified, options) {
  return `javascript:${buildSofascoreScript(minified, options).replace(/%/g, '%25')}void 0`;
}
