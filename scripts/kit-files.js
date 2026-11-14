export const drawings = {
  "mark-brand": "stellarhex-mark-brand",
  "mark-white": "stellarhex-mark-white",
  "mark-black": "stellarhex-mark-black",
  "seal-art": "stellarhex-seal",
  "lockup-horizontal": "stellarhex-lockup-horizontal",
  "lockup-stacked": "stellarhex-lockup-stacked",
};

export const wordmarks = [
  ["--color-brand", "brand"],
  ["--color-white", "white"],
  ["--color-night", "black"],
];

export const squares = [
  "stellarhex-mark-brand-square",
  "stellarhex-mark-white-square",
  "stellarhex-mark-black-square",
];

export const themed = ["stellarhex-lockup-horizontal", "stellarhex-lockup-stacked"];

export const names = [
  ...Object.values(drawings),
  ...wordmarks.map(([, tone]) => `stellarhex-wordmark-${tone}`),
  ...squares,
];
