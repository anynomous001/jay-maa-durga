/**
 * Dodo Payments: hosted Checkout Sessions, Standard Webhooks verification, refunds.
 * Docs: https://docs.dodopayments.com/developer-resources/integration-guide
 *
 * Prices are dynamic (day-by-day tiers), so the Dashboard product must be a
 * one-time INR product with "Pay what you want" on and a low minimum (e.g. ₹1).
 * Each session sets `amount` to the server-computed price.
 */
import type { Env } from './env';
import { safeEqual } from './http';

const api = (env: Env) => (env.DODO_ENVIRONMENT === 'live_mode' ? 'https://live.dodopayments.com' : 'https://test.dodopayments.com');

export const dodoConfigured = (env: Env) => Boolean(env.DODO_PAYMENTS_API_KEY && env.DODO_PRODUCT_ID);

async function call<T>(env: Env, path: string, body: unknown): Promise<T> {
  const r = await fetch(`${api(env)}${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.DODO_PAYMENTS_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`Dodo ${path} failed: ${r.status} ${await r.text()}`);
  return (await r.json()) as T;
}

export async function createCheckout(
  env: Env,
  amountPaise: number,
  bookingId: string,
  customer: { name: string; email: string; phone: string },
  returnUrl: string,
) {
  const session = await call<{ session_id: string; checkout_url: string | null }>(env, '/checkouts', {
    product_cart: [{ product_id: env.DODO_PRODUCT_ID, quantity: 1, amount: amountPaise }],
    billing_currency: 'INR',
    customer: customer.email ? { email: customer.email, name: customer.name, phone_number: customer.phone || undefined } : undefined,
    metadata: { booking: bookingId },
    return_url: returnUrl,
  });
  if (!session.checkout_url) throw new Error('Dodo returned no checkout_url');
  return { id: session.session_id, url: session.checkout_url };
}

const enc = new TextEncoder();
const b64 = (buf: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(buf)));

/**
 * Standard Webhooks: base64(HMAC_SHA256(base64decode(secret minus "whsec_"),
 * `${webhook-id}.${webhook-timestamp}.${body}`)), sent as "v1,<sig>" (space-separated
 * when the secret is being rotated). Timestamps older than 5 minutes are rejected.
 */
export async function verifyDodoWebhook(env: Env, rawBody: string, headers: Headers): Promise<boolean> {
  const secret = env.DODO_PAYMENTS_WEBHOOK_KEY;
  const id = headers.get('webhook-id') ?? '';
  const ts = headers.get('webhook-timestamp') ?? '';
  const sigs = headers.get('webhook-signature') ?? '';
  if (!secret || !id || !ts || !sigs) return false;
  if (Math.abs(Date.now() / 1000 - Number(ts)) > 300) return false;
  const keyBytes = Uint8Array.from(atob(secret.replace(/^whsec_/, '')), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey('raw', keyBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const expected = b64(await crypto.subtle.sign('HMAC', key, enc.encode(`${id}.${ts}.${rawBody}`)));
  return sigs.split(' ').some((s) => {
    const [version, sig] = s.split(',');
    return version === 'v1' && sig !== undefined && safeEqual(sig, expected);
  });
}

export async function dodoRefund(env: Env, paymentId: string): Promise<{ ok: boolean; detail: string }> {
  try {
    const r = await call<{ refund_id: string; status: string }>(env, '/refunds', { payment_id: paymentId, reason: 'Sponsor booking rejected' });
    return { ok: r.status !== 'failed', detail: `refund ${r.refund_id} ${r.status}` };
  } catch (err) {
    return { ok: false, detail: String(err instanceof Error ? err.message : err) };
  }
}
