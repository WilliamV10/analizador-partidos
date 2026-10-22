/**
 * Mini-ayudante para crear DOM de forma segura.
 * Todo texto se inserta como nodo de texto (nunca innerHTML), así un JSON
 * manipulado no puede inyectar HTML.
 */

function setProperty(element, key, value) {
  if (value === null || value === undefined || value === false) return;
  if (key === 'class') {
    element.className = value;
  } else if (key.startsWith('on') && typeof value === 'function') {
    element.addEventListener(key.slice(2).toLowerCase(), value);
  } else if (value === true) {
    element.setAttribute(key, '');
  } else {
    element.setAttribute(key, String(value));
  }
}

function appendChildren(element, children) {
  children.flat(Infinity).forEach((child) => {
    if (child === null || child === undefined || child === false) return;
    element.append(child instanceof Node ? child : document.createTextNode(String(child)));
  });
}

/**
 * h('div', { class: 'card', onClick: fn }, 'texto', otroNodo)
 * @param {string} tag
 * @param {Record<string, unknown>} [props]
 * @param {...unknown} children
 * @returns {HTMLElement}
 */
export function h(tag, props = {}, ...children) {
  const element = document.createElement(tag);
  Object.entries(props ?? {}).forEach(([key, value]) => setProperty(element, key, value));
  appendChildren(element, children);
  return element;
}

export function replaceContent(element, ...children) {
  element.replaceChildren();
  appendChildren(element, children);
}
