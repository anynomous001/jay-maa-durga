/**
 * Build-time static pages for SEO. After `vite build`, uses dist/policies/index.html as the
 * shell (header, background, shared CSS/JS) and writes:
 *   /pandals/<id>/                one page per pandal in data/pandals.json (/pandals/ itself redirects to /#pandals)
 *   /durga-puja-2026-dates/       Puja calendar with FAQ markup
 *   /en/                          English copy of the home page (strings from src/lib/strings.ts), with hreflang
 * plus a sitemap.xml that lists every page. Not available under `vite dev`: use
 * `npm run build && npm run preview`.
 */
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { makeBatches, nearestStation, walkMinutes } from '../shared/hopping.mjs';

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const json = (o) => JSON.stringify(o).replace(/</g, '\\u003c');

const ZONE_BN = { 'North Kolkata': 'উত্তর কলকাতা', 'South Kolkata': 'দক্ষিণ কলকাতা', Central: 'মধ্য কলকাতা', 'Salt Lake–New Town': 'সল্টলেক–নিউ টাউন', 'North 24 Parganas': 'উত্তর ২৪ পরগনা', 'South 24 Parganas': 'দক্ষিণ ২৪ পরগনা', 'Howrah': 'হাওড়া', 'Hooghly': 'হুগলি', 'Nadia': 'নদিয়া', 'Bankura': 'বাঁকুড়া', 'Purba Medinipur': 'পূর্ব মেদিনীপুর', 'Murshidabad': 'মুর্শিদাবাদ', 'Siliguri': 'শিলিগুড়ি', 'Jalpaiguri': 'জলপাইগুড়ি', 'Cooch Behar': 'কোচবিহার' };
const WEEKDAY = new Intl.DateTimeFormat('en-IN', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });
const WEEKDAY_BN = new Intl.DateTimeFormat('bn-IN', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });

function distanceKm(a, b) {
  const r = (d) => (d * Math.PI) / 180;
  const h = Math.sin(r(b.lat - a.lat) / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(r(b.lng - a.lng) / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
}
const dir = (p, mode) => `https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}&travelmode=${mode}`;

function setMeta(html, attr, key, value) {
  const re = new RegExp(`<meta ${attr}="${key}" content="[^"]*" ?/?>`);
  const tag = `<meta ${attr}="${key}" content="${esc(value)}" />`;
  return re.test(html) ? html.replace(re, tag) : html.replace('</head>', `    ${tag}\n  </head>`);
}

/** First candidate that fits `max` characters (search engines truncate or flag longer titles and descriptions). */
function fitTo(max, options) {
  return options.find((o) => [...o].length <= max) ?? options[options.length - 1];
}

function page(shell, { site, path, title, description, image, imageAlt, main, ld }) {
  const url = site + path;
  let h = shell.replace(/<title>[\s\S]*?<\/title>/, `<title>${esc(title)}</title>`);
  h = setMeta(h, 'name', 'description', description);
  h = h.replace(/<link rel="canonical" href="[^"]*" ?\/?>/, `<link rel="canonical" href="${url}" />`);
  h = setMeta(h, 'property', 'og:title', title);
  h = setMeta(h, 'property', 'og:description', description);
  h = setMeta(h, 'property', 'og:url', url);
  h = setMeta(h, 'property', 'og:image', site + image);
  h = setMeta(h, 'property', 'og:image:alt', imageAlt);
  h = setMeta(h, 'name', 'twitter:title', title);
  h = setMeta(h, 'name', 'twitter:description', description);
  h = setMeta(h, 'name', 'twitter:image', site + image);
  h = setMeta(h, 'name', 'twitter:image:alt', imageAlt);
  h = h.replace(/<main[\s\S]*<\/main>/, () => main);
  const scripts = ld.map((o) => `    <script type="application/ld+json">${json(o)}</script>\n`).join('');
  return h.replace('</head>', () => scripts + '  </head>');
}


/** English copy of the built Bengali home page: swaps every data-i18n* element for its English string. */
function englishHome(html, dict, site, meta) {
  const en = (k) => dict[k]?.en;
  const setAttrs = (tag, pairs) => {
    for (const pair of pairs.split(';')) {
      const [attr, key] = pair.split(':');
      const v = attr && key && en(key);
      if (!v) continue;
      const re = new RegExp(`(\\s${attr}=")[^"]*(")`);
      tag = re.test(tag) ? tag.replace(re, (_, a, b) => a + esc(v) + b) : tag.replace(/^<(\w+)/, (_, n) => `<${n} ${attr}="${esc(v)}"`);
    }
    return tag;
  };
  let h = html.replace(/<(\w+)\b[^>]*\sdata-i18n="([^"]+)"[^>]*>[\s\S]*?<\/\1>/g, (m, tagName, key) => {
    const v = en(key);
    if (v == null) return m;
    const open = m.match(/^<[^>]*>/)[0];
    return open + esc(v) + `</${tagName}>`;
  });
  h = h.replace(/<(\w+)\b[^>]*\sdata-i18n-html="([^"]+)"[^>]*>[\s\S]*?<\/\1>/g, (m, tagName, key) => {
    const v = en(key);
    return v == null ? m : m.match(/^<[^>]*>/)[0] + v + `</${tagName}>`;
  });
  h = h.replace(/<\w+\b[^>]*\sdata-i18n-attr="([^"]+)"[^>]*>/g, (tag, pairs) => setAttrs(tag, pairs));
  h = h.replace('<html lang="bn"', '<html lang="en"');
  h = h.replace(/(id="lang-toggle" class="lang-toggle" )lang="en">English/, '$1lang="bn">বাংলা');
  h = h.replace(/<title>[\s\S]*?<\/title>/, `<title>${esc(meta.title)}</title>`);
  h = setMeta(h, 'name', 'description', meta.description);
  h = h.replace(/<link rel="canonical" href="[^"]*" ?\/?>/, `<link rel="canonical" href="${site}/en/" />`);
  for (const [attr, key, v] of [['property', 'og:title', meta.ogTitle], ['property', 'og:description', meta.ogDescription], ['property', 'og:url', `${site}/en/`], ['property', 'og:locale', 'en_IN'], ['name', 'twitter:title', meta.ogTitle], ['name', 'twitter:description', meta.ogDescription]]) {
    h = setMeta(h, attr, key, v);
  }
  // FAQ structured data in English
  h = h.replace(/<script type="application\/ld\+json">\s*\{\s*"@context": "https:\/\/schema.org",\s*"@type": "FAQPage"[\s\S]*?<\/script>/, () => {
    const q = [1, 2, 3, 4].map((i) => ({ '@type': 'Question', name: en(`faq.q${i}`), acceptedAnswer: { '@type': 'Answer', text: en(`faq.a${i}`) } }));
    return `<script type="application/ld+json">${json({ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: q })}</script>`;
  });
  return h;
}

export default function staticPages() {
  let root = '';
  let outDir = '';
  return {
    name: 'static-pages',
    apply: 'build',
    enforce: 'post',
    configResolved(c) {
      root = c.root;
      outDir = resolve(c.root, c.build.outDir);
    },
    closeBundle() {
      const cfg = readFileSync(resolve(root, 'src/config.ts'), 'utf8');
      const site = cfg.match(/export const SITE_URL = '([^']+)'/)[1];
      const days = new Function('return ' + cfg.match(/export const PUJA_DAYS: PujaDay\[\] = (\[[\s\S]*?\n\]);/)[1])();
      const { pandals } = JSON.parse(readFileSync(resolve(root, 'data/pandals.json'), 'utf8'));
      const shell = readFileSync(resolve(outDir, 'policies/index.html'), 'utf8');
      const { stations } = JSON.parse(readFileSync(resolve(root, 'data/stations.json'), 'utf8'));
      const batches = makeBatches(pandals, stations);
      const batchOf = new Map(batches.flatMap((b) => b.stops.map((id) => [id, b])));
      const byId = new Map(pandals.map((p) => [p.id, p]));
      const stLabel = (hit) => `${hit.station.name_en} ${hit.station.kind === 'metro' ? 'metro' : 'railway'} station`;
      const stLabelBn = (hit) => `${hit.station.name_bn} ${hit.station.kind === 'metro' ? 'মেট্রো' : 'রেল'} স্টেশন`;
      const stDist = (hit) => (hit.km < 1 ? `${Math.round(hit.km * 1000)} m` : `${hit.km.toFixed(1)} km`) + (hit.km <= 2 ? `, about ${walkMinutes(hit.km)} min on foot` : '');
      const today = new Date().toISOString().slice(0, 10);
      const write = (path, html) => {
        const file = resolve(outDir, path.slice(1), 'index.html');
        mkdirSync(dirname(file), { recursive: true });
        writeFileSync(file, html);
      };
      const crumbs = (items) => ({
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: items.map(([name, path], i) => ({ '@type': 'ListItem', position: i + 1, name, item: site + path })),
      });
      const shashthi = days.find((d) => d.id === 'shashthi').dates[0];
      const dashami = days.find((d) => d.id === 'dashami').dates[0];
      const fmt = (iso, f = WEEKDAY) => f.format(new Date(iso + 'T12:00:00Z'));
      const fmtShort = (iso) => fmt(iso).replace(/^\w+, /, '');
      const fmtShortBn = (iso) => fmt(iso, WEEKDAY_BN).replace(/^[^,]+, /, '');
      const puja = `Durga Puja 2026 runs from Shashthi on ${fmtShort(shashthi)} to Bijoya Dashami on ${fmtShort(dashami)}.`;
      const pujaBn = `২০২৬-এর দুর্গাপুজো ${fmtShortBn(shashthi)} (ষষ্ঠী) থেকে ${fmtShortBn(dashami)} (বিজয়া দশমী) পর্যন্ত।`;

      // ── One page per pandal ──────────────────────────────────────────────
      for (const p of pandals) {
        const path = `/pandals/${p.id}/`;
        const zoneBn = ZONE_BN[p.zone] ?? p.zone;
        const near = pandals
          .filter((q) => q.id !== p.id)
          .map((q) => ({ q, d: distanceKm(p, q) }))
          .sort((a, b) => a.d - b.d)
          .slice(0, 5);
        const st = nearestStation(p, stations);
        const metro = st ? ` The nearest station is ${stLabel(st)} (${stDist(st)}).` : '';
        const metroBn = st ? ` কাছের স্টেশন: ${stLabelBn(st)}।` : '';
        const metroShort = st ? ` Nearest station: ${stLabel(st)}.` : '';
        const batch = batchOf.get(p.id);
        const batchHTML = batch
          ? `<h3>See it in a batch of ${batch.stops.length} pandals close together <span lang="bn">· কাছাকাছি ${batch.stops.length}টি প্যান্ডেল একসাথে</span></h3>
        <p>About ${batch.walkKm.toFixed(1)} km on foot, ${Math.round(batch.minutes / 15) / 4} hours with time at each pandal${batch.start ? `, starting from ${esc(stLabel(batch.start))}` : ''}.</p>
        <ol>${batch.stops.map((id) => byId.get(id)).map((q) => `<li>${q.id === p.id ? `<strong>${esc(q.name_en)}</strong>` : `<a href="/pandals/${esc(q.id)}/">${esc(q.name_en)}</a>`} <span lang="bn">${esc(q.name_bn)}</span></li>`).join('')}</ol>
        <p><a href="/#b-${esc(batch.id)}">Open this batch on the map with Google Maps routes →</a></p>`
          : '';
        const approx = p.verified
          ? ''
          : `<p class="muted small">⚠ The map pin for this pandal is approximate; confirm the exact spot locally before you set out. <span lang="bn">(অবস্থান আনুমানিক)</span></p>`;
        const main = `<main id="main" class="policies static-page">
      <section class="page-head">
        <p class="muted small"><a href="/#pandals">Pandal map 2026</a> › ${esc(p.zone)}</p>
        <h1>${esc(p.name_en)} Durga Puja 2026 <span lang="bn">${esc(p.name_bn)}</span></h1>
        <p class="lead">${esc(p.name_en)} is a Durga Puja in ${esc(p.area)}, ${esc(p.zone)}.${esc(metro)} Below: the location, walking, driving and public-transport directions, and other pandals nearby. ${esc(puja)}</p>
        <p class="lead" lang="bn">${esc(p.name_bn)} — ${esc(zoneBn)}র ${esc(p.area)} এলাকার দুর্গাপুজো।${esc(metroBn)} ${esc(pujaBn)}</p>
      </section>

      <section class="panel">
        <h2>Location and directions <span lang="bn">· ঠিকানা ও রাস্তা</span></h2>
        <ul>
          <li>Area: ${esc(p.area)}</li>
          <li>Zone: ${esc(p.zone)} <span lang="bn">(${esc(zoneBn)})</span></li>
          ${st ? `<li>Nearest station: ${esc(stLabel(st))} · ${esc(stDist(st))} <span lang="bn">(${esc(stLabelBn(st))})</span></li>` : ''}
        </ul>
        ${approx}
        <p class="btn-row">
          <a class="btn btn-sm" href="${dir(p, 'walking')}" target="_blank" rel="noopener">Walk <span lang="bn">· হেঁটে</span></a>
          <a class="btn btn-ghost btn-sm" href="${dir(p, 'driving')}" target="_blank" rel="noopener">Drive <span lang="bn">· গাড়িতে</span></a>
          <a class="btn btn-ghost btn-sm" href="${dir(p, 'transit')}" target="_blank" rel="noopener">Public transport <span lang="bn">· ট্রানজিট</span></a>
          <a class="btn btn-ghost btn-sm" href="/#p-${esc(p.id)}">Show on the map <span lang="bn">· ম্যাপে দেখুন</span></a>
        </p>
      </section>

      <section class="panel">
        <h2>Pandals nearby <span lang="bn">· আশপাশের প্যান্ডেল</span></h2>
        <ul>
          ${near.map(({ q, d }) => `<li><a href="/pandals/${esc(q.id)}/">${esc(q.name_en)}</a> <span lang="bn">${esc(q.name_bn)}</span> · ${d.toFixed(1)} km</li>`).join('\n          ')}
        </ul>
        ${batchHTML}
        <p><a href="/#pandals">Pandals near you and a walking route →</a></p>
      </section>

      <section class="panel">
        <h2>Puja dates 2026 <span lang="bn">· পুজোর তারিখ</span></h2>
        <p>${esc(puja)} <a href="/durga-puja-2026-dates/">Full Durga Puja 2026 calendar →</a></p>
        <p><a href="/">Pandal map, walking routes and greeting cards →</a></p>
      </section>
    </main>`;
        const place = {
          '@context': 'https://schema.org',
          '@type': 'Place',
          name: `${p.name_en} Durga Puja`,
          alternateName: p.name_bn,
          address: { '@type': 'PostalAddress', addressLocality: p.area, addressRegion: 'West Bengal', addressCountry: 'IN' },
          url: site + path,
          ...(p.verified ? { geo: { '@type': 'GeoCoordinates', latitude: p.lat, longitude: p.lng } } : {}),
        };
        write(
          path,
          page(shell, {
            site,
            path,
            title: fitTo(60, [`${p.name_en} Durga Puja 2026 | Ma Aschen`, `${p.name_en} Durga Puja 2026`, p.name_en]),
            description: fitTo(155, [
              `${p.name_en} (${p.name_bn}) Durga Puja 2026 in ${p.area}, ${p.zone}.${metroShort} Map location, directions and nearby pandals.`,
              `${p.name_en} Durga Puja 2026 in ${p.area}, ${p.zone}.${metroShort} Map location, directions and nearby pandals.`,
              `${p.name_en} Durga Puja 2026 in ${p.area}. Map location, directions and nearby pandals.`,
            ]),
            image: '/og-pandals.jpg',
            imageAlt: 'A lit Durga Puja pandal in Kolkata at night',
            main,
            ld: [place, crumbs([['Ma Aschen', '/'], [p.name_en, path]])],
          }),
        );
      }

      // ── Puja dates page ──────────────────────────────────────────────────
      const datesPath = '/durga-puja-2026-dates/';
      const faq = [
        ['When is Durga Puja 2026?', puja],
        ['Why does Saptami span two days in 2026?', 'By the Bisuddha Siddhanta panjika, Saptami falls across two calendar days this year. The Gupta Press panjika runs one day earlier from Ashtami, so check which panjika your local committee follows.'],
      ];
      const main = `<main id="main" class="policies static-page">
      <section class="page-head">
        <h1>Durga Puja 2026 dates <span lang="bn">দুর্গাপুজো ২০২৬ তারিখ</span></h1>
        <p class="lead">${esc(puja)}</p>
        <p class="lead" lang="bn">${esc(pujaBn)}</p>
      </section>
      <section class="panel">
        <h2>Calendar <span lang="bn">· নির্ঘণ্ট</span></h2>
        <ol>
          ${days.map((d) => `<li><strong>${esc(d.name_en)}</strong> <span lang="bn">${esc(d.name_bn)}</span> — ${d.dates.map((x) => `<time datetime="${x}">${esc(fmt(x))}</time>`).join(' and ')}</li>`).join('\n          ')}
        </ol>
        <p class="muted small">Dates follow the Bisuddha Siddhanta panjika (Saptami spans two days this year). Gupta Press panjika runs one day earlier from Ashtami. <span lang="bn">তারিখ বিশুদ্ধ সিদ্ধান্ত পঞ্জিকা অনুযায়ী।</span></p>
      </section>
      <section class="panel">
        <h2>Questions <span lang="bn">· প্রশ্নোত্তর</span></h2>
        ${faq.map(([q, a]) => `<h3>${esc(q)}</h3><p>${esc(a)}</p>`).join('\n        ')}
      </section>
      <section class="panel">
        <p><a href="/#pandals">Pandal map: pandals near you →</a> · <a href="/">Ma Aschen home →</a></p>
      </section>
    </main>`;
      write(
        datesPath,
        page(shell, {
          site,
          path: datesPath,
          title: 'Durga Puja 2026 Dates: Shashthi to Dashami | Ma Aschen',
          description: `${puja} Day-by-day calendar from Shashthi to Bijoya Dashami.`,
          image: '/og-pandals.jpg',
          imageAlt: 'A lit Durga Puja pandal in Kolkata at night',
          main,
          ld: [
            { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faq.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) },
            crumbs([['Ma Aschen', '/'], ['Durga Puja 2026 dates', datesPath]]),
          ],
        }),
      );


      // ── English home page (/en/) + hreflang ─────────────────────────────
      const stringsSrc = readFileSync(resolve(root, 'src/lib/strings.ts'), 'utf8');
      const dict = new Function('return ' + stringsSrc.slice(stringsSrc.indexOf('= {', stringsSrc.indexOf('export const dict')) + 2, stringsSrc.lastIndexOf('};') + 1))();
      const home = readFileSync(resolve(outDir, 'index.html'), 'utf8');
      write(
        '/en/',
        englishHome(home, dict, site, {
          title: 'Durga Puja 2026 Pandal Map: Pandals Near Me | Ma Aschen',
          description: 'Durga Puja 2026: 60+ pujas in Kolkata and West Bengal on one map. Find pandals near you, the nearest metro, directions and a walking route.',
          ogTitle: 'Happy Durga Puja 2026 — pandal map: pandals near you',
          ogDescription: '60+ pujas in Kolkata and beyond on one map: find pandals near you, the nearest metro and a walking route.',
        }),
      );

      // ── Structured data must parse (Google rejects the whole block otherwise) ──
      const broken = [];
      const walk = (dir) => {
        for (const e of readdirSync(dir, { withFileTypes: true })) {
          const f = resolve(dir, e.name);
          if (e.isDirectory()) walk(f);
          else if (e.name.endsWith('.html'))
            for (const m of readFileSync(f, 'utf8').matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
              try {
                JSON.parse(m[1]);
              } catch (err) {
                broken.push(`${f.slice(outDir.length)}: ${err.message}`);
              }
            }
        }
      };
      walk(outDir);
      if (broken.length) throw new Error('Invalid JSON-LD:\n' + broken.join('\n'));

      // ── Sitemap ─────────────────────────────────────────────────────────
      const urls = [
        ['/', 'daily', '1.0', true],
        ['/en/', 'daily', '1.0', true],
        [datesPath, 'weekly', '0.9'],
        ...pandals.map((p) => [`/pandals/${p.id}/`, 'weekly', '0.6']),
        ['/policies/', 'monthly', '0.3'],
      ];
      writeFileSync(
        resolve(outDir, 'sitemap.xml'),
        `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${urls
          .map(([u, f, pr, alt]) => {
            const links = alt
              ? `<xhtml:link rel="alternate" hreflang="bn" href="${site}/" /><xhtml:link rel="alternate" hreflang="en" href="${site}/en/" /><xhtml:link rel="alternate" hreflang="x-default" href="${site}/" />`
              : '';
            return `  <url><loc>${site}${u}</loc>${links}<lastmod>${today}</lastmod><changefreq>${f}</changefreq><priority>${pr}</priority></url>`;
          })
          .join('\n')}\n</urlset>\n`,
      );
    },
  };
}
