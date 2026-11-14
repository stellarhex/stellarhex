import { execFile, spawn } from "node:child_process";
import { readFileSync, rmSync, writeFileSync } from "node:fs";
import { createServer as netServer } from "node:net";
import { promisify } from "node:util";
import { names, themed } from "./kit-files.js";
import { zip } from "./zip.js";

const run = promisify(execFile);
const page = "/brand/";

const baked = [
  "brand-mark",
  "cover-word",
  "ground-brand",
  "ground-white",
  "ground-black",
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

const profile = () => `/tmp/stellarhex-identity-${process.pid}`;

const chrome = async (url, dir) => {
  const args = [
    "--headless=new",
    "--disable-gpu",
    "--hide-scrollbars",
    "--no-first-run",
    "--password-store=basic",
    "--use-mock-keychain",
    `--user-data-dir=${dir}`,
    "--window-size=1700,900",
    "--virtual-time-budget=12000",
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

let rasters = 0;

const raster = async (markup, [width, height], base) => {
  const dir = `${base}-${(rasters += 1)}`;
  const html = `${dir}.html`;
  const png = `${dir}/raster.png`;

  writeFileSync(
    html,
    `<body style="margin:0"><img src="data:image/svg+xml;base64,${Buffer.from(markup).toString("base64")}" width="${width}" height="${height}"></body>`,
  );

  try {
    for (const binary of ["google-chrome", "chromium", "chromium-browser"]) {
      try {
        await run(
          binary,
          [
            "--headless=new",
            "--disable-gpu",
            "--hide-scrollbars",
            "--no-first-run",
            "--default-background-color=00000000",
            `--user-data-dir=${dir}`,
            `--window-size=${width},${height}`,
            "--virtual-time-budget=3000",
            `--screenshot=${png}`,
            `file://${html}`,
          ],
          { timeout: 60000, killSignal: "SIGKILL" },
        );

        return readFileSync(png);
      } catch (error) {
        if (error.code !== "ENOENT") throw error;
      }
    }

    throw new Error("identity: no Chrome/Chromium found to rasterise the marks");
  } finally {
    rmSync(html, { force: true });
    rmSync(dir, { recursive: true, force: true });
  }
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

const unescape = (value) =>
  value
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");

/* ---------- server ---------- */

const freePort = () =>
  new Promise((resolve, reject) => {
    const probe = netServer();

    probe.once("error", reject);
    probe.listen(0, "127.0.0.1", () => {
      const { port } = probe.address();

      probe.close(() => resolve(port));
    });
  });

const waitFor = async (url, timeout = 20000, alive = () => true) => {
  const until = Date.now() + timeout;

  while (Date.now() < until) {
    if (!alive()) throw new Error(`identity: dev server stopped while waiting for ${url}`);

    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(1500) });

      if (response.status) return true;
    } catch {}

    await new Promise((resolve) => setTimeout(resolve, 150));
  }

  throw new Error(`identity: dev server did not start on ${url}`);
};

export async function startDevServer() {
  const port = await freePort();
  const server = spawn(
    process.execPath,
    ["node_modules/vite/bin/vite.js", "--port", String(port), "--strictPort"],
    { env: { ...process.env, NODE_ENV: "development" }, stdio: "ignore" },
  );
  const died = new Promise((resolve) => server.once("exit", resolve));

  try {
    let running = true;

    server.once("exit", () => {
      running = false;
    });

    await Promise.race([
      waitFor(`http://localhost:${port}${page}`, 20000, () => running),
      died.then((code) => {
        throw new Error(`identity: dev server exited before it was ready (code ${code})`);
      }),
    ]);
  } catch (error) {
    server.kill();

    throw error;
  }

  return { port, stop: () => server.kill() };
}

/* ---------- page ---------- */

export async function captureIdentity(port) {
  const dir = `${profile()}-page`;
  let dom;

  try {
    dom = await chrome(`http://localhost:${port}${page}`, dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }

  const result = { svg: {}, text: {} };
  const missing = [];

  for (const id of baked) {
    const at = dom.indexOf(`id="${id}"`);
    const svg = at < 0 ? null : slice(dom, dom.lastIndexOf("<", at), "svg")?.outer;

    if (svg && !/^<svg[^>]*>\s*<\/svg>$/.test(svg)) result.svg[id] = svg;
    else missing.push(id);
  }

  for (const id of texts) {
    const at = dom.indexOf(`id="${id}"`);
    const markup = at < 0 ? null : slice(dom, dom.lastIndexOf("<", at), "span")?.inner;

    if (markup?.includes("<span")) result.text[id] = markup;
    else missing.push(id);
  }

  if (missing.length) throw new Error(`identity: nothing drawn for ${missing.join(", ")}`);

  return result;
}

/* ---------- kit ---------- */

export async function captureKit(port) {
  const files = [];

  for (const theme of ["light", "dark"]) {
    const dir = `${profile()}-${theme}`;
    let dom;

    try {
      dom = await chrome(`http://localhost:${port}/__kit?theme=${theme}`, dir);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }

    const json = dom.match(/<pre id="kit">([\s\S]*?)<\/pre>/)?.[1];

    if (!json) throw new Error(`identity: kit for ${theme} was not rendered`);

    const kit = JSON.parse(unescape(json));
    const missing = names.filter((name) => !kit[name]);

    if (missing.length) throw new Error(`identity: kit is missing ${missing.join(", ")}`);

    for (const [name, markup] of Object.entries(kit)) {
      if (!themed.includes(name) && theme !== "light") continue;

      const suffix = theme === "dark" && themed.includes(name) ? "-dark" : "";

      files.push({ name: `stellarhex-brand-kit/svg/${name}${suffix}.svg`, data: markup });
    }
  }

  return files;
}

export async function bakeKit(port) {
  const drawings = await captureKit(port);

  return zip([...drawings, ...(await rasterKit(drawings))]);
}

export async function rasterKit(files) {
  const dir = `${profile()}-png`;
  const jobs = files.map((file) => {
    const name = file.name
      .split("/")
      .pop()
      .replace(/\.svg$/, "");
    const [, , width, height] = String(file.data)
      .match(/viewBox="([^"]+)"/)[1]
      .split(" ")
      .map(Number);
    const scale = 1024 / Math.max(width, height);

    return {
      name: `stellarhex-brand-kit/png/${name}.png`,
      markup: String(file.data),
      size: [Math.round(width * scale), Math.round(height * scale)],
    };
  });

  const out = [];

  for (let index = 0; index < jobs.length; index += 4) {
    const batch = jobs.slice(index, index + 4);
    const rendered = await Promise.allSettled(
      batch.map((job) => raster(job.markup, job.size, dir)),
    );
    const failed = rendered.find((result) => result.status === "rejected");

    if (failed) throw failed.reason;

    batch.forEach((job, at) => out.push({ name: job.name, data: rendered[at].value }));
  }

  return out;
}
