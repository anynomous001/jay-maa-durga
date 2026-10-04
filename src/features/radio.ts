/**
 * Live radio player for Akashvani's official HLS streams.
 * - Native HLS where the browser has it (Safari/iOS, Android Chrome);
 *   otherwise hls.js (light build) is lazy-loaded on first play.
 * - Auto-retry with exponential backoff; fallback links get highlighted.
 * - Media Session for lock-screen controls.
 * The stream is never proxied or cached by us.
 */
import type HlsType from 'hls.js';
import {
  LISTENER_COUNT_ENDPOINT,
  MAHALAYA_BROADCAST_END,
  MAHALAYA_TRANSMISSION_START,
  MEDIA_SESSION_TITLE,
  RADIO_CHANNELS,
  SITE_NAME,
  type RadioChannel,
} from '../config';
import { getLang, num, onLangChange, t } from '../lib/i18n';
import { at, now } from '../lib/time';

type State = 'idle' | 'loading' | 'playing' | 'buffering' | 'paused' | 'retrying' | 'error';
const BACKOFF_S = [2, 4, 8, 15, 30];
const STALL_TIMEOUT_MS = 20_000;
const CHANNEL_KEY = 'radio-channel';

/** 0.1 s of silence, used to "unlock" the audio element inside a user gesture. */
function silentWavUrl(): string {
  const rate = 8000, samples = 800;
  const buf = new ArrayBuffer(44 + samples);
  const v = new DataView(buf);
  const w = (o: number, s: string) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  w(0, 'RIFF'); v.setUint32(4, 36 + samples, true); w(8, 'WAVE'); w(12, 'fmt ');
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, rate, true); v.setUint32(28, rate, true); v.setUint16(32, 1, true);
  v.setUint16(34, 8, true); w(36, 'data'); v.setUint32(40, samples, true);
  new Uint8Array(buf, 44).fill(128);
  return URL.createObjectURL(new Blob([buf], { type: 'audio/wav' }));
}

export class Radio {
  private audio: HTMLAudioElement;
  private hls: HlsType | null = null;
  private state: State = 'idle';
  private wantPlay = false;
  private failures = 0;
  private retryTimer = 0;
  private retryTick = 0;
  private stallTimer = 0;
  private mediaRecovered = false;
  channel: RadioChannel;
  private nativeHls: boolean;
  private listeners = new Set<(s: State) => void>();

  constructor(private els: {
    audio: HTMLAudioElement; player: HTMLElement; btn: HTMLButtonElement; label: HTMLElement;
    status: HTMLElement; live: HTMLElement; fallback: HTMLElement; channels: HTMLElement;
  }) {
    this.audio = els.audio;
    const saved = localStorage.getItem(CHANNEL_KEY);
    this.channel = RADIO_CHANNELS.find((c) => c.id === saved) ?? RADIO_CHANNELS[0];
    // `?hlsjs` forces the hls.js path (to test non-Safari/Firefox behaviour).
    this.nativeHls =
      this.audio.canPlayType('application/vnd.apple.mpegurl') !== '' && !new URLSearchParams(location.search).has('hlsjs');
    this.bindAudio();
    this.renderChannels();
    els.btn.addEventListener('click', () => (this.isActive() ? this.pause() : this.play()));
    onLangChange(() => {
      this.renderChannels();
      this.render();
    });
    this.setupMediaSession();
    this.render();
  }

  onState(fn: (s: State) => void) {
    this.listeners.add(fn);
  }

  isActive() {
    return this.wantPlay;
  }

  /** Call inside a user gesture so a later scripted play() is allowed (wake mode). */
  async unlock(): Promise<boolean> {
    if (this.wantPlay) return true;
    try {
      this.audio.src = silentWavUrl();
      await this.audio.play();
      this.audio.pause();
      this.audio.removeAttribute('src');
      this.audio.load();
      return true;
    } catch {
      return false;
    }
  }

  async play(): Promise<void> {
    this.wantPlay = true;
    this.clearRetry();
    this.setState('loading');
    try {
      await this.attach();
      await this.audio.play();
    } catch (e) {
      if ((e as DOMException)?.name === 'NotAllowedError') {
        // Autoplay blocked (no user gesture). Wait for a tap.
        this.wantPlay = false;
        this.setState('paused');
        return;
      }
      if ((e as DOMException)?.name !== 'AbortError') this.fail();
    }
  }

  pause(): void {
    this.wantPlay = false;
    this.clearRetry();
    this.audio.pause();
    // Drop the connection entirely: a paused live stream should not keep downloading.
    this.detach();
    this.setState('paused');
  }

  setChannel(id: string): void {
    const ch = RADIO_CHANNELS.find((c) => c.id === id);
    if (!ch || ch.id === this.channel.id) return;
    this.channel = ch;
    localStorage.setItem(CHANNEL_KEY, ch.id);
    this.failures = 0;
    this.updateMetadata();
    if (this.wantPlay) {
      this.detach();
      void this.play();
    } else this.render();
  }

  // ── internals ──
  private async attach(): Promise<void> {
    this.detach();
    const url = this.channel.url;
    if (this.nativeHls) {
      this.audio.src = url;
      return;
    }
    const { default: Hls } = (await import('hls.js/light')) as { default: typeof HlsType };
    if (!Hls.isSupported()) {
      this.audio.src = url; // last resort
      return;
    }
    const hls = new Hls({
      lowLatencyMode: false,
      manifestLoadingMaxRetry: 2,
      levelLoadingMaxRetry: 2,
      fragLoadingMaxRetry: 3,
    });
    this.hls = hls;
    this.mediaRecovered = false;
    hls.on(Hls.Events.ERROR, (_e, data) => {
      if (!data.fatal) return;
      if (data.type === Hls.ErrorTypes.MEDIA_ERROR && !this.mediaRecovered) {
        this.mediaRecovered = true;
        hls.recoverMediaError();
        return;
      }
      this.fail();
    });
    hls.loadSource(url);
    hls.attachMedia(this.audio);
  }

  private detach(): void {
    clearTimeout(this.stallTimer);
    if (this.hls) {
      this.hls.destroy();
      this.hls = null;
    }
    if (this.audio.getAttribute('src')) {
      this.audio.removeAttribute('src');
      this.audio.load();
    }
  }

  private fail(): void {
    if (!this.wantPlay) return;
    this.detach();
    this.failures++;
    const delay = BACKOFF_S[Math.min(this.failures - 1, BACKOFF_S.length - 1)];
    let left = delay;
    this.setState('retrying', { s: left, n: this.failures });
    this.retryTick = window.setInterval(() => {
      left--;
      if (left > 0) this.setState('retrying', { s: left, n: this.failures });
    }, 1000);
    this.retryTimer = window.setTimeout(() => {
      this.clearRetry();
      void this.play();
    }, delay * 1000);
  }

  private clearRetry(): void {
    clearTimeout(this.retryTimer);
    clearInterval(this.retryTick);
  }

  private bindAudio(): void {
    const a = this.audio;
    a.addEventListener('playing', () => {
      clearTimeout(this.stallTimer);
      this.failures = 0;
      this.setState('playing');
    });
    a.addEventListener('waiting', () => {
      if (!this.wantPlay) return;
      this.setState('buffering');
      clearTimeout(this.stallTimer);
      this.stallTimer = window.setTimeout(() => this.fail(), STALL_TIMEOUT_MS);
    });
    a.addEventListener('error', () => {
      // Native-HLS errors arrive here; hls.js reports through its own events.
      if (this.wantPlay && !this.hls && a.getAttribute('src')) this.fail();
    });
    a.addEventListener('pause', () => {
      // Paused externally (lock screen, headphones unplugged, OS interruption).
      if (this.wantPlay && this.state === 'playing' && !a.ended) {
        this.wantPlay = false;
        this.detach();
        this.setState('paused');
      }
    });
  }

  private setState(s: State, vars?: Record<string, number>): void {
    this.state = s;
    this.render(vars);
    this.listeners.forEach((fn) => fn(s));
    if ('mediaSession' in navigator) {
      navigator.mediaSession.playbackState = s === 'paused' || s === 'idle' ? 'paused' : 'playing';
    }
  }

  private render(vars?: Record<string, number>): void {
    const { player, label, status, live, fallback, btn } = this.els;
    const s = this.state;
    player.dataset.state = s;
    const busy = s === 'loading' || s === 'buffering' || s === 'retrying';
    live.hidden = s !== 'playing';
    label.textContent = t(this.wantPlay ? 'radio.pause' : 'radio.play');
    btn.setAttribute('aria-label', `${label.textContent} — ${this.channelName()}`);
    btn.setAttribute('aria-pressed', String(this.wantPlay));
    player.setAttribute('aria-busy', String(busy));
    const text: Record<State, string> = {
      idle: t('radio.idle'),
      loading: t('radio.loading'),
      buffering: t('radio.buffering'),
      playing: t('radio.playing', { ch: this.channelName() }),
      paused: t('radio.paused'),
      retrying: t('radio.retry', { s: num(vars?.s ?? 0), n: num(vars?.n ?? this.failures) }),
      error: t('radio.error'),
    };
    status.textContent = text[s];
    fallback.classList.toggle('alert', this.failures >= 3 || s === 'error');
  }

  private channelName(ch = this.channel) {
    return getLang() === 'bn' ? ch.name_bn : ch.name_en;
  }

  private renderChannels(): void {
    const box = this.els.channels;
    box.querySelectorAll('.chip').forEach((n) => n.remove());
    for (const ch of RADIO_CHANNELS) {
      const label = document.createElement('label');
      label.className = 'chip';
      label.innerHTML = `<input type="radio" name="channel" value="${ch.id}"><span></span>`;
      const input = label.querySelector('input')!;
      input.checked = ch.id === this.channel.id;
      label.querySelector('span')!.textContent = this.channelName(ch);
      input.addEventListener('change', () => this.setChannel(ch.id));
      box.appendChild(label);
    }
  }

  private title(): string {
    const n = now();
    const window = n >= at(MAHALAYA_TRANSMISSION_START) - 3_600_000 && n < at(MAHALAYA_BROADCAST_END);
    return window ? MEDIA_SESSION_TITLE : `${this.channel.name_en} — Live`;
  }

  private updateMetadata(): void {
    if (!('mediaSession' in navigator)) return;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: this.title(),
      artist: this.channel.name_en,
      album: SITE_NAME,
      artwork: [
        { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
        { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      ],
    });
  }

  private setupMediaSession(): void {
    if (!('mediaSession' in navigator)) return;
    const ms = navigator.mediaSession;
    ms.setActionHandler('play', () => void this.play());
    ms.setActionHandler('pause', () => this.pause());
    try {
      ms.setActionHandler('stop', () => this.pause());
    } catch {
      /* not supported everywhere */
    }
    this.onState((s) => {
      if (s === 'loading' || s === 'playing') this.updateMetadata();
    });
  }
}

export function initRadio(): Radio {
  const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
  const radio = new Radio({
    audio: $('audio'),
    player: $('player'),
    btn: $('play-btn'),
    label: document.querySelector('#play-btn .play-label') as HTMLElement,
    status: $('player-status'),
    live: $('live-badge'),
    fallback: $('fallback'),
    channels: $('channels'),
  });

  // Hook for a future live-listener counter (needs a backend; see README).
  if (LISTENER_COUNT_ENDPOINT) {
    const el = $('listener-count');
    const poll = async () => {
      try {
        const r = await fetch(LISTENER_COUNT_ENDPOINT!);
        const { count } = (await r.json()) as { count: number };
        el.textContent = t('radio.listeners', { n: num(count) });
        el.hidden = false;
      } catch {
        el.hidden = true;
      }
    };
    void poll();
    setInterval(poll, 60_000);
  }
  if (import.meta.env.DEV) (window as unknown as { __radio: Radio }).__radio = radio;
  return radio;
}
