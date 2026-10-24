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
