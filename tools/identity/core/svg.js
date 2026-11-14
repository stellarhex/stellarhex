import { onCircle, fixed, once } from "./math.js";

/* ---------- svg ---------- */

export const SVG_NS = "http://www.w3.org/2000/svg";
export const MARK_HALF = 50;
export const squareBox = (half) => `${-half} ${-half} ${2 * half} ${2 * half}`;

export const hexagon = (radius, cx = 0, cy = 0) =>
  Array.from({ length: 6 }, (_, i) => {
    const [x, y] = onCircle(radius, 60 * i);
    return [cx + x, cy + y];
  });

export const points = (corners) => {
  let list = "";
  for (let i = 0; i < corners.length; i++)
    list += `${i ? " " : ""}${fixed(corners[i][0])},${fixed(corners[i][1])}`;
  return list;
};
export function tag(name, attributes = {}, content) {
  const attrs = Object.entries(attributes)
    .filter(([, value]) => value != null && value !== false)
    .map(([key, value]) => ` ${key}="${value}"`)
    .join("");
  return content === undefined ? `<${name}${attrs}/>` : `<${name}${attrs}>${content}</${name}>`;
}

export const uniqueId = (() => {
  let last = 0;
  return (prefix) => `${prefix}-${++last}`;
})();

const meter = once(createMeter);
function createMeter() {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", squareBox(MARK_HALF));
  svg.style.cssText =
    "position:absolute;width:100px;height:100px;left:-9999px;top:0;visibility:hidden";
  return document.body.appendChild(svg);
}

export function inkBox(markup) {
  const svg = meter();
  svg.innerHTML = `<g>${markup}</g>`;
  const wrapper = svg.firstChild,
    box = wrapper.getBBox(),
    toGroup = wrapper.getCTM().inverse();
  let [left, top, right, bottom] = [box.x, box.y, box.x + box.width, box.y + box.height];
  for (const element of wrapper.querySelectorAll('[stroke]:not([stroke="none"], mask *)')) {
    const place = toGroup.multiply(element.getCTM()),
      { x, y, width, height } = element.getBBox();
    const stroke = Number(element.getAttribute("stroke-width")),
      half =
        ((Number.isFinite(stroke) ? stroke : 1) / 2) *
        Math.sqrt(Math.abs(place.a * place.d - place.b * place.c));
    for (const [px, py] of [
      [x, y],
      [x + width, y],
      [x, y + height],
      [x + width, y + height],
    ]) {
      const corner = new DOMPoint(px, py).matrixTransform(place);
      [left, top] = [Math.min(left, corner.x - half), Math.min(top, corner.y - half)];
      [right, bottom] = [Math.max(right, corner.x + half), Math.max(bottom, corner.y + half)];
    }
  }
  svg.innerHTML = "";
  return { x: left, y: top, width: right - left, height: bottom - top };
}
