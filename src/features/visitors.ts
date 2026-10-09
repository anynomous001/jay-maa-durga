/**
 * Live visitor counts from the Cloudflare Worker (see /worker).
 * Each browser gets a random id in localStorage (no cookies, nothing personal).
 * We send one /visit on load, then a /ping every 60 s while the tab is visible
 * or the radio is playing, flagging whether it is playing. Elements opt in with:
 *   [data-visitors="total|online|listening"]  → formatted number
 *   [data-visitors-wrap]                      → un-hidden once numbers arrive
 */
import { API_URL } from '../config';
import { getLang, onLangChange, t } from '../lib/i18n';

interface Stats {
  total: number;
  online: number;
  listening: number;
}

const ID_KEY = 'visitor-id';

/**
 * Channel tag from links like ?ref=wa. Read once, then removed from the
 * address bar so a copied link doesn't carry someone else's tag.
 */
function takeRef(): string {
  const url = new URL(location.href);
  const ref = (url.searchParams.get('ref') ?? '').toLowerCase();
  if (!url.searchParams.has('ref')) return '';
  url.searchParams.delete('ref');
  history.replaceState(history.state, '', url.pathname + url.search + url.hash);
  return /^[a-z0-9-]{1,24}$/.test(ref) ? ref : '';
}
const PING_MS = 60_000; // keep well inside the Workers free tier (see README)

/** This browser's anonymous id (also used to keep one vote per poll). */
export function visitorId(): string {
  let id = localStorage.getItem(ID_KEY);
  if (!id || !/^[a-z0-9-]{16,40}$/.test(id)) {
    id = crypto.randomUUID?.() ?? Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, '0')).join('');
    localStorage.setItem(ID_KEY, id);
  }
  return id;
}

const fmt = (n: number) => new Intl.NumberFormat(getLang() === 'bn' ? 'bn-IN' : 'en-IN').format(n);

let last: Stats | null = null;

function render() {
  if (!last) return;
  const s = last;
  document.querySelectorAll<HTMLElement>('[data-visitors]').forEach((el) => {
    const kind = el.dataset.visitors as keyof Stats;
    const tpl = el.dataset.visitorsText; // optional i18n template key, e.g. "vis.online"
    el.textContent = tpl ? t(tpl, { n: fmt(s[kind]) }) : fmt(s[kind]);
  });
  document.querySelectorAll<HTMLElement>('[data-visitors-wrap]').forEach((el) => (el.hidden = false));
  // Player line: only when someone is actually listening.
  const lc = document.getElementById('listener-count');
  if (lc) {
    lc.hidden = s.listening < 1;
    lc.textContent = t('radio.listeners', { n: fmt(s.listening) });
  }
}

/** `isListening` reports whether this visitor's radio is playing. */
export function initVisitors(isListening: () => boolean = () => false): { ping: () => void } {
  if (!API_URL) return { ping: () => {} };
  const base = API_URL;
  const id = visitorId();
  const ref = takeRef();
  const page = location.pathname.startsWith('/pandals') ? 'pandals' : '';

  const send = async (path: '/visit' | '/ping') => {
    try {
      const r = await fetch(base + path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(path === '/visit' ? { id, listening: isListening(), ref, page } : { id, listening: isListening() }),
        keepalive: true,
      });
      if (r.ok) {
        last = (await r.json()) as Stats;
        render();
      }
    } catch {
      /* counter is optional — never break the page */
    }
  };

  // Ping while the page is on screen, or while the radio plays in the
  // background (screen locked, another tab) so listeners stay "online".
  const tick = () => (document.visibilityState === 'visible' || isListening()) && void send('/ping');
  void send('/visit');
  let timer = window.setInterval(tick, PING_MS);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      void send('/ping');
      clearInterval(timer);
      timer = window.setInterval(tick, PING_MS);
    }
  });
  onLangChange(render);
  return { ping: () => void send('/ping') };
}
