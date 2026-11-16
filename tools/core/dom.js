/* ---------- dom ---------- */

export const byId = (id) => document.getElementById(id);
export const set = (element, attributes) => {
  for (const name in attributes) element.setAttribute(name, attributes[name]);
};
export const all = (parent, selector) => [...parent.querySelectorAll(selector)];
export const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
