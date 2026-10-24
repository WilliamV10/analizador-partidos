/**
 * Ajustes del modelo: dibuja los campos de SETTING_GROUPS (app/settings.js) como
 * deslizadores, casillas o interruptores. Cada cambio se guarda y recalcula al soltar.
 * También el tema de la página.
 */
import { SETTING_GROUPS, readPath } from '../../app/settings.js';
import { TEXTS } from '../../texts.js';
import { button, card, note, pageHead, segmented } from '../components.js';
import { h } from '../dom.js';

const PERCENT = 100;
/** Grupos que se muestran como casillas numéricas en vez de deslizadores. */
const INPUT_GROUPS = new Set(['value']);

const decimalsOf = (step) => (String(step).split('.')[1] ?? '').length;

/** Valor como se muestra (los porcentajes, de 0 a 100). */
function toDisplay(field, value) {
  if (field.kind === 'percent') return Math.round(value * PERCENT * 100) / 100;
  return Number(value.toFixed(decimalsOf(field.step)));
}

function fromDisplay(field, text) {
  const number = Number(text);
  if (text === '' || !Number.isFinite(number)) return undefined;
  return field.kind === 'percent' ? number / PERCENT : number;
}

function formatValue(field, value) {
  if (field.kind === 'percent') return `${toDisplay(field, value)}%`;
  return value.toFixed(decimalsOf(field.step));
}

const labelOf = (field) => TEXTS.settings.fields[field.path] ?? field.path;

function sliderField(field, value, onSave) {
  const output = h('span', { class: 'slider-field__value' }, formatValue(field, value));
  const min = toDisplay(field, field.min);
  const max = toDisplay(field, field.max);
  const fill = (current) => `${(((current - min) / (max - min || 1)) * 100).toFixed(1)}%`;
  const input = h('input', {
    class: 'slider',
    type: 'range',
    min: String(min),
    max: String(max),
    step: String(field.kind === 'percent' ? toDisplay(field, field.step) : field.step),
    value: String(toDisplay(field, value)),
    style: `--fill:${fill(toDisplay(field, value))}`,
    'aria-label': labelOf(field),
    onInput: (event) => {
      const next = fromDisplay(field, event.target.value);
      output.textContent = formatValue(field, next);
      event.target.style.setProperty('--fill', fill(Number(event.target.value)));
    },
    onChange: (event) => onSave(field.path, fromDisplay(field, event.target.value)),
  });
  return h('div', { class: 'slider-field' }, h('div', { class: 'slider-field__head' }, h('span', {}, labelOf(field)), output), input);
}

function inputField(field, value, onSave) {
  return h(
    'label',
    { class: 'field' },
    h('span', { class: 'field__label' }, labelOf(field)),
    h('input', {
      class: 'input',
      type: 'number',
      inputmode: 'decimal',
      min: String(toDisplay(field, field.min)),
      max: String(toDisplay(field, field.max)),
      step: String(field.kind === 'percent' ? toDisplay(field, field.step) : field.step),
      value: String(toDisplay(field, value)),
      onChange: (event) => onSave(field.path, fromDisplay(field, event.target.value)),
    }),
  );
}

function switchField(field, value, onSave) {
  return h(
    'label',
    { class: 'switch' },
    h('span', {}, labelOf(field)),
    h('input', { type: 'checkbox', role: 'switch', checked: value, onChange: (event) => onSave(field.path, event.target.checked) }),
  );
}

function groupCard(group, config, onSave) {
  const asInputs = INPUT_GROUPS.has(group.id);
  const controls = group.fields.map((field) => {
    const value = readPath(config, field.path);
    if (field.kind === 'boolean') return switchField(field, value, onSave);
    return asInputs ? inputField(field, value, onSave) : sliderField(field, value, onSave);
  });
  return card({ label: TEXTS.settings.groups[group.id] }, asInputs ? h('div', { class: 'settings-grid' }, controls) : controls);
}

/**
 * @param {{ config: Object, theme: string, settingsStatus: string|null }} state
 * @param {{ saveSetting: Function, resetSettings: Function, setTheme: Function }} actions
 */
export function renderSettings(state, actions) {
  return [
    pageHead({ eyebrow: TEXTS.settings.eyebrow, title: TEXTS.settings.title }),
    h(
      'div',
      { class: 'grid' },
      SETTING_GROUPS.map((group) => groupCard(group, state.config, actions.saveSetting)),
      card(
        { label: TEXTS.settings.theme },
        segmented(
          Object.entries(TEXTS.settings.themes).map(([id, label]) => ({ id, label })),
          state.theme,
          actions.setTheme,
          TEXTS.settings.theme,
        ),
      ),
    ),
    note(TEXTS.settings.hint),
    button({ label: TEXTS.settings.resetButton, variant: 'block', onClick: actions.resetSettings }),
  ];
}
