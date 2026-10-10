/** Home page: the pandal-hopping routes from data/pandals.json, each linking to the map page. */
import data from '../../data/pandals.json';
import { getLang, num, onLangChange, t } from '../lib/i18n';

interface Route {
  id: string;
  zone: string;
  name_bn: string;
  name_en: string;
  travelmode: 'walking' | 'driving' | 'transit';
  stops: string[];
}

const MODE_KEY = { walking: 'pm.walk', driving: 'pm.drive', transit: 'pm.transit' } as const;

export function initHop(): void {
  const list = document.getElementById('hop-list');
  if (!list) return;
  const render = () => {
    const bn = getLang() === 'bn';
    list.innerHTML = '';
    for (const r of data.routes as Route[]) {
      const li = document.createElement('li');
      const a = document.createElement('a');
      a.href = '/pandals/#routes';
      const name = document.createElement('span');
      name.className = 'hop-name';
      name.textContent = bn ? r.name_bn : r.name_en;
      const meta = document.createElement('span');
      meta.className = 'hop-meta';
      meta.textContent = [t('pm.zone.' + r.zone), t('pm.stops', { n: num(r.stops.length) }), t(MODE_KEY[r.travelmode])].join(' · ');
      a.append(name, meta);
      li.append(a);
      list.append(li);
    }
  };
  render();
  onLangChange(render);
}
