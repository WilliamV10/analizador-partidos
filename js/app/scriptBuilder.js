/**
 * Caso de uso: armar el script de Sofascore con lo elegido en la página (ligas, horario de
 * cada una, día, modo), listo para copiar y pegar en la consola. Sirve sobre todo en el
 * celular, donde copiar el archivo entero y editarlo a mano es incómodo.
 *
 * Parte del script v5 (scripts/sofascore_multi_v5.js): cambia solo los valores de su bloque
 * CONFIGURACION y quita los comentarios de línea entera para que pese menos. El motor
 * (cuidado con Sofascore, JSON de salida) es el mismo.
 */

const CONFIG_START = '// ---------- CONFIGURACION ----------';
const ENGINE_START = '(async () => {';

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
const quote = (text) => `'${String(text).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
const hourOrNull = (value) => (HOUR.test(String(value ?? '').trim()) ? quote(String(value).trim()) : 'null');

/** Una liga como la entiende el script: 'MLS 18:00-23:30', 'Premier League' o un id (17). */
function leagueEntry({ name, from, to }) {
  const clean = String(name ?? '').trim();
  const reference = /^\d+$/.test(clean) ? Number(clean) : clean;
  const hasFrom = HOUR.test(String(from ?? '').trim());
  const hasTo = HOUR.test(String(to ?? '').trim());
  if (!hasFrom && !hasTo) return typeof reference === 'number' ? String(reference) : quote(reference);
  return `{ liga: ${typeof reference === 'number' ? reference : quote(reference)}, desde: ${hourOrNull(from)}, hasta: ${hourOrNull(to)} }`;
}

/** Valores de CONFIGURACION que cambian según lo elegido (el resto queda como en el v5). */
export function configValues(options) {
  const leagues = (options.leagues ?? []).filter((league) => String(league.name ?? '').trim());
  const fixedDay = { hoy: 'hoy', manana: 'manana', ayer: 'ayer' }[options.day];
  return {
    TORNEOS: `[${leagues.map(leagueEntry).join(', ')}]`,
    MODO: quote(options.mode === 'historico' ? 'historico' : 'proximos'),
    FECHA: fixedDay ? quote(fixedDay) : options.day === 'fecha' && /^\d{4}-\d{2}-\d{2}$/.test(options.date ?? '') ? quote(options.date) : 'null',
    DIAS: String(options.day === 'dias' ? Math.max(0, Math.min(14, Math.round(Number(options.days) || 0))) : 0),
    HORA_DESDE: hourOrNull(options.from),
    HORA_HASTA: hourOrNull(options.to),
    MAX_PARTIDOS: String(Math.max(1, Math.min(150, Math.round(Number(options.maxMatches) || 40)))),
    DESCARGAR: 'true',
    SOLO_LISTAR: 'false',
  };
}

/**
 * @param {string} source   texto de scripts/sofascore_multi_v5.js
 * @param {ScriptOptions} options
 * @param {string} [stamp]  fecha para el encabezado
 * @returns {string}
 */
export function buildSofascoreScript(source, options, stamp = '') {
  const start = source.indexOf('{ // bloque');
  const configStart = source.indexOf(CONFIG_START);
  const engineStart = source.indexOf(ENGINE_START, configStart);
  if (start < 0 || configStart < 0 || engineStart < 0) throw new Error('El script v5 cambió: no encuentro su configuración.');
  const values = configValues(options);
  const config = source
    .slice(configStart + CONFIG_START.length, engineStart)
    .split('\n')
    .map((line) => {
      const match = line.match(/^const (\w+) = /);
      if (!match) return line.trim().startsWith('//') ? null : line;
      const value = values[match[1]] ?? line.slice(match[0].length).replace(/;\s*(\/\/.*)?$/, '');
      return `const ${match[1]} = ${value};`;
    })
    .filter((line) => line !== null && line.trim() !== '');
  const engine = source
    .slice(engineStart)
    .split('\n')
    .filter((line) => !line.trim().startsWith('//'))
    .join('\n');
  return [
    `// Script de Sofascore armado por el Analizador${stamp ? ` (${stamp})` : ''}. Pégalo en la consola de sofascore.com y Enter.`,
    '// Para cortar y descargar lo que ya tiene: window._sofaParar = true',
    '{',
    ...config,
    engine,
  ].join('\n');
}
