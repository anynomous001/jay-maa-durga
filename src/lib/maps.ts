/** Google Maps URL helpers (no API key) and distance maths. */

export type TravelMode = 'walking' | 'driving' | 'transit';

export interface LatLng {
  lat: number;
  lng: number;
}

const ll = (p: LatLng) => `${p.lat},${p.lng}`;

/** Opens Google Maps navigation from the user's current location (Google picks the mode when none is given). */
export function directionsUrl(dest: LatLng, mode?: TravelMode): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${ll(dest)}${mode ? `&travelmode=${mode}` : ''}`;
}

/** Google Maps allows only 3 waypoints on mobile, so a leg holds at most 5 stops. */
export const MAX_STOPS_PER_LEG = 5;

/** Split a route into evenly sized legs of ≤5 stops; each leg starts where the previous ended. */
export function routeLegs<T>(stops: T[]): T[][] {
  const hops = stops.length - 1;
  const count = Math.max(1, Math.ceil(hops / (MAX_STOPS_PER_LEG - 1)));
  const per = Math.ceil(hops / count);
  const legs: T[][] = [];
  for (let i = 0; i < hops; i += per) legs.push(stops.slice(i, i + per + 1));
  return legs;
}

export function routeUrl(stops: LatLng[], mode: TravelMode): string {
  const origin = stops[0];
  const dest = stops[stops.length - 1];
  const mid = stops.slice(1, -1).map(ll).join('|');
  let url = `https://www.google.com/maps/dir/?api=1&origin=${ll(origin)}&destination=${ll(dest)}&travelmode=${mode}`;
  if (mid) url += `&waypoints=${encodeURIComponent(mid)}`;
  return url;
}

/** Great-circle distance in km. */
export function distanceKm(a: LatLng, b: LatLng): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
