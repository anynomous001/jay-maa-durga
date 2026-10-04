/**
 * Tiny bilingual layer. Static HTML ships Bengali text (good for no-JS and
 * search engines); elements carry `data-i18n="key"` and get swapped on toggle.
 * `data-i18n-attr="aria-label:key;title:key2"` handles attributes.
 */
import { dict } from './strings';

export type Lang = 'bn' | 'en';
const KEY = 'lang';
const listeners = new Set<(l: Lang) => void>();

let current: Lang = (() => {
  const q = new URLSearchParams(location.search).get('lang');
  if (q === 'en' || q === 'bn') return q;
  const saved = localStorage.getItem(KEY);
  return saved === 'en' ? 'en' : 'bn';
})();

export const getLang = (): Lang => current;

export function t(key: string, vars?: Record<string, string | number>): string {
  const entry = dict[key];
  let s = entry ? entry[current] : key;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(String(v));
  return s;
}

const BN_DIGITS = '০১২৩৪৫৬৭৮৯';
/** Render ASCII digits in Bengali numerals when the UI is Bengali. */
export function num(n: number | string, pad = 0): string {
  const s = String(n).padStart(pad, '0');
  return current === 'bn' ? s.replace(/\d/g, (d) => BN_DIGITS[+d]) : s;
}

export function applyI18n(root: ParentNode = document): void {
  root.querySelectorAll<HTMLElement>('[data-i18n]').forEach((el) => {
    const k = el.dataset.i18n!;
    if (dict[k]) el.textContent = dict[k][current];
  });
  root.querySelectorAll<HTMLElement>('[data-i18n-html]').forEach((el) => {
    const k = el.dataset.i18nHtml!;
    if (dict[k]) el.innerHTML = dict[k][current];
  });
  root.querySelectorAll<HTMLElement>('[data-i18n-attr]').forEach((el) => {
    for (const pair of el.dataset.i18nAttr!.split(';')) {
      const [attr, k] = pair.split(':');
      if (attr && k && dict[k]) el.setAttribute(attr, dict[k][current]);
    }
  });
}

export function setLang(l: Lang): void {
  current = l;
  localStorage.setItem(KEY, l);
  document.documentElement.lang = l === 'bn' ? 'bn' : 'en';
  applyI18n();
  listeners.forEach((fn) => fn(l));
}

export const onLangChange = (fn: (l: Lang) => void) => listeners.add(fn);

/** Wire the header toggle button and apply the stored language. */
export function initI18n(): void {
  document.documentElement.lang = current === 'bn' ? 'bn' : 'en';
  if (current !== 'bn') applyI18n();
  const btn = document.getElementById('lang-toggle');
  if (!btn) return;
  const sync = () => {
    btn.textContent = current === 'bn' ? 'English' : 'বাংলা';
    btn.setAttribute('lang', current === 'bn' ? 'en' : 'bn');
    btn.setAttribute('aria-label', current === 'bn' ? 'Switch to English' : 'বাংলায় দেখুন');
  };
  sync();
  btn.addEventListener('click', () => {
    setLang(current === 'bn' ? 'en' : 'bn');
    sync();
  });
}
