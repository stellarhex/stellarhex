/* ---------- math ---------- */

export const SQRT3 = Math.sqrt(3);
export const apothem = (radius) => (radius * SQRT3) / 2;

export const radians = (deg) => (deg * Math.PI) / 180;
export const degrees = (rad) => (rad * 180) / Math.PI;
export const turn = (angle, period = 360) => ((angle % period) + period) % period;
export const onCircle = (radius, angle) => [
  radius * Math.cos(radians(angle)),
  radius * Math.sin(radians(angle)),
];

export const fixed = (value) => value.toFixed(2);
export const short = (value) => String(+value.toFixed(2));

export const once = (make) => {
  let value;
  return () => (value ??= make());
};
