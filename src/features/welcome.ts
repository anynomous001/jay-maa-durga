/**
 * Welcome dhak (home page). Browsers only allow sound after the visitor
 * interacts, so a few seconds of dhak play softly on their first tap or
 * key press, once per visit. Never over the radio or a song, never when the
 * first tap is on an audio control, and a small button turns it off for good.
 */
import { playWelcome } from './dhak';
import { t } from '../lib/i18n';

const OFF_KEY = 'welcome-dhak';
const SEEN_KEY = 'welcome-dhak-played';
const SECONDS = 7;
/** Taps here start other audio (or open it), so the welcome stays quiet. */
const AUDIO_CONTROLS = '#mini-player, dialog, [data-open="sheet-songs"], [data-open="sheet-dhak"]';

const store = (s: Storage, k: string, v?: string) => {
  try {
    return v === undefined ? s.getItem(k) : (s.setItem(k, v), v);
  } catch {
    return null;
  }
};

export function initWelcome(isRadioActive: () => boolean): void {
  if (store(localStorage, OFF_KEY) === 'off' || store(sessionStorage, SEEN_KEY)) return;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const events = ['click', 'touchend', 'keydown'] as const;
  const off = () => events.forEach((e) => removeEventListener(e, onFirst, true));

  function onFirst(e: Event) {
    off();
    store(sessionStorage, SEEN_KEY, '1');
    const target = e.target as Element | null;
    if (isRadioActive() || target?.closest?.(AUDIO_CONTROLS)) return;

    const stop = playWelcome(SECONDS);
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'welcome-mute';
    btn.textContent = `🔇 ${t('welcome.mute')}`;
    document.body.appendChild(btn);
    requestAnimationFrame(() => btn.classList.add('show'));

    let done = false;
    const end = () => {
      if (done) return;
      done = true;
      stop();
      btn.classList.remove('show');
      setTimeout(() => btn.remove(), 400);
      removeEventListener('media:start', end);
    };
    btn.addEventListener('click', () => {
      store(localStorage, OFF_KEY, 'off');
      end();
    });
    // Any other sound starting (radio, a song) ends the welcome at once.
    addEventListener('media:start', end);
    // Reaching for the radio, songs or the dhak sheet ends it too.
    const onTap = (ev: Event) => (ev.target as Element | null)?.closest?.(AUDIO_CONTROLS) && end();
    addEventListener('click', onTap, true);
    setTimeout(() => removeEventListener('click', onTap, true), SECONDS * 1000 + 400);
    setTimeout(end, SECONDS * 1000 + 300);
  }
  events.forEach((e) => addEventListener(e, onFirst, { capture: true, passive: true }));
}
