/**
 * Season phases: before the Mahalaya transmission, during it, the run-up to Shashthi,
 * Shashthi–Dashami, and after. The hero text changes with them. (The countdown card was
 * replaced by the poll; this file now only drives the hero text.)
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

/** Hero copy follows the season: Mahalaya → Sharodiya (Puja) → Bijoya. Checked once a minute. */
export function initHeroSeason(): void {
  let last: Phase | null = null;
  const run = () => {
    const phase = phaseAt(now());
    if (phase === last) return;
    last = phase;
    const season = phase === 'toMahalaya' || phase === 'live' ? '' : phase === 'over' ? '.bijoya' : '.puja';
    for (const part of ['kicker', 'title', 'sub']) {
      const el = document.querySelector<HTMLElement>(`.hero [data-i18n^="hero.${part}"]`);
      if (!el) continue;
      el.dataset.i18n = `hero.${part}${season}`;
      el.textContent = t(el.dataset.i18n);
    }
  };
  run();
  setInterval(run, 60_000);
  onLangChange(() => {
    last = null;
    run();
  });
}
