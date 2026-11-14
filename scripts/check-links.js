import { readFileSync, statSync } from "node:fs";
import { join, posix } from "node:path";
import { BASE_PATH, SITE_URL } from "../site.config.js";
import { DIST, posixRelative } from "./lib/paths.js";
import { walk } from "./lib/walk.js";

/* ---------- pages ---------- */

const root = DIST;
const base = BASE_PATH.endsWith("/") ? BASE_PATH : `${BASE_PATH}/`;

const pages = walk(root).filter((file) => file.endsWith(".html"));
const ids = new Map(
  pages.map((page) => [
    page,
    new Set([...readFileSync(page, "utf8").matchAll(/\sid="([^"]+)"/g)].map((match) => match[1])),
  ]),
);

/* ---------- target ---------- */

const problems = [];
const report = (page, url, reason) => problems.push(`${page}: ${url} - ${reason}`);

const stat = (path) => statSync(path, { throwIfNoEntry: false });
const isFile = (path) => Boolean(stat(path)?.isFile());
const isDir = (path) => Boolean(stat(path)?.isDirectory());

const target = (page, url) => {
  const [rawPath, hash] = url.split("#");
  const path = rawPath.split("?")[0];

  if (!path) {
    if (hash && !ids.get(page).has(hash)) report(page, url, `#${hash} not found`);
    return;
  }

  let pathname;
  if (path.startsWith(SITE_URL)) pathname = path.slice(SITE_URL.length);
  else if (path.startsWith(base)) pathname = path.slice(base.length);
  else if (path.startsWith("/")) {
    report(page, url, `missing base prefix ${base}`);
    return;
  } else pathname = posix.normalize(posix.join(posix.dirname(posixRelative(root, page)), path));

  if (pathname === "" || pathname === "." || pathname.endsWith("/"))
    pathname = pathname.replace(/^\.$/, "").concat("index.html");

  let file = join(root, pathname);
  if (isDir(file)) file = join(file, "index.html");
  if (!isFile(file)) {
    report(page, url, `missing file ${pathname}`);
    return;
  }

  if (hash && file.endsWith(".html") && !ids.get(file).has(hash))
    report(page, url, `#${hash} not found in ${pathname}`);
};

/* ---------- run ---------- */

for (const page of pages) {
  const html = readFileSync(page, "utf8");
  for (const match of html.matchAll(/\s(?:href|src)="([^"]+)"/g)) {
    const url = match[1];
    if (/^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(url) && !url.startsWith(SITE_URL)) continue;
    target(page, url);
  }
}

if (problems.length) {
  console.error(problems.join("\n"));
  process.exit(1);
}
console.log(`links: ${pages.length} pages — href/src links and #anchors resolve`);
