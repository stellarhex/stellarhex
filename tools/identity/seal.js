import { radians, degrees, onCircle, fixed } from "./core/math.js";
import { tag } from "./core/svg.js";
import { NAME, MOTTO } from "./brand.js";
import { monoAdvance, glyph, STELLARHEX_MONO } from "./mono.js";
import { BRAND, spark } from "./mark.js";

/* ---------- seal ---------- */

const SEAL = {
  radius: 41.2,
  size: 6.2,
  tracking: 1.6,
  top: 270,
  sideArc: 68,
  outer: 47,
  inner: 35.5,
  markScale: 0.66,
  spark: 2.2,
};
const [MOTTO_LEFT, MOTTO_RIGHT] = MOTTO.toUpperCase().split(" · ");
const INSCRIPTION = { top: NAME.toUpperCase(), left: MOTTO_LEFT, right: MOTTO_RIGHT };

function sealArcs(topSpan) {
  const { top, sideArc } = SEAL,
    bottom = top - 180;
  const gap = (top - bottom - sideArc - topSpan / 2) / 3,
    starOffset = topSpan / 2 + gap;
  const leftEnd = top - starOffset - gap,
    rightStart = top + starOffset + gap;
  return {
    stars: [top - starOffset, top + starOffset, bottom],
    top: [top - topSpan / 2, top + topSpan / 2],
    left: [leftEnd - sideArc, leftEnd],
    right: [rightStart, rightStart + sideArc],
  };
}

const sealLetter = () => SEAL.size * monoAdvance();
const sealBaseline = () =>
  SEAL.radius - (SEAL.size * STELLARHEX_MONO.cap) / STELLARHEX_MONO.upm / 2;
const sealSide = () => radians(SEAL.sideArc) * sealBaseline();
const sealTopSpan = () =>
  degrees(
    (INSCRIPTION.top.length * (sealLetter() + SEAL.tracking) - SEAL.tracking) / sealBaseline(),
  );

function outlineArc(text, startAngle, letterGap) {
  const radius = sealBaseline(),
    fontScale = SEAL.size / STELLARHEX_MONO.upm;
  let along = 0,
    paths = "";
  [...text].forEach((char) => {
    const [advance, path] = STELLARHEX_MONO.g[char],
      width = advance * fontScale;
    const angle = startAngle + degrees((along + width / 2) / radius),
      [x, y] = onCircle(radius, angle);
    if (path)
      paths += glyph(
        `translate(${fixed(x)} ${fixed(y)}) rotate(${fixed(angle + 90)}) translate(${fixed(-width / 2)} 0)`,
        fontScale,
        path,
      );
    along += width + letterGap;
  });
  return tag("g", { fill: BRAND }, paths);
}

export function seal(mark) {
  const { tracking } = SEAL,
    letter = sealLetter(),
    sideLength = sealSide();
  const arcs = sealArcs(sealTopSpan());
  const side = (text, startAngle) =>
    outlineArc(text, startAngle, (sideLength - text.length * letter) / (text.length - 1));
  const stars = arcs.stars
    .map((angle) =>
      tag("path", { d: spark(...onCircle(SEAL.radius, angle), SEAL.spark), fill: BRAND }),
    )
    .join("");
  return (
    tag("circle", { r: SEAL.outer, fill: "none", stroke: BRAND, "stroke-width": 1 }) +
    tag("circle", {
      r: SEAL.inner,
      fill: "none",
      stroke: BRAND,
      "stroke-width": ".6",
      opacity: ".7",
    }) +
    stars +
    tag("g", { transform: `scale(${SEAL.markScale})` }, mark) +
    outlineArc(INSCRIPTION.top, arcs.top[0], tracking) +
    side(INSCRIPTION.left, arcs.left[0]) +
    side(INSCRIPTION.right, arcs.right[0])
  );
}
