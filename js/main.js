/**
 * Punto de entrada: conecta carga -> importación -> análisis -> estado -> interfaz.
 * Los ajustes del usuario y el contexto de Claude vuelven a analizar los partidos ya cargados.
 */
import { analyzeMatches } from './app/analyzeMatches.js';
import { createHistory } from './app/history.js';
import { importContext } from './app/importContext.js';
import { importMatches } from './app/importMatches.js';
import { applySettings, cleanOverrides } from './app/settings.js';
import { CONFIG } from './config.js';
import { PERFORMANCE_MODES } from './domain/performance.js';
import { ALL_MARKETS } from './domain/ranking.js';
import { TIERS } from './domain/value.js';
import { openHistoryStore } from './io/historyDb.js';
import { ImportError } from './io/importError.js';
import { readTextFiles } from './io/fileReader.js';
import { clearSession, loadSession, saveSession, saveSessionContext } from './io/sessionStore.js';
import { TEXTS } from './texts.js';
import { bindBetDialog } from './ui/betDialog.js';
import { buildClaudePrompt } from './ui/claudePrompt.js';
import { bindContextPanel } from './ui/contextPanel.js';
import { createHistoryController } from './ui/historyController.js';
import { bindLoader } from './ui/loaderPanel.js';
import { readJsonPreference, removePreference, writeJsonPreference } from './ui/preferences.js';
import { renderHistory } from './ui/renderers/historyView.js';
import { DEFAULT_MATCH_TAB } from './ui/renderers/matchDetail.js';
import { VIEWS, renderResults } from './ui/renderers/results.js';
import { bindSettingsPanel } from './ui/settingsPanel.js';
import { createStore } from './ui/store.js';
import { bindThemeToggle } from './ui/theme.js';

const NARROW_SCREEN = '(max-width: 899px)';
const SETTINGS_STORAGE_KEY = 'analizador.settings';

const DEFAULT_PICK_FILTERS = Object.freeze({ market: ALL_MARKETS, minTier: TIERS.LOW, minOdds: 1 });

const EMPTY_RESULTS = Object.freeze({ matches: [], analyses: [], failures: [], selectedId: null, contexts: [] });

/** Pantallas: el análisis del día o el historial de picks y resultados. */
const SCREENS = Object.freeze({ ANALYSIS: 'analysis', HISTORY: 'history' });

const store = createStore({
  ...EMPTY_RESULTS,
  screen: SCREENS.ANALYSIS,
  view: VIEWS.DAY,
  matchTab: DEFAULT_MATCH_TAB,
  onlyValue: true,
  pickFilters: DEFAULT_PICK_FILTERS,
  config: applySettings(CONFIG, readJsonPreference(SETTINGS_STORAGE_KEY, {})),
  historyMode: PERFORMANCE_MODES.BETS,
  history: { records: [], persistent: true, ready: false, status: null },
  pendingCount: 0,
});

const historyController = createHistoryController({
  history: createHistory(await openHistoryStore()),
  store,
  betDialog: bindBetDialog(document.getElementById('bet-dialog'), { defaultStake: CONFIG.history.defaultStake }),
});

function describeError(error) {
  if (error instanceof ImportError) return TEXTS.errors[error.code]?.(error.params) ?? error.code;
  return TEXTS.errors.unexpected(error?.message ?? String(error));
}

function scrollToDetailOnSmallScreens() {
  if (!window.matchMedia(NARROW_SCREEN).matches) return;
  document.getElementById('match-detail')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/** Analiza los partidos con la configuración y el contexto indicados y guarda el resultado. */
function analyze({ matches, config, contexts, ...patch }) {
  const { analyses, failures } = analyzeMatches(matches, config, contexts);
  store.setState({ matches, config, contexts, analyses, failures, ...patch });
  historyController.recordAnalyses(analyses);
  return analyses;
}

/** Vuelve a analizar lo cargado cambiando solo lo indicado (config o contexto). */
function reanalyze(changes) {
  const { matches, config, contexts } = store.getState();
  return analyze({ matches, config, contexts, ...changes });
}

const actions = {
  selectView(view) {
    store.setState({ view });
  },
  selectMatch(id) {
    store.setState({ selectedId: id });
    scrollToDetailOnSmallScreens();
  },
  openMatch(id) {
    store.setState({ selectedId: id, view: VIEWS.MATCH });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  },
  selectMatchTab(matchTab) {
    store.setState({ matchTab });
  },
  toggleOnlyValue() {
    store.setState({ onlyValue: !store.getState().onlyValue });
  },
  changePickFilters(patch) {
    store.setState({ pickFilters: { ...store.getState().pickFilters, ...patch } });
  },
  betting: historyController.betting,
};

const historyActions = {
  ...historyController.viewActions,
  setHistoryMode(historyMode) {
    store.setState({ historyMode });
  },
  closeHistory() {
    store.setState({ screen: SCREENS.ANALYSIS });
  },
};

const historyToggle = document.querySelector('[data-history-toggle]');
historyToggle.addEventListener('click', () => {
  const { screen } = store.getState();
  store.setState({ screen: screen === SCREENS.HISTORY ? SCREENS.ANALYSIS : SCREENS.HISTORY });
  window.scrollTo({ top: 0 });
});

/** Importa y analiza los JSON; devuelve los análisis (lanza si los datos no sirven). */
function loadSources(sources, mode, contexts = []) {
  const matches = importMatches(sources, mode);
  return analyze({
    matches,
    config: store.getState().config,
    contexts,
    selectedId: matches[0]?.id ?? null,
    view: matches.length > 1 ? VIEWS.DAY : VIEWS.MATCH,
    matchTab: DEFAULT_MATCH_TAB,
  });
}

const loader = bindLoader(document.getElementById('loader'), {
  async onAnalyze({ pastedText, files, mode }) {
    try {
      const sources = [
        ...(pastedText.trim() ? [{ name: TEXTS.loader.pastedSource, text: pastedText }] : []),
        ...(await readTextFiles(files)),
      ];
      const analyses = loadSources(sources, mode);
      saveSession({ sources, mode, contextText: null, savedAt: Date.now() });
      loader.showStatus(TEXTS.loader.loaded(analyses.length), 'success');
      loader.collapse(TEXTS.loader.summary(analyses));
      contextPanel.setSummary(null);
      contextPanel.showStatus('');
    } catch (error) {
      store.setState(EMPTY_RESULTS);
      loader.showStatus(describeError(error), 'error');
    }
  },
  onClear() {
    store.setState(EMPTY_RESULTS);
    clearSession();
    contextPanel.setSummary(null);
    contextPanel.showStatus('');
  },
});

const contextPanel = bindContextPanel(document.getElementById('context-panel'), {
  getPrompt() {
    const { analyses } = store.getState();
    if (!analyses.length) {
      contextPanel.showStatus(TEXTS.contextPanel.needMatches, 'error');
      return null;
    }
    return buildClaudePrompt(analyses);
  },
  onApply(text) {
    try {
      const contexts = importContext(text, TEXTS.context.title);
      const analyses = reanalyze({ contexts });
      const matched = analyses.filter((analysis) => analysis.context).length;
      if (!matched) {
        contextPanel.showStatus(TEXTS.contextPanel.noneMatched, 'error');
        return;
      }
      const message = TEXTS.contextPanel.applied(matched, analyses.length);
      saveSessionContext(text);
      contextPanel.showStatus(message, 'success');
      contextPanel.setSummary(message);
    } catch (error) {
      contextPanel.showStatus(describeError(error), 'error');
    }
  },
  onClear() {
    reanalyze({ contexts: [] });
    saveSessionContext(null);
    contextPanel.showStatus(TEXTS.contextPanel.cleared, 'success');
    contextPanel.setSummary(null);
  },
});

bindSettingsPanel(document.getElementById('settings'), document.querySelector('[data-settings-open]'), {
  defaults: CONFIG,
  getConfig: () => store.getState().config,
  onSave(overrides) {
    const saved = cleanOverrides(CONFIG, overrides);
    writeJsonPreference(SETTINGS_STORAGE_KEY, saved);
    reanalyze({ config: applySettings(CONFIG, saved) });
  },
  onReset() {
    removePreference(SETTINGS_STORAGE_KEY);
    reanalyze({ config: CONFIG });
  },
});

bindThemeToggle(document.querySelector('[data-theme-toggle]'));

const sections = {
  loader: document.getElementById('loader'),
  results: document.getElementById('results'),
  history: document.getElementById('history'),
};

store.subscribe((state) => {
  const showHistory = state.screen === SCREENS.HISTORY;
  historyToggle.setAttribute('aria-pressed', String(showHistory));
  sections.loader.hidden = showHistory;
  sections.results.hidden = showHistory;
  sections.history.hidden = !showHistory;
  contextPanel.setAvailable(!showHistory && state.analyses.length > 0);
  if (showHistory) renderHistory(sections.history, state, historyActions);
  else renderResults(sections.results, state, actions);
});

historyController.load();

/** Si había datos cargados antes de cerrar la página, se vuelven a analizar (con su bloque de Claude). */
async function restoreSession() {
  const session = await loadSession();
  if (!session) return;
  try {
    const contexts = session.contextText ? importContext(session.contextText, TEXTS.context.title) : [];
    const analyses = loadSources(session.sources, session.mode, contexts);
    loader.showStatus(TEXTS.loader.restored(analyses.length, session.savedAt), 'success');
    loader.collapse(TEXTS.loader.summary(analyses));
    if (contexts.length) {
      const matched = analyses.filter((analysis) => analysis.context).length;
      contextPanel.setSummary(TEXTS.contextPanel.applied(matched, analyses.length));
    }
  } catch {
    store.setState(EMPTY_RESULTS);
    clearSession();
  }
}

restoreSession();
