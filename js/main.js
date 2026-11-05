/**
 * Punto de entrada: conecta carga -> importación -> análisis -> estado -> pantallas.
 * Todo cambio pasa por el store; cada cambio vuelve a dibujar la pantalla activa.
 * Los ajustes y el contexto de Claude vuelven a analizar los partidos ya cargados.
 */
import { analyzeMatches } from './app/analyzeMatches.js';
import { createHistory } from './app/history.js';
import { importContext } from './app/importContext.js';
import { importMatches } from './app/importMatches.js';
import { applySettings, cleanOverrides } from './app/settings.js';
import { CONFIG } from './config.js';
import { findContext } from './domain/context.js';
import { DEFAULT_HISTORY_FILTERS } from './domain/historyFilters.js';
import { PERFORMANCE_MODES } from './domain/performance.js';
import { openHistoryStore } from './io/historyDb.js';
import { ImportError } from './io/importError.js';
import { readTextFiles } from './io/fileReader.js';
import { clearSession, loadSession, saveSession, saveSessionContext, saveSessionFinished } from './io/sessionStore.js';
import { TEXTS } from './texts.js';
import { bindBetDialog } from './ui/betDialog.js';
import { buildClaudePrompt } from './ui/claudePrompt.js';
import { replaceContent } from './ui/dom.js';
import { downloadText } from './ui/download.js';
import { createHistoryController } from './ui/historyController.js';
import { hydrateIcons, icon } from './ui/icons.js';
import { bindLoader } from './ui/loaderPanel.js';
import { bindScriptBuilder } from './ui/scriptBuilderPanel.js';
import { SCREENS, renderNavigation, resolveScreen } from './ui/navigation.js';
import { readJsonPreference, removePreference, writeJsonPreference } from './ui/preferences.js';
import { COMBO_MODES, renderCombo } from './ui/screens/combo.js';
import { CONTEXT_SCOPES, clearContextInput, contextKey, promptAnalyses, renderContext, showContextValidation } from './ui/screens/context.js';
import { DAY_FILTERS, DAY_PICK_MODES, renderDay } from './ui/screens/day.js';
import { EXPLORER_SCOPES, renderExplorer } from './ui/screens/explorer.js';
import { renderHistory } from './ui/screens/history.js';
import { DEFAULT_MATCH_TAB, PLAYERS_TAB, renderMatch } from './ui/screens/match.js';
import { PLAYER_SIDES } from './ui/screens/matchTabs/players.js';
import { VALUE_MODES } from './ui/screens/matchTabs/value.js';
import { renderSettings } from './ui/screens/settings.js';
import { ALL_LEAGUES, dayTitle, tournamentLine } from './ui/screens/shared.js';
import { createStore } from './ui/store.js';
import { bindThemeToggle, readTheme, setTheme } from './ui/theme.js';

const SETTINGS_STORAGE_KEY = 'analizador.settings';
const TOAST_MS = 3200;

const EMPTY_RESULTS = Object.freeze({
  matches: [],
  analyses: [],
  failures: [],
  selectedId: null,
  contexts: [],
  disabledContexts: [],
  comboKeys: [],
});

const initialConfig = applySettings(CONFIG, readJsonPreference(SETTINGS_STORAGE_KEY, {}));

const store = createStore({
  ...EMPTY_RESULTS,
  screen: SCREENS.DAY,
  matchTab: DEFAULT_MATCH_TAB,
  valueMode: VALUE_MODES.VALUE,
  valueGroup: 'all',
  playerSide: PLAYER_SIDES.BOTH,
  teamSide: 'home',
  dayFilter: DAY_FILTERS.ALL,
  league: ALL_LEAGUES,
  comboRules: { minOdds: initialConfig.combos.minOdds, minTier: initialConfig.combos.minTier, onePerMatch: true },
  comboMode: COMBO_MODES.VALUE,
  probableRules: { minOdds: initialConfig.probable.minOdds, minProbability: initialConfig.probable.minProbability, onePerMatch: true },
  dayPicksMode: DAY_PICK_MODES.VALUE,
  probableMarket: 'all',
  contextScope: CONTEXT_SCOPES.REVIEW,
  explorerStat: 'goals',
  explorerScope: EXPLORER_SCOPES.MATCH,
  explorerValue: null,
  config: initialConfig,
  theme: readTheme(),
  settingsRevision: 0,
  historyMode: PERFORMANCE_MODES.BETS,
  historyFilters: DEFAULT_HISTORY_FILTERS,
  historyPage: 0,
  history: { records: [], persistent: true, ready: false, status: null },
  pendingCount: 0,
  unsettleable: [],
});

const historyController = createHistoryController({
  history: createHistory(await openHistoryStore()),
  store,
  betDialog: bindBetDialog(document.getElementById('bet-dialog'), { defaultStake: CONFIG.history.defaultStake }),
  onMatchesFinished: (ids) => removeFinishedMatches(ids),
});

/* ---------- Utilidades de interfaz ---------- */

const toastElement = document.querySelector('[data-toast]');
let toastTimer = null;

function toast(message, kind = 'success') {
  toastElement.textContent = message;
  toastElement.dataset.kind = kind;
  toastElement.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toastElement.hidden = true;
  }, TOAST_MS);
}

function describeError(error) {
  if (error instanceof ImportError) return TEXTS.errors[error.code]?.(error.params) ?? error.code;
  return TEXTS.errors.unexpected(error?.message ?? String(error));
}

/** Copia al portapapeles; si el navegador no deja, descarga el texto como archivo. */
async function copyText(text, successMessage, fallbackName = 'texto_analizador.txt') {
  try {
    await navigator.clipboard.writeText(text);
    toast(successMessage);
  } catch {
    downloadText(fallbackName, text, 'text/plain');
    toast(TEXTS.app.copyFallback, 'error');
  }
}

/* ---------- Análisis ---------- */

const activeContexts = (contexts, disabled) => contexts.filter((context) => !disabled.includes(contextKey(context)));

/** Analiza los partidos con la configuración y el contexto indicados y guarda el resultado. */
function analyze({ matches, config, contexts, disabledContexts = [], ...patch }) {
  const { analyses, failures } = analyzeMatches(matches, config, activeContexts(contexts, disabledContexts));
  store.setState({ matches, config, contexts, disabledContexts, analyses, failures, ...patch });
  historyController.recordAnalyses(analyses);
  return analyses;
}

/** Vuelve a analizar lo cargado cambiando solo lo indicado (config o contexto). */
function reanalyze(changes) {
  const { matches, config, contexts, disabledContexts } = store.getState();
  return analyze({ matches, config, contexts, disabledContexts, ...changes });
}

/**
 * Quita de los analizados los partidos que ya terminaron (al cargar resultados): ya se
 * liquidaron en el historial y no sirven para apostar. La sesión guardada los recuerda.
 */
function removeFinishedMatches(ids, { quiet = false } = {}) {
  const state = store.getState();
  // Los de una prueba histórica vienen terminados a propósito: esos no se quitan.
  const finished = new Set(ids.filter((id) => !state.matches.find((match) => match.id === id)?.result));
  const matches = state.matches.filter((match) => !finished.has(match.id));
  const removed = state.matches.length - matches.length;
  if (!removed) return 0;
  saveSessionFinished([...finished]);
  if (!matches.length) {
    store.setState({ ...EMPTY_RESULTS });
    clearSession();
    clearContextInput();
    if (!quiet) toast(TEXTS.app.finishedRemovedAll(removed));
    return removed;
  }
  const analyses = state.analyses.filter((analysis) => !finished.has(analysis.match.id));
  const kept = new Set(matches.map((match) => match.id));
  store.setState({
    matches,
    analyses,
    comboKeys: state.comboKeys.filter((key) => kept.has(key.split('|')[0])),
    selectedId: kept.has(state.selectedId) ? state.selectedId : (matches[0]?.id ?? null),
  });
  if (!quiet) toast(TEXTS.app.finishedRemoved(removed, matches.length));
  return removed;
}

/** Importa y analiza los JSON; devuelve los análisis (lanza si los datos no sirven). */
function loadSources(sources, mode, contexts = [], finishedIds = []) {
  const finished = new Set(finishedIds);
  const matches = importMatches(sources, mode).filter((match) => !finished.has(match.id));
  return analyze({
    matches,
    config: store.getState().config,
    contexts,
    disabledContexts: [],
    comboKeys: [],
    selectedId: matches[0]?.id ?? null,
    matchTab: DEFAULT_MATCH_TAB,
    dayFilter: DAY_FILTERS.ALL,
    league: ALL_LEAGUES,
  });
}

/* ---------- Acciones ---------- */

function navigate(screen) {
  const state = store.getState();
  const patch = { screen };
  if (screen === SCREENS.MATCH && !state.selectedId) patch.selectedId = state.analyses[0]?.match.id ?? null;
  store.setState(patch);
}

function copyForClaude() {
  const { analyses, contextScope } = store.getState();
  if (!analyses.length) {
    toast(TEXTS.contextPanel.needMatches, 'error');
    navigate(SCREENS.LOAD);
    return;
  }
  const subset = promptAnalyses(analyses, contextScope);
  copyText(buildClaudePrompt(subset), TEXTS.contextPanel.copied(subset.length));
}

/** Guarda varios ajustes juntos ({ ruta: valor }) y recalcula una sola vez. */
function saveSettings(changes, message = TEXTS.settings.saved) {
  const overrides = { ...readJsonPreference(SETTINGS_STORAGE_KEY, {}), ...changes };
  const saved = cleanOverrides(CONFIG, overrides);
  writeJsonPreference(SETTINGS_STORAGE_KEY, saved);
  reanalyze({ config: applySettings(CONFIG, saved), settingsRevision: store.getState().settingsRevision + 1 });
  toast(message);
}

function saveSetting(path, value) {
  if (value === undefined) return;
  saveSettings({ [path]: value });
}

const actions = {
  navigate,
  copyText,
  backToDay: () => navigate(store.getState().analyses.length > 1 ? SCREENS.DAY : SCREENS.LOAD),
  openMatch(id) {
    store.setState({ selectedId: id, screen: SCREENS.MATCH });
  },
  openCombo(mode = COMBO_MODES.VALUE) {
    store.setState({ comboMode: mode, screen: SCREENS.COMBO });
  },
  setComboMode: (comboMode) => store.setState({ comboMode }),
  setProbableRules: (patch) => store.setState({ probableRules: { ...store.getState().probableRules, ...patch } }),
  setDayPicksMode: (dayPicksMode) => store.setState({ dayPicksMode }),
  setProbableMarket: (probableMarket) => store.setState({ probableMarket }),
  selectMatchTab: (matchTab) => store.setState({ matchTab }),
  setDayFilter: (dayFilter) => store.setState({ dayFilter }),
  setLeague: (league) => store.setState({ league, dayFilter: DAY_FILTERS.ALL }),
  setValueMode: (valueMode) => store.setState({ valueMode }),
  setValueGroup: (valueGroup) => store.setState({ valueGroup }),
  setPlayerSide: (playerSide) => store.setState({ playerSide }),
  setTeamSide: (teamSide) => store.setState({ teamSide }),
  setComboKeys: (comboKeys) => store.setState({ comboKeys }),
  setComboRules: (patch) => store.setState({ comboRules: { ...store.getState().comboRules, ...patch } }),
  setContextScope: (contextScope) => store.setState({ contextScope }),
  setExplorerStat: (explorerStat) => store.setState({ explorerStat, explorerValue: null }),
  setExplorerScope: (explorerScope) => store.setState({ explorerScope }),
  /** Solo guarda el valor: la pantalla ya lo muestra (no se redibuja, ver SCREEN_VIEWS). */
  setExplorerValue: (explorerValue) => store.setState({ explorerValue }),
  selectExplorerMatch: (selectedId) => store.setState({ selectedId, explorerScope: EXPLORER_SCOPES.MATCH }),
  openMatchPlayers: (selectedId) => store.setState({ selectedId, matchTab: PLAYERS_TAB, screen: SCREENS.MATCH }),
  betting: historyController.betting,

  previewContext(text) {
    if (!text.trim()) {
      showContextValidation('', 'info');
      return;
    }
    try {
      const contexts = importContext(text, TEXTS.context.title);
      const matched = store.getState().analyses.filter((analysis) => findContext(contexts, analysis.match)).length;
      showContextValidation(TEXTS.contextScreen.valid(matched, contexts.length), matched ? 'success' : 'error');
    } catch (error) {
      showContextValidation(describeError(error), 'error');
    }
  },
  applyContext(text) {
    try {
      const contexts = importContext(text, TEXTS.context.title);
      const analyses = reanalyze({ contexts, disabledContexts: [] });
      const matched = analyses.filter((analysis) => analysis.context).length;
      if (!matched) {
        showContextValidation(TEXTS.contextPanel.noneMatched, 'error');
        return;
      }
      saveSessionContext(text);
      clearContextInput();
      toast(TEXTS.contextPanel.applied(matched, analyses.length));
    } catch (error) {
      showContextValidation(describeError(error), 'error');
    }
  },
  clearContext() {
    reanalyze({ contexts: [], disabledContexts: [] });
    saveSessionContext(null);
    toast(TEXTS.contextPanel.cleared);
  },
  toggleContext(key, enabled) {
    const disabled = store.getState().disabledContexts.filter((candidate) => candidate !== key);
    reanalyze({ disabledContexts: enabled ? disabled : [...disabled, key] });
  },

  saveSetting,
  saveSettings: (changes) => saveSettings(changes, TEXTS.settings.calibration.applied(Object.keys(changes).length)),
  resetSettings() {
    removePreference(SETTINGS_STORAGE_KEY);
    reanalyze({ config: CONFIG, settingsRevision: store.getState().settingsRevision + 1 });
    toast(TEXTS.settings.reset);
  },
  setTheme(theme) {
    setTheme(theme);
    store.setState({ theme, settingsRevision: store.getState().settingsRevision + 1 });
  },

  ...historyController.viewActions,
  setHistoryMode: (historyMode) => store.setState({ historyMode, historyPage: 0 }),
  setHistoryFilters: (patch) => store.setState({ historyFilters: { ...store.getState().historyFilters, ...patch }, historyPage: 0 }),
  clearHistoryFilters: () => store.setState({ historyFilters: DEFAULT_HISTORY_FILTERS, historyPage: 0 }),
  setHistoryPage(historyPage) {
    store.setState({ historyPage });
    document.querySelector('.records')?.closest('.card')?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  },
};

/* ---------- Carga ---------- */

const loader = bindLoader(document.getElementById('screen-load'), {
  async onAnalyze({ pastedText, files, mode }) {
    try {
      const sources = [
        ...(pastedText.trim() ? [{ name: TEXTS.loader.pastedSource, text: pastedText }] : []),
        ...(await readTextFiles(files)),
      ];
      loadSources(sources, mode);
      await saveSession({ sources, mode, contextText: null, savedAt: Date.now() });
      // Los que ya se liquidaron (partidos terminados) no vuelven a aparecer.
      const removed = removeFinishedMatches(historyController.settledMatchIds(), { quiet: true });
      const { analyses } = store.getState();
      loader.resetInputs();
      if (!analyses.length) {
        loader.showStatus(TEXTS.app.finishedRemovedAll(removed), 'error');
        return;
      }
      loader.showStatus('');
      toast(removed ? TEXTS.loader.loadedWithoutFinished(analyses.length, removed) : TEXTS.loader.loaded(analyses.length));
      navigate(analyses.length > 1 ? SCREENS.DAY : SCREENS.MATCH);
    } catch (error) {
      loader.showStatus(describeError(error), 'error');
    }
  },
  onClear() {
    store.setState({ ...EMPTY_RESULTS });
    clearSession();
    clearContextInput();
  },
  onOpenLast: () => navigate(SCREENS.DAY),
});

bindScriptBuilder(document.querySelector('[data-script-builder]'), {
  copyText: (text, message) => copyText(text, message, 'script_sofascore.js'),
});

/** Si había datos cargados antes de cerrar la página, se vuelven a analizar (con su bloque de Claude). */
async function restoreSession() {
  const session = await loadSession();
  if (!session) return;
  try {
    const contexts = session.contextText ? importContext(session.contextText, TEXTS.context.title) : [];
    const analyses = loadSources(session.sources, session.mode, contexts, session.finishedIds);
    if (!analyses.length) {
      store.setState({ ...EMPTY_RESULTS });
      clearSession();
      return;
    }
    toast(TEXTS.loader.restored(analyses.length, session.savedAt));
  } catch {
    store.setState({ ...EMPTY_RESULTS });
    clearSession();
  }
}

/* ---------- Dibujo ---------- */

/**
 * Cómo se dibuja cada pantalla. `key`: lista de lo que la pantalla usa; si nada cambió, no se
 * redibuja (no pierde el foco ni corta el arrastre de un deslizador). Sin `key` se redibuja siempre.
 */
const SCREEN_VIEWS = {
  [SCREENS.DAY]: { render: renderDay },
  [SCREENS.MATCH]: { render: renderMatch },
  [SCREENS.EXPLORE]: {
    render: renderExplorer,
    key: (state) => [state.analyses, state.config, state.explorerStat, state.explorerScope, state.selectedId, state.league],
  },
  [SCREENS.COMBO]: { render: renderCombo },
  [SCREENS.CONTEXT]: { render: renderContext },
  [SCREENS.HISTORY]: { render: renderHistory },
  [SCREENS.SETTINGS]: { render: renderSettings, key: (state) => [state.settingsRevision, state.history.records] },
};

const roots = {
  load: document.getElementById('screen-load'),
  view: document.getElementById('screen-view'),
  topnav: document.querySelector('[data-topnav]'),
  bottomnav: document.querySelector('[data-bottomnav]'),
};

let drawn = { screen: null, key: undefined, selectedId: null };

const sameKey = (a, b) => Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((value, index) => value === b[index]);

function lastSessionSummary(analyses) {
  if (!analyses.length) return null;
  return {
    title: TEXTS.loader.lastTitle,
    detail: [tournamentLine(analyses), dayTitle(analyses), TEXTS.contextScreen.matches(analyses.length)].filter(Boolean).join(' · '),
  };
}

function render(state) {
  const hasData = state.analyses.length > 0;
  const screen = resolveScreen(state.screen, hasData);
  renderNavigation(roots, { screen, hasData }, navigate);

  const changedScreen = screen !== drawn.screen || (screen === SCREENS.MATCH && state.selectedId !== drawn.selectedId);
  roots.load.hidden = screen !== SCREENS.LOAD;
  roots.view.hidden = screen === SCREENS.LOAD;

  if (screen === SCREENS.LOAD) {
    loader.setLastSession(lastSessionSummary(state.analyses));
  } else {
    const view = SCREEN_VIEWS[screen];
    const key = view.key?.(state);
    if (changedScreen || key === undefined || !sameKey(key, drawn.key)) replaceContent(roots.view, view.render(state, actions));
    drawn.key = key;
  }
  if (changedScreen) window.scrollTo({ top: 0 });
  drawn = { ...drawn, screen, selectedId: state.selectedId };
}

const themeToggle = bindThemeToggle(document.querySelector('[data-theme-toggle]'), {
  getTheme: () => store.getState().theme,
  onChange: actions.setTheme,
  labels: TEXTS.theme,
  icon,
});

store.subscribe(render);
store.subscribe(themeToggle.paint);

document.querySelectorAll('[data-nav]').forEach((element) => element.addEventListener('click', () => navigate(element.dataset.nav)));
document.querySelectorAll('[data-copy-claude]').forEach((element) => element.addEventListener('click', copyForClaude));

hydrateIcons();
themeToggle.paint();
render(store.getState());
// Al abrir: si algún partido cargado ya se liquidó (ej. con una versión anterior), sale de los analizados.
await Promise.all([historyController.load(), restoreSession()]);
removeFinishedMatches(historyController.settledMatchIds());
