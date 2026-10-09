/**
 * Pandal map page: searchable list + zone filters render immediately;
 * Leaflet (JS + CSS) is fetched only when the map is first shown.
 */
import type * as Leaflet from 'leaflet';
import data from '../../data/pandals.json';
import { MAP_TILE_ATTRIBUTION, MAP_TILE_MAX_ZOOM, MAP_TILE_URL, SITE_NAME, WHATSAPP_NUMBER } from '../config';
import { basePrice } from '../../shared/pricing';
import { initCommon } from '../lib/common';
import { initMotion } from '../features/motion';
import { initPolls } from '../features/polls';
import { initVisitors } from '../features/visitors';
import { getLang, num, onLangChange, t } from '../lib/i18n';
import { type LatLng, type TravelMode, directionsUrl, distanceKm, routeLegs, routeUrl } from '../lib/maps';
import { sponsorFor, sponsorHref } from '../lib/sponsors';

initCommon();
initVisitors();
initPolls();

interface Pandal extends LatLng {
  id: string;
  name_bn: string;
  name_en: string;
  area: string;
  zone: string;
  nearestMetro?: string;
  theme2026?: string;
  verified: boolean;
  source: string;
  notes?: string;
}
interface Route {
  id: string;
  zone: string;
  name_bn: string;
  name_en: string;
  travelmode: TravelMode;
  stops: string[];
}

const pandals = data.pandals as Pandal[];
const routes = data.routes as Route[];
const byId = new Map(pandals.map((p) => [p.id, p]));
const zones = [...new Set(pandals.map((p) => p.zone))];

const state = { zone: 'all', query: '', me: null as LatLng | null };
const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const list = $('pm-list');
const status = $('pm-status');
const bn = () => getLang() === 'bn';
const name = (p: Pandal) => (bn() ? p.name_bn : p.name_en);
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

// ── Map (lazy) ──
let L: typeof Leaflet | null = null;
let map: Leaflet.Map | null = null;
const markers = new Map<string, Leaflet.CircleMarker>();
let meMarker: Leaflet.CircleMarker | null = null;

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
  map = L.map(el, { zoomControl: true, attributionControl: true });
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
    markers.set(p.id, m);
  }
  syncMarkers();
}

function popupHTML(p: Pandal): string {
  return `<strong>${esc(name(p))}</strong><br>${esc(p.area)}${p.verified ? '' : `<br><em>${esc(t('pm.approx'))}</em>`}<br><a href="${directionsUrl(p, 'walking')}" target="_blank" rel="noopener">${esc(t('pm.directions'))} →</a>`;
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
  const pts = focusPoints(visible).map((p) => [p.lat, p.lng] as [number, number]);
  if (state.me) pts.push([state.me.lat, state.me.lng]);
  if (pts.length) map.fitBounds(L.latLngBounds(pts), { padding: [24, 24], maxZoom: 15 });
}

/** Pins farther than this from the middle of the list are left out of the auto-zoom (they stay on the map). */
const FOCUS_RADIUS_KM = 15;

/**
 * Pandals to frame when the map zooms. A few pins in far-off towns (Basirhat, Baruipur) would otherwise
 * zoom the whole map out until Kolkata is tiny. Picking a zone or searching for one of them still frames it,
 * because the middle of that smaller list is then right next to it.
 */
function focusPoints(list: Pandal[]): Pandal[] {
  if (list.length < 3) return list;
  const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
  const mid: LatLng = { lat: median(list.map((p) => p.lat)), lng: median(list.map((p) => p.lng)) };
  const near = list.filter((p) => distanceKm(mid, p) <= FOCUS_RADIUS_KM);
  return near.length ? near : list;
}

// ── List ──
function filtered(): Pandal[] {
  const q = state.query.trim().toLowerCase();
  let out = pandals.filter(
    (p) =>
      (state.zone === 'all' || p.zone === state.zone) &&
      (!q || [p.name_bn, p.name_en, p.area, p.nearestMetro ?? ''].some((s) => s.toLowerCase().includes(q))),
  );
  if (state.me) {
    const me = state.me;
    out = [...out].sort((a, b) => distanceKm(me, a) - distanceKm(me, b));
  }
  return out;
}

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

function cardHTML(p: Pandal): string {
  const alt = bn() ? p.name_en : p.name_bn;
  const dist = state.me ? `<span class="pm-dist">${esc(t('pm.away', { d: num(distanceKm(state.me, p).toFixed(1)) }))}</span>` : '';
  const metro = p.nearestMetro ? `<span>${esc(t('pm.metro'))}: ${esc(p.nearestMetro)}</span>` : '';
  const approx = p.verified ? '' : `<p class="pm-approx" title="${esc(t('pm.approxHelp'))}">⚠ ${esc(t('pm.approx'))} — ${esc(t('pm.approxHelp'))}</p>`;
  const modes: [TravelMode, string][] = [['walking', 'pm.walk'], ['driving', 'pm.drive'], ['transit', 'pm.transit']];
  const dirs = modes
    .map(([m, k]) => `<a class="btn ${m === 'walking' ? '' : 'btn-ghost'} btn-sm" href="${directionsUrl(p, m)}" target="_blank" rel="noopener" aria-label="${esc(`${t('pm.directions')} (${t(k)}): ${name(p)}`)}">${esc(t(k))}</a>`)
    .join('');
  return `<article class="pm-card" id="p-${p.id}">
    <h3><a class="pm-link" href="/pandals/${p.id}/"><span lang="${bn() ? 'bn' : 'en'}">${esc(name(p))}</span> <span class="pm-alt" lang="${bn() ? 'en' : 'bn'}">${esc(alt)}</span></a></h3>
    <p class="pm-meta"><span>${esc(p.area)}</span><span>${esc(t('pm.zone.' + p.zone))}</span>${metro}${dist}</p>
    ${approx}
    <div class="pm-actions"><span class="pm-dir-label">${esc(t('pm.directions'))}:</span>${dirs}<button type="button" class="btn btn-ghost btn-sm pm-show" data-id="${p.id}">${esc(t('pm.onMap'))}</button></div>
    ${eatNearbyHTML(p)}
  </article>`;
}

function renderList() {
  const items = filtered();
  list.innerHTML = items.length ? items.map((p) => `<li>${cardHTML(p)}</li>`).join('') : `<li class="muted">${esc(t('pm.none'))}</li>`;
  const msg = [t('pm.count', { n: num(items.length) })];
  if (state.me) msg.push(t('pm.sortedNear'));
  status.textContent = msg.join(' · ');
  syncMarkers();
}

function renderZones() {
  const box = $('pm-zones');
  box.innerHTML = '';
  for (const z of ['all', ...zones]) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'chip-btn';
    b.textContent = z === 'all' ? t('pm.all') : t('pm.zone.' + z);
    b.setAttribute('aria-pressed', String(state.zone === z));
    b.addEventListener('click', () => {
      state.zone = z;
      renderZones();
      renderList();
      renderRoutes();
    });
    box.appendChild(b);
  }
}

function renderRoutes() {
  const box = $('pm-routes');
  box.innerHTML = '';
  for (const r of routes.filter((r) => state.zone === 'all' || r.zone === state.zone)) {
    const stops = r.stops.map((id) => byId.get(id)!);
    const legs = routeLegs(stops);
    const div = document.createElement('article');
    div.className = 'route';
    const links = legs
      .map(
        (leg, i) =>
          `<a class="btn btn-sm${i ? ' btn-ghost' : ''}" href="${routeUrl(leg, r.travelmode)}" target="_blank" rel="noopener">${esc(i === 0 ? t('pm.start') : t('pm.part', { n: num(i + 1) }))}${legs.length > 1 && i === 0 ? ` (${esc(t('pm.part', { n: num(1) }))})` : ''}</a>`,
      )
      .join('');
    div.innerHTML = `<h3>${esc(bn() ? r.name_bn : r.name_en)}</h3>
      <p class="muted small">${esc(t('pm.zone.' + r.zone))} · ${esc(t('pm.stops', { n: num(stops.length) }))} · ${esc(t(r.travelmode === 'walking' ? 'pm.walk' : r.travelmode === 'driving' ? 'pm.drive' : 'pm.transit'))}</p>
      <ol class="route-stops">${stops.map((p) => `<li><a href="#p-${p.id}">${esc(name(p))}</a>${p.verified ? '' : ' <span class="muted small">(' + esc(t('pm.approx')) + ')</span>'}</li>`).join('')}</ol>
      <div class="btn-row">${links}</div>`;
    box.appendChild(div);
  }
}

// ── View toggle (mobile: list or map; desktop shows both) ──
const layout = $('pm-layout');
const desktop = matchMedia('(min-width: 960px)');
function setView(v: 'list' | 'map') {
  layout.dataset.view = v;
  $('pm-tab-list').setAttribute('aria-selected', String(v === 'list'));
  $('pm-tab-map').setAttribute('aria-selected', String(v === 'map'));
  if (v === 'map' || desktop.matches) void ensureMap().then(() => map?.invalidateSize());
}
$('pm-tab-list').addEventListener('click', () => setView('list'));
$('pm-tab-map').addEventListener('click', () => setView('map'));
if (desktop.matches) void ensureMap();
desktop.addEventListener('change', (e) => e.matches && void ensureMap().then(() => map?.invalidateSize()));

list.addEventListener('click', async (e) => {
  const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('.pm-show');
  if (!btn) return;
  const p = byId.get(btn.dataset.id!)!;
  setView('map');
  await ensureMap();
  map!.invalidateSize();
  map!.setView([p.lat, p.lng], 16);
  markers.get(p.id)?.openPopup();
  if (!desktop.matches) $('pm-map-wrap').scrollIntoView({ behavior: 'smooth', block: 'start' });
});

// ── Search & near me ──
let searchTimer = 0;
$('pm-search').addEventListener('input', (e) => {
  clearTimeout(searchTimer);
  searchTimer = window.setTimeout(() => {
    state.query = (e.target as HTMLInputElement).value;
    renderList();
  }, 120);
});

$('pm-near').addEventListener('click', () => {
  if (!('geolocation' in navigator)) {
    status.textContent = t('pm.denied');
    return;
  }
  status.textContent = t('pm.locating');
  navigator.geolocation.getCurrentPosition(
    async (pos) => {
      state.me = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      renderList();
      if (map && L) {
        meMarker?.remove();
        meMarker = L.circleMarker([state.me.lat, state.me.lng], { radius: 7, color: '#fff', weight: 3, fillColor: '#3b82f6', fillOpacity: 1 }).addTo(map);
        syncMarkers();
      }
    },
    () => {
      status.textContent = t('pm.denied');
    },
    { enableHighAccuracy: false, timeout: 15000, maximumAge: 300000 },
  );
});

const suggest = () => {
  ($('pm-suggest') as HTMLAnchorElement).href = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(t('pm.suggestText', { site: SITE_NAME }))}`;
};

function renderAll() {
  renderZones();
  renderList();
  renderRoutes();
  suggest();
}
renderAll();
onLangChange(renderAll);
// Approved bookings arrive from the API after first paint.
addEventListener('sponsors:update', () => renderList());

// Last, so it animates the final rendered content.
initMotion();
