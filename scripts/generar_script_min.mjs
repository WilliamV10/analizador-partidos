// Genera scripts/sofascore_v5.min.js: el script v5 minificado (mismo motor, sin comentarios ni
// espacios y con nombres cortos) para que el armador de la página (pantalla de carga) lo copie
// en una sola línea corta, que entra completa en el portapapeles del celular.
//
// El archivo queda como  (CFG=>{...})(__CFG__)  : el armador cambia __CFG__ por un objeto con lo
// elegido (ligas, día, modo...). Lo que no venga en ese objeto usa el valor de CONFIGURACION del v5.
//
// Si cambias sofascore_multi_v5.js, vuelve a generarlo:   node scripts/generar_script_min.mjs
// (usa terser con npx: necesita internet la primera vez)
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const TERSER = 'terser@5.36.0';
const folder = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(folder, 'sofascore_multi_v5.js'), 'utf8');

const configStart = source.indexOf('// ---------- CONFIGURACION ----------');
const engineStart = source.indexOf('(async () => {', configStart);
const blockEnd = source.lastIndexOf('}');
if (configStart < 0 || engineStart < 0 || blockEnd < engineStart) throw new Error('No encuentro la configuración o el motor en sofascore_multi_v5.js');

// Valores por defecto: las constantes de CONFIGURACION, evaluadas.
const defaults = {};
for (const line of source.slice(configStart, engineStart).split('\n')) {
  const match = line.match(/^const (\w+) = (.+?);\s*(\/\/.*)?$/);
  if (match) defaults[match[1]] = Function(`return (${match[2]});`)();
}

const engine = source.slice(engineStart, blockEnd);
const names = Object.keys(defaults);
const program = `(CFG => { const { ${names.join(', ')} } = { ...${JSON.stringify(defaults)}, ...CFG };\n${engine}\n})(__CFG__);`;

const minified = execFileSync('npx', ['-y', TERSER, '--compress', 'passes=2', '--mangle', '--ecma', '2020'], {
  input: program,
  encoding: 'utf8',
  maxBuffer: 10 * 1024 * 1024,
}).trim();
if (!minified.includes('__CFG__')) throw new Error('El minificado perdió __CFG__');
writeFileSync(join(folder, 'sofascore_v5.min.js'), `${minified}\n`);
console.log(`Listo: scripts/sofascore_v5.min.js (${(minified.length / 1024).toFixed(1)} KB; el v5 pesa ${(source.length / 1024).toFixed(1)} KB)`);
