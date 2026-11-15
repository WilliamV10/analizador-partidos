/**
 * Calculadora de apuesta segura (herramienta, se abre desde Ajustes): carga el JSON del script de
 * surebets y, para cada apuesta segura, "casi" o sándwich, dice cuánto poner en cada casa para
 * ganar lo pedido (o repartir lo que se quiere invertir). El cálculo está en domain/surebets.js.
 *
 * El monto y las opciones se recuerdan en el navegador; al cambiarlos solo se redibuja la lista.
 */
import { legName, splitStakes } from '../../domain/surebets.js';
import { TEXTS } from '../../texts.js';
import { badge, card, dataTable, note, pageHead, selectField } from '../components.js';
import { h, replaceContent } from '../dom.js';
import { readJsonPreference, writeJsonPreference } from '../preferences.js';

const STORAGE_KEY = 'analizador.surebets';
/** Con datos más viejos que esto, se avisa que las cuotas pudieron cambiar. */
const STALE_MINUTES = 10;
const DEFAULTS = Object.freeze({ mode: 'win', amount: 10, step: 1, show: 'safe' });

const money = (value) =>
  Number.isFinite(value) ? `$${value.toLocaleString('es', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—';
const signedMoney = (value) => `${value >= 0 ? '+' : '−'}${money(Math.abs(value))}`;

function legsTable(item, result) {
  const texts = TEXTS.surebets;
  return dataTable({
    variant: 'summary',
    head: [{ label: texts.columns.bet }, { label: texts.columns.odds, numeric: true }, { label: texts.columns.stake, numeric: true }, { label: texts.columns.payout, numeric: true }],
    rows: item.legs.map((leg, index) => ({
      cells: [
        h('span', {}, legName(leg, item.partido), h('span', { class: 'table-sub' }, leg.casa ?? '')),
        String(leg.cuota),
        h('strong', {}, money(result.stakes[index])),
        money(result.payouts[index]),
      ],
    })),
  });
}

function namesNote(item) {
  if (!item.nombres) return null;
  return note(TEXTS.surebets.namesInBooks(Object.entries(item.nombres).map(([book, name]) => `${book}: ${name}`).join(' · ')));
}

function itemView(item, kind, options) {
  const texts = TEXTS.surebets;
  const odds = item.legs.map((leg) => Number(leg.cuota));
  const sandwich = kind === 'sandwich';
  const result = splitStakes(odds, sandwich ? 'total' : options.mode, options.amount, options.step);
  const worst = Math.min(...result.profits);
  const pill = sandwich
    ? badge(texts.sandwich, 'info')
    : badge(`${item.pct > 0 ? '+' : ''}${item.pct ?? (result.margin * 100).toFixed(2)}%`, kind === 'almost' ? 'warning' : 'win');
  const head = h(
    'div',
    { class: 'surebet__head' },
    h('div', {}, h('strong', {}, item.partido), h('p', { class: 'note' }, [item.liga, item.hora].filter(Boolean).join(' · '))),
    pill,
  );
  if (sandwich) {
    const both = result.payouts.reduce((acc, value) => acc + value, 0) - result.total;
    return h(
      'div',
      { class: 'surebet' },
      head,
      note(texts.sandwichHint(item.medio, signedMoney(both), signedMoney(worst))),
      legsTable(item, result),
      note(texts.sandwichTotal(money(result.total))),
      namesNote(item),
    );
  }
  const unequal = result.profits.some((profit) => Math.abs(profit - worst) > 0.01);
  return h(
    'div',
    { class: 'surebet' },
    head,
    kind === 'almost' ? h('p', { class: 'note tone-warning' }, texts.almostHint) : null,
    options.mode === 'win' && kind === 'safe' ? note(texts.toWin(money(options.amount), money(result.total))) : null,
    legsTable(item, result),
    h(
      'p',
      { class: 'note' },
      texts.total(money(result.total)),
      h('strong', { class: worst >= 0 ? 'positive' : 'negative' }, signedMoney(worst)),
      unequal ? texts.byRounding : '',
    ),
    namesNote(item),
  );
}

function listView(data, options) {
  const texts = TEXTS.surebets;
  if (!data) return note(texts.empty);
  const items =
    options.show === 'sandwich'
      ? data.sandwich.map((item) => ({ item, kind: 'sandwich' }))
      : [...data.safe.map((item) => ({ item, kind: 'safe' })), ...(options.show === 'almost' ? data.almost.map((item) => ({ item, kind: 'almost' })) : [])];
  if (!items.length) return note(texts.none);
  if (!(options.amount > 0)) return note(texts.needAmount);
  return h('div', { class: 'surebets' }, items.map(({ item, kind }) => itemView(item, kind, options)));
}

function infoLine(data) {
  const texts = TEXTS.surebets;
  if (!data) return note(texts.loadHint);
  const minutes = data.generated ? Math.round((Date.now() - data.generated) / 60000) : null;
  return h(
    'p',
    { class: 'note' },
    texts.summary(data.safe.length, data.almost.length, data.sandwich.length, data.compared),
    minutes === null ? null : h('span', { class: minutes > STALE_MINUTES ? 'tone-warning' : '' }, texts.age(minutes, minutes > STALE_MINUTES)),
  );
}

/**
 * @param {Object} state   surebets (datos ya leídos o null), surebetsError
 * @param {Object} actions loadSurebets(text)
 */
export function renderSurebets(state, actions) {
  const texts = TEXTS.surebets;
  const options = { ...DEFAULTS, ...readJsonPreference(STORAGE_KEY, {}) };
  const list = h('div', {});
  const amountLabel = h('span', { class: 'field__label' }, options.mode === 'win' ? texts.amountWin : texts.amountTotal);
  const redraw = () => {
    writeJsonPreference(STORAGE_KEY, options);
    amountLabel.textContent = options.mode === 'win' ? texts.amountWin : texts.amountTotal;
    replaceContent(list, listView(state.surebets, options));
  };
  const set = (patch) => {
    Object.assign(options, patch);
    redraw();
  };
  redraw();

  const fileInput = h('input', {
    class: 'visually-hidden',
    type: 'file',
    accept: '.json,application/json',
    onChange: async (event) => {
      const [file] = event.target.files ?? [];
      if (file) actions.loadSurebets(await file.text());
    },
  });
  const paste = h('textarea', { class: 'textarea', rows: '3', spellcheck: 'false', placeholder: texts.pastePlaceholder, 'aria-label': texts.paste });

  return [
    pageHead({ eyebrow: texts.eyebrow, title: texts.title }),
    card(
      { label: texts.loadTitle },
      h('div', { class: 'button-row' }, h('label', { class: 'button button--primary' }, fileInput, texts.open)),
      h(
        'details',
        { class: 'disclosure' },
        h('summary', { class: 'link' }, texts.paste),
        paste,
        h('button', { type: 'button', class: 'button', onClick: () => actions.loadSurebets(paste.value) }, texts.load),
      ),
      state.surebetsError ? h('p', { class: 'status', 'data-kind': 'error' }, texts.error(state.surebetsError)) : infoLine(state.surebets),
    ),
    card(
      { label: texts.howMuch },
      h(
        'div',
        { class: 'fields' },
        selectField({
          label: texts.mode,
          value: options.mode,
          options: [
            { id: 'win', label: texts.modes.win },
            { id: 'total', label: texts.modes.total },
          ],
          onChange: (mode) => set({ mode }),
        }),
        h(
          'label',
          { class: 'field' },
          amountLabel,
          h('input', {
            class: 'input',
            type: 'number',
            inputmode: 'decimal',
            min: '0',
            value: String(options.amount),
            onInput: (event) => set({ amount: Number(event.target.value) }),
          }),
        ),
        selectField({
          label: texts.round,
          value: String(options.step),
          options: [1, 0.5, 0.01, 5].map((step) => ({ id: String(step), label: texts.rounds[String(step)] })),
          onChange: (step) => set({ step: Number(step) }),
        }),
        selectField({
          label: texts.show,
          value: options.show,
          options: Object.entries(texts.shows).map(([id, label]) => ({ id, label })),
          onChange: (show) => set({ show }),
        }),
      ),
    ),
    card({}, list),
    note(texts.warning),
  ];
}
