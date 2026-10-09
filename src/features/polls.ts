/**
 * Two quick polls, answered by visitors and totalled by the Worker (see worker/src/counter.ts, POLLS).
 * One vote per browser per poll; tapping another answer moves the vote. Results show after voting.
 * The card stays hidden if there's no API or the Worker doesn't know /polls yet.
 */
import { API_URL } from '../config';
import { num, onLangChange, t } from '../lib/i18n';
import { visitorId } from './visitors';

const POLLS: { id: string; choices: string[] }[] = [
  { id: 'use-for-hopping', choices: ['yes', 'maybe', 'no'] },
  { id: 'more-pandals', choices: ['yes', 'no'] },
];

interface Results {
  counts: Record<string, Record<string, number>>;
  mine: Record<string, string>;
}

export function initPolls(): void {
  const box = document.getElementById('polls');
  if (!box || !API_URL) return;
  const id = visitorId();
  let results: Results | null = null;
  let busy = false;

  const render = () => {
    if (!results) return;
    const list = box.querySelector<HTMLElement>('.poll-list')!;
    list.innerHTML = '';
    for (const poll of POLLS) {
      const counts = results.counts[poll.id] ?? {};
      const total = poll.choices.reduce((n, c) => n + (counts[c] ?? 0), 0);
      const mine = results.mine[poll.id];
      const fieldset = document.createElement('fieldset');
      fieldset.className = 'poll';
      const legend = document.createElement('legend');
      legend.textContent = t(`poll.${poll.id}.q`);
      fieldset.append(legend);
      for (const choice of poll.choices) {
        const share = total ? Math.round(((counts[choice] ?? 0) * 100) / total) : 0;
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'poll-choice';
        b.setAttribute('aria-pressed', String(mine === choice));
        b.disabled = busy;
        const label = document.createElement('span');
        label.className = 'poll-label';
        label.textContent = t(`poll.${poll.id}.${choice}`);
        b.append(label);
        if (mine) {
          // Results only after voting, so the first answer isn't nudged by the crowd.
          b.style.setProperty('--share', `${share}%`);
          const pct = document.createElement('span');
          pct.className = 'poll-pct';
          pct.textContent = `${num(share)}%`;
          b.append(pct);
        }
        b.addEventListener('click', () => void vote(poll.id, choice));
        fieldset.append(b);
      }
      const note = document.createElement('p');
      note.className = 'muted small poll-note';
      note.textContent = mine ? t('poll.votes', { n: num(total) }) : t('poll.tap');
      fieldset.append(note);
      list.append(fieldset);
    }
  };

  const vote = async (poll: string, choice: string, retry = true): Promise<void> => {
    if (busy) return;
    busy = true;
    render();
    try {
      const res = await fetch(`${API_URL}/polls/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, poll, choice }),
      });
      // 403 = the counter hasn't registered this visitor yet (first page load still in flight): try once more.
      if (res.status === 403 && retry) {
        busy = false;
        await new Promise((r) => setTimeout(r, 1500));
        return vote(poll, choice, false);
      }
      if (res.ok) results = (await res.json()) as Results;
    } catch {
      /* offline: keep the old state */
    }
    busy = false;
    render();
  };

  fetch(`${API_URL}/polls?id=${encodeURIComponent(id)}`)
    .then((r) => (r.ok ? (r.json() as Promise<Results>) : null))
    .then((r) => {
      if (!r || typeof r.counts !== 'object') return;
      results = r;
      box.hidden = false;
      render();
    })
    .catch(() => {});
  onLangChange(render);
}
