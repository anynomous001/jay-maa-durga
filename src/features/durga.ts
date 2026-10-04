/**
 * Original, hand-drawn SVG of Maa Durga's face in the Kolkata pratima style:
 * long fish-shaped eyes, trinayan (third eye), shola mukut, nath and jhumka.
 * Animation (CSS): "chokkhu daan" — the eyes are painted in on load — then a
 * slow halo turn and a gentle breathing glow. Static under reduced motion.
 */

const EYE_UPPER = 'M-18 -16 C-38 -40 -84 -44 -112 -30 C-120 -27 -128 -36 -138 -44';
const EYE_LOWER = 'M-18 -16 C-44 -2 -86 -4 -112 -30';
const BROW = 'M-20 -62 C-44 -84 -94 -86 -128 -64';

function eye(side: 1 | -1): string {
  // Draw the left eye; mirror for the right.
  return `<g transform="scale(${side} 1)">
    <path class="dg-eye-white" d="M-18 -16 C-38 -40 -84 -44 -112 -30 C-86 -4 -44 -2 -18 -16Z" fill="#fbf4e6"/>
    <circle class="dg-pupil" cx="-60" cy="-24" r="13" fill="#1b1012"/>
    <circle class="dg-pupil" cx="-55" cy="-28" r="3.5" fill="#fff"/>
    <path class="dg-draw" pathLength="1" d="${EYE_UPPER}" stroke="#1b1012" stroke-width="7" fill="none" stroke-linecap="round"/>
    <path class="dg-draw" pathLength="1" d="${EYE_LOWER}" stroke="#1b1012" stroke-width="3.5" fill="none" stroke-linecap="round"/>
    <path class="dg-draw dg-late" pathLength="1" d="${BROW}" stroke="#1b1012" stroke-width="4" fill="none" stroke-linecap="round"/>
  </g>`;
}

function halo(): string {
  const petals = Array.from({ length: 36 }, (_, i) => {
    const a = (i * 360) / 36;
    return `<path transform="rotate(${a})" d="M0 -300 C14 -270 14 -250 0 -232 C-14 -250 -14 -270 0 -300Z"/>`;
  }).join('');
  const dots = Array.from({ length: 72 }, (_, i) => {
    const a = (i * Math.PI * 2) / 72;
    return `<circle cx="${(Math.cos(a) * 318).toFixed(1)}" cy="${(Math.sin(a) * 318).toFixed(1)}" r="3"/>`;
  }).join('');
  return `<g class="dg-halo" fill="#f4b942">
    <circle r="226" fill="none" stroke="#f4b942" stroke-width="2" opacity=".7"/>
    <g opacity=".75">${petals}</g>
    <circle r="306" fill="none" stroke="#f4b942" stroke-width="1.5" opacity=".6"/>
    <g opacity=".7">${dots}</g>
  </g>`;
}

function crown(): string {
  // Shola mukut: cream body, gold edges, pearl beads, three tall arches.
  const pearls = Array.from({ length: 15 }, (_, i) => {
    const x = -140 + i * 20;
    const y = -150 + Math.abs(x) * 0.12;
    return `<circle cx="${x}" cy="${y.toFixed(1)}" r="5" fill="#fffaf0"/>`;
  }).join('');
  return `<g class="dg-crown">
    <path d="M-150 -132 C-150 -200 -120 -236 -86 -250 C-74 -300 -40 -330 0 -372 C40 -330 74 -300 86 -250 C120 -236 150 -200 150 -132 C90 -160 -90 -160 -150 -132Z"
      fill="#f3ead6" stroke="#e2a93b" stroke-width="5"/>
    <path d="M-110 -170 C-96 -214 -70 -232 -50 -236 C-40 -280 -16 -304 0 -326 C16 -304 40 -280 50 -236 C70 -232 96 -214 110 -170"
      fill="none" stroke="#e2a93b" stroke-width="3"/>
    <circle cy="-250" r="20" fill="#c0392b" stroke="#e2a93b" stroke-width="4"/>
    <circle cx="-86" cy="-206" r="11" fill="#c0392b" stroke="#e2a93b" stroke-width="3"/>
    <circle cx="86" cy="-206" r="11" fill="#c0392b" stroke="#e2a93b" stroke-width="3"/>
    ${pearls}
  </g>`;
}

export function durgaSVG(): string {
  return `<svg class="dg-svg" viewBox="-340 -390 680 760" aria-hidden="true" focusable="false">
  <defs>
    <radialGradient id="dg-face" cx="0" cy="-10" r="170" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#f7c873"/>
      <stop offset=".75" stop-color="#eaa548"/>
      <stop offset="1" stop-color="#c97c2c"/>
    </radialGradient>
    <radialGradient id="dg-glow" r=".5">
      <stop offset="0" stop-color="#f4b942" stop-opacity=".55"/>
      <stop offset="1" stop-color="#f4b942" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <circle class="dg-glow" r="340" fill="url(#dg-glow)"/>
  ${halo()}
  <!-- hair -->
  <path d="M0 -175 C120 -175 180 -90 182 20 C184 140 168 250 150 360 L-150 360 C-168 250 -184 140 -182 20 C-180 -90 -120 -175 0 -175Z" fill="#120d1c"/>
  <!-- face -->
  <path d="M0 -150 C96 -150 132 -80 130 0 C128 84 86 150 0 168 C-86 150 -128 84 -130 0 C-132 -80 -96 -150 0 -150Z" fill="url(#dg-face)"/>
  <!-- sindoor in the parting -->
  <path d="M0 -150 L0 -132" stroke="#c0392b" stroke-width="7" stroke-linecap="round"/>
  ${crown()}
  ${eye(1)}${eye(-1)}
  <!-- trinayan: the third eye -->
  <g class="dg-third">
    <path d="M0 -118 C11 -104 11 -84 0 -70 C-11 -84 -11 -104 0 -118Z" fill="#fbf4e6"/>
    <ellipse class="dg-pupil" cy="-94" rx="4.5" ry="10" fill="#1b1012"/>
    <path class="dg-draw dg-late" pathLength="1" d="M0 -118 C11 -104 11 -84 0 -70 C-11 -84 -11 -104 0 -118Z" stroke="#c0392b" stroke-width="3.5" fill="none"/>
  </g>
  <!-- nose and nath -->
  <path d="M-4 -14 C-6 10 -12 32 -14 46 C-6 52 6 52 14 46" fill="none" stroke="#9a5420" stroke-width="3" stroke-linecap="round"/>
  <circle cx="-24" cy="62" r="24" fill="none" stroke="#e8b54a" stroke-width="3.5"/>
  <circle cx="-24" cy="86" r="5" fill="#fffaf0"/>
  <!-- lips -->
  <path d="M-30 98 C-16 88 -6 90 0 94 C6 90 16 88 30 98 C16 110 -16 110 -30 98Z" fill="#b83224"/>
  <!-- jhumka earrings -->
  <g fill="#e8b54a">
    <circle cx="-140" cy="40" r="9"/><path d="M-158 78 C-158 54 -122 54 -122 78Z"/><circle cx="-140" cy="86" r="5" fill="#fffaf0"/>
    <circle cx="140" cy="40" r="9"/><path d="M122 78 C122 54 158 54 158 78Z"/><circle cx="140" cy="86" r="5" fill="#fffaf0"/>
  </g>
  <!-- necklace -->
  <path d="M-110 190 C-60 250 60 250 110 190" fill="none" stroke="#e8b54a" stroke-width="6"/>
  <path d="M-130 214 C-70 300 70 300 130 214" fill="none" stroke="#e8b54a" stroke-width="4" stroke-dasharray="2 12" stroke-linecap="round"/>
</svg>`;
}
