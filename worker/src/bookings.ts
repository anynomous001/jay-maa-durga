/**
 * Sponsor bookings Durable Object (SQLite). One instance holds every booking,
 * so availability checks and holds are naturally serialised (no double-selling).
 *
 * Status flow:
 *   pending_payment (15-min hold) → paid → approved (live) | rejected (→ refunded)
 *   pending_payment whose hold lapsed without payment is ignored (treated as expired).
 */
import { DurableObject } from 'cloudflare:workers';
import pricing from '../../data/pricing.json';
import staticSponsors from '../../data/sponsors.json';
import type { Env } from './env';
import { istToday } from './http';

export type SlotId = keyof typeof pricing.slots;
export interface Range {
  start: string;
  end: string;
}
/** Inclusive YYYY-MM-DD ranges overlap? (string compare is safe for ISO dates) */
export const overlaps = (a: Range, b: Range) => a.start <= b.end && b.start <= a.end;
export type Status = 'pending_payment' | 'paid' | 'approved' | 'rejected' | 'refunded';

export interface BookingInput {
  slot: SlotId;
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
}

export interface Booking extends BookingInput {
  id: string;
  created_at: number;
  updated_at: number;
  status: Status;
  end_date: string;
  logo_key: string;
  amount: number;
  order_id: string;
  payment_id: string;
  hold_until: number;
  review_note: string;
  conflict: number;
}

const HOLD_MS = 15 * 60_000;
const COLS = [
  'id', 'created_at', 'updated_at', 'status', 'slot', 'start_date', 'end_date', 'pandal_ids',
  'business_name', 'business_name_bn', 'tagline', 'tagline_bn', 'description', 'website', 'whatsapp',
  'phone', 'email', 'contact_name', 'address', 'maps_url', 'logo_key', 'amount', 'order_id',
  'payment_id', 'hold_until', 'review_note', 'conflict',
] as const;

export class Bookings extends DurableObject<Env> {
  private sql: SqlStorage;
  /** ip → recent create timestamps (simple abuse guard). */
  private recent = new Map<string, number[]>();

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.sql = ctx.storage.sql;
    this.sql.exec(`CREATE TABLE IF NOT EXISTS bookings (
      id TEXT PRIMARY KEY, created_at INTEGER, updated_at INTEGER, status TEXT, slot TEXT,
      start_date TEXT, end_date TEXT, pandal_ids TEXT, business_name TEXT, business_name_bn TEXT,
      tagline TEXT, tagline_bn TEXT, description TEXT, website TEXT, whatsapp TEXT, phone TEXT,
      email TEXT, contact_name TEXT, address TEXT, maps_url TEXT, logo_key TEXT, amount INTEGER,
      order_id TEXT, payment_id TEXT, hold_until INTEGER, review_note TEXT, conflict INTEGER DEFAULT 0)`);
    this.sql.exec('CREATE INDEX IF NOT EXISTS idx_order ON bookings(order_id)');
  }

  private rows(where = '1=1', ...binds: unknown[]): Booking[] {
    return this.sql
      .exec(`SELECT * FROM bookings WHERE ${where} ORDER BY created_at DESC`, ...binds)
      .toArray()
      .map((r) => ({ ...(r as unknown as Booking), pandal_ids: JSON.parse((r.pandal_ids as string) || '[]') }));
  }

  /** Bookings that currently block their slot (paid, live, or an unexpired hold). */
  private occupying(now = Date.now()): Booking[] {
    return this.rows("status IN ('paid','approved') OR (status = 'pending_payment' AND hold_until > ?)", now);
  }

  /**
   * Booked date ranges per slot and per pandal (inclusive IST dates). The site
   * checks the advertiser's chosen dates against these, so a slot can be sold
   * for one stretch of the season and again for another.
   */
  availability(): { ranges: Record<string, Range[]>; pandalRanges: Record<string, Range[]> } {
    const today = istToday();
    const ranges: Record<string, Range[]> = Object.fromEntries(Object.keys(pricing.slots).map((s) => [s, []]));
    const pandalRanges: Record<string, Range[]> = {};
    // The house sponsors in data/sponsors.json count as booked too.
    const house = staticSponsors.sponsors as { active: boolean; endDate: string; startDate: string; slot: string; pandalIds: string[] }[];
    for (const s of house) {
      if (!s.active || s.endDate < today) continue;
      const r = { start: s.startDate, end: s.endDate };
      if (s.slot === 'pandal-nearby') s.pandalIds.forEach((p: string) => (pandalRanges[p] ??= []).push(r));
      else ranges[s.slot].push(r);
    }
    for (const b of this.occupying()) {
      const r = { start: b.start_date, end: b.end_date };
      if (b.slot === 'pandal-nearby') b.pandal_ids.forEach((p) => (pandalRanges[p] ??= []).push(r));
      else ranges[b.slot].push(r);
    }
    return { ranges, pandalRanges };
  }

  /** Reserve the slot for 15 minutes while the advertiser pays. */
  createHold(input: BookingInput, ip: string): { ok: true; id: string; amount: number } | { ok: false; error: string } {
    const now = Date.now();
    const recent = (this.recent.get(ip) ?? []).filter((t) => now - t < 3_600_000);
    if (recent.length >= 6) return { ok: false, error: 'rate_limited' };
    const { ranges, pandalRanges } = this.availability();
    const mine = { start: input.start_date, end: input.end_date };
    if (input.slot === 'pandal-nearby') {
      if (input.pandal_ids.some((p) => (pandalRanges[p] ?? []).some((r) => overlaps(r, mine)))) return { ok: false, error: 'pandal_taken' };
    } else if (ranges[input.slot].some((r) => overlaps(r, mine))) return { ok: false, error: 'slot_taken' };
    recent.push(now);
    this.recent.set(ip, recent);
    const id = crypto.randomUUID();
    const amount = pricing.slots[input.slot].price * 100; // paise
    const row: Booking = {
      ...input,
      id,
      created_at: now,
      updated_at: now,
      status: 'pending_payment',
      logo_key: '',
      amount,
      order_id: '',
      payment_id: '',
      hold_until: now + HOLD_MS,
      review_note: '',
      conflict: 0,
    };
    this.sql.exec(
      `INSERT INTO bookings (${COLS.join(',')}) VALUES (${COLS.map(() => '?').join(',')})`,
      ...COLS.map((c) => (c === 'pandal_ids' ? JSON.stringify(row.pandal_ids) : row[c])),
    );
    return { ok: true, id, amount };
  }

  setOrder(id: string, orderId: string, logoKey: string) {
    this.sql.exec('UPDATE bookings SET order_id = ?, logo_key = ?, updated_at = ? WHERE id = ?', orderId, logoKey, Date.now(), id);
  }

  /** Give the slot back (order creation failed). */
  release(id: string) {
    this.sql.exec("DELETE FROM bookings WHERE id = ? AND status = 'pending_payment'", id);
  }

  get(id: string): Booking | null {
    return this.rows('id = ?', id)[0] ?? null;
  }

  /** Mark paid (from checkout verification or the webhook). Idempotent. */
  markPaid(orderId: string, paymentId: string): Booking | null {
    const b = this.rows('order_id = ?', orderId)[0];
    if (!b) return null;
    if (b.status !== 'pending_payment') return b;
    // Paid after the hold lapsed and someone else took the slot? Flag it for a refund decision.
    const others = this.occupying().filter((o) => o.id !== b.id);
    const mine = { start: b.start_date, end: b.end_date };
    const clash =
      b.slot === 'pandal-nearby'
        ? others.some((o) => o.slot === 'pandal-nearby' && o.pandal_ids.some((p) => b.pandal_ids.includes(p)) && overlaps({ start: o.start_date, end: o.end_date }, mine))
        : others.some((o) => o.slot === b.slot && overlaps({ start: o.start_date, end: o.end_date }, mine));
    this.sql.exec(
      "UPDATE bookings SET status = 'paid', payment_id = ?, conflict = ?, updated_at = ? WHERE id = ?",
      paymentId,
      clash ? 1 : 0,
      Date.now(),
      b.id,
    );
    return this.get(b.id);
  }

  list(): Booking[] {
    // Hide abandoned checkouts older than a day from the admin list.
    return this.rows("status != 'pending_payment' OR created_at > ?", Date.now() - 86_400_000);
  }

  setStatus(id: string, status: Status, note = ''): Booking | null {
    this.sql.exec('UPDATE bookings SET status = ?, review_note = ?, updated_at = ? WHERE id = ?', status, note, Date.now(), id);
    return this.get(id);
  }

  /** Live sponsors: approved and within their dates. */
  live(): Booking[] {
    const today = istToday();
    return this.rows("status = 'approved' AND start_date <= ? AND end_date >= ?", today, today);
  }
}
