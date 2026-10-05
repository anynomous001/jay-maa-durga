/**
 * Any "Your brand here" spot ([data-book-slot]) opens the booking sheet right
 * there. The form always opens. The booking code loads on the first tap and
 * the API is asked which slots are free; if it can't be reached, the form still
 * opens and submitting sends the details to WhatsApp instead of paying online.
 */
import { API_URL } from '../config';
import type { SlotId } from '../lib/sponsors';

interface Availability {
  ranges: Record<string, { start: string; end: string }[]>;
  pandalRanges: Record<string, { start: string; end: string }[]>;
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
    mod.openBooking(slot, avail, { preselectPandal: pandal, paymentsOn: Boolean(avail?.payments) });
  });
}
