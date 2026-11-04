// Genera scripts/sofascore_liga.js a partir de scripts/sofascore_multi_v5.js.
// El script de liga es el mismo motor que el v5 (mismo cuidado con Sofascore y el mismo JSON),
// solo cambian el encabezado y la configuracion: una liga, un dia y un rango de horas.
//
// Si cambias sofascore_multi_v5.js, vuelve a generarlo:   node scripts/generar_script_liga.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const folder = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(folder, 'sofascore_multi_v5.js'), 'utf8');

const HEADER = `// ===== Sofascore -> JSON de los partidos de UNA liga, por dia y hora =====
// ARCHIVO GENERADO desde sofascore_multi_v5.js (node scripts/generar_script_liga.mjs): no lo edites a mano.
//
// Uso: abre cualquier pagina de sofascore.com, F12 -> "Console", pega todo y Enter.
// Al final descarga UN archivo .json: subelo en la pagina del analizador (Cargar JSON).
// Puedes pegarlo varias veces sin recargar la pagina (todo va dentro de un bloque { }).
//
// Cambia solo la CONFIGURACION de abajo:
//  - LIGA: nombre o id de la liga (ej. 'Premier League', 'LaLiga', 'Liga MX', 17).
//  - FECHA: 'hoy', 'manana', 'ayer' o una fecha '2026-11-08'.
//  - HORA_DESDE / HORA_HASTA: rango de horas en tu hora local (ej. '14:00' y '18:30'); null = todo el dia.
//  - MODO: 'proximos' (por jugar) o 'historico' (ya jugados, para medir el modelo; usa FECHA 'ayer' o pasada).
//
// Va despacio a proposito para que Sofascore no bloquee; si bloquea, para y descarga lo que tenga.
// En el CELULAR: deja la pestaña abierta y la pantalla encendida mientras corre.
// Para cortar y descargar lo que ya tiene: window._sofaParar = true
`;

const CONFIG = [
  ["const TORNEOS = ['Premier League', 'LaLiga', 'Serie A', 'Bundesliga', 'MLS']; // nombres o ids (Premier = 17)",
    "const LIGA = 'Premier League';  // nombre o id de la liga (Premier = 17)\nconst TORNEOS = [LIGA];"],
  ['const DIAS = 2;                 // proximos: hoy + N dias. historico: ultimos N dias',
    'const DIAS = 0;                 // (solo si FECHA es null) proximos: hoy + N dias. historico: ultimos N dias'],
  ["const FECHA = null;             // un solo dia en vez de DIAS: 'hoy', 'manana', 'ayer' o '2026-11-08' (null = usar DIAS)",
    "const FECHA = 'hoy';            // 'hoy', 'manana', 'ayer' o '2026-11-08'"],
  ["const HORA_DESDE = null;        // solo partidos que empiezan desde esta hora (tu hora local), ej. '14:00' (null = sin limite)",
    "const HORA_DESDE = null;        // desde esta hora (tu hora local), ej. '14:00'; null = desde las 00:00"],
  ["const HORA_HASTA = null;        // ... y hasta esta hora, ej. '18:30' (null = sin limite)",
    "const HORA_HASTA = null;        // hasta esta hora, ej. '18:30'; null = hasta las 23:59"],
  ['const MAX_PARTIDOS = 80;        // tope total (los mas cercanos a hoy primero)',
    'const MAX_PARTIDOS = 40;        // tope de partidos'],
];

const body = source.slice(source.indexOf('{ // bloque'));
let output = HEADER + '\n' + body;
for (const [from, to] of CONFIG) {
  if (!output.includes(from)) throw new Error(`No encontre en sofascore_multi_v5.js la linea:\n${from}\n(si cambio, actualiza CONFIG en este generador)`);
  output = output.replace(from, to);
}
writeFileSync(join(folder, 'sofascore_liga.js'), output);
console.log('Listo: scripts/sofascore_liga.js');
