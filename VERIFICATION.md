# Verification log

Tested on 4 October 2026 against `npm run dev` (port 5173) and the production build (`npm run build && npm run preview`, port 4173).

**Browsers used.** Claude in Chrome was not connected in this session, and Pritam approved this fallback:
- the **T3 Code preview browser** (Chromium 152, desktop 1280×800);
- **Google Chrome driven headlessly by puppeteer**, for the desktop (1280×800) and mobile (390×844, DPR 2, touch, Android UA) viewports and for time-zone and geolocation emulation.

**Not covered.** No real phones were used. Lock-screen controls, background playback and calendar imports on actual iOS and Android devices still need a manual check (see "To do on a real phone").

Screenshots and Lighthouse reports are in `docs/verification/`.

## Phase 1 — Mahalaya

| # | Feature | How it was tested | Desktop | Mobile 390px | Result |
|---|---|---|---|---|---|
| 1 | **Live stream plays** | Pressed Play in the preview browser: `readyState` 4, `currentTime` advancing, LIVE badge shown. Channels tested: Kolkata A (`hlspbaudio055`) and FM Rainbow Kolkata (`hlspbaudio058`) | ✅ | ✅ (headless, wake test) | **Pass** |
| 1a | Stream reachable from a third-party page | `curl` with `Origin: http://localhost:5173` on the master playlist, variant playlist and segment. Results: HTTPS, `access-control-allow-origin: *`, `application/vnd.apple.mpegurl`, `audio/x-aac` (ADTS AAC 22 kHz) | — | — | **Pass** |
| 1b | hls.js path (Firefox / older Chrome) | `?hlsjs`: plays through MediaSource with AAC segments | ✅ | — | **Pass** |
| 1c | Auto-retry with backoff and fallback | Dev hook pointed the player at a non-existent URL. Observed retries at 2 → 4 → 8 → 15 s (cap 30 s), a Bengali countdown status, and the official fallbacks highlighted after the 3rd failure | ✅ | — | **Pass** |
| 1d | Media Session | `navigator.mediaSession.metadata.title` is "Mahishasuramardini — Live" from 1 h before transmission until 05:45 IST (checked with `?now=`), and "<channel> — Live" otherwise. `playbackState` follows the player | ✅ | ✅ | **Pass** (lock-screen look not seen on a real phone) |
| 1e | No sponsors on or around the broadcast | Visual check: the radio section has no sponsor slot | ✅ | ✅ (`m-radio.png`) | **Pass** |
| 2 | **Wake me** | Loaded `?now=2026-10-10T03:49:45+05:30` on a mobile viewport, tapped the switch (real touch), waited. Status said "will play at Sat 10 Oct 3:50 am, screen will stay awake" (Wake Lock granted). At 03:50 the stream started on its own with `state: playing` and the media title set. Bug found and fixed: the silent unlock clip briefly showed "playing" | — | ✅ (`m-wake-fired.png`) | **Pass** |
| 3a | **Google Calendar link** | URL has `dates=20261009T222000Z/20261010T001500Z` (03:50–05:45 IST) and the Bengali title and details. Shashthi is an all-day event, 2026-10-16 | ✅ | ✅ | **Format pass.** Not imported: needs a Google login |
| 3b | **.ics files** | Generated in-page and parsed with Python `icalendar`. Mahalaya: 03:50–05:45 IST (= 23:20 BST London on 9 Oct), alarms at 0 and −10 min. Shashthi: all-day 16 Oct. CRLF line endings, lines folded at ≤75 octets, Bengali intact after unfolding | — | — | **Pass** (not imported into a real calendar app) |
| 3c | WhatsApp share | `https://wa.me/?text=…` with a pre-filled Bengali message and the site URL | ✅ | ✅ | **Link format pass** (no message sent) |
| 4 | **Countdown in IST and other zones** | Headless Chrome with emulated time zones. Every zone showed the same remaining time (5 d 14 h 39 m) and "Sat 10 Oct · 3:50 am" IST. Local time shown: London "Fri 9 Oct · 11:20 pm (GMT+1)", New York "Fri 9 Oct · 6:20 pm (EDT)", Dubai "Sat 10 Oct · 2:20 am (GMT+4)". Kolkata hides the local row | ✅ | ✅ | **Pass** |
| 4a | Countdown phases | `?now=`: 10 Oct 04:30 → "On air now"; 12 Oct → Shashthi countdown; 17 Oct and 18 Oct 23:59 → "Today is Maha Saptami"; 21 Oct → Bijoya Dashami; 22 Oct → "Shubho Bijoya". Hero copy changes from Mahalaya to Sharodiya to Bijoya | ✅ | ✅ (`m-hero-saptami.png`) | **Pass** |
| 4b | Schedule "today" / "in N days" | Same `?now=` runs: Mahalaya "Today" on 10 Oct; Saptami "Today" on both 17 and 18 Oct; past days "Done" | ✅ | ✅ | **Pass** |
| 5 | Playlists | Every YouTube item checked through oEmbed (owner and embedding allowed; 4 non-embeddable uploads swapped out). Spotify items checked through the embed data. Iframes are created only on tap | ✅ | ✅ | **Pass** |
| 6 | **Dhak** | Pointer and keyboard both trigger it; the animation class is applied. Sound rendered through an `OfflineAudioContext` stand-in: peak 0.42 (no clipping), ~380 ms audible, ~140 Hz fundamental | ✅ | ✅ | **Pass** |
| 7 | Sponsor slots | Tota Cake House shows in the dhak slot with "স্পনসর / Sponsored"; empty slots show the "Advertise here" CTA linking to `/advertise/#slot-…` | ✅ | ✅ | **Pass** |
| 7a | **UPI link and QR** | Link: `upi://pay?pa=9874353532@upi&pn=Pritam&cu=INR&am=99.00&tn=Mahalaya%20Live%20sponsor%20-%20countdown`. The QR was decoded with the browser's `BarcodeDetector` and matches the link exactly. Booked slots are disabled in the picker | ✅ | ✅ (`m-advertise-pay.png`) | **Pass** (no real payment made) |
| 8 | SEO | Title and description cover Mahalaya 2026 live / live radio in Bengali and English. JSON-LD Event (03:50–05:45 IST) and FAQPage; `sitemap.xml`; `robots.txt`; OG 1200×630 JPEG (79 KB). Lighthouse SEO 100 | ✅ | ✅ | **Pass** |
| 9 | PWA / service worker | Production preview: page controlled by the SW. Cache holds only our HTML, JS, CSS and icons. While the stream played, no `.m3u8`, `.aac` or bitgravity entries were cached | ✅ | — | **Pass** |
| 10 | Analytics placeholder | `ANALYTICS.enabled = false`, so no beacon request is made. Listener-count hook hidden | ✅ | — | **Pass** |
| — | Bilingual toggle | Bengali ↔ English: all strings, `<html lang>`, and the sponsor label switch | ✅ | ✅ | **Pass** |
| — | Accessibility | No unlabeled controls (script check); skip link; reduced-motion CSS; Lighthouse Accessibility 100 on every page | ✅ | ✅ | **Pass** |

## Phase 2 — Pandal map

| # | Feature | How it was tested | Desktop | Mobile | Result |
|---|---|---|---|---|---|
| 1 | Data | 51 pandals (26 North, 25 South), each looked up individually on Google Maps; see `docs/pandal-lookup-log.tsv`. 2 are `verified: false`. `validate-data` passes | — | — | **Pass** |
| 2 | Map and pins | 51 circle markers, OSM attribution visible, pins cluster where expected (riverside North, Lake Town / Dum Dum Park, Ballygunge / Kalighat / Behala) | ✅ (`d-pandals.png`) | ✅ (`m-pandals-map.png`) | **Pass** |
| 3 | Lazy Leaflet | On the mobile list view no Leaflet request is made until "Map" is tapped | — | ✅ | **Pass** |
| 4 | Zone filter and search | "kalighat" matches by area or metro (6 results). Zone chips filter the list, markers and routes | ✅ | ✅ | **Pass** |
| 5 | Near me | Emulated location at Gariahat: list sorted (Ekdalia 0.3 km, Singhi Park 0.4 km…), blue "you" marker. Permission denied: friendly message, list unchanged | ✅ | ✅ | **Pass** |
| 6 | **Directions open the right place** | On the 390 px viewport, Bagbazar's Directions opened Google Maps with destination `22.6044897, 88.3656150` and offered to open the app (Android hand-off). Each pin is Google's own place pin for the named listing (log). Reverse lookups of 3 pins return the same coordinates | — | ✅ (`m-directions-bagbazar.png`) | **Pass** |
| 7 | Routes | 7 routes. Legs are split evenly to ≤3 waypoints (Google's mobile limit, confirmed in the Maps URLs docs). The first route opened as a 1.2 km / 17 min walk with all stops | ✅ | ✅ (`m-route-north-heritage.png`) | **Pass** |
| 8 | "Eat nearby" slot and suggest link | CTA on every card links to the advertise page. WhatsApp suggest link is pre-filled | ✅ | ✅ | **Pass** |

## Phase 3 — Greeting card

Removed at Pritam's request ("no need for greeting card"), along with its sponsor slot.

## Lighthouse (mobile, production build)

| Page | Performance | Accessibility | Best practices | SEO | LCP | CLS |
|---|---|---|---|---|---|---|
| `/` | 99 | 100 | 100 | 100 | 1.6 s | 0.035 |
| `/pandals/` | 100 | 100 | 100 | 100 | 1.5 s | 0.006 |
| `/advertise/` | 100 | 100 | 100 | 100 | 1.5 s | 0.004 |

The first `/pandals/` run scored Performance 77 (CLS 0.58) and Accessibility 99 (heading order). Both were fixed by reserving space for injected content and adding a list heading; the table shows the re-run.

## To do on a real phone (can't be done here)

1. Android Chrome and iPhone Safari: press Play, lock the screen, and check that audio continues and the lock screen shows "Mahishasuramardini — Live" (it does from 02:50 IST on 10 Oct, or via `?now=2026-10-10T03:30:00%2B05:30`).
2. Tap the `.ics` button on an iPhone and add the event; tap "Add to Google Calendar" while logged in.
3. Scan the UPI QR with a UPI app and check the payee name for `9874353532@upi` before sharing the page.
4. Try "Wake me" overnight once with `?now=` set a few minutes before 03:50.
