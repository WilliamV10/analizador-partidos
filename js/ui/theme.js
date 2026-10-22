/**
 * Selector de tema: automático (sistema) → claro → oscuro.
 * El CSS resuelve los colores con light-dark(); aquí solo se fija data-theme.
 */
import { TEXTS } from '../texts.js';
import { readPreference, writePreference } from './preferences.js';

export const THEME_STORAGE_KEY = 'analizador.theme';

const THEMES = ['auto', 'light', 'dark'];

function applyTheme(theme) {
  if (theme === 'auto') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = theme;
}

function nextTheme(theme) {
  return THEMES[(THEMES.indexOf(theme) + 1) % THEMES.length];
}

/** @param {HTMLButtonElement} button */
export function bindThemeToggle(button) {
  let theme = readPreference(THEME_STORAGE_KEY, 'auto');
  if (!THEMES.includes(theme)) theme = 'auto';

  const paint = () => {
    const { icon, label } = TEXTS.theme[theme];
    button.textContent = icon;
    button.title = label;
    button.setAttribute('aria-label', label);
  };

  button.addEventListener('click', () => {
    theme = nextTheme(theme);
    applyTheme(theme);
    writePreference(THEME_STORAGE_KEY, theme);
    paint();
  });

  applyTheme(theme);
  paint();
}
