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

export function startSmoothScroll(): () => void {
  // Respect users who turned off motion in their OS settings.
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return () => {};
  const lenis = new Lenis();
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
  };
}
