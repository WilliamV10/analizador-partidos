/**
 * Zona de resultados: errores de análisis y, según la vista elegida,
 * resumen del día, partidos (lista + detalle), ranking de picks o combinadas.
 */
import { TIERS } from '../../domain/value.js';
import { TEXTS } from '../../texts.js';
import { tabs } from '../components.js';
import { h, replaceContent } from '../dom.js';
import { renderCombos } from './combosView.js';
import { renderDaySummary } from './daySummary.js';
import { renderMatchDetail } from './matchDetail.js';
import { renderMatchList } from './matchList.js';
import { renderPicksRanking } from './picksRanking.js';

export const VIEWS = Object.freeze({ DAY: 'day', MATCH: 'match', PICKS: 'picks', COMBOS: 'combos' });

function renderFailures(failures) {
  if (!failures.length) return null;
  return h(
    'ul',
    { class: 'alerts' },
    failures.map((failure) =>
      h('li', { class: 'alert alert--warning' }, TEXTS.errors.analysisFailed(failure.title, failure.message)),
    ),
  );
}

function matchView(state, actions) {
  const { analyses, selectedId } = state;
  const selected = analyses.find((analysis) => analysis.match.id === selectedId) ?? analyses[0];
  const hasList = analyses.length > 1;
  return h(
    'div',
    { class: `results-layout${hasList ? ' results-layout--with-list' : ''}` },
    hasList ? renderMatchList(analyses, selected?.match.id ?? null, actions.selectMatch) : null,
    selected
      ? renderMatchDetail(selected, {
          matchTab: state.matchTab,
          onSelectTab: actions.selectMatchTab,
          onlyValue: state.onlyValue,
          onToggleOnlyValue: actions.toggleOnlyValue,
        })
      : null,
  );
}

const VIEW_RENDERERS = {
  [VIEWS.DAY]: (state, actions) => renderDaySummary(state.analyses, actions.openMatch),
  [VIEWS.MATCH]: matchView,
  [VIEWS.PICKS]: (state, actions) => renderPicksRanking(state.analyses, state.pickFilters, actions.changePickFilters),
  [VIEWS.COMBOS]: (state) => renderCombos(state.analyses, state.config.combos),
};

function viewTabs(state, actions) {
  const valuePicks = state.analyses.reduce(
    (total, analysis) => total + analysis.picks.filter((pick) => pick.tier !== TIERS.NONE).length,
    0,
  );
  const items = [
    { id: VIEWS.DAY, label: TEXTS.views.day },
    { id: VIEWS.MATCH, label: TEXTS.views.match, count: state.analyses.length },
    { id: VIEWS.PICKS, label: TEXTS.views.picks, count: valuePicks },
    { id: VIEWS.COMBOS, label: TEXTS.views.combos },
  ];
  return tabs(items, state.view, actions.selectView, { primary: true, label: TEXTS.a11y.views });
}

/**
 * @param {HTMLElement} root
 * @param {Object} state   ver createInitialState en main.js
 * @param {Object} actions
 */
export function renderResults(root, state, actions) {
  const { analyses, failures } = state;
  if (!analyses.length && !failures.length) {
    replaceContent(root);
    return;
  }
  const isSingle = analyses.length <= 1;
  const view = isSingle ? VIEWS.MATCH : state.view;
  replaceContent(
    root,
    h(
      'div',
      { class: 'stack' },
      renderFailures(failures),
      isSingle ? null : viewTabs(state, actions),
      analyses.length ? VIEW_RENDERERS[view](state, actions) : null,
    ),
  );
}
