/**
 * Tema de la página: sistema (auto), claro u oscuro. El CSS tiene los colores claros en :root
 * y los oscuros según data-theme o el sistema (css/tokens.css); aquí se fija data-theme en
 * <html>, el color de la barra del navegador del celular y se recuerda la elección.
 * La clave y los colores deben coincidir con los de js/themeInit.js (que lo aplica antes de pintar).
 */
import { readPreference, writePreference } from './preferences.js';

export const THEME_STORAGE_KEY = 'analizador.theme';

export const THEMES = Object.freeze(['dark', 'light', 'auto']);

/** Color de la barra del navegador (igual a --bg de cada tema). */
const BAR_COLORS = Object.freeze({ light: '#f2f4f7', dark: '#0a0e13' });

/** Con un tema elegido, las dos etiquetas theme-color usan su color; en "sistema", cada una el suyo. */
function paintBrowserBar(theme) {
  document.querySelectorAll('meta[name="theme-color"]').forEach((meta) => {
    const own = meta.media.includes('dark') ? BAR_COLORS.dark : BAR_COLORS.light;
    meta.content = theme === 'auto' ? own : BAR_COLORS[theme];
  });
}

function applyTheme(theme) {
  if (theme === 'auto') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = theme;
  paintBrowserBar(theme);
}

export function readTheme() {
  const theme = readPreference(THEME_STORAGE_KEY, 'auto');
  return THEMES.includes(theme) ? theme : 'auto';
}

export function setTheme(theme) {
  if (!THEMES.includes(theme)) return;
  applyTheme(theme);
  writePreference(THEME_STORAGE_KEY, theme);
}

/** ¿Se está viendo en oscuro? (en "sistema" depende de la preferencia del dispositivo). */
export function isDarkTheme(theme) {
  if (theme === 'dark') return true;
  if (theme === 'light') return false;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

/**
 * Botón de la barra superior: alterna entre oscuro y claro.
 * @param {HTMLButtonElement} button
 * @param {{ getTheme: () => string, onChange: (theme: string) => void, labels: { toDark: string, toLight: string }, icon: Function }} options
 */
export function bindThemeToggle(button, { getTheme, onChange, labels, icon }) {
  const paint = () => {
    const dark = isDarkTheme(getTheme());
    const label = dark ? labels.toLight : labels.toDark;
    button.replaceChildren(icon(dark ? 'sun' : 'moon'));
    button.setAttribute('aria-label', label);
    button.setAttribute('aria-pressed', String(dark));
    button.title = label;
  };
  button.addEventListener('click', () => onChange(isDarkTheme(getTheme()) ? 'light' : 'dark'));
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', paint);
  return { paint };
}
