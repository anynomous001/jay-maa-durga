/**
 * Visitor counter Durable Object.
 *
 *   POST /visit  { id, listening }  → counts a new unique visitor, marks them online
 *   POST /ping   { id, listening }  → heartbeat (every ~60 s while the page is visible)
 *   GET  /stats                     → { total, online, listening }
 *   GET  /stats/refs                → per-channel counts (see ChannelStats)
 *   GET  /polls?id=…                → poll totals, plus this visitor's own votes
 *   POST /polls/vote { id, poll, choice } → one vote per visitor per poll (changeable)
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
/** ?ref= channel tags: short lowercase slugs. Untagged visitors count as "direct". */
export const REF_RE = /^[a-z0-9-]{1,24}$/;
const MAX_REFS = 40; // further new tags are pooled as "other" (keeps junk links from bloating storage)

/** Site polls and their allowed answers. The site shows the same ids (src/features/polls.ts). */
export const POLLS: Record<string, readonly string[]> = {
  'use-for-hopping': ['yes', 'maybe', 'no'],
  'more-pandals': ['yes', 'no'],
};
/** poll id → answer → number of votes */
export type PollCounts = Record<string, Record<string, number>>;
export interface PollResults {
  counts: PollCounts;
  /** This visitor's answer per poll, if they voted. */
  mine: Record<string, string>;
}

/** Per channel, credited to the tag a visitor FIRST arrived with. */
export interface ChannelStats {
  visitors: number; // unique visitors
  visits: number; // page loads by those visitors (returning visits included)
  mapVisits: number; // page loads of the pandal map
  listeners: number; // visitors who played the radio at least once
}

export class Counter extends DurableObject<Env> {
  private total = 0;
  private refs: Record<string, ChannelStats> = {};
  private listened = new Set<string>();
  private polls: PollCounts = {};
  /** Live presence lives in memory; it naturally empties if nobody is around. */
  private seen = new Map<string, { at: number; listening: boolean }>();

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.blockConcurrencyWhile(async () => {
      this.total = (await ctx.storage.get<number>('total')) ?? 0;
      this.refs = (await ctx.storage.get<Record<string, ChannelStats>>('refs')) ?? {};
      this.polls = (await ctx.storage.get<PollCounts>('polls')) ?? {};
    });
  }

  private channel(ref: string): ChannelStats {
    if (!this.refs[ref] && Object.keys(this.refs).length >= MAX_REFS) ref = 'other';
    return (this.refs[ref] ??= { visitors: 0, visits: 0, mapVisits: 0, listeners: 0 });
  }

  /** The channel a visitor is credited to (visitors from before tagging stored 1 → "direct"). */
  private async refOf(id: string): Promise<string | null> {
    const v = await this.ctx.storage.get<string | number>(`v:${id}`);
    return v === undefined ? null : typeof v === 'string' ? v : 'direct';
  }

  async visit(id: string, listening: boolean, ref = '', page = ''): Promise<Stats> {
    const key = `v:${id}`;
    let mine = await this.refOf(id);
    const writes: Record<string, unknown> = {};
    if (mine === null) {
      mine = REF_RE.test(ref) ? ref : 'direct';
      if (!this.refs[mine] && Object.keys(this.refs).length >= MAX_REFS) mine = 'other';
      this.total++;
      this.channel(mine).visitors++;
      writes[key] = mine;
      writes.total = this.total;
    }
    const ch = this.channel(mine);
    ch.visits++;
    if (page === 'pandals') ch.mapVisits++;
    writes.refs = this.refs;
    await this.ctx.storage.put(writes);
    return this.ping(id, listening);
  }

  ping(id: string, listening: boolean): Stats {
    if (listening && !this.listened.has(id)) void this.markListener(id);
    const now = Date.now();
    const prev = this.seen.get(id);
    // Ignore over-eager clients but still answer with fresh numbers.
    if (!prev || now - prev.at >= MIN_PING_GAP_MS || prev.listening !== listening) {
      this.seen.set(id, { at: now, listening });
    }
    return this.stats();
  }

  /** First time a visitor plays the radio, credit their channel (once, ever). */
  private async markListener(id: string) {
    this.listened.add(id);
    const lkey = `l:${id}`;
    if (await this.ctx.storage.get(lkey)) return;
    const mine = (await this.refOf(id)) ?? 'direct';
    this.channel(mine).listeners++;
    await this.ctx.storage.put({ [lkey]: 1, refs: this.refs });
  }

  /** Totals for every poll, and which answers this visitor picked (if `id` is given). */
  async pollResults(id = ''): Promise<PollResults> {
    const mine: Record<string, string> = {};
    if (id) {
      const keys = Object.keys(POLLS).map((p) => `p:${p}:${id}`);
      for (const [key, choice] of await this.ctx.storage.get<string>(keys)) mine[key.split(':')[1]] = choice;
    }
    return { counts: this.polls, mine };
  }

  /**
   * Records a vote. Only visitors the counter has seen (POST /visit) can vote; voting again moves the vote.
   * Returns null for an unknown visitor. Not tamper-proof: someone scripting fresh ids can still vote twice.
   */
  async vote(id: string, poll: string, choice: string): Promise<PollResults | null> {
    if ((await this.refOf(id)) === null) return null;
    const key = `p:${poll}:${id}`;
    const prev = await this.ctx.storage.get<string>(key);
    if (prev !== choice) {
      const counts = (this.polls[poll] ??= {});
      if (prev) counts[prev] = Math.max(0, (counts[prev] ?? 0) - 1);
      counts[choice] = (counts[choice] ?? 0) + 1;
      await this.ctx.storage.put({ [key]: choice, polls: this.polls });
    }
    return this.pollResults(id);
  }

  channels(): { channels: Record<string, ChannelStats>; total: number } {
    return { channels: this.refs, total: this.total };
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
