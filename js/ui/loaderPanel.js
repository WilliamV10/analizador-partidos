/**
 * Pantalla de carga: pegar JSON, elegir o arrastrar archivos y elegir el modo.
 * El formulario es HTML fijo (index.html) para no perder lo pegado al redibujar;
 * aquí solo se conectan sus eventos y se delega el trabajo a los callbacks.
 */
import { TEXTS } from '../texts.js';
import { h, replaceContent } from './dom.js';
import { icon } from './icons.js';

/**
 * @param {HTMLElement} root  sección #screen-load
 * @param {{ onAnalyze: (input: { pastedText: string, files: File[], mode: string }) => Promise<void>, onClear: () => void, onOpenLast: () => void }} callbacks
 */
export function bindLoader(root, { onAnalyze, onClear, onOpenLast }) {
  const form = root.querySelector('[data-loader-form]');
  const textarea = root.querySelector('[data-json-input]');
  const fileInput = root.querySelector('[data-file-input]');
  const dropZone = root.querySelector('[data-drop-zone]');
  const fileList = root.querySelector('[data-file-list]');
  const modeGroup = root.querySelector('[data-mode]');
  const status = root.querySelector('[data-status]');
  const submitButton = root.querySelector('[data-submit]');
  const lastSession = root.querySelector('[data-last-session]');

  let selectedFiles = [];
  let mode = 'auto';

  function setFiles(files) {
    selectedFiles = Array.from(files ?? []);
    fileList.textContent = selectedFiles.length ? TEXTS.loader.filesSelected(selectedFiles.map((file) => file.name)) : '';
  }

  function setMode(value) {
    mode = value;
    modeGroup.querySelectorAll('[data-value]').forEach((option) => {
      option.setAttribute('aria-pressed', String(option.dataset.value === value));
    });
  }

  function showStatus(message, kind = 'info') {
    status.textContent = message;
    status.dataset.kind = kind;
  }

  modeGroup.addEventListener('click', (event) => {
    const option = event.target.closest('[data-value]');
    if (option) setMode(option.dataset.value);
  });

  fileInput.addEventListener('change', () => setFiles(fileInput.files));

  ['dragenter', 'dragover'].forEach((type) =>
    dropZone.addEventListener(type, (event) => {
      event.preventDefault();
      dropZone.classList.add('is-dragging');
    }),
  );
  ['dragleave', 'drop'].forEach((type) =>
    dropZone.addEventListener(type, () => dropZone.classList.remove('is-dragging')),
  );
  dropZone.addEventListener('drop', (event) => {
    event.preventDefault();
    setFiles(event.dataTransfer?.files);
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    submitButton.disabled = true;
    showStatus(TEXTS.loader.working);
    try {
      await onAnalyze({ pastedText: textarea.value, files: selectedFiles, mode });
    } finally {
      submitButton.disabled = false;
    }
  });

  form.addEventListener('reset', () => {
    setFiles([]);
    setMode('auto');
    showStatus('');
    onClear();
  });

  return {
    showStatus,

    /** Vacía lo pegado y los archivos elegidos (tras analizar con éxito). */
    resetInputs() {
      textarea.value = '';
      fileInput.value = '';
      setFiles([]);
    },

    /**
     * Tarjeta "Último análisis" para volver a lo cargado.
     * @param {{ title: string, detail: string }|null} summary
     */
    setLastSession(summary) {
      if (!summary) {
        replaceContent(lastSession);
        return;
      }
      replaceContent(
        lastSession,
        h(
          'button',
          { type: 'button', class: 'card card--button', onClick: onOpenLast },
          h('span', { class: 'icon-tile' }, icon('restore', 20)),
          h(
            'span',
            { class: 'card--button__text' },
            h('span', { class: 'card__title' }, summary.title),
            h('span', { class: 'note' }, summary.detail),
          ),
          icon('chevron', 20),
        ),
      );
    },
  };
}
