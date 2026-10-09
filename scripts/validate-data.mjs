// Validates /data/*.json so a typo in a hand edit fails the build instead of the site.
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const load = (f) => JSON.parse(readFileSync(resolve(root, 'data', f), 'utf8'));
const errors = [];
const err = (m) => errors.push(m);
const isDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));

// Sponsors
const SLOTS = ['dhak', 'countdown', 'spotlight', 'map-partner', 'pandal-nearby'];
const sponsors = load('sponsors.json').sponsors;
const ids = new Set();
for (const s of sponsors) {
  const at = `sponsors[${s.id}]`;
  if (!s.id || ids.has(s.id)) err(`${at}: missing or duplicate id`);
  ids.add(s.id);
  if (!SLOTS.includes(s.slot)) err(`${at}: slot must be one of ${SLOTS.join(', ')}`);
  for (const k of ['name', 'tagline']) if (!s[k]) err(`${at}: ${k} required`);
  if (!isDate(s.startDate) || !isDate(s.endDate)) err(`${at}: startDate/endDate must be YYYY-MM-DD`);
  if (s.startDate > s.endDate) err(`${at}: startDate after endDate`);
  if (typeof s.active !== 'boolean') err(`${at}: active must be true/false`);
  if (s.link && !/^https:\/\//.test(s.link)) err(`${at}: link must start with https://`);
  if (s.whatsapp && !/^\d{10,15}$/.test(s.whatsapp)) err(`${at}: whatsapp must be digits incl. country code`);
  if (s.logo && !existsSync(resolve(root, 'public', s.logo.replace(/^\//, '')))) err(`${at}: logo file not found in public/`);
}

// Playlists
for (const list of load('playlists.json').lists) {
  for (const t of list.items) {
    const at = `playlists[${list.id}] "${t.title}"`;
    if (!['youtube', 'spotify'].includes(t.platform)) err(`${at}: platform must be youtube|spotify`);
    if (t.platform === 'youtube' && !/^https:\/\/www\.youtube\.com\/watch\?v=[\w-]{11}$/.test(t.url)) err(`${at}: bad YouTube URL`);
    if (t.platform === 'spotify' && !/^https:\/\/open\.spotify\.com\/(track|album|playlist)\/\w+$/.test(t.url)) err(`${at}: bad Spotify URL`);
  }
}

// Pandals (Phase 2)
if (existsSync(resolve(root, 'data/pandals.json'))) {
  const ZONES = ['North Kolkata', 'South Kolkata', 'Central', 'Salt Lake–New Town', 'North 24 Parganas', 'South 24 Parganas', 'Howrah', 'Hooghly', 'Nadia', 'Bankura', 'Siliguri', 'Jalpaiguri', 'Cooch Behar'];
  const { pandals, routes = [] } = load('pandals.json');
  const pids = new Set();
  for (const p of pandals) {
    const at = `pandals[${p.id}]`;
    if (!p.id || pids.has(p.id)) err(`${at}: missing or duplicate id`);
    pids.add(p.id);
    for (const k of ['name_bn', 'name_en', 'area', 'source']) if (!p[k]) err(`${at}: ${k} required`);
    if (!ZONES.includes(p.zone)) err(`${at}: zone must be one of ${ZONES.join(' | ')}`);
    if (typeof p.lat !== 'number' || typeof p.lng !== 'number') err(`${at}: lat/lng must be numbers`);
    // Rough bounding box for West Bengal.
    else if (p.lat < 21.4 || p.lat > 27.3 || p.lng < 85.8 || p.lng > 89.9) err(`${at}: coordinates outside West Bengal`);
    if (typeof p.verified !== 'boolean') err(`${at}: verified must be true/false`);
  }
  for (const r of routes) {
    for (const id of r.stops) if (!pids.has(id)) err(`routes[${r.id}]: unknown pandal ${id}`);
    if (r.stops.length < 2 || r.stops.length > 10) err(`routes[${r.id}]: needs 2–10 stops`);
  }
  for (const s of sponsors) for (const id of s.pandalIds ?? []) if (!pids.has(id)) err(`sponsors[${s.id}]: unknown pandalId ${id}`);
}

if (errors.length) {
  console.error('Data validation failed:\n - ' + errors.join('\n - '));
  process.exit(1);
}
console.log('data ok');
