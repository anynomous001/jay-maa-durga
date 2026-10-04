/**
 * Visitor counter for Mahalaya Live (Cloudflare Worker + one Durable Object).
 *
 *   POST /visit  { id, listening }  → counts a new unique visitor, marks them online
 *   POST /ping   { id, listening }  → heartbeat (every ~60 s while the page is visible)
 *   GET  /stats                     → { total, online, listening }
 *
 * `id` is a random string the browser keeps in localStorage — no cookies, no IPs,
 * nothing personal is stored. "Online" = pinged within the last 150 seconds.
 */
import { DurableObject } from 'cloudflare:workers';

interface Env {
  COUNTER: DurableObjectNamespace<Counter>;
  ALLOWED_ORIGINS: string;
}

export interface Stats {
  total: number;
  online: number;
  listening: number;
}

const ONLINE_WINDOW_MS = 150_000;
const MIN_PING_GAP_MS = 10_000;
const ID_RE = /^[a-z0-9-]{16,40}$/;

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

function cors(req: Request, env: Env): Record<string, string> {
  const origin = req.headers.get('Origin') ?? '';
  const allowed = env.ALLOWED_ORIGINS.split(',').map((s) => s.trim());
  return allowed.includes(origin)
    ? { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', Vary: 'Origin' }
    : {};
}

const json = (body: unknown, headers: Record<string, string>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...headers },
  });

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const h = cors(req, env);
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: h });
    const { pathname } = new URL(req.url);
    const counter = env.COUNTER.get(env.COUNTER.idFromName('global'));

    if (req.method === 'GET' && pathname === '/stats') return json(await counter.stats(), h);

    if (req.method === 'POST' && (pathname === '/visit' || pathname === '/ping')) {
      if (Number(req.headers.get('Content-Length') ?? 0) > 200) return json({ error: 'too large' }, h, 413);
      let body: { id?: unknown; listening?: unknown };
      try {
        body = await req.json();
      } catch {
        return json({ error: 'bad json' }, h, 400);
      }
      const id = typeof body.id === 'string' ? body.id : '';
      if (!ID_RE.test(id)) return json({ error: 'bad id' }, h, 400);
      const listening = body.listening === true;
      const stats = pathname === '/visit' ? await counter.visit(id, listening) : await counter.ping(id, listening);
      return json(stats, h);
    }
    return json({ error: 'not found' }, h, 404);
  },
} satisfies ExportedHandler<Env>;
