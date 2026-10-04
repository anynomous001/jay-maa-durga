# Mahalaya Live — মহালয়া লাইভ

Static site for Mahalaya and Durga Puja 2026:

- live Akashvani radio (Mahishasuramardini) with a "wake me" auto-start;
- calendar reminders;
- countdowns and the Puja calendar;
- official song embeds and a synthesised dhak;
- a Kolkata pandal map with directions;
- config-driven sponsor slots.

Built with **Vite + vanilla TypeScript**. There's no UI framework. The pages are mostly static content with a few interactive widgets, so plain DOM code keeps the JS small (≈8 KB gzipped per page, plus 11 KB shared). That matters on mid-range Android phones over 4G. Two heavy pieces load only when needed:
- **Leaflet** loads only when the map is shown.
- **hls.js** loads only in browsers without native HLS.

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # typecheck + data validation + production build → dist/
npm run preview    # serve dist/ on http://localhost:4173
```

Pages: `/` (everything in the hero: radio, countdown, reminders, plus schedule/songs/dhak/FAQ sheets), `/pandals/` (map), `/policies/` (terms, privacy, refunds, contact), `/admin/` (private booking review).

### Test hooks (safe to leave in production)

| URL param | Effect |
|---|---|
| `?now=2026-10-10T03:49:50%2B05:30` | Pretend it is that instant (countdown, schedule, wake, hero copy). |
| `?lang=en` / `?lang=bn` | Force the language. |
| `?hlsjs` | Force the hls.js player path (simulates Firefox / older Chrome). |

## Motion

All motion lives in `src/features/motion.ts` and `src/lib/smooth-scroll.ts`. It uses one easing family (`power3/4.out`, 0.9 s) everywhere.

| Effect | Where | Notes |
|---|---|---|
| Smooth wheel scrolling (Lenis + GSAP ticker) | every page | Touch scrolling stays native on phones. The map and inner list have `data-lenis-prevent` so map zoom and list scrolling work |
| Title intro (SplitText) | hero `h1` / page `h1` | English animates letter by letter (0.03 s stagger). **Bengali animates word by word**, because per-letter spans break conjuncts and vowel signs. Plain text is restored when the intro ends |
| Reveal on scroll | panels, slot cards, routes | Fade and rise 60 px; only for elements that start below the fold, so nothing flashes on load |
| Word-by-word highlight | the radio note paragraph | Scroll-scrubbed opacity; words stay `display:inline` so line breaks never change |
| Magnetic buttons | play button and primary buttons | Mouse only (`hover: hover` and `pointer: fine`) |
| Page transitions | cross-document View Transitions (CSS) | Chromium only; other browsers just navigate |

`prefers-reduced-motion: reduce` turns all of it off (no Lenis, no splitting, no reveals or transitions).

Not added, on purpose:
- **Custom cursor and loader:** a loader hurts the 4 AM "tap and listen" moment and LCP; a custom cursor doesn't suit the calm theme.
- **React Bits / Magic UI / Aceternity components:** they need React and Tailwind.

The only animated background is the backdrop (stars, mist, shiuli, and the Maa Durga face in `src/features/durga.ts`).

Maa Durga's eyes are "painted in" on load (chokkhu daan), then the halo turns slowly and the glow breathes. She sits to the right of the content on desktop and faintly behind the title on mobile, and fades as you scroll. Opacity and position are in `.bd-durga` in `src/styles.css`.

## Where to change things

| What | File |
|---|---|
| Site name, tagline, URL, WhatsApp number, operator details for `/policies/` | `src/config.ts` |
| Slot prices by position (home ₹149, dhak/map ₹99, "Eat nearby" ₹49), season end (shared with the payments Worker) | `data/pricing.json` |
| Key times (transmission 03:50–05:45 IST, auto-start time, reminder time), Puja dates | `src/config.ts` (`MAHALAYA_*`, `AUTO_START_AT`, `PUJA_DAYS`) |
| Radio stream URLs | `src/config.ts` (`RADIO_CHANNELS`) |
| Map tile provider | `src/config.ts` (`MAP_TILE_URL`, `MAP_TILE_ATTRIBUTION`) |
| Cloudflare Web Analytics | `src/config.ts` → `ANALYTICS = { enabled: true, cloudflareToken: '…' }` |
| All UI text (Bengali + English) | `src/lib/strings.ts` |
| Sponsors | `data/sponsors.json` |
| Pandals and routes | `data/pandals.json` |
| Playlists | `data/playlists.json` |

`npm run build` runs `scripts/validate-data.mjs` first, so a typo in a JSON file fails the build instead of breaking the site.

### Sponsors (`data/sponsors.json`)

```json
{
  "id": "tota-cake-house",
  "slot": "dhak",
  "name": "Tota Cake House",
  "name_bn": "টোটা কেক হাউস",
  "tagline": "Home-baked cakes for every celebration",
  "tagline_bn": "বাড়িতে বানানো কেক — সব উৎসবের জন্য",
  "logo": "/sponsors/tota.png",
  "link": "https://…",
  "whatsapp": "91XXXXXXXXXX",
  "startDate": "2026-10-04",
  "endDate": "2026-10-21",
  "active": true,
  "pandalIds": []
}
```

- `slot` is one of `spotlight` (home hero card), `countdown`, `dhak`, `map-partner` or `pandal-nearby`. Paid bookings (made from the sponsor spots) don't go here — they're approved in `/admin/` and served by the Worker.
- `logo` is optional. Put the file in `public/sponsors/`.
- `link` takes precedence over `whatsapp`; if both are empty, the card isn't clickable.
- Dates are IST calendar days, inclusive. Outside them, or with `active: false`, the slot shows the "Your brand here — ₹price · Book now" button, which opens the booking sheet.
- For `pandal-nearby`, list the pandal ids the shop is near, e.g. `["maddox-square","singhi-park"]`.
- Every sponsor is labelled "স্পনসর / Sponsored". No slot sits on or around the radio player; the broadcast belongs to Prasar Bharati.

### Pandals (`data/pandals.json`)

Each pandal has these fields: `id`, `name_bn`, `name_en`, `area`, `zone`, `lat`, `lng`, optional `nearestMetro`, `theme2026` (leave empty unless confirmed), `verified`, `source` and `notes`.

- `verified: false` shows an "approximate location" warning on the card and greys the pin.
- Every coordinate was looked up individually on Google Maps. `docs/pandal-lookup-log.tsv` records the search, the matched place and the confidence.
- To add a pandal, look it up the same way and add a row to that log.

`routes` is an ordered list of stop ids plus a `travelmode`. Google Maps on phones accepts only 3 waypoints, so the page splits a route into even legs of at most 5 stops (shown as "Part 1 / Part 2").

### Playlists (`data/playlists.json`)

Use official uploads only. Each item has `title`, `artist`, `platform` (`youtube` or `spotify`), `url` (a normal watch/open URL) and `source`.

Before adding a YouTube video, check it's embeddable and see who uploaded it:

```
https://www.youtube.com/oembed?format=json&url=https://www.youtube.com/watch?v=VIDEO_ID
```

A 401 response means embedding is disabled, so don't add it.

### Hero image

The home hero is `assets-src/hero-pandal.png`, and the pandal map page background is `assets-src/bg-pandals.png` (both listed in `scripts/make-hero.mjs`). To replace it, drop in a new PNG with the same name and run `npm run hero`. That writes resized AVIF/WebP/JPEG files to `public/hero/`: a landscape set, plus a portrait crop centred around 70% across for phones (change the crop in `scripts/make-hero.mjs`). The dark gradient that keeps text readable is `.hero-shade` in `src/styles.css`.

### Dhak sound

The dhak plays short clips cut from a CC BY-SA 4.0 recording (credit in the Dhak sheet and `ASSETS.md`). To re-cut them:
1. With `npm run dev` running, open <http://localhost:5173/scripts/dhak.html>.
2. Run `scripts/encode-dhak.sh` (macOS `afconvert`).

To change which moments are used, edit `RHYTHM` / `SEARCH` in `scripts/dhak.html`.

### OG image and icons

`npm run og` renders the PWA icons and `scripts/og-art.svg` (background art). The OG image's text is drawn by the browser, because resvg can't shape Bengali conjuncts. With `npm run dev` running, open <http://localhost:5173/scripts/og.html>; it saves `public/og.jpg` through a dev-only endpoint.

## Deploy to Cloudflare Pages (steps only — not done)

Vercel's free plan forbids commercial use, so target Cloudflare Pages.

1. Push this repo to GitHub (ask before creating the remote).
2. In the Cloudflare dashboard, go to **Workers & Pages → Create → Pages → Connect to Git** and pick the repo.
3. Build settings:
   - framework preset: **None**;
   - build command: `npm run build`;
   - build output directory: `dist`;
   - environment variable `NODE_VERSION=22`.
4. Deploy. `public/_headers` (caching and security headers) is picked up automatically.
5. Set the final domain in `SITE_URL` (`src/config.ts`), and in the canonical/OG tags in the three `index.html` files, `public/robots.txt` and `public/sitemap.xml`. Redeploy.
6. Optional:
   - **Web Analytics:** Cloudflare → Web Analytics → add site → copy the token into `ANALYTICS` → redeploy.
   - **Custom domain:** Pages → Custom domains.

## Known limitations

- **The stream depends on Prasar Bharati.** The CDN (`airhlspush.pc.cdn.bitgravity.com`) serves HTTPS with `Access-Control-Allow-Origin: *`, the HLS MIME type and AAC segments, so it plays from our page. On Mahalaya dawn it may be overloaded or the URLs may change. The player retries with backoff (2→4→8→15→30 s) and highlights the official fallbacks: the Akashvani player, the NewsOnAir app, and 657 kHz MW.
  - The streams are listed on <https://akashvani.gov.in/radio/live.php>. If they change, update `RADIO_CHANNELS`.
- **Which channel carries the broadcast:** the official 2026 schedule says Kolkata "originates" the Bengali programme on selected MW and FM stations, 03:50–05:45 IST. Kolkata A (Geetanjali) and FM Rainbow Kolkata are both offered; confirm on the day.
- **Autoplay and wake mode:**
  - Browsers only let audio start after a tap. "Wake me" works because the user taps to arm it, and the page must stay open.
  - Screen Wake Lock isn't available everywhere.
  - Background tabs may run timers late, so the stream can start a few seconds after 03:50.
  - iOS may still pause audio when the screen locks during a long silence.
- **Background playback** works for native-HLS audio on Android Chrome and iOS Safari in most cases. It is not guaranteed.
- **OSM tiles:** `tile.openstreetmap.org` is a volunteer-run service with a [usage policy](https://operations.osmfoundation.org/policies/tiles/) that forbids heavy use. If traffic grows, switch `MAP_TILE_URL` to a commercial or free-tier provider (MapTiler, Stadia, Thunderforest…) and update the attribution.
- **Spotify embeds** play 30-second previews unless the listener is logged in.
- **Dates:** Puja dates follow the Bisuddha Siddhanta panjika (Saptami spans 17–18 Oct). Gupta Press / Benimadhab Sheel panjika runs one day earlier from Ashtami. The WB holiday list puts Shashthi on 17 Oct.

## Sponsor bookings & payments (Razorpay)

Flow:
1. **Book.** An advertiser taps any **"Your brand here — ₹…"** spot (home spotlight/countdown, the dhak sheet, the map-partner banner, or "Eat nearby" on a pandal card). The booking sheet opens right there with that slot (and pandal) pre-selected. They fill in business name (EN/BN), tagline, description, logo, website, shop address + Google Maps link, nearby pandals (for "Eat nearby"), contact name/phone/WhatsApp/email, and a start date.
2. **Hold.** The Worker validates everything and holds the slot for 15 minutes (so two people can't buy it at once). It creates a **Razorpay order for the price in `data/pricing.json`**; the browser never sets the amount.
3. **Pay.** Razorpay Checkout takes UPI, cards, netbanking or wallets. The Worker verifies the payment signature, and the `payment.captured` webhook is a backup if the browser closes. The booking becomes **paid → needs review**.
4. **Review.** You open **`/admin/`** (token = `ADMIN_TOKEN`) and see the logo and every detail.
   - **Approve:** the ad appears on the site within ~30 s, with no rebuild.
   - **Reject:** refunds through Razorpay (or tick it off and refund manually).
   - **Take down:** for live ads.

Everything lives in the same Worker as the visitor counter (`worker/`):
- bookings in a SQLite Durable Object;
- logos in an R2 bucket (PNG/JPG/WebP ≤ 300 KB; SVG refused because it can carry scripts).

House sponsors in `data/sponsors.json` (e.g. Tota Cake House on the dhak) still work and count as "booked".

**Local testing (no Razorpay account needed):**
1. `cp worker/.dev.vars.example worker/.dev.vars` (it has `ALLOW_MOCK=true`).
2. `cd worker && npm run dev`.
3. `npm run dev` in the site folder. Booking shows a red **TEST MODE** payment step.
4. Open `/admin/` with the token from `.dev.vars`.

Mock payments are impossible in production: they only work when `ALLOW_MOCK=true` and no Razorpay keys are set.

**Going live with Razorpay (steps only — not done):**
1. Sign up at razorpay.com and finish **KYC** (PAN, bank account; an individual/proprietor is fine). Activation usually takes 1–3 working days, so start now if you want it before Mahalaya.
2. Razorpay checks your website. Before you submit:
   - fill in your legal name, address and email in `OPERATOR` (`src/config.ts`);
   - deploy, so `/policies/` (Terms, Privacy, Refund & Cancellation, Delivery, Contact) is reachable.
3. Test first: in **Test Mode**, copy the test Key ID/Secret into `worker/.dev.vars` (remove `ALLOW_MOCK`). Pay with Razorpay's test UPI/cards.
4. Production:
   ```
   cd worker
   npx wrangler r2 bucket create mahalaya-sponsor-logos
   npx wrangler secret put RAZORPAY_KEY_ID        # rzp_live_…
   npx wrangler secret put RAZORPAY_KEY_SECRET
   npx wrangler secret put RAZORPAY_WEBHOOK_SECRET
   npx wrangler secret put ADMIN_TOKEN            # long random string
   npx wrangler deploy
   ```
5. In the Razorpay Dashboard → Webhooks:
   - add `https://<your-worker>/webhooks/razorpay`;
   - events: `payment.captured`, `order.paid`;
   - use the same webhook secret.
6. Set `VITE_API_URL` (Cloudflare Pages env var) to the Worker URL and redeploy the site.

**Fees:** Razorpay's standard fee is about 2% per transaction (+GST), deducted before settlement. Check your plan.

**Security notes:**
- Keys and the admin token live only in Worker secrets / `.dev.vars` (git-ignored).
- Amounts come from `data/pricing.json` on the server.
- Every checkout is verified by HMAC signature.
- Inputs are length-checked and stripped of markup.
- Logos are type-checked by their bytes.
- The admin API needs the token.

## Visitor counter (total, online now, listening now)

Shown as badges in the home hero ("N online now · N visitors so far"), "N listening now" in the player, and a live audience line in the booking sheet. It's part of the Worker in `worker/`. The site works fine without it; if `VITE_API_URL` is empty, the badges stay hidden.

- **How it counts:**
  - each browser gets a random id in localStorage (no cookies, no IPs, nothing personal);
  - the first visit adds 1 to the **total**;
  - while the tab is visible it pings every 60 s;
  - **online** means pinged in the last 150 s, and **listening** means the radio is playing.
- **Local dev:**
  1. `cd worker && npm install && npm run dev` (port 8787, no Cloudflare account needed).
  2. Keep `.env.development.local` with `VITE_API_URL=http://localhost:8787`.
  3. Run `npm run dev` in the site folder.
- **Deploy (steps only — not done):**
  1. `cd worker && npx wrangler login && npx wrangler deploy`. It prints a URL like `https://mahalaya-counter.<you>.workers.dev`.
  2. In `worker/wrangler.toml`, set `ALLOWED_ORIGINS` to your real domain, then redeploy.
  3. In Cloudflare Pages → Settings → Environment variables, add `VITE_API_URL` = that URL, then redeploy the site.
- **Free-tier limit:** Workers Free allows **100,000 requests/day**. One visitor costs ~1 request per minute while the page is open. For example, 1,500 people listening through the 2-hour broadcast ≈ 180k requests, which exceeds the free tier.
  - If the limit is hit, only the counter stops; the site and the radio keep working.
  - For a big Mahalaya audience, switch the account to **Workers Paid (US$5/month, 10M requests included)** for that week.
- **Honesty note:** counts are approximate. Anyone could inflate them with scripts, and a visitor who clears their storage or switches device counts twice. Don't sell ads on these numbers alone; Cloudflare Web Analytics (`ANALYTICS` in config) gives an independent figure.

## Docs

- `ASSETS.md` — every asset, its source and licence.
- `VERIFICATION.md` — what was tested, how, and the results (screenshots and Lighthouse reports in `docs/verification/`).
- `docs/pandal-lookup-log.tsv` — the per-pandal Google Maps lookup record.
