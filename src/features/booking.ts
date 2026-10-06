/**
 * Sponsor booking: form sheet → API creates a 15-minute hold + a payment with
 * the chosen provider →
 *   Razorpay: Checkout popup (UPI / cards / netbanking / wallets) → API verifies
 *             the signature → "paid, waiting for review".
 *   Dodo:     redirect to Dodo's hosted checkout → back to this page with
 *             ?booking=<id> → poll until Dodo's webhook has marked it paid.
 * Prices are charged by the server from data/pricing.json; the browser never
 * decides the amount.
 */
import pandalData from '../../data/pandals.json';
import { API_URL, PRICING, SITE_NAME, WHATSAPP_NUMBER } from '../config';
import { getLang, num, t } from '../lib/i18n';
import type { SlotId } from '../lib/sponsors';
import { quote, TIERS } from '../../shared/pricing';
import { istDateKey, now } from '../lib/time';

type FieldErrors = Record<string, string>;

type Provider = 'razorpay' | 'dodo';
interface Created {
  id: string;
  provider?: Provider;
  /** Dodo hosted checkout (provider 'dodo' only). */
  checkoutUrl?: string;
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
/** Price for this slot from the chosen start date (tiers in data/pricing.json). */
const dateRange = () => ({
  start: ($('bk-start') as HTMLInputElement).value || istDateKey(now()),
  end: ($('bk-end') as HTMLInputElement).value || PRICING.seasonEnd,
});
/** Full quote for the chosen slot and dates (same rules the Worker charges). */
const quoteFor = (slot: SlotId, r = dateRange()) => quote(slot, r.start, r.end);
const priceText = (slot: SlotId, r?: { start: string; end: string }) => `₹${num(quoteFor(slot, r).total)}`;

const MAX_PANDALS = PRICING.slots['pandal-nearby'].maxPandals ?? 3;

let sheet: HTMLDialogElement;
let form: HTMLFormElement;
let current: Created | null = null;
let currentBusiness = '';
/** Booked date ranges from the server (inclusive IST dates). */
interface Range {
  start: string;
  end: string;
  held?: boolean;
  until?: number;
}
interface Availability {
  ranges: Record<string, Range[]>;
  pandalRanges: Record<string, Range[]>;
}
let avail: Availability | null = null;
let openSlot: SlotId = 'spotlight';
const overlaps = (a: Range, b: Range) => a.start <= b.end && b.start <= a.end;
/** Chosen dates, read from the form. */
const chosen = (): Range => ({
  start: ($('bk-start') as HTMLInputElement).value,
  end: ($('bk-end') as HTMLInputElement).value,
});
const busy = (ranges: Range[] = []) => ranges.filter((r) => overlaps(r, chosen()));
const fmtDay = (iso: string) => new Date(`${iso}T12:00:00+05:30`).toLocaleDateString(getLang() === 'bn' ? 'bn-IN' : 'en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short' });
const fmtRange = (r: Range) => (r.start === r.end ? fmtDay(r.start) : `${fmtDay(r.start)} – ${fmtDay(r.end)}`);

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

function showView(view: 'form' | 'mock' | 'wait' | 'done') {
  form.hidden = view !== 'form';
  $('bk-mock').hidden = view !== 'mock';
  $('bk-wait').hidden = view !== 'wait';
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
    const taken = busy(avail?.pandalRanges[p.id]).length > 0;
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
    if (!b.checked && busy(avail?.pandalRanges[b.value]).length === 0) b.disabled = n >= MAX_PANDALS;
  });
}

/** Online payment is on only when the server reports a provider is configured. */
let paymentsOn = false;

const chosenProvider = (): Provider => (form.querySelector<HTMLInputElement>('input[name="provider"]:checked')?.value as Provider) ?? 'razorpay';

/** Show the provider choice only when both are on; copy follows the choice. */
function renderProviders(list: Provider[]) {
  const field = $('bk-provider-field');
  field.hidden = list.length < 2;
  for (const r of form.querySelectorAll<HTMLInputElement>('input[name="provider"]')) {
    r.disabled = !list.includes(r.value as Provider);
    r.closest('label')!.hidden = r.disabled;
  }
  const first = form.querySelector<HTMLInputElement>('input[name="provider"]:not(:disabled)');
  if (first && !form.querySelector<HTMLInputElement>('input[name="provider"]:checked:not(:disabled)')) first.checked = true;
  renderProviderCopy();
}

function renderProviderCopy() {
  const dodo = chosenProvider() === 'dodo';
  // Swap the i18n key too, so a language switch keeps the right copy.
  for (const [id, key] of [['bk-step2', dodo ? 'bk.step2.dodo' : 'bk.step2'], ['bk-secure', dodo ? 'bk.secure.dodo' : 'bk.secure']]) {
    $(id).dataset.i18n = key;
    $(id).textContent = t(key);
  }
}

export function openBooking(
  slot: SlotId,
  data: Availability | null,
  opts: { preselectPandal?: string; paymentsOn?: boolean; providers?: Provider[] } = {},
) {
  paymentsOn = Boolean(opts.paymentsOn);
  renderProviders(opts.providers ?? (paymentsOn ? ['razorpay'] : []));
  avail = data;
  openSlot = slot;
  current = null;
  showView('form');
  setError('');
  clearFieldErrors();
  ($('bk-slot') as HTMLInputElement).value = slot;
  $('bk-summary').innerHTML = `<strong></strong><span></span>`;
  $('bk-summary').querySelector('strong')!.textContent = t(`slot.${slot}`);
  renderQuote(slot);
  $('bk-pandals-field').hidden = slot !== 'pandal-nearby';
  if (slot === 'pandal-nearby') {
    // Coming from a pandal card: start with that pandal ticked.
    $('bk-pandals').innerHTML = '';
    renderPandalPicks();
    const pre = opts.preselectPandal && $('bk-pandals').querySelector<HTMLInputElement>(`input[value="${CSS.escape(opts.preselectPandal)}"]`);
    if (pre && !pre.disabled) {
      pre.checked = true;
      enforcePandalLimit();
    }
  }
  const start = $('bk-start') as HTMLInputElement;
  const end = $('bk-end') as HTMLInputElement;
  start.min = istDateKey(now());
  start.max = PRICING.seasonEnd;
  if (!start.value || start.value < start.min) start.value = start.min;
  end.min = start.value;
  end.max = PRICING.seasonEnd;
  if (!end.value || end.value < start.value) end.value = PRICING.seasonEnd;
  renderQuick();
  checkDates();
  sheet.showModal();
  window.dispatchEvent(new CustomEvent('sheet:open'));
}

const tierName = (tier: { label_en: string; label_bn: string }) => (getLang() === 'bn' ? tier.label_bn : tier.label_en);
/** Plain-text breakdown lines (also used in the WhatsApp request). */
function quoteLines(slot: SlotId): string[] {
  const q = quoteFor(slot);
  return [...q.lines.map((l) => `${tierName(l.tier)}: ${l.days}/${l.tierDays} ${t('bk.days')} = ₹${num(l.amount)}`), `${t('bk.total')}: ₹${num(q.total)} (${q.days} ${t('bk.days')})`];
}

/** Breakdown in the sheet: one row per tier the dates touch, then the total. */
function renderQuote(slot: SlotId) {
  const q = quoteFor(slot);
  const box = $('bk-quote');
  box.innerHTML = '';
  if (!q.lines.length) {
    box.textContent = t('bk.pickDates');
    return;
  }
  const table = document.createElement('table');
  table.className = 'quote';
  const row = (cells: string[], cls = '') => {
    const tr = document.createElement('tr');
    if (cls) tr.className = cls;
    for (const c of cells) {
      const td = document.createElement('td');
      td.textContent = c;
      tr.appendChild(td);
    }
    table.appendChild(tr);
  };
  for (const l of q.lines) row([tierName(l.tier), `${l.days}/${l.tierDays} ${t('bk.days')}`, `₹${num(l.amount)}`]);
  row([t('bk.total'), `${q.days} ${t('bk.days')}`, `₹${num(q.total)}`], 'q-total');
  box.appendChild(table);
}

/** One-tap date choices: whole puja, or any single tier. */
function renderQuick() {
  const box = $('bk-quick');
  box.innerHTML = '';
  const add = (label: string, start: string, end: string) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'chip-btn';
    b.textContent = label;
    b.addEventListener('click', () => {
      ($('bk-start') as HTMLInputElement).value = start;
      ($('bk-end') as HTMLInputElement).value = end;
      checkDates();
    });
    box.appendChild(b);
  };
  add(t('bk.wholePuja'), TIERS[0].from, PRICING.seasonEnd);
  for (const tier of TIERS) add(tierName(tier), tier.from, tier.to);
}

/**
 * Compare the chosen dates with the bookings already on them. Shows which
 * dates are taken, and blocks submitting until the advertiser picks free dates.
 */
export function checkDates() {
  const submit = $('bk-submit') as HTMLButtonElement;
  const hint = $('bk-taken');
  // Price follows the chosen start date: refresh the summary and the pay button.
  const slotNow = openSlot;
  renderQuote(slotNow);
  submit.textContent = paymentsOn ? t('bk.pay', { price: priceText(slotNow) }) : t('bk.sendWa');
  const start = $('bk-start') as HTMLInputElement;
  const end = $('bk-end') as HTMLInputElement;
  end.min = start.value;
  const slotBusy = busy(avail?.ranges[openSlot]);
  const pandalConflict = openSlot === 'pandal-nearby' && [...$('bk-pandals').querySelectorAll<HTMLInputElement>('input:checked')].some((i) => busy(avail?.pandalRanges[i.value]).length);
  // Slots with no overlap stay bookable; pandal picks are re-checked on every change.
  renderPandalPicks(($('bk-pandal-search') as HTMLInputElement).value);
  const blocked = (openSlot !== 'pandal-nearby' && slotBusy.length > 0) || pandalConflict;
  submit.disabled = blocked || !start.value || !end.value || end.value < start.value;
  if (blocked) {
    const list = openSlot === 'pandal-nearby' ? [] : slotBusy;
    hint.hidden = false;
    const onlyHeld = list.length > 0 && list.every((r) => r.held);
    const mins = list.reduce((m, r) => (r.until ? Math.max(m, Math.ceil((r.until - Date.now()) / 60000)) : m), 0);
    hint.textContent = list.length
      ? onlyHeld
        ? `${t('bk.reservedDates')} ${fmtRange(list[0])} — ${t('bk.tryAgain', { n: mins })}`
        : `${t('bk.takenDates')}: ${list.map(fmtRange).join(', ')}`
      : t('bk.pandalTakenDates');
  } else {
    hint.hidden = true;
    hint.textContent = '';
  }
  // Show the already-booked dates so advertisers can pick around them.
  const booked = (openSlot === 'pandal-nearby' ? [] : [...(avail?.ranges[openSlot] ?? [])].sort((x, y) => x.start.localeCompare(y.start)));
  $('bk-booked').textContent = booked.length ? `${t('bk.bookedDates')}: ${booked.map((r) => fmtRange(r) + (r.held ? ` (${t('bk.reserved')})` : '')).join(', ')}` : '';
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

function showDone(id = current?.id) {
  if (!id) return;
  $('bk-ref').textContent = id;
  ($('bk-done-wa') as HTMLAnchorElement).href = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(
    t('bk.doneWaText', { site: SITE_NAME, ref: id, business: currentBusiness }),
  )}`;
  showView('done');
  window.dispatchEvent(new CustomEvent('booking:paid'));
}

async function openCheckout() {
  if (!current) return;
  if (current.provider === 'dodo' && current.checkoutUrl) {
    // Remember the business name for the "done" screen after Dodo sends them back.
    try {
      sessionStorage.setItem(`bk:${current.id}`, currentBusiness);
    } catch {
      /* private mode: the done screen just omits the name */
    }
    window.location.assign(current.checkoutUrl);
    return;
  }
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

/**
 * Online payment isn't switched on yet: validate the form the same way, then
 * send every detail to WhatsApp as one message so nothing is lost.
 */
function sendRequestOnWhatsApp(fd: FormData) {
  const e: FieldErrors = {};
  for (const k of ['business_name', 'tagline', 'contact_name', 'phone']) if (!String(fd.get(k) ?? '').trim()) e[k] = 'required';
  if (String(fd.get('consent') ?? '') !== 'yes') e.consent = 'required';
  if (Object.keys(e).length) {
    showFieldErrors(e);
    setError(t('bk.err.form'));
    return;
  }
  const slot = String(fd.get('slot') ?? '') as SlotId;
  const lines = [
    `${t('bk.waHead', { site: SITE_NAME })} — ${t(`slot.${slot}`)} (${priceText(slot)})`,
    ...quoteLines(slot),
    `Business: ${fd.get('business_name')}${fd.get('business_name_bn') ? ` / ${fd.get('business_name_bn')}` : ''}`,
    `Tagline: ${fd.get('tagline')}${fd.get('tagline_bn') ? ` / ${fd.get('tagline_bn')}` : ''}`,
    fd.get('description') && `About: ${fd.get('description')}`,
    fd.get('website') && `Web: ${fd.get('website')}`,
    fd.get('address') && `Address: ${fd.get('address')}`,
    fd.get('maps_url') && `Map: ${fd.get('maps_url')}`,
    fd.getAll('pandal_ids').length && `Pandals: ${fd.getAll('pandal_ids').join(', ')}`,
    `Contact: ${fd.get('contact_name')} · ${fd.get('phone')}${fd.get('whatsapp') ? ` · WA ${fd.get('whatsapp')}` : ''}`,
    fd.get('email') && `Email: ${fd.get('email')}`,
    `Dates: ${fd.get('start_date') ?? ''} to ${fd.get('end_date') ?? ''}`,
    fd.get('logo') instanceof File && (fd.get('logo') as File).size ? '(logo: I will send it here)' : '',
  ].filter(Boolean) as string[];
  window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(lines.join('\n'))}`, '_blank', 'noopener');
  setError('');
  $('bk-error').hidden = false;
  $('bk-error').textContent = t('bk.waSent');
  ($('bk-error') as HTMLElement).style.borderColor = 'rgba(127, 209, 168, 0.6)';
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
  if (!paymentsOn || !API_URL) return sendRequestOnWhatsApp(fd);
  fd.set('return_url', `${location.origin}${location.pathname}`);
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
    if (body.provider === 'dodo') return; // leaving the page
    // Checkout is open: let the advertiser press Pay again if they close it.
    submitBtn.disabled = false;
    submitBtn.textContent = t('bk.pay', { price: priceText(fd.get('slot') as SlotId) });
  } catch {
    submitBtn.disabled = false;
    submitBtn.textContent = t('bk.pay', { price: priceText(fd.get('slot') as SlotId) });
    setError(t('bk.err.generic'));
  }
}

let initialised = false;

export function initBooking() {
  if (initialised) return;
  initialised = true;
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
    if (el.name === 'start_date' || el.name === 'end_date' || el.name === 'pandal_ids') checkDates();
    if (el.name === 'provider') renderProviderCopy();
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
  $('bk-pandals').addEventListener('change', () => {
    enforcePandalLimit();
    checkDates();
  });
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

/**
 * Back from Dodo's hosted checkout (?booking=<id>): open the sheet and wait for
 * Dodo's webhook to mark the booking paid. The redirect itself proves nothing.
 */
export async function resumeDodoReturn(id: string, status: string | null) {
  try {
    currentBusiness = sessionStorage.getItem(`bk:${id}`) ?? '';
  } catch {
    currentBusiness = '';
  }
  current = null;
  setError('');
  $('bk-wait-text').textContent = t('bk.confirming');
  $('bk-wait-ref').textContent = id;
  showView('wait');
  sheet.showModal();
  window.dispatchEvent(new CustomEvent('sheet:open'));
  if (status === 'failed' || status === 'cancelled') {
    $('bk-wait-text').textContent = t('bk.dodoFailed');
    return;
  }
  for (let i = 0; i < 30; i++) {
    try {
      const r = await fetch(`${API_URL}/bookings/${id}`, { cache: 'no-store' });
      if (r.status === 404) break; // unknown or stale booking id: no point waiting
      const b = (await r.json()) as { status?: string };
      if (b.status === 'paid' || b.status === 'approved') return showDone(id);
    } catch {
      /* keep trying */
    }
    await new Promise((res) => setTimeout(res, 2000));
  }
  $('bk-wait-text').textContent = t('bk.err.verify');
}
