/**
 * "Make a Mahalaya card": draws a 1080×1920 greeting (Stories / WhatsApp status size)
 * on a canvas with the visitor's name, then lets them download or share the PNG.
 * Everything happens in the browser; the name is never sent anywhere.
 */
import { SITE_URL } from '../config';
import { onLangChange, t } from '../lib/i18n';

const W = 1080;
const H = 1920;
const FONT = "'Noto Serif Bengali', 'Hind Siliguri', 'Noto Sans Bengali', serif";

let bg: HTMLImageElement | null = null;
function loadBg(): Promise<HTMLImageElement | null> {
  if (bg) return Promise.resolve(bg);
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve((bg = img));
    img.onerror = () => resolve(null);
    img.src = '/hero/port-720.jpg';
  });
}

/** Largest font size (≤ max) at which `text` fits in `width`. */
function fit(ctx: CanvasRenderingContext2D, text: string, width: number, max: number, weight = 600): number {
  let size = max;
  for (; size > 28; size -= 4) {
    ctx.font = `${weight} ${size}px ${FONT}`;
    if (ctx.measureText(text).width <= width) break;
  }
  return size;
}

async function draw(canvas: HTMLCanvasElement, name: string): Promise<void> {
  const text = [t('card.greet'), name && t('card.from', { name }), t('card.date'), t('card.listen')].join(' ');
  await Promise.all([loadBg(), document.fonts?.load(`600 64px ${FONT}`, text).catch(() => [])]);
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#0c0f1f';
  ctx.fillRect(0, 0, W, H);
  if (bg) {
    const s = Math.max(W / bg.width, H / bg.height);
    const w = bg.width * s;
    const h = bg.height * s;
    ctx.drawImage(bg, (W - w) / 2, (H - h) / 2, w, h);
  }
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, 'rgba(8,10,28,0.78)');
  g.addColorStop(0.3, 'rgba(8,10,28,0.25)');
  g.addColorStop(0.55, 'rgba(8,10,28,0.55)');
  g.addColorStop(1, 'rgba(8,10,28,0.95)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  const line = (s: string, y: number, max: number, color: string, weight = 600) => {
    const size = fit(ctx, s, W - 160, max, weight);
    ctx.font = `${weight} ${size}px ${FONT}`;
    ctx.fillStyle = color;
    ctx.shadowColor = 'rgba(0,0,0,0.55)';
    ctx.shadowBlur = 18;
    ctx.fillText(s, W / 2, y);
    ctx.shadowBlur = 0;
  };
  line('মা আসছেন', 190, 64, '#f4b942');
  line(t('card.greet'), 1250, 150, '#f6efe0');
  if (name) line(t('card.from', { name }), 1380, 72, '#f4b942');
  line(t('card.date'), 1520, 58, '#f1ece2', 400);
  line(t('card.listen'), 1780, 50, '#f1ece2', 400);
  ctx.fillStyle = '#f4b942';
  ctx.fillRect(W / 2 - 60, 1590, 120, 4);
  line(SITE_URL.replace(/^https?:\/\//, ''), 1850, 46, '#f4b942', 400);
}

export function initCard(): void {
  const canvas = document.getElementById('card-canvas') as HTMLCanvasElement | null;
  if (!canvas) return;
  const input = document.getElementById('card-name') as HTMLInputElement;
  const dl = document.getElementById('card-download') as HTMLButtonElement;
  const share = document.getElementById('card-share') as HTMLButtonElement;
  canvas.width = W;
  canvas.height = H;

  let pending = 0;
  const render = () => {
    const id = ++pending;
    draw(canvas, input.value.trim().slice(0, 30)).catch(() => {
      if (id === pending) canvas.hidden = true;
    });
  };
  const toBlob = () => new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/png'));
  const fileName = () => `mahalaya-2026${input.value.trim() ? '-' + input.value.trim().replace(/[^\p{L}\p{M}\p{N}]+/gu, '-').slice(0, 20) : ''}.png`;

  input.addEventListener('input', render);
  document.querySelector('[data-open="sheet-card"]')?.addEventListener('click', render);
  onLangChange(render);

  dl.addEventListener('click', async () => {
    const blob = await toBlob();
    if (!blob) return;
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: fileName() });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  });

  // Share the picture itself where the browser can (phones); otherwise only Download shows.
  const probe = typeof File === 'function' ? new File([], 'x.png', { type: 'image/png' }) : null;
  if (typeof navigator.canShare === 'function' && probe && navigator.canShare({ files: [probe] })) {
    share.hidden = false;
    share.addEventListener('click', async () => {
      const blob = await toBlob();
      if (!blob) return;
      const file = new File([blob], fileName(), { type: 'image/png' });
      navigator
        .share({ files: [file], text: t('card.shareText', { url: SITE_URL + '/?ref=s-card' }) })
        .catch(() => {});
    });
  }
}
