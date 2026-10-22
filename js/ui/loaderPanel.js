/**
 * Panel de carga: pegar JSON, elegir o arrastrar archivos y elegir el modo.
 * Solo maneja eventos del formulario; delega el trabajo a los callbacks.
 */
import { TEXTS } from '../texts.js';

/**
 * @param {HTMLElement} root  contenedor con el formulario de index.html
 * @param {{ onAnalyze: (input: { pastedText: string, files: File[], mode: string }) => Promise<void>, onClear: () => void }} callbacks
 */
export function bindLoader(root, { onAnalyze, onClear }) {
  const form = root.querySelector('[data-loader-form]');
  const textarea = root.querySelector('[data-json-input]');
  const fileInput = root.querySelector('[data-file-input]');
  const dropZone = root.querySelector('[data-drop-zone]');
  const fileList = root.querySelector('[data-file-list]');
  const modeSelect = root.querySelector('[data-mode]');
  const status = root.querySelector('[data-status]');
  const submitButton = root.querySelector('[data-submit]');
  const summary = root.querySelector('[data-loader-summary]');
  const defaultSummary = summary.textContent;

  let selectedFiles = [];

  function setFiles(files) {
    selectedFiles = Array.from(files ?? []);
    fileList.textContent = selectedFiles.length ? TEXTS.loader.filesSelected(selectedFiles.map((file) => file.name)) : '';
  }

  function showStatus(message, kind = 'info') {
    status.textContent = message;
    status.dataset.kind = kind;
  }

  function setBusy(isBusy) {
    submitButton.disabled = isBusy;
    if (isBusy) showStatus(TEXTS.loader.working);
  }

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
    setBusy(true);
    try {
      await onAnalyze({ pastedText: textarea.value, files: selectedFiles, mode: modeSelect.value });
    } finally {
      submitButton.disabled = false;
    }
  });

  /** Pliega el panel y deja a la vista un resumen de lo cargado. */
  function collapse(summaryText) {
    summary.textContent = summaryText;
    root.open = false;
  }

  form.addEventListener('reset', () => {
    setFiles([]);
    showStatus('');
    summary.textContent = defaultSummary;
    onClear();
  });

  return { showStatus, collapse };
}
