/**
 * Season phases (Mahalaya transmission, run-up to Shashthi, Shashthi–Dashami, after). The home
 * page only distinguishes "until Dashami" from "after"; the hero text changes with that.
 */
import { DASHAMI_END, MAHALAYA_BROADCAST_END, MAHALAYA_TRANSMISSION_START, SHASHTHI_START } from '../config';
import { onLangChange, t } from '../lib/i18n';
import { at, now } from '../lib/time';

type Phase = 'toMahalaya' | 'live' | 'toShashthi' | 'pujo' | 'over';

export function phaseAt(ms: number): Phase {
  if (ms < at(MAHALAYA_TRANSMISSION_START)) return 'toMahalaya';
  if (ms < at(MAHALAYA_BROADCAST_END)) return 'live';
  if (ms < at(SHASHTHI_START)) return 'toShashthi';
  if (ms < at(DASHAMI_END)) return 'pujo';
  return 'over';
}

/** How long each headline stays before crossfading to the other. */
const ROTATE_MS = 5000;

/** "Shubho Sharodiya" takes turns with "Happy Durga Puja" until Dashami; after it, "Shubho Bijoya" only. */
function titleKeys(phase: Phase): string[] {
  return phase === 'over' ? ['hero.title.bijoya'] : ['hero.title.puja', 'hero.title.durga'];
}

/** Hero copy follows the season: Puja until Dashami, then Bijoya. Checked once a minute. */
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
    const phase = phaseAt(now());
    const nextKeys = titleKeys(phase);
    if (nextKeys.join() !== keys.join()) {
      keys = nextKeys;
      shown = 0;
      paintTitle();
    }
    if (phase === last) return;
    last = phase;
    const season = phase === 'over' ? '.bijoya' : '.puja';
    for (const part of ['kicker', 'sub']) {
      const el = document.querySelector<HTMLElement>(`.intro [data-i18n^="hero.${part}"]`);
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
