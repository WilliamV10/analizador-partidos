/*
 * Aplica el tema guardado antes de pintar la página (evita el parpadeo).
 * Script clásico a propósito: corre de forma síncrona en <head>.
 * La clave debe coincidir con THEME_STORAGE_KEY de js/ui/theme.js.
 */
(function applySavedTheme() {
  try {
    var saved = localStorage.getItem('analizador.theme');
    if (saved !== 'light' && saved !== 'dark') return;
    document.documentElement.dataset.theme = saved;
    // Barra del navegador del celular con el color del tema elegido (mismos colores que js/ui/theme.js).
    var color = saved === 'dark' ? '#0a0e13' : '#f2f4f7';
    var metas = document.querySelectorAll('meta[name="theme-color"]');
    for (var i = 0; i < metas.length; i += 1) metas[i].setAttribute('content', color);
  } catch (error) {
    /* Sin acceso a localStorage: se usa el tema del sistema. */
  }
})();
