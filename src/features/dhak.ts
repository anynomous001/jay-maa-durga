/**
 * Dhak. Plays short clips cut from a real Durga Puja dhak recording
 * ("Durga Puja Dhak Dhol" by Mamta Jagdish Dhody, Wikimedia Commons,
 * CC BY-SA 4.0 — credited in the dhak sheet and ASSETS.md). The clips are
 * fetched only when the dhak sheet opens. If they can't load, it falls back
 * to the Web Audio synthesis below ("bass" boom + "kathi" stick crack).
 */
import { onLangChange, t } from '../lib/i18n';
let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let noiseBuf: AudioBuffer | null = null;

function audio(): AudioContext {
  if (!ctx) {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    ctx = new AC();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 4;
    master = ctx.createGain();
    master.gain.value = 0.9;
    master.connect(comp).connect(ctx.destination);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

const jitter = (v: number, amt = 0.04) => v * (1 + (Math.random() * 2 - 1) * amt);

function membrane(t: number, f0: number, f1: number, dur: number, gain: number) {
  const c = ctx!;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(jitter(f0), t);
  osc.frequency.exponentialRampToValueAtTime(jitter(f1), t + dur * 0.5);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g).connect(master!);
  osc.start(t);
  osc.stop(t + dur + 0.05);
}

function noise(t: number, type: BiquadFilterType, freq: number, q: number, dur: number, gain: number) {
  const c = ctx!;
  const src = c.createBufferSource();
  src.buffer = noiseBuf;
  const f = c.createBiquadFilter();
  f.type = type;
  f.frequency.value = jitter(freq, 0.08);
  f.Q.value = q;
  const g = c.createGain();
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g).connect(master!);
  src.start(t, Math.random() * 0.3);
  src.stop(t + dur + 0.02);
}

/** Deep stroke on the bass head. */
function bass(t: number, level = 1) {
  membrane(t, 155, 62, 0.75, 0.95 * level);
  membrane(t, 240, 118, 0.35, 0.35 * level); // body overtone
  noise(t, 'lowpass', 900, 0.7, 0.06, 0.5 * level); // skin slap
}

/** Bright stick (kathi) stroke on the treble head. */
function kathi(t: number, level = 1) {
  membrane(t, 420, 300, 0.16, 0.45 * level);
  noise(t, 'bandpass', 2800, 1.4, 0.05, 0.9 * level); // wood crack
  noise(t, 'highpass', 5200, 0.7, 0.025, 0.35 * level);
}

let alt = 0;
function synthHit(): void {
  const c = audio();
  const t = c.currentTime + 0.005;
  // Alternate a full stroke with a lighter flam so repeated taps feel alive.
  if (alt++ % 3 === 2) {
    kathi(t, 0.9);
    kathi(t + 0.07, 0.6);
  } else {
    bass(t);
    kathi(t + 0.012, 0.7);
  }
}

/** One cycle of an original 8-beat festive pattern (B = bass, K = kathi). */
const PATTERN: [number, 'B' | 'K' | 'BK'][] = [
  [0, 'BK'], [0.5, 'K'], [0.75, 'K'], [1, 'B'], [1.5, 'K'], [2, 'BK'], [2.25, 'K'], [2.5, 'K'], [3, 'B'], [3.5, 'K'],
  [4, 'BK'], [4.5, 'K'], [4.75, 'K'], [5, 'B'], [5.5, 'K'], [6, 'BK'], [6.25, 'K'], [6.5, 'K'], [6.75, 'K'], [7, 'BK'],
];

function synthRhythm(onBeat: (delayMs: number) => void): void {
  const c = audio();
  const beat = 60 / 128 / 1; // seconds per beat at 128 BPM
  const t0 = c.currentTime + 0.05;
  for (let rep = 0; rep < 2; rep++) {
    for (const [pos, stroke] of PATTERN) {
      const t = t0 + (rep * 8 + pos) * beat;
      if (stroke.includes('B')) bass(t, 0.95);
      if (stroke.includes('K')) kathi(t + (stroke === 'BK' ? 0.01 : 0), stroke === 'K' ? 0.75 : 0.7);
      if (stroke.includes('B')) onBeat((t - c.currentTime) * 1000);
    }
  }
}

// ── Real recording ──
interface DhakMeta {
  hitLength: number;
  hits: number[];
  rhythmBeats: number[];
}
let samples: Promise<{ hits: AudioBuffer; rhythm: AudioBuffer; meta: DhakMeta } | null> | null = null;

function loadSamples() {
  if (!samples) {
    const c = audio();
    const get = async (url: string) => c.decodeAudioData(await (await fetch(url)).arrayBuffer());
    samples = Promise.all([get('/audio/dhak-hits.m4a'), get('/audio/dhak-rhythm.m4a'), fetch('/audio/dhak.json').then((r) => r.json())])
      .then(([hits, rhythm, meta]) => ({ hits, rhythm, meta: meta as DhakMeta }))
      .catch(() => null);
  }
  return samples;
}

let nextHit = 0;
let rhythmSrc: AudioBufferSourceNode | null = null;
let beatTimers: number[] = [];

async function playHit() {
  const s = await loadSamples();
  if (!s) return synthHit();
  const c = audio();
  const src = c.createBufferSource();
  src.buffer = s.hits;
  src.playbackRate.value = jitter(1, 0.025); // tiny variation so repeats feel played
  src.connect(master!);
  const offset = s.meta.hits[nextHit++ % s.meta.hits.length];
  src.start(c.currentTime + 0.003, offset, s.meta.hitLength);
}

function stopRhythm() {
  rhythmSrc?.stop();
  rhythmSrc = null;
  beatTimers.forEach(clearTimeout);
  beatTimers = [];
}

async function playRhythm(onBeat: (delayMs: number) => void, onEnd: () => void) {
  const s = await loadSamples();
  if (!s) {
    synthRhythm(onBeat);
    beatTimers.push(window.setTimeout(onEnd, 8000));
    return;
  }
  const c = audio();
  stopRhythm();
  const src = c.createBufferSource();
  src.buffer = s.rhythm;
  src.connect(master!);
  src.onended = () => {
    if (rhythmSrc === src) {
      rhythmSrc = null;
      onEnd();
    }
  };
  src.start();
  rhythmSrc = src;
  beatTimers = s.meta.rhythmBeats.map((b) => window.setTimeout(() => onBeat(0), b * 1000));
}

/**
 * Welcome dhak: a few seconds of the real rhythm, soft and fading out.
 * Must be called from inside a user gesture (it unlocks audio). Returns a
 * function that fades it out early.
 */
export function playWelcome(seconds = 7): () => void {
  const c = audio(); // synchronous, inside the gesture
  const g = c.createGain();
  g.gain.value = 0;
  g.connect(master!);
  let src: AudioBufferSourceNode | null = null;
  let stopped = false;
  void loadSamples().then((s) => {
    if (!s || stopped) return;
    const t0 = c.currentTime + 0.02;
    src = c.createBufferSource();
    src.buffer = s.rhythm;
    src.connect(g);
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(0.5, t0 + 0.4);
    g.gain.setValueAtTime(0.5, t0 + seconds - 1.5);
    g.gain.linearRampToValueAtTime(0, t0 + seconds);
    src.start(t0);
    src.stop(t0 + seconds + 0.05);
  });
  return () => {
    stopped = true;
    if (!src) return;
    const t = c.currentTime;
    g.gain.cancelScheduledValues(t);
    g.gain.setValueAtTime(g.gain.value, t);
    g.gain.linearRampToValueAtTime(0, t + 0.3);
    src.stop(t + 0.35);
  };
}

export function initDhak(): void {
  const btn = document.getElementById('dhak-btn')!;
  const rhythmBtn = document.getElementById('dhak-rhythm')!;
  let playing = false;
  const animate = () => {
    btn.classList.remove('hit');
    void btn.offsetWidth; // restart CSS animation
    btn.classList.add('hit');
  };
  const syncRhythmBtn = () => (rhythmBtn.textContent = t(playing ? 'dhak.stop' : 'dhak.rhythm'));
  const tap = () => {
    void playHit();
    animate();
  };
  // Start fetching the recording as soon as the dhak sheet is opened (a user gesture).
  document.querySelector('[data-open="sheet-dhak"]')?.addEventListener('click', () => {
    audio();
    void loadSamples();
  });
  btn.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    tap();
  });
  // Keyboard: Enter/Space fire click without pointerdown.
  btn.addEventListener('click', (e) => {
    if (e.detail !== 0) return; // pointer clicks were already handled on pointerdown
    tap();
  });
  rhythmBtn.addEventListener('click', () => {
    if (playing) {
      stopRhythm();
      playing = false;
    } else {
      playing = true;
      void playRhythm(
        (ms) => window.setTimeout(animate, ms),
        () => {
          playing = false;
          syncRhythmBtn();
        },
      );
    }
    syncRhythmBtn();
  });
  // Closing the sheet stops the drum.
  document.getElementById('sheet-dhak')?.addEventListener('close', () => {
    stopRhythm();
    playing = false;
    syncRhythmBtn();
  });
  onLangChange(syncRhythmBtn);
}
