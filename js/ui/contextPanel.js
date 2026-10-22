/**
 * Panel "Contexto de Claude": copiar el resumen para Claude y pegar/aplicar su bloque.
 * Solo maneja eventos; delega el trabajo a los callbacks.
 */
import { TEXTS } from '../texts.js';

/**
 * @param {HTMLDetailsElement} root
 * @param {{ getPrompt: () => string|null, onApply: (text: string) => void, onClear: () => void }} callbacks
 */
export function bindContextPanel(root, { getPrompt, onApply, onClear }) {
  const textarea = root.querySelector('[data-context-input]');
  const status = root.querySelector('[data-context-status]');
  const summary = root.querySelector('[data-context-summary]');
  const defaultSummary = summary.textContent;

  function showStatus(message, kind = 'info') {
    status.textContent = message;
    status.dataset.kind = kind;
  }

  async function copyPrompt() {
    const prompt = getPrompt();
    if (!prompt) return;
    try {
      await navigator.clipboard.writeText(prompt);
      showStatus(TEXTS.contextPanel.copied((prompt.match(/^### /gm) ?? []).length), 'success');
    } catch {
      textarea.value = prompt;
      textarea.select();
      showStatus(TEXTS.contextPanel.copyFailed, 'error');
    }
  }

  root.querySelector('[data-context-copy]').addEventListener('click', copyPrompt);
  root.querySelector('[data-context-apply]').addEventListener('click', () => onApply(textarea.value));
  root.querySelector('[data-context-clear]').addEventListener('click', () => {
    textarea.value = '';
    onClear();
  });

  return {
    showStatus,
    /** Muestra el panel solo cuando hay partidos analizados. */
    setAvailable(isAvailable) {
      root.hidden = !isAvailable;
    },
    setSummary(text) {
      summary.textContent = text ?? defaultSummary;
    },
  };
}
