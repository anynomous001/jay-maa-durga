/**
 * Original animated pre-dawn backdrop: twinkling stars, slow mist and falling
 * shiuli (night-jasmine) flowers. Pure CSS animation on transform/opacity, so
 * it stays cheap on mid-range phones. Static under prefers-reduced-motion.
 */
import { durgaSVG } from './durga';

// Shiuli: six white petals around a saffron-orange tube. Drawn for this site.
const SHIULI = `<svg viewBox="-12 -12 24 24" aria-hidden="true"><g fill="#fbf7ee">${[0, 60, 120, 180, 240, 300]
  .map((r) => `<path transform="rotate(${r})" d="M0 0C-2.6-3-2.4-8.6 0-10.4 2.4-8.6 2.6-3 0 0z"/>`)
  .join('')}</g><circle r="2.1" fill="#f28c28"/><path d="M0 1.5v9" stroke="#f28c28" stroke-width="2.2" stroke-linecap="round"/></svg>`;

/** Small deterministic PRNG so the layout is stable across reloads. */
function rng(seed: number) {
  return () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
}

export function initBackdrop(): void {
  if (document.querySelector('.backdrop')) return;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const small = innerWidth < 720;
  const r = rng(1031);

  const root = document.createElement('div');
  root.className = 'backdrop';
  root.setAttribute('aria-hidden', 'true');

  let html = `<div class="bd-glow"></div><div class="bd-durga${reduced ? ' still' : ''}">${durgaSVG()}</div>`;
  for (let i = 0; i < (small ? 28 : 50); i++) {
    html += `<i class="bd-star" style="left:${(r() * 100).toFixed(1)}%;top:${(r() * 55).toFixed(1)}%;--s:${(r() * 1.6 + 0.8).toFixed(1)}px;--d:${(r() * 4 + 3).toFixed(1)}s;--o:${(r() * 0.5 + 0.35).toFixed(2)}"></i>`;
  }
  for (let i = 0; i < 3; i++) {
    html += `<i class="bd-mist" style="top:${30 + i * 18}%;--d:${60 + i * 25}s;--delay:${-i * 17}s;--o:${0.1 + i * 0.03}"></i>`;
  }
  const flowers = reduced ? 5 : small ? 9 : 16;
  for (let i = 0; i < flowers; i++) {
    const size = (r() * 10 + 14).toFixed(0);
    const left = (r() * 100).toFixed(1);
    const style = reduced
      ? `left:${left}%;bottom:${(r() * 6).toFixed(1)}%;--z:${size}px;transform:rotate(${(r() * 360).toFixed(0)}deg)`
      : `left:${left}%;--z:${size}px;--d:${(r() * 9 + 13).toFixed(1)}s;--delay:${(-r() * 22).toFixed(1)}s;--sway:${((r() - 0.5) * 140).toFixed(0)}px;--spin:${((r() - 0.5) * 720).toFixed(0)}deg`;
    html += `<span class="bd-flower${reduced ? ' rest' : ''}" style="${style}">${SHIULI}</span>`;
  }
  root.innerHTML = html;
  document.body.prepend(root);

  // Don't burn battery animating an invisible tab.
  document.addEventListener('visibilitychange', () => {
    root.classList.toggle('paused', document.hidden);
  });
}
