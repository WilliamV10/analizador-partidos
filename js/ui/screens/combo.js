/**
 * Combinada: el usuario arma su combinada con los picks elegibles (o parte de una
 * sugerida), ve cuota, probabilidad y EV en vivo, y la copia como texto.
 * Dos modos: "Más valor" (picks con EV positivo) y "Más probables" (lo más probable de
 * los mercados populares, haya valor o no).
 */
import { buildCombos, buildProbableCombos, comboCandidates, priceCombo, probableCandidates } from '../../domain/combos.js';
import { TIERS } from '../../domain/value.js';
import { TEXTS } from '../../texts.js';
import { button, card, emptyState, iconButton, note, notice, pageHead, sectionLabel, segmented, selectField, stats, tierBadge } from '../components.js';
import { h } from '../dom.js';
import { kickoffParts, odds, percent, signedPercent } from '../formatters.js';
import { dayTitle, pickKey, pickName, tournamentLine } from './shared.js';

/** Niveles que se pueden exigir como mínimo. */
const TIER_CHOICES = [TIERS.LOW, TIERS.MEDIUM, TIERS.HIGH];
/** Paso del botón +/− de la cuota mínima. */
const ODDS_STEP = 0.05;
const MIN_ODDS_LIMITS = { min: 1.01, max: 3 };
/** Picks elegibles a la vista; el resto queda en "Ver N más". */
const CANDIDATES_SHOWN = 6;
/** Probabilidades mínimas que se pueden exigir en "Más probables". */
const PROBABILITY_CHOICES = [0.5, 0.6, 0.7, 0.8];

export const COMBO_MODES = Object.freeze({ VALUE: 'value', PROBABLE: 'probable' });

/** Configuración efectiva de combinadas: la de ajustes con las reglas elegidas aquí. */
export function comboConfig(config, rules) {
  return { ...config.combos, minOdds: rules.minOdds, minTier: rules.minTier };
}

export const ALL_PROBABLE_MARKETS = 'all';

/**
 * Configuración efectiva de "más probables": la de ajustes con las reglas elegidas aquí
 * y, si se eligió un mercado, solo ese.
 */
export function probableConfig(config, rules, market = ALL_PROBABLE_MARKETS) {
  const markets = market === ALL_PROBABLE_MARKETS ? config.probable.markets : [market];
  return { ...config.probable, markets, minOdds: rules.minOdds, minProbability: rules.minProbability };
}

/** Desplegable "Mercado" de "más probables" (lo usan la Combinada y el Día). */
export function probableMarketSelect(config, value, onChange) {
  return selectField({
    label: TEXTS.combos.probableMarket,
    value,
    options: [ALL_PROBABLE_MARKETS, ...config.probable.markets].map((id) => ({ id, label: TEXTS.combos.probableMarkets[id] ?? id })),
    onChange,
  });
}

/**
 * Lo que cambia según el modo: de dónde salen los candidatos y las sugeridas.
 * @returns {{ rules: Object, candidatesOf: (analyses: Object[]) => Object[], suggestions: () => { title: string, combo: Object }[] }}
 */
function modeSetup(state) {
  if (state.comboMode === COMBO_MODES.PROBABLE) {
    const config = probableConfig(state.config, state.probableRules, state.probableMarket);
    return {
      rules: state.probableRules,
      candidatesOf: (analyses) => probableCandidates(analyses, config),
      suggestions: () =>
        buildProbableCombos(state.analyses, config, state.config.combos)
          .slice(0, 2)
          .map((combo, index) => ({ title: TEXTS.combos.probableTitles[index], combo })),
    };
  }
  const config = comboConfig(state.config, state.comboRules);
  return {
    rules: state.comboRules,
    candidatesOf: (analyses) => comboCandidates(analyses, config),
    suggestions: () => {
      const { safest, bestValue } = buildCombos(state.analyses, config);
      return [
        safest[0] ? { title: TEXTS.combos.safest, combo: safest[0] } : null,
        bestValue[0] && bestValue[0] !== safest[0] ? { title: TEXTS.combos.bestValue, combo: bestValue[0] } : null,
      ].filter(Boolean);
    },
  };
}

/** Piernas elegidas que siguen existiendo en los análisis actuales. */
export function resolveLegs(analyses, keys) {
  const all = analyses.flatMap((analysis) => analysis.picks.map((pick) => ({ analysis, pick })));
  return keys.map((key) => all.find(({ analysis, pick }) => pickKey(analysis.match, pick) === key)).filter(Boolean);
}

/** Texto para copiar la combinada. */
export function comboText(legs) {
  const combo = priceCombo(legs);
  return [
    ...legs.map(({ analysis, pick }) => `• ${analysis.match.title}: ${pickName(pick, analysis.match)} @ ${odds(pick.odds)}`),
    TEXTS.combos.copyTotals(odds(combo.odds), percent(combo.probability, 1), signedPercent(combo.ev)),
  ].join('\n');
}

const legMeta = (analysis) => [analysis.match.title, kickoffParts(analysis.match.kickoff)?.time].filter(Boolean).join(' · ');

function totalsCard(legs) {
  const combo = priceCombo(legs);
  return card(
    { variant: 'accent' },
    h(
      'div',
      { class: 'combo-total' },
      h('div', {}, h('p', { class: 'note' }, TEXTS.combos.totalOdds), h('p', { class: 'combo-total__odds' }, odds(combo.odds))),
      h('div', { class: 'combo-total__right' }, h('p', { class: 'note' }, TEXTS.columns.ev), h('p', { class: `combo-total__ev ${combo.ev >= 0 ? 'positive' : 'negative'}` }, signedPercent(combo.ev, 0))),
    ),
    stats(
      [
        { value: percent(combo.probability), label: TEXTS.combos.probability, small: true },
        { value: odds(combo.probability > 0 ? 1 / combo.probability : null), label: TEXTS.combos.fairOdds, small: true },
      ],
      2,
    ),
  );
}

function legCard({ analysis, pick }, onRemove) {
  return h(
    'li',
    { class: 'card leg' },
    h(
      'div',
      { class: 'leg__text' },
      h('p', { class: 'note' }, legMeta(analysis)),
      h('p', { class: 'leg__title' }, pickName(pick, analysis.match)),
      h('div', { class: 'leg__meta' }, tierBadge(pick.tier), `${percent(pick.probability)} ${TEXTS.day.versus} ${percent(pick.fairProbability)}`),
    ),
    h('span', { class: 'leg__odds' }, odds(pick.odds)),
    iconButton({ icon: 'close', label: TEXTS.combos.remove, variant: 'icon-button--boxed', onClick: onRemove }),
  );
}

function candidateCard(leg, legs, onAdd) {
  const preview = priceCombo([...legs, leg]);
  return h(
    'li',
    { class: 'card card--dashed leg' },
    h(
      'div',
      { class: 'leg__text' },
      h('p', { class: 'note' }, legMeta(leg.analysis)),
      h('p', { class: 'leg__title' }, `${pickName(leg.pick, leg.analysis.match)} · ${odds(leg.pick.odds)}`),
      h('p', { class: 'note' }, legs.length ? TEXTS.combos.withThis(odds(preview.odds), percent(preview.probability)) : TEXTS.combos.single(percent(leg.pick.probability), signedPercent(leg.pick.ev))),
    ),
    iconButton({ icon: 'plus', label: TEXTS.combos.add, variant: 'icon-button--boxed', onClick: onAdd }),
  );
}

function candidateList(candidates, renderLeg) {
  const shown = h('ul', { class: 'stack stack--tight' }, candidates.slice(0, CANDIDATES_SHOWN).map(renderLeg));
  const rest = candidates.slice(CANDIDATES_SHOWN);
  if (!rest.length) return shown;
  return [
    shown,
    h(
      'details',
      { class: 'disclosure' },
      h('summary', { class: 'link' }, TEXTS.combos.moreCandidates(rest.length)),
      h('ul', { class: 'stack stack--tight' }, rest.map(renderLeg)),
    ),
  ];
}

function suggestionCard(combo, title, onUse) {
  return card(
    { title, actions: h('strong', {}, odds(combo.odds)) },
    h('ul', { class: 'bullets' }, combo.legs.map(({ analysis, pick }) => h('li', {}, `${pickName(pick, analysis.match)} (${analysis.match.title})`))),
    h('p', { class: 'note' }, TEXTS.combos.suggestionTotals(percent(combo.probability, 1), signedPercent(combo.ev))),
    button({ label: TEXTS.combos.use, variant: 'soft block', onClick: onUse }),
  );
}

function rulesCard(mode, rules, setRules) {
  const setOdds = (value) => setRules({ minOdds: Math.round(Math.min(MIN_ODDS_LIMITS.max, Math.max(MIN_ODDS_LIMITS.min, value)) * 100) / 100 });
  const probable = mode === COMBO_MODES.PROBABLE;
  const levelRow = probable
    ? h(
        'div',
        { class: 'rule-row' },
        h('p', { class: 'strong' }, TEXTS.combos.minProbability),
        h(
          'div',
          { class: 'pills', role: 'group', 'aria-label': TEXTS.combos.minProbability },
          PROBABILITY_CHOICES.map((value) =>
            h('button', { type: 'button', class: 'pill', 'aria-pressed': String(rules.minProbability === value), onClick: () => setRules({ minProbability: value }) }, percent(value)),
          ),
        ),
      )
    : h(
        'div',
        { class: 'rule-row' },
        h('p', { class: 'strong' }, TEXTS.combos.minTier),
        h(
          'div',
          { class: 'pills', role: 'group', 'aria-label': TEXTS.combos.minTier },
          TIER_CHOICES.map((tier) =>
            h('button', { type: 'button', class: 'pill', 'aria-pressed': String(rules.minTier === tier), onClick: () => setRules({ minTier: tier }) }, TEXTS.tiers[tier]),
          ),
        ),
      );
  return card(
    { label: TEXTS.combos.rules },
    h(
      'div',
      { class: 'rule-row' },
      h('div', {}, h('p', { class: 'strong' }, TEXTS.combos.minOdds), h('p', { class: 'note' }, probable ? TEXTS.combos.minOddsProbableHint : TEXTS.combos.minOddsHint)),
      h(
        'div',
        { class: 'stepper' },
        iconButton({ icon: 'minus', label: TEXTS.combos.less, variant: 'icon-button--boxed', onClick: () => setOdds(rules.minOdds - ODDS_STEP) }),
        h('span', { class: 'stepper__value' }, odds(rules.minOdds)),
        iconButton({ icon: 'plus', label: TEXTS.combos.more, variant: 'icon-button--boxed', onClick: () => setOdds(rules.minOdds + ODDS_STEP) }),
      ),
    ),
    levelRow,
    h(
      'label',
      { class: 'rule-row' },
      h('span', { class: 'strong' }, TEXTS.combos.onePerMatch),
      h('input', { type: 'checkbox', class: 'check', checked: rules.onePerMatch, onChange: (event) => setRules({ onePerMatch: event.target.checked }) }),
    ),
  );
}

/**
 * @param {Object} state   comboKeys, comboRules, analyses, config
 * @param {{ setComboKeys: Function, setComboRules: Function, copyText: Function }} actions
 */
export function renderCombo(state, actions) {
  const { analyses, comboKeys } = state;
  const mode = state.comboMode;
  const setup = modeSetup(state);
  const { rules } = setup;
  const setRules = mode === COMBO_MODES.PROBABLE ? actions.setProbableRules : actions.setComboRules;
  const legs = resolveLegs(analyses, comboKeys);
  const usedMatches = new Set(legs.map(({ analysis }) => analysis.match.id));
  const chosen = new Set(comboKeys);
  const candidates = setup.candidatesOf(analyses).filter(
    ({ analysis, pick }) => !chosen.has(pickKey(analysis.match, pick)) && !(rules.onePerMatch && usedMatches.has(analysis.match.id)),
  );
  const withoutCandidates = analyses.filter((analysis) => !setup.candidatesOf([analysis]).length);
  const keyOf = ({ analysis, pick }) => pickKey(analysis.match, pick);
  const setLegs = (list) => actions.setComboKeys(list.map(keyOf));
  const suggestions = legs.length ? [] : setup.suggestions();

  return [
    pageHead({
      eyebrow: [tournamentLine(analyses), dayTitle(analyses)].filter(Boolean).join(' · '),
      title: TEXTS.combos.title,
      actions: legs.length ? iconButton({ icon: 'trash', label: TEXTS.combos.clear, onClick: () => actions.setComboKeys([]) }) : null,
    }),
    segmented(
      [
        { id: COMBO_MODES.VALUE, label: TEXTS.combos.modes.value },
        { id: COMBO_MODES.PROBABLE, label: TEXTS.combos.modes.probable },
      ],
      mode,
      actions.setComboMode,
      TEXTS.combos.modeLabel,
    ),
    note(mode === COMBO_MODES.PROBABLE ? TEXTS.combos.modeHints.probable : TEXTS.combos.modeHints.value),
    mode === COMBO_MODES.PROBABLE ? probableMarketSelect(state.config, state.probableMarket, actions.setProbableMarket) : null,
    h(
      'div',
      { class: 'grid grid--wide' },
      h(
        'div',
        { class: 'stack' },
        legs.length ? totalsCard(legs) : null,
        legs.length
          ? [sectionLabel(TEXTS.combos.selections(legs.length)), h('ol', { class: 'stack stack--tight' }, legs.map((leg) => legCard(leg, () => setLegs(legs.filter((other) => other !== leg)))))]
          : null,
        suggestions.length
          ? [sectionLabel(TEXTS.combos.suggested), suggestions.map(({ title, combo }) => suggestionCard(combo, title, () => setLegs(combo.legs)))]
          : null,
        sectionLabel(legs.length ? TEXTS.combos.canAdd : TEXTS.combos.eligible),
        candidates.length
          ? candidateList(candidates, (leg) => candidateCard(leg, legs, () => setLegs([...legs, leg])))
          : emptyState({ icon: 'combo', title: TEXTS.combos.noCandidates, text: TEXTS.combos.noCandidatesHint }),
        withoutCandidates.length ? h('p', { class: 'note' }, TEXTS.combos.withoutCandidates(withoutCandidates.map((analysis) => analysis.match.title))) : null,
      ),
      h(
        'div',
        { class: 'stack' },
        rulesCard(mode, rules, setRules),
        notice(TEXTS.combos.independence, 'info'),
        legs.length ? button({ label: TEXTS.combos.copy, icon: 'copy', variant: 'primary lg block', onClick: () => actions.copyText(comboText(legs), TEXTS.combos.copied) }) : null,
      ),
    ),
  ];
}
