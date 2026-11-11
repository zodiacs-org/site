/** A private return-instant calendar marker. No chart inputs enter the file. */
import type { SolarReturnExportModel } from '../islands/solar-return/export-model';
import { escapeIcalText, foldIcalLine, formatIcalUtc } from './ical';

const CRLF = '\r\n';

function returnYear(model: SolarReturnExportModel): number {
  if (!Number.isInteger(model.returnYear) || model.returnYear < 1 || model.returnYear > 9999) {
    throw new RangeError('Invalid solar return year.');
  }
  return model.returnYear;
}

function returnInstant(value: string): Date {
  // The export model supplies an ISO UTC instant. Reject timezone-free input
  // and normalized invalid dates instead of changing the marker by locale.
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value)) {
    throw new RangeError('Invalid UTC solar return instant.');
  }
  const instant = new Date(value);
  formatIcalUtc(instant);
  const canonical = value.includes('.') ? value : value.replace('Z', '.000Z');
  if (instant.toISOString() !== canonical) throw new RangeError('Invalid UTC solar return instant.');
  return instant;
}

function wholeMinute(instant: Date): Date {
  return new Date(Math.round(instant.getTime() / 60_000) * 60_000);
}

export function solarReturnCalendarFilename(model: SolarReturnExportModel): string {
  return `zodiacs-${model.noTime ? 'approximate-' : ''}solar-return-${returnYear(model)}.ics`;
}

/** One transparent minute marks an instant (a whole day for a return without a birth time); it is not a forecast duration. */
export function buildSolarReturnCalendar(
  model: SolarReturnExportModel,
  generatedAt: Date | string,
): string {
  const year = returnYear(model);
  // The marker is the return to the whole minute, as its image prints it: to
  // the second, the return gives the birth instant to about a second, and
  // before standard time the birthplace's longitude. Re-export and
  // relocation preserve the same UID.
  const exact = returnInstant(model.instantUtc);
  const instant = wholeMinute(exact);
  const dtstamp = formatIcalUtc(generatedAt);
  if (!/^\d{8}T\d{6}Z$/.test(dtstamp)) throw new RangeError('Invalid UTC calendar receipt time.');
  const title = model.noTime ? 'Approximate solar return' : 'Solar return';
  // Without a birth time the return is a date, a day either side, never a
  // clock time: the marker is the UTC date of the return itself, unrounded
  // (as the page, the birthday report and the image give it), as an all-day
  // event. Rounding to the minute first could move 23:59:30 or later to the
  // next day.
  const dayStart = Date.UTC(exact.getUTCFullYear(), exact.getUTCMonth(), exact.getUTCDate());
  const icalDate = (ms: number) => new Date(ms).toISOString().slice(0, 10).replace(/-/g, '');
  const [day, nextDay] = [icalDate(dayStart), icalDate(dayStart + 86_400_000)];
  const uidInstant = model.noTime ? day : instant.toISOString().replace(/[-:.]/g, '');
  const when = model.noTime
    ? [`DTSTART;VALUE=DATE:${day}`, `DTEND;VALUE=DATE:${nextDay}`]
    : [`DTSTART:${formatIcalUtc(instant)}`, 'DURATION:PT1M'];
  const description = [
    model.noTime
      ? 'Calendar marker for the day of the return. It is not a duration of the solar return.'
      : 'Calendar marker. The one-minute duration is for display only, not a duration of the solar return.',
    ...(model.noTime ? ['The return instant can shift by hours with your exact birth time.'] : []),
  ].join('\n');

  // Deliberately select only year, instant and uncertainty. Do not serialize
  // model notes, readings, wheel data, or any extra birth/profile properties.
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Zodiacs.org//Solar Return 1.0//EN',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:solar-return-${year}-${uidInstant}@zodiacs.org`,
    `DTSTAMP:${dtstamp}`,
    ...when,
    'TRANSP:TRANSPARENT',
    `SUMMARY:${escapeIcalText(`${title} · ${year}`)}`,
    `DESCRIPTION:${escapeIcalText(description)}`,
    'URL:https://zodiacs.org/solar-return/',
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  return lines.map(foldIcalLine).join(CRLF) + CRLF;
}
