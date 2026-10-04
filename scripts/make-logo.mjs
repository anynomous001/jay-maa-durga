// Builds the logo set from assets-src/logo-eyes.png (supplied by the site owner):
// the cream "Durga eyes" motif is lifted out by brightness (keeping its brush
// edges). App icons (PWA, maskable, apple-touch) put it on a red square —
// phones need opaque icons; the header mark and favicons are transparent.
// Run: npm run logo
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
console.log('logo set written');

// ── Transparent versions (header + browser tab) ──
/** Motif trimmed to its own bounds, in a given colour, on transparent. */
async function motifIn(color) {
  const alpha = await sharp(SRC).extract(BOX).extractChannel('green').linear(2.1, -110).toBuffer();
  const fill = await sharp({ create: { width: BOX.width, height: BOX.height, channels: 3, background: color } }).png().toBuffer();
  const rgba = await sharp(fill).joinChannel(alpha).png().toBuffer();
  return sharp(rgba).trim({ threshold: 1 }).png().toBuffer();
}
const cream = await motifIn(CREAM);
const red = await motifIn({ r: 179, g: 18, b: 10 });

// Header mark: wide, transparent, cream (shown at 34 px tall; 2x/3x for retina).
for (const h of [68, 102]) {
  await sharp(cream).resize({ height: h }).png().toFile(out(`public/logo/mark-${h}.png`));
  await sharp(cream).resize({ height: h }).webp({ quality: 92, alphaQuality: 100 }).toFile(out(`public/logo/mark-${h}.webp`));
}

/** Square transparent favicon; the motif is scaled up and its brow tips trimmed so the eyes stay legible. */
async function favicon(motif, size, file) {
  const w = Math.round(size * 1.12);
  const scaled = await sharp(motif).resize({ width: w }).toBuffer();
  const h = (await sharp(scaled).metadata()).height;
  const cut = Math.round((w - size) / 2);
  const trimmed = await sharp(scaled).extract({ left: cut, top: 0, width: size, height: h }).toBuffer();
  await sharp({ create: { width: size, height: size, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: trimmed, left: 0, top: Math.round((size - h) / 2) }])
    .png()
    .toFile(out(file));
}
await favicon(red, 32, 'public/favicon-32.png');
await favicon(red, 64, 'public/favicon-64.png');

// SVG favicon: same shape as a mask, red on light browser chrome, cream on dark.
await favicon(cream, 64, 'scripts/.cache-favicon-mask.png');
const maskPng = (await import('node:fs')).readFileSync(out('scripts/.cache-favicon-mask.png')).toString('base64');
(await import('node:fs')).writeFileSync(
  out('public/favicon.svg'),
  `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 64 64">
  <style>rect{fill:#b3120a}@media (prefers-color-scheme:dark){rect{fill:#fbdcb0}}</style>
  <mask id="m" style="mask-type:alpha" mask-type="alpha"><image width="64" height="64" href="data:image/png;base64,${maskPng}" xlink:href="data:image/png;base64,${maskPng}"/></mask>
  <rect width="64" height="64" mask="url(#m)"/>
</svg>\n`,
);
(await import('node:fs')).unlinkSync(out('scripts/.cache-favicon-mask.png'));
console.log('transparent logo + favicons written');
