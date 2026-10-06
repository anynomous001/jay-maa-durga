import type { Counter } from './counter';
import type { Bookings } from './bookings';

export interface Env {
  COUNTER: DurableObjectNamespace<Counter>;
  BOOKINGS: DurableObjectNamespace<Bookings>;
  LOGOS: R2Bucket;
  /** Comma-separated origins allowed to call the API. */
  ALLOWED_ORIGINS: string;
  // Secrets (wrangler secret put … / .dev.vars locally):
  RAZORPAY_KEY_ID?: string;
  RAZORPAY_KEY_SECRET?: string;
  RAZORPAY_WEBHOOK_SECRET?: string;
  /** Dodo Payments API key (dodo_test_… / dodo_live_…). */
  DODO_PAYMENTS_API_KEY?: string;
  /** Webhook signing secret (whsec_…) from Dashboard → Developer → Webhooks. */
  DODO_PAYMENTS_WEBHOOK_KEY?: string;
  /** One-time INR product with "Pay what you want" on (pdt_…). */
  DODO_PRODUCT_ID?: string;
  /** "live_mode" for real money; anything else uses test mode. */
  DODO_ENVIRONMENT?: string;
  /** Long random string; unlocks /admin endpoints. Unset = admin disabled. */
  ADMIN_TOKEN?: string;
  /** Local development only: "true" enables fake payments when no Razorpay keys are set. */
  ALLOW_MOCK?: string;
}
