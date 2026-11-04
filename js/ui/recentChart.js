/**
 * Gráfica de barras de los últimos partidos (de un equipo o de un jugador), con:
 *  - resumen arriba en recuadros (promedio, etc.);
 *  - filtro Todos / Local / Visita;
 *  - línea del promedio y barras resaltadas desde un umbral (ej. "3 o más");
 *  - detalle al tocar una barra: rival, condición, resultado y recuadros con los números.
 *
 * Maneja su propio estado en el DOM (filtro y barra elegida): no pasa por el store, así no
 * se redibuja la pantalla ni se pierde la posición al tocarla.
 */
import { TEXTS } from '../texts.js';
import { card, chips, stats, teamShort } from './components.js';
import { h, replaceContent } from './dom.js';
import { decimal } from './formatters.js';

const SIDE_FILTERS = Object.freeze({ ALL: 'all', HOME: 'home', AWAY: 'away' });

/**
 * @typedef {Object} ChartDetail
 * @property {string} title                      ej. "vs Galatasaray"
 * @property {string} subtitle                   ej. "26/10/2026 · Champions League · de visita"
 * @property {{ text: string, outcome: 'win'|'draw'|'loss' }|null} result
 * @property {{ value: string, label: string, hint?: string|null, tone?: string }[]} tiles
 */

/**
 * @typedef {Object} RecentChartOptions
 * @property {string} title
 * @property {Object[]} rows          del más viejo al más nuevo; cada uno con `isHome`, `opponent` y `date`
 * @property {(row: Object) => number|null} value  altura de la barra (null = sin dato, no se muestra)
 * @property {() => number|null} [threshold]  desde este valor la barra se resalta (se lee en cada dibujo)
 * @property {(row: Object) => ChartDetail} detail  detalle al tocar una barra
 * @property {(rows: Object[]) => { value: string, label: string }[]} summary  recuadros del resumen (partidos visibles)
 * @property {Node|Node[]|null} [controls]  controles extra arriba de la gráfica (ej. tipo de tiro)
 */

/** "2026-10-26" -> "26/10". */
const shortDate = (date) => {
  const match = String(date ?? '').match(/^\d{4}-(\d{2})-(\d{2})/);
  return match ? `${match[2]}/${match[1]}` : '';
};

const formatAmount = (amount) => (Number.isInteger(amount) ? String(amount) : decimal(amount, 1));

function detailView(info) {
  return h(
    'div',
    { class: 'recent-detail' },
    h(
      'div',
      { class: 'recent-detail__head' },
      h(
        'div',
        { class: 'recent-detail__text' },
        h('p', { class: 'recent-detail__title' }, info.title),
        h('p', { class: 'note' }, info.subtitle),
      ),
      info.result ? h('span', { class: `result-chip result-chip--${info.result.outcome}` }, info.result.text) : null,
    ),
    h('div', { class: 'recent-detail__tiles' }, stats(info.tiles.map((tile) => ({ ...tile, small: true })), Math.min(4, info.tiles.length))),
  );
}

/**
 * @param {RecentChartOptions} options
 * @returns {{ node: Node, refresh: () => void }|null}  `refresh` vuelve a dibujar (ej. cambió el umbral)
 */
export function recentChart({ title, rows, value, threshold = () => null, detail, summary, controls = null }) {
  const withData = rows.filter((row) => value(row) !== null && value(row) !== undefined);
  if (!withData.length) return null;
  let side = SIDE_FILTERS.ALL;
  let selected = null;
  const filterSlot = h('div', { class: 'recent-chart__filters' });
  const summarySlot = h('div', {});
  const chartSlot = h('div', {});
  const detailSlot = h('div', { 'aria-live': 'polite' });

  const visible = () =>
    withData.filter((row) => side === SIDE_FILTERS.ALL || (side === SIDE_FILTERS.HOME ? row.isHome : !row.isHome));

  const plot = (shown) => {
    const amounts = shown.map(value);
    const top = Math.max(...amounts, 1);
    const average = amounts.reduce((sum, amount) => sum + amount, 0) / amounts.length;
    const limit = threshold();
    const columns = shown.map((row) => {
      const amount = value(row);
      const classes = ['recent-chart__column'];
      if (limit !== null && amount >= limit) classes.push('is-over');
      if (amount === 0) classes.push('is-zero');
      if (row === selected) classes.push('is-selected');
      return h(
        'button',
        {
          type: 'button',
          class: classes.join(' '),
          'aria-pressed': String(row === selected),
          'aria-label': TEXTS.recentChart.barLabel(row.opponent, amount),
          onClick: () => {
            selected = row === selected ? null : row;
            paint();
          },
        },
        h(
          'span',
          { class: 'recent-chart__bar-area' },
          h('span', { class: 'recent-chart__value' }, formatAmount(amount)),
          h('span', { class: 'recent-chart__bar', style: `--ratio:${(amount / top).toFixed(3)}` }),
        ),
        h(
          'span',
          { class: 'recent-chart__label' },
          h('span', { class: 'recent-chart__opponent' }, teamShort(row.opponent)),
          h('span', { class: 'recent-chart__meta' }, `${row.isHome ? TEXTS.explorer.homeShort : TEXTS.explorer.awayShort} · ${shortDate(row.date)}`),
        ),
      );
    });
    return h(
      'div',
      { class: `recent-chart${limit === null ? ' recent-chart--plain' : ''}`, role: 'group', 'aria-label': title, style: `--columns:${shown.length}` },
      h(
        'span',
        { class: 'recent-chart__average', style: `--ratio:${(average / top).toFixed(3)}`, 'aria-hidden': 'true' },
        h('span', { class: 'recent-chart__average-label' }, TEXTS.recentChart.averageLine(formatAmount(Math.round(average * 10) / 10))),
      ),
      columns,
    );
  };

  const paint = () => {
    const shown = visible();
    if (selected && !shown.includes(selected)) selected = null;
    replaceContent(
      filterSlot,
      chips(
        [
          { id: SIDE_FILTERS.ALL, label: TEXTS.recentChart.sides.all },
          { id: SIDE_FILTERS.HOME, label: TEXTS.recentChart.sides.home },
          { id: SIDE_FILTERS.AWAY, label: TEXTS.recentChart.sides.away },
        ],
        side,
        (next) => {
          side = next;
          paint();
        },
        TEXTS.recentChart.sideLabel,
      ),
    );
    replaceContent(summarySlot, shown.length ? stats(summary(shown).map((tile) => ({ ...tile, small: true })), 3) : null);
    replaceContent(chartSlot, shown.length ? plot(shown) : h('p', { class: 'note' }, TEXTS.recentChart.noneForSide));
    replaceContent(detailSlot, selected ? detailView(detail(selected)) : h('p', { class: 'note' }, TEXTS.recentChart.tapHint));
  };

  paint();
  return { node: card({ label: title, variant: 'chart' }, controls, filterSlot, summarySlot, chartSlot, detailSlot), refresh: paint };
}
