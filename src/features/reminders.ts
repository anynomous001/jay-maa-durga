/** Shashthi calendar reminder (Google + .ics) and the share buttons. */
import { SITE_URL } from '../config';
import { type CalEvent, downloadIcs, googleCalendarUrl } from '../lib/calendar';
import { onLangChange, t } from '../lib/i18n';

/** Shashthi, the first day of the Puja (all day). Also offered in the schedule sheet. */
function shashthi(): CalEvent {
  return {
    uid: 'shashthi-2026@mahalaya-live',
    title: t('ev.shashthi.title'),
    description: t('ev.shashthi.desc', { url: SITE_URL + '/pandals/' }),
    url: SITE_URL + '/pandals/',
    start: '2026-10-16',
    end: '2026-10-17',
    allDay: true,
  };
}

export const whatsappShareUrl = (text: string) => `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;

export function initReminders(): void {
  const $ = (id: string) => document.getElementById(id)!;
  const render = () => {
    const ev = shashthi();
    ($('gcal-puja') as HTMLAnchorElement).href = googleCalendarUrl(ev);
    ($('gcal-shashthi') as HTMLAnchorElement).href = googleCalendarUrl(ev);
    ($('wa-share') as HTMLAnchorElement).href = whatsappShareUrl(t('rem.waText', { url: SITE_URL + '/?ref=s-wa' }));
    ($('fb-share') as HTMLAnchorElement).href =
      'https://www.facebook.com/sharer/sharer.php?u=' + encodeURIComponent(SITE_URL + '/?ref=s-fb');
  };
  render();
  onLangChange(render);
  for (const id of ['ics-puja', 'ics-shashthi'])
    $(id).addEventListener('click', () => downloadIcs('durga-puja-shashthi-2026.ics', [shashthi()]));
}

/** Native share sheet (phones), copy-link fallback. Each channel gets its own ?ref= tag. */
export function initShare(): void {
  const native = document.getElementById('native-share') as HTMLButtonElement;
  const copy = document.getElementById('copy-link') as HTMLButtonElement;
  if (typeof navigator.share === 'function') {
    native.hidden = false;
    native.addEventListener('click', () => {
      navigator
        .share({ title: t('share.title'), text: t('share.text'), url: SITE_URL + '/?ref=s-native' })
        .catch(() => {}); // user dismissed the sheet
    });
  }
  const label = copy.querySelector('span')!;
  copy.addEventListener('click', async () => {
    const url = SITE_URL + '/?ref=s-copy';
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      const ta = Object.assign(document.createElement('textarea'), { value: url });
      document.body.append(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }
    label.textContent = t('share.copied');
    setTimeout(() => (label.textContent = t('share.copy')), 2000);
  });
}
