/**
 * Lectura de archivos elegidos o arrastrados por el usuario (solo navegador).
 */

/**
 * @param {FileList|File[]} files
 * @returns {Promise<{ name: string, text: string }[]>}
 */
export async function readTextFiles(files) {
  const list = Array.from(files ?? []);
  return Promise.all(list.map(async (file) => ({ name: file.name, text: await file.text() })));
}
