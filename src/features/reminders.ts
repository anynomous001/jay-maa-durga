/** Calendar reminders (Google + .ics) and WhatsApp share. */
import { MAHALAYA_BROADCAST_END, REMINDER_AT, SITE_URL } from '../config';
import { type CalEvent, downloadIcs, googleCalendarUrl } from '../lib/calendar';
import { onLangChange, t } from '../lib/i18n';

function events(): { mahalaya: CalEvent; shashthi: CalEvent } {
  const url = SITE_URL + '/';
  return {
    mahalaya: {
      uid: 'mahalaya-2026-broadcast@mahalaya-live',
      title: t('ev.mahalaya.title'),
      description: t('ev.mahalaya.desc', { url }),
      url,
      start: REMINDER_AT,
      end: MAHALAYA_BROADCAST_END,
      alarmMinutes: [0, 10],
    },
    shashthi: {
      uid: 'shashthi-2026@mahalaya-live',
      title: t('ev.shashthi.title'),
      description: t('ev.shashthi.desc', { url: SITE_URL + '/pandals/' }),
      url: SITE_URL + '/pandals/',
      start: '2026-10-16',
      end: '2026-10-17',
      allDay: true,
    },
  };
}

export const whatsappShareUrl = (text: string) => `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;

export function initReminders(): void {
  const $ = (id: string) => document.getElementById(id)!;
  const render = () => {
    const ev = events();
    ($('gcal-mahalaya') as HTMLAnchorElement).href = googleCalendarUrl(ev.mahalaya);
    ($('gcal-shashthi') as HTMLAnchorElement).href = googleCalendarUrl(ev.shashthi);
    ($('wa-share') as HTMLAnchorElement).href = whatsappShareUrl(t('rem.waText', { url: SITE_URL + '/?ref=share' }));
  };
  render();
  onLangChange(render);
  $('ics-mahalaya').addEventListener('click', () => downloadIcs('mahalaya-2026.ics', [events().mahalaya]));
  $('ics-shashthi').addEventListener('click', () => downloadIcs('durga-puja-shashthi-2026.ics', [events().shashthi]));
}
