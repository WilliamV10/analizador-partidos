/**
 * Acciones del historial: registrar apuestas, cargar resultados, respaldo.
 * Conecta el caso de uso (app/history.js) con el estado y la interfaz.
 */
import { exportBackup, importBackup, importResults } from '../app/importResults.js';
import { readTextFiles } from '../io/fileReader.js';
import { ImportError } from '../io/importError.js';
import { TEXTS, marketLabel, pickTitle } from '../texts.js';
import { downloadText } from './download.js';
import { buildResultsScript } from './resultsScript.js';

const success = (message) => ({ message, kind: 'success' });

function describeError(error) {
  if (error instanceof ImportError) return TEXTS.errors[error.code]?.(error.params) ?? error.code;
  return TEXTS.errors.unexpected(error?.message ?? String(error));
}

/**
 * @param {Object} deps
 * @param {ReturnType<typeof import('../app/history.js').createHistory>} deps.history
 * @param {ReturnType<typeof import('./store.js').createStore>} deps.store
 * @param {ReturnType<typeof import('./betDialog.js').bindBetDialog>} deps.betDialog
 */
export function createHistoryController({ history, store, betDialog }) {
  const config = () => store.getState().config.history;

  /** Vuelca los registros al estado (y un mensaje opcional para la vista). */
  function refresh(status = null) {
    store.setState({
      history: { records: history.list(), persistent: history.persistent, ready: true, status },
      pendingCount: history.pendingMatchIds(config().maxScriptMatches).length,
    });
  }

  async function run(task) {
    try {
      refresh(await task());
    } catch (error) {
      refresh({ message: describeError(error), kind: 'error' });
    }
  }

  function openBetDialog(record) {
    const names = { home: record.home, away: record.away };
    betDialog.open(
      {
        matchTitle: record.matchTitle,
        market: marketLabel(record.market),
        selection: pickTitle(record.market, record.selection, names),
        odds: record.odds,
        bet: record.bet,
      },
      {
        onSave: (bet) =>
          run(async () => {
            await history.saveBet(record, bet);
            return success(TEXTS.bets.saved);
          }),
        onRemove: () =>
          run(async () => {
            await history.removeBet(record.key);
            return success(TEXTS.bets.removed);
          }),
      },
    );
  }

  async function settleTexts(sources) {
    const results = sources.flatMap((source) => importResults(source.text, source.name));
    const settled = await history.settle(results);
    const finished = results.filter((result) => result.finished).length;
    return settled
      ? success(TEXTS.history.settledNow(settled, finished, results.length))
      : { message: TEXTS.history.nothingSettled, kind: 'error' };
  }

  return {
    refresh,

    async load() {
      await history.load();
      refresh();
    },

    /** Guarda las predicciones de un análisis nuevo (si nada cambió, no redibuja). */
    async recordAnalyses(analyses) {
      try {
        if (await history.recordAnalyses(analyses)) refresh();
      } catch (error) {
        refresh({ message: describeError(error), kind: 'error' });
      }
    },

    /** Lo que necesitan las tablas de picks para mostrar y registrar apuestas. */
    betting: {
      isRegistered: (match, pick) => Boolean(history.recordFor(match, pick).bet),
      onRegister: (match, pick) => openBetDialog(history.recordFor(match, pick)),
    },

    /** Acciones de la vista Historial. */
    viewActions: {
      editBet: openBetDialog,

      async copyResultsScript() {
        const ids = history.pendingMatchIds(config().maxScriptMatches);
        const script = buildResultsScript(ids);
        try {
          await navigator.clipboard.writeText(script);
          refresh(success(TEXTS.history.scriptCopied(ids.length)));
        } catch {
          downloadText('script_resultados.js', script, 'text/javascript');
          refresh({ message: TEXTS.history.scriptCopyFailed, kind: 'error' });
        }
      },

      loadResults: ({ text, files }) =>
        run(async () => {
          const sources = [
            ...(text.trim() ? [{ name: TEXTS.loader.pastedSource, text }] : []),
            ...(await readTextFiles(files)),
          ];
          return settleTexts(sources);
        }),

      exportHistory() {
        const now = Date.now();
        downloadText(`historial_analizador_${new Date(now).toISOString().slice(0, 10)}.json`, exportBackup(history.list(), now));
        refresh(success(TEXTS.history.exported));
      },

      importHistory: (files) =>
        run(async () => {
          const sources = await readTextFiles(files);
          const imported = sources.flatMap((source) => importBackup(source.text, source.name));
          const changed = await history.merge(imported);
          return success(TEXTS.history.imported(changed));
        }),

      clearHistory() {
        if (!window.confirm(TEXTS.history.confirmClear)) return;
        run(async () => {
          await history.clear();
          return success(TEXTS.history.cleared);
        });
      },
    },
  };
}
