import { writeFileSync } from "node:fs";
import { SITE_URL } from "../site.config.js";
import { DIST, posixRelative } from "./lib/paths.js";
import { walk } from "./lib/walk.js";

/* ---------- pages ---------- */

const root = DIST;
const escapeXml = (value) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

const pages = walk(root)
  .filter((file) => file.endsWith(".html"))
  .map((file) => posixRelative(root, file).replace(/index\.html$/, ""))
  .filter((path) => path !== "404.html")
  .sort();

/* ---------- write ---------- */

writeFileSync(
  `${root}/sitemap.xml`,
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${pages
    .map((path) => `  <url><loc>${escapeXml(`${SITE_URL}${path}`)}</loc></url>`)
    .join("\n")}\n</urlset>\n`,
);
writeFileSync(
  `${root}/robots.txt`,
  `User-agent: *\nDisallow:\n\nSitemap: ${SITE_URL}sitemap.xml\n`,
);
