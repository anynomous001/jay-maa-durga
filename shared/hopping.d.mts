export interface Point {
  lat: number;
  lng: number;
}
export interface Station extends Point {
  id: string;
  name_en: string;
  name_bn: string;
  kind: 'metro' | 'rail';
  line?: string;
}
export interface StationHit {
  station: Station;
  km: number;
}
export interface Batch {
  /** Seed pandal id: stable while the data stays the same. */
  id: string;
  zone: string;
  /** Pandal ids in walking order. */
  stops: string[];
  /** Estimated walking distance (street-adjusted), km. */
  walkKm: number;
  /** Walking plus time at each pandal. */
  minutes: number;
  start: StationHit | null;
  end: StationHit | null;
}

export const METRO_WALK_KM: number;
export const STATION_MAX_KM: number;
export const BATCH_RADIUS_KM: number;
export const BATCH_MAX_HOP_KM: number;
export const BATCH_MIN: number;
export const BATCH_MAX: number;
export const STREET_FACTOR: number;
export const WALK_KMH: number;
export const MINUTES_PER_PANDAL: number;
export function distanceKm(a: Point, b: Point): number;
export function walkMinutes(km: number): number;
export function nearestStation(place: Point, stations: Station[]): StationHit | null;
export function makeBatches<P extends Point & { id: string; zone: string }>(pandals: P[], stations: Station[]): Batch[];
