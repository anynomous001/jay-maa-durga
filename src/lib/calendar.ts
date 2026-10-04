/** Google Calendar links and RFC 5545 .ics generation (UTC times, CRLF, folded lines). */

export interface CalEvent {
  uid: string;
  title: string;
  description: string;
  url: string;
  /** Timed event: ISO instants. All-day: dates as YYYY-MM-DD (end exclusive). */
  start: string;
  end: string;
  allDay?: boolean;
  /** Minutes before start for the alarm (timed events). */
  alarmMinutes?: number[];
}

const utcStamp = (iso: string) => new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
const dateStamp = (d: string) => d.replace(/-/g, '');

export function googleCalendarUrl(ev: CalEvent): string {
  const dates = ev.allDay
    ? `${dateStamp(ev.start)}/${dateStamp(ev.end)}`
    : `${utcStamp(ev.start)}/${utcStamp(ev.end)}`;
  const p = new URLSearchParams({
    action: 'TEMPLATE',
    text: ev.title,
    dates,
    details: ev.description,
    location: ev.url,
    ctz: 'Asia/Kolkata',
  });
  return `https://calendar.google.com/calendar/render?${p}`;
}

const escapeText = (s: string) =>
  s.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');

/** Fold to 75 octets per line without splitting UTF-8 sequences. */
function fold(line: string): string {
  const enc = new TextEncoder();
  const out: string[] = [];
  let cur = '';
  let bytes = 0;
  for (const ch of line) {
    const b = enc.encode(ch).length;
    const limit = out.length === 0 ? 75 : 74; // continuation lines start with a space
    if (bytes + b > limit) {
      out.push(cur);
      cur = '';
      bytes = 0;
    }
    cur += ch;
    bytes += b;
  }
  out.push(cur);
  return out.join('\r\n ');
}

export function buildIcs(events: CalEvent[]): string {
  const stamp = utcStamp(new Date().toISOString());
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Mahalaya Live//Reminders//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH'];
  for (const ev of events) {
    lines.push(
      'BEGIN:VEVENT',
      `UID:${ev.uid}`,
      `DTSTAMP:${stamp}`,
      ev.allDay ? `DTSTART;VALUE=DATE:${dateStamp(ev.start)}` : `DTSTART:${utcStamp(ev.start)}`,
      ev.allDay ? `DTEND;VALUE=DATE:${dateStamp(ev.end)}` : `DTEND:${utcStamp(ev.end)}`,
      `SUMMARY:${escapeText(ev.title)}`,
      `DESCRIPTION:${escapeText(ev.description)}`,
      `URL:${ev.url}`,
      `LOCATION:${escapeText(ev.url)}`,
    );
    for (const m of ev.alarmMinutes ?? []) {
      lines.push('BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${escapeText(ev.title)}`, `TRIGGER:-PT${m}M`, 'END:VALARM');
    }
    lines.push('END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return lines.map(fold).join('\r\n') + '\r\n';
}

export function downloadIcs(filename: string, events: CalEvent[]): void {
  const blob = new Blob([buildIcs(events)], { type: 'text/calendar;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
}
