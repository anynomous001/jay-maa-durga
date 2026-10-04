/**
 * "Wake me for Mahalaya": the user arms it (a tap, which satisfies autoplay
 * rules), we hold a Screen Wake Lock where supported, and start the stream at
 * AUTO_START_AT. Works only while this page stays open.
 */
import { AUTO_START_AT, MAHALAYA_BROADCAST_END } from '../config';
import { getLang, onLangChange, t } from '../lib/i18n';
import { at, formatDate, formatTime, localTimeZone, now } from '../lib/time';
import type { Radio } from './radio';

export function initWake(radio: Radio): void {
  const toggle = document.getElementById('wake-toggle') as HTMLButtonElement;
  const status = document.getElementById('wake-status')!;
  let armed = false;
  let fired = false;
  let lock: WakeLockSentinel | null = null;
  let timer = 0;
  let statusKey: 'armed' | 'started' | 'past' | 'none' = 'none';
  let lockOk = false;

  const target = at(AUTO_START_AT);
  const end = at(MAHALAYA_BROADCAST_END);

  async function acquireLock() {
    if (!('wakeLock' in navigator)) return false;
    try {
      lock = await navigator.wakeLock.request('screen');
      lock.addEventListener('release', () => (lock = null));
      return true;
    } catch {
      return false;
    }
  }

  function renderStatus() {
    const tz = localTimeZone();
    if (statusKey === 'armed') {
      const when = `${formatDate(target, getLang(), tz)}, ${formatTime(target, getLang(), tz)}`;
      status.textContent = `${t('wake.armed', { t: when })} ${lockOk ? t('wake.armedLock') : t('wake.noLock')}`;
    } else if (statusKey === 'started') status.textContent = t('wake.started');
    else if (statusKey === 'past') status.textContent = t('wake.past');
    else status.textContent = '';
  }

  function check() {
    if (!armed || fired) return;
    const n = now();
    if (n >= target && n < end) {
      fired = true;
      statusKey = 'started';
      renderStatus();
      if (!radio.isActive()) void radio.play();
    } else if (n >= end) {
      setArmed(false);
      statusKey = 'past';
      renderStatus();
    }
  }

  async function setArmed(on: boolean) {
    armed = on;
    toggle.setAttribute('aria-checked', String(on));
    clearInterval(timer);
    if (on) {
      if (now() >= end) {
        armed = false;
        toggle.setAttribute('aria-checked', 'false');
        statusKey = 'past';
        renderStatus();
        return;
      }
      fired = false;
      // Must happen synchronously inside the tap for iOS.
      const unlocked = radio.unlock();
      lockOk = await acquireLock();
      await unlocked;
      statusKey = 'armed';
      renderStatus();
      timer = window.setInterval(check, 1000);
      check();
    } else {
      statusKey = 'none';
      renderStatus();
      if (lock) await lock.release().catch(() => {});
      lock = null;
    }
  }

  toggle.addEventListener('click', () => void setArmed(!armed));

  // Wake locks drop when the tab is hidden; re-acquire when it comes back.
  document.addEventListener('visibilitychange', async () => {
    if (armed && document.visibilityState === 'visible') {
      if (!lock) lockOk = await acquireLock();
      check();
      if (statusKey === 'armed') renderStatus();
    }
  });

  onLangChange(renderStatus);
}
