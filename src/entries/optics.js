import { byId } from "../../tools/core/dom.js";
import { initMirror } from "../../tools/optics/mirror.js";
import { initHalo } from "../../tools/optics/halo.js";

/* ---------- optics ---------- */

const mark = byId("hero-mark");
const back = byId("hero-halo-back");

if (mark && back) {
  const mirror = initMirror(mark, back);

  mirror.frame(0);

  const halo = initHalo(back, byId("hero-halo-front"), mark, mirror);
  const recolour = () => {
    mirror.recolour();
    halo.recolour();
  };

  recolour();

  new MutationObserver(recolour).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme"],
  });
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", recolour);
}
