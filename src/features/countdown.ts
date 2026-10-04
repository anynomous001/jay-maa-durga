/**
 * Phases: before transmission → countdown to Mahalaya;
 * during transmission → "on air"; then countdown to Shashthi;
 * Shashthi–Dashami → "Pujo is here, today is …"; after → Shubho Bijoya.
 */
import {
  DASHAMI_END,
  MAHALAYA_BROADCAST_END,
  MAHALAYA_TRANSMISSION_START,
  PUJA_DAYS,
  SHASHTHI_START,
} from '../config';
import { getLang, num, onLangChange, t } from '../lib/i18n';
import { IST, at, formatDate, formatTime, istDateKey, localTimeZone, now, splitDuration, zoneName } from '../lib/time';

type Phase = 'toMahalaya' | 'live' | 'toShashthi' | 'pujo' | 'over';

export function phaseAt(ms: number): Phase {
  if (ms < at(MAHALAYA_TRANSMISSION_START)) return 'toMahalaya';
  if (ms < at(MAHALAYA_BROADCAST_END)) return 'live';
  if (ms < at(SHASHTHI_START)) return 'toShashthi';
  if (ms < at(DASHAMI_END)) return 'pujo';
  return 'over';
}

export function initCountdown(): void {
  const label = document.getElementById('cd-label')!;
  const grid = document.getElementById('cd-grid')!;
  const msg = document.getElementById('cd-message')!;
  const istEl = document.getElementById('cd-ist')!;
  const localEl = document.getElementById('cd-local')!;
  const localRow = document.getElementById('cd-local-row')!;
  const sr = document.getElementById('cd-sr')!;
  const nums = Object.fromEntries(
    [...grid.querySelectorAll<HTMLElement>('[data-unit]')].map((el) => [el.dataset.unit!, el]),
  );
  const tz = localTimeZone();
  let lastPhase: Phase | null = null;
  let lastMinute = -1;

  const describe = (ms: number, zone: string) =>
    `${formatDate(ms, getLang(), zone)} · ${formatTime(ms, getLang(), zone)}`;

  function renderTargets(phase: Phase) {
    const target = phase === 'toShashthi' || phase === 'pujo' ? at(SHASHTHI_START) : at(MAHALAYA_TRANSMISSION_START);
    if (phase === 'toShashthi') {
      istEl.textContent = formatDate(target, getLang(), IST);
      localRow.hidden = true;
      return;
    }
    istEl.textContent = describe(target, IST);
    // Show the visitor's own time only if their offset differs from IST.
    const differs = tz !== IST && zoneName(target, tz) !== zoneName(target, IST);
    localRow.hidden = !differs;
    if (differs) localEl.textContent = `${describe(target, tz)} (${zoneName(target, tz)})`;
  }

  function tick() {
    const n = now();
    const phase = phaseAt(n);
    if (phase !== lastPhase) {
      lastPhase = phase;
      setHero(phase);
      const counting = phase === 'toMahalaya' || phase === 'toShashthi';
      grid.hidden = !counting;
      msg.hidden = counting;
      label.hidden = !counting;
      document.getElementById('cd-times')!.hidden = phase === 'pujo' || phase === 'over';
      renderTargets(phase);
    }
    if (phase === 'toMahalaya' || phase === 'toShashthi') {
      const target = at(phase === 'toMahalaya' ? MAHALAYA_TRANSMISSION_START : SHASHTHI_START);
      const p = splitDuration(target - n);
      label.textContent = t(phase === 'toMahalaya' ? 'cd.toMahalaya' : 'cd.toShashthi');
      nums.days.textContent = num(p.days);
      nums.hours.textContent = num(p.hours, 2);
      nums.minutes.textContent = num(p.minutes, 2);
      nums.seconds.textContent = num(p.seconds, 2);
      // Announce to screen readers once a minute, not every second.
      if (p.minutes !== lastMinute) {
        lastMinute = p.minutes;
        sr.textContent = `${label.textContent}: ${num(p.days)} ${t('cd.days')} ${num(p.hours)} ${t('cd.hours')} ${num(p.minutes)} ${t('cd.minutes')}`;
      }
    } else if (phase === 'live') {
      msg.textContent = t('cd.live');
    } else if (phase === 'pujo') {
      const today = istDateKey(n);
      const day = PUJA_DAYS.find((d) => d.dates.includes(today));
      const name = day ? (getLang() === 'bn' ? day.name_bn : day.name_en) : '';
      msg.textContent = t('cd.pujo', { day: name });
    } else {
      msg.textContent = t('cd.over');
    }
  }

  /** Hero copy follows the season: Mahalaya → Sharodiya (Puja) → Bijoya. */
  function setHero(phase: Phase) {
    const season = phase === 'toMahalaya' || phase === 'live' ? '' : phase === 'over' ? '.bijoya' : '.puja';
    for (const part of ['kicker', 'title', 'sub']) {
      const el = document.querySelector<HTMLElement>(`.hero [data-i18n^="hero.${part}"]`);
      if (!el) continue;
      el.dataset.i18n = `hero.${part}${season}`;
      el.textContent = t(el.dataset.i18n);
    }
  }

  tick();
  setInterval(tick, 1000);
  onLangChange(() => {
    lastPhase = null;
    lastMinute = -1;
    tick();
  });
}
