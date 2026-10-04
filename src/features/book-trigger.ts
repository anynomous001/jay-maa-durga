/**
 * Any "Your brand here" spot ([data-book-slot]) opens the booking sheet right
 * there. The booking code + pandal list load only on the first tap, and the
 * API is asked which slots are free at that moment. Without the API/payments,
 * it falls back to booking over WhatsApp.
 */
import { API_URL, SITE_NAME, WHATSAPP_NUMBER } from '../config';
import { t } from '../lib/i18n';
import type { SlotId } from '../lib/sponsors';

interface Availability {
  taken: Record<string, boolean>;
  pandalsTaken: string[];
  payments: boolean;
}

async function availability(): Promise<Availability | null> {
  if (!API_URL) return null;
  try {
    const r = await fetch(`${API_URL}/availability`, { cache: 'no-store' });
    return r.ok ? ((await r.json()) as Availability) : null;
  } catch {
    return null;
  }
}

function whatsappFallback(slot: SlotId) {
  const text = t('ad.waText', { site: SITE_NAME }) + t(`slot.${slot}`);
  window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
}

export function initBookTriggers(): void {
  if (!document.getElementById('booking-sheet')) return;
  let booking: Promise<typeof import('./booking')> | null = null;
  document.addEventListener('click', async (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLElement>('[data-book-slot]');
    if (!btn) return;
    e.preventDefault();
    const slot = btn.dataset.bookSlot as SlotId;
    const pandal = btn.dataset.bookPandal;
    btn.setAttribute('aria-busy', 'true');
    if (!booking) booking = import('./booking').then((m) => (m.initBooking(), m));
    const [mod, avail] = await Promise.all([booking, availability()]);
    btn.removeAttribute('aria-busy');
    if (!avail?.payments) return whatsappFallback(slot);
    const taken = slot === 'pandal-nearby' ? Boolean(pandal && avail.pandalsTaken.includes(pandal)) : avail.taken[slot];
    mod.openBooking(slot, avail.pandalsTaken, { preselectPandal: pandal, unavailable: taken });
  });
}
