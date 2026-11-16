import { clamp01, fixed } from "./math.js";

/* ---------- colour ---------- */

export const RELATIVE = CSS.supports("color", "oklch(from red calc(l + .1) c h)");
export const lighten = (colour, lift) =>
  RELATIVE
    ? `oklch(from ${colour} calc(l + ${fixed(lift)}) c h)`
    : `color-mix(in oklch, ${colour} ${fixed(100 - 120 * Math.abs(lift))}%, ${lift > 0 ? "white" : "black"})`;

export const linear = (channel) => {
  const c = channel / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};

export function colourOf(value, host = document.body, scheme) {
  const probe = document.createElement("span");
  probe.hidden = true;
  if (scheme) probe.style.colorScheme = scheme;
  probe.style.color = value;
  host.append(probe);
  const colour = getComputedStyle(probe).color;
  probe.remove();
  return colour;
}

export const channelsOf = (value, host, scheme) =>
  colourOf(`color-mix(in srgb, ${value} 100%, transparent)`, host, scheme)
    .match(/-?[\d.]+(?:e-?\d+)?/g)
    .slice(0, 3)
    .map((channel) => Math.round(clamp01(channel) * 255));
