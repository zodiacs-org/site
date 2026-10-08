/** The words for "Your week": the site's transit sentence, and dates on the device's own clock. */
import type { NatalPoint } from '../../lib/engine/transit-scan-shared';
import { transitLine } from '../../lib/transits';
import type { WeekItem } from './week';

const POINT_NAME: Partial<Record<NatalPoint, string>> = { ASC: 'rising sign', MC: 'Midheaven' };
const pointName = (point: NatalPoint) => POINT_NAME[point] ?? point;

/** "Mars square your Sun". */
export const weekTitle = (item: WeekItem) => `${item.transitBody} ${item.aspect} your ${pointName(item.natalPoint)}`;

/** The site's transit sentence for this contact. */
export const weekLine = (item: WeekItem) => transitLine(item.transitBody, item.aspect, pointName(item.natalPoint));

/** "Thu 9 Oct", on the device's clock unless a zone is given. */
export function weekDay(iso: string, timeZone?: string): string {
  return new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short', ...(timeZone ? { timeZone } : {}) }).format(new Date(iso));
}

/** "Thu 9 Oct to Sat 11 Oct · exact on Fri 10 Oct", "All week", "Until Sat 11 Oct", "From Tue 14 Oct". */
export function weekDates(item: WeekItem, timeZone?: string): string {
  const start = weekDay(item.startUtc, timeZone), end = weekDay(item.endUtc, timeZone);
  const span = item.startClipped && item.endClipped ? 'All week'
    : item.startClipped ? `Until ${end}`
      : item.endClipped ? `From ${start}`
        : start === end ? start : `${start} to ${end}`;
  const exact = [...new Set(item.exactUtc.map(at => weekDay(at, timeZone)))];
  return exact.length ? `${span} · exact on ${exact.join(' and ')}` : span;
}
