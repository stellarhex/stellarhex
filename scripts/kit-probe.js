/* ---------- kit probe ---------- */

import { MARK_CLEAR_SPACE, MIRROR } from "../tools/identity/mark.js";

const half = MIRROR.extent + MARK_CLEAR_SPACE;

export const kitProbe = (theme, drawings, wordmarks) => `<!doctype html>
<meta charset="utf-8" />
<body>
<iframe id="page" src="/brand/" style="width:1700px;height:900px;border:0"></iframe>
<pre id="kit"></pre>
<script type="module">
const theme = ${JSON.stringify(theme)};
const frame = document.getElementById("page");

frame.addEventListener("load", () => {
  const ready = () => {
    const page = frame.contentDocument;

    const drawn = (id) => {
      const svg = page.getElementById(id);

      if (!svg?.firstElementChild) return false;

      const box = svg.getBBox();

      return box.width > 0 && box.height > 0;
    };

    return Object.keys(${JSON.stringify(drawings)}).every(drawn) && drawn("cover-word");
  };

  const start = Date.now();

  const timer = setInterval(() => {
    if (!ready() && Date.now() - start < 8000) return;

    clearInterval(timer);

    if (!ready()) {
      document.getElementById("kit").textContent = JSON.stringify({ error: "drawings did not finish" });
      return;
    }

    {
    const page = frame.contentDocument;
    const view = frame.contentWindow;

    page.documentElement.dataset.theme = theme;

    const standalone = (svg, name, fill, square) => {
      const copy = svg.cloneNode(true);
      const source = [svg, ...svg.querySelectorAll("*")];
      const target = [copy, ...copy.querySelectorAll("*")];

      const current = [];

      source.forEach((node, index) => {
        for (const property of ["fill", "stroke"]) {
          if (!node.hasAttribute(property)) continue;

          const value = node.getAttribute(property);

          if (value.includes("var(") || value === "currentColor") {
            target[index].setAttribute(property, view.getComputedStyle(node).getPropertyValue(property));

            if (property === "fill" && value === "currentColor") current.push(index);
          }
        }
      });

      if (fill) for (const index of current) target[index].setAttribute("fill", fill);

      const pad = [...svg.querySelectorAll('[stroke]:not([stroke="none"], mask *)')].reduce(
        (widest, node) => Math.max(widest, (parseFloat(node.getAttribute("stroke-width")) || 1) / 2),
        0,
      );
      const ink = svg.getBBox();
      const side = square ? ${JSON.stringify(Number(half.toFixed(4)))} : 0;
      const box = square
        ? [-side, -side, 2 * side, 2 * side]
        : [ink.x - pad, ink.y - pad, ink.width + 2 * pad, ink.height + 2 * pad].map(
            (value) => Math.round(value * 100) / 100,
          );

      copy.setAttribute("xmlns", "http://www.w3.org/2000/svg");
      copy.setAttribute("viewBox", box.join(" "));
      copy.setAttribute("width", square ? 1024 : box[2]);
      copy.setAttribute("height", square ? 1024 : box[3]);
      copy.removeAttribute("style");
      copy.removeAttribute("class");
      copy.setAttribute("role", "img");
      copy.removeAttribute("aria-hidden");
      copy.removeAttribute("focusable");
      copy.insertAdjacentHTML("afterbegin", "<title>" + name + "</title>");

      return '<?xml version="1.0" encoding="UTF-8"?>\\n' + copy.outerHTML + "\\n";
    };

    const page_root = page.documentElement;
    const inkOf = (token) => {
      page_root.dataset.theme = theme;

      const value = view.getComputedStyle(page_root).getPropertyValue(token).trim();

      return value || view.getComputedStyle(page.body).getPropertyValue(token).trim();
    };

    const out = {};

    const lockupInk = theme === "dark" ? "--color-white" : "--color-night";

    for (const [id, name] of Object.entries(${JSON.stringify(drawings)})) {
      const svg = page.getElementById(id);

      const ink = id.startsWith("lockup-") ? inkOf(lockupInk) : null;

      if (!svg) continue;

      out[name] = standalone(svg, name, ink);

      if (id.startsWith("mark-")) out[name + "-square"] = standalone(svg, name + "-square", ink, true);
    }

    const word = page.getElementById("cover-word");

    if (word)
      for (const [token, tone] of ${JSON.stringify(wordmarks)}) {
        page_root.dataset.theme = theme;
        out["stellarhex-wordmark-" + tone] = standalone(word, "stellarhex-wordmark-" + tone, inkOf(token));
      }

    document.getElementById("kit").textContent = JSON.stringify(out);
    }
  }, 100);
});
</script>
</body>
`;
