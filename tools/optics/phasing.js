import { clamp01, easeInOut, fixed } from "../core/math.js";
import { all, reducedMotion, set } from "../core/dom.js";
import { hexagon, points, tag } from "../core/svg.js";
import { MIRROR, markSvg, markView } from "../identity/mark.js";
import { PHASING } from "./scene.js";

/* ---------- phasing ---------- */

export function initPhasing(holder) {
  holder.innerHTML = markSvg(
    tag(
      "g",
      { fill: "currentColor", stroke: "currentColor" },
      MIRROR.centres
        .map(([x, y]) => tag("polygon", { points: points(hexagon(MIRROR.segment, x, y)) }))
        .join(""),
    ),
    undefined,
    markView(),
  );

  const segments = all(holder, "polygon"),
    starts = segments.map(() => -Infinity),
    missed = segments.map(() => false),
    tones = segments.map(() => Math.random()),
    olds = [...tones],
    inner = segments.length / MIRROR.rings.length,
    [dim, bright] = PHASING.tone,
    [least, most] = PHASING.pause;
  let shocks = [],
    next = 0;

  const attempt = (time) => {
    const core = Math.random() < PHASING.core,
      i = (core ? 0 : inner) + Math.floor(Math.random() * (core ? inner : segments.length - inner));

    starts[i] = time;
    missed[i] = Math.random() < PHASING.miss;
    olds[i] = tones[i];
    tones[i] = Math.random();
    shocks = shocks.filter(({ at }) => time < at + PHASING.settle);
    shocks.push({ from: i, at: time + PHASING.flick, force: missed[i] ? 1 : PHASING.graze });
    next = time + least + (most - least) * Math.random();
  };
  const frame = (time) =>
    segments.forEach((segment, i) => {
      const [x, y] = MIRROR.centres[i],
        age = (time - starts[i]) / PHASING.flick,
        moved = clamp01(age),
        phased = easeInOut(moved),
        struck = clamp01(((age - 1) * PHASING.flick) / PHASING.flash),
        push = (Math.sin(Math.PI * phased) * PHASING.nudge) / Math.hypot(x, y),
        glow = (age < 1 ? phased : 1 - struck) * (missed[i] ? 1 : PHASING.graze),
        tone = dim + (bright - dim) * (olds[i] + (tones[i] - olds[i]) * moved);
      let dx = x * push,
        dy = y * push,
        stir = 0;

      shocks.forEach(({ from, at, force }) => {
        const [fromX, fromY] = from === i ? [0, 0] : MIRROR.centres[from],
          span = Math.hypot(x - fromX, y - fromY),
          hops = from === i ? 1 : span / MIRROR.pitch,
          since = time - at - (hops - 1) / PHASING.speed;

        if (since < 0) return;

        const wave =
          force *
          clamp01(1 - (hops - 1) / PHASING.reach) *
          Math.exp(-since / PHASING.damp) *
          Math.sin(2 * Math.PI * PHASING.sway * since);

        dx += ((x - fromX) / span) * wave * PHASING.shock;
        dy += ((y - fromY) / span) * wave * PHASING.shock;
        stir += Math.abs(wave);
      });
      set(segment, {
        transform: `translate(${fixed(dx)} ${fixed(dy)})`,
        "fill-opacity": fixed(tone + (1 - tone) * clamp01(glow + PHASING.graze * stir)),
      });
    });
  const tick = (now) => {
    const time = now / 1000;

    if (time >= next) attempt(time);
    frame(time);
    requestAnimationFrame(tick);
  };

  if (reducedMotion) frame(0);
  else requestAnimationFrame(tick);
}
