import { defineConfig, type Plugin } from 'vite';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/** Inlines <!--@partial name--> with partials/name.html (shared header/footer). */
function partials(): Plugin {
  return {
    name: 'html-partials',
    transformIndexHtml: {
      order: 'pre',
      handler: (html) =>
        html.replace(/<!--@partial (\w+)-->/g, (_, name: string) =>
          readFileSync(resolve(__dirname, 'partials', `${name}.html`), 'utf8'),
        ),
    },
  };
}

export default defineConfig({
  plugins: [partials()],
  build: {
    target: 'es2020',
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        advertise: resolve(__dirname, 'advertise/index.html'),
        pandals: resolve(__dirname, 'pandals/index.html'),
        card: resolve(__dirname, 'card/index.html'),
      },
    },
  },
  server: { port: 5173, strictPort: true, host: true },
});
