/* ---------- theme ---------- */

const root = document.documentElement;
const key = document.querySelector("script[data-theme-key]")?.dataset.themeKey;
const toggle = document.querySelector(".theme-toggle");
const systemDark = matchMedia("(prefers-color-scheme: dark)");
const isDark = () => root.dataset.theme === "dark";

/* ---------- colour bar ---------- */

const syncBar = () => {
  let bar = document.querySelector('meta[name="theme-color"]:not([media])');

  if (!bar) {
    bar = document.createElement("meta");
    bar.name = "theme-color";
    document.head.append(bar);
  }

  bar.content = getComputedStyle(document.body).backgroundColor;
};

const show = () => {
  toggle.setAttribute("aria-pressed", String(isDark()));
  syncBar();
};

/* ---------- toggle ---------- */

if (toggle) {
  toggle.addEventListener("click", () => {
    root.dataset.theme = isDark() ? "light" : "dark";
    try {
      if (key) localStorage.setItem(key, root.dataset.theme);
    } catch {}
    show();
  });

  systemDark.addEventListener("change", () => {
    let stored = null;

    try {
      stored = key ? localStorage.getItem(key) : null;
    } catch {}

    if (stored) return;
    root.dataset.theme = systemDark.matches ? "dark" : "light";
    show();
  });
  show();
}
