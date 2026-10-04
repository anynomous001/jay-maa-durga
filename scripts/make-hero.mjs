// Builds responsive hero images from assets-src/hero-pandal.png → public/hero/.
// Landscape set for wide screens + a portrait crop centred on the pandal for phones.
// Run: node scripts/make-hero.mjs
import sharp from 'sharp';
import { mkdirSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const src = resolve(root, 'assets-src/hero-pandal.png');
const out = resolve(root, 'public/hero');
mkdirSync(out, { recursive: true });

const meta = await sharp(src).metadata();
// Portrait crop: full height, 9:16-ish window centred on the idol (≈70% across).
const cropW = Math.round(meta.height * 0.6);
const left = Math.min(meta.width - cropW, Math.max(0, Math.round(meta.width * 0.705 - cropW / 2)));

const jobs = [
  ...[640, 960, 1280, 1672].map((w) => ({ name: `land-${w}`, pipe: () => sharp(src).resize({ width: w }) })),
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
    console.log(`${j.name}.${ext}`.padEnd(18), (statSync(file).size / 1024).toFixed(0), 'KB');
  }
}
console.log('portrait crop:', { left, width: cropW, height: meta.height });
