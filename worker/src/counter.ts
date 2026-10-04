/**
 * Visitor counter Durable Object.
 *
 *   POST /visit  { id, listening }  → counts a new unique visitor, marks them online
 *   POST /ping   { id, listening }  → heartbeat (every ~60 s while the page is visible)
 *   GET  /stats                     → { total, online, listening }
 *
 * `id` is a random string the browser keeps in localStorage — no cookies, no IPs,
 * nothing personal is stored. "Online" = pinged within the last 150 seconds.
 */
import { DurableObject } from 'cloudflare:workers';

import type { Env } from './env';

export interface Stats {
  total: number;
  online: number;
  listening: number;
}

const ONLINE_WINDOW_MS = 150_000;
const MIN_PING_GAP_MS = 10_000;
export const VISITOR_ID_RE = /^[a-z0-9-]{16,40}$/;

export class Counter extends DurableObject<Env> {
  private total = 0;
  /** Live presence lives in memory; it naturally empties if nobody is around. */
  private seen = new Map<string, { at: number; listening: boolean }>();

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.blockConcurrencyWhile(async () => {
      this.total = (await ctx.storage.get<number>('total')) ?? 0;
    });
  }

  async visit(id: string, listening: boolean): Promise<Stats> {
    const key = `v:${id}`;
    if (!(await this.ctx.storage.get(key))) {
      this.total++;
      await this.ctx.storage.put({ [key]: 1, total: this.total });
    }
    return this.ping(id, listening);
  }

  ping(id: string, listening: boolean): Stats {
    const now = Date.now();
    const prev = this.seen.get(id);
    // Ignore over-eager clients but still answer with fresh numbers.
    if (!prev || now - prev.at >= MIN_PING_GAP_MS || prev.listening !== listening) {
      this.seen.set(id, { at: now, listening });
    }
    return this.stats();
  }

  stats(): Stats {
    const cutoff = Date.now() - ONLINE_WINDOW_MS;
    let online = 0;
    let listening = 0;
    for (const [id, s] of this.seen) {
      if (s.at < cutoff) {
        this.seen.delete(id);
        continue;
      }
      online++;
      if (s.listening) listening++;
    }
    return { total: this.total, online, listening };
  }
}
