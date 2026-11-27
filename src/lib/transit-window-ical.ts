/** Calendar periods derived on device. No birth details or profile fields. */
import { escapeIcalText, foldIcalLine, formatIcalUtc, type TransitCalendarOptions } from './ical';
import type { TransitWindow } from './engine/transit-window-core';

export function calendarTransitWindows(windows: readonly TransitWindow[], timeKnown: boolean): TransitWindow[] {
  return windows.filter((window) => window.membershipStatus === 'resolved'
    && !window.boundaryTouch
    && (timeKnown || !['Moon', 'ASC', 'MC'].includes(window.natalPoint))
    && Number.isFinite(Date.parse(window.startUtc)) && Number.isFinite(Date.parse(window.endUtc))
    && Date.parse(window.endUtc) - Date.parse(window.startUtc) >= 1000);
}

export function serializeTransitWindows(
  windows: readonly TransitWindow[],
  options: TransitCalendarOptions & { timeKnown: boolean; birthTimeKnown?: boolean },
): string {
  const periods = calendarTransitWindows(windows, options.timeKnown)
    .sort((a, b) => a.startUtc.localeCompare(b.startUtc) || a.id.localeCompare(b.id));
  if (!periods.length) throw new RangeError('No resolved positive-duration periods are available for a calendar.');
  const stamp = formatIcalUtc(options.generatedAt);
  const unique = new Set<string>();
  const events = periods.flatMap((window) => {
    const start = formatIcalUtc(window.startUtc); const end = formatIcalUtc(window.endUtc);
    const uid = `${window.transitBody}-${window.natalPoint}-${window.aspect}-${start}-${end}@zodiacs.org`;
    if (unique.has(uid)) return [];
    unique.add(uid);
    const details = [
      'Estimated tropical transit period within a 3-degree orb. Dates are approximate, not predictions of events.',
      window.startClipped ? 'Already in orb at the start of the searched range; earlier entry is unknown.' : 'Starts at the estimated entry into orb.',
      window.endClipped ? 'Still in orb at the end of the searched range; later exit is unknown.' : 'Ends at the estimated exit from orb.',
      options.hostZoneDiffers
        ? options.birthTimeKnown === false
          ? 'Uses reference natal positions for local noon from a device whose time-zone data differed from our historical table near the birth date; its offset was used, Moon and angles are excluded, and period dates depend on it.'
          : 'Calculated from the supplied birth time on a device whose time-zone data differed from our historical table near the birth date; its offset was used, Moon and angles are excluded, and period dates depend on it.'
        : !options.timeKnown
          ? 'Uses reference natal positions. Birth time is unknown or unverified; Moon and angles are excluded.'
          : '',
    ];
    if (window.exactTopologyStatus === 'uncertain' || window.peak.kind === 'uncertain') {
      details.push('Close alignment over this period; exact timing and number of passes are unresolved. No precise peak is asserted.');
    } else if (window.peak.kind === 'closest-approach' && window.peak.atUtc) {
      details.push(`Estimated closest approach: ${window.peak.atUtc}. This contact does not become exact within this period.`);
    } else if (window.peak.kind === 'non-unique') {
      details.push('Several equally close approaches occur in this period; there is no unique peak instant.');
    } else if (window.peak.kind === 'plateau') {
      details.push('Closest alignment spans a range; there is no unique peak instant.');
    } else if (window.exactPassesUtc.length) {
      details.push(`Model-estimated exact passes (UTC): ${window.exactPassesUtc.join(', ')}.`);
    } else {
      details.push('No verified peak lies within this searched portion.');
    }
    for (const note of options.notes ?? []) {
      const trimmed = note.trim();
      if (trimmed) details.push(trimmed);
    }
    return [
      'BEGIN:VEVENT', `UID:${escapeIcalText(uid)}`, `DTSTAMP:${stamp}`,
      `DTSTART:${start}`, `DTEND:${end}`, 'TRANSP:TRANSPARENT',
      `SUMMARY:${escapeIcalText(`${window.transitBody} ${window.aspect} natal ${window.natalPoint} · approximate period`)}`,
      `DESCRIPTION:${escapeIcalText(details.filter(Boolean).join(' '))}`, 'END:VEVENT',
    ];
  });
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Zodiacs.org//Transit Periods 1.0//EN',
    'CALSCALE:GREGORIAN', `X-WR-CALNAME:${escapeIcalText(options.calendarName ?? 'My transit itinerary')}`,
    ...events, 'END:VCALENDAR'].map(foldIcalLine).join('\r\n') + '\r\n';
}
