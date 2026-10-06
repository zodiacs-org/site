/** Minimal deterministic UTC iCalendar from computed lunar events. */
import { moonPhase, searchLongitudeCrossingsWith } from '@zodiacs/engine';
const from = new Date('2026-10-01T00:00:00Z'), to = new Date('2026-10-31T00:00:00Z');
const stamp = date => date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
const rows = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Zodiacs//Synthetic lunar example//EN'];
for (const [angle, title] of [[0, 'New Moon'], [180, 'Full Moon']]) {
  const search = searchLongitudeCrossingsWith((_body, date) => moonPhase(date).angle, 'Moon', angle, from, to, { stepDays: 0.5, maxSamples: 1000 });
  if (search.status !== 'complete') throw new Error('The calendar search exceeded its budget; no calendar is published.');
  for (const event of search.crossings) rows.push('BEGIN:VEVENT', `UID:lunar-${angle}-${stamp(event.at)}@zodiacs.org`, 'DTSTAMP:20261001T000000Z', `DTSTART:${stamp(event.at)}`, `SUMMARY:${title}`, 'DESCRIPTION:Computed lunar event; search completeness tested not proven.', 'END:VEVENT');
}
rows.push('END:VCALENDAR'); process.stdout.write(`${rows.join('\r\n')}\r\n`);
