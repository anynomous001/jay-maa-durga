/**
 * Home page pandal finder: search, one row of area filters, a list grouped by area, and a map that is always
 * visible (Leaflet is fetched only when the map scrolls near the screen or someone taps "Pandals near me").
 * "Pandals near me" sorts by distance and offers a walking route through the closest pandals.
 */
import type * as Leaflet from 'leaflet';
import data from '../../data/pandals.json';
import { MAP_TILE_ATTRIBUTION, MAP_TILE_MAX_ZOOM, MAP_TILE_URL, SITE_NAME, WHATSAPP_NUMBER } from '../config';
import { basePrice } from '../../shared/pricing';
import { getLang, num, onLangChange, t } from '../lib/i18n';
import { type LatLng, directionsUrl, distanceKm, routeLegs, routeUrl } from '../lib/maps';
import { scrollToEl } from '../lib/smooth-scroll';
import { sponsorFor, sponsorHref } from '../lib/sponsors';
import stationData from '../../data/stations.json';
import { type Batch, type Station, type StationHit, makeBatches, nearestStation, walkMinutes } from '../../shared/hopping.mjs';

interface Pandal extends LatLng {
  id: string;
  name_bn: string;
  name_en: string;
  area: string;
  zone: string;
  verified: boolean;
}

const pandals = data.pandals as Pandal[];
const byId = new Map(pandals.map((p) => [p.id, p]));
const stations = stationData.stations as Station[];
/** Nearest metro (or, failing that, train) station for each pandal. */
const stationOf = new Map(pandals.map((p) => [p.id, nearestStation(p, stations)]));
/** Batches: 4–7 pandals close enough to walk between, computed from the data (see shared/hopping.mjs). */
const batches = makeBatches(pandals, stations);
const batchById = new Map(batches.map((b) => [b.id, b]));
const batchOf = new Map(batches.flatMap((b) => b.stops.map((id) => [id, b] as const)));
/** "North Kolkata 2": numbered within each zone. */
const batchNo = new Map<string, number>();
for (const b of batches) batchNo.set(b.id, batches.filter((x) => x.zone === b.zone).indexOf(b) + 1);
/** Kolkata and the 24 Parganas get a filter button each; every other district shares one "Other districts" button. */
const NEAR_ZONES = ['North Kolkata', 'South Kolkata', 'Central', 'Salt Lake–New Town', 'North 24 Parganas', 'South 24 Parganas'];
const OTHER = 'other';
const zones = [
  ...NEAR_ZONES.filter((z) => pandals.some((p) => p.zone === z)),
  ...(pandals.some((p) => !NEAR_ZONES.includes(p.zone)) ? [OTHER] : []),
];
/** List groups follow the filter order; the other districts come after, in data order. */
const ZONE_ORDER = [...NEAR_ZONES, ...new Set(pandals.map((p) => p.zone).filter((z) => !NEAR_ZONES.includes(z)))];
/**
 * The unfiltered map frames Kolkata itself; pins in far-off towns (Basirhat, Siliguri…) stay on the map but would
 * otherwise zoom it out until Kolkata is tiny. A zone filter or a search frames every matching pin.
 */
const KOLKATA_ZONES = ['North Kolkata', 'South Kolkata', 'Central', 'Salt Lake–New Town'];
/** The hopping route takes pandals within this distance of you, at most HOP_MAX of them. */
const HOP_RADIUS_KM = 5;
const HOP_MAX = 12;

const state = { zone: 'all', query: '', me: null as LatLng | null, batch: null as string | null };
// ── Visited pandals: after Google Maps, the site offers the next nearest one you haven't seen ──
const VISITED_KEY = 'visited';
const LAST_KEY = 'lastGo';
/** Forget a hopping session after this long. */
const SESSION_MS = 12 * 60 * 60 * 1000;
const NEXT_STOPS = 4;
function readStore<T>(key: string, fallback: T): T {
  try {
    return (JSON.parse(localStorage.getItem(key) ?? 'null') as T) ?? fallback;
  } catch {
    return fallback;
  }
}
function writeStore(key: string, value: unknown) {
  try {
    if (value == null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* private mode: the bar just won't remember */
  }
}
function visited(): Record<string, number> {
  const all = readStore<Record<string, number>>(VISITED_KEY, {});
  const now = Date.now();
  return Object.fromEntries(Object.entries(all).filter(([, at]) => now - at < SESSION_MS));
}
/** Records that someone set off for these pandals (the last one is where they're headed). */
function markGo(ids: string[]) {
  const v = visited();
  for (const id of ids) v[id] = Date.now();
  writeStore(VISITED_KEY, v);
  writeStore(LAST_KEY, { id: ids[ids.length - 1], at: Date.now() });
}
/** Greedy walk from a pandal through the nearest ones not yet visited, within HOP_RADIUS_KM. */
function nextFrom(from: Pandal, n: number): Pandal[] {
  const seen = visited();
  const left = pandals.filter((p) => p.id !== from.id && !seen[p.id] && distanceKm(from, p) <= HOP_RADIUS_KM);
  const order: Pandal[] = [];
  let at: LatLng = from;
  while (left.length && order.length < n) {
    let best = 0;
    for (let i = 1; i < left.length; i++) if (distanceKm(at, left[i]) < distanceKm(at, left[best])) best = i;
    at = left.splice(best, 1)[0];
    order.push(at as Pandal);
  }
  return order;
}

/** When the device gives no location, a tap on the map stands in for it. */
let picking = false;
const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const bn = () => getLang() === 'bn';
const name = (p: Pandal) => (bn() ? p.name_bn : p.name_en);
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const zoneName = (z: string) => t('pm.zone.' + z);
const fmtDist = (km: number) => (km < 1 ? `${num(Math.round(km * 1000))} ${t('pm.m')}` : `${num(km.toFixed(1))} ${t('pm.km')}`);
const fmtTime = (min: number) => {
  const q = Math.round(min / 15) * 15;
  const h = Math.floor(q / 60);
  const m = q % 60;
  return [h ? t('pm.t.h', { n: num(h) }) : '', m ? t('pm.t.m', { n: num(m) }) : ''].filter(Boolean).join(' ');
};
const stationName = (s: Station) => t(s.kind === 'metro' ? 'pm.st.metro' : 'pm.st.rail', { name: bn() ? s.name_bn : s.name_en });
/** "🚇 Shyambazar metro · 650 m · 9 min walk" */
function stationText(hit: StationHit | null | undefined): string {
  if (!hit) return '';
  const far = hit.km <= 2 ? t('pm.st.walk', { d: fmtDist(hit.km), m: num(walkMinutes(hit.km)) }) : fmtDist(hit.km);
  return `${hit.station.kind === 'metro' ? '🚇' : '🚆'} ${stationName(hit.station)} · ${far}`;
}
function stationHTML(hit: StationHit | null | undefined): string {
  if (!hit) return '';
  const line = hit.station.line ? `<i class="line-dot line-${hit.station.line.toLowerCase()}" title="${esc(hit.station.line)}"></i>` : '';
  return `<span class="pm-station">${line}${esc(stationText(hit))}</span>`;
}
const batchName = (b: Batch) => t('pm.batch.name', { zone: zoneName(b.zone), n: num(batchNo.get(b.id) ?? 1) });
const inZone = (zone: string) =>
  state.zone === 'all' || zone === state.zone || (state.zone === OTHER && !NEAR_ZONES.includes(zone));

function framed(visible: Pandal[]): Pandal[] {
  if (state.me) {
    // Near me: you plus the closest few pins.
    const me = state.me;
    return [...visible].sort((a, b) => distanceKm(me, a) - distanceKm(me, b)).slice(0, 6);
  }
  if (state.batch || state.zone !== 'all' || state.query.trim()) return visible;
  const city = visible.filter((p) => KOLKATA_ZONES.includes(p.zone));
  return city.length ? city : visible;
}

function filtered(): Pandal[] {
  if (state.batch) return batchById.get(state.batch)!.stops.map((id) => byId.get(id)!);
  const q = state.query.trim().toLowerCase();
  let out = pandals.filter(
    (p) =>
      inZone(p.zone) &&
      (!q ||
        [p.name_bn, p.name_en, p.area, p.zone, stationOf.get(p.id)?.station.name_en ?? '', stationOf.get(p.id)?.station.name_bn ?? ''].some((s) =>
          s.toLowerCase().includes(q),
        )),
  );
  if (state.me) {
    const me = state.me;
    out = [...out].sort((a, b) => distanceKm(me, a) - distanceKm(me, b));
  }
  return out;
}

// ── Map (lazy) ──
let L: typeof Leaflet | null = null;
let map: Leaflet.Map | null = null;
const markers = new Map<string, Leaflet.CircleMarker>();
let meMarker: Leaflet.CircleMarker | null = null;
let batchLayer: Leaflet.LayerGroup | null = null;
let mapSetup: Promise<void> | null = null;

/** Builds the map once, however many callers ask while Leaflet is still loading. */
function ensureMap(): Promise<void> {
  return (mapSetup ??= setupMap());
}

async function setupMap(): Promise<void> {
  const [mod] = await Promise.all([import('leaflet'), import('leaflet/dist/leaflet.css')]);
  L = (mod as unknown as { default: typeof Leaflet }).default ?? (mod as unknown as typeof Leaflet);
  const el = $('pm-map');
  el.innerHTML = '';
  map = L.map(el, { zoomControl: true, attributionControl: true, scrollWheelZoom: false });
  L.tileLayer(MAP_TILE_URL, { maxZoom: MAP_TILE_MAX_ZOOM, attribution: MAP_TILE_ATTRIBUTION }).addTo(map);
  for (const p of pandals) {
    const m = L.circleMarker([p.lat, p.lng], {
      radius: 8,
      weight: 2,
      color: '#1a1405',
      fillColor: p.verified ? '#f4b942' : '#b3b0c4',
      fillOpacity: 0.95,
    }).addTo(map);
    m.bindPopup(() => popupHTML(p));
    m.bindTooltip(name(p));
    // Choosing your spot: tapping a pin counts as "I'm here" too.
    m.on('click', () => picking && setMe({ lat: p.lat, lng: p.lng }));
    markers.set(p.id, m);
  }
  map.on('click', (e: Leaflet.LeafletMouseEvent) => {
    if (picking) setMe({ lat: e.latlng.lat, lng: e.latlng.lng });
  });
  syncMarkers();
}

function popupHTML(p: Pandal): string {
  const st = stationText(stationOf.get(p.id));
  return `<strong>${esc(name(p))}</strong><br>${esc(p.area)}${st ? `<br>${esc(st)}` : ''}${p.verified ? '' : `<br><em>${esc(t('pm.approx'))}</em>`}<br><a href="${directionsUrl(p)}" target="_blank" rel="noopener" data-go="${p.id}">${esc(t('pm.directions'))} →</a> · <a href="#p-${p.id}">${esc(t('pm.inList'))}</a>`;
}

function syncMarkers() {
  if (!map || !L) return;
  const visible = filtered();
  const ids = new Set(visible.map((p) => p.id));
  for (const [id, m] of markers) {
    if (ids.has(id)) m.addTo(map);
    else m.remove();
    m.setTooltipContent(name(byId.get(id)!));
  }
  batchLayer?.remove();
  batchLayer = null;
  if (state.batch) {
    const stops = filtered();
    const Lf = L;
    batchLayer = Lf.layerGroup([
      Lf.polyline(
        stops.map((p) => [p.lat, p.lng] as [number, number]),
        { color: '#f4b942', weight: 3, opacity: 0.85, dashArray: '6 6' },
      ),
      ...stops.map((p, i) =>
        Lf.marker([p.lat, p.lng], {
          icon: Lf.divIcon({ className: 'pm-num', html: `<span>${num(i + 1)}</span>`, iconSize: [26, 26] }),
          title: name(p),
        }).on('click', () => markers.get(p.id)?.openPopup()),
      ),
    ]).addTo(map);
  }
  meMarker?.remove();
  meMarker = state.me
    ? L.circleMarker([state.me.lat, state.me.lng], { radius: 7, color: '#fff', weight: 3, fillColor: '#3b82f6', fillOpacity: 1 })
        .bindTooltip(t('pm.you'))
        .addTo(map)
    : null;
  const pts = framed(visible).map((p) => [p.lat, p.lng] as [number, number]);
  if (state.me) pts.push([state.me.lat, state.me.lng]);
  if (pts.length) map.fitBounds(L.latLngBounds(pts), { padding: [24, 24], maxZoom: 15 });
}

async function showOnMap(p: Pandal) {
  await ensureMap();
  map!.invalidateSize();
  map!.setView([p.lat, p.lng], 16);
  markers.get(p.id)?.openPopup();
}

// ── List ──
function eatNearbyHTML(p: Pandal): string {
  const s = sponsorFor('pandal-nearby', p.id);
  if (!s)
    return `<button type="button" class="pm-eat cta" data-book-slot="pandal-nearby" data-book-pandal="${p.id}">${esc(t('pm.eatCta', { price: `₹${num(basePrice('pandal-nearby'))}` }))}</button>`;
  const logo = s.logo ? `<img src="${esc(s.logo)}" alt="" width="28" height="28" loading="lazy" class="pm-eat-logo" /> ` : '';
  const label = `<span class="s-label">${esc(t('sponsored'))}</span> ${logo}${esc(t('pm.eatNearby'))}: <strong>${esc((bn() && s.name_bn) || s.name)}</strong> — ${esc((bn() && s.tagline_bn) || s.tagline)}`;
  const addr = s.address
    ? `<span class="pm-eat-addr">📍 ${esc(s.address)}${s.mapsUrl ? ` · <a href="${esc(s.mapsUrl)}" target="_blank" rel="noopener sponsored">${esc(t('pm.directions'))}</a>` : ''}</span>`
    : '';
  const href = sponsorHref(s);
  return href
    ? `<div class="pm-eat"><a href="${esc(href)}" target="_blank" rel="sponsored noopener">${label}</a>${addr}</div>`
    : `<div class="pm-eat">${label}${addr}</div>`;
}

function cardHTML(p: Pandal, showZone: boolean, step = 0): string {
  const alt = bn() ? p.name_en : p.name_bn;
  const dist = state.me ? `<span class="pm-dist">${esc(t('pm.away', { d: num(distanceKm(state.me, p).toFixed(1)) }))}</span>` : '';
  const metro = stationHTML(stationOf.get(p.id));
  const zone = showZone ? `<span>${esc(zoneName(p.zone))}</span>` : '';
  const approx = p.verified ? '' : `<p class="pm-approx" title="${esc(t('pm.approxHelp'))}">⚠ ${esc(t('pm.approx'))} — ${esc(t('pm.approxHelp'))}</p>`;
  const seen = visitedNow[p.id] ? ` <span class="pm-seen">✓ ${esc(t('pm.visited'))}</span>` : '';
  const next = nextFrom(p, NEXT_STOPS);
  const nextBtn = next.length
    ? `<a class="btn btn-ghost btn-sm" href="${routeUrl([p, ...next], 'walking')}" target="_blank" rel="noopener" data-go="${[p, ...next].map((q) => q.id).join(',')}" title="${esc(next.map(name).join(' → '))}">${esc(t('pm.nextHere', { n: num(next.length) }))}</a>`
    : '';
  return `<article class="pm-card${visitedNow[p.id] ? ' is-seen' : ''}" id="p-${p.id}">
    <h4>${step ? `<span class="pm-step">${num(step)}</span>` : ''}<a class="pm-link" href="/pandals/${p.id}/"><span lang="${bn() ? 'bn' : 'en'}">${esc(name(p))}</span> <span class="pm-alt" lang="${bn() ? 'en' : 'bn'}">${esc(alt)}</span></a>${seen}</h4>
    <p class="pm-meta">${dist}<span>${esc(p.area)}</span>${zone}${metro}</p>
    ${approx}
    <div class="pm-actions"><a class="btn btn-sm" href="${directionsUrl(p)}" target="_blank" rel="noopener" data-go="${p.id}" aria-label="${esc(`${t('pm.directions')}: ${name(p)}`)}">🧭 ${esc(t('pm.directions'))}</a>${nextBtn}<button type="button" class="btn btn-ghost btn-sm pm-show" data-id="${p.id}">${esc(t('pm.onMap'))}</button></div>
    ${eatNearbyHTML(p)}
  </article>`;
}

/** Visited set for the render in progress (read once, not per card). */
let visitedNow: Record<string, number> = {};

function renderList() {
  visitedNow = visited();
  const items = filtered();
  const list = $('pm-list');
  if (!items.length) {
    list.innerHTML = `<p class="muted">${esc(t('pm.none'))}</p>`;
  } else if (state.batch) {
    // A batch: its pandals in walking order, numbered like the map.
    list.innerHTML = `<ol class="pm-cards">${items.map((p, i) => `<li>${cardHTML(p, true, i + 1)}</li>`).join('')}</ol>`;
  } else if (state.me) {
    // Near me: one list, closest first.
    list.innerHTML = `<ol class="pm-cards">${items.map((p) => `<li>${cardHTML(p, true)}</li>`).join('')}</ol>`;
  } else {
    const groups = ZONE_ORDER.map((z) => [z, items.filter((p) => p.zone === z)] as const).filter(([, ps]) => ps.length);
    list.innerHTML = groups
      .map(
        ([z, ps]) => `<section class="pm-group" aria-label="${esc(zoneName(z))}">
          <h3 class="pm-group-title">${esc(zoneName(z))} <span class="pm-group-count">${esc(num(ps.length))}</span></h3>
          <ol class="pm-cards">${ps.map((p) => `<li>${cardHTML(p, false)}</li>`).join('')}</ol>
        </section>`,
      )
      .join('');
  }
  const msg = [t('pm.count', { n: num(items.length) })];
  if (state.me && !state.batch) msg.push(t('pm.sortedNear'));
  $('pm-status').textContent = msg.join(' · ');
  renderBatches();
  renderHop();
  renderNextBar();
  syncMarkers();
}

/** Bottom bar after a trip to Google Maps: the next nearest pandal you haven't seen, one tap away. */
function renderNextBar() {
  const bar = $('pm-next');
  const last = readStore<{ id: string; at: number } | null>(LAST_KEY, null);
  const from = last && Date.now() - last.at < SESSION_MS ? byId.get(last.id) : undefined;
  document.body.classList.toggle('has-next-bar', !!from);
  if (!from) {
    bar.hidden = true;
    return;
  }
  bar.hidden = false;
  // In a batch, the next stop of that batch comes first.
  const b = batchOf.get(from.id);
  const seen = visited();
  const inBatch = b ? b.stops.slice(b.stops.indexOf(from.id) + 1).filter((id) => !seen[id]).map((id) => byId.get(id)!) : [];
  const next = inBatch.length ? inBatch.slice(0, NEXT_STOPS) : nextFrom(from, NEXT_STOPS);
  const head = `<p class="pm-next-at">📍 ${esc(t('pm.bar.at', { name: name(from) }))}</p>`;
  const close = `<button type="button" class="pm-next-close" data-next-close aria-label="${esc(t('ui.close'))}">✕</button>`;
  if (!next.length) {
    bar.innerHTML = `${head}<p class="pm-next-none">${esc(t('pm.bar.none', { km: num(HOP_RADIUS_KM) }))} <button type="button" class="pm-next-reset" data-next-reset>${esc(t('pm.bar.reset'))}</button></p>${close}`;
    return;
  }
  const n = next[0];
  const d = num(distanceKm(from, n) < 1 ? `${Math.round(distanceKm(from, n) * 1000)}` : distanceKm(from, n).toFixed(1));
  const unit = distanceKm(from, n) < 1 ? t('pm.m') : t('pm.km');
  bar.innerHTML = `${head}
    <p class="pm-next-name">${esc(t(inBatch.length ? 'pm.bar.batchNext' : 'pm.bar.next'))}: <a href="#p-${n.id}">${esc(name(n))}</a> <span class="pm-dist">${esc(d)} ${esc(unit)}</span></p>
    <div class="pm-next-actions">
      <a class="btn btn-sm" href="${directionsUrl(n, 'walking')}" target="_blank" rel="noopener" data-go="${n.id}">🧭 ${esc(t('pm.directions'))}</a>
      ${next.length > 1 ? `<a class="btn btn-ghost btn-sm" href="${routeUrl([from, ...next], 'walking')}" target="_blank" rel="noopener" data-go="${next.map((q) => q.id).join(',')}">${esc(t('pm.bar.route', { n: num(next.length) }))}</a>` : ''}
      <button type="button" class="pm-next-reset" data-next-reset>${esc(t('pm.bar.reset'))}</button>
    </div>
    ${close}`;
}

function renderZones() {
  const box = $('pm-zones');
  box.innerHTML = '';
  for (const z of ['all', ...zones]) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'chip-btn';
    const n = z === 'all' ? pandals.length : pandals.filter((p) => (z === OTHER ? !NEAR_ZONES.includes(p.zone) : p.zone === z)).length;
    b.innerHTML = `${esc(z === 'all' ? t('pm.all') : zoneName(z))} <span class="chip-count">${esc(num(n))}</span>`;
    b.setAttribute('aria-pressed', String(state.zone === z));
    b.addEventListener('click', () => {
      state.zone = z;
      state.batch = null;
      renderZones();
      renderList();
    });
    box.appendChild(b);
  }
  // Keep the chosen chip in view inside the sideways-scrolling row (without scrolling the page).
  const on = box.querySelector<HTMLElement>('[aria-pressed="true"]');
  if (on && (on.offsetLeft < box.scrollLeft || on.offsetLeft + on.offsetWidth > box.scrollLeft + box.clientWidth))
    box.scrollLeft = on.offsetLeft - 16;
}

// ── Near me: a walking route through the closest pandals ──
/** Greedy nearest-neighbour order: from you, always on to the closest pandal not yet visited. */
function hopOrder(me: LatLng): Pandal[] {
  const left = pandals.filter((p) => inZone(p.zone) && distanceKm(me, p) <= HOP_RADIUS_KM);
  const order: Pandal[] = [];
  let at: LatLng = me;
  while (left.length && order.length < HOP_MAX) {
    let best = 0;
    for (let i = 1; i < left.length; i++) if (distanceKm(at, left[i]) < distanceKm(at, left[best])) best = i;
    at = left.splice(best, 1)[0];
    order.push(at as Pandal);
  }
  return order;
}

// ── Batches: pandals close together, seen in one walk ──
function batchCardHTML(b: Batch): string {
  const first = b.stops.slice(0, 3).map((id) => name(byId.get(id)!));
  return `<button type="button" class="pm-batch" data-batch="${b.id}" aria-pressed="${state.batch === b.id}">
    <strong>${esc(batchName(b))}</strong>
    <span class="pm-batch-meta">${esc(t('pm.batch.meta', { n: num(b.stops.length), km: num(b.walkKm.toFixed(1)), time: fmtTime(b.minutes) }))}</span>
    ${b.start ? `<span class="pm-batch-st">${esc(t('pm.batch.from', { st: stationText(b.start) }))}</span>` : ''}
    <span class="pm-batch-stops">${esc(first.join(' → '))}${b.stops.length > 3 ? ' …' : ''}</span>
  </button>`;
}

function renderBatches() {
  const wrap = $('pm-batches');
  const list = batches.filter((b) => (state.batch ? true : inZone(b.zone)));
  wrap.hidden = !list.length;
  $('pm-batch-row').innerHTML = list.map(batchCardHTML).join('');
}

function renderBatchBox(box: HTMLElement, b: Batch) {
  const stops = b.stops.map((id) => byId.get(id)!);
  // Start from the station when it's a short walk away; otherwise Google Maps starts at the first pandal.
  const origin = b.start && b.start.km <= 2 ? [b.start.station] : [];
  const legs = routeLegs<LatLng & { id?: string }>([...origin, ...stops]);
  const links = legs
    .map((leg, i) => {
      const ps = leg.filter((x): x is Pandal => 'zone' in x);
      const label = i === 0 ? t('pm.hop.start', { n: num(ps.length) }) : t('pm.hop.next', { n: num(i + 1) });
      return `<a class="btn btn-sm${i ? ' btn-ghost' : ''}" href="${routeUrl(leg, 'walking')}" target="_blank" rel="noopener" data-go="${ps.map((q) => q.id).join(',')}">${esc(label)}<span class="pm-hop-span">${esc(name(ps[0]))} → ${esc(name(ps[ps.length - 1]))}</span></a>`;
    })
    .join('');
  const ends = [
    b.start ? t('pm.batch.from', { st: stationText(b.start) }) : '',
    b.end ? t('pm.batch.end', { st: stationText(b.end) }) : '',
  ].filter(Boolean);
  box.hidden = false;
  box.innerHTML = `<button type="button" class="pm-batch-close" data-batch-close>${esc(t('pm.batch.all'))}</button>
    <h3>${esc(batchName(b))}</h3>
    <p class="pm-batch-meta">${esc(t('pm.batch.meta', { n: num(stops.length), km: num(b.walkKm.toFixed(1)), time: fmtTime(b.minutes) }))}</p>
    ${ends.map((e) => `<p class="small">${esc(e)}</p>`).join('')}
    <p class="muted small">${esc(t('pm.batch.lead'))}</p>
    <ol class="pm-hop-stops">${stops.map((p) => `<li><a href="#p-${p.id}">${esc(name(p))}</a></li>`).join('')}</ol>
    <div class="pm-hop-legs">${links}</div>`;
}

function openBatch(id: string | null) {
  state.batch = id && batchById.has(id) ? id : null;
  renderList();
  if (state.batch) {
    history.replaceState(null, '', `#b-${state.batch}`);
    scrollToEl($('pm-hop'));
  } else if (location.hash.startsWith('#b-')) history.replaceState(null, '', location.pathname + location.search);
}

function renderHop() {
  const box = $('pm-hop');
  if (state.batch) return renderBatchBox(box, batchById.get(state.batch)!);
  if (!state.me) {
    box.hidden = true;
    return;
  }
  box.hidden = false;
  const stops = hopOrder(state.me);
  if (stops.length < 2) {
    box.innerHTML = `<p class="pm-hop-none">${esc(t('pm.hop.none', { km: num(HOP_RADIUS_KM) }))}</p>`;
    return;
  }
  // Each leg: where you are (or the last pandal) plus up to 4 pandals; Google Maps on phones takes 5 stops at most.
  const legs = routeLegs<LatLng & { id?: string }>([state.me, ...stops]);
  const links = legs
    .map((leg, i) => {
      const first = leg[1] as Pandal;
      const last = leg[leg.length - 1] as Pandal;
      const label = i === 0 ? t('pm.hop.start', { n: num(leg.length - 1) }) : t('pm.hop.next', { n: num(i + 1) });
      return `<a class="btn btn-sm${i ? ' btn-ghost' : ''}" href="${routeUrl(leg, 'walking')}" target="_blank" rel="noopener" data-go="${(leg.slice(1) as Pandal[]).map((q) => q.id).join(',')}">${esc(label)}<span class="pm-hop-span">${esc(name(first))} → ${esc(name(last))}</span></a>`;
    })
    .join('');
  box.innerHTML = `<h3>${esc(t('pm.hop.title'))}</h3>
    <p class="muted small">${esc(t('pm.hop.lead', { n: num(stops.length), km: num(HOP_RADIUS_KM) }))}</p>
    <ol class="pm-hop-stops">${stops.map((p) => `<li><a href="#p-${p.id}">${esc(name(p))}</a></li>`).join('')}</ol>
    <div class="pm-hop-legs">${links}</div>`;
}

/** Sets "you are here" from GPS or a tap on the map, then lists the nearest pandals and the walking route. */
function setMe(me: LatLng) {
  state.me = me;
  state.batch = null;
  picking = false;
  $('pm-map').classList.remove('pm-picking');
  $('pm-near').setAttribute('aria-pressed', 'true');
  renderList();
}

function startPicking(msgKey: string) {
  $('pm-status').textContent = t(msgKey);
  picking = true;
  void ensureMap().then(() => {
    const el = $('pm-map');
    el.dataset.hint = t('pm.pickHint');
    el.classList.add('pm-picking');
  });
}

function nearMe() {
  const status = $('pm-status');
  scrollToEl($('pm-near'));
  void ensureMap();
  if (!('geolocation' in navigator)) {
    startPicking('pm.unavailable');
    return;
  }
  status.textContent = t('pm.locating');
  const ok = (pos: GeolocationPosition) => setMe({ lat: pos.coords.latitude, lng: pos.coords.longitude });
  const fail = (err: GeolocationPositionError) =>
    startPicking(err.code === err.PERMISSION_DENIED ? 'pm.denied' : err.code === err.TIMEOUT ? 'pm.timeout' : 'pm.unavailable');
  navigator.geolocation.getCurrentPosition(
    ok,
    (err) => {
      if (err.code === err.PERMISSION_DENIED) return fail(err);
      // Laptops often fail the quick network fix; try once more and let the device use whatever it has.
      navigator.geolocation.getCurrentPosition(ok, fail, { enableHighAccuracy: true, timeout: 20000, maximumAge: 600000 });
    },
    { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 },
  );
}

// ── Deep links: /#p-<id> scrolls to that pandal and shows it on the map ──
function openHash() {
  const id = decodeURIComponent(location.hash.slice(1));
  if (id.startsWith('b-')) {
    if (state.batch !== id.slice(2)) openBatch(id.slice(2));
    return;
  }
  if (!id.startsWith('p-')) return;
  const p = byId.get(id.slice(2));
  if (!p) return;
  if (!document.getElementById(id)) {
    // Filtered out: clear the filters so the card exists.
    state.zone = 'all';
    state.query = '';
    state.batch = null;
    ($('pm-search') as HTMLInputElement).value = '';
    renderZones();
    renderList();
  }
  const card = document.getElementById(id)!;
  scrollToEl(card, 'center');
  card.classList.remove('hl');
  void card.offsetWidth;
  card.classList.add('hl');
  void showOnMap(p);
}

export function initFinder() {
  renderZones();
  renderList();
  const suggest = () => {
    ($('pm-suggest') as HTMLAnchorElement).href = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(t('pm.suggestText', { site: SITE_NAME }))}`;
  };
  suggest();
  onLangChange(() => {
    renderZones();
    renderList();
    suggest();
  });
  // Approved bookings arrive from the API after first paint.
  addEventListener('sponsors:update', () => renderList());

  // The map loads when it comes near the screen.
  const mapEl = $('pm-map');
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          io.disconnect();
          void ensureMap();
        }
      },
      { rootMargin: '300px' },
    );
    io.observe(mapEl);
  } else void ensureMap();

  $('pm-list').addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('.pm-show');
    if (!btn) return;
    scrollToEl($('pm-map-wrap'), 'center');
    void showOnMap(byId.get(btn.dataset.id!)!);
  });

  let searchTimer = 0;
  $('pm-search').addEventListener('input', (e) => {
    clearTimeout(searchTimer);
    searchTimer = window.setTimeout(() => {
      state.query = (e.target as HTMLInputElement).value;
      state.batch = null;
      renderList();
    }, 120);
  });

  for (const b of document.querySelectorAll<HTMLElement>('[data-near-me]')) b.addEventListener('click', nearMe);

  // Links to a pandal card (route stops, map popups) highlight it too, not just scroll to it.
  document.addEventListener(
    'click',
    (e) => {
      const a = (e.target as HTMLElement).closest<HTMLAnchorElement>('a[href^="#p-"]');
      if (!a) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      history.replaceState(null, '', a.getAttribute('href'));
      openHash();
    },
    true,
  );
  addEventListener('hashchange', openHash);
  if (/^#[pb]-/.test(location.hash)) requestAnimationFrame(openHash);

  $('pm-batch-row').addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('[data-batch]');
    if (b) openBatch(state.batch === b.dataset.batch ? null : b.dataset.batch!);
  });
  $('pm-hop').addEventListener('click', (e) => {
    if ((e.target as HTMLElement).closest('[data-batch-close]')) openBatch(null);
  });

  // Going to Google Maps: remember it, so coming back shows the next pandal.
  document.addEventListener('click', (e) => {
    const el = e.target as HTMLElement;
    const go = el.closest<HTMLElement>('[data-go]');
    if (go) {
      markGo(go.dataset.go!.split(','));
      // Most phones switch to the Maps app; the page refreshes when it is shown again.
      setTimeout(renderList, 400);
      return;
    }
    if (el.closest('[data-next-close]')) {
      writeStore(LAST_KEY, null);
      renderNextBar();
    } else if (el.closest('[data-next-reset]')) {
      writeStore(LAST_KEY, null);
      writeStore(VISITED_KEY, null);
      renderList();
    }
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') renderList();
  });
  addEventListener('pageshow', (e) => {
    if (e.persisted) renderList();
  });
}
