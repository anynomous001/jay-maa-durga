// Builds responsive page images from assets-src/*.png → public/<dir>/.
// Each image gets a landscape set for wide screens + a portrait crop for phones.
// Run: npm run hero
import sharp from 'sharp';
import { mkdirSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const IMAGES = [
  // focusX: where the portrait crop is centred (0–1 across the image).
  { src: 'assets-src/hero-pandal.png', out: 'public/hero', focusX: 0.705 },
  { src: 'assets-src/bg-pandals.png', out: 'public/bg/pandals', focusX: 0.78 },
];

for (const img of IMAGES) {
  const src = resolve(root, img.src);
  const out = resolve(root, img.out);
  mkdirSync(out, { recursive: true });
  const meta = await sharp(src).metadata();
  const cropW = Math.round(meta.height * 0.6);
  const left = Math.min(meta.width - cropW, Math.max(0, Math.round(meta.width * img.focusX - cropW / 2)));
  const jobs = [
    ...[640, 960, 1280, 1672].map((w) => ({ name: `land-${w}`, pipe: () => sharp(src).resize({ width: Math.min(w, meta.width) }) })),
    ...[480, 720].map((w) => ({ name: `port-${w}`, pipe: () => sharp(src).extract({ left, top: 0, width: cropW, height: meta.height }).resize({ width: w }) })),
  ];
  for (const j of jobs) {
    for (const [ext, fn] of [
      ['avif', (s) => s.avif({ quality: 50, effort: 6 })],
      ['webp', (s) => s.webp({ quality: 72 })],
      ['jpg', (s) => s.jpeg({ quality: 78, mozjpeg: true, progressive: true })],
    ]) {
      const file = resolve(out, `${j.name}.${ext}`);
      await fn(j.pipe()).toFile(file);
      if (ext === 'avif') console.log(`${img.out}/${j.name}.avif`.padEnd(36), (statSync(file).size / 1024).toFixed(0), 'KB');
    }
  }
}
