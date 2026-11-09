/**
 * A calendar file for a picked day: the day itself, and a week later an
 * all-day reminder, "How did your day go?", with the follow-up link. Built on
 * the device and handed to the person to save; nothing is sent. It carries
 * the goal, the day and the finder's score only, never a birth date or name.
 */
import { GOAL_RULES } from './goals';
import { dayLabel } from './find';
import { followUpDue, followUpLink, type PickedDay } from './outcomes';

const compact = (date: string) => date.replaceAll('-', '');
const next = (date: string) => new Date(Date.parse(`${date}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
/** RFC 5545 text: backslash, semicolon and comma escaped, lines folded at 75 octets. */
const text = (value: string) => value.replace(/\\/gu, '\\\\').replace(/;/gu, '\;').replace(/,/gu, '\\,');
function fold(line: string): string {
  const out: string[] = [];
  let rest = line;
  while (rest.length > 74) { out.push(rest.slice(0, 74)); rest = ` ${rest.slice(74)}`; }
  out.push(rest);
  return out.join('\r\n');
}

export function pickCalendar(origin: string, pick: PickedDay, stamp: string): string {
  const goal = GOAL_RULES[pick.goal];
  const link = followUpLink(origin, pick);
  const due = followUpDue(pick.day);
  const uid = `good-days-${pick.goal}-${compact(pick.day)}`;
  const event = (id: string, date: string, summary: string, description: string, url: string | null) => [
    'BEGIN:VEVENT', `UID:${id}@zodiacs.org`, `DTSTAMP:${stamp}`, `DTSTART;VALUE=DATE:${compact(date)}`, `DTEND;VALUE=DATE:${compact(next(date))}`,
    `SUMMARY:${text(summary)}`, `DESCRIPTION:${text(description)}`, ...(url ? [`URL:${url}`] : []), 'TRANSP:TRANSPARENT', 'END:VEVENT',
  ];
  const lines = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Zodiacs//Good day finder//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    ...event(`${uid}-day`, pick.day, `${goal.label}: the day you picked`, `Picked with the good day finder on zodiacs.org (${dayLabel(pick.day)}).`, `${origin}/good-days/`),
    ...event(`${uid}-follow-up`, due, 'How did your day go?', `A week on from ${dayLabel(pick.day)}. Tell us in a few seconds: ${link}`, link),
    'END:VCALENDAR',
  ];
  return `${lines.map(fold).join('\r\n')}\r\n`;
}
