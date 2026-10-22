/** Descarga un texto como archivo (solo navegador). */
export function downloadText(fileName, text, type = 'application/json') {
  const link = document.createElement('a');
  link.href = URL.createObjectURL(new Blob([text], { type }));
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(link.href), 0);
}
