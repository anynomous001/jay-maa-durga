/**
 * Price rules shared by the site (what people see) and the payments Worker
 * (what is charged). Price = base × tier multiplier, rounded to the rupee.
 * The tier is chosen by the booking's START date (IST, YYYY-MM-DD).
 */
import pricing from '../data/pricing.json';

export type SlotId = keyof typeof pricing.slots;

export interface Tier {
  id: string;
  label_en: string;
  label_bn: string;
  from: string;
  to: string;
  multiplier: number;
}

export const TIERS: Tier[] = pricing.tiers;
export const SLOT_IDS = Object.keys(pricing.slots) as SlotId[];
export const SEASON_END = pricing.seasonEnd;

/** The tier a booking starting on `startDate` falls into. Before Mahalaya → the first tier. */
export function tierFor(startDate: string): Tier {
  const first = TIERS[0];
  const last = TIERS[TIERS.length - 1];
  if (startDate < first.from) return first;
  return TIERS.find((t) => startDate >= t.from && startDate <= t.to) ?? last;
}

export const basePrice = (slot: SlotId) => pricing.slots[slot].base;

/** Rupees for a slot booked from `startDate`. */
export function priceFor(slot: SlotId, startDate: string): number {
  return Math.round(basePrice(slot) * tierFor(startDate).multiplier);
}

/** Whole days from `a` to `b`, inclusive (YYYY-MM-DD, IST calendar). */
export function daysIn(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000) + 1;
}

/** A tier's full price for a slot (what the table shows for the whole tier). */
export const tierPrice = (slot: SlotId, tier: Tier) => Math.round(basePrice(slot) * tier.multiplier);

export interface QuoteLine {
  tier: Tier;
  days: number; // days of the booking inside this tier
  tierDays: number; // total days in the tier
  amount: number; // rupees for those days
}
export interface Quote {
  days: number;
  total: number;
  lines: QuoteLine[];
}

/**
 * Price for any date range. Each tier is priced as a whole (see tierPrice), so a
 * booking covering a tier fully pays exactly its table price; covering part of
 * a tier pays that share of it. Days before Mahalaya count in the first tier.
 * Rounded to the rupee per tier.
 */
export function quote(slot: SlotId, start: string, end: string): Quote {
  const lines: QuoteLine[] = [];
  if (end < start) return { days: 0, total: 0, lines };
  TIERS.forEach((tier, i) => {
    const from = i === 0 && start < tier.from ? start : tier.from;
    const lo = start > from ? start : from;
    const hi = end < tier.to ? end : tier.to;
    if (hi < lo) return;
    const days = daysIn(lo, hi);
    const tierDays = daysIn(tier.from, tier.to);
    const amount = Math.round((tierPrice(slot, tier) * days) / tierDays);
    lines.push({ tier, days, tierDays, amount });
  });
  const total = lines.reduce((s, l) => s + l.amount, 0);
  return { days: daysIn(start, end), total, lines };
}
