/** Lazy, calculator-only receipt capture. Never reconstructs a legacy summary. */
import type { BirthInput } from '@zodiacs/engine';
import { serializeNatalEnvelope, type NatalReference } from '@zodiacs/engine/receipt';
import { parseCivilDate, parseCivilTime } from '../time/civil-date';
import { computePortableChart, PortableChartError } from './portable';

export interface CalculatorWallTime {
  date: string;
  time: string;
  timeZone: string;
  offsetMinutes: number;
  /** The calculator explicitly selects local noon only for unknown time. */
  reference: Extract<NatalReference, 'supplied-instant' | 'local-noon'>;
  /** Present when the entered date was Old Style (Julian) and converted to `date`. */
  calendar?: 'gregorian' | 'julian';
  writtenDate?: string;
}

/** Capture the actual resolved wall-time assertions without consulting Intl again. */
export function computeCalculatorReceipt(input: BirthInput, local: CalculatorWallTime) {
  try {
    // After successful host resolution, a signed fixed-offset zone is supported
    // by the old calculator but cannot be represented by this draft receipt.
    // Let the caller select its existing chart path before any natal calculation.
    if (/^[+-]/.test(local.timeZone)) return null;
    // Exact-pole angles are outside the delivered receipt's declared coverage.
    // Unknown time has no angles/houses and remains eligible for a receipt.
    if (input.timeKnown !== false && input.latitude !== undefined && Math.abs(input.latitude) === 90) return null;
    const date = parseCivilDate(local.date);
    const time = parseCivilTime(local.time);
    if (!date || !time) throw new PortableChartError();
    const wall = new Date(0);
    wall.setUTCFullYear(date.year, date.month - 1, date.day);
    wall.setUTCHours(time.hour, time.minute, 0, 0);
    const instant = new Date(input.utc).getTime();
    const gapShiftMinutes = (instant + local.offsetMinutes * 60_000 - wall.getTime()) / 60_000;
    // Caller flags and captured wall-time context can disagree, including
    // older minute-resolution results. Preserve the chart without certifying them.
    // Do not round the shift away, invent a flag, or calculate a second time.
    if (gapShiftMinutes < 0 || (input.flags?.includes('dst-gap') ?? false) !== (gapShiftMinutes > 0)) return null;
    const { chart, envelope } = computePortableChart(input, {
      reference: local.reference,
      localResolution: {
        date: local.date,
        time: local.time,
        timeZone: local.timeZone,
        offsetMinutes: local.offsetMinutes,
        gapShiftMinutes,
        policy: { fold: 'earlier', gap: 'shift-forward' },
        ...(local.calendar ? { calendar: local.calendar } : {}),
        ...(local.writtenDate ? { writtenDate: local.writtenDate } : {}),
      },
    });
    // Strings remain immutable even while the presentation chart is augmented.
    return { chart, envelopeJson: serializeNatalEnvelope(envelope) };
  } catch {
    throw new PortableChartError();
  }
}
