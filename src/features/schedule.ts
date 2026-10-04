/** Puja calendar with "today" / "in N days" labels computed on the IST calendar. */
import { PUJA_DAYS } from '../config';
import { getLang, num, onLangChange, t } from '../lib/i18n';
import { IST, dayDiff, formatDate, istDateKey, istNoon, now } from '../lib/time';

function whenLabel(diff: number): string {
  if (diff === 0) return t('sch.today');
  if (diff === 1) return t('sch.tomorrow');
  if (diff > 1) return t('sch.inDays', { n: num(diff) });
  return t('sch.done');
}

export function initSchedule(): void {
  const list = document.getElementById('schedule-list')!;
  let lastKey = '';

  function render() {
    const today = istDateKey(now());
    lastKey = today;
    const bn = getLang() === 'bn';
    list.innerHTML = '';
    for (const day of PUJA_DAYS) {
      const first = day.dates[0];
      const last = day.dates[day.dates.length - 1];
      const isToday = day.dates.includes(today);
      const diff = isToday ? 0 : dayDiff(today, first);
      const past = !isToday && dayDiff(today, last) < 0;
      const dateText = day.dates.map((d) => formatDate(istNoon(d), getLang(), IST)).join(' – ');
      const li = document.createElement('li');
      if (isToday) {
        li.className = 'is-today';
        li.setAttribute('aria-current', 'date');
      } else if (past) li.className = 'is-past';
      li.innerHTML = `<span><span class="s-name"></span><span class="s-alt"></span></span><span class="s-date"><time></time><span class="s-when"></span></span>`;
      li.querySelector('.s-name')!.textContent = bn ? day.name_bn : day.name_en;
      li.querySelector('.s-alt')!.textContent = ' · ' + (bn ? day.name_en : day.name_bn);
      const time = li.querySelector('time')!;
      time.dateTime = first;
      time.textContent = dateText;
      li.querySelector('.s-when')!.textContent = whenLabel(past ? -1 : diff);
      list.appendChild(li);
    }
  }

  render();
  onLangChange(render);
  // Roll over at IST midnight without a reload.
  setInterval(() => {
    if (istDateKey(now()) !== lastKey) render();
  }, 30_000);
}
