// Renders the link-preview images (public/og.jpg, public/og-pandals.jpg) from the
// site's own background art, with the text drawn by the browser (proper Bengali
// shaping). One-off tool, not a dependency:
//   npm i --no-save playwright && npx playwright install chromium
//   node scripts/make-og-photo.mjs
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
const W = resolve(import.meta.dirname, '..');
const css = `
html,body{margin:0}body{width:1200px;height:630px;overflow:hidden;position:relative;color:#f6f1e7;font-family:"Hind Siliguri",sans-serif}
.bg{position:absolute;inset:0;background-size:cover}
.shade{position:absolute;inset:0;background:linear-gradient(90deg,rgba(8,10,28,.94) 0%,rgba(8,10,28,.82) 38%,rgba(8,10,28,.25) 62%,rgba(8,10,28,0) 78%),linear-gradient(0deg,rgba(8,10,28,.55) 0%,rgba(8,10,28,0) 30%)}
.txt{position:absolute;left:64px;top:0;bottom:0;width:600px;display:flex;flex-direction:column;justify-content:center}
.brand{display:flex;align-items:center;gap:14px;margin-bottom:22px}.brand img{height:54px}.brand span{font-family:"Noto Serif Bengali",serif;font-size:34px;font-weight:700;color:#f6f1e7}
.k{color:#f4b942;font-size:30px;font-weight:600;margin:0 0 4px}
h1{font-family:"Noto Serif Bengali",serif;font-weight:700;font-size:96px;line-height:1.12;margin:0 0 6px;text-shadow:0 4px 24px rgba(0,0,0,.6)}
.sub{font-size:38px;margin:0 0 8px;font-weight:600}
.en{font-size:28px;color:#d6d2e6;margin:0 0 26px;font-weight:600}
.chips{display:flex;flex-wrap:wrap;gap:10px;margin-bottom:22px}.chips span{font-size:23px;padding:5px 16px;border-radius:999px;background:rgba(255,255,255,.12);color:#f1ece2}
.url{font-size:24px;color:#f4b942;font-weight:600}`;
const data = (f, type) => `data:${type};base64,${readFileSync(`${W}/${f}`).toString('base64')}`;
const page = (bg, pos, body) => `<!doctype html><html lang="bn"><head><meta charset="utf-8">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Hind+Siliguri:wght@600&family=Noto+Serif+Bengali:wght@700&display=block">
<style>${css}</style></head><body><div class="bg" style="background-image:url('${data(bg, 'image/jpeg')}');background-position:${pos}"></div><div class="shade"></div>
<div class="txt"><div class="brand"><img src="${data('public/logo/mark-102.png', 'image/png')}"><span>মা আসছেন</span></div>${body}</div></body></html>`;
const jobs = [
  ['public/og.jpg', page('public/hero/land-1672.jpg', '70% 45%', `
    <p class="k">১০ অক্টোবর ২০২৬ · ভোর ৩:৫০</p><h1>শুভ মহালয়া</h1>
    <p class="sub">মহিষাসুরমর্দিনী — সরাসরি শুনুন</p>
    <p class="en">Mahalaya 2026 · Live on Akashvani · Pandal map</p>
    <p class="url">maa-aschen-nine.vercel.app</p>`)],
  ['public/og-pandals.jpg', page('public/bg/pandals/land-1672.jpg', '70% 50%', `
    <p class="k">দুর্গাপুজো ২০২৬ · কলকাতা</p><h1>প্যান্ডেল ম্যাপ</h1>
    <p class="en">Kolkata Durga Puja Pandal Map 2026</p>
    <div class="chips"><span>৫০+ প্যান্ডেল</span><span>উত্তর · দক্ষিণ</span><span>📍 আমার কাছে</span><span>🧭 ডিরেকশন</span></div>
    <p class="url">maa-aschen-nine.vercel.app/pandals</p>`)],
];
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1200, height: 630 } });
for (const [out, html] of jobs) {
  const p = await ctx.newPage();
  await p.setContent(html, { waitUntil: 'networkidle' });
  await p.evaluate(async () => { await document.fonts.load('700 96px "Noto Serif Bengali"', 'প্যান্ডেল ম্যাপ শুভ মহালয়া মা আসছেন'); await document.fonts.load('600 28px "Hind Siliguri"', 'Kolkata দুর্গাপুজো আমার কাছে মহিষাসুরমর্দিনী'); await document.fonts.ready; });
  await p.screenshot({ path: `${W}/${out}`, type: 'jpeg', quality: 84 });
  console.log('wrote', out);
}
await b.close();
