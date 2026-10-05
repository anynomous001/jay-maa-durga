/**
 * Mahalaya Live API (Cloudflare Worker).
 *
 * Visitors      POST /visit, POST /ping, GET /stats
 * Sponsors      GET  /availability            which slots / pandals are free
 *               GET  /sponsors                approved, live sponsors (for the site)
 *               GET  /logos/:key              sponsor logos (from R2)
 * Booking       POST /bookings                multipart form → hold + Razorpay order or Dodo checkout session
 *               POST /bookings/:id/verify     Razorpay checkout signature → paid
 *               GET  /bookings/:id            status for the advertiser
 *               POST /webhooks/razorpay       payment.captured / order.paid backup
 *               POST /webhooks/dodo           payment.succeeded → paid (Dodo's only confirmation)
 * Admin (Bearer ADMIN_TOKEN)
 *               GET  /admin/bookings
 *               POST /admin/bookings/:id/approve
 *               POST /admin/bookings/:id/reject   { note, refund }
 */
import pricing from '../../data/pricing.json';
import { TIERS, basePrice, SLOT_IDS } from '../../shared/pricing';
import { Bookings, type Booking, type Provider } from './bookings';
import { Counter, VISITOR_ID_RE } from './counter';
import type { Env } from './env';
import { corsHeaders, json, safeEqual } from './http';
import { createCheckout, dodoConfigured, dodoRefund, verifyDodoWebhook } from './dodo';
import { createOrder, isMock, paymentsConfigured as razorpayConfigured, refund, verifyCheckout, verifyWebhook } from './razorpay';
import { checkLogo, validateBooking } from './validate';

export { Bookings, Counter };

const UUID_RE = /^[0-9a-f-]{36}$/;

function publicSponsor(b: Booking, origin: string) {
  return {
    id: b.id,
    slot: b.slot,
    name: b.business_name,
    name_bn: b.business_name_bn || undefined,
    tagline: b.tagline,
    tagline_bn: b.tagline_bn || undefined,
    description: b.description || undefined,
    logo: b.logo_key ? `${origin}/logos/${b.logo_key}` : '',
    link: b.website,
    whatsapp: b.whatsapp,
    address: b.address || undefined,
    mapsUrl: b.maps_url || undefined,
    startDate: b.start_date,
    endDate: b.end_date,
    active: true,
    pandalIds: b.pandal_ids,
  };
}

/** What the admin page sees (everything) — never exposed publicly. */
const adminView = (b: Booking, origin: string) => ({ ...b, logo_url: b.logo_key ? `${origin}/logos/${b.logo_key}` : '' });

/** Payment providers that are switched on, Razorpay first (the default). */
const providers = (env: Env): Provider[] => [...(razorpayConfigured(env) ? (['razorpay'] as const) : []), ...(dodoConfigured(env) ? (['dodo'] as const) : [])];

/** Where Dodo sends the advertiser back: the page they booked from, if it's on an allowed origin. */
function returnUrl(raw: string, env: Env, bookingId: string): string | null {
  try {
    const u = new URL(raw);
    if (!env.ALLOWED_ORIGINS.split(',').map((s) => s.trim()).includes(u.origin)) return null;
    u.search = '';
    u.hash = '';
    u.searchParams.set('booking', bookingId);
    return u.toString();
  } catch {
    return null;
  }
}

function isAdmin(req: Request, env: Env): boolean {
  if (!env.ADMIN_TOKEN) return false;
  const h = req.headers.get('Authorization') ?? '';
  return h.startsWith('Bearer ') && safeEqual(h.slice(7), env.ADMIN_TOKEN);
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const cors = corsHeaders(req, env);
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    const url = new URL(req.url);
    const { pathname } = url;
    const origin = url.origin;
    const counter = env.COUNTER.get(env.COUNTER.idFromName('global'));
    const bookings = env.BOOKINGS.get(env.BOOKINGS.idFromName('global'));

    try {
      // ── Visitors ──
      if (req.method === 'GET' && pathname === '/stats') return json(await counter.stats(), cors);
      if (req.method === 'POST' && (pathname === '/visit' || pathname === '/ping')) {
        if (Number(req.headers.get('Content-Length') ?? 0) > 200) return json({ error: 'too large' }, cors, 413);
        const body = (await req.json().catch(() => ({}))) as { id?: unknown; listening?: unknown };
        const id = typeof body.id === 'string' ? body.id : '';
        if (!VISITOR_ID_RE.test(id)) return json({ error: 'bad id' }, cors, 400);
        const listening = body.listening === true;
        return json(pathname === '/visit' ? await counter.visit(id, listening) : await counter.ping(id, listening), cors);
      }

      // ── Public sponsor data ──
      if (req.method === 'GET' && pathname === '/availability') {
        return json({ ...(await bookings.availability()), prices: Object.fromEntries(SLOT_IDS.map((s) => [s, basePrice(s)])), tiers: TIERS, seasonEnd: pricing.seasonEnd, payments: providers(env).length > 0, providers: providers(env) }, cors);
      }
      if (req.method === 'GET' && pathname === '/sponsors') {
        const live = (await bookings.live()) as Booking[];
        return json({ sponsors: live.map((b) => publicSponsor(b, origin)) }, { ...cors, 'Cache-Control': 'public, max-age=30' });
      }
      if (req.method === 'GET' && pathname.startsWith('/logos/')) {
        const key = pathname.slice('/logos/'.length);
        if (!/^[0-9a-f-]{36}\.(png|jpg|webp)$/.test(key)) return json({ error: 'not found' }, cors, 404);
        const obj = await env.LOGOS.get(key);
        if (!obj) return json({ error: 'not found' }, cors, 404);
        return new Response(obj.body, {
          headers: {
            'Content-Type': obj.httpMetadata?.contentType ?? 'application/octet-stream',
            'Cache-Control': 'public, max-age=86400',
            'X-Content-Type-Options': 'nosniff',
            'Content-Security-Policy': "default-src 'none'",
            ...cors,
          },
        });
      }

      // ── Booking + payment ──
      if (req.method === 'POST' && pathname === '/bookings') {
        const enabled = providers(env);
        if (!enabled.length) return json({ error: 'payments_not_configured' }, cors, 503);
        const len = Number(req.headers.get('Content-Length') ?? 0);
        if (len > 600 * 1024) return json({ error: 'too_large' }, cors, 413);
        const fd = await req.formData();
        const { input, errors } = validateBooking(fd);
        const logo = await checkLogo(fd.get('logo') as File | null);
        if (!logo.ok) errors.logo = logo.error;
        if (!input || Object.keys(errors).length) return json({ error: 'invalid', errors }, cors, 400);
        const provider = (fd.get('provider') || enabled[0]) as Provider;
        if (!enabled.includes(provider)) return json({ error: 'payments_not_configured' }, cors, 400);

        const ip = req.headers.get('CF-Connecting-IP') ?? 'local';
        const hold = await bookings.createHold(input, ip, provider);
        if (!hold.ok) return json({ error: hold.error }, cors, hold.error === 'rate_limited' ? 429 : 409);

        let logoKey = '';
        try {
          if (logo.ok && logo.bytes) {
            logoKey = `${hold.id}.${logo.ext}`;
            await env.LOGOS.put(logoKey, logo.bytes, { httpMetadata: { contentType: logo.type } });
          }
          if (provider === 'dodo') {
            const back = returnUrl(String(fd.get('return_url') ?? ''), env, hold.id);
            if (!back) throw new Error('bad return_url');
            const session = await createCheckout(env, hold.amount, hold.id, { name: input.contact_name, email: input.email, phone: input.phone ? `+${input.phone}` : '' }, back);
            await bookings.setOrder(hold.id, session.id, logoKey);
            return json({ id: hold.id, provider, amount: hold.amount, currency: 'INR', checkoutUrl: session.url }, cors);
          }
          const order = await createOrder(env, hold.amount, hold.id.slice(0, 36), {
            booking: hold.id,
            slot: input.slot,
            business: input.business_name.slice(0, 200),
          });
          await bookings.setOrder(hold.id, order.id, logoKey);
          return json(
            {
              id: hold.id,
              provider,
              orderId: order.id,
              amount: hold.amount,
              currency: 'INR',
              keyId: env.RAZORPAY_KEY_ID ?? '',
              mock: isMock(env),
              prefill: { name: input.contact_name, email: input.email, contact: input.phone ? `+${input.phone}` : '' },
            },
            cors,
          );
        } catch (err) {
          await bookings.release(hold.id);
          if (logoKey) await env.LOGOS.delete(logoKey);
          console.error(err);
          return json({ error: 'payment_init_failed' }, cors, 502);
        }
      }

      const verifyMatch = pathname.match(/^\/bookings\/([0-9a-f-]{36})\/verify$/);
      if (req.method === 'POST' && verifyMatch) {
        const body = (await req.json().catch(() => ({}))) as Record<string, string>;
        const b = (await bookings.get(verifyMatch[1])) as Booking | null;
        if (!b || b.order_id !== body.razorpay_order_id) return json({ error: 'not_found' }, cors, 404);
        const ok = await verifyCheckout(env, body.razorpay_order_id, body.razorpay_payment_id ?? '', body.razorpay_signature ?? '');
        if (!ok) return json({ error: 'bad_signature' }, cors, 400);
        const paid = (await bookings.markPaid(b.order_id, body.razorpay_payment_id)) as Booking | null;
        return json({ id: b.id, status: paid?.status }, cors);
      }

      const statusMatch = pathname.match(/^\/bookings\/([0-9a-f-]{36})$/);
      if (req.method === 'GET' && statusMatch) {
        const b = (await bookings.get(statusMatch[1])) as Booking | null;
        if (!b) return json({ error: 'not_found' }, cors, 404);
        return json({ id: b.id, status: b.status, slot: b.slot, business: b.business_name, note: b.status === 'rejected' || b.status === 'refunded' ? b.review_note : '' }, cors);
      }

      if (req.method === 'POST' && pathname === '/webhooks/razorpay') {
        const raw = await req.text();
        if (!(await verifyWebhook(env, raw, req.headers.get('X-Razorpay-Signature') ?? ''))) return json({ error: 'bad_signature' }, {}, 400);
        const evt = JSON.parse(raw) as { event: string; payload: { payment?: { entity: { id: string; order_id: string } } } };
        if ((evt.event === 'payment.captured' || evt.event === 'order.paid') && evt.payload.payment) {
          await bookings.markPaid(evt.payload.payment.entity.order_id, evt.payload.payment.entity.id);
        }
        return json({ ok: true });
      }

      if (req.method === 'POST' && pathname === '/webhooks/dodo') {
        const raw = await req.text();
        if (!(await verifyDodoWebhook(env, raw, req.headers))) return json({ error: 'bad_signature' }, {}, 401);
        const evt = JSON.parse(raw) as { type: string; data: { payment_id?: string; checkout_session_id?: string | null; metadata?: Record<string, string> } };
        if (evt.type === 'payment.succeeded' && evt.data.payment_id) {
          // Match on the checkout session; fall back to the booking id we put in metadata.
          let sessionId = evt.data.checkout_session_id ?? '';
          if (!sessionId && evt.data.metadata?.booking && UUID_RE.test(evt.data.metadata.booking)) {
            sessionId = ((await bookings.get(evt.data.metadata.booking)) as Booking | null)?.order_id ?? '';
          }
          if (sessionId) await bookings.markPaid(sessionId, evt.data.payment_id);
        }
        return json({ ok: true });
      }

      // ── Admin ──
      if (pathname.startsWith('/admin/')) {
        if (!isAdmin(req, env)) return json({ error: 'unauthorised' }, cors, 401);
        if (req.method === 'GET' && pathname === '/admin/bookings') {
          const list = (await bookings.list()) as Booking[];
          return json({ bookings: list.map((b) => adminView(b, origin)), mock: isMock(env) }, cors);
        }
        const m = pathname.match(/^\/admin\/bookings\/([0-9a-f-]{36})\/(approve|reject)$/);
        if (req.method === 'POST' && m && UUID_RE.test(m[1])) {
          const b = (await bookings.get(m[1])) as Booking | null;
          if (!b) return json({ error: 'not_found' }, cors, 404);
          if (m[2] === 'approve') {
            if (b.status !== 'paid') return json({ error: `cannot approve a ${b.status} booking` }, cors, 409);
            return json({ booking: adminView((await bookings.setStatus(b.id, 'approved')) as Booking, origin) }, cors);
          }
          const body = (await req.json().catch(() => ({}))) as { note?: string; refund?: boolean };
          const note = String(body.note ?? '').slice(0, 300);
          if (!['paid', 'approved'].includes(b.status)) return json({ error: `cannot reject a ${b.status} booking` }, cors, 409);
          let refundResult = { ok: false, detail: 'not requested' };
          if (body.refund && b.payment_id) refundResult = b.provider === 'dodo' ? await dodoRefund(env, b.payment_id) : await refund(env, b.payment_id);
          const updated = (await bookings.setStatus(b.id, refundResult.ok ? 'refunded' : 'rejected', note)) as Booking;
          return json({ booking: adminView(updated, origin), refund: refundResult }, cors);
        }
      }

      return json({ error: 'not found' }, cors, 404);
    } catch (err) {
      console.error(err);
      return json({ error: 'server_error' }, cors, 500);
    }
  },
} satisfies ExportedHandler<Env>;
