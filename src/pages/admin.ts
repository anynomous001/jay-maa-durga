/** Private review page for sponsor bookings (talks to the Worker's /admin API). */
import '../styles.css';
import { API_URL } from '../config';

interface Booking {
  id: string;
  created_at: number;
  status: 'pending_payment' | 'paid' | 'approved' | 'rejected' | 'refunded';
  slot: string;
  start_date: string;
  end_date: string;
  pandal_ids: string[];
  business_name: string;
  business_name_bn: string;
  tagline: string;
  tagline_bn: string;
  description: string;
  website: string;
  whatsapp: string;
  phone: string;
  email: string;
  contact_name: string;
  address: string;
  maps_url: string;
  logo_url: string;
  amount: number;
  order_id: string;
  payment_id: string;
  hold_until: number;
  review_note: string;
  conflict: number;
}

const TOKEN_KEY = 'admin-token';
const FILTERS: [string, string, (b: Booking) => boolean][] = [
  ['review', 'Needs review', (b) => b.status === 'paid'],
  ['live', 'Live', (b) => b.status === 'approved'],
  ['closed', 'Rejected / refunded', (b) => b.status === 'rejected' || b.status === 'refunded'],
  ['pending', 'Unpaid (checkout open)', (b) => b.status === 'pending_payment'],
  ['all', 'All', () => true],
];
let filter = 'review';
let all: Booking[] = [];
const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const token = () => sessionStorage.getItem(TOKEN_KEY) ?? '';
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const when = (ms: number) => new Date(ms).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' });

async function api(path: string, init: RequestInit = {}) {
  const r = await fetch(`${API_URL}${path}`, { ...init, headers: { ...(init.headers ?? {}), Authorization: `Bearer ${token()}` } });
  if (r.status === 401) {
    sessionStorage.removeItem(TOKEN_KEY);
    showLogin('Wrong token.');
    throw new Error('unauthorised');
  }
  return r.json();
}

function showLogin(msg = '') {
  $('admin-login').hidden = false;
  $('admin-app').hidden = true;
  if (msg) $('admin-status').textContent = msg;
}

async function load(message = '') {
  $('admin-status').textContent = 'Loading…';
  const data = (await api('/admin/bookings')) as { bookings: Booking[]; mock: boolean };
  all = data.bookings;
  $('admin-mock').hidden = !data.mock;
  $('admin-login').hidden = true;
  $('admin-app').hidden = false;
  render();
  if (message) $('admin-status').textContent = message;
}

function renderFilters() {
  const box = $('admin-filters');
  box.innerHTML = '';
  for (const [id, label, fn] of FILTERS) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'chip-btn';
    b.textContent = `${label} (${all.filter(fn).length})`;
    b.setAttribute('aria-pressed', String(filter === id));
    b.addEventListener('click', () => {
      filter = id;
      render();
    });
    box.appendChild(b);
  }
}

function row(label: string, value: string, link = false) {
  if (!value) return '';
  const v = link ? `<a href="${esc(value)}" target="_blank" rel="noopener noreferrer">${esc(value)}</a>` : esc(value);
  return `<div><dt>${label}</dt><dd>${v}</dd></div>`;
}

function render() {
  renderFilters();
  const fn = FILTERS.find((f) => f[0] === filter)![2];
  const list = all.filter(fn);
  $('admin-status').textContent = list.length ? '' : 'Nothing here.';
  $('admin-list').innerHTML = list
    .map(
      (b) => `<article class="admin-card glass-card" data-id="${b.id}">
      <header>
        ${b.logo_url ? `<img src="${esc(b.logo_url)}" alt="Logo" width="64" height="64" />` : '<div class="admin-nologo">No logo</div>'}
        <div>
          <h2>${esc(b.business_name)}${b.business_name_bn ? ` <span lang="bn">· ${esc(b.business_name_bn)}</span>` : ''}</h2>
          <p>${esc(b.tagline)}${b.tagline_bn ? ` · <span lang="bn">${esc(b.tagline_bn)}</span>` : ''}</p>
          <p class="admin-meta"><span class="admin-status s-${b.status}">${b.status.replace('_', ' ')}</span> ${esc(b.slot)} · ₹${b.amount / 100} · ${when(b.created_at)}</p>
          ${b.conflict ? '<p class="admin-warn">⚠ Paid after the hold expired and the slot was taken by someone else — reject with refund, or move them to another slot.</p>' : ''}
        </div>
      </header>
      <dl>
        ${row('About', b.description)}
        ${row('Website', b.website, true)}
        ${row('Address', b.address)}
        ${row('Map', b.maps_url, true)}
        ${row('Pandals', b.pandal_ids.join(', '))}
        ${row('Runs', `${b.start_date} → ${b.end_date}`)}
        ${row('Contact', `${b.contact_name} · +${b.phone}${b.whatsapp ? ` · WA +${b.whatsapp}` : ''}${b.email ? ` · ${b.email}` : ''}`)}
        ${row('Payment', `${b.order_id}${b.payment_id ? ` / ${b.payment_id}` : ''}`)}
        ${row('Note', b.review_note)}
      </dl>
      <div class="admin-actions">
        ${b.status === 'paid' ? '<button class="btn" data-act="approve">Approve — go live</button>' : ''}
        ${b.status === 'paid' || b.status === 'approved' ? `<input class="input" data-note placeholder="Reason (sent to advertiser)" maxlength="300" /><label class="admin-refund"><input type="checkbox" data-refund checked /> Refund ₹${b.amount / 100}</label><button class="btn btn-ghost" data-act="reject">${b.status === 'approved' ? 'Take down' : 'Reject'}</button>` : ''}
        ${b.whatsapp || b.phone ? `<a class="btn btn-wa btn-sm" target="_blank" rel="noopener" href="https://wa.me/${b.whatsapp || b.phone}">WhatsApp them</a>` : ''}
      </div>
    </article>`,
    )
    .join('');
}

$('admin-list').addEventListener('click', async (e) => {
  const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-act]');
  if (!btn) return;
  const card = btn.closest<HTMLElement>('.admin-card')!;
  const id = card.dataset.id!;
  const act = btn.dataset.act!;
  btn.disabled = true;
  try {
    const body =
      act === 'reject'
        ? JSON.stringify({ note: card.querySelector<HTMLInputElement>('[data-note]')?.value ?? '', refund: card.querySelector<HTMLInputElement>('[data-refund]')?.checked ?? false })
        : undefined;
    const res = (await api(`/admin/bookings/${id}/${act}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body })) as {
      error?: string;
      booking?: { provider?: string };
      refund?: { ok: boolean; detail: string };
    };
    let message: string;
    if (res.error) message = `Error: ${res.error}`;
    else if (res.refund && !res.refund.ok && res.refund.detail !== 'not requested')
      message = `Rejected, but the refund failed: ${res.refund.detail}. Refund it from the ${res.booking?.provider === 'dodo' ? 'Dodo Payments' : 'Razorpay'} dashboard.`;
    else if (act === 'approve') message = 'Approved — the ad appears on the site within about 30 seconds.';
    else message = res.refund?.ok ? 'Rejected and refund requested.' : 'Rejected.';
    await load(message);
  } catch {
    btn.disabled = false;
  }
});

$('admin-login').addEventListener('submit', (e) => {
  e.preventDefault();
  sessionStorage.setItem(TOKEN_KEY, ($('admin-token') as HTMLInputElement).value.trim());
  void load().catch(() => {});
});
$('admin-refresh').addEventListener('click', () => void load().catch(() => {}));
$('admin-logout').addEventListener('click', () => {
  sessionStorage.removeItem(TOKEN_KEY);
  showLogin();
});

if (!API_URL) showLogin('No API configured (set VITE_API_URL).');
else if (token()) void load().catch(() => {});
