/** Curated official embeds; iframes are created only when the user taps "Load". */
import data from '../../data/playlists.json';
import { onLangChange, t } from '../lib/i18n';

interface Track {
  title: string;
  artist: string;
  platform: 'youtube' | 'spotify';
  url: string;
}

function embedFor(tr: Track): HTMLIFrameElement | null {
  const f = document.createElement('iframe');
  f.loading = 'lazy';
  f.title = `${tr.title} — ${tr.artist}`;
  f.referrerPolicy = 'strict-origin-when-cross-origin';
  if (tr.platform === 'youtube') {
    const id = new URL(tr.url).searchParams.get('v');
    if (!id) return null;
    f.src = `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`;
    f.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
    f.className = 'yt';
  } else {
    const path = new URL(tr.url).pathname; // /album/ID | /playlist/ID | /track/ID
    f.src = `https://open.spotify.com/embed${path}?utm_source=generator&theme=0`;
    f.allow = 'autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture';
    f.height = path.startsWith('/track') ? '152' : '352';
  }
  return f;
}

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
        li.innerHTML = `<div class="track-head"><div class="track-info"><span class="track-title"></span><span class="track-artist"></span></div><span class="badge"></span><button type="button" class="btn btn-ghost"></button></div>`;
        li.querySelector('.track-title')!.textContent = tr.title;
        li.querySelector('.track-artist')!.textContent = tr.artist;
        li.querySelector('.badge')!.textContent = tr.platform === 'youtube' ? 'YouTube' : 'Spotify';
        const btn = li.querySelector('button')!;
        btn.textContent = t('pl.load');
        btn.setAttribute('aria-label', `${t('pl.load')}: ${tr.title}`);
        btn.addEventListener('click', () => {
          const f = embedFor(tr);
          if (!f) return;
          li.appendChild(f);
          btn.remove();
        });
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
  // Rebuilding would drop loaded players, so only relabel on language change.
  onLangChange(() => {
    lists.forEach((l) => {
      const tab = document.getElementById(`tab-${l.id}`);
      if (tab) tab.textContent = t(`pl.${l.id}`);
    });
    panels.querySelectorAll<HTMLButtonElement>('.track button').forEach((b) => (b.textContent = t('pl.load')));
  });
}
