import { SQRT3, apothem, onCircle, fixed, short, once } from "./core/math.js";
import {
  SVG_NS,
  MARK_HALF,
  squareBox,
  hexagon,
  points,
  tag,
  uniqueId,
  inkBox,
} from "./core/svg.js";

/* ---------- mark ---------- */

export const MODULE = 0.9;
export const inUnits = (value) => short(value / MODULE);
const sixAround = (radius, startAngle) =>
  Array.from({ length: 6 }, (_, k) => onCircle(radius, startAngle + 60 * k));

export const MIRROR = (() => {
  const segmentRadius = 8 * MODULE,
    pitch = SQRT3 * segmentRadius,
    fill = 0.9;
  const rings = [
    [pitch, 30],
    [2 * pitch, 30],
    [3 * segmentRadius, 0],
  ];
  const centres = rings.flatMap(([radius, angle]) => sixAround(radius, angle));
  const segment = segmentRadius * fill;
  return {
    segmentRadius,
    pitch,
    fill,
    segment,
    rings,
    centres,
    rim: 2 * pitch + apothem(segment),
    outline: (4 * segmentRadius) / (SQRT3 / 2),
    strutAngles: [-90, 30, 150],
    strutWidth: 2 * MODULE,
  };
})();
export const MARK_CLEAR_SPACE = MIRROR.segmentRadius;

export const BRAND = "var(--color-brand)";
const KEEP = "#FFFFFF";
const CUT = "#000000";

const drawSegments = (ink = BRAND) =>
  MIRROR.centres
    .map(([x, y]) => tag("polygon", { points: points(hexagon(MIRROR.segment, x, y)), fill: ink }))
    .join("");

const drawStruts = () =>
  MIRROR.strutAngles
    .map((angle) => {
      const [x2, y2] = onCircle(MIRROR.rim, angle);
      return tag("line", {
        x1: 0,
        y1: 0,
        x2: fixed(x2),
        y2: fixed(y2),
        stroke: CUT,
        "stroke-width": MIRROR.strutWidth,
      });
    })
    .join("");

function cutStruts(content) {
  const id = uniqueId("struts"),
    box = { x: -MARK_HALF, y: -MARK_HALF, width: 2 * MARK_HALF, height: 2 * MARK_HALF };
  return (
    tag(
      "mask",
      { id, maskUnits: "userSpaceOnUse", ...box },
      tag("rect", { ...box, fill: KEEP }) + drawStruts(),
    ) + tag("g", { mask: `url(#${id})` }, content)
  );
}

export const STATE = { name: "Aperture", mark: (ink) => cutStruts(drawSegments(ink)) };

export const markSvg = (content, viewBox = squareBox(MARK_HALF)) =>
  tag("svg", { xmlns: SVG_NS, viewBox, "aria-hidden": "true", focusable: "false" }, content);

export const markBox = once(() => inkBox(STATE.mark()));

/* ---------- spark ---------- */

const SPARK = { near: 0.1, far: 0.28 };

export function sparkCurves(cx, cy, radius) {
  const near = radius * SPARK.near,
    far = radius * SPARK.far,
    p = (x, y) => [cx + x, cy + y];
  return [
    ["M", ...p(0, -radius)],
    ["C", ...p(near, -far), ...p(far, -near), ...p(radius, 0)],
    ["C", ...p(far, near), ...p(near, far), ...p(0, radius)],
    ["C", ...p(-near, far), ...p(-far, near), ...p(-radius, 0)],
    ["C", ...p(-far, -near), ...p(-near, -far), ...p(0, -radius)],
  ];
}

export const spark = (cx, cy, radius) =>
  sparkCurves(cx, cy, radius)
    .map(
      ([command, ...numbers]) =>
        command + numbers.map((n, i) => (i % 2 ? "," : i ? " " : "") + fixed(n)).join(""),
    )
    .join(" ") + "Z";
