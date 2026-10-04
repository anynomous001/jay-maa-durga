// Renders PWA icons and the OG background art (1200×630) from hand-written SVG.
// The OG text is drawn in the browser (scripts/og.html) because resvg cannot
// shape Bengali conjuncts correctly. Run: npm run og
import { Resvg } from '@resvg/resvg-js';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');

// Deterministic pseudo-random stars.
function stars(n, w, h, seed = 7) {
  let s = seed;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  let out = '';
  for (let i = 0; i < n; i++) {
    const x = (rnd() * w).toFixed(1), y = (rnd() * h).toFixed(1), r = (rnd() * 1.4 + 0.4).toFixed(2);
    out += `<circle cx="${x}" cy="${y}" r="${r}" fill="#fff" opacity="${(rnd() * 0.6 + 0.2).toFixed(2)}"/>`;
  }
  return out;
}

// Kash (Saccharum spontaneum) stalks — a curved stem with a feathery plume.
function kash(x, base, height, lean, scale = 1) {
  const topX = x + lean, topY = base - height;
  let plume = '';
  for (let i = 0; i < 9; i++) {
    const t = i / 8;
    const px = x + lean * (0.55 + 0.45 * t), py = base - height * (0.55 + 0.45 * t);
    const len = (26 - i * 1.6) * scale;
    plume += `<path d="M${px} ${py} q ${len * 0.6} ${-len * 0.2} ${len} ${-len * 0.75}" stroke="#efe6d6" stroke-width="${1.6 * scale}" fill="none" opacity=".8"/>`;
    plume += `<path d="M${px} ${py} q ${-len * 0.5} ${-len * 0.25} ${-len * 0.8} ${-len * 0.8}" stroke="#efe6d6" stroke-width="${1.4 * scale}" fill="none" opacity=".65"/>`;
  }
  return `<path d="M${x} ${base} Q ${x + lean * 0.2} ${base - height * 0.5} ${topX} ${topY}" stroke="#c9b48a" stroke-width="${2.2 * scale}" fill="none"/>${plume}`;
}

const og = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#070914"/>
      <stop offset=".55" stop-color="#151a3a"/>
      <stop offset=".85" stop-color="#4a2a3a"/>
      <stop offset="1" stop-color="#8a4a2e"/>
    </linearGradient>
    <radialGradient id="glow" cx="600" cy="640" r="420" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#f4b942" stop-opacity=".85"/>
      <stop offset=".35" stop-color="#ef6a4f" stop-opacity=".35"/>
      <stop offset="1" stop-color="#ef6a4f" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#sky)"/>
  ${stars(140, 1200, 380)}
  <rect width="1200" height="630" fill="url(#glow)"/>
  <circle cx="600" cy="640" r="92" fill="#f8c35a"/>
  <path d="M0 600 Q 300 560 600 585 T 1200 575 V630 H0z" fill="#0b0d1c"/>
  ${kash(90, 610, 210, 40, 1.1)}${kash(140, 615, 170, -25)}${kash(1060, 612, 220, -45, 1.1)}${kash(1120, 618, 160, 20)}${kash(1010, 620, 140, 15, 0.9)}
</svg>`;

// App icon: dawn arc + rising sun on night blue. `pad` shrinks art for maskable safe zone.
const icon = (pad = 0) => `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" ${pad ? '' : 'rx="112"'} fill="#0c0f1f"/>
  <g transform="translate(${256 - 256 * (1 - pad)} ${256 - 256 * (1 - pad)}) scale(${1 - pad})">
    <circle cx="256" cy="330" r="190" fill="#f4b942" opacity=".12"/>
    <path d="M96 336a160 160 0 0 1 320 0" fill="none" stroke="#f4b942" stroke-width="34" stroke-linecap="round"/>
    <circle cx="256" cy="336" r="62" fill="#f4b942"/>
    <rect x="70" y="352" width="372" height="26" rx="13" fill="#ef6a4f"/>
    <circle cx="140" cy="140" r="6" fill="#f1ece2"/><circle cx="380" cy="120" r="5" fill="#f1ece2"/><circle cx="300" cy="180" r="4" fill="#f1ece2" opacity=".7"/>
  </g>
</svg>`;

const render = (svg, width, out) => {
  const png = new Resvg(svg, { fitTo: { mode: 'width', value: width } }).render().asPng();
  writeFileSync(resolve(root, out), png);
  console.log('wrote', out, png.length, 'bytes');
};

mkdirSync(resolve(root, 'public/icons'), { recursive: true });
render(icon(), 192, 'public/icons/icon-192.png');
render(icon(), 512, 'public/icons/icon-512.png');
render(icon(0.2), 512, 'public/icons/maskable-512.png');
render(icon(0.08).replace('rx="112"', ''), 180, 'public/icons/apple-touch-icon.png');
writeFileSync(resolve(root, 'scripts/og-art.svg'), og);
console.log('wrote scripts/og-art.svg — now open http://localhost:5173/scripts/og.html with `npm run dev` to render public/og.jpg');
