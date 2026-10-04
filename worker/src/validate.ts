/** Server-side validation of the booking form. Never trust the browser. */
import pricing from '../../data/pricing.json';
import pandals from '../../data/pandals.json';
import type { BookingInput, SlotId } from './bookings';
import { istToday } from './http';

export type FieldErrors = Record<string, string>;
const PANDAL_IDS = new Set(pandals.pandals.map((p) => p.id));
const MAX_LOGO_BYTES = 300 * 1024;

const str = (fd: FormData, k: string) => String(fd.get(k) ?? '').trim();

function normaliseUrl(u: string): string | null {
  if (!u) return '';
  const withScheme = /^https?:\/\//i.test(u) ? u : `https://${u}`;
  try {
    const url = new URL(withScheme);
    if (!['http:', 'https:'].includes(url.protocol) || !url.hostname.includes('.')) return null;
    return url.toString();
  } catch {
    return null;
  }
}

/** Indian mobile (10 digits, optional +91/91/0) → "91XXXXXXXXXX". */
function normalisePhone(p: string): string | null {
  if (!p) return '';
  const d = p.replace(/\D/g, '').replace(/^0+/, '');
  if (/^[6-9]\d{9}$/.test(d)) return '91' + d;
  if (/^91[6-9]\d{9}$/.test(d)) return d;
  return null;
}

export function validateBooking(fd: FormData): { input?: BookingInput; errors: FieldErrors } {
  const e: FieldErrors = {};
  const slot = str(fd, 'slot') as SlotId;
  if (!(slot in pricing.slots)) e.slot = 'invalid';

  const len = (k: string, min: number, max: number, required = true) => {
    const v = str(fd, k);
    if (!v) {
      if (required) e[k] = 'required';
      return '';
    }
    if (v.length < min || v.length > max) e[k] = 'length';
    // No markup in anything we may display.
    if (/[<>]/.test(v)) e[k] = 'invalid';
    return v;
  };
  const business_name = len('business_name', 2, 60);
  const business_name_bn = len('business_name_bn', 1, 60, false);
  const tagline = len('tagline', 2, 80);
  const tagline_bn = len('tagline_bn', 1, 80, false);
  const description = len('description', 1, 400, false);
  const contact_name = len('contact_name', 2, 60);
  const address = len('address', 5, 200, false);

  const website = normaliseUrl(str(fd, 'website'));
  if (website === null) e.website = 'invalid';
  const maps = normaliseUrl(str(fd, 'maps_url'));
  if (maps === null || (maps && !/^https:\/\/(www\.)?(google\.[a-z.]+\/maps|maps\.google\.[a-z.]+|maps\.app\.goo\.gl|goo\.gl\/maps)/i.test(maps))) e.maps_url = 'invalid';
  const phone = normalisePhone(str(fd, 'phone'));
  if (!str(fd, 'phone')) e.phone = 'required';
  else if (phone === null) e.phone = 'invalid';
  const whatsapp = normalisePhone(str(fd, 'whatsapp'));
  if (whatsapp === null) e.whatsapp = 'invalid';
  const email = str(fd, 'email');
  if (email && (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || email.length > 120)) e.email = 'invalid';

  const today = istToday();
  const start_date = str(fd, 'start_date') || today;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start_date) || start_date < today || start_date > pricing.seasonEnd) e.start_date = 'invalid';

  let pandal_ids: string[] = [];
  if (slot === 'pandal-nearby') {
    pandal_ids = [...new Set(fd.getAll('pandal_ids').map(String))];
    const max = pricing.slots['pandal-nearby'].maxPandals ?? 3;
    if (!pandal_ids.length) e.pandal_ids = 'required';
    else if (pandal_ids.length > max || pandal_ids.some((p) => !PANDAL_IDS.has(p))) e.pandal_ids = 'invalid';
  }
  if (str(fd, 'consent') !== 'yes') e.consent = 'required';

  if (Object.keys(e).length) return { errors: e };
  return {
    errors: e,
    input: {
      slot, start_date, pandal_ids, business_name, business_name_bn, tagline, tagline_bn, description,
      website: website ?? '', whatsapp: whatsapp ?? '', phone: phone ?? '', email, contact_name, address, maps_url: maps ?? '',
    },
  };
}

/** Accept PNG / JPEG / WebP only (no SVG: it can carry scripts), checked by magic bytes. */
export async function checkLogo(file: File | null): Promise<{ ok: true; bytes?: Uint8Array; type?: string; ext?: string } | { ok: false; error: string }> {
  if (!file || file.size === 0) return { ok: true };
  if (file.size > MAX_LOGO_BYTES) return { ok: false, error: 'too_large' };
  const bytes = new Uint8Array(await file.arrayBuffer());
  const h = (i: number) => bytes[i];
  if (h(0) === 0x89 && h(1) === 0x50 && h(2) === 0x4e && h(3) === 0x47) return { ok: true, bytes, type: 'image/png', ext: 'png' };
  if (h(0) === 0xff && h(1) === 0xd8 && h(2) === 0xff) return { ok: true, bytes, type: 'image/jpeg', ext: 'jpg' };
  if (String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP')
    return { ok: true, bytes, type: 'image/webp', ext: 'webp' };
  return { ok: false, error: 'bad_type' };
}
