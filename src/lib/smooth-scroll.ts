/**
 * Lenis smooth wheel-scrolling, driven by GSAP's ticker so ScrollTrigger stays
 * in sync. Touch scrolling stays native (Lenis' default), so phones feel normal.
 * Elements with `data-lenis-prevent` (map, inner scroll lists) scroll natively.
 */
import Lenis from 'lenis';
import 'lenis/dist/lenis.css';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

let active: Lenis | null = null;

/** Scrolls to an element; goes through Lenis when it runs, as a native smooth scroll fights its own animation. */
export function scrollToEl(el: HTMLElement, block: 'start' | 'center' = 'start'): void {
  if (active) {
    const offset = block === 'center' ? -(innerHeight - el.offsetHeight) / 2 : 0;
    active.scrollTo(el, { offset: Math.min(0, offset) });
  } else el.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block });
}

export function startSmoothScroll(): () => void {
  // Respect users who turned off motion in their OS settings.
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return () => {};
  const lenis = new Lenis({ anchors: true });
  active = lenis;
  lenis.on('scroll', ScrollTrigger.update);
  // Sheets (dialogs) scroll on their own; freeze the page behind them.
  addEventListener('sheet:open', () => lenis.stop());
  addEventListener('sheet:close', () => lenis.start());
  const tick = (time: number) => lenis.raf(time * 1000);
  gsap.ticker.add(tick);
  gsap.ticker.lagSmoothing(0);
  return () => {
    gsap.ticker.remove(tick);
    lenis.destroy();
    active = null;
  };
}
