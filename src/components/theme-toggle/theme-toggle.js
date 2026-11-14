/* ---------- theme ---------- */

const root = document.documentElement;
const key = document.querySelector("script[data-theme-key]")?.dataset.themeKey;
const toggle = document.querySelector(".theme-toggle");
const systemDark = matchMedia("(prefers-color-scheme: dark)");
const isDark = () => root.dataset.theme === "dark";

/* ---------- colour bar ---------- */

const syncBar = () => {
  for (const system of document.querySelectorAll('meta[name="theme-color"][media]'))
    system.remove();

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

const chosen = () => {
  try {
    return key ? localStorage.getItem(key) : null;
  } catch {
    return null;
  }
};

const isChoice = (value) => value === "dark" || value === "light";

if (toggle) {
  let manual = null;

  toggle.addEventListener("click", () => {
    manual = isDark() ? "light" : "dark";
    root.dataset.theme = manual;
    try {
      if (key) localStorage.setItem(key, manual);
    } catch {}
    show();
  });

  systemDark.addEventListener("change", () => {
    if (isChoice(manual) || isChoice(chosen())) return;

    root.dataset.theme = systemDark.matches ? "dark" : "light";
    show();
  });
  show();
}
