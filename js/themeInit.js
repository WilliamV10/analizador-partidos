/*
 * Aplica el tema guardado antes de pintar la página (evita el parpadeo).
 * Script clásico a propósito: corre de forma síncrona en <head>.
 * La clave debe coincidir con THEME_STORAGE_KEY de js/ui/theme.js.
 */
(function applySavedTheme() {
  try {
    var saved = localStorage.getItem('analizador.theme');
    if (saved === 'light' || saved === 'dark') document.documentElement.dataset.theme = saved;
  } catch (error) {
    /* Sin acceso a localStorage: se usa el tema del sistema. */
  }
})();
