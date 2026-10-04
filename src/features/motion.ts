/**
 * Site-wide motion. Three patterns only, sharing one easing family and timing:
 *  1. Hero / page title intro (SplitText).
 *  2. Reveal on scroll for panels and cards below the fold.
 *  3. Word-by-word highlight for one key paragraph (the radio note).
 * Plus one micro-interaction: magnetic primary buttons (fine pointers only).
 * Everything is skipped under prefers-reduced-motion.
 *
 * Bengali is split by WORD, never by character: splitting Bengali into
 * per-character spans breaks conjuncts and vowel signs (e.g. মহালয়া).
 */
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import { getLang } from '../lib/i18n';

gsap.registerPlugin(ScrollTrigger, SplitText);

const EASE = 'power3.out';
const DURATION = 0.9;

/** Elements whose top is already on screen are left alone — no flash on load. */
const belowFold = (el: Element) => el.getBoundingClientRect().top > innerHeight * 0.9;

/** Live splits; reverted before the language toggle rewrites their text. */
const splits = new Set<SplitText>();

function titleIntro(title: HTMLElement) {
  const split = new SplitText(title, {
    type: getLang() === 'en' ? 'words,chars' : 'words',
    aria: 'auto',
  });
  splits.add(split);
  const parts = getLang() === 'en' ? split.chars : split.words;
  gsap.from(parts, {
    y: 40,
    opacity: 0,
    stagger: getLang() === 'en' ? 0.03 : 0.12,
    duration: DURATION,
    ease: 'power4.out',
    // Hand the heading back as plain text so the language toggle and the
    // seasonal hero copy can keep rewriting it.
    onComplete: () => {
      split.revert();
      splits.delete(split);
    },
  });
}

function reveals() {
  const targets = gsap.utils
    .toArray<HTMLElement>('main > section.panel, .slot-card, .route, .dhak-panel')
    .filter(belowFold);
  for (const el of targets) {
    gsap.from(el, {
      y: 60,
      opacity: 0,
      duration: DURATION,
      ease: EASE,
      scrollTrigger: { trigger: el, start: 'top 85%', once: true },
    });
  }
}

function wordHighlight(p: HTMLElement) {
  // aria-label isn't allowed on <p>; plain span words read fine to screen readers.
  // Words stay display:inline (only opacity animates) so line breaks never change.
  const split = new SplitText(p, { type: 'words', tag: 'span', aria: 'none', wordsClass: 'hl-word' });
  splits.add(split);
  gsap.fromTo(
    split.words,
    { opacity: 0.25 },
    {
      opacity: 1,
      stagger: 0.1,
      ease: 'none',
      scrollTrigger: { trigger: p, start: 'top 85%', end: 'bottom 45%', scrub: true },
    },
  );
  return split;
}

function magnetic(el: HTMLElement) {
  const strength = 0.25;
  const xTo = gsap.quickTo(el, 'x', { duration: 0.4, ease: EASE });
  const yTo = gsap.quickTo(el, 'y', { duration: 0.4, ease: EASE });
  el.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    const r = el.getBoundingClientRect();
    xTo((e.clientX - (r.left + r.width / 2)) * strength);
    yTo((e.clientY - (r.top + r.height / 2)) * strength);
  });
  el.addEventListener('pointerleave', () => {
    xTo(0);
    yTo(0);
  });
}

export function initMotion(): void {
  const mm = gsap.matchMedia();
  mm.add('(prefers-reduced-motion: no-preference)', () => {
    const title = document.querySelector<HTMLElement>('.hero h1, .page-head h1');
    // Split after the web fonts land (capped), so the split measures final glyphs
    // and nothing reflows mid-animation.
    if (title) {
      gsap.set(title, { autoAlpha: 0 });
      void Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 600))]).then(() => {
        gsap.set(title, { autoAlpha: 1 });
        titleIntro(title);
      });
    }
    reveals();
    const note = document.querySelector<HTMLElement>('[data-motion="highlight"]');
    // Only when it scrolls into view later — splitting on-screen text at load is a visible jolt.
    if (note && belowFold(note)) wordHighlight(note);
    // Capture phase runs before the i18n click handler, so text is plain when it's rewritten.
    const onLang = () => {
      for (const s of splits) s.revert();
      splits.clear();
    };
    document.getElementById('lang-toggle')?.addEventListener('click', onLang, { capture: true });
    if (matchMedia('(hover: hover) and (pointer: fine)').matches) {
      document.querySelectorAll<HTMLElement>('.play-btn, .btn:not(.btn-ghost):not(.btn-sm)').forEach(magnetic);
    }
    return () => {
      onLang();
      document.getElementById('lang-toggle')?.removeEventListener('click', onLang, { capture: true });
    };
  });
  // Lazy-loaded fonts change line heights; recompute trigger positions once ready.
  void document.fonts.ready.then(() => ScrollTrigger.refresh());
}
