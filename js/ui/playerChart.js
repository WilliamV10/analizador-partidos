/**
 * Gráfica de los remates de un jugador en sus últimos partidos (a puerta o totales), con
 * filtro local/visita y detalle al tocar una barra. Se usa en Explorar → Jugadores y en la
 * pestaña Jugadores del partido.
 */
import { TEXTS } from '../texts.js';
import { segmented } from './components.js';
import { h, replaceContent } from './dom.js';
import { decimal } from './formatters.js';
import { recentChart } from './recentChart.js';

export const PLAYER_SHOT_KINDS = Object.freeze({ ON_TARGET: 'shotsOnTarget', ALL: 'shots' });

/** "2-1" desde el equipo del jugador -> ganó, empató o perdió. */
function outcomeOf(score) {
  const [mine, theirs] = String(score ?? '').split('-').map(Number);
  if (!Number.isFinite(mine) || !Number.isFinite(theirs)) return null;
  return mine > theirs ? 'win' : mine === theirs ? 'draw' : 'loss';
}

function detail(row, current) {
  const texts = TEXTS.recentChart;
  const outcome = outcomeOf(row.score);
  return {
    title: texts.versus(row.opponent),
    subtitle: [row.date, row.isHome ? texts.atHome : texts.away].filter(Boolean).join(' · '),
    result: outcome ? { text: texts.resultValue(...row.score.split('-'), outcome), outcome } : null,
    tiles: [
      { value: String(row.shots), label: texts.statNames.shots, tone: current === PLAYER_SHOT_KINDS.ALL ? 'accent' : '' },
      { value: String(row.shotsOnTarget), label: texts.statNames.shotsOnTarget, tone: current === PLAYER_SHOT_KINDS.ON_TARGET ? 'accent' : '' },
      { value: String(row.goals), label: texts.goals },
      { value: `${row.minutes}'`, label: texts.minutes },
    ],
  };
}

/**
 * @param {import('../domain/players.js').PlayerProjection} projection
 * @param {{ kind?: string, threshold?: () => number }} [options]  tipo de tiro inicial y umbral para resaltar
 * @returns {Node}
 */
export function playerShotsChart(projection, { kind = PLAYER_SHOT_KINDS.ON_TARGET, threshold = () => 1 } = {}) {
  const rows = [...(projection.season.matches ?? [])].reverse();
  if (!rows.length) return h('p', { class: 'note' }, TEXTS.recentChart.noPlayerMatches);
  let current = kind;
  const slot = h('div', {});
  const paint = () => {
    const chart = recentChart({
      title: TEXTS.recentChart.playerTitle(TEXTS.recentChart.statNames[current], projection.name),
      rows,
      value: (row) => row[current],
      threshold,
      detail: (row) => detail(row, current),
      summary: (shown) => {
        const total = shown.reduce((sum, row) => sum + row[current], 0);
        const minutes = shown.reduce((sum, row) => sum + row.minutes, 0);
        const limit = threshold();
        return [
          { value: decimal(total / shown.length, 1), label: TEXTS.recentChart.perMatch, tone: 'accent' },
          { value: minutes ? decimal((total / minutes) * 90, 1) : '—', label: TEXTS.recentChart.per90 },
          { value: `${shown.filter((row) => row[current] >= limit).length}/${shown.length}`, label: TEXTS.recentChart.reachedPlain(limit) },
        ];
      },
      controls: segmented(
        [
          { id: PLAYER_SHOT_KINDS.ON_TARGET, label: TEXTS.recentChart.statNames.shotsOnTarget },
          { id: PLAYER_SHOT_KINDS.ALL, label: TEXTS.recentChart.statNames.shots },
        ],
        current,
        (next) => {
          current = next;
          paint();
        },
        TEXTS.recentChart.shotKindLabel,
      ),
    });
    replaceContent(slot, chart.node);
  };
  paint();
  return slot;
}

/**
 * Hace que `trigger` (un botón) abra y cierre debajo un panel que se arma la primera vez.
 * @param {HTMLButtonElement} trigger
 * @param {() => Node|Node[]} build
 * @returns {HTMLElement} el panel (va después del botón)
 */
export function expandOnClick(trigger, build) {
  const panel = h('div', { class: 'expand-panel', hidden: true });
  let built = false;
  trigger.setAttribute('aria-expanded', 'false');
  trigger.addEventListener('click', () => {
    if (!built) {
      replaceContent(panel, build());
      built = true;
    }
    panel.hidden = !panel.hidden;
    trigger.setAttribute('aria-expanded', String(!panel.hidden));
  });
  return panel;
}
