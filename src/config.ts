/**
 * Site-wide configuration. Everything Pritam may want to change lives here
 * (or in /data/*.json). All times are written with an explicit +05:30 offset
 * so they mean the same instant for every visitor, wherever they are.
 */
import pricing from '../data/pricing.json';

// ── Identity ────────────────────────────────────────────────────────────────
export const SITE_NAME = 'Ma Aschen';
export const SITE_NAME_BN = 'মা আসছেন';
export const SITE_TAGLINE_BN = 'ভোরের আগমনী';
export const SITE_TAGLINE_EN = 'The dawn’s welcome song';
/** Absolute production URL (used in share text, .ics, OG tags, sitemap). */
export const SITE_URL = 'https://maa-aschen-nine.vercel.app';

// ── Contact & payments ──────────────────────────────────────────────────────
/** WhatsApp number in international format without "+" or spaces. */
export const WHATSAPP_NUMBER = '919874353532';

/**
 * Who runs the site — shown on /policies/ (Razorpay checks these pages before
 * activating live payments). PLACEHOLDERS: fill in before going live.
 */
export const OPERATOR = {
  legalName: 'Pritam Chakroborty',
  address: 'Mayapally, Ichapur, North 24 Parganas, West Bengal 743144',
  email: 'chakrobortypritam.work@gmail.com',
  phone: '+91 98743 53532',
};

/**
 * Prices live in data/pricing.json so the payments Worker charges exactly what
 * the site shows. Payments go through Razorpay via the Worker in /worker.
 */
export const PRICING = pricing;
/** While true, prices show a "TBD" marker in the booking form. */
export const PRICES_TBD = pricing.tbd;

// ── Key instants (Asia/Kolkata) ─────────────────────────────────────────────
/** Official AIR schedule: transmission 03:50–05:45 IST; recitation from ~04:00. */
export const MAHALAYA_TRANSMISSION_START = '2026-10-10T03:50:00+05:30';
export const MAHALAYA_BROADCAST_START = '2026-10-10T04:00:00+05:30';
export const MAHALAYA_BROADCAST_END = '2026-10-10T05:45:00+05:30';
/** When the "Wake me" toggle starts the stream. Transmission begins 03:50. */
export const AUTO_START_AT = MAHALAYA_TRANSMISSION_START;
/** Reminder event start (calendar / .ics). */
export const REMINDER_AT = '2026-10-10T03:50:00+05:30';

export interface PujaDay {
  id: string;
  name_bn: string;
  name_en: string;
  /** IST calendar dates (YYYY-MM-DD) this observance covers. */
  dates: string[];
}

/**
 * Puja days per Bisuddha Siddhanta panjika as reported for 2026
 * (Saptami tithi spans 17–18 Oct). Gupta Press / Benimadhab Sheel panjika
 * differs from Ashtami onwards — see README "Dates".
 */
export const PUJA_DAYS: PujaDay[] = [
  { id: 'mahalaya', name_bn: 'মহালয়া', name_en: 'Mahalaya', dates: ['2026-10-10'] },
  { id: 'shashthi', name_bn: 'মহাষষ্ঠী', name_en: 'Maha Shashthi', dates: ['2026-10-16'] },
  { id: 'saptami', name_bn: 'মহাসপ্তমী', name_en: 'Maha Saptami', dates: ['2026-10-17', '2026-10-18'] },
  { id: 'ashtami', name_bn: 'মহাষ্টমী', name_en: 'Maha Ashtami', dates: ['2026-10-19'] },
  { id: 'nabami', name_bn: 'মহানবমী', name_en: 'Maha Nabami', dates: ['2026-10-20'] },
  { id: 'dashami', name_bn: 'বিজয়া দশমী', name_en: 'Bijoya Dashami', dates: ['2026-10-21'] },
];
export const SHASHTHI_START = '2026-10-16T00:00:00+05:30';
export const DASHAMI_END = '2026-10-22T00:00:00+05:30';
/** Sponsor slots run through Bijoya Dashami. */
export const SPONSOR_SEASON_END = pricing.seasonEnd;

// ── Radio ───────────────────────────────────────────────────────────────────
export interface RadioChannel {
  id: string;
  name_bn: string;
  name_en: string;
  /** Short caption under the channel icon. */
  short_bn: string;
  short_en: string;
  icon: 'tower' | 'rainbow';
  /** Official Prasar Bharati HLS URL (from akashvani.gov.in/radio/live.php). */
  url: string;
}
export const RADIO_CHANNELS: RadioChannel[] = [
  {
    id: 'kolkata-a',
    name_bn: 'আকাশবাণী কলকাতা ক (গীতাঞ্জলি)',
    name_en: 'Akashvani Kolkata A (Geetanjali)',
    short_bn: 'কলকাতা ক',
    short_en: 'Kolkata A',
    icon: 'tower',
    url: 'https://airhlspush.pc.cdn.bitgravity.com/httppush/hlspbaudio055/hlspbaudio055_Auto.m3u8',
  },
  {
    id: 'fm-rainbow',
    name_bn: 'এফএম রেনবো কলকাতা',
    name_en: 'FM Rainbow Kolkata',
    short_bn: 'রেনবো',
    short_en: 'Rainbow',
    icon: 'rainbow',
    url: 'https://airhlspush.pc.cdn.bitgravity.com/httppush/hlspbaudio058/hlspbaudio058_Auto.m3u8',
  },
];
export const OFFICIAL_PLAYER_URL = 'https://akashvani.gov.in/radio/live.php';
export const NEWSONAIR_APP_URL = 'https://play.google.com/store/apps/details?id=com.parsarbharti.airnews';
export const NEWSONAIR_APP_URL_IOS = 'https://apps.apple.com/in/app/newsonair/id1450030867';
export const MEDIA_SESSION_TITLE = 'Mahishasuramardini — Live';

// ── Map ─────────────────────────────────────────────────────────────────────
/** Swap for a commercial / free-tier tile provider if traffic grows. */
export const MAP_TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
export const MAP_TILE_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
export const MAP_TILE_MAX_ZOOM = 19;

// ── Analytics ───────────────────────────────────────────────────────────────
/** Cloudflare Web Analytics — set enabled:true and paste the token at deploy. */
export const ANALYTICS = { enabled: false, cloudflareToken: '' };

/**
 * The site's small API (Cloudflare Worker in /worker): visitor counter, sponsor
 * bookings + Razorpay payments, and approved sponsors. Empty = those features
 * hide gracefully. Set VITE_API_URL at build time (Cloudflare Pages env var),
 * e.g. https://mahalaya-api.<you>.workers.dev
 */
export const API_URL: string = (import.meta.env.VITE_API_URL ?? import.meta.env.VITE_COUNTER_URL ?? '').replace(/\/$/, '');
