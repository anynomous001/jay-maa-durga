// Builds the logo set from assets-src/logo-eyes.png (supplied by the site owner):
// the cream "Durga eyes" motif is lifted out by brightness (keeping its brush
// edges) and centred on a clean red square. Outputs favicon, header logo,
// PWA icons (incl. maskable) and apple-touch icon.  Run: npm run logo
import sharp from 'sharp';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const SRC = resolve(root, 'assets-src/logo-eyes.png');
const BOX = { left: 150, top: 60, width: 1370, height: 740 }; // the motif inside the source
const CREAM = { r: 251, g: 220, b: 176 };
const RED_IN = '#c8150b';
const RED_OUT = '#9e0a05';

/** Motif as cream-on-transparent, alpha taken from the green channel (red bg ≈ 0, cream ≈ 215). */
async function motif() {
  const alpha = await sharp(SRC).extract(BOX).extractChannel('green').linear(2.1, -110).toBuffer();
  const cream = await sharp({ create: { width: BOX.width, height: BOX.height, channels: 3, background: CREAM } }).png().toBuffer();
  return sharp(cream).joinChannel(alpha).png().toBuffer();
}

function redSquare(size, radius = 0) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
    <defs><radialGradient id="g" cx="50%" cy="45%" r="70%"><stop offset="0" stop-color="${RED_IN}"/><stop offset="1" stop-color="${RED_OUT}"/></radialGradient></defs>
    <rect width="${size}" height="${size}" rx="${radius}" fill="url(#g)"/></svg>`;
  return Buffer.from(svg);
}

/** Icon with the motif filling `fill` of the width. */
async function icon(size, fill, radius = 0) {
  const m = await motif();
  const w = Math.round(size * fill);
  let scaled = await sharp(m).resize({ width: w }).toBuffer();
  const h = (await sharp(scaled).metadata()).height;
  // Small sizes scale the motif past the edges: trim the brow tips that overflow.
  if (w > size) {
    const cut = Math.round((w - size) / 2);
    scaled = await sharp(scaled).extract({ left: cut, top: 0, width: size, height: h }).toBuffer();
  }
  const placedW = Math.min(w, size);
  const icon = sharp(redSquare(size, radius)).composite([
    { input: scaled, left: Math.round((size - placedW) / 2), top: Math.round((size - h) / 2) },
  ]);
  // Re-apply the rounded corners if the motif ran to the edge.
  return radius ? sharp(await icon.png().toBuffer()).composite([{ input: redSquare(size, radius), blend: 'dest-in' }]).png() : icon.png();
}

const out = (p) => resolve(root, p);
mkdirSync(out('public/icons'), { recursive: true });
mkdirSync(out('public/logo'), { recursive: true });
await (await icon(512, 0.9)).toFile(out('public/icons/icon-512.png'));
await (await icon(192, 0.92)).toFile(out('public/icons/icon-192.png'));
await (await icon(512, 0.6)).toFile(out('public/icons/maskable-512.png')); // inside Android's 80% safe zone
await (await icon(180, 0.9)).toFile(out('public/icons/apple-touch-icon.png'));
await (await icon(32, 1.3, 6)).toFile(out('public/favicon-32.png'));
await (await icon(64, 1.25, 12)).toFile(out('public/favicon-64.png'));
// Header logo (shown at 36 px; 72/108 for retina).
for (const s of [72, 108]) {
  await (await icon(s, 1.18, Math.round(s * 0.22))).toFile(out(`public/logo/logo-${s}.png`));
  await (await icon(s, 1.18, Math.round(s * 0.22))).webp({ quality: 90 }).toFile(out(`public/logo/logo-${s}.webp`));
}
console.log('logo set written');
