/**
 * Pantallas de la app y su navegación. Una sola lista alimenta la barra superior
 * (escritorio) y la inferior (celular): para agregar una sección basta con sumarla aquí.
 */
import { TEXTS } from '../texts.js';
import { h, replaceContent } from './dom.js';
import { icon } from './icons.js';

export const SCREENS = Object.freeze({
  LOAD: 'load',
  DAY: 'day',
  MATCH: 'match',
  COMBO: 'combo',
  CONTEXT: 'context',
  HISTORY: 'history',
  SETTINGS: 'settings',
});

/**
 * `needsData`: sin partidos cargados, la sección muestra la pantalla de carga.
 * `desktop`: false = solo en la barra inferior (en escritorio el partido vive dentro de "Día").
 */
const NAV_ITEMS = [
  { id: SCREENS.DAY, icon: 'day', needsData: true, desktop: true },
  { id: SCREENS.MATCH, icon: 'match', needsData: true, desktop: false },
  { id: SCREENS.COMBO, icon: 'combo', needsData: true, desktop: true },
  { id: SCREENS.CONTEXT, icon: 'context', needsData: true, desktop: true },
  { id: SCREENS.HISTORY, icon: 'history', needsData: false, desktop: true },
  { id: SCREENS.SETTINGS, icon: 'settings', needsData: false, desktop: true },
];

/** En escritorio el partido se ve dentro de "Día" (lista lateral + detalle). */
function isActive(item, screen, isDesktopItem) {
  if (item.id === screen) return true;
  return isDesktopItem && item.id === SCREENS.DAY && screen === SCREENS.MATCH;
}

/** Pantalla que realmente se muestra (sin partidos, las de análisis llevan a la carga). */
export function resolveScreen(screen, hasData) {
  const item = NAV_ITEMS.find((candidate) => candidate.id === screen);
  if (item?.needsData && !hasData) return SCREENS.LOAD;
  return screen;
}

/**
 * @param {{ topnav: HTMLElement, bottomnav: HTMLElement }} roots
 * @param {{ screen: string, hasData: boolean }} state
 * @param {(screen: string) => void} onNavigate
 */
export function renderNavigation({ topnav, bottomnav }, { screen, hasData }, onNavigate) {
  const current = (active) => (active ? 'page' : null);
  replaceContent(
    topnav,
    NAV_ITEMS.filter((item) => item.desktop).map((item) =>
      h(
        'button',
        {
          type: 'button',
          class: 'nav-link',
          'aria-current': current(isActive(item, screen, true)),
          onClick: () => onNavigate(item.id),
        },
        TEXTS.nav[item.id],
      ),
    ),
  );
  replaceContent(
    bottomnav,
    NAV_ITEMS.map((item) =>
      h(
        'button',
        {
          type: 'button',
          class: 'bottom-nav__item',
          'aria-current': current(isActive(item, screen, false)),
          disabled: item.id === SCREENS.MATCH && !hasData,
          onClick: () => onNavigate(item.id),
        },
        icon(item.icon, 22),
        h('span', {}, TEXTS.nav[item.id]),
      ),
    ),
  );
}
