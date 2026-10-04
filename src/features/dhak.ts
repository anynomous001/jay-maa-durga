/**
 * Dhak — fully synthesised with Web Audio (no samples, nothing to license).
 * "bass" = deep membrane boom; "kathi" = the stick's bright crack.
 */
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
export function hit(): void {
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

export function rhythm(onBeat: (delayMs: number) => void): void {
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

export function initDhak(): void {
  const btn = document.getElementById('dhak-btn')!;
  const animate = () => {
    btn.classList.remove('hit');
    void btn.offsetWidth; // restart CSS animation
    btn.classList.add('hit');
  };
  btn.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    hit();
    animate();
  });
  // Keyboard: Enter/Space fire click without pointerdown.
  btn.addEventListener('click', (e) => {
    if (e.detail !== 0) return; // pointer clicks were already handled on pointerdown
    hit();
    animate();
  });
  document.getElementById('dhak-rhythm')!.addEventListener('click', () =>
    rhythm((ms) => setTimeout(animate, ms)),
  );
}
