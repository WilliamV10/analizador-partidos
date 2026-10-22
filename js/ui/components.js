/**
 * Piezas visuales reutilizables (sin lógica de negocio).
 */
import { TEXTS } from '../texts.js';
import { h } from './dom.js';
import { percent } from './formatters.js';

/**
 * Cabecera de tarjeta: título con ícono opcional y acciones a la derecha.
 * @param {string|{ title: string, icon?: string, actions?: unknown }} header
 */
function cardHeader(header) {
  if (!header) return null;
  const { title, icon, actions } = typeof header === 'string' ? { title: header } : header;
  return h(
    'div',
    { class: 'card__header' },
    h('h3', { class: 'card__title' }, icon ? h('span', { class: 'card__title-icon', 'aria-hidden': 'true' }, icon) : null, title),
    actions ?? null,
  );
}

/** Tarjeta con cabecera y contenido. */
export function card(header, ...children) {
  return h('section', { class: 'card' }, cardHeader(header), ...children);
}

export function note(text) {
  return h('p', { class: 'note' }, text);
}

export function subtitle(text) {
  return h('h4', { class: 'card__subtitle' }, text);
}

export function emptyState({ icon, title, text }) {
  return h(
    'div',
    { class: 'empty' },
    h('span', { class: 'empty__icon', 'aria-hidden': 'true' }, icon),
    h('p', { class: 'empty__title' }, title),
    text ? h('p', { class: 'note' }, text) : null,
  );
}

/**
 * Tabla con scroll horizontal propio (la página nunca se desborda en el celular).
 * @param {{ head: { label: string, numeric?: boolean }[], rows: { cells: unknown[], className?: string }[] }} config
 */
export function dataTable({ head, rows }) {
  return h(
    'div',
    { class: 'table-scroll' },
    h(
      'table',
      { class: 'data-table' },
      h('thead', {}, h('tr', {}, head.map((column) => h('th', { scope: 'col', class: column.numeric ? 'num' : null }, column.label)))),
      h(
        'tbody',
        {},
        rows.map((row) =>
          h(
            'tr',
            { class: row.className ?? null },
            row.cells.map((cell, index) => h('td', { class: head[index]?.numeric ? 'num' : null }, cell)),
          ),
        ),
      ),
    ),
  );
}

/**
 * Probabilidad con una barra de fondo proporcional.
 * @param {number|null} probability
 * @param {'home'|'away'|null} [variant]
 */
export function probabilityCell(probability, variant = null) {
  if (probability === null || probability === undefined) return percent(probability);
  return h(
    'span',
    { class: `prob${variant ? ` prob--${variant}` : ''}`, style: `--p:${Math.max(0, Math.min(1, probability)).toFixed(3)}` },
    percent(probability),
  );
}

/** Número con color según su signo (EV, ventaja). */
export function signedCell(value, text) {
  if (value === null || value === undefined) return text;
  return h('span', { class: value > 0 ? 'positive' : 'negative' }, text);
}

export function tierBadge(tier) {
  return h('span', { class: `badge badge--${tier}` }, TEXTS.tiers[tier] ?? tier);
}

export function plainBadge(text, variant = 'accent') {
  return h('span', { class: `badge badge--plain badge--${variant}` }, text);
}

/** Letra de forma (G/E/P) coloreada. */
export function formBadge(result) {
  const variant = { W: 'win', D: 'draw', L: 'loss' }[result] ?? 'draw';
  return h('span', { class: `form-badge form-badge--${variant}`, title: result }, TEXTS.form[result] ?? result);
}

/** Barra apilada local / empate / visita. */
export function resultBar({ home, draw, away }, names) {
  const segment = (variant, probability, label) =>
    h(
      'span',
      { class: `result-bar__segment result-bar__segment--${variant}`, style: `flex-grow:${probability}` },
      `${label} ${percent(probability)}`,
    );
  return h(
    'div',
    { class: 'result-bar', role: 'img', 'aria-label': TEXTS.a11y.resultBar(names, { home, draw, away }) },
    segment('home', home, '1'),
    segment('draw', draw, 'X'),
    segment('away', away, '2'),
  );
}

/** Indicador grande: etiqueta, valor y pista. */
export function kpi(label, value, hint = null) {
  return h(
    'div',
    { class: 'kpi' },
    h('span', { class: 'kpi__label' }, label),
    h('p', { class: 'kpi__value' }, value),
    hint ? h('span', { class: 'kpi__hint' }, hint) : null,
  );
}

/** Interruptor accesible (checkbox con estilo). */
export function switchToggle(label, checked, onChange) {
  return h('label', { class: 'switch' }, h('input', { type: 'checkbox', role: 'switch', checked, onChange }), label);
}

/**
 * Pestañas. El contenido lo dibuja quien llama; aquí solo va la barra.
 * @param {{ id: string, label: string, count?: number|null }[]} items
 * @param {string} activeId
 * @param {(id: string) => void} onSelect
 * @param {{ primary?: boolean, label: string }} options
 */
export function tabs(items, activeId, onSelect, { primary = false, label }) {
  return h(
    'div',
    { class: `tabs${primary ? ' tabs--primary' : ''}`, role: 'tablist', 'aria-label': label },
    items.map((item) =>
      h(
        'button',
        {
          type: 'button',
          role: 'tab',
          class: 'tab',
          'aria-selected': item.id === activeId ? 'true' : 'false',
          onClick: () => onSelect(item.id),
        },
        item.label,
        item.count === null || item.count === undefined ? null : h('span', { class: 'tab__count' }, item.count),
      ),
    ),
  );
}

const CREST_HUES = 360;

function hashText(text) {
  let hash = 0;
  for (const char of String(text)) hash = (hash * 31 + char.codePointAt(0)) % 1_000_003;
  return hash;
}

function initials(name) {
  const words = String(name)
    .replace(/\b(FC|CF|SC|AC|CD|CA|Club|de|del|la)\b/gi, '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!words.length) return '?';
  if (words.length === 1) return words[0].slice(0, 3).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

/** "Escudo" generado: iniciales sobre un color estable derivado del nombre. */
export function teamCrest(name) {
  const hue = hashText(name) % CREST_HUES;
  return h(
    'span',
    {
      class: 'team-crest',
      'aria-hidden': 'true',
      style: `background:linear-gradient(140deg,hsl(${hue} 62% 48%),hsl(${(hue + 28) % CREST_HUES} 66% 36%))`,
    },
    initials(name),
  );
}
