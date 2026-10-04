# Assets, sources and licences

The site hosts no copyrighted audio or images from third parties. Everything visual below was made for this project. Nothing was copied from agomoni-in.vercel.app or any other site.

## Made for this project (original)

| Asset | Where | How it was made | Licence |
|---|---|---|---|
| Favicon | `public/favicon.svg` | Hand-written SVG: dawn arc, sun, crescent | Original, © site owner |
| App icons | `public/icons/icon-192.png`, `icon-512.png`, `maskable-512.png`, `apple-touch-icon.png` | Hand-written SVG in `scripts/make-og.mjs`, rendered with resvg-js | Original, © site owner |
| OG image | `public/og.jpg` (1200×630) | Background art: hand-written SVG (`scripts/og-art.svg`) with stars, horizon, sun and kash grass. Text drawn on canvas in the browser (`scripts/og.html`) using the fonts below | Original, © site owner |
| Header logo mark | `partials/header.html` (inline SVG) | Hand-written SVG | Original |
| Animated backdrop (stars, mist, falling shiuli flowers) | `src/features/backdrop.ts`, `src/styles.css` | Shiuli drawn as an original 6-petal SVG; animation in CSS. Mood requested by the owner; no code, values or assets taken from any other site | Original |
| Maa Durga face (background) | `src/features/durga.ts` | Hand-written SVG in the Kolkata pratima style (shola mukut, trinayan, fish-shaped eyes, nath, jhumka, halo). Drawn from scratch; no photo, idol image or third-party artwork traced or copied. CSS animation: eyes painted in on load (chokkhu daan), slow halo turn, breathing glow | Original, © site owner |
| Dhak illustration | `index.html` (inline SVG) | Hand-written SVG | Original |
| Dhak sound | `src/features/dhak.ts` | Synthesised live with the Web Audio API: sine "membrane" with a pitch drop, filtered noise for the skin slap and stick crack. No samples | Original, no third-party audio |
| Dhak rhythm pattern | `src/features/dhak.ts` | Original 8-beat pattern | Original |
| UPI QR code | generated in the browser at runtime | `qrcode-generator` library, from config values | n/a |
| All copy (Bengali and English) | `src/lib/strings.ts`, HTML | Written for this project | Original |

## Provided by the site owner

| Asset | Where | Notes | Licence |
|---|---|---|---|
| Hero illustration: pandal at dusk with dhakis and the Durga idol | Source `assets-src/hero-pandal.png` (1672×941); derived `public/hero/*` (landscape 640–1672 px and a portrait crop for phones, in AVIF, WebP and JPEG, made by `scripts/make-hero.mjs`) | Supplied by Pritam on 2026-10-04. Origin not recorded; it looks AI-generated | **To confirm:** Pritam must confirm the image's source and that it may be used commercially. If it came from an AI tool, check that tool's terms |
| Pandal-route night illustration (queue to a pandal, food stall, volunteers) — background of `/pandals/` | Source `assets-src/bg-pandals.png` (1672×940); derived `public/bg/pandals/*` (same responsive set, portrait crop centred at 78%) | Supplied by Pritam on 2026-10-04. Origin not recorded; it looks AI-generated | **To confirm:** same as above |

## Third-party (used, not modified)

| Asset | Source | Licence |
|---|---|---|
| Hind Siliguri font | Google Fonts (Indian Type Foundry), loaded from fonts.googleapis.com | SIL Open Font License 1.1 |
| Noto Serif Bengali font | Google Fonts (Noto Project), loaded from fonts.googleapis.com; also used to draw the OG text | SIL Open Font License 1.1 |
| Leaflet 1.9.4 | npm `leaflet` | BSD-2-Clause |
| hls.js 1.7 (light build) | npm `hls.js` | Apache-2.0 |
| qrcode-generator 2.0 | npm `qrcode-generator` (Kazuhiko Arase) | MIT |
| GSAP 3.15 (core, ScrollTrigger, SplitText) | npm `gsap` (GreenSock / Webflow) | GSAP Standard "no charge" licence: free, including commercial use |
| Lenis 1.3 | npm `lenis` (darkroom.engineering) | MIT |
| Map tiles and data | © OpenStreetMap contributors, `tile.openstreetmap.org`. Not hosted by us; attribution shown on the map | Data ODbL; tiles per the OSMF tile usage policy |

## Embedded or linked (never downloaded or hosted)

| Content | Source | Notes |
|---|---|---|
| Live radio (Akashvani Kolkata A "Geetanjali", FM Rainbow Kolkata) | Prasar Bharati official HLS streams, as listed on akashvani.gov.in/radio/live.php | Played directly from their CDN; the service worker never caches or proxies it. No sponsor branding near the player |
| Mahishasuramardini recordings and songs | Official YouTube uploads by Saregama Bengali, Akashvani AIR, SVF / SVF Music, T-Series, Monali Thakur; official Spotify releases and an SVF Music playlist | Embedded only, loaded on tap. See `data/playlists.json` for each item's uploader |
| Pandal coordinates | Looked up one at a time on Google Maps (see `docs/pandal-lookup-log.tsv`) | Facts (lat/lng) recorded by hand; no bulk scraping; no Google imagery used |
