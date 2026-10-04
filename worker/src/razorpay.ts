/**
 * Razorpay: create orders, verify checkout signatures and webhooks, refund.
 * Docs: https://razorpay.com/docs/payments/payment-gateway/web-integration/standard/
 */
import type { Env } from './env';
import { hmacSha256Hex, safeEqual } from './http';

const API = 'https://api.razorpay.com/v1';

/** Fake payments only when explicitly allowed (local dev) AND no real keys are set. */
export const isMock = (env: Env) => !env.RAZORPAY_KEY_ID && env.ALLOW_MOCK === 'true';
export const paymentsConfigured = (env: Env) => Boolean(env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET) || isMock(env);

const auth = (env: Env) => 'Basic ' + btoa(`${env.RAZORPAY_KEY_ID}:${env.RAZORPAY_KEY_SECRET}`);

export async function createOrder(env: Env, amountPaise: number, receipt: string, notes: Record<string, string>) {
  if (isMock(env)) return { id: `order_mock_${receipt.slice(0, 20)}`, amount: amountPaise, currency: 'INR' };
  const r = await fetch(`${API}/orders`, {
    method: 'POST',
    headers: { Authorization: auth(env), 'Content-Type': 'application/json' },
    body: JSON.stringify({ amount: amountPaise, currency: 'INR', receipt, notes }),
  });
  if (!r.ok) throw new Error(`Razorpay order failed: ${r.status} ${await r.text()}`);
  return (await r.json()) as { id: string; amount: number; currency: string };
}

/** Checkout success handler signature: HMAC_SHA256(order_id + "|" + payment_id, key_secret). */
export async function verifyCheckout(env: Env, orderId: string, paymentId: string, signature: string): Promise<boolean> {
  if (isMock(env)) return orderId.startsWith('order_mock_') && signature === 'mock-ok';
  if (!env.RAZORPAY_KEY_SECRET) return false;
  const expected = await hmacSha256Hex(env.RAZORPAY_KEY_SECRET, `${orderId}|${paymentId}`);
  return safeEqual(expected, signature);
}

/** Webhook signature: HMAC_SHA256(raw body, webhook secret). */
export async function verifyWebhook(env: Env, rawBody: string, signature: string): Promise<boolean> {
  if (!env.RAZORPAY_WEBHOOK_SECRET || !signature) return false;
  return safeEqual(await hmacSha256Hex(env.RAZORPAY_WEBHOOK_SECRET, rawBody), signature);
}

export async function refund(env: Env, paymentId: string): Promise<{ ok: boolean; detail: string }> {
  if (isMock(env) || paymentId.startsWith('pay_mock_')) return { ok: true, detail: 'mock refund' };
  const r = await fetch(`${API}/payments/${encodeURIComponent(paymentId)}/refund`, {
    method: 'POST',
    headers: { Authorization: auth(env), 'Content-Type': 'application/json' },
    body: JSON.stringify({ speed: 'normal' }),
  });
  return { ok: r.ok, detail: r.ok ? 'refund requested' : `${r.status} ${await r.text()}` };
}
