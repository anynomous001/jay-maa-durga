/**
 * Season phases: before the Mahalaya transmission, during it, the run-up to Shashthi,
 * Shashthi–Dashami, and after. The hero text changes with them. (The countdown card was
 * replaced by the poll; this file now only drives the hero text.)
 */
import { DASHAMI_END, MAHALAYA_BROADCAST_END, MAHALAYA_TRANSMISSION_START, PUJA_DAYS, SHASHTHI_START } from '../config';
import { onLangChange, t } from '../lib/i18n';
import { at, istDateKey, now } from '../lib/time';

type Phase = 'toMahalaya' | 'live' | 'toShashthi' | 'pujo' | 'over';

export function phaseAt(ms: number): Phase {
  if (ms < at(MAHALAYA_TRANSMISSION_START)) return 'toMahalaya';
  if (ms < at(MAHALAYA_BROADCAST_END)) return 'live';
  if (ms < at(SHASHTHI_START)) return 'toShashthi';
  if (ms < at(DASHAMI_END)) return 'pujo';
  return 'over';
}

const MAHALAYA_DAY = PUJA_DAYS[0].dates[0];
/** How long each headline stays before crossfading to the other. */
const ROTATE_MS = 5000;

/**
 * Headlines for this moment. Up to and including Mahalaya day it's "Shubho Mahalaya", then "Shubho Sharodiya";
 * both take turns with "Happy Durga Puja" until Dashami. After Dashami: "Shubho Bijoya" only.
 */
function titleKeys(phase: Phase, ms: number): string[] {
  if (phase === 'over') return ['hero.title.bijoya'];
  return [istDateKey(ms) <= MAHALAYA_DAY ? 'hero.title' : 'hero.title.puja', 'hero.title.durga'];
}

/** Hero copy follows the season: Mahalaya → Sharodiya (Puja) → Bijoya. Checked once a minute. */
export function initHeroSeason(): void {
  let last: Phase | null = null;
  let keys: string[] = [];
  let shown = 0;

  // The two stacked headline spans. Looked up each time: the intro animation re-creates them when it finishes.
  const paintTitle = () => {
    const [a, b] = document.querySelectorAll<HTMLElement>('#hero-title .ht');
    if (!a || !b) return;
    const pair = [keys[0], keys[1] ?? keys[0]];
    [a, b].forEach((el, i) => {
      el.dataset.i18n = pair[i];
      el.textContent = t(pair[i]);
      el.classList.toggle('on', i === shown);
      el.setAttribute('aria-hidden', String(i !== shown));
    });
  };

  const run = () => {
    const n = now();
    const phase = phaseAt(n);
    const nextKeys = titleKeys(phase, n);
    if (nextKeys.join() !== keys.join()) {
      keys = nextKeys;
      shown = 0;
      paintTitle();
    }
    if (phase === last) return;
    last = phase;
    const season = phase === 'toMahalaya' || phase === 'live' ? '' : phase === 'over' ? '.bijoya' : '.puja';
    for (const part of ['kicker', 'sub']) {
      const el = document.querySelector<HTMLElement>(`.hero [data-i18n^="hero.${part}"]`);
      if (!el) continue;
      el.dataset.i18n = `hero.${part}${season}`;
      el.textContent = t(el.dataset.i18n);
    }
  };
  run();
  setInterval(run, 60_000);
  setInterval(() => {
    if (keys.length < 2 || document.hidden) return;
    shown = 1 - shown;
    paintTitle();
  }, ROTATE_MS);
  onLangChange(() => {
    last = null;
    keys = [];
    run();
  });
}
