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

const HEADER = `// ===== Sofascore -> JSON de los partidos de una o varias ligas, por dia y hora =====
// ARCHIVO GENERADO desde sofascore_multi_v5.js (node scripts/generar_script_liga.mjs): no lo edites a mano.
//
// Uso: abre cualquier pagina de sofascore.com, F12 -> "Console", pega todo y Enter.
// Al final descarga UN archivo .json: subelo en la pagina del analizador (Cargar JSON).
// Puedes pegarlo varias veces sin recargar la pagina (todo va dentro de un bloque { }).
//
// Cambia solo la CONFIGURACION de abajo:
//  - LIGAS: una o varias, cada una con su horario si quieres (hora local):
//        ['Premier League']                                  una liga, todo el dia
//        ['Premier League 09:00-12:00', 'MLS 18:00-23:30']   cada una en su horario
//        ['LaLiga', 17, { liga: 'Liga MX', desde: '19:00', hasta: '23:59' }]
//  - FECHA: 'hoy', 'manana', 'ayer' o una fecha '2026-11-08'.
//  - HORA_DESDE / HORA_HASTA: horario de las ligas que no traen el suyo (ej. '14:00' y '18:30'); null = todo el dia.
//  - MODO: 'proximos' (por jugar) o 'historico' (ya jugados, para medir el modelo; usa FECHA 'ayer' o pasada).
//
// Va despacio a proposito para que Sofascore no bloquee; si bloquea, para y descarga lo que tenga.
// En el CELULAR: deja la pestaña abierta y la pantalla encendida mientras corre.
// Para cortar y descargar lo que ya tiene: window._sofaParar = true
`;

const CONFIG = [
  ["const TORNEOS = ['Premier League', 'LaLiga', 'Serie A', 'Bundesliga', 'MLS']; // nombres o ids (Premier = 17); con horario: 'MLS 18:00-23:30'",
    "const LIGAS = ['Premier League']; // una o varias: 'LaLiga', 17, con horario 'MLS 18:00-23:30'\nconst TORNEOS = LIGAS;"],
  ['const DIAS = 2;                 // proximos: hoy + N dias. historico: ultimos N dias',
    'const DIAS = 0;                 // (solo si FECHA es null) proximos: hoy + N dias. historico: ultimos N dias'],
  ["const FECHA = null;             // un solo dia en vez de DIAS: 'hoy', 'manana', 'ayer' o '2026-11-08' (null = usar DIAS)",
    "const FECHA = 'hoy';            // 'hoy', 'manana', 'ayer' o '2026-11-08'"],
  ["const HORA_DESDE = null;        // ligas sin horario propio: desde esta hora (tu hora local), ej. '14:00' (null = sin limite)",
    "const HORA_DESDE = null;        // ligas sin horario propio: desde esta hora (tu hora local), ej. '14:00'; null = desde las 00:00"],
  ["const HORA_HASTA = null;        // ... y hasta esta hora, ej. '18:30' (null = sin limite)",
    "const HORA_HASTA = null;        // ... y hasta esta hora, ej. '18:30'; null = hasta las 23:59"],
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
