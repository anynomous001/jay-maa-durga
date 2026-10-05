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
