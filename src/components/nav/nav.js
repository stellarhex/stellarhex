/* ---------- nav ---------- */

const SQRT3 = Math.sqrt(3);
const clamp01 = (t) => Math.max(0, Math.min(1, t));
const progress = (t, [start, length]) => clamp01((t - start) / length);
const fixed = (value) => value.toFixed(2);
const REST = 0.0005;
const still = matchMedia("(prefers-reduced-motion: reduce)");
const small = matchMedia("(width < 48rem)");

const links = [...document.querySelectorAll(".nav__link")];
const host = document.querySelector(".topbar");
const nav = document.querySelector(".nav");
const reach = document.querySelector(".page");
const menu = document.querySelector(".nav__menu");

let open = 0;
let rising = false;

/* ---------- fold ---------- */

const render = host && nav && reach && links.length > 1 ? initFold() : null;

function initFold() {
  const slope = 30;
  const phase = links.length % 2 ? 0 : 1;
  const tail = [...host.querySelectorAll(".hex")].filter(
    (cell) => cell !== menu && !links.includes(cell),
  );
  nav.style.setProperty("--fold-phase", phase);
  nav.style.setProperty("--fold-parity", phase ? -1 : 1);

  let plan = [];
  let pitch = 1;
  let span = 1;

  const gauge = () => {
    plan = links.map((_, n) =>
      small.matches
        ? [{ shift: links.length - n }]
        : [{ fall: links.length - n }, { shift: links.length - n }],
    );

    for (const link of links) {
      link.style.translate = "";
      link.style.removeProperty("--fold-angle");
    }

    const [a, b] = links.slice(0, 2).map((link) => link.getBoundingClientRect().left);
    if (b > a) pitch = (2 / SQRT3) * (b - a);

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
    const scroll = clamp01(still.matches ? Math.sign(scrollY) : scrollY / span);
    const base = scroll * plan.length;
    const depth = base * (1 - open) - open * clamp01(base);
    const travel = Math.max(0, depth);
    const out = clamp01(-depth);
    const first = links.length - Math.floor(travel + REST);
    const lid = menu !== null && small.matches ? clamp01(base) : 0;
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

    for (const i of along.keys()) along[i] -= out;

    links.forEach((link, i) => {
      link.inert = small.matches && i >= first;

      if (Math.abs(along[i]) <= REST && down[i] <= REST) {
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

    for (const cell of tail) cell.inert = lid >= 1 && out <= REST;
    menu?.classList.toggle("nav__menu--shown", lid > REST);

    const rise = clamp01(along[0] - links.length + 1);
    nav.style.setProperty("--fold-progress", along[0].toFixed(3));
    host.style.setProperty("--fold-drop", drop.toFixed(3));
    host.style.setProperty("--fold-rise", rise.toFixed(3));
    host.style.setProperty("--fold-share", scroll.toFixed(3));
    host.style.setProperty("--fold-fill", travel.toFixed(3));
    host.style.setProperty("--fold-lid", lid.toFixed(3));
    host.style.setProperty("--fold-out", out.toFixed(3));
    host.style.setProperty("--fold-turn", `${fixed(slope * Math.sin(Math.PI * out))}deg`);
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

  return fold;
}

/* ---------- top ---------- */

host?.addEventListener("click", (event) => {
  const link = event.target.closest("a");
  if (!link || link.origin !== location.origin || link.pathname !== location.pathname) return;
  if (event.metaKey || event.ctrlKey || event.shiftKey) return;

  event.preventDefault();
  rising = true;
  scrollTo({ top: 0, behavior: still.matches ? "auto" : "smooth" });
});

/* ---------- menu ---------- */

if (render && menu) initMenu();

function initMenu() {
  const pace = parseFloat(getComputedStyle(host).getPropertyValue("--duration")) * 1000;
  const time = pace * (links.length + 1);
  const opened = () => menu.getAttribute("aria-expanded") === "true";

  let turn = 0;

  const swing = (to) => {
    if (opened() === to) return;
    menu.setAttribute("aria-expanded", to);

    const run = ++turn;
    const from = open;
    const start = performance.now();
    const step = (now) => {
      if (run !== turn) return;
      const t = still.matches ? 1 : clamp01((now - start) / time);
      open = from + (to - from) * (1 - (1 - t) ** 3);
      render();
      if (t < 1) requestAnimationFrame(step);
    };

    requestAnimationFrame(step);
  };

  addEventListener("click", (event) => {
    if (menu.contains(event.target)) swing(!opened());
    else if (!host.contains(event.target)) swing(false);
  });

  addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || !opened()) return;
    swing(false);
    menu.focus();
  });

  let last = scrollY;
  addEventListener(
    "scroll",
    () => {
      if (scrollY > last || scrollY <= 0) rising = false;
      if (!rising) swing(false);
      last = scrollY;
    },
    { passive: true },
  );
  addEventListener("scrollend", () => {
    rising = false;
  });
  addEventListener("resize", () => swing(false));
}
