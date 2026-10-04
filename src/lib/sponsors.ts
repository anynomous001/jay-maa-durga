/**
 * Sponsor slots. Sources: data/sponsors.json (house sponsors, edited by hand)
 * + approved bookings from the API (paid via Razorpay, approved in /admin/).
 * Empty/expired slots render an "Advertise here" CTA.
 */
import data from '../../data/sponsors.json';
import { API_URL } from '../config';
import { getLang, t } from './i18n';
import { istDateKey, now } from './time';

export type SlotId = 'dhak' | 'countdown' | 'spotlight' | 'map-partner' | 'pandal-nearby';
export const SLOT_IDS: SlotId[] = ['spotlight', 'countdown', 'dhak', 'map-partner', 'pandal-nearby'];

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
  /** From bookings: shown on the spotlight card / pandal cards. */
  description?: string;
  address?: string;
  mapsUrl?: string;
}

export const sponsors: Sponsor[] = [...(data.sponsors as Sponsor[])];

let remoteLoaded = false;

/**
 * Fetch approved sponsors from the API once per page (the API sends a short
 * HTTP cache), merge them in, and re-render. Fires `sponsors:update` for pages
 * that draw their own sponsor UI.
 */
export async function loadRemoteSponsors(): Promise<void> {
  if (!API_URL || remoteLoaded) return;
  remoteLoaded = true;
  let list: Sponsor[];
  try {
    const r = await fetch(`${API_URL}/sponsors`);
    if (!r.ok) return;
    list = ((await r.json()) as { sponsors: Sponsor[] }).sponsors;
  } catch {
    return;
  }
  for (const s of list) if (!sponsors.some((x) => x.id === s.id)) sponsors.push(s);
  renderSlots();
  window.dispatchEvent(new CustomEvent('sponsors:update'));
}

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
  const extra =
    slot === 'spotlight'
      ? `${s.description ? `<span class="s-desc">${esc(s.description)}</span>` : ''}${s.address ? `<span class="s-addr">📍 ${esc(s.address)}</span>` : ''}`
      : '';
  const inner = `<span class="s-label">${esc(t('sponsored'))}</span>${logo}<span class="s-text">${by}<span class="s-name">${name}</span><span class="s-tag">${tag}</span>${extra}</span>`;
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
