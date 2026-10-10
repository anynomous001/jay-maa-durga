/**
 * Pandal-hopping maths shared by the home page (src/features/finder.ts) and the build-time pandal pages
 * (scripts/static-pages.mjs): the nearest metro or train station, and "batches" of pandals close enough to see
 * together on foot. Plain JS so the Node build script can import it; types in hopping.d.mts.
 */

/** Use the metro when one is this close; otherwise the nearest station of any kind. */
export const METRO_WALK_KM = 1.5;
/** Beyond this no station is shown (a far station would mislead more than help). */
export const STATION_MAX_KM = 12;
/** Pandals within this walk of each other can share a batch. */
export const BATCH_MAX_HOP_KM = 1.1;
export const BATCH_MIN = 4;
/** Cost of starting another batch, in km of walking: favours fewer, fuller batches. */
export const BATCH_SPLIT_KM = 2;
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

const pathKm = (stops) => stops.reduce((km, p, i) => (i ? km + distanceKm(stops[i - 1], p) : 0), 0);

/** Groups of pandals linked by short walks (each within BATCH_MAX_HOP_KM of another in the group). */
function clusters(pandals) {
  const seen = new Set();
  const out = [];
  for (const p of pandals) {
    if (seen.has(p.id)) continue;
    const group = [p];
    seen.add(p.id);
    for (let i = 0; i < group.length; i++)
      for (const q of pandals)
        if (!seen.has(q.id) && distanceKm(group[i], q) <= BATCH_MAX_HOP_KM) {
          seen.add(q.id);
          group.push(q);
        }
    out.push(group);
  }
  return out;
}

/**
 * Batches of 4–7 pandals close to one another, each in walking order. Pandals are first grouped into clusters
 * linked by short walks; one walking path is laid through each cluster and cut into consecutive batches, so a big
 * cluster (North Kolkata) becomes several batches and every pandal in it gets one. Isolated pandals get none.
 * Deterministic for the same data, so batch ids stay stable between builds.
 */
export function makeBatches(pandals, stations) {
  const batches = [];
  for (const group of clusters(pandals)) {
    if (group.length < BATCH_MIN) continue;
    // The shortest of the nearest-next paths, trying every pandal as the start.
    let path = null;
    for (const start of group) {
      const order = walkOrder(start, group.filter((p) => p !== start));
      if (!path || pathKm(order) < pathKm(path)) path = order;
    }
    // Cut the path into runs of 4–7 where the walk between runs is longest. Each extra batch costs
    // BATCH_SPLIT_KM, so a run is split only where the gap is long; otherwise batches stay near 7.
    const n = path.length;
    const best = Array(n + 1).fill(Infinity);
    const from = Array(n + 1).fill(-1);
    best[0] = 0;
    for (let i = BATCH_MIN; i <= n; i++)
      for (let j = Math.max(0, i - BATCH_MAX); j <= i - BATCH_MIN; j++)
        if (best[j] + pathKm(path.slice(j, i)) + BATCH_SPLIT_KM < best[i]) {
          best[i] = best[j] + pathKm(path.slice(j, i)) + BATCH_SPLIT_KM;
          from[i] = j;
        }
    const runs = [];
    for (let i = n; i > 0; i = from[i]) runs.unshift(path.slice(from[i], i));
    for (let stops of runs) {
      // Walk it from whichever end is nearer a station.
      const startKm = (p) => nearestStation(p, stations)?.km ?? Infinity;
      if (startKm(stops[stops.length - 1]) < startKm(stops[0])) stops = [...stops].reverse();
      const km = pathKm(stops);
      batches.push({
        id: stops[0].id,
        zone: stops[0].zone,
        stops: stops.map((p) => p.id),
        walkKm: km * STREET_FACTOR,
        minutes: walkMinutes(km) + stops.length * MINUTES_PER_PANDAL,
        start: nearestStation(stops[0], stations),
        end: nearestStation(stops[stops.length - 1], stations),
      });
    }
  }
  return batches;
}
