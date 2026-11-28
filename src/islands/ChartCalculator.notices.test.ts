import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { parseNatalEnvelope } from '@zodiacs/engine/receipt';
import { oldStyleLine } from './BirthCalendar';
import { gregorianToJulian } from '../lib/time/calendar';
import { CATALOG_LOCALES } from '../lib/i18n';
import {
  engine2Notice,
  resolveEngine2Notices,
  type Engine2NoticeKey,
} from '../lib/chart-notices';
import { stashChartHandoff, takeChartHandoff } from '../lib/chart-handoff';
import { computeCalculatorReceipt } from '../lib/engine/calculator-receipt';
import { ENGINE_VERSION } from '../lib/engine/types';
import * as engine from '../lib/engine/full';
import { profileChartRunInput } from '../lib/profile/profile-chart-handoff';
import { resolveSavedChart } from '../lib/profile/resolve';
import { savedChartFromRemote } from '../lib/account-v2/remote-chart';
import { calculateEntry, type ChartEntry } from '../lib/sharing/chart-entry';
import { prepareLocalTime, resolveLocalToUtc } from '../lib/time/localToUtc';
import {
  hasConfirmedBirthTime,
  hasVerifiedSavedCalendarFlags,
  preserveSavedCalendarUnknown,
} from '../lib/time/saved-calendar';
import { islandFunction } from '../../tests/webmcp/island-code';

describe('engine 2.0.0 calculator warning notices', () => {
  it.each(CATALOG_LOCALES)('provides plain, dash-free copy for all notices in %s', (locale) => {
    for (const flag of [
      'polar-angles',
      'calendar-unknown',
      'calendar-unknown-julian',
      'calendar-unknown-saved',
      'host-zone-data-differs',
      'host-zone-data-differs-saved',
    ] as const satisfies readonly Engine2NoticeKey[]) {
      const value = engine2Notice(locale, flag);
      expect(value.trim().length, `${locale}.${flag}`).toBeGreaterThan(20);
      expect(value, `${locale}.${flag}`).not.toMatch(/[\u2013\u2014]/u);
    }
  });

  it('resolves all three engine 2.0.0 notices synchronously and distinguishes Old Style, reopened saved charts, and saved summaries', () => {
    const fresh = resolveEngine2Notices('en', ['polar-angles', 'calendar-unknown', 'host-zone-data-differs']);
    expect(fresh.map((n) => n.key)).toEqual(['polar-angles', 'calendar-unknown', 'host-zone-data-differs']);

    const julian = resolveEngine2Notices('en', ['calendar-unknown'], { convertedFromJulian: true });
    expect(julian.map((n) => n.key)).toEqual(['calendar-unknown-julian']);
    expect(julian[0]!.text).toContain('Old Style (Julian)');

    const saved = resolveEngine2Notices('en', ['polar-angles', 'calendar-unknown', 'host-zone-data-differs'], {
      fromSavedChart: true,
      fromSavedSummary: true,
    });
    expect(saved.map((n) => n.key)).toEqual(['polar-angles', 'calendar-unknown-saved', 'host-zone-data-differs-saved']);
  });

  it('evaluates calendar-unknown against the entered Old Style date rather than the converted Gregorian date', async () => {
    const moscow = { name: 'Moscow', admin1: 'Moscow', country: 'Russia', lat: 55.75, lon: 37.62, tz: 'Europe/Moscow', pop: 10381222 };
    await prepareLocalTime('1918-02-16', moscow.tz);
    await prepareLocalTime('1918-02-07', moscow.tz);
    await prepareLocalTime('1900-03-13', moscow.tz);

    // Julian 1918-02-03 converts to Gregorian 1918-02-16; the engine flags the entered Julian date, not the Gregorian date.
    const oldStyleAmbiguous = resolveLocalToUtc('1918-02-16', '12:00', moscow.tz, {
      longitude: moscow.lon,
      writtenJulianDate: '1918-02-03',
    });
    const gregorianSameInstant = resolveLocalToUtc('1918-02-16', '12:00', moscow.tz, { longitude: moscow.lon });
    expect(oldStyleAmbiguous.utc.toISOString()).toBe(gregorianSameInstant.utc.toISOString());
    expect(oldStyleAmbiguous.flags).toContain('calendar-unknown');
    expect(gregorianSameInstant.flags).not.toContain('calendar-unknown');

    // Conversely, Julian 1918-01-25 (before the Moscow changeover) converts to Gregorian 1918-02-07;
    // evaluating against the entered Julian date avoids a spurious warning.
    const oldStyleBeforeChange = resolveLocalToUtc('1918-02-07', '12:00', moscow.tz, {
      longitude: moscow.lon,
      writtenJulianDate: '1918-01-25',
    });
    const gregorianInGap = resolveLocalToUtc('1918-02-07', '12:00', moscow.tz, { longitude: moscow.lon });
    expect(oldStyleBeforeChange.utc.toISOString()).toBe(gregorianInGap.utc.toISOString());
    expect(oldStyleBeforeChange.flags).not.toContain('calendar-unknown');
    expect(gregorianInGap.flags).toContain('calendar-unknown');

    // A Julian-only leap day (1900-02-29 -> Gregorian 1900-03-13) resolves cleanly, and a mismatch is rejected.
    const julianLeap = resolveLocalToUtc('1900-03-13', '12:00', moscow.tz, {
      longitude: moscow.lon,
      writtenJulianDate: '1900-02-29',
    });
    expect(julianLeap.utc.toISOString()).toBe(resolveLocalToUtc('1900-03-13', '12:00', moscow.tz, { longitude: moscow.lon }).utc.toISOString());
    expect(() => resolveLocalToUtc('1918-02-17', '12:00', moscow.tz, {
      longitude: moscow.lon,
      writtenJulianDate: '1918-02-03',
    })).toThrow(RangeError);

    // The shared entry / PDF calculation path forwards writtenJulianDate cleanly, matching the engine's own rule.
    const pdfEntryAmbiguous: ChartEntry = { id: 1, name: '', date: '1918-02-03', time: '12:00', timeKnown: true, city: moscow, calendar: 'julian' };
    const pdfEntryClear: ChartEntry = { id: 2, name: '', date: '1918-01-25', time: '12:00', timeKnown: true, city: moscow, calendar: 'julian' };
    const ambiguousResult = await calculateEntry(pdfEntryAmbiguous, engine, 'en');
    const clearResult = await calculateEntry(pdfEntryClear, engine, 'en');
    expect(ambiguousResult.date).toBe('1918-02-16');
    expect(ambiguousResult.chart.flags).toContain('calendar-unknown');
    expect(clearResult.date).toBe('1918-02-07');
    expect(clearResult.chart.flags).not.toContain('calendar-unknown');

    // Exported calculation receipts carry the Julian calendar and written date so the flag is reproducible.
    const captured = computeCalculatorReceipt(
      {
        utc: oldStyleAmbiguous.utc,
        latitude: moscow.lat,
        longitude: moscow.lon,
        houseSystem: 'placidus',
        timeKnown: true,
        flags: oldStyleAmbiguous.flags,
      },
      {
        date: '1918-02-16',
        time: '12:00',
        timeZone: moscow.tz,
        offsetMinutes: oldStyleAmbiguous.offsetMinutes,
        reference: 'supplied-instant',
        calendar: 'julian',
        writtenDate: '1918-02-03',
      },
    );
    expect(captured).not.toBeNull();
    const parsed = parseNatalEnvelope(captured!.envelopeJson);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) throw new Error('Expected valid Julian calculation receipt');
    expect(parsed.envelope.receipt.inputFlags).toContain('calendar-unknown');
    expect(parsed.envelope.receipt.localResolution).toMatchObject({
      date: '1918-02-16',
      calendar: 'julian',
      writtenDate: '1918-02-03',
    });

    // Reopened changeover-era charts without stored original calendar provenance keep the resolved
    // Gregorian wall time in localResolution while leaving calendar/writtenDate unset (both timed and local-noon).
    const reopenedReceipt = computeCalculatorReceipt(
      {
        utc: oldStyleAmbiguous.utc,
        latitude: moscow.lat,
        longitude: moscow.lon,
        houseSystem: 'placidus',
        timeKnown: true,
        flags: oldStyleAmbiguous.flags,
      },
      {
        date: '1918-02-16',
        time: '12:00',
        timeZone: moscow.tz,
        offsetMinutes: oldStyleAmbiguous.offsetMinutes,
        reference: 'supplied-instant',
      },
    );
    expect(reopenedReceipt).not.toBeNull();
    const parsedReopened = parseNatalEnvelope(reopenedReceipt!.envelopeJson);
    expect(parsedReopened.ok).toBe(true);
    if (!parsedReopened.ok) throw new Error('Expected valid reopened chart receipt');
    expect(parsedReopened.envelope.receipt.inputFlags).toContain('calendar-unknown');
    expect(parsedReopened.envelope.receipt.localResolution).toMatchObject({ date: '1918-02-16', timeZone: moscow.tz });
    expect(parsedReopened.envelope.receipt.localResolution?.calendar).toBeUndefined();
    expect(parsedReopened.envelope.receipt.localResolution?.writtenDate).toBeUndefined();

    const reopenedUntimedReceipt = computeCalculatorReceipt(
      {
        utc: oldStyleAmbiguous.utc,
        latitude: moscow.lat,
        longitude: moscow.lon,
        houseSystem: 'placidus',
        timeKnown: false,
        flags: oldStyleAmbiguous.flags,
      },
      {
        date: '1918-02-16',
        time: '12:00',
        timeZone: moscow.tz,
        offsetMinutes: oldStyleAmbiguous.offsetMinutes,
        reference: 'local-noon',
      },
    );
    expect(reopenedUntimedReceipt).not.toBeNull();
    const parsedReopenedUntimed = parseNatalEnvelope(reopenedUntimedReceipt!.envelopeJson);
    expect(parsedReopenedUntimed.ok).toBe(true);
    if (!parsedReopenedUntimed.ok) throw new Error('Expected valid untimed reopened chart receipt');
    expect(parsedReopenedUntimed.envelope.receipt.inputFlags).toContain('calendar-unknown');
    expect(parsedReopenedUntimed.envelope.receipt.localResolution).toMatchObject({ date: '1918-02-16', timeZone: moscow.tz });
    expect(parsedReopenedUntimed.envelope.receipt.localResolution?.calendar).toBeUndefined();
    expect(parsedReopenedUntimed.envelope.receipt.localResolution?.writtenDate).toBeUndefined();

    // Reopening saved charts in TransitTracker and ChartCalculator preserves saved 2.0.0+ calendar-unknown provenance.
    const wheelFromChart = islandFunction('TransitTracker.tsx', { function: 'wheelFromChart' });
    const natalFromSaved = islandFunction('TransitTracker.tsx', { function: 'natalFromSaved' });
    const env = {
      hasConfirmedBirthTime,
      hasVerifiedSavedCalendarFlags,
      preserveSavedCalendarUnknown,
      resolveLocalToUtc,
      wheelFromChart: (...args: unknown[]) => wheelFromChart({ hasConfirmedBirthTime }, ...args),
      calendarPositionsFromSaved: () => ({}),
    };
    const savedFromJulianAmbiguous = {
      id: 'saved-jul-ambiguous',
      name: 'Moscow Julian 1918-02-03',
      relationship: 'self' as const,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      birth: { date: '1918-02-16', time: '12:00', timeKnown: true, place: moscow },
      summary: {
        engineVersion: ENGINE_VERSION,
        utcISO: oldStyleAmbiguous.utc.toISOString(),
        houseSystem: 'whole' as const,
        bodies: [],
        angles: null,
        flags: ['calendar-unknown' as const],
        calendarChecked: true as const,
      },
    };
    const savedFromJulianClear = {
      ...savedFromJulianAmbiguous,
      id: 'saved-jul-clear',
      birth: { date: '1918-02-07', time: '12:00', timeKnown: true, place: moscow },
      summary: {
        ...savedFromJulianAmbiguous.summary,
        utcISO: oldStyleBeforeChange.utc.toISOString(),
        flags: [],
        calendarChecked: true as const,
      },
    };
    const legacySaved = {
      ...savedFromJulianClear,
      id: 'saved-legacy',
      summary: {
        engineVersion: '1.1.0',
        utcISO: oldStyleBeforeChange.utc.toISOString(),
        houseSystem: 'whole' as const,
        bodies: [],
        angles: null,
        flags: [],
      },
    };

    const reopenedAmbiguous = natalFromSaved(env, savedFromJulianAmbiguous, engine) as { flags: readonly string[] };
    const reopenedClear = natalFromSaved(env, savedFromJulianClear, engine) as { flags: readonly string[] };
    const reopenedLegacy = natalFromSaved(env, legacySaved, engine) as { flags: readonly string[] };
    expect(reopenedAmbiguous.flags).toContain('calendar-unknown');
    expect(reopenedClear.flags).not.toContain('calendar-unknown');
    expect(reopenedLegacy.flags).toContain('calendar-unknown');

    expect(profileChartRunInput([savedFromJulianAmbiguous], savedFromJulianAmbiguous.id)).toMatchObject({
      fromSavedChart: true,
      savedCalendarUnknown: true,
    });
    expect(profileChartRunInput([savedFromJulianClear], savedFromJulianClear.id)).toMatchObject({
      fromSavedChart: true,
      savedCalendarUnknown: false,
    });
    expect(profileChartRunInput([legacySaved], legacySaved.id)?.savedCalendarUnknown).toBeUndefined();

    // A stale or imported calendar-unknown flag on a modern date is ignored so it never breaks calculation or receipts.
    const staleModernSaved = {
      ...savedFromJulianAmbiguous,
      id: 'saved-modern-stale',
      birth: { date: '1990-05-01', time: '12:00', timeKnown: true, place: moscow },
      summary: {
        ...savedFromJulianAmbiguous.summary,
        utcISO: '1990-05-01T08:00:00.000Z',
        flags: ['calendar-unknown' as const],
      },
    };
    expect(profileChartRunInput([staleModernSaved], staleModernSaved.id)?.savedCalendarUnknown).toBe(false);
    await prepareLocalTime('1990-05-01', moscow.tz);
    const reopenedModern = natalFromSaved(env, staleModernSaved, engine) as { flags: readonly string[] };
    expect(reopenedModern.flags).not.toContain('calendar-unknown');

    // Refreshing an older 2.x summary in Profile also preserves saved calendar-unknown provenance.
    const older2xAmbiguous = {
      ...savedFromJulianAmbiguous,
      summary: { ...savedFromJulianAmbiguous.summary, engineVersion: '2.0.0' },
    };
    const refreshedAmbiguous = await resolveSavedChart(older2xAmbiguous, async () => engine, { strict: true });
    expect(refreshedAmbiguous.summary.flags).toContain('calendar-unknown');
    const older2xClear = {
      ...savedFromJulianClear,
      summary: { ...savedFromJulianClear.summary, engineVersion: '2.0.0' },
    };
    const refreshedClear = await resolveSavedChart(older2xClear, async () => engine, { strict: true });
    expect(refreshedClear.summary.flags).not.toContain('calendar-unknown');

    // The private session handoff carries only a 1-bit oldStyle flag (no extra birth date or prose in sessionStorage),
    // and the destination derives the Julian date and localized label from the existing Gregorian date.
    const items = new Map<string, string>();
    vi.stubGlobal('sessionStorage', {
      get length() { return items.size; },
      key: (i: number) => [...items.keys()][i] ?? null,
      getItem: (k: string) => items.get(k) ?? null,
      setItem: (k: string, v: string) => { items.set(k, v); },
      removeItem: (k: string) => { items.delete(k); },
    });
    try {
      const fragment = stashChartHandoff(
        { date: '1918-02-16', time: '12:00', timeKnown: true, lat: moscow.lat, lon: moscow.lon, tz: moscow.tz, place: 'Moscow', houseSystem: 'whole' },
        { subjectMode: 'other', oldStyle: true },
      )!;
      expect([...new URLSearchParams(fragment).keys()].sort()).toEqual(['h', 'subject']);
      expect(fragment).not.toContain('1918');
      const storedRaw = [...items.values()][0]!;
      expect(storedRaw).not.toContain('1918-02-03');
      expect(storedRaw).not.toContain('Old Style');
      expect(storedRaw).not.toContain('Russia');
      expect(JSON.parse(storedRaw).j).toBe(true);
      expect(JSON.parse(storedRaw).u).toBeUndefined();
      const taken = takeChartHandoff(`#${fragment}`);
      expect(taken).toMatchObject({ kind: 'chart', oldStyle: true });
      // Modern handoffs never write the historical calendar bit into sessionStorage.
      const modernFragment = stashChartHandoff(
        { date: '1990-05-01', time: '12:00', timeKnown: true, lat: moscow.lat, lon: moscow.lon, tz: moscow.tz, place: 'Moscow', houseSystem: 'whole' },
        { fromSavedChart: true, savedCalendarUnknown: false },
      )!;
      const modernRaw = [...items.values()][0]!;
      expect(JSON.parse(modernRaw).u).toBeUndefined();
      expect(takeChartHandoff(`#${modernFragment}`)?.kind).toBe('chart');
      const derivedJulian = gregorianToJulian('1918-02-16');
      expect(derivedJulian).toBe('1918-02-03');
      expect(oldStyleLine('en', derivedJulian!, '1918-02-16')).toContain('Old Style');
      expect(oldStyleLine('fr', derivedJulian!, '1918-02-16')).toContain('ancien style');

      // Time-only edits on reopened saved charts preserve saved calendar provenance via compact booleans only.
      const savedFragment = stashChartHandoff(
        { date: '1918-02-16', time: '12:30', timeKnown: true, lat: moscow.lat, lon: moscow.lon, tz: moscow.tz, place: 'Moscow', houseSystem: 'whole' },
        { profileOrigin: true, fromSavedChart: true, savedCalendarUnknown: true, calendarUnverified: true },
      )!;
      expect(savedFragment).not.toContain('1918');
      const savedTaken = takeChartHandoff(`#${savedFragment}`);
      expect(savedTaken).toMatchObject({ kind: 'chart', profileOrigin: true, fromSavedChart: true, savedCalendarUnknown: true, calendarUnverified: true });
    } finally {
      vi.unstubAllGlobals();
    }

    // Cloud-restored charts whose original calendar choice was not synced conservatively flag ambiguous changeover dates.
    const moscowSavedPlace = { name: moscow.name, admin1: moscow.admin1, country: moscow.country, lat: moscow.lat, lon: moscow.lon, tz: moscow.tz };
    const remoteDerived = {
      positions: { b: Array.from({ length: 12 }, (_, i) => i * 20), a: [42, 140], h: 'w', v: ENGINE_VERSION },
      time_known: true,
      sun_sign: 'aries',
      engine_version: ENGINE_VERSION,
      house_system: 'whole',
    };
    const remoteAmbiguous = await savedChartFromRemote({
      outcome: 'ready',
      chart_id: '11111111-1111-4111-8111-111111111111',
      label: 'Moscow 1918',
      subject_kind: 'self',
      subject_attestation: 'self_declared_v1',
      revision: 1,
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z',
      birth: { date: '1918-02-16', time: '12:00', timeKnown: true, place: moscowSavedPlace },
      derived: remoteDerived,
    });
    expect(remoteAmbiguous?.chart.summary.flags).toContain('calendar-unknown');
    expect(remoteAmbiguous?.chart.summary.calendarChecked).toBeUndefined();
    const remoteClear = await savedChartFromRemote({
      outcome: 'ready',
      chart_id: '22222222-2222-4222-8222-222222222222',
      label: 'Moscow 1990',
      subject_kind: 'self',
      subject_attestation: 'self_declared_v1',
      revision: 1,
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z',
      birth: { date: '1990-05-01', time: '12:00', timeKnown: true, place: moscowSavedPlace },
      derived: remoteDerived,
    });
    expect(remoteClear?.chart.summary.flags).not.toContain('calendar-unknown');

    // Pre-patch saves from the current engine and remote fallback summaries (without calendarChecked) leave calendar provenance unknown so later opens reconstruct it.
    const prePatchOldStyle = {
      ...savedFromJulianAmbiguous,
      id: 'saved-prepatch-210',
      summary: {
        engineVersion: ENGINE_VERSION,
        utcISO: oldStyleAmbiguous.utc.toISOString(),
        houseSystem: 'whole' as const,
        bodies: [],
        angles: null,
        flags: ['polar-fallback' as const],
      },
    };
    expect(profileChartRunInput([prePatchOldStyle], prePatchOldStyle.id)?.savedCalendarUnknown).toBeUndefined();
    const reopenedPrePatch = natalFromSaved(env, prePatchOldStyle, engine) as { flags: readonly string[] };
    expect(reopenedPrePatch.flags).toContain('calendar-unknown');
    const refreshedSameEngine = await resolveSavedChart(prePatchOldStyle, async () => {
      throw new Error('calendar-only refresh should not need engine');
    }, { strict: true });
    expect(refreshedSameEngine.summary.flags).toEqual(['polar-fallback', 'calendar-unknown']);
    expect(refreshedSameEngine.summary.calendarChecked).toBeUndefined();
    const prePatchOlderEngine = { ...prePatchOldStyle, summary: { ...prePatchOldStyle.summary, engineVersion: '2.0.0' } };
    const refreshedPrePatch = await resolveSavedChart(prePatchOlderEngine, async () => engine, { strict: true });
    expect(refreshedPrePatch.summary.flags).toContain('calendar-unknown');
    expect(refreshedPrePatch.summary.calendarChecked).toBeUndefined();
  });

  it('honors host-zone-data-differs and carries notice flags in TransitTracker for recomputed and placeless saved charts', () => {
    const wheelFromChart = islandFunction('TransitTracker.tsx', { function: 'wheelFromChart' });
    const calendarPositionsFromSaved = islandFunction('TransitTracker.tsx', { function: 'calendarPositionsFromSaved' });
    const natalFromSaved = islandFunction('TransitTracker.tsx', { function: 'natalFromSaved' });
    const chart = engine.computeChart({
      utc: new Date('1979-05-26T08:30:00.000Z'),
      latitude: 35.6944,
      longitude: 51.4215,
      houseSystem: 'whole',
      timeKnown: true,
      flags: ['host-zone-data-differs'],
    });
    const wheel = wheelFromChart({ hasConfirmedBirthTime }, chart, true, chart.input.utc) as {
      asc: number | null;
      mc: number | null;
      cusps: number[] | null;
      minimal: Array<{ body: string }>;
      timeKnown: boolean;
      hostZoneDiffers: boolean;
      flags: readonly string[];
      fromSavedSummary?: boolean;
      itineraryTimeKnown: boolean;
      calendarPositions: { bodies: Array<{ body: string }>; angles: unknown } | null;
    };
    expect(wheel.timeKnown).toBe(true);
    expect(wheel.hostZoneDiffers).toBe(true);
    expect(wheel.flags).toContain('host-zone-data-differs');
    expect(wheel.asc).toBeNull();
    expect(wheel.mc).toBeNull();
    expect(wheel.cusps).toBeNull();
    expect(wheel.itineraryTimeKnown).toBe(false);
    expect(wheel.calendarPositions).not.toBeNull();
    expect(wheel.calendarPositions?.angles).toBeNull();
    expect(wheel.calendarPositions?.bodies.some((b) => b.body === 'Moon')).toBe(false);
    expect(wheel.minimal.some((b) => b.body === 'Moon')).toBe(false);

    const untimedWheel = wheelFromChart({ hasConfirmedBirthTime }, chart, false, chart.input.utc) as typeof wheel;
    expect(untimedWheel.calendarPositions).toBeNull();

    // Polar and calendar flags are carried independently of host-zone-data-differs.
    const polarCalendarChart = engine.computeChart({
      utc: new Date('1918-02-03T11:00:00.000Z'),
      latitude: 69.6492,
      longitude: 18.9553,
      houseSystem: 'whole',
      timeKnown: true,
      flags: ['calendar-unknown'],
    });
    const polarCalendarWheel = wheelFromChart(
      { hasConfirmedBirthTime }, polarCalendarChart, true, polarCalendarChart.input.utc,
    ) as typeof wheel;
    expect(polarCalendarWheel.hostZoneDiffers).toBe(false);
    expect(polarCalendarWheel.flags).toContain('polar-angles');
    expect(polarCalendarWheel.flags).toContain('calendar-unknown');

    const saved = {
      id: 'saved-1',
      name: 'Backup without place',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      birth: { date: '1979-05-26', time: '12:00', timeKnown: true, place: null },
      summary: {
        engineVersion: chart.engineVersion,
        utcISO: chart.input.utc.toISOString(),
        houseSystem: 'whole' as const,
        bodies: chart.bodies.map(({ body, lon, retrograde }) => ({ body, lon, retrograde })),
        angles: chart.angles ? { asc: chart.angles.asc, mc: chart.angles.mc } : null,
        flags: ['polar-angles', 'calendar-unknown', 'host-zone-data-differs'],
      },
    };
    const savedEnv = {
      hasConfirmedBirthTime,
      preserveSavedCalendarUnknown,
      calendarPositionsFromSaved: (...args: unknown[]) => calendarPositionsFromSaved({}, ...args),
    };
    const savedWheel = natalFromSaved(savedEnv, saved, engine) as typeof wheel;
    expect(savedWheel.timeKnown).toBe(true);
    expect(savedWheel.hostZoneDiffers).toBe(true);
    expect(savedWheel.fromSavedSummary).toBe(true);
    // Out-of-range calendar-unknown on 1979-05-26 is stripped while valid flags stay.
    expect(savedWheel.flags).toEqual(['polar-angles', 'host-zone-data-differs']);
    const savedHistoric = { ...saved, birth: { ...saved.birth, date: '1918-02-03' } };
    const savedHistoricWheel = natalFromSaved(savedEnv, savedHistoric, engine) as typeof wheel;
    expect(savedHistoricWheel.flags).toEqual(['polar-angles', 'calendar-unknown', 'host-zone-data-differs']);
    expect(savedWheel.asc).toBeNull();
    expect(savedWheel.mc).toBeNull();
    expect(savedWheel.calendarPositions).not.toBeNull();
    expect(savedWheel.calendarPositions?.angles).toBeNull();
    expect(savedWheel.calendarPositions?.bodies.some((b) => b.body === 'Moon')).toBe(false);
    expect(savedWheel.minimal.some((b) => b.body === 'Moon')).toBe(false);
  });

  it('wires all three 2.0.0 notices synchronously in ChartCalculator, PDF, TransitTracker, and transit export copy without static transit copy', () => {
    const calc = readFileSync(new URL('./ChartCalculator.tsx', import.meta.url), 'utf8');
    expect(calc).not.toMatch(/^import\s+(?!type\b).*from\s+['"]\.\.\/lib\/chart-notices['"]/m);
    expect(calc).toContain('const noticesReady = loadNotices();');
    expect(calc).toContain('const noticesModule = await noticesReady;');
    expect(calc).not.toContain('hasEngine2Flag');
    expect(calc).toContain("source === 'shared_details' ? { fromSavedChart: true as const } : undefined");
    expect(calc).toContain('city.tz.toLowerCase() === savedCalendarContext.tz.toLowerCase()');
    expect(calc).not.toContain('city.country === savedCalendarContext.country');

    const bigThree = readFileSync(new URL('./BigThreeQuick.tsx', import.meta.url), 'utf8');
    expect(bigThree).not.toMatch(/^import\s+(?!type\b).*from\s+['"]\.\.\/lib\/chart-notices['"]/m);
    expect(bigThree).not.toContain('hasEngine2Flag');
    expect(bigThree).toContain('loadNotices(),');
    expect(bigThree).toContain("savedCalendarRef.current = { date: record!.birth.date, tz: '' };");
    expect(bigThree).toContain('city.tz.toLowerCase() === savedCal!.tz.toLowerCase()');
    expect(bigThree).toContain('data-big-three-notice={notice.key}');

    const someoneElse = readFileSync(new URL('./SomeoneElseChart.tsx', import.meta.url), 'utf8');
    expect(someoneElse).toContain('if (input) openChart(input, { fromSavedChart: true });');
    expect(someoneElse).not.toContain('[consent, date, calendar, time, timeKnown, city, houseSystem, name, mode]');

    const personalCal = readFileSync(new URL('./PersonalCalendar.tsx', import.meta.url), 'utf8');
    expect(personalCal).not.toMatch(/^import\s+(?!type\b).*from\s+['"]\.\.\/lib\/chart-notices['"]/m);
    expect(personalCal).not.toContain('noticeFlags.length ? loadNotices()');
    expect(personalCal).toContain('data-personal-calendar-notice');
    expect(personalCal).toContain('notes: notices.map((notice) => notice.text)');

    const pdf = readFileSync(new URL('../lib/return-visits/chart-pdf.tsx', import.meta.url), 'utf8');
    expect(pdf).toContain('resolveEngine2Notices');
    expect(pdf).toContain('oldStyleDateLabel');

    const transits = readFileSync(new URL('./TransitTracker.tsx', import.meta.url), 'utf8');
    expect(transits).not.toMatch(/^import\s+(?!type\b).*from\s+['"]\.\.\/lib\/chart-notices['"]/m);
    expect(transits).toContain('mod.resolveEngine2Notices');
    expect(transits).toContain('hasConfirmedBirthTime(timeKnown, r.flags)');
    expect(transits).toContain('data-polar-angles-notice');
    expect(transits).toContain("key.startsWith('calendar-unknown')");
    expect(transits).toContain('data-host-zone-differs-notice');
    expect(transits).toContain('hostZoneDiffers={result.natal.hostZoneDiffers}');
    expect(transits).toContain('hostZoneDiffers={result?.natal.hostZoneDiffers ?? false}');
    expect(transits.match(/calendarNotes=\{calendarNotes\}/gu)).toHaveLength(3);

    const ring = readFileSync(new URL('./transit/TransitRing.tsx', import.meta.url), 'utf8');
    expect(ring).toContain('hostZoneDiffers={natal.hostZoneDiffers}');
    expect(ring).toContain('notes={calendarNotes}');

    const calendarSub = readFileSync(new URL('./CalendarSubscribe.tsx', import.meta.url), 'utf8');
    expect(calendarSub).toContain('downloadNoteHostZoneDiffers');
    expect(calendarSub).toContain('downloadNoteCalendarUnknown');
    expect(calendarSub).toContain('Contacts to your natal Moon, Ascendant, and Midheaven are omitted');
    expect(calendarSub).toContain('...(hostZoneDiffers ? { hostZoneDiffers: true } : {})');
    expect(calendarSub).toContain('...(notes?.length ? { notes } : {})');

    const search = readFileSync(new URL('./transit/TransitSearch.tsx', import.meta.url), 'utf8');
    expect(search).toContain('calendarNoteHostZoneDiffers');
    expect(search).toContain('calendarNoteCalendarUnknown');
    expect(search).toContain('Contacts to your natal Moon, Ascendant, and Midheaven are omitted');
    expect(search).toContain('...(hostZoneDiffers ? { hostZoneDiffers: true } : {})');
    expect(search).toContain('...(calendarNotes?.length ? { notes: calendarNotes } : {})');

    const itinerary = readFileSync(new URL('./transit/TransitItinerary.tsx', import.meta.url), 'utf8');
    expect(itinerary).toContain('CALENDAR_NOTE_HOST_ZONE_DIFFERS');
    expect(itinerary).toContain('CALENDAR_NOTE_CALENDAR_UNKNOWN');
    expect(itinerary).toContain('Contacts to your natal Moon, Ascendant, and Midheaven are omitted');
    expect(itinerary).toContain('...(calendarNotes?.length ? { notes: calendarNotes } : {})');

    expect(calc).toContain('inputRevisionRef.current += 1;\n    runChartIdRef.current += 1;');
  });
});
