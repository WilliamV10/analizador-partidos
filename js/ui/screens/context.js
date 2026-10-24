/**
 * Contexto con Claude en tres pasos: copiar el resumen, Claude investiga, pegar su
 * bloque. Debajo, cada ajuste aplicado (antes → después) con su casilla para activarlo.
 * El cuadro de texto es un nodo fijo: se reutiliza en cada dibujo y no pierde lo pegado.
 */
import { applyContextToLambdas, findContext } from '../../domain/context.js';
import { TEXTS } from '../../texts.js';
import { button, card, note, pageHead, sectionLabel, segmented, tierBadge } from '../components.js';
import { h } from '../dom.js';
import { decimal } from '../formatters.js';
import { buildClaudePrompt } from '../claudePrompt.js';
import { icon } from '../icons.js';
import { dayTitle, needsReview, tournamentLine } from './shared.js';

export const CONTEXT_SCOPES = Object.freeze({ REVIEW: 'review', ALL: 'all' });

/** Caracteres del resumen que se muestran como vista previa. */
const PREVIEW_CHARS = 700;

/** Clave de un bloque de contexto (para activarlo o desactivarlo). */
export function contextKey(context) {
  return String(context.id ?? context.title ?? '');
}

/** Partidos que entran en "Copiar para Claude" según el alcance elegido. */
export function promptAnalyses(analyses, scope) {
  const review = analyses.filter(needsReview);
  return scope === CONTEXT_SCOPES.REVIEW && review.length ? review : analyses;
}

const textarea = h('textarea', {
  class: 'textarea',
  rows: '4',
  spellcheck: 'false',
  placeholder: '{"tipo":"contexto-claude","version":1,"partidos":[…]}',
  'aria-label': TEXTS.contextScreen.pasteLabel,
});
const validation = h('p', { class: 'status', role: 'status', 'aria-live': 'polite' });

/** Muestra el resultado de validar lo pegado (sin redibujar la pantalla). */
export function showContextValidation(message, kind) {
  validation.textContent = message;
  validation.dataset.kind = kind;
}

export function clearContextInput() {
  textarea.value = '';
  showContextValidation('', 'info');
}

function steps() {
  return h(
    'ol',
    { class: 'steps' },
    TEXTS.contextScreen.steps.map((text, index) => h('li', { class: 'step' }, h('span', { class: 'step__number' }, index + 1), text)),
  );
}

function copyCard(analyses, scope, actions) {
  const reviewCount = analyses.filter(needsReview).length;
  const subset = promptAnalyses(analyses, scope);
  const prompt = buildClaudePrompt(subset);
  return card(
    { title: TEXTS.contextScreen.copyTitle },
    reviewCount
      ? segmented(
          [
            { id: CONTEXT_SCOPES.REVIEW, label: TEXTS.contextScreen.review(reviewCount) },
            { id: CONTEXT_SCOPES.ALL, label: TEXTS.contextScreen.all(analyses.length) },
          ],
          scope,
          actions.setContextScope,
          TEXTS.contextScreen.scopeLabel,
        )
      : null,
    h('pre', { class: 'code-preview' }, prompt.slice(0, PREVIEW_CHARS)),
    button({
      label: TEXTS.contextScreen.copyButton(subset.length),
      icon: 'copy',
      variant: 'primary lg block',
      onClick: () => actions.copyText(prompt, TEXTS.contextPanel.copied(subset.length)),
    }),
  );
}

function pasteCard(actions) {
  textarea.oninput = () => actions.previewContext(textarea.value);
  return card(
    { title: TEXTS.contextScreen.pasteTitle },
    textarea,
    validation,
    h(
      'div',
      { class: 'button-row' },
      button({ label: TEXTS.contextScreen.apply, variant: 'primary', onClick: () => actions.applyContext(textarea.value) }),
    ),
  );
}

function adjustmentCard(analysis, context, enabled, config, onToggle) {
  const before = analysis.lambdas.blended;
  const after = applyContextToLambdas(before, context, config.context);
  const pair = (lambdas) => `${decimal(lambdas.home)}–${decimal(lambdas.away)}`;
  const tier = TEXTS.confidenceTier[context.confidence] ?? 'none';
  return card(
    {
      title: analysis.match.title,
      actions: h(
        'span',
        { class: 'pills' },
        context.confidence ? tierBadge(tier) : null,
        h('input', {
          type: 'checkbox',
          class: 'check',
          checked: enabled,
          'aria-label': TEXTS.contextScreen.toggle(analysis.match.title),
          onChange: (event) => onToggle(event.target.checked),
        }),
      ),
    },
    h(
      'div',
      { class: 'adjustment__lambdas' },
      h('span', { class: 'adjustment__before' }, pair(before)),
      icon('arrow', 16),
      h('span', { class: 'adjustment__after' }, pair(enabled ? after : before)),
      h('span', { class: 'note' }, TEXTS.context.adjustmentsSummary(context.adjustments, context)),
    ),
    context.notes.length ? h('ul', { class: 'bullets' }, context.notes.map((text) => h('li', {}, text))) : null,
  );
}

function appliedList(state, actions) {
  const entries = state.analyses
    .map((analysis) => ({ analysis, context: findContext(state.contexts, analysis.match) }))
    .filter(({ context }) => context);
  if (!entries.length) return note(TEXTS.contextScreen.noneApplied);
  const disabled = new Set(state.disabledContexts);
  return [
    h(
      'div',
      { class: 'page-head' },
      sectionLabel(TEXTS.contextScreen.applied),
      h('button', { type: 'button', class: 'link', onClick: actions.clearContext }, TEXTS.contextScreen.removeAll),
    ),
    h(
      'div',
      { class: 'grid' },
      entries.map(({ analysis, context }) =>
        adjustmentCard(analysis, context, !disabled.has(contextKey(context)), state.config, (enabled) => actions.toggleContext(contextKey(context), enabled)),
      ),
    ),
  ];
}

/**
 * @param {Object} state
 * @param {Object} actions
 */
export function renderContext(state, actions) {
  const { analyses } = state;
  return [
    pageHead({
      eyebrow: [tournamentLine(analyses), dayTitle(analyses), TEXTS.contextScreen.matches(analyses.length)].filter(Boolean).join(' · '),
      title: TEXTS.contextScreen.title,
    }),
    steps(),
    h('div', { class: 'grid grid--wide' }, copyCard(analyses, state.contextScope, actions), pasteCard(actions)),
    appliedList(state, actions),
  ];
}
