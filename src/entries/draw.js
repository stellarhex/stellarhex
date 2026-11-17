import { fixed } from "../../tools/core/math.js";
import { byId, set } from "../../tools/core/dom.js";
import { MARK_HALF, squareBox, hexagon, points, tag } from "../../tools/core/svg.js";
import { MARKS } from "../../tools/identity/brand.js";
import { MARK_CLEAR_SPACE, MIRROR, STATE, markSvg, markView } from "../../tools/identity/mark.js";
import { seal } from "../../tools/identity/seal.js";
import { WORDMARK, wordBox, wordView, wordmark } from "../../tools/identity/wordmark.js";
import { SHEETS, sheetView } from "../../tools/identity/anatomy.js";
import {
  LOCKUP,
  lockupLayout,
  lockupPage,
  lockupSizes,
  lockupView,
} from "../../tools/identity/lockup.js";

const into = (id, write) => {
  const element = byId(id);

  if (element) write(element);
};

/* ---------- logo ---------- */

const drawBrandMark = (holder) => {
  holder.innerHTML = markSvg(STATE.mark(), undefined, markView());
};

/* ---------- hero ---------- */

const drawHeroWord = (svg, word) => {
  const [x, , width] = wordBox(word);

  set(svg, {
    viewBox: wordView(word),
    overflow: "visible",
    style: `--ratio: ${fixed(word.width)}; --tail: ${fixed((x + width) / 100 - word.width)}; --axis: ${fixed(word.axis)}`,
  });
  svg.innerHTML = wordmark(0, 0, 100, "currentColor", word);
};

/* ---------- marks ---------- */

const drawInto = (id, content) => {
  const holder = byId(id);

  if (!holder) return;

  set(holder, { viewBox: squareBox(MARK_HALF) });
  holder.innerHTML = content;
};

const plate = () =>
  tag("polygon", {
    points: points(hexagon(MIRROR.outline + MARK_CLEAR_SPACE)),
    fill: "var(--mark-ground)",
    stroke: "var(--color-rule)",
    "stroke-width": ".5",
    transform: "rotate(30)",
  });

const drawMarks = () => {
  MARKS.forEach((id) => {
    drawInto(`ground-${id}`, plate());
    drawInto(`mark-${id}`, STATE.mark("var(--color-brand, currentColor)"));
  });
  drawInto("seal-art", seal(STATE.mark()));
};

/* ---------- sheets ---------- */

const drawSheets = () =>
  Object.entries(SHEETS).forEach(([id, { half, draw }]) =>
    into(`sheet-${id}`, (art) => {
      set(art, { viewBox: sheetView(half()) });
      art.innerHTML = draw();
    }),
  );

/* ---------- lockups ---------- */

const drawLockup = (id, layout) =>
  into(id, (art) => {
    const plan = lockupLayout(layout);

    set(art, lockupView(plan));
    art.innerHTML = lockupPage(plan);
  });

const drawLockups = () =>
  Object.keys(LOCKUP).forEach((layout) => {
    const plan = lockupLayout(layout),
      { file, mark, gap, letters } = lockupSizes(plan, layout);
    const facts = [
      "Unit px",
      `File ${file}`,
      `Mark ${mark}`,
      `Gap ${gap}`,
      `Cap height ${letters}`,
    ];
    into(`facts-${layout}`, (element) => {
      element.innerHTML = facts.map((fact) => `<span>${fact}</span>`).join("");
    });
    drawLockup(`lockup-${layout}`, layout);
  });

/* ---------- sections ---------- */

const drawSections = () => {
  drawMarks();
  drawSheets();
  drawLockups();
};

/* ---------- site ---------- */

export function drawIdentity() {
  into("brand-mark", drawBrandMark);
  into("hero-word", (svg) => drawHeroWord(svg, WORDMARK));
  drawLockup("footer-lockup", "stacked");
  if (byId("marks-section")) drawSections();
}
