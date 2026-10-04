import { API_URL, PRICES_TBD, PRICING, SITE_NAME, SPONSOR_SEASON_END, WHATSAPP_NUMBER } from '../config';
import { initBooking, openBooking } from '../features/booking';
import { initMotion } from '../features/motion';
import { initVisitors } from '../features/visitors';
import { initCommon } from '../lib/common';
import { num, onLangChange, t } from '../lib/i18n';
import { SLOT_IDS, type SlotId, slotTaken } from '../lib/sponsors';
import { istDateKey, now } from '../lib/time';

initCommon();

interface Availability {
  taken: Record<string, boolean>;
  pandalsTaken: string[];
  payments: boolean;
}
/** Live availability from the API (includes paid bookings and 15-minute holds). */
let avail: Availability | null = null;

async function loadAvailability() {
  if (!API_URL) return;
  try {
    const r = await fetch(`${API_URL}/availability`, { cache: 'no-store' });
    if (r.ok) avail = (await r.json()) as Availability;
  } catch {
    avail = null;
  }
  renderSlots();
}

const price = (slot: SlotId) => `₹${num(PRICING.slots[slot].price)}`;
const seasonOver = () => istDateKey(now()) > SPONSOR_SEASON_END;
const isTaken = (slot: SlotId) => (avail ? avail.taken[slot] : slotTaken(slot));
/** Online booking works only when the API is reachable and payments are set up. */
const canBookOnline = () => Boolean(API_URL && avail?.payments);

function waLink(slot?: SlotId) {
  const text = t('ad.waText', { site: SITE_NAME }) + (slot ? t(`slot.${slot}`) : '');
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`;
}

function renderSlots() {
  const box = document.getElementById('slot-list')!;
  box.innerHTML = '';
  for (const slot of SLOT_IDS) {
    // "Eat nearby" is sold per pandal, so it stays open while pandals are free.
    const taken = slot === 'pandal-nearby' ? false : isTaken(slot);
    const card = document.createElement('article');
    card.className = 'slot-card';
    card.id = `slot-${slot}`;
    card.innerHTML = `<h3></h3><p class="muted"></p><p class="slot-price"><strong></strong> <span class="muted small"></span></p><p class="slot-status"></p>`;
    card.querySelector('h3')!.textContent = t(`slot.${slot}`);
    card.querySelector('p.muted')!.textContent = t(`slot.${slot}.where`);
    card.querySelector('.slot-price strong')!.textContent = price(slot);
    card.querySelector('.slot-price span')!.textContent = `/ ${t('ad.perSlot')}${PRICES_TBD ? ` · ${t('ad.tbdMark')}` : ''}`;
    const st = card.querySelector('.slot-status')!;
    st.textContent = taken ? t('ad.taken') : t('ad.free');
    st.classList.add(taken ? 'is-taken' : 'is-free');
    if (!taken && !seasonOver()) {
      if (canBookOnline()) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'btn';
        b.textContent = t('ad.book');
        b.addEventListener('click', () => openBooking(slot, avail?.pandalsTaken ?? []));
        card.appendChild(b);
      } else {
        // No payments configured yet: fall back to booking over WhatsApp.
        const a = document.createElement('a');
        a.className = 'btn btn-ghost';
        a.href = waLink(slot);
        a.target = '_blank';
        a.rel = 'noopener';
        a.textContent = t('ad.book');
        card.appendChild(a);
      }
    }
    box.appendChild(card);
  }
  if (location.hash) document.querySelector(location.hash)?.classList.add('is-target');
}

function renderStats() {
  const dl = document.getElementById('stats')!;
  dl.innerHTML = '';
  // Live numbers from the visitor counter replace "Coming soon" once they arrive.
  const kinds: [string, string][] = [['visitors', 'total'], ['peak', 'online'], ['regions', 'listening']];
  for (const [k, kind] of kinds) {
    const div = document.createElement('div');
    div.innerHTML = `<dt></dt><dd data-visitors="${kind}"></dd>`;
    div.querySelector('dt')!.textContent = t(`ad.stat.${k}`);
    div.querySelector('dd')!.textContent = t('ad.stat.soon');
    dl.appendChild(div);
  }
}

function renderAll() {
  renderSlots();
  renderStats();
  (document.getElementById('wa-contact') as HTMLAnchorElement).href = waLink();
}

initBooking();
renderAll();
void loadAvailability();
onLangChange(renderAll);
const visitors = initVisitors();
onLangChange(() => visitors.ping());
// After a payment or a lost race, refresh which slots are free.
addEventListener('booking:paid', () => void loadAvailability());
addEventListener('booking:conflict', () => void loadAvailability());

// Last, so it animates the final rendered content.
initMotion();
