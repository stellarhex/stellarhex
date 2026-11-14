/* ---------- nav ---------- */

const SQRT3 = Math.sqrt(3);
const clamp01 = (t) => Math.max(0, Math.min(1, t));
const progress = (t, [start, length]) => clamp01((t - start) / length);
const fixed = (value) => value.toFixed(2);
const REST = 0.0005;
const still = matchMedia("(prefers-reduced-motion: reduce)");

const links = [...document.querySelectorAll(".nav__link")];
const host = document.querySelector(".topbar");
const nav = document.querySelector(".nav");
const reach = document.querySelector(".page");

/* ---------- fold ---------- */

if (host && nav && reach && links.length > 1) initFold();

function initFold() {
  const slope = 30;
  const plan = links.map((_, n) => [{ fall: links.length - n }, { shift: links.length - n }]);
  const phase = links.length % 2 ? 0 : 1;
  nav.style.setProperty("--fold-phase", phase);
  nav.style.setProperty("--fold-parity", phase ? -1 : 1);

  let pitch = 1;
  let span = 1;

  const visible = () => getComputedStyle(nav).display !== "none";

  const gauge = () => {
    for (const link of links) {
      link.style.translate = "";
      link.style.removeProperty("--fold-angle");
    }

    if (visible()) {
      const [a, b] = links.slice(0, 2).map((link) => link.getBoundingClientRect().left);
      if (b > a) pitch = (2 / SQRT3) * (b - a);
    }

    const line = host.getBoundingClientRect().height;
    span = Math.max(
      1,
      Math.min(
        reach.getBoundingClientRect().top + scrollY - line,
        document.documentElement.scrollHeight - innerHeight,
      ),
    );
  };

  const tilt = (spot) => {
    const k = Math.floor(spot);
    const at = (j) => (j % 2 ? -1 : 1);
    return at(k) + (at(k + 1) - at(k)) * (spot - k);
  };

  const lead = (share) => share + 0.1 * Math.sin(Math.PI * share) ** 2;

  const fold = () => {
    const travel = !visible()
      ? 0
      : still.matches
        ? scrollY > 0
          ? plan.length
          : 0
        : (scrollY / span) * plan.length;
    const stride = (pitch * SQRT3) / 2;
    const along = links.map(() => 0);
    const down = links.map(() => 0);

    let drop = 0;

    plan.forEach((moves, s) => {
      const share = progress(travel, [s, 1]);
      for (const move of moves) {
        if ("shift" in move) for (let i = 0; i < move.shift; i++) along[i] += share;
        else {
          const fall = lead(share);
          drop += fall;
          for (let i = move.fall; i < links.length; i++) down[i] += fall;
        }
      }
    });

    links.forEach((link, i) => {
      if (along[i] <= REST && down[i] <= REST) {
        link.style.removeProperty("translate");
        link.style.removeProperty("--fold-angle");
        return;
      }

      const spot = i + 1 + phase + along[i];
      const k = Math.floor(spot);
      link.style.translate = `${fixed(along[i] * stride)}px ${fixed((tilt(spot) * pitch) / 4 + down[i] * pitch)}px`;
      link.style.setProperty(
        "--fold-angle",
        `${fixed((k % 2 ? 1 : -1) * slope * Math.sin(Math.PI * (spot - k)))}deg`,
      );
    });

    const rise = clamp01(along[0] - links.length + 1);
    nav.style.setProperty("--fold-progress", along[0].toFixed(3));
    host.style.setProperty("--fold-drop", drop.toFixed(3));
    host.style.setProperty("--fold-rise", rise.toFixed(3));
  };

  let queued = false;
  addEventListener(
    "scroll",
    () => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => {
        queued = false;
        fold();
      });
    },
    { passive: true },
  );

  new ResizeObserver(() => {
    gauge();
    fold();
  }).observe(document.body);

  gauge();
  fold();
}
