/** Config-driven sponsor slots. Empty/expired slots render an "Advertise here" CTA. */
import data from '../../data/sponsors.json';
import { getLang, t } from './i18n';
import { istDateKey, now } from './time';

export type SlotId = 'dhak' | 'countdown' | 'card' | 'map-partner' | 'pandal-nearby' | 'footer';
export const SLOT_IDS: SlotId[] = ['dhak', 'countdown', 'card', 'map-partner', 'pandal-nearby', 'footer'];

export interface Sponsor {
  id: string;
  slot: SlotId;
  name: string;
  name_bn?: string;
  tagline: string;
  tagline_bn?: string;
  logo?: string;
  link?: string;
  whatsapp?: string;
  startDate: string;
  endDate: string;
  active: boolean;
  pandalIds?: string[];
}

export const sponsors = data.sponsors as Sponsor[];

const isLive = (s: Sponsor, today = istDateKey(now())) =>
  s.active && s.startDate <= today && today <= s.endDate;

/** Active sponsor for a slot (for pandal-nearby, pass the pandal id). */
export function sponsorFor(slot: SlotId, pandalId?: string): Sponsor | undefined {
  return sponsors.find(
    (s) => s.slot === slot && isLive(s) && (slot !== 'pandal-nearby' || !pandalId || s.pandalIds?.includes(pandalId)),
  );
}

export const slotTaken = (slot: SlotId) => sponsors.some((s) => s.slot === slot && isLive(s));

export function sponsorHref(s: Sponsor): string | null {
  if (s.link) return s.link;
  if (s.whatsapp) return `https://wa.me/${s.whatsapp}`;
  return null;
}

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/** HTML for a slot. `byKey` adds a "Presented by" prefix. */
export function sponsorHTML(slot: SlotId, opts: { byKey?: string; pandalId?: string } = {}): string {
  const s = sponsorFor(slot, opts.pandalId);
  if (!s) {
    return `<a class="sponsor cta" href="/advertise/#slot-${slot}">${esc(t('adhere.cta'))}</a>`;
  }
  const bn = getLang() === 'bn';
  const name = esc((bn && s.name_bn) || s.name);
  const tag = esc((bn && s.tagline_bn) || s.tagline);
  const by = opts.byKey ? `<span class="s-by">${esc(t(opts.byKey))} </span>` : '';
  const logo = s.logo ? `<img src="${esc(s.logo)}" alt="" width="40" height="40" loading="lazy" />` : '';
  const inner = `<span class="s-label">${esc(t('sponsored'))}</span>${logo}<span class="s-text">${by}<span class="s-name">${name}</span><span class="s-tag">${tag}</span></span>`;
  const href = sponsorHref(s);
  return href
    ? `<a class="sponsor" href="${esc(href)}" target="_blank" rel="sponsored noopener">${inner}</a>`
    : `<div class="sponsor">${inner}</div>`;
}

/** Fill every [data-slot] element on the page. */
export function renderSlots(root: ParentNode = document): void {
  root.querySelectorAll<HTMLElement>('[data-slot]').forEach((el) => {
    el.innerHTML = sponsorHTML(el.dataset.slot as SlotId, {
      byKey: el.dataset.by,
      pandalId: el.dataset.pandal,
    });
  });
}
