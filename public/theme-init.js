const key = document.currentScript?.dataset.themeKey;
const systemDark = matchMedia("(prefers-color-scheme: dark)");

if (key) {
  let stored = null;

  try {
    stored = localStorage.getItem(key);
  } catch {}

  const theme =
    stored === "dark" || stored === "light" ? stored : systemDark.matches ? "dark" : "light";

  document.documentElement.dataset.theme = theme;
}
