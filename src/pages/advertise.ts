import qrcode from 'qrcode-generator';
import { PRICES_TBD, SITE_NAME, SLOT_PRICES_INR, SPONSOR_SEASON_END, UPI_ID, UPI_PAYEE_NAME, WHATSAPP_NUMBER } from '../config';
import { initCommon } from '../lib/common';
import { initMotion } from '../features/motion';
import { initVisitors } from '../features/visitors';
import { getLang, num, onLangChange, t } from '../lib/i18n';
import { SLOT_IDS, type SlotId, slotTaken } from '../lib/sponsors';
import { istDateKey, now } from '../lib/time';

initCommon();

/** NPCI UPI deep link. Spaces as %20 (some apps mis-handle "+"). */
export function upiLink(slot: SlotId | ''): string {
  const params: [string, string][] = [
    ['pa', UPI_ID],
    ['pn', UPI_PAYEE_NAME],
    ['cu', 'INR'],
  ];
  if (slot) {
    params.push(['am', SLOT_PRICES_INR[slot].toFixed(2)]);
    params.push(['tn', `${SITE_NAME} sponsor - ${slot}`]);
  }
  // Keep "@" literal in the VPA: some older UPI apps don't decode %40.
  return 'upi://pay?' + params.map(([k, v]) => `${k}=${encodeURIComponent(v).replace(/%40/g, '@')}`).join('&');
}

const price = (slot: SlotId) => `₹${num(SLOT_PRICES_INR[slot])}`;
const seasonOver = () => istDateKey(now()) > SPONSOR_SEASON_END;

function renderSlots() {
  const box = document.getElementById('slot-list')!;
  box.innerHTML = '';
  for (const slot of SLOT_IDS) {
    const taken = slotTaken(slot);
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
      const a = document.createElement('a');
      a.className = 'btn btn-ghost';
      a.href = waLink(slot);
      a.target = '_blank';
      a.rel = 'noopener';
      a.textContent = t('ad.book');
      card.appendChild(a);
    }
    box.appendChild(card);
  }
  if (location.hash) document.querySelector(location.hash)?.classList.add('is-target');
}

function waLink(slot?: SlotId) {
  const text = t('ad.waText', { site: SITE_NAME }) + (slot ? t(`slot.${slot}`) : '');
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`;
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

const select = document.getElementById('slot-select') as HTMLSelectElement;
function renderSelect() {
  const free = SLOT_IDS.filter((s) => !slotTaken(s));
  const wanted = (select.value || location.hash.replace('#slot-', '')) as SlotId;
  select.innerHTML = '';
  for (const slot of SLOT_IDS) {
    const o = document.createElement('option');
    o.value = slot;
    o.disabled = slotTaken(slot);
    o.textContent = `${t(`slot.${slot}`)} — ${o.disabled ? t('ad.taken') : price(slot)}`;
    select.appendChild(o);
  }
  select.value = free.includes(wanted) ? wanted : (free[0] ?? SLOT_IDS[0]);
}

function renderPay() {
  const slot = select.value as SlotId;
  const link = upiLink(slot);
  (document.getElementById('upi-link') as HTMLAnchorElement).href = link;
  document.getElementById('upi-id')!.textContent = UPI_ID;
  (document.getElementById('wa-contact') as HTMLAnchorElement).href = waLink(slot);
  const qr = qrcode(0, 'M');
  qr.addData(link);
  qr.make();
  const box = document.getElementById('qr')!;
  box.innerHTML = qr.createSvgTag({ cellSize: 6, margin: 4, scalable: true });
  const svg = box.querySelector('svg')!;
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', `UPI QR: ${UPI_ID}, ${price(slot)}`);
  box.dataset.payload = link;
}

function renderAll() {
  renderSlots();
  renderStats();
  renderSelect();
  renderPay();
  document.documentElement.dataset.lang = getLang();
}
select.addEventListener('change', renderPay);
renderAll();
onLangChange(renderAll);
const visitors = initVisitors();
onLangChange(() => visitors.ping());

// Last, so it animates the final rendered content.
initMotion();
