import { execFile, spawn } from "node:child_process";
import { rmSync } from "node:fs";
import { createServer as netServer } from "node:net";
import { promisify } from "node:util";

const run = promisify(execFile);
const page = "/brand/";

/* ---------- ids ---------- */

const drawings = [
  "brand-mark",
  "cover-word",
  "mark-brand",
  "mark-white",
  "mark-black",
  "seal-art",
  "lockup-horizontal",
  "lockup-stacked",
  "sheet-anatomy",
  "sheet-wordmark-anatomy",
];
const texts = ["facts-horizontal", "facts-stacked"];

/* ---------- chrome ---------- */

const chrome = async (url, profile) => {
  const args = [
    "--headless=new",
    "--disable-gpu",
    "--hide-scrollbars",
    "--no-first-run",
    "--password-store=basic",
    "--use-mock-keychain",
    `--user-data-dir=${profile}`,
    "--timeout=60000",
    "--window-size=1700,900",
    "--virtual-time-budget=8000",
    "--dump-dom",
    url,
  ];

  for (const binary of ["google-chrome", "chromium", "chromium-browser"]) {
    try {
      const { stdout } = await run(binary, args, {
        maxBuffer: 64 * 1024 * 1024,
        timeout: 90000,
        killSignal: "SIGKILL",
      });

      return stdout;
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  }

  throw new Error("identity: no Chrome/Chromium found to bake the drawings");
};

/* ---------- markup ---------- */

const slice = (dom, from, tag) => {
  const open = dom.indexOf(`<${tag}`, from);

  if (open < 0) return null;

  const pattern = new RegExp(`<${tag}[\\s>/]|</${tag}>`, "g");

  pattern.lastIndex = open;

  let depth = 0;
  let token;

  while ((token = pattern.exec(dom))) {
    depth += token[0].startsWith("</") ? -1 : 1;

    if (depth === 0) {
      const end = token.index;
      const head = dom.indexOf(">", open) + 1;

      return { outer: dom.slice(open, end + token[0].length), inner: dom.slice(head, end) };
    }
  }

  return null;
};

/* ---------- server ---------- */

const waitFor = async (url, timeout = 20000) => {
  const until = Date.now() + timeout;

  while (Date.now() < until) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(1500) });

      if (response.ok) return;
    } catch {}

    await new Promise((resolve) => setTimeout(resolve, 150));
  }

  throw new Error(`identity: dev server did not start on ${url}`);
};

const freePort = () =>
  new Promise((resolve, reject) => {
    const probe = netServer();

    probe.once("error", reject);
    probe.listen(0, "127.0.0.1", () => {
      const { port } = probe.address();

      probe.close(() => resolve(port));
    });
  });

/* ---------- capture ---------- */

export async function captureIdentity() {
  const port = await freePort();
  const profile = `/tmp/stellarhex-identity-${process.pid}`;
  const server = spawn(
    process.execPath,
    ["node_modules/vite/bin/vite.js", "--port", String(port), "--strictPort"],
    { env: { ...process.env, NODE_ENV: "development" }, stdio: "ignore" },
  );
  const died = new Promise((resolve) => server.once("exit", resolve));

  let dom;
  try {
    await Promise.race([
      waitFor(`http://localhost:${port}${page}`),
      died.then((code) => {
        throw new Error(`identity: dev server exited before it was ready (code ${code})`);
      }),
    ]);
    dom = await chrome(`http://localhost:${port}${page}`, profile);
  } finally {
    server.kill();
    rmSync(profile, { recursive: true, force: true });
  }

  const baked = { svg: {}, text: {} };
  const missing = [];

  for (const id of drawings) {
    const at = dom.indexOf(`id="${id}"`);
    const svg = at < 0 ? null : slice(dom, dom.lastIndexOf("<", at), "svg")?.outer;

    if (svg && !/^<svg[^>]*>\s*<\/svg>$/.test(svg)) baked.svg[id] = svg;
    else missing.push(id);
  }

  for (const id of texts) {
    const at = dom.indexOf(`id="${id}"`);
    const markup = at < 0 ? null : slice(dom, dom.lastIndexOf("<", at), "span")?.inner;

    if (markup?.includes("<span")) baked.text[id] = markup;
    else missing.push(id);
  }

  if (missing.length) throw new Error(`identity: nothing drawn for ${missing.join(", ")}`);

  return baked;
}
