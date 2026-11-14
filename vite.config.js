import { resolve } from "node:path";
import { defineConfig } from "vite";
import injectHTML from "vite-plugin-html-inject";
import { ALLOW_INDEXING, BASE_PATH, GOOGLE_SITE_VERIFICATION, SITE_URL } from "./site.config.js";
import { captureIdentity } from "./scripts/identity-svg.js";

function identityInline() {
  let baked = null;

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
      baked = await captureIdentity();
    },
    transformIndexHtml: { order: "post", handler: fill },
  };
}

export default defineConfig(({ command, isPreview }) => ({
  base: command === "build" || isPreview ? BASE_PATH : "/",
  appType: "mpa",
  /* ---------- html ---------- */

  plugins: [
    identityInline(),
    {
      name: "site-html",
      transformIndexHtml: (html) =>
        html
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
          .replace(/[ \t]+$/gm, ""),
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
