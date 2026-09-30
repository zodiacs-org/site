import { describe, expect, it } from 'vitest';
import { natalChart } from '@zodiacs/engine';
import {
  prepareLocalTime as preparePackageLocalTime,
  resolveLocalToUtc as packageResolveLocalToUtc,
} from '@zodiacs/engine/geo';
import { createNatalEnvelope, parseNatalEnvelope, serializeNatalEnvelope } from '@zodiacs/engine/receipt';
import { prepareLocalTime, resolveLocalToUtc } from './localToUtc';

// Finite, independently reproduced host-IANA counterexamples to minute-only
// matching. These fixtures do not certify historical records or chart accuracy.
// Since engine rc.15 `lmt` means a local mean time read the wall time: after
// each of these gaps a legal clock reads it, national mean times with seconds
// such as Caracas's −4:27:40 included, so none carries it.
const historicalGaps = [
  ["America/Caracas", "1890-01-01", "1890-01-01T04:27:44.000Z", -267.6666666666667, 0.06666666666666667, ["dst-gap"]],
  ["America/Dawson_Creek", "1884-01-01", "1884-01-01T08:00:56.000Z", -480, 0.9333333333333333, ["dst-gap"]],
  ["America/Goose_Bay", "1935-03-30", "1935-03-30T03:30:52.000Z", -210, 0.8666666666666667, ["dst-gap"]],
  ["America/Manaus", "1914-01-01", "1914-01-01T04:00:04.000Z", -240, 0.06666666666666667, ["dst-gap"]],
  ["America/Paramaribo", "1935-01-01", "1935-01-01T03:40:52.000Z", -220.6, 0.26666666666666666, ["dst-gap"]],
  ["America/Port-au-Prince", "1890-01-01", "1890-01-01T04:49:20.000Z", -289, 0.3333333333333333, ["dst-gap"]],
  ["America/Punta_Arenas", "1890-01-01", "1890-01-01T04:43:40.000Z", -282.75, 0.9166666666666666, ["dst-gap"]],
  ["America/St_Johns", "1935-03-30", "1935-03-30T03:30:52.000Z", -210, 0.8666666666666667, ["dst-gap"]],
  ["America/Whitehorse", "1900-08-20", "1900-08-20T09:00:12.000Z", -540, 0.2, ["dst-gap"]],
  ["Asia/Colombo", "1880-01-01", "1879-12-31T18:40:36.000Z", 319.53333333333336, 0.13333333333333333, ["dst-gap"]],
  ["Asia/Tbilisi", "1924-05-02", "1924-05-01T21:00:49.000Z", 180, 0.8166666666666667, ["dst-gap"]],
  ["Brazil/West", "1914-01-01", "1914-01-01T04:00:04.000Z", -240, 0.06666666666666667, ["dst-gap"]],
  ["Canada/Newfoundland", "1935-03-30", "1935-03-30T03:30:52.000Z", -210, 0.8666666666666667, ["dst-gap"]],
  ["Canada/Yukon", "1900-08-20", "1900-08-20T09:00:12.000Z", -540, 0.2, ["dst-gap"]],
  ["Pacific/Norfolk", "1901-01-01", "1900-12-31T12:48:08.000Z", 672, 0.13333333333333333, ["dst-gap"]],
  ["Pacific/Tongatapu", "1945-09-10", "1945-09-09T11:40:48.000Z", 740, 0.8, ["dst-gap"]],
] as const;

// Without a longitude the site's resolver makes no `lmt` claim (the host's
// history cannot tell a mean time from a legal time at the same offset), so the
// readings on a zone's local mean time below carry no flag; the package, which
// reads its own history, flags them.
const adjacentCases = [
  ['1913-12-31', '23:59', 'America/Manaus', '1914-01-01T03:59:04.000Z', []],
  ['1914-01-01', '00:01', 'America/Manaus', '1914-01-01T04:01:00.000Z', []],
  ['1914-01-01', '12:00', 'America/Manaus', '1914-01-01T16:00:00.000Z', []],
  ['1884-01-01', '00:01', 'America/Dawson_Creek', '1884-01-01T08:01:00.000Z', []],
  ['1890-01-01', '00:01', 'America/Caracas', '1890-01-01T04:28:40.000Z', []],
  ['1883-11-18', '11:59', 'America/Denver', '1883-11-18T18:58:56.000Z', []],
  ['1883-11-18', '12:00', 'America/Denver', '1883-11-18T18:59:56.000Z', ['dst-fold']],
  ['1883-11-18', '12:01', 'America/Denver', '1883-11-18T19:01:00.000Z', []],
  ['1911-12-31', '23:59', 'Africa/Ndjamena', '1911-12-31T22:58:48.000Z', []],
  ['1912-01-01', '00:00', 'Africa/Ndjamena', '1911-12-31T23:00:00.000Z', []],
] as const;

/** The fields both resolvers give, without `lmt`, which the site claims only with a longitude. */
const reading = ({ utc, offsetMinutes, flags }: { utc: Date; offsetMinutes: number; flags: readonly string[] }) => ({
  utc, offsetMinutes, flags: flags.filter((flag) => flag !== 'lmt'),
});

/**
 * What the site's resolution and the package's share. From rc.15 the package
 * reads a wall time before 1970 on its shipped tzdb history, which has to be
 * loaded first, and returns more fields than the site's resolver does.
 */
async function packageReading(date: string, time: string, timeZone: string) {
  await preparePackageLocalTime(date, timeZone);
  return reading(packageResolveLocalToUtc(date, time, timeZone));
}

// Synthetic wall times at towns of the city index, given their longitudes,
// across local mean time, national mean times that ran to seconds, a local
// mean time in whole minutes and one across the date line.
const withLongitude = [
  ['1900-06-15', '12:00', 'Europe/Paris', -4.49, []], // Brest, Paris Mean Time (legal)
  ['1885-06-15', '12:00', 'Europe/Dublin', -9.05, []], // Galway, Dublin Mean Time (legal)
  ['1900-06-01', '12:00', 'Asia/Kolkata', 72.88, []], // Mumbai
  ['1960-06-01', '12:00', 'Africa/Monrovia', -10.8, []], // Monrovia Mean Time (legal)
  ['1860-06-15', '12:00', 'Africa/Addis_Ababa', 38.75, ['lmt']], // +2:35:00, whole minutes
  ['1907-03-14', '17:45', 'America/Mexico_City', -89.62, ['lmt']], // Merida
  ['1840-06-15', '12:00', 'Asia/Manila', 120.98, ['lmt']], // the American date until 1844
  ['1883-11-18', '12:02', 'America/New_York', -74.01, ['lmt']], // New York's own mean time, after the fold
  ['1890-06-01', '12:00', 'Pacific/Guam', 144.79, ['lmt']],
] as const;

describe('second-precise site timezone adoption', () => {
  it.each(historicalGaps)('preserves the actual seconds-sized gap in %s on %s through the SDK receipt', async (timeZone, date, instant, offsetMinutes, gapShiftMinutes, flags) => {
    const resolved = resolveLocalToUtc(date, '00:00', timeZone);
    expect(reading(resolved)).toEqual(await packageReading(date, '00:00', timeZone));
    expect(resolved.utc.toISOString()).toBe(instant);
    expect(resolved.utc.getUTCMilliseconds()).toBe(0);
    expect(resolved.offsetMinutes).toBe(offsetMinutes);
    expect(resolved.flags).toEqual(flags);
    const envelope = createNatalEnvelope(natalChart({
      utc: resolved.utc, latitude: -3.1, longitude: -60.02,
      houseSystem: 'placidus', timeKnown: true, flags: resolved.flags,
    }), {
      reference: 'supplied-instant',
      localResolution: { date, time: '00:00', timeZone, offsetMinutes, gapShiftMinutes,
        policy: { fold: 'earlier', gap: 'shift-forward' } },
    });
    expect(parseNatalEnvelope(serializeNatalEnvelope(envelope))).toEqual({ ok: true, envelope });
    expect(envelope.receipt.localResolution?.gapShiftMinutes).toBe(gapShiftMinutes);
    expect(envelope.receipt.inputFlags).toEqual(flags);
  });

  it.each(adjacentCases)('keeps %s %s in %s precise without false folds', async (date, time, zone, instant, flags) => {
    const resolved = resolveLocalToUtc(date, time, zone);
    expect(reading(resolved)).toEqual(await packageReading(date, time, zone));
    expect(resolved.utc.toISOString()).toBe(instant);
    expect(resolved.utc.getUTCMilliseconds()).toBe(0);
    expect(resolved.flags).toEqual(flags);
  });

  it.each(withLongitude)('agrees with the package on %s %s in %s given the birthplace longitude, flags included', async (date, time, zone, longitude, flags) => {
    await prepareLocalTime(date, zone);
    await preparePackageLocalTime(date, zone);
    const resolved = resolveLocalToUtc(date, time, zone, { longitude });
    const { utc, offsetMinutes, flags: packageFlags } = packageResolveLocalToUtc(date, time, zone, { longitude });
    expect({ utc: resolved.utc, offsetMinutes: resolved.offsetMinutes, flags: resolved.flags })
      .toEqual({ utc, offsetMinutes, flags: packageFlags });
    expect(resolved.flags.filter((flag) => flag === 'lmt')).toEqual(flags);
  });

  it('preserves the existing unknown-time local-noon reference immediately after the gap', () => {
    const resolved = resolveLocalToUtc('1914-01-01', '12:00', 'America/Manaus');
    expect(resolved.utc.toISOString()).toBe('1914-01-01T16:00:00.000Z');
    expect(resolved.flags).toEqual([]);
    const envelope = createNatalEnvelope(natalChart({ utc: resolved.utc, latitude: -3.1,
      longitude: -60.02, houseSystem: 'placidus', timeKnown: false, flags: resolved.flags }), {
      reference: 'local-noon',
      localResolution: { date: '1914-01-01', time: '12:00', timeZone: 'America/Manaus',
        offsetMinutes: -240, gapShiftMinutes: 0, policy: { fold: 'earlier', gap: 'shift-forward' } },
    });
    expect(parseNatalEnvelope(serializeNatalEnvelope(envelope))).toEqual({ ok: true, envelope });
    expect(envelope.receipt.reference).toBe('local-noon');
    expect(envelope.receipt.houses.actual).toBeNull();
    expect(envelope.result.angles).toBeNull();
  });
});
