/**
 * Estrategias: se elige una (gana local, ambos anotan, empate, menos de 2.5, tarjetas) y se
 * ven los partidos que pasan todos sus filtros, los que fallan solo uno ("casi"), los
 * umbrales de cada filtro (editables) y cómo le fue a la estrategia en el historial.
 */
import { matchSignals } from '../../domain/signals.js';
import { STRATEGIES, evaluateStrategy, passes, strategyPerformance } from '../../domain/strategies.js';
import { profitPerUnit } from '../../domain/settlement.js';
import { TEXTS } from '../../texts.js';
import { badge, card, chips, emptyState, note, pageHead, signed, stats, tierBadge } from '../components.js';
import { h } from '../dom.js';
import { decimal, kickoffParts, odds, percent, signedPercent } from '../formatters.js';
import { inLeague, leagueSelect, pickName, tournamentLine } from './shared.js';

export const DEFAULT_STRATEGY = STRATEGIES[0].id;

const PERCENT = 100;

/** Valor de un filtro como se muestra (porcentaje, decimal, entero o cuota). */
function formatValue(filter, value) {
  if (value === null || value === undefined) return TEXTS.strategies.noData;
  if (filter.format === 'percent') return percent(value);
  if (filter.format === 'integer') return String(Math.round(value));
  if (filter.format === 'odds') return odds(value);
  return decimal(value, 2);
}

function checkRow({ filter, threshold, value, pass }) {
  const texts = TEXTS.strategies;
  return h(
    'li',
    { class: `strategy-check${pass ? ' is-pass' : ' is-fail'}` },
    h('span', { class: 'strategy-check__mark', 'aria-label': pass ? texts.pass : texts.fail }, pass ? '✓' : '✗'),
    h('span', { class: 'strategy-check__label' }, texts.filters[filter.id] ?? filter.id),
    h('span', { class: 'strategy-check__value' }, `${formatValue(filter, value)} ${filter.kind === 'min' ? '≥' : '≤'} ${formatValue(filter, threshold)}`),
  );
}

function matchCard(result, onOpen) {
  const { analysis, pick, checks } = result;
  const time = kickoffParts(analysis.match.kickoff);
  return card(
    {
      title: analysis.match.title,
      actions: h('button', { type: 'button', class: 'link', onClick: () => onOpen(analysis.match.id) }, TEXTS.strategies.open),
    },
    h('p', { class: 'note' }, [time ? `${time.date} ${time.time}` : null, analysis.match.tournament].filter(Boolean).join(' · ')),
    pick
      ? h(
          'div',
          { class: 'strategy-pick' },
          pick.tier !== 'none' ? tierBadge(pick.tier) : badge(TEXTS.strategies.noValue, 'none'),
          h('strong', {}, pickName(pick, analysis.match)),
          h('span', {}, `@ ${odds(pick.odds)}`),
          h('span', { class: 'muted' }, `${percent(pick.probability)} · ${TEXTS.columns.ev} `, signed(pick.ev, signedPercent(pick.ev))),
        )
      : h('p', { class: 'note' }, TEXTS.strategies.noQuote),
    h('ul', { class: 'strategy-checks' }, checks.map(checkRow)),
  );
}

function thresholdsCard(strategy, thresholds, onSave) {
  const texts = TEXTS.strategies;
  return h(
    'details',
    { class: 'card disclosure disclosure--card' },
    h('summary', { class: 'card__head' }, h('h3', { class: 'card__title' }, texts.thresholds)),
    note(texts.thresholdsHint),
    h(
      'div',
      { class: 'settings-grid' },
      strategy.filters.map((filter) => {
        const current = thresholds[filter.id] ?? filter.value;
        const asPercent = filter.format === 'percent';
        return h(
          'label',
          { class: 'field' },
          h('span', { class: 'field__label' }, `${texts.filters[filter.id] ?? filter.id} (${filter.kind === 'min' ? '≥' : '≤'})`),
          h('input', {
            class: 'input',
            type: 'number',
            inputmode: 'decimal',
            step: String(asPercent ? filter.step * PERCENT : filter.step),
            value: String(asPercent ? Math.round(current * PERCENT * 100) / 100 : current),
            onChange: (event) => {
              const number = Number(event.target.value);
              if (event.target.value === '' || !Number.isFinite(number)) return;
              onSave(`strategies.${strategy.id}.${filter.id}`, asPercent ? number / PERCENT : number);
            },
          }),
        );
      }),
    ),
  );
}

function performanceCard(row) {
  const texts = TEXTS.strategies;
  if (!row.tracked) return card({ label: texts.performance }, note(texts.noTracked));
  return card(
    { label: texts.performance },
    stats(
      [
        { value: String(row.settled), label: texts.settled, hint: texts.pending(row.tracked - row.settled) },
        { value: row.hitRate === null ? '—' : percent(row.hitRate), label: texts.hitRate, tone: 'accent' },
        { value: row.roi === null ? '—' : signed(row.roi, signedPercent(row.roi)), label: texts.roi, hint: texts.profit(decimal(row.profit, 2)) },
      ],
      3,
    ),
    note(texts.performanceNote),
  );
}

/**
 * @param {Object} state   analyses, config, league, strategy, history
 * @param {Object} actions setStrategy, saveSetting, setLeague, openMatch
 */
export function renderStrategies(state, actions) {
  const texts = TEXTS.strategies;
  const analyses = inLeague(state.analyses, state.league);
  const signals = new Map(analyses.map((analysis) => [analysis, matchSignals(analysis)]));
  const results = Object.fromEntries(
    STRATEGIES.map((strategy) => [
      strategy.id,
      analyses.map((analysis) => evaluateStrategy(strategy, analysis, signals.get(analysis), state.config.strategies?.[strategy.id])),
    ]),
  );
  const strategy = STRATEGIES.find((candidate) => candidate.id === state.strategy) ?? STRATEGIES[0];
  const current = results[strategy.id];
  const passing = current.filter(passes);
  const almost = current.filter((result) => result.pick && result.failed === 1);
  const performance = strategyPerformance(state.history.records, profitPerUnit)[strategy.id];

  return [
    pageHead({ eyebrow: tournamentLine(analyses), title: texts.title }),
    note(texts.intro),
    leagueSelect(state.analyses, state.league, actions.setLeague),
    chips(
      STRATEGIES.map((candidate) => ({ id: candidate.id, label: `${texts.names[candidate.id]} · ${results[candidate.id].filter(passes).length}` })),
      strategy.id,
      actions.setStrategy,
      texts.choose,
    ),
    note(texts.descriptions[strategy.id]),
    h(
      'div',
      { class: 'grid grid--wide' },
      h(
        'div',
        { class: 'stack' },
        h('h2', { class: 'section-label' }, texts.passing(passing.length)),
        passing.length
          ? h('div', { class: 'stack' }, passing.map((result) => matchCard(result, actions.openMatch)))
          : emptyState({ icon: 'search', title: texts.nonePassing, text: texts.nonePassingHint }),
        almost.length
          ? h(
              'details',
              { class: 'disclosure' },
              h('summary', { class: 'link' }, texts.almost(almost.length)),
              h('div', { class: 'stack' }, almost.map((result) => matchCard(result, actions.openMatch))),
            )
          : null,
      ),
      h('div', { class: 'stack' }, performanceCard(performance), thresholdsCard(strategy, state.config.strategies?.[strategy.id] ?? {}, actions.saveSetting)),
    ),
  ];
}
