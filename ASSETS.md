# Assets, sources and licences

The site hosts no copyrighted audio or images from third parties. Everything visual below was made for this project. Nothing was copied from agomoni-in.vercel.app or any other site.

## Made for this project (original)

| Asset | Where | How it was made | Licence |
|---|---|---|---|
| OG image | `public/og.jpg` (1200×630) | Background art: hand-written SVG (`scripts/og-art.svg`) with stars, horizon, sun and kash grass. Text drawn on canvas in the browser (`scripts/og.html`) using the fonts below | Original, © site owner |
| Animated backdrop (stars, mist, falling shiuli flowers) | `src/features/backdrop.ts`, `src/styles.css` | Shiuli drawn as an original 6-petal SVG; animation in CSS. Mood requested by the owner; no code, values or assets taken from any other site | Original |
| Maa Durga face (background) | `src/features/durga.ts` | Hand-written SVG in the Kolkata pratima style (shola mukut, trinayan, fish-shaped eyes, nath, jhumka, halo). Drawn from scratch; no photo, idol image or third-party artwork traced or copied. CSS animation: eyes painted in on load (chokkhu daan), slow halo turn, breathing glow | Original, © site owner |
| Dhak illustration | `index.html` (inline SVG) | Hand-written SVG | Original |
| Dhak fallback sound | `src/features/dhak.ts` | Web Audio synthesis, used only if the recorded clips fail to load | Original |
| Dhak rhythm pattern | `src/features/dhak.ts` | Original 8-beat pattern | Original |
| All copy (Bengali and English) | `src/lib/strings.ts`, HTML | Written for this project | Original |

## Provided by the site owner

| Asset | Where | Notes | Licence |
|---|---|---|---|
| Hero illustration: pandal at dusk with dhakis and the Durga idol | Source `assets-src/hero-pandal.png` (1672×941); derived `public/hero/*` (landscape 640–1672 px and a portrait crop for phones, in AVIF, WebP and JPEG, made by `scripts/make-hero.mjs`) | Supplied by Pritam on 2026-10-04. Origin not recorded; it looks AI-generated | **To confirm:** Pritam must confirm the image's source and that it may be used commercially. If it came from an AI tool, check that tool's terms |
| Logo: "Durga eyes" (cream brush-stroke eyes + third eye on red) | Source `assets-src/logo-eyes.png` (1672×941). Derived by `scripts/make-logo.mjs`: the cream motif is lifted out by brightness and centred on a red square → `public/favicon-32.png`, `favicon-64.png`, `public/logo/logo-72/108.{png,webp}` (header), `public/icons/icon-192/512.png`, `maskable-512.png`, `apple-touch-icon.png` (also used as lock-screen artwork) | Supplied by Pritam on 2026-10-04. Origin not recorded | **To confirm:** same as above — especially important for a logo |
| Pandal-route night illustration (queue to a pandal, food stall, volunteers) — background of `/pandals/` | Source `assets-src/bg-pandals.png` (1672×940); derived `public/bg/pandals/*` (same responsive set, portrait crop centred at 78%) | Supplied by Pritam on 2026-10-04. Origin not recorded; it looks AI-generated | **To confirm:** same as above |
| Durga Puja aarti illustration (priest with the dhunuchi before the idol, crowd in front) — background of `/policies/` | Source `assets-src/bg-policies.png` (1672×941); derived `public/bg/policies/*` (same responsive set, portrait crop centred at 66%) | Supplied by Pritam on 2026-10-04. Origin not recorded; it looks AI-generated | **To confirm:** same as above |

## Third-party recordings (Creative Commons, attribution required)

| Asset | Where | Source | Licence |
|---|---|---|---|
| Dhak (one-stroke clips and a 10 s rhythm) | `public/audio/dhak-hits.m4a`, `public/audio/dhak-rhythm.m4a`, offsets in `public/audio/dhak.json`; source kept at `assets-src/dhak/durga-puja-dhak-dhol-mamta-dhody.ogg` | "Durga Puja Dhak Dhol" by **Mamta Jagdish Dhody**, Wikimedia Commons: <https://commons.wikimedia.org/wiki/File:Durga_Puja_Dhak_Dhol.ogg> | **CC BY-SA 4.0.** Changes: mono mix, cut into short clips, normalised (`scripts/dhak.html`, `scripts/encode-dhak.sh`). The derived clips are shared under the same CC BY-SA 4.0 licence. Credit shown in the Dhak sheet. Approved by Pritam on 2026-10-04 as an exception to the CC0-only rule |

Two other Commons dhak recordings were downloaded for comparison only and are not used: `puja-dhak-tito-dutta.ogg` (Tito Dutta, CC BY-SA 3.0) and `rhythm-of-dhak-sumita-roy-dutta.mp3` (Sumita Roy Dutta, CC BY-SA 4.0).

## Third-party (used, not modified)

| Asset | Source | Licence |
|---|---|---|
| Hind Siliguri font | Google Fonts (Indian Type Foundry), loaded from fonts.googleapis.com | SIL Open Font License 1.1 |
| Noto Serif Bengali font | Google Fonts (Noto Project), loaded from fonts.googleapis.com; also used to draw the OG text | SIL Open Font License 1.1 |
| Leaflet 1.9.4 | npm `leaflet` | BSD-2-Clause |
| hls.js 1.7 (light build) | npm `hls.js` | Apache-2.0 |
| GSAP 3.15 (core, ScrollTrigger, SplitText) | npm `gsap` (GreenSock / Webflow) | GSAP Standard "no charge" licence: free, including commercial use |
| Lenis 1.3 | npm `lenis` (darkroom.engineering) | MIT |
| Razorpay Checkout | `checkout.razorpay.com/v1/checkout.js`, loaded only when an advertiser pays | Razorpay's terms |
| Map tiles and data | © OpenStreetMap contributors, `tile.openstreetmap.org`. Not hosted by us; attribution shown on the map | Data ODbL; tiles per the OSMF tile usage policy |

## Embedded or linked (never downloaded or hosted)

| Content | Source | Notes |
|---|---|---|
| Live radio (Akashvani Kolkata A "Geetanjali", FM Rainbow Kolkata) | Prasar Bharati official HLS streams, as listed on akashvani.gov.in/radio/live.php | Played directly from their CDN; the service worker never caches or proxies it. No sponsor branding near the player |
| Mahishasuramardini recordings and songs | Official YouTube uploads by Saregama Bengali, Akashvani AIR, SVF / SVF Music, T-Series, Monali Thakur; official Spotify releases and an SVF Music playlist | Embedded only, loaded on tap. See `data/playlists.json` for each item's uploader |
| Pandal coordinates | Looked up one at a time on Google Maps (see `docs/pandal-lookup-log.tsv`) | Facts (lat/lng) recorded by hand; no bulk scraping; no Google imagery used |
