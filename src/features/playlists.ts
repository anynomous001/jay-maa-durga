/** Curated official embeds; iframes are created only when the user taps "Load". */
import data from '../../data/playlists.json';
import { onLangChange, t } from '../lib/i18n';

const ICON_AUDIO =
  '<svg viewBox="0 0 24 24" aria-hidden="true" width="16" height="16"><path d="M4 14v-2a8 8 0 0 1 16 0v2" fill="none" stroke="currentColor" stroke-width="2"/><rect x="3" y="13" width="4.5" height="7" rx="1.5" fill="currentColor"/><rect x="16.5" y="13" width="4.5" height="7" rx="1.5" fill="currentColor"/></svg>';
const ICON_VIDEO =
  '<svg viewBox="0 0 24 24" aria-hidden="true" width="16" height="16"><rect x="3" y="6" width="13" height="12" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M16 10.5 21 8v8l-5-2.5z" fill="currentColor"/></svg>';

interface Track {
  title: string;
  artist: string;
  platform: 'youtube' | 'spotify';
  url: string;
}

type Mode = 'audio' | 'video';

function embedFor(tr: Track, mode: Mode): HTMLIFrameElement | null {
  const f = document.createElement('iframe');
  f.title = `${tr.title} — ${tr.artist}`;
  f.referrerPolicy = 'strict-origin-when-cross-origin';
  if (tr.platform === 'youtube') {
    const id = new URL(tr.url).searchParams.get('v');
    if (!id) return null;
    f.src = `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0&playsinline=1`;
    f.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
    // YouTube requires the player to stay visible (min 200×200), so "audio" is a mini player.
    f.className = mode === 'video' ? 'yt' : 'yt-mini';
  } else {
    const path = new URL(tr.url).pathname; // /album/ID | /playlist/ID | /track/ID
    f.src = `https://open.spotify.com/embed${path}?utm_source=generator&theme=0`;
    f.allow = 'autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture';
    f.className = 'sp-mini';
    f.height = '152';
  }
  return f;
}

/** Floating "now playing" mini player (outside the sheet, so audio keeps going). */
const mini = {
  el: () => document.getElementById('mini-player'),
  close() {
    const el = this.el();
    if (!el) return;
    el.querySelector('.mini-frame')!.innerHTML = '';
    el.hidden = true;
  },
  open(tr: Track, frame: HTMLIFrameElement) {
    const el = this.el();
    if (!el) return;
    el.querySelector('.mini-frame')!.replaceChildren(frame);
    el.querySelector('.mini-title')!.textContent = tr.title;
    el.querySelector('.mini-artist')!.textContent = tr.artist;
    el.dataset.platform = tr.platform;
    el.hidden = false;
  },
};
export const closeMiniPlayer = () => mini.close();

export function initPlaylists(): void {
  const tabs = document.getElementById('pl-tabs')!;
  const panels = document.getElementById('pl-panels')!;
  const lists = data.lists as { id: string; items: Track[] }[];
  let active = lists[0].id;

  function build() {
    tabs.innerHTML = '';
    panels.innerHTML = '';
    lists.forEach((list) => {
      const tab = document.createElement('button');
      tab.type = 'button';
      tab.role = 'tab';
      tab.id = `tab-${list.id}`;
      tab.setAttribute('aria-controls', `panel-${list.id}`);
      tab.setAttribute('aria-selected', String(list.id === active));
      tab.tabIndex = list.id === active ? 0 : -1;
      tab.textContent = t(`pl.${list.id}`);
      tab.addEventListener('click', () => select(list.id));
      tabs.appendChild(tab);

      const panel = document.createElement('div');
      panel.id = `panel-${list.id}`;
      panel.role = 'tabpanel';
      panel.setAttribute('aria-labelledby', tab.id);
      panel.hidden = list.id !== active;
      const ul = document.createElement('ul');
      ul.className = 'tracks';
      if (!list.items.length) ul.innerHTML = `<li class="muted">${t('pl.empty')}</li>`;
      for (const tr of list.items) {
        const li = document.createElement('li');
        li.className = 'track';
        li.innerHTML = `<div class="track-head"><div class="track-info"><span class="track-title"></span><span class="track-artist"></span></div><span class="badge"></span><div class="track-actions"></div></div>`;
        li.querySelector('.track-title')!.textContent = tr.title;
        li.querySelector('.track-artist')!.textContent = tr.artist;
        li.querySelector('.badge')!.textContent = tr.platform === 'youtube' ? 'YouTube' : 'Spotify';
        const actions = li.querySelector('.track-actions')!;
        const modes: Mode[] = tr.platform === 'youtube' ? ['audio', 'video'] : ['audio'];
        for (const mode of modes) {
          const b = document.createElement('button');
          b.type = 'button';
          b.className = 'btn btn-sm ' + (mode === 'audio' ? '' : 'btn-ghost');
          b.dataset.mode = mode;
          b.innerHTML = `${mode === 'audio' ? ICON_AUDIO : ICON_VIDEO}<span></span>`;
          b.querySelector('span')!.textContent = t(mode === 'audio' ? 'pl.audio' : 'pl.video');
          b.setAttribute('aria-label', `${t(mode === 'audio' ? 'pl.audio' : 'pl.video')}: ${tr.title}`);
          b.addEventListener('click', () => {
            const f = embedFor(tr, mode);
            if (!f) return;
            // Pause the radio (and any other song) before this one starts.
            window.dispatchEvent(new CustomEvent('media:start'));
            if (mode === 'audio') {
              mini.open(tr, f);
              (document.getElementById('sheet-songs') as HTMLDialogElement | null)?.close();
            } else {
              mini.close();
              li.querySelector('iframe')?.remove();
              li.appendChild(f);
            }
          });
          actions.appendChild(b);
        }
        ul.appendChild(li);
      }
      panel.appendChild(ul);
      panels.appendChild(panel);
    });
  }

  function select(id: string) {
    active = id;
    tabs.querySelectorAll<HTMLButtonElement>('[role=tab]').forEach((b) => {
      const on = b.id === `tab-${id}`;
      b.setAttribute('aria-selected', String(on));
      b.tabIndex = on ? 0 : -1;
      if (on) b.focus();
    });
    panels.querySelectorAll<HTMLElement>('[role=tabpanel]').forEach((p) => (p.hidden = p.id !== `panel-${id}`));
  }

  // Arrow-key navigation between tabs.
  tabs.addEventListener('keydown', (e) => {
    const i = lists.findIndex((l) => l.id === active);
    if (e.key === 'ArrowRight') select(lists[(i + 1) % lists.length].id);
    else if (e.key === 'ArrowLeft') select(lists[(i - 1 + lists.length) % lists.length].id);
  });

  build();
  document.querySelector('#mini-player .mini-close')?.addEventListener('click', () => mini.close());
  // Rebuilding would drop loaded players, so only relabel on language change.
  onLangChange(() => {
    lists.forEach((l) => {
      const tab = document.getElementById(`tab-${l.id}`);
      if (tab) tab.textContent = t(`pl.${l.id}`);
    });
    panels.querySelectorAll<HTMLButtonElement>('.track-actions button').forEach((b) => {
      b.querySelector('span')!.textContent = t(b.dataset.mode === 'audio' ? 'pl.audio' : 'pl.video');
    });
  });
}
