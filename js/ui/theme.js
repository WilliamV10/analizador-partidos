/**
 * Tema de la página: sistema (auto), claro u oscuro. El CSS resuelve los colores con
 * light-dark(); aquí solo se fija data-theme en <html> y se recuerda la elección.
 * La clave debe coincidir con la de js/themeInit.js (que lo aplica antes de pintar).
 */
import { readPreference, writePreference } from './preferences.js';

export const THEME_STORAGE_KEY = 'analizador.theme';

export const THEMES = Object.freeze(['dark', 'light', 'auto']);

function applyTheme(theme) {
  if (theme === 'auto') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = theme;
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
