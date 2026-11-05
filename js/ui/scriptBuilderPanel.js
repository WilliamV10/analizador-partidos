/**
 * Armador del script de Sofascore (pantalla de carga): se eligen las ligas (cada una con su
 * horario, si se quiere), el día y el modo, y "Copiar script" copia el script ya configurado en
 * una sola línea corta (app/scriptBuilder.js), para la consola o como marcador "javascript:".
 * Pensado para el celular: no hay que editar nada a mano.
 * Lo elegido se recuerda en este navegador.
 */
import { buildSofascoreBookmarklet, buildSofascoreScript } from '../app/scriptBuilder.js';
import { TEXTS } from '../texts.js';
import { button, iconButton, segmented, selectField } from './components.js';
import { h, replaceContent } from './dom.js';
import { readJsonPreference, writeJsonPreference } from './preferences.js';

const STORAGE_KEY = 'analizador.scriptBuilder';
/** El v5 minificado (se genera con node scripts/generar_script_min.mjs). */
const SCRIPT_URL = 'scripts/sofascore_v5.min.js';

/** Ligas que se ofrecen al escribir (Sofascore las encuentra por nombre). */
const SUGGESTED_LEAGUES = [
  'Premier League',
  'LaLiga',
  'Serie A',
  'Bundesliga',
  'Ligue 1',
  'UEFA Champions League',
  'UEFA Europa League',
  'UEFA Conference League',
  'Championship',
  'Eredivisie',
  'Liga Portugal',
  'MLS',
  'Liga MX',
  'Brasileirão Série A',
  'Liga Profesional de Fútbol',
  'CONMEBOL Libertadores',
  'Saudi Pro League',
];

const DEFAULTS = Object.freeze({
  mode: 'proximos',
  day: 'hoy',
  date: '',
  days: 2,
  leagues: [{ name: 'Premier League', from: '', to: '' }],
  from: '',
  to: '',
  maxMatches: 40,
});

const today = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

/**
 * @param {HTMLElement} root  contenedor vacío en la pantalla de carga
 * @param {{ copyText: (text: string, message: string) => Promise<void> }} actions
 */
export function bindScriptBuilder(root, { copyText }) {
  const texts = TEXTS.scriptBuilder;
  const options = { ...DEFAULTS, ...readJsonPreference(STORAGE_KEY, {}) };
  if (!Array.isArray(options.leagues) || !options.leagues.length) options.leagues = [...DEFAULTS.leagues];
  let source = null;
  const status = h('p', { class: 'status', role: 'status', 'aria-live': 'polite' });
  const body = h('div', { class: 'stack' });

  const save = () => writeJsonPreference(STORAGE_KEY, options);
  const set = (patch, redraw = false) => {
    Object.assign(options, patch);
    save();
    if (redraw) paint();
  };

  const timeInput = (value, label, onChange) =>
    h('input', { class: 'input input--time', type: 'time', value: value ?? '', 'aria-label': label, onChange: (event) => onChange(event.target.value) });

  const leagueRow = (league, index) =>
    h(
      'div',
      { class: 'script-builder__league' },
      h('input', {
        class: 'input',
        type: 'text',
        list: 'script-builder-leagues',
        value: league.name,
        placeholder: texts.leaguePlaceholder,
        'aria-label': texts.league,
        onChange: (event) => {
          options.leagues[index] = { ...options.leagues[index], name: event.target.value };
          save();
        },
      }),
      h(
        'div',
        { class: 'script-builder__hours' },
        timeInput(league.from, texts.leagueFrom, (from) => {
          options.leagues[index] = { ...options.leagues[index], from };
          save();
        }),
        h('span', { class: 'muted' }, '–'),
        timeInput(league.to, texts.leagueTo, (to) => {
          options.leagues[index] = { ...options.leagues[index], to };
          save();
        }),
        iconButton({
          icon: 'close',
          label: texts.removeLeague,
          variant: 'icon-button--boxed',
          onClick: () => set({ leagues: options.leagues.filter((_, other) => other !== index) }, true),
        }),
      ),
    );

  const dayFields = () => {
    if (options.day === 'fecha') {
      return h(
        'label',
        { class: 'field' },
        h('span', { class: 'field__label' }, texts.date),
        h('input', { class: 'input', type: 'date', value: options.date || today(), onChange: (event) => set({ date: event.target.value }) }),
      );
    }
    if (options.day === 'dias') {
      return h(
        'label',
        { class: 'field' },
        h('span', { class: 'field__label' }, options.mode === 'historico' ? texts.daysBack : texts.daysAhead),
        h('input', { class: 'input', type: 'number', min: '0', max: '14', value: String(options.days), onChange: (event) => set({ days: Number(event.target.value) }) }),
      );
    }
    return null;
  };

  async function copyScript(asBookmarklet = false) {
    try {
      if (!options.leagues.some((league) => String(league.name ?? '').trim())) {
        status.textContent = texts.needLeague;
        status.dataset.kind = 'error';
        return;
      }
      status.textContent = texts.preparing;
      status.dataset.kind = 'info';
      source ??= await fetch(SCRIPT_URL).then((response) => {
        if (!response.ok) throw new Error(String(response.status));
        return response.text();
      });
      const chosen = { ...options, date: options.date || today() };
      const script = asBookmarklet ? buildSofascoreBookmarklet(source, chosen) : buildSofascoreScript(source, chosen);
      status.textContent = texts.size((script.length / 1024).toFixed(1));
      status.dataset.kind = 'info';
      await copyText(script, asBookmarklet ? texts.copiedBookmarklet : texts.copied);
    } catch (error) {
      source = null;
      status.textContent = texts.failed(error?.message ?? String(error));
      status.dataset.kind = 'error';
    }
  }

  function paint() {
    replaceContent(
      body,
      h('p', { class: 'note' }, texts.intro),
      h(
        'div',
        { class: 'field' },
        h('span', { class: 'field__label' }, texts.mode),
        segmented(
          [
            { id: 'proximos', label: texts.modes.proximos },
            { id: 'historico', label: texts.modes.historico },
          ],
          options.mode,
          (mode) => set({ mode, day: mode === 'historico' && ['hoy', 'manana'].includes(options.day) ? 'ayer' : options.day }, true),
          texts.mode,
        ),
        options.mode === 'historico' ? h('p', { class: 'note' }, texts.modeHint) : null,
      ),
      h(
        'div',
        { class: 'fields' },
        selectField({
          label: texts.day,
          value: options.day,
          options: Object.entries(texts.days).map(([id, label]) => ({ id, label })),
          onChange: (day) => set({ day }, true),
        }),
        dayFields(),
        h(
          'label',
          { class: 'field' },
          h('span', { class: 'field__label' }, texts.maxMatches),
          h('input', { class: 'input', type: 'number', min: '1', max: '150', value: String(options.maxMatches), onChange: (event) => set({ maxMatches: Number(event.target.value) }) }),
        ),
      ),
      h('div', { class: 'field' }, h('span', { class: 'field__label' }, texts.leagues), h('p', { class: 'note' }, texts.leaguesHint)),
      h('div', { class: 'stack stack--tight' }, options.leagues.map(leagueRow)),
      button({ label: texts.addLeague, icon: 'plus', variant: 'soft', onClick: () => set({ leagues: [...options.leagues, { name: '', from: '', to: '' }] }, true) }),
      h(
        'div',
        { class: 'field' },
        h('span', { class: 'field__label' }, texts.generalHours),
        h(
          'div',
          { class: 'script-builder__hours' },
          timeInput(options.from, texts.leagueFrom, (from) => set({ from })),
          h('span', { class: 'muted' }, '–'),
          timeInput(options.to, texts.leagueTo, (to) => set({ to })),
        ),
      ),
      button({ label: texts.copy, icon: 'copy', variant: 'primary lg block', onClick: () => copyScript(false) }),
      button({ label: texts.copyBookmarklet, icon: 'copy', variant: 'soft block', onClick: () => copyScript(true) }),
      status,
      h('ol', { class: 'note script-builder__steps' }, texts.steps.map((step) => h('li', {}, step))),
    );
  }

  paint();
  replaceContent(
    root,
    h(
      'details',
      { class: 'card disclosure disclosure--card script-builder' },
      h('summary', { class: 'card__head' }, h('h2', { class: 'card__title' }, texts.title)),
      h('datalist', { id: 'script-builder-leagues' }, SUGGESTED_LEAGUES.map((name) => h('option', { value: name }))),
      body,
    ),
  );
}
