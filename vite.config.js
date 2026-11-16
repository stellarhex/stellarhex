import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig } from "vite";
import injectHTML from "vite-plugin-html-inject";
import { ALLOW_INDEXING, BASE_PATH, GOOGLE_SITE_VERIFICATION, SITE_URL } from "./site.config.js";
import { bakeKit, captureIdentity, startDevServer } from "./scripts/identity-svg.js";
import { walk } from "./scripts/lib/walk.js";
import { drawings, wordmarks } from "./scripts/kit-files.js";
import { kitProbe } from "./scripts/kit-probe.js";

const stamp = () => {
  const hash = createHash("sha1");

  for (const dir of ["tools/identity", "src"])
    for (const file of walk(dir).sort()) hash.update(file).update(readFileSync(file));

  return hash.digest("hex");
};

function kit() {
  let cache = null;
  let signature = "";
  let pending = null;

  const build = () => {
    const now = stamp();

    if (cache && now === signature) return Promise.resolve(cache);
    if (pending) return pending;

    const task = (async () => {
      const server = await startDevServer();

      try {
        cache = await bakeKit(server.port);
        signature = now;
      } finally {
        server.stop();
      }

      return cache;
    })();

    pending = task.finally(() => {
      pending = null;
    });

    return pending;
  };

  return {
    name: "brand-kit",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use("/__kit", (request, response) => {
        const theme = new URL(request.url, "http://localhost").searchParams.get("theme") ?? "light";

        response.setHeader("Content-Type", "text/html");
        response.end(kitProbe(theme, drawings, wordmarks));
      });
      server.middlewares.use("/stellarhex-brand-kit.zip", async (_request, response) => {
        try {
          const archive = await build();

          response.setHeader("Content-Type", "application/zip");
          response.setHeader(
            "Content-Disposition",
            'attachment; filename="stellarhex-brand-kit.zip"',
          );
          response.end(archive);
        } catch (error) {
          response.statusCode = 500;
          response.setHeader("Content-Type", "text/plain");
          response.end(`brand kit: ${error.message}`);
        }
      });
    },
  };
}

function identityInline() {
  let baked = null;
  let archive = null;

  const fill = (html) => {
    if (!baked) return html;

    let out = html;

    for (const [id, markup] of Object.entries(baked.svg)) {
      out = out.replace(new RegExp(`<svg[^>]*\\sid="${id}"[^>]*>[\\s\\S]*?</svg>`), () => markup);
    }
    const logo = baked.svg["brand-mark"];

    if (logo) {
      out = out.replace(
        /(<span[^>]*\sid="brand-mark"[^>]*>)\s*<\/span>/,
        (_match, open) => `${open}${logo}</span>`,
      );
    }

    for (const [id, markup] of Object.entries(baked.text)) {
      out = out.replace(
        new RegExp(`(<span[^>]*\\sid="${id}"[^>]*>)\\s*</span>`),
        (_match, open) => open + markup + "</span>",
      );
    }

    return out;
  };

  return {
    name: "identity-inline",
    apply: "build",
    async buildStart() {
      const server = await startDevServer();

      try {
        baked = await captureIdentity(server.port);
        archive = await bakeKit(server.port);
      } finally {
        server.stop();
      }
    },
    writeBundle(options) {
      writeFileSync(`${options.dir ?? "dist"}/stellarhex-brand-kit.zip`, archive);
    },
    transformIndexHtml: { order: "post", handler: fill },
  };
}

export default defineConfig(({ command, isPreview }) => ({
  base: command === "build" || isPreview ? BASE_PATH : "/",
  appType: "mpa",
  /* ---------- html ---------- */

  plugins: [
    kit(),
    identityInline(),
    {
      name: "site-html",
      transformIndexHtml: (html) => {
        const page = html.match(/<body\b[^>]*\sdata-page="([^"]+)"/)?.[1];

        return html
          .replace(/<a\b[^>]*\sdata-nav="([^"]+)"[^>]*>/g, (link, name) =>
            name === page ? link.replace(/>$/, ' aria-current="page">') : link,
          )
          .replaceAll("%SITE_URL%", SITE_URL)
          .replaceAll(
            "%GOOGLE_SITE_VERIFICATION%",
            GOOGLE_SITE_VERIFICATION
              ? `<meta name="google-site-verification" content="${GOOGLE_SITE_VERIFICATION}" />`
              : "",
          )
          .replaceAll(
            "%ROBOTS%",
            html.includes('name="robots"')
              ? ""
              : ALLOW_INDEXING
                ? '<meta name="robots" content="max-image-preview:large" />'
                : '<meta name="robots" content="noindex" />',
          )
          .replace(/[ \t]+$/gm, "");
      },
    },
    injectHTML({ tagName: "include" }),
  ],
  /* ---------- server ---------- */

  server: {
    port: 8188,
    strictPort: true,
  },
  preview: {
    port: 8888,
    strictPort: true,
  },

  /* ---------- build ---------- */

  build: {
    rolldownOptions: {
      input: {
        index: resolve(import.meta.dirname, "index.html"),
        brand: resolve(import.meta.dirname, "brand/index.html"),
        404: resolve(import.meta.dirname, "404.html"),
      },
      output: {
        entryFileNames: "assets/app-[hash].js",
        chunkFileNames: "assets/app-[hash].js",
        assetFileNames: (asset) =>
          asset.names?.some((name) => name.endsWith(".css"))
            ? "assets/app-[hash][extname]"
            : "assets/[name]-[hash][extname]",
      },
    },
  },
}));
