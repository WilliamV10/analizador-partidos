/**
 * Diálogo de ajustes del modelo. Dibuja los campos de SETTING_GROUPS, muestra los
 * valores vigentes y devuelve los cambios del usuario a quien llama.
 */
import { SETTING_GROUPS, readPath } from '../app/settings.js';
import { TEXTS } from '../texts.js';
import { h, replaceContent } from './dom.js';

const PERCENT = 100;

/** Valor como se muestra en el campo (los porcentajes, de 0 a 100). */
function toInput(field, value) {
  return field.kind === 'percent' ? Math.round(value * PERCENT * 100) / 100 : value;
}

function fromInput(field, input) {
  if (field.kind === 'boolean') return input.checked;
  if (input.value === '') return undefined;
  const number = Number(input.value);
  return field.kind === 'percent' ? number / PERCENT : number;
}

function defaultText(field, value) {
  if (field.kind === 'boolean') return TEXTS.settings.defaultValue(value ? '✓' : '✗');
  return TEXTS.settings.defaultValue(field.kind === 'percent' ? `${toInput(field, value)}%` : value);
}

function fieldControl(field, current, defaults) {
  const value = readPath(current, field.path);
  const label = TEXTS.settings.fields[field.path] ?? field.path;
  if (field.kind === 'boolean') {
    return h(
      'label',
      { class: 'switch settings__switch' },
      h('input', { type: 'checkbox', role: 'switch', checked: value, 'data-path': field.path }),
      label,
    );
  }
  const isPercent = field.kind === 'percent';
  return h(
    'label',
    { class: 'field' },
    h('span', { class: 'field__label' }, label),
    h(
      'span',
      { class: 'settings__input' },
      h('input', {
        class: 'field__input field__input--small',
        type: 'number',
        inputmode: 'decimal',
        min: String(toInput(field, field.min)),
        max: String(toInput(field, field.max)),
        step: String(toInput(field, field.step)),
        value: String(toInput(field, value)),
        'data-path': field.path,
      }),
      isPercent ? h('span', { class: 'muted' }, '%') : null,
    ),
    h('span', { class: 'settings__hint' }, defaultText(field, readPath(defaults, field.path))),
  );
}

/**
 * @param {HTMLDialogElement} dialog
 * @param {HTMLButtonElement} openButton
 * @param {{ defaults: Object, getConfig: () => Object, onSave: (overrides: Object) => void, onReset: () => void }} options
 */
export function bindSettingsPanel(dialog, openButton, { defaults, getConfig, onSave, onReset }) {
  const container = dialog.querySelector('[data-settings-fields]');
  const status = dialog.querySelector('[data-settings-status]');

  function render() {
    const current = getConfig();
    replaceContent(
      container,
      SETTING_GROUPS.map((group) =>
        h(
          'fieldset',
          { class: 'settings__group' },
          h('legend', { class: 'card__subtitle' }, TEXTS.settings.groups[group.id]),
          h('div', { class: 'settings__grid' }, group.fields.map((field) => fieldControl(field, current, defaults))),
        ),
      ),
    );
  }

  function collect() {
    const fields = SETTING_GROUPS.flatMap((group) => group.fields);
    return Object.fromEntries(
      fields.map((field) => [field.path, fromInput(field, container.querySelector(`[data-path="${field.path}"]`))]),
    );
  }

  function showStatus(message) {
    status.textContent = message;
    status.dataset.kind = 'success';
  }

  openButton.addEventListener('click', () => {
    render();
    showStatus('');
    dialog.showModal();
  });

  dialog.querySelector('[data-settings-save]').addEventListener('click', () => {
    onSave(collect());
    render();
    showStatus(TEXTS.settings.saved);
  });

  dialog.querySelector('[data-settings-reset]').addEventListener('click', () => {
    onReset();
    render();
    showStatus(TEXTS.settings.reset);
  });

  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close();
  });
}
