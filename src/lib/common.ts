/** Shared bootstrap for every page. */
import '../styles.css';
import { ANALYTICS, SITE_NAME, SITE_NAME_BN } from '../config';
import { getLang, initI18n, onLangChange } from './i18n';
import { loadRemoteSponsors, renderSlots } from './sponsors';
import { initBackdrop } from '../features/backdrop';
import { startSmoothScroll } from './smooth-scroll';

export function initCommon(): void {
  initBackdrop();
  startSmoothScroll();
  initI18n();
  const nameEl = document.getElementById('site-name');
  const syncName = () => {
    if (nameEl) nameEl.textContent = getLang() === 'bn' ? SITE_NAME_BN : SITE_NAME;
  };
  syncName();
  renderSlots();
  void loadRemoteSponsors();
  onLangChange(() => {
    syncName();
    renderSlots();
  });

  // Mark current nav item.
  document.querySelectorAll<HTMLAnchorElement>('.site-nav a').forEach((a) => {
    if (a.pathname !== '/' && location.pathname.startsWith(a.pathname)) a.setAttribute('aria-current', 'page');
  });

  if (import.meta.env.PROD && 'serviceWorker' in navigator) {
    addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
  }

  // Cloudflare Web Analytics (cookie-free). Off until enabled in config.
  if (ANALYTICS.enabled && ANALYTICS.cloudflareToken) {
    const s = document.createElement('script');
    s.defer = true;
    s.src = 'https://static.cloudflareinsights.com/beacon.min.js';
    s.dataset.cfBeacon = JSON.stringify({ token: ANALYTICS.cloudflareToken });
    document.head.appendChild(s);
  }
}
