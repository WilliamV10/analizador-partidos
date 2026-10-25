/**
 * Piezas visuales reutilizables (sin lógica de negocio). Cada una corresponde a un
 * bloque de css/components.css con el mismo nombre. Los textos llegan ya listos.
 */
import { TEXTS } from '../texts.js';
import { h } from './dom.js';
import { percent } from './formatters.js';
import { icon } from './icons.js';

const clamp01 = (value) => Math.max(0, Math.min(1, value ?? 0));
const width = (value) => `${(clamp01(value) * 100).toFixed(1)}%`;

/* ---------- Texto ---------- */

export function eyebrow(text, className = '') {
  return h('p', { class: `eyebrow ${className}`.trim() }, text);
}

/** Etiqueta de sección entre tarjetas ("PARTIDOS", "MEJORES PICKS DEL DÍA"). */
export function sectionLabel(text) {
  return h('h2', { class: 'eyebrow section-label' }, text);
}

export function note(text) {
  return text ? h('p', { class: 'note' }, text) : null;
}

/** Número con color según su signo (EV, ventaja). */
export function signed(value, text) {
  if (value === null || value === undefined || !Number.isFinite(value)) return text;
  return h('span', { class: value > 0 ? 'positive' : value < 0 ? 'negative' : '' }, text);
}

/* ---------- Botones ---------- */

/**
 * @param {{ label: unknown, icon?: string, variant?: string, onClick?: Function, type?: string, disabled?: boolean, attrs?: Object }} options
 */
export function button({ label, icon: iconName, variant = '', onClick, type = 'button', disabled = false, attrs = {} }) {
  const variants = variant
    .split(' ')
    .filter(Boolean)
    .map((name) => `button--${name}`)
    .join(' ');
  return h(
    'button',
    { type, class: `button ${variants}`.trim(), onClick, disabled, ...attrs },
    iconName ? icon(iconName, 20) : null,
    label,
  );
}

/** Enlace de acción con flecha ("Ver todos los picks ›"). */
export function link({ label, onClick }) {
  return h('button', { type: 'button', class: 'link', onClick }, label, icon('chevron', 18));
}

export function iconButton({ icon: iconName, label, onClick, variant = '', pressed = null }) {
  return h(
    'button',
    {
      type: 'button',
      class: `icon-button ${variant}`.trim(),
      'aria-label': label,
      title: label,
      'aria-pressed': pressed === null ? null : String(pressed),
      onClick,
    },
    icon(iconName),
  );
}

/* ---------- Tarjetas ---------- */

/**
 * Tarjeta con cabecera opcional: etiqueta pequeña (label) o título, y acciones a la derecha.
 * @param {{ label?: string, title?: unknown, actions?: unknown, variant?: string, tag?: string }} header
 */
export function card({ label, title, actions, variant = '', tag = 'section' } = {}, ...children) {
  const head =
    label || title || actions
      ? h(
          'div',
          { class: 'card__head' },
          label ? h('h3', { class: 'eyebrow' }, label) : h('h3', { class: 'card__title' }, title ?? ''),
          actions ?? null,
        )
      : null;
  const variants = variant
    .split(' ')
    .filter(Boolean)
    .map((name) => `card--${name}`)
    .join(' ');
  return h(tag, { class: `card ${variants}`.trim() }, head, ...children);
}

export function emptyState({ icon: iconName = 'search', title, text = null, action = null }) {
  return h(
    'div',
    { class: 'empty' },
    h('span', { class: 'empty__icon' }, icon(iconName, 28)),
    h('p', { class: 'empty__title' }, title),
    note(text),
    action,
  );
}

/** Aviso destacado (advertencia por defecto). */
export function notice(text, kind = 'warning') {
  return h(
    'div',
    { class: `notice${kind === 'warning' ? '' : ` notice--${kind}`}`, role: kind === 'error' ? 'alert' : null },
    kind === 'warning' ? icon('warning', 18) : null,
    h('span', {}, text),
  );
}

/** Cabecera de pantalla: etiqueta pequeña, título grande y acciones. */
export function pageHead({ eyebrow: eyebrowText, title, actions = null }) {
  return h(
    'header',
    { class: 'page-head' },
    h('div', { class: 'page-head__text' }, eyebrowText ? eyebrow(eyebrowText) : null, h('h1', { class: 'display' }, title)),
    actions ? h('div', { class: 'page-head__actions' }, actions) : null,
  );
}

/* ---------- Indicadores ---------- */

/**
 * @param {{ value: unknown, label: unknown, hint?: unknown, tone?: string, center?: boolean, outlined?: boolean, small?: boolean }} tile
 */
export function stat({ value, label, hint = null, tone = '', center = false, outlined = false, small = false }) {
  const classes = ['stat', center ? 'stat--center' : '', outlined ? 'stat--outlined' : ''].filter(Boolean).join(' ');
  return h(
    'div',
    { class: classes },
    h('span', { class: `stat__value${small ? ' stat__value--sm' : ''}${tone ? ` tone-${tone}` : ''}` }, value),
    h('span', { class: 'stat__label' }, label),
    hint ? h('span', { class: 'stat__hint' }, hint) : null,
  );
}

export function stats(tiles, columns = tiles.length) {
  return h('div', { class: 'stats', style: `--columns:${columns}` }, tiles.filter(Boolean).map(stat));
}

/** Lista etiqueta / valor. @param {[unknown, unknown][]} rows */
export function kvList(rows) {
  return h(
    'dl',
    { class: 'kv' },
    rows.filter(Boolean).map(([label, value]) => h('div', { class: 'kv__row' }, h('dt', {}, label), h('dd', {}, value))),
  );
}

/* ---------- Selectores ---------- */

/** Fila de chips de filtro (uno activo). */
export function chips(items, activeId, onSelect, label) {
  return h(
    'div',
    { class: 'chips', role: 'group', 'aria-label': label },
    items.map((item) =>
      h(
        'button',
        { type: 'button', class: 'chip', 'aria-pressed': String(item.id === activeId), onClick: () => onSelect(item.id) },
        item.label,
      ),
    ),
  );
}

/** Control segmentado (2-3 opciones del mismo ancho). */
export function segmented(items, activeId, onSelect, label) {
  return h(
    'div',
    { class: 'segmented', role: 'group', 'aria-label': label },
    items.map((item) =>
      h(
        'button',
        {
          type: 'button',
          class: 'segmented__option',
          'aria-pressed': String(item.id === activeId),
          onClick: () => onSelect(item.id),
        },
        item.label,
        item.hint === undefined || item.hint === null ? null : h('small', { class: 'segmented__hint' }, item.hint),
      ),
    ),
  );
}

/**
 * Pestañas. El contenido lo dibuja quien llama; aquí solo va la barra.
 * @param {{ id: string, label: string, count?: number|null }[]} items
 */
export function tabs(items, activeId, onSelect, label) {
  return h(
    'div',
    { class: 'tabs', role: 'tablist', 'aria-label': label },
    items.map((item) =>
      h(
        'button',
        {
          type: 'button',
          role: 'tab',
          class: 'tab',
          'aria-selected': String(item.id === activeId),
          onClick: () => onSelect(item.id),
        },
        item.label,
        item.count ? h('span', { class: 'tab__count' }, item.count) : null,
      ),
    ),
  );
}

/* ---------- Badges ---------- */

export function tierBadge(tier) {
  return h('span', { class: `badge badge--${tier}` }, TEXTS.tiers[tier] ?? tier);
}

/** Badge de texto libre. variant: warning, info, win, loss, none, high, medium, low. */
export function badge(text, variant = 'none') {
  return h('span', { class: `badge badge--soft badge--${variant}` }, text);
}

const FORM_VARIANTS = { W: 'win', D: 'draw', L: 'loss' };

/** Forma reciente (G/E/P) en cuadritos de color. */
export function formBadges(form) {
  if (!form?.length) return null;
  return h(
    'div',
    { class: 'form', 'aria-label': TEXTS.a11y.form(form) },
    form.map((result) =>
      h('span', { class: `form__item form__item--${FORM_VARIANTS[result] ?? 'draw'}`, 'aria-hidden': 'true' }, TEXTS.form[result] ?? result),
    ),
  );
}

/* ---------- Probabilidades ---------- */

/** Barra apilada local / empate / visita. */
export function resultBar({ home, draw, away }, names) {
  const segment = (variant, probability) =>
    h('span', { class: `result-bar__segment result-bar__segment--${variant}`, style: `flex-grow:${probability.toFixed(4)}` });
  return h(
    'div',
    { class: 'result-bar', role: 'img', 'aria-label': TEXTS.a11y.resultBar(names, { home, draw, away }) },
    segment('home', home),
    segment('draw', draw),
    segment('away', away),
  );
}

/** "1 · 29%   X · 24%   2 · 47%   xG 1.28–1.69" bajo la barra. */
export function resultLegend({ home, draw, away }, extra = null) {
  return h(
    'div',
    { class: 'result-legend' },
    h('span', {}, `1 · ${percent(home)}`),
    h('span', {}, `X · ${percent(draw)}`),
    h('span', {}, `2 · ${percent(away)}`),
    extra ? h('span', {}, extra) : null,
  );
}

/** Tres probabilidades grandes (local / empate / visita). */
export function probabilityTrio({ home, draw, away }, names) {
  const item = (value, label, tone) =>
    h(
      'div',
      {},
      h('p', { class: `probability-trio__value tone-${tone}` }, percent(value)),
      h('p', { class: 'probability-trio__label' }, label),
    );
  return h(
    'div',
    { class: 'probability-trio' },
    item(home, names.home, 'home'),
    item(draw, TEXTS.match.draw, 'draw'),
    item(away, names.away, 'away'),
  );
}

/**
 * Pista con relleno y, opcionalmente, una marca (la probabilidad de la casa).
 * @param {{ value: number|null, marker?: number|null, tone?: string }} options  tone: muted, home, away
 */
export function track({ value, marker = null, tone = '' }) {
  return h(
    'span',
    { class: 'track', 'aria-hidden': 'true' },
    h('span', { class: `track__fill${tone ? ` track__fill--${tone}` : ''}`, style: `width:${width(value)}` }),
    marker === null || marker === undefined ? null : h('span', { class: 'track__marker', style: `left:${width(marker)}` }),
  );
}

/** Fila de mercado: etiqueta, pista (mi prob. + marca de la casa), % y cuota. */
export function barRow({ label, value, marker = null, odds = null, tone = '' }) {
  return h(
    'div',
    { class: 'bar-row' },
    h('span', { class: 'bar-row__label', title: typeof label === 'string' ? label : null }, label),
    track({ value, marker, tone }),
    h('span', { class: 'bar-row__value' }, percent(value)),
    h('span', { class: 'bar-row__odds' }, odds ?? ''),
  );
}

/** Comparación en barras ("Mi prob." contra "Casa"). @param {{ label: string, value: number, tone?: string }[]} rows */
export function compareBars(rows) {
  return h(
    'dl',
    { class: 'compare' },
    rows.map(({ label, value, tone = '' }) => [h('dt', {}, label), h('dd', {}, track({ value, tone })), h('dd', { class: 'compare__value' }, percent(value))]),
  );
}

/* ---------- Tablas ---------- */

/**
 * Tabla con scroll horizontal propio (la página nunca se desborda en el celular).
 * @param {{ head: { label: string, numeric?: boolean }[], rows: ({ cells: unknown[], className?: string }|null)[], caption?: string }} config
 */
export function dataTable({ head, rows, caption = null, variant = '' }) {
  return h(
    'div',
    { class: 'table-scroll' },
    h(
      'table',
      { class: `table${variant ? ` table--${variant}` : ''}` },
      caption ? h('caption', { class: 'visually-hidden' }, caption) : null,
      h('thead', {}, h('tr', {}, head.map((column) => h('th', { scope: 'col', class: column.numeric ? 'is-num' : null }, column.label)))),
      h(
        'tbody',
        {},
        rows.filter(Boolean).map((row) =>
          h(
            'tr',
            { class: row.className ?? null },
            row.cells.map((cell, index) => h('td', { class: head[index]?.numeric ? 'is-num' : null }, cell)),
          ),
        ),
      ),
    ),
  );
}

/* ---------- Paginado ---------- */

/**
 * "1–20 de 134" con botones anterior / siguiente. No dibuja nada si cabe en una página.
 * @param {{ page: number, pages: number, total: number, pageSize: number, onPage: (page: number) => void }} options  page desde 0
 */
export function pagination({ page, pages, total, pageSize, onPage }) {
  if (pages <= 1) return null;
  const from = page * pageSize + 1;
  const to = Math.min(total, (page + 1) * pageSize);
  const step = (iconName, label, target, disabled) =>
    h(
      'button',
      { type: 'button', class: 'icon-button icon-button--boxed', 'aria-label': label, title: label, disabled, onClick: () => onPage(target) },
      icon(iconName, 20),
    );
  return h(
    'nav',
    { class: 'pagination', 'aria-label': TEXTS.pagination.label },
    step('back', TEXTS.pagination.previous, page - 1, page === 0),
    h('span', { class: 'pagination__info' }, TEXTS.pagination.range(from, to, total), h('span', { class: 'faint' }, TEXTS.pagination.page(page + 1, pages))),
    step('chevron', TEXTS.pagination.next, page + 1, page >= pages - 1),
  );
}

/* ---------- Varios ---------- */

/** Abreviatura de 3 letras de un equipo (para jugadores y listas compactas). */
export function teamShort(name) {
  const words = String(name)
    .replace(/\b(FC|CF|SC|AC|CD|CA|Club|de|del|la|United|City)\b/gi, '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const base = words[0] ?? String(name);
  return base.slice(0, 3).toUpperCase();
}
