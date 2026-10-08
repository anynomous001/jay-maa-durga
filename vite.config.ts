import { defineConfig, type Plugin } from 'vite';
import { readFileSync, writeFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import staticPages from './scripts/static-pages.mjs';

/** Inlines <!--@partial name--> with partials/name.html (shared head/header). */
function partials(): Plugin {
  return {
    name: 'html-partials',
    transformIndexHtml: {
      order: 'pre',
      handler: (html) =>
        html.replace(/<!--@partial (\w+)-->/g, (_, name: string) =>
          readFileSync(resolve(import.meta.dirname, 'partials', `${name}.html`), 'utf8'),
        ),
    },
  };
}

/** Dev-only: lets scripts/og.html and scripts/dhak.html save generated assets into public/. */
function saveAsset(): Plugin {
  return {
    name: 'save-asset',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__save-asset', (req, res) => {
        const url = new URL(req.url ?? '', 'http://x');
        const target = resolve(import.meta.dirname, url.searchParams.get('path') ?? '');
        const rel = relative(resolve(import.meta.dirname, 'public'), target);
        if (req.method !== 'POST' || rel.startsWith('..') || !/\.(png|jpg|wav|json)$/.test(target)) {
          res.statusCode = 400;
          return res.end('bad request');
        }
        const chunks: Buffer[] = [];
        req.on('data', (c: Buffer) => chunks.push(c));
        req.on('end', () => {
          writeFileSync(target, Buffer.concat(chunks));
          res.end('ok');
        });
      });
    },
  };
}

export default defineConfig({
  plugins: [partials(), saveAsset(), staticPages()],
  build: {
    target: 'es2020',
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        pandals: resolve(import.meta.dirname, 'pandals/index.html'),
        policies: resolve(import.meta.dirname, 'policies/index.html'),
        admin: resolve(import.meta.dirname, 'admin/index.html'),
      },
    },
  },
  server: { port: 5173, strictPort: true, host: true },
});
