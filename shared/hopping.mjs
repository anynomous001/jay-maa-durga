/**
 * Pandal-hopping maths shared by the home page (src/features/finder.ts) and the build-time pandal pages
 * (scripts/static-pages.mjs): the nearest metro or train station, and "batches" of pandals close enough to see
 * together on foot. Plain JS so the Node build script can import it; types in hopping.d.mts.
 */

/** Use the metro when one is this close; otherwise the nearest station of any kind. */
export const METRO_WALK_KM = 1.5;
/** Beyond this no station is shown (a far station would mislead more than help). */
export const STATION_MAX_KM = 12;
/** Batch members lie within this distance of the batch's centre pandal… */
export const BATCH_RADIUS_KM = 1.2;
/** …and no single walk between two stops is longer than this. */
export const BATCH_MAX_HOP_KM = 1.1;
export const BATCH_MIN = 4;
export const BATCH_MAX = 7;
/** Streets wind: walking distance ≈ straight line × this. */
export const STREET_FACTOR = 1.3;
export const WALK_KMH = 4.5;
export const MINUTES_PER_PANDAL = 15;

export function distanceKm(a, b) {
  const r = (d) => (d * Math.PI) / 180;
  const h = Math.sin(r(b.lat - a.lat) / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(r(b.lng - a.lng) / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
}

/** Minutes on foot for a straight-line distance. */
export const walkMinutes = (km) => Math.max(1, Math.round(((km * STREET_FACTOR) / WALK_KMH) * 60));

/** The station to name for a place: a metro within walking distance, else the nearest metro or train station. */
export function nearestStation(place, stations) {
  let metro = null;
  let any = null;
  for (const s of stations) {
    const d = distanceKm(place, s);
    if (s.kind === 'metro' && (!metro || d < metro.km)) metro = { station: s, km: d };
    if (!any || d < any.km) any = { station: s, km: d };
  }
  if (metro && metro.km <= METRO_WALK_KM) return metro;
  return any && any.km <= STATION_MAX_KM ? any : null;
}

/** Visit order: start at `first`, then always the nearest stop not yet visited. */
function walkOrder(first, rest) {
  const left = [...rest];
  const order = [first];
  while (left.length) {
    const at = order[order.length - 1];
    let best = 0;
    for (let i = 1; i < left.length; i++) if (distanceKm(at, left[i]) < distanceKm(at, left[best])) best = i;
    order.push(left.splice(best, 1)[0]);
  }
  return order;
}

/**
 * Groups of 4–7 pandals close to one another, each in walking order from the stop nearest a station.
 * Each pandal is in at most one batch; pandals with too few close neighbours get none.
 * Deterministic for the same data, so batch ids stay stable between builds.
 */
export function makeBatches(pandals, stations) {
  const free = new Set(pandals.map((p) => p.id));
  const tried = new Set();
  const around = (p) =>
    pandals
      .filter((q) => q.id !== p.id && free.has(q.id) && distanceKm(p, q) <= BATCH_RADIUS_KM)
      .sort((a, b) => distanceKm(p, a) - distanceKm(p, b));
  const batches = [];
  for (;;) {
    // The densest free spot seeds the next batch.
    let seed = null;
    let seedNear = [];
    for (const p of pandals) {
      if (!free.has(p.id) || tried.has(p.id)) continue;
      const near = around(p);
      if (near.length > seedNear.length) {
        seed = p;
        seedNear = near;
      }
    }
    if (!seed || seedNear.length + 1 < BATCH_MIN) break;
    tried.add(seed.id);
    const group = [seed, ...seedNear.slice(0, BATCH_MAX - 1)];
    // Start where a station is closest, so the walk begins at the metro or train.
    const startAt = (p) => nearestStation(p, stations)?.km ?? Infinity;
    const first = group.reduce((a, b) => (startAt(b) < startAt(a) ? b : a));
    let stops = walkOrder(first, group.filter((p) => p !== first));
    // A long gap means two clusters: keep the bigger side.
    const cut = stops.findIndex((p, i) => i > 0 && distanceKm(stops[i - 1], p) > BATCH_MAX_HOP_KM);
    if (cut > 0) stops = cut >= stops.length - cut ? stops.slice(0, cut) : stops.slice(cut);
    if (stops.length < BATCH_MIN) continue;
    for (const p of stops) free.delete(p.id);
    let km = 0;
    for (let i = 1; i < stops.length; i++) km += distanceKm(stops[i - 1], stops[i]);
    const start = nearestStation(stops[0], stations);
    const end = nearestStation(stops[stops.length - 1], stations);
    batches.push({
      id: `${seed.id}`,
      zone: seed.zone,
      stops: stops.map((p) => p.id),
      walkKm: km * STREET_FACTOR,
      minutes: walkMinutes(km) + stops.length * MINUTES_PER_PANDAL,
      start,
      end,
    });
  }
  return batches;
}
