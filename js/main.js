/**
 * Punto de entrada: conecta carga -> importación -> análisis -> estado -> interfaz.
 * Los ajustes del usuario y el contexto de Claude vuelven a analizar los partidos ya cargados.
 */
import { analyzeMatches } from './app/analyzeMatches.js';
import { importContext } from './app/importContext.js';
import { importMatches } from './app/importMatches.js';
import { applySettings, cleanOverrides } from './app/settings.js';
import { CONFIG } from './config.js';
import { ALL_MARKETS } from './domain/ranking.js';
import { TIERS } from './domain/value.js';
import { ImportError } from './io/importError.js';
import { readTextFiles } from './io/fileReader.js';
import { TEXTS } from './texts.js';
import { buildClaudePrompt } from './ui/claudePrompt.js';
import { bindContextPanel } from './ui/contextPanel.js';
import { bindLoader } from './ui/loaderPanel.js';
import { readJsonPreference, removePreference, writeJsonPreference } from './ui/preferences.js';
import { DEFAULT_MATCH_TAB } from './ui/renderers/matchDetail.js';
import { VIEWS, renderResults } from './ui/renderers/results.js';
import { bindSettingsPanel } from './ui/settingsPanel.js';
import { createStore } from './ui/store.js';
import { bindThemeToggle } from './ui/theme.js';

const NARROW_SCREEN = '(max-width: 899px)';
const SETTINGS_STORAGE_KEY = 'analizador.settings';

const DEFAULT_PICK_FILTERS = Object.freeze({ market: ALL_MARKETS, minTier: TIERS.LOW, minOdds: 1 });

const EMPTY_RESULTS = Object.freeze({ matches: [], analyses: [], failures: [], selectedId: null, contexts: [] });

const store = createStore({
  ...EMPTY_RESULTS,
  view: VIEWS.DAY,
  matchTab: DEFAULT_MATCH_TAB,
  onlyValue: true,
  pickFilters: DEFAULT_PICK_FILTERS,
  config: applySettings(CONFIG, readJsonPreference(SETTINGS_STORAGE_KEY, {})),
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
};

const loader = bindLoader(document.getElementById('loader'), {
  async onAnalyze({ pastedText, files, mode }) {
    try {
      const sources = [
        ...(pastedText.trim() ? [{ name: TEXTS.loader.pastedSource, text: pastedText }] : []),
        ...(await readTextFiles(files)),
      ];
      const matches = importMatches(sources, mode);
      const analyses = analyze({
        matches,
        config: store.getState().config,
        contexts: [],
        selectedId: matches[0]?.id ?? null,
        view: matches.length > 1 ? VIEWS.DAY : VIEWS.MATCH,
        matchTab: DEFAULT_MATCH_TAB,
      });
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
      contextPanel.showStatus(message, 'success');
      contextPanel.setSummary(message);
    } catch (error) {
      contextPanel.showStatus(describeError(error), 'error');
    }
  },
  onClear() {
    reanalyze({ contexts: [] });
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

store.subscribe((state) => {
  contextPanel.setAvailable(state.analyses.length > 0);
  renderResults(document.getElementById('results'), state, actions);
});
