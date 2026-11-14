/* ---------- identity ---------- */

if (import.meta.env.DEV) {
  const { drawIdentity } = await import("./draw.js");

  drawIdentity();
}
