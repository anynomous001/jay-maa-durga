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
| 7a | ~~UPI link and QR~~ | Replaced by Razorpay booking (see "Sponsor booking + Razorpay") | — | — | Superseded |
| 8 | SEO | Title and description cover Mahalaya 2026 live / live radio in Bengali and English. JSON-LD Event (03:50–05:45 IST) and FAQPage; `sitemap.xml`; `robots.txt`; OG 1200×630 JPEG (79 KB). Lighthouse SEO 100 | ✅ | ✅ | **Pass** |
| 9 | PWA / service worker | Production preview: page controlled by the SW. Cache holds only our HTML, JS, CSS and icons. While the stream played, no `.m3u8`, `.aac` or bitgravity entries were cached | ✅ | — | **Pass** |
| 10 | Analytics placeholder | `ANALYTICS.enabled = false`, so no beacon request is made. Listener-count hook hidden | ✅ | — | **Pass** |
| — | Bilingual toggle | Bengali ↔ English: all strings, `<html lang>`, and the sponsor label switch | ✅ | ✅ | **Pass** |
| — | Accessibility | No unlabeled controls (script check); skip link; reduced-motion CSS; Lighthouse Accessibility 100 on every page | ✅ | ✅ | **Pass** |

## Motion (added after Phase 2)

| Check | How | Result |
|---|---|---|
| Wheel scrolling glides; whole page reachable | Headless Chrome, 40 real mouse-wheel events: reached the bottom (3204 px) and every panel ended fully visible | **Pass** |
| Anchor links still jump correctly | Skip link → `#main` lands at the top. On a 390 px viewport the route stop `#p-bagbazar` lands its card 16 px from the top | **Pass** |
| Phones scroll natively | Lenis left at its default (`syncTouch: false`): touch input isn't smoothed | **Pass** (by configuration; not felt on a real phone) |
| Map and inner list | Wheel over the map zooms Leaflet (page didn't scroll); wheel over the desktop list scrolls the list (`scrollTop` 1500) | **Pass** |
| No flicker or layout shift on load | Layout-shift observer at 4× CPU throttle. Fixed during testing: the on-screen paragraph highlight re-wrapped lines (CLS 0.12). Now words stay inline, the effect runs only below the fold, and the title is split after fonts are ready | **Pass** (home CLS 0.009) |
| Bengali text intact | The title splits by word for Bengali and is restored to plain text after the intro. Language toggle mid- and post-animation leaves no stale spans | **Pass** |
| Reduced motion | `prefers-reduced-motion: reduce`: no Lenis class, no splits, all panels opacity 1 | **Pass** |
| Accessibility | Initially failed `aria-prohibited-attr` (SplitText put `aria-label` on a `<p>`); fixed with `aria: 'none'` + spans | **Pass** (100) |

## Maa Durga background

| Check | How | Result |
|---|---|---|
| Placement and readability | Screenshots `d-durga.png` (desktop: right of the content, clear of the countdown) and `m-durga.png` (390 px: faint, behind the title; text stays legible) | **Pass** |
| Chokkhu daan animation | After 4 s the eye strokes are fully drawn (`stroke-dashoffset: 0`), pupils at opacity 1, halo rotating | **Pass** |
| Reduced motion | `.still` class: eyes fully painted, no rotation or float | **Pass** |
| Performance | The Google Fonts stylesheet became the bottleneck (pandals FCP 3.4 s), so it now loads without blocking paint (`media="print"` → `all`). After: FCP ≈ 1.5 s on every page | **Pass** |

## Photo hero

| Check | How | Result |
|---|---|---|
| Layout | Desktop: text on the left over a dark gradient, pandal and idol on the right (`d-hero-photo.png`). 390 px: portrait crop, title over the sky, idol framed, countdown over the crowd (`m-hero-photo.png`). The header overlays the image | **Pass** |
| Responsive delivery | `<picture>` with AVIF/WebP/JPEG; phones get the 480/720 px portrait crop (39–67 KB AVIF) instead of the 3.1 MB source | **Pass** |
| Motion | Settle-in zoom on load and scroll parallax (12%); off under reduced motion | **Pass** |
| Lighthouse | Mobile home 99 / 100 / 100 / 100 (LCP 1.8 s, CLS 0.045); desktop home Performance 100 (LCP 0.5 s) | **Pass** |

## Pandal map background

| Check | How | Result |
|---|---|---|
| Look | Fixed full-page illustration with a darker shade where the map and cards sit (`d-pandals-bg.png`, `m-pandals-bg.png`). The animated night-sky backdrop is turned off on this page | **Pass** |
| Weight | Phones load the 480/720 px portrait crop (41–66 KB AVIF) | **Pass** |
| Lighthouse (mobile) | `/pandals/` 99 / 100 / 100 / 100, LCP 1.9 s, CLS 0.033 | **Pass** |

## Glass sheets, songs audio/video, real dhak

| Check | How | Result |
|---|---|---|
| Glass sheets | Sheets, schedule rows, song cards and FAQ items use the countdown card's glass (translucent + 18 px blur + light border). Solid fallback where `backdrop-filter` isn't supported (`d-sheet-songs-glass.png`, `d-sheet-dhak-glass.png`) | **Pass** |
| Audio / Video per song | YouTube items show Audio + Video; Spotify shows Audio. **Audio** → sheet closes, floating mini player (YouTube 200×200, its minimum allowed size) keeps playing (`d-mini-player.png`). **Video** → 16:9 player inside the sheet (604×340), removed when the sheet closes | **Pass** |
| One sound at a time | Radio playing → tap Audio → radio paused. Radio Play again → mini player closed | **Pass** |
| Real dhak | Clips load (200) when the Dhak sheet opens. Tap plays one of 4 real strokes (rotating, ±2.5% pitch). "Play a full rhythm" toggles to "Stop" and plays a 10 s passage with the drum pulsing on its 44 beats. Closing the sheet stops it. Decoded clips: peak 0.89, no clipping. CC BY-SA credit shown under the drum | **Pass** (listen once yourself — I can measure audio, not hear it) |

## Sponsor booking + Razorpay (local, test mode)

| Check | How | Result |
|---|---|---|
| Form validation | Empty submit → per-field errors (business name, tagline, your name, phone, consent) + banner; errors clear as you type. Server rejects bad URL/phone, an over-long name, markup, an unknown pandal, a missing consent | **Pass** |
| Logo | PNG accepted and served from R2 (`image/png`, `nosniff`); an SVG renamed to look like a PNG is refused (`bad_type`) | **Pass** |
| No double-selling | The house sponsor makes `dhak` booked. A second spotlight booking during the 15-min hold → `slot_taken`. Chosen pandals become taken for "Eat nearby" | **Pass** |
| Payment | Test-mode checkout (`d-booking-form.png`, `d-booking-done.png`). Wrong signature → 400; correct → **paid**. Signed webhook marks paid; forged webhook → 400 | **Pass** (real Razorpay checkout not run: needs your keys) |
| Review | `/admin/` with token lists the booking with logo + all details (`d-admin-review.png`). No/invalid token → 401. Approve → live on the home page (`d-home-live-sponsors.png`: "Countdown by Ghosh Saree Ghar" + Mitra Sweets spotlight with description and address) | **Pass** |
| Reject + refund | Reject with refund → `refunded`, slot/pandals freed (mock refund; real refunds call Razorpay's refund API) | **Pass** |
| Mobile | Booking sheet and pandal picker at 390 px (`m-booking-sheet.png`) | **Pass** |

## Visitor counter

| Check | How | Result |
|---|---|---|
| API | `wrangler dev` locally. A new id adds +1 to total; the same id again leaves the total unchanged; online and listening counts update. Bad id → 400. CORS only for allowed origins (an unknown origin gets no ACAO header) | **Pass** |
| Two real visitors | Two separate headless Chrome profiles. Hero badges showed "2 online now". When A pressed Play, B's player showed "1 listening now". `/advertise` showed total / online / listening live (`d-advertise-live-stats.png`, `d-hero-visitors.png`) | **Pass** |
| Persistence | Restarted the Worker: total kept (5); online reset to 0 as designed | **Pass** |
| Production build | No `localhost` URL in the bundle; with `VITE_COUNTER_URL` unset, badges stay hidden and no requests are made. Lighthouse home 99/100/100/100 | **Pass** |
| Not tested | Deployed behaviour on Cloudflare (needs your account) | — |

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
| `/` | 99 | 100 | 100 | 100 | 1.8 s | 0.045 |
| `/pandals/` | 99 | 100 | 100 | 100 | 1.5 s | 0.032 |
| `/advertise/` | 100 | 100 | 100 | 100 | 1.5 s | 0.05 |

These figures are after adding GSAP and Lenis (+65 KB gzipped, shared). Before motion: 99 / 100 / 100 on Performance, with CLS ≤ 0.035.

The first `/pandals/` run scored Performance 77 (CLS 0.58) and Accessibility 99 (heading order). Both were fixed by reserving space for injected content and adding a list heading; the table shows the re-run.

## To do on a real phone (can't be done here)

1. Android Chrome and iPhone Safari: press Play, lock the screen, and check that audio continues and the lock screen shows "Mahishasuramardini — Live" (it does from 02:50 IST on 10 Oct, or via `?now=2026-10-10T03:30:00%2B05:30`).
2. Tap the `.ics` button on an iPhone and add the event; tap "Add to Google Calendar" while logged in.
3. After Razorpay activation, make one real ₹1–₹99 booking end to end (pay → admin approve → reject+refund) before announcing it.
4. Try "Wake me" overnight once with `?now=` set a few minutes before 03:50.
