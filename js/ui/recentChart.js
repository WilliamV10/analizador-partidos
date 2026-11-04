/**
 * Gráfica de barras de los últimos partidos (de un equipo o de un jugador), con:
 *  - filtro Todos / Local / Visita;
 *  - detalle al tocar una barra (rival, condición, resultado y lo que se quiera mostrar);
 *  - barras resaltadas desde un umbral (ej. "3 o más").
 *
 * Maneja su propio estado en el DOM (filtro y barra elegida): no pasa por el store, así no
 * se redibuja la pantalla ni se pierde la posición al tocarla.
 */
import { TEXTS } from '../texts.js';
import { card, chips, kvList, teamShort } from './components.js';
import { h, replaceContent } from './dom.js';

const SIDE_FILTERS = Object.freeze({ ALL: 'all', HOME: 'home', AWAY: 'away' });

/**
 * @typedef {Object} RecentChartOptions
 * @property {string} title
 * @property {Object[]} rows          del más viejo al más nuevo; cada uno con `isHome` y `opponent`
 * @property {(row: Object) => number|null} value  altura de la barra (null = sin dato, no se muestra)
 * @property {() => number|null} [threshold]  desde este valor la barra se resalta (se lee en cada dibujo)
 * @property {(row: Object) => [string, any][]} detail  filas del detalle al tocar una barra
 * @property {(rows: Object[]) => string} summary      texto bajo la gráfica (con los partidos visibles)
 * @property {Node|Node[]|null} [controls]  controles extra arriba de la gráfica (ej. tipo de tiro)
 */

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
  const chartSlot = h('div', {});
  const detailSlot = h('div', { 'aria-live': 'polite' });
  const summarySlot = h('p', { class: 'note' });

  const visible = () =>
    withData.filter((row) => side === SIDE_FILTERS.ALL || (side === SIDE_FILTERS.HOME ? row.isHome : !row.isHome));

  const paintDetail = () => {
    if (!selected) {
      replaceContent(detailSlot, h('p', { class: 'note' }, TEXTS.recentChart.tapHint));
      return;
    }
    replaceContent(detailSlot, h('div', { class: 'recent-detail' }, kvList(detail(selected))));
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
    const top = Math.max(...shown.map(value), 1);
    const limit = threshold();
    replaceContent(
      chartSlot,
      shown.length
        ? h(
            'div',
            { class: 'dist dist--team', role: 'group', 'aria-label': title },
            shown.map((row) => {
              const amount = value(row);
              const classes = ['dist__column', 'dist__column--button'];
              if (limit !== null && amount >= limit) classes.push('is-over');
              if (row === selected) classes.push('is-current');
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
                h('span', { class: 'dist__value' }, Number.isInteger(amount) ? amount : amount.toFixed(1)),
                h('span', { class: 'dist__bar', style: `height:${((amount / top) * 100).toFixed(1)}%` }),
                h('span', { class: 'dist__label' }, `${row.isHome ? TEXTS.explorer.homeShort : TEXTS.explorer.awayShort} ${teamShort(row.opponent)}`),
              );
            }),
          )
        : h('p', { class: 'note' }, TEXTS.recentChart.noneForSide),
    );
    summarySlot.textContent = shown.length ? summary(shown) : '';
    paintDetail();
  };

  paint();
  return { node: card({ label: title }, controls, filterSlot, chartSlot, summarySlot, detailSlot), refresh: paint };
}
