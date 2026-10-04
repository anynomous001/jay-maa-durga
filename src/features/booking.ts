/**
 * Sponsor booking: form sheet → API creates a 15-minute hold + Razorpay order →
 * Razorpay Checkout (UPI / cards / netbanking / wallets) → API verifies the
 * signature → "paid, waiting for review". Prices are charged by the server from
 * data/pricing.json; the browser never decides the amount.
 */
import pandalData from '../../data/pandals.json';
import { API_URL, PRICING, SITE_NAME, WHATSAPP_NUMBER } from '../config';
import { getLang, num, t } from '../lib/i18n';
import type { SlotId } from '../lib/sponsors';
import { istDateKey, now } from '../lib/time';

interface Created {
  id: string;
  orderId: string;
  amount: number;
  currency: string;
  keyId: string;
  mock: boolean;
  prefill: { name: string; email: string; contact: string };
}
interface RazorpayResponse {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}
declare global {
  interface Window {
    Razorpay?: new (opts: Record<string, unknown>) => { open(): void; on(evt: string, fn: (r: unknown) => void): void };
  }
}

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const priceText = (slot: SlotId) => `₹${num(PRICING.slots[slot].price)}`;
const MAX_PANDALS = PRICING.slots['pandal-nearby'].maxPandals ?? 3;

let sheet: HTMLDialogElement;
let form: HTMLFormElement;
let current: Created | null = null;
let currentBusiness = '';
let pandalsTaken = new Set<string>();

function loadCheckout(): Promise<void> {
  if (window.Razorpay) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://checkout.razorpay.com/v1/checkout.js';
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('checkout script failed'));
    document.head.appendChild(s);
  });
}

function showView(view: 'form' | 'mock' | 'done') {
  form.hidden = view !== 'form';
  $('bk-mock').hidden = view !== 'mock';
  $('bk-done').hidden = view !== 'done';
}

function setError(msg: string) {
  const el = $('bk-error');
  el.textContent = msg;
  el.hidden = !msg;
}

function clearFieldErrors() {
  form.querySelectorAll('.field-error').forEach((n) => n.remove());
  form.querySelectorAll('[aria-invalid]').forEach((n) => n.removeAttribute('aria-invalid'));
}

function showFieldErrors(errors: Record<string, string>) {
  let first: HTMLElement | null = null;
  for (const [name, code] of Object.entries(errors)) {
    const input = (name === 'pandal_ids' ? $('bk-pandal-search') : form.querySelector<HTMLElement>(`[name="${name}"]`)) as HTMLElement | null;
    if (!input) continue;
    input.setAttribute('aria-invalid', 'true');
    const msg = document.createElement('small');
    msg.className = 'field-error';
    msg.id = `err-${name}`;
    const text = t(`bk.err.${code}`);
    msg.textContent = text.startsWith('bk.err.') ? t('bk.err.invalid') : text;
    (input.closest('.field') ?? input.closest('label') ?? input.parentElement)!.appendChild(msg);
    input.setAttribute('aria-describedby', msg.id);
    first ??= input;
  }
  first?.focus();
}

function renderPandalPicks(query = '') {
  const box = $('bk-pandals');
  const checked = new Set([...box.querySelectorAll<HTMLInputElement>('input:checked')].map((i) => i.value));
  const q = query.trim().toLowerCase();
  box.innerHTML = '';
  for (const p of pandalData.pandals) {
    const matches = !q || [p.name_bn, p.name_en, p.area].some((s) => s.toLowerCase().includes(q));
    if (!matches && !checked.has(p.id)) continue;
    const taken = pandalsTaken.has(p.id);
    const label = document.createElement('label');
    label.className = 'pick' + (taken ? ' is-taken' : '');
    label.innerHTML = `<input type="checkbox" name="pandal_ids" value="${p.id}"${checked.has(p.id) ? ' checked' : ''}${taken ? ' disabled' : ''} /><span></span>`;
    label.querySelector('span')!.textContent = `${getLang() === 'bn' ? p.name_bn : p.name_en} · ${p.area}${taken ? ` (${t('ad.taken')})` : ''}`;
    box.appendChild(label);
  }
  enforcePandalLimit();
}

function enforcePandalLimit() {
  const boxes = [...$('bk-pandals').querySelectorAll<HTMLInputElement>('input')];
  const n = boxes.filter((b) => b.checked).length;
  boxes.forEach((b) => {
    if (!b.checked && !pandalsTaken.has(b.value)) b.disabled = n >= MAX_PANDALS;
  });
}

export function openBooking(slot: SlotId, takenPandals: string[] = []) {
  pandalsTaken = new Set(takenPandals);
  current = null;
  showView('form');
  setError('');
  clearFieldErrors();
  ($('bk-slot') as HTMLInputElement).value = slot;
  $('bk-summary').innerHTML = `<strong></strong><span></span>`;
  $('bk-summary').querySelector('strong')!.textContent = t(`slot.${slot}`);
  $('bk-summary').querySelector('span')!.textContent = ` · ${priceText(slot)} · ${t('slot.' + slot + '.where')}`;
  $('bk-pandals-field').hidden = slot !== 'pandal-nearby';
  if (slot === 'pandal-nearby') renderPandalPicks();
  const start = $('bk-start') as HTMLInputElement;
  start.min = istDateKey(now());
  start.max = PRICING.seasonEnd;
  if (!start.value || start.value < start.min) start.value = start.min;
  const submit = $('bk-submit') as HTMLButtonElement;
  submit.disabled = false;
  submit.textContent = t('bk.pay', { price: priceText(slot) });
  sheet.showModal();
  window.dispatchEvent(new CustomEvent('sheet:open'));
}

async function verify(resp: RazorpayResponse) {
  if (!current) return;
  try {
    const r = await fetch(`${API_URL}/bookings/${current.id}/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(resp),
    });
    if (!r.ok) throw new Error(String(r.status));
    showDone();
  } catch {
    showView('form');
    setError(`${t('bk.err.verify')} (${current.id})`);
  }
}

function showDone() {
  if (!current) return;
  $('bk-ref').textContent = current.id;
  ($('bk-done-wa') as HTMLAnchorElement).href = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(
    t('bk.doneWaText', { site: SITE_NAME, ref: current.id, business: currentBusiness }),
  )}`;
  showView('done');
  window.dispatchEvent(new CustomEvent('booking:paid'));
}

async function openCheckout() {
  if (!current) return;
  if (current.mock) {
    ($('bk-mock-pay') as HTMLButtonElement).textContent = t('bk.mockPay', { price: `₹${num(current.amount / 100)}` });
    showView('mock');
    return;
  }
  await loadCheckout();
  const slot = ($('bk-slot') as HTMLInputElement).value as SlotId;
  const rzp = new window.Razorpay!({
    key: current.keyId,
    amount: current.amount,
    currency: current.currency,
    order_id: current.orderId,
    name: SITE_NAME,
    description: t(`slot.${slot}`).replace(/[“”"]/g, ''),
    prefill: current.prefill,
    notes: { booking: current.id },
    theme: { color: '#f4b942' },
    handler: (resp: RazorpayResponse) => void verify(resp),
    modal: {
      ondismiss: () => {
        const submit = $('bk-submit') as HTMLButtonElement;
        submit.disabled = false;
        submit.textContent = t('bk.pay', { price: priceText(slot) });
        setError(t('bk.dismissed'));
      },
    },
  });
  rzp.on('payment.failed', () => setError(t('bk.dismissed')));
  rzp.open();
}

async function submit(e: SubmitEvent) {
  e.preventDefault();
  setError('');
  clearFieldErrors();
  // A hold already exists for this form (checkout dismissed): just reopen it.
  if (current) return openCheckout();
  const submitBtn = $('bk-submit') as HTMLButtonElement;
  const fd = new FormData(form);
  const logo = fd.get('logo') as File | null;
  if (logo && logo.size === 0) fd.delete('logo');
  currentBusiness = String(fd.get('business_name') ?? '');
  submitBtn.disabled = true;
  submitBtn.textContent = t('bk.paying');
  try {
    const r = await fetch(`${API_URL}/bookings`, { method: 'POST', body: fd });
    const body = (await r.json()) as Created & { error?: string; errors?: Record<string, string> };
    if (!r.ok) {
      submitBtn.disabled = false;
      submitBtn.textContent = t('bk.pay', { price: priceText(fd.get('slot') as SlotId) });
      if (body.errors) {
        showFieldErrors(body.errors);
        setError(t('bk.err.form'));
      } else setError(t(`bk.err.${body.error}`) === `bk.err.${body.error}` ? t('bk.err.generic') : t(`bk.err.${body.error}`));
      if (body.error === 'slot_taken' || body.error === 'pandal_taken') window.dispatchEvent(new CustomEvent('booking:conflict'));
      return;
    }
    current = body;
    await openCheckout();
  } catch {
    submitBtn.disabled = false;
    submitBtn.textContent = t('bk.pay', { price: priceText(fd.get('slot') as SlotId) });
    setError(t('bk.err.generic'));
  }
}

export function initBooking() {
  sheet = $('booking-sheet') as HTMLDialogElement;
  form = $('booking-form') as HTMLFormElement;
  form.addEventListener('submit', (e) => void submit(e as SubmitEvent));
  sheet.querySelector('[data-close]')?.addEventListener('click', () => sheet.close());
  sheet.addEventListener('click', (e) => e.target === sheet && sheet.close());
  sheet.addEventListener('close', () => {
    window.dispatchEvent(new CustomEvent('sheet:close'));
    // After a successful booking, start fresh next time.
    if (!$('bk-done').hidden) {
      form.reset();
      ($('bk-logo-preview') as HTMLImageElement).hidden = true;
      current = null;
    }
  });
  // Editing the form after a hold means a new order is needed.
  form.addEventListener('input', (e) => {
    const el = e.target as HTMLInputElement;
    if (el.id !== 'bk-pandal-search') current = null;
    // Clear this field's error as soon as it's edited.
    const name = el.name === 'pandal_ids' ? 'pandal_ids' : el.name;
    if (name) {
      document.getElementById(`err-${name}`)?.remove();
      (name === 'pandal_ids' ? $('bk-pandal-search') : el).removeAttribute('aria-invalid');
      if (!form.querySelector('.field-error')) setError('');
    }
  });
  $('bk-pandal-search').addEventListener('input', (e) => renderPandalPicks((e.target as HTMLInputElement).value));
  $('bk-pandals').addEventListener('change', enforcePandalLimit);
  ($('bk-logo') as HTMLInputElement).addEventListener('change', (e) => {
    const f = (e.target as HTMLInputElement).files?.[0];
    const img = $('bk-logo-preview') as HTMLImageElement;
    if (!f) return void (img.hidden = true);
    img.src = URL.createObjectURL(f);
    img.hidden = false;
  });
  $('bk-mock-pay').addEventListener('click', () => {
    if (!current) return;
    void verify({ razorpay_order_id: current.orderId, razorpay_payment_id: `pay_mock_${Date.now()}`, razorpay_signature: 'mock-ok' });
  });
  $('bk-mock-cancel').addEventListener('click', () => {
    showView('form');
    setError(t('bk.dismissed'));
  });
}
