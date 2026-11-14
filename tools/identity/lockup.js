import { fixed } from "./core/math.js";
import { SVG_NS, inkBox } from "./core/svg.js";
import { MODULE, STATE, markBox } from "./mark.js";
import { WORDMARK, wordmark, wordSvg } from "./wordmark.js";

/* ---------- lockup ---------- */

export const LOCKUP_RULE = { cap: 28, gap: 28 };
export const LOCKUP = { horizontal: { axis: 0 }, stacked: { axis: 1 } };
const LOCKUP_LETTER_PX = 101;
const LOCKUP_PIXELS = LOCKUP_LETTER_PX / (LOCKUP_RULE.cap * MODULE);

function planLockup(layout) {
  const { axis } = LOCKUP[layout],
    cross = 1 - axis;
  const cap = LOCKUP_RULE.cap * MODULE,
    drawn = markBox();
  const mark = [drawn.x, drawn.y, drawn.width, drawn.height],
    letters = [0, -cap, WORDMARK.width * cap, cap],
    origin = [0, 0];
  origin[axis] = mark[axis] + mark[axis + 2] + LOCKUP_RULE.gap * MODULE - letters[axis];
  origin[cross] = cross ? -(letters[1] + letters[3] / 2) : -WORDMARK.axis * cap;
  const word = letters.map((value, i) => (i < 2 ? value + origin[i] : value));
  const whole = inkBox(lockupArt({ cap, origin }, "#000"));
  return { cap, origin, ink: [whole.x, whole.y, whole.width, whole.height], parts: { mark, word } };
}

const lockupPlans = {};
export const lockupLayout = (layout) => (lockupPlans[layout] ??= planLockup(layout));

export function lockupSizes({ ink: [, , iw, ih], parts: { mark, word } }, layout) {
  const { axis } = LOCKUP[layout],
    px = (units) => Math.round(units * LOCKUP_PIXELS);
  return {
    file: `${px(iw)} × ${px(ih)}`,
    mark: `${px(mark[2])} × ${px(mark[3])}`,
    letters: px(word[3]),
    gap: px(word[axis] - mark[axis] - mark[axis + 2]),
  };
}

function lockupArt({ cap, origin }, fill) {
  return STATE.mark() + wordmark(origin[0], origin[1], cap, fill);
}

export const lockupPage = ({ cap, origin }) =>
  STATE.mark() +
  wordSvg(WORDMARK, {
    x: fixed(origin[0]),
    y: fixed(origin[1] - cap),
    width: fixed(WORDMARK.width * cap),
    height: fixed(cap),
  });

function bodyBox({ ink: [, y, , height], parts: { mark, word } }) {
  const left = Math.min(mark[0], word[0]),
    right = Math.max(mark[0] + mark[2], word[0] + word[2]);
  return [left, y, right - left, height];
}

function sheetBox(plan) {
  const [x, y, width, height] = plan.ink,
    [left, , body] = bodyBox(plan),
    centre = left + body / 2;
  const half = Math.max(centre - x, x + width - centre);
  return [centre - half, y, 2 * half, height];
}

const bodyView = (plan) => ({
  xmlns: SVG_NS,
  viewBox: bodyBox(plan).map(fixed).join(" "),
  overflow: "visible",
});

export function lockupView(plan) {
  const most = Math.max(...Object.keys(LOCKUP).map((name) => sheetBox(lockupLayout(name))[2]));
  return { ...bodyView(plan), style: `--share: ${(bodyBox(plan)[2] / most).toFixed(5)}` };
}
