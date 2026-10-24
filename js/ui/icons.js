/**
 * Íconos de línea (24×24, trazo). Única fuente de SVG de la app: los usan los
 * componentes con icon('nombre') y el HTML estático con <span data-icon="nombre">.
 */

const SVG_NS = 'http://www.w3.org/2000/svg';

/** Cada ícono es una lista de [etiqueta, atributos]. */
const ICONS = {
  logo: [['path', { d: 'M5 19V13M10 19V8M15 19v-9M20 19V5', 'stroke-width': '2.4' }]],
  day: [
    ['rect', { x: '3.5', y: '5', width: '17', height: '15', rx: '2.5' }],
    ['path', { d: 'M3.5 10h17M8 3v4M16 3v4' }],
  ],
  match: [
    ['circle', { cx: '12', cy: '12', r: '8.5' }],
    ['circle', { cx: '12', cy: '12', r: '3' }],
  ],
  combo: [['path', { d: 'm12 3 8.5 4.5L12 12 3.5 7.5Z' }], ['path', { d: 'm3.5 12 8.5 4.5 8.5-4.5M3.5 16.5 12 21l8.5-4.5' }]],
  context: [['path', { d: 'M20 11.5a7.5 7.5 0 0 1-11 6.6L4 19.5l1.4-4.6A7.5 7.5 0 1 1 20 11.5Z' }]],
  settings: [
    ['path', { d: 'M4 7h9M17 7h3M4 17h3M11 17h9' }],
    ['circle', { cx: '15', cy: '7', r: '2' }],
    ['circle', { cx: '9', cy: '17', r: '2' }],
  ],
  history: [['path', { d: 'M5 4.5h11A2.5 2.5 0 0 1 18.5 7v13H7.5A2.5 2.5 0 0 1 5 17.5Z' }], ['path', { d: 'M5 17.5A2.5 2.5 0 0 1 7.5 15h11M9 8.5h6' }]],
  upload: [['path', { d: 'M12 15V4M7.5 8.5 12 4l4.5 4.5' }], ['path', { d: 'M4 15v3.5A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5V15' }]],
  copy: [['rect', { x: '8.5', y: '8.5', width: '11.5', height: '11.5', rx: '2' }], ['path', { d: 'M15.5 8.5V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v7.5a2 2 0 0 0 2 2h2.5' }]],
  back: [['path', { d: 'm15 5-7 7 7 7' }]],
  chevron: [['path', { d: 'm9 5 7 7-7 7' }]],
  plus: [['path', { d: 'M12 5v14M5 12h14' }]],
  minus: [['path', { d: 'M5 12h14' }]],
  close: [['path', { d: 'M6 6l12 12M18 6 6 18' }]],
  check: [['path', { d: 'm5 12.5 4.5 4.5L19 7.5' }]],
  trash: [['path', { d: 'M4.5 7h15M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13' }]],
  warning: [['path', { d: 'M12 4 2.8 19.5h18.4Z' }], ['path', { d: 'M12 10v4M12 17h.01' }]],
  restore: [['path', { d: 'M4 12a8 8 0 1 0 2.4-5.7L4 8.5' }], ['path', { d: 'M4 4v4.5h4.5M12 8v4l3 2' }]],
  arrow: [['path', { d: 'M5 12h14M13 6l6 6-6 6' }]],
  edit: [['path', { d: 'M4 20h4L19 9l-4-4L4 16Z' }]],
  search: [['circle', { cx: '11', cy: '11', r: '6.5' }], ['path', { d: 'm16 16 4 4' }]],
  theme: [['circle', { cx: '12', cy: '12', r: '8.5' }], ['path', { d: 'M12 3.5v17A8.5 8.5 0 0 0 12 3.5Z', fill: 'currentColor' }]],
};

/**
 * @param {keyof typeof ICONS} name
 * @param {number} [size=22]
 * @returns {SVGSVGElement}
 */
export function icon(name, size = 22) {
  const svg = document.createElementNS(SVG_NS, 'svg');
  const attributes = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    'stroke-width': '1.8',
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
    'aria-hidden': 'true',
    focusable: 'false',
  };
  Object.entries(attributes).forEach(([key, value]) => svg.setAttribute(key, String(value)));
  (ICONS[name] ?? []).forEach(([tag, shapeAttributes]) => {
    const shape = document.createElementNS(SVG_NS, tag);
    Object.entries(shapeAttributes).forEach(([key, value]) => shape.setAttribute(key, value));
    svg.append(shape);
  });
  return svg;
}

/** Rellena los <span data-icon="nombre" data-size="20"> del HTML estático. */
export function hydrateIcons(root = document) {
  root.querySelectorAll('[data-icon]').forEach((slot) => {
    slot.replaceChildren(icon(slot.dataset.icon, Number(slot.dataset.size) || 22));
  });
}
