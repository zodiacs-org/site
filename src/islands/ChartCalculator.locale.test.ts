import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import type { SavedChart } from '../lib/profile/schema';
import { profileChartRunInput } from '../lib/profile/profile-chart-handoff';

const SAVED_CHART: SavedChart = {
  id: '11111111-1111-4111-8111-111111111111',
  name: 'Private A',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  birth: {
    date: '1990-06-15',
    time: '14:30',
    timeKnown: true,
    place: {
      name: 'New York', admin1: 'NY', country: 'US',
      lat: 40.7128, lon: -74.006, tz: 'America/New_York',
    },
  },
  summary: {
    engineVersion: '0.1.0', utcISO: '1990-06-15T18:30:00.000Z', houseSystem: 'whole',
    bodies: [], angles: null, flags: [],
  },
};

describe('Russian chart-result seams', () => {
  it('localizes an unlabeled shared birthplace', async () => {
    const source = await readFile(new URL('./ChartCalculator.tsx', import.meta.url), 'utf8');
    const runtime = await readFile(new URL('../lib/i18n/ru-runtime/server.ts', import.meta.url), 'utf8');
    expect(source).toContain("russianCopy?.chart.sharedBirthplace ?? 'Shared birthplace'");
    expect(runtime).toContain("sharedBirthplace: 'Общее место рождения'");
  });

  it('marks deferred action-dock destinations before navigation', async () => {
    const source = await readFile(new URL('./ChartCalculator.tsx', import.meta.url), 'utf8');
    const runtime = await readFile(new URL('../lib/i18n/ru-runtime/server.ts', import.meta.url), 'utf8');
    expect(source).toContain('russianCopy?.chart.wheelActions ?? {');
    expect(source).not.toContain('WHEEL_ACTION_COPY');
    expect(runtime).toContain("another: 'Прочитать другую карту — пока по-английски'");
    expect(runtime).toContain("compareMine: 'Сравнить с моей — пока по-английски'");
    expect(runtime).toContain("compareAdd: 'Добавить мою карту для сравнения — пока по-английски'");
  });

  it('scrubs only profile-origin handoffs and fences delayed chart computation', async () => {
    const source = await readFile(new URL('./ChartCalculator.tsx', import.meta.url), 'utf8');
    const revocation = source.slice(
      source.indexOf('const profileAccessGeneration = useProfileAccessGeneration'),
      source.indexOf('// ── Chart Explorer state'),
    );
    expect(revocation).toContain('if (mineProfileOriginRef.current)');
    expect(revocation).toContain('setMineHandoff(null);');
    expect(revocation).toContain('if (!primaryProfileOriginRef.current) return;');
    for (const scrub of [
      "setDate('');",
      "setTime('');",
      'setCity(null);',
    ]) expect(revocation, scrub).toContain(scrub);
    expect(revocation).toContain('clearResult();');
    const clearResult = source.slice(
      source.indexOf('function clearResult(): void {'),
      source.indexOf('const registryBridgeImpressionChartRef'),
    );
    for (const scrub of [
      'resultOwnerRef.current = null;',
      'clearReceiptExport();',
      'setChart(null);',
      'setOnMeanTime(false);',
      'setComputedInput(null);',
      'setShareInput(null);',
      'setShareDialogOpen(false);',
      'clearPostChartContext();',
    ]) expect(clearResult, scrub).toContain(scrub);

    const run = source.slice(
      source.indexOf('async function runChart('),
      source.indexOf('function compute('),
    );
    expect(run).toContain('const accessGeneration = profileAccessGeneration.current;');
    expect(run).toContain('const requiresProfileAccess = primaryProfileOriginRef.current;');
    expect(run).toContain('runId === runChartIdRef.current');
    expect(run).toContain('accessGeneration === profileAccessGeneration.current');
    expect(run).toContain('const engine = await loadEngine();\n      if (!runIsCurrent()) return;');
    // The birthplace's own mean time shows the notice whatever the flags say.
    expect(run).toContain('setChart(result);\n      setOnMeanTime(resolved.localMeanTime !== undefined);');
    expect(source).toContain("{(chart.flags.includes('lmt') || onMeanTime) && (");
    expect(run).toContain('if (!runIsCurrent()) return;\n      runChartIdRef.current += 1;\n      clearResult();\n      setBusy(false);\n      setError');
    expect(run).toContain('if (runId === runChartIdRef.current) setBusy(false);');
    expect(source).toContain('primaryProfileOriginRef.current = true;');
    expect(source).toContain('primaryProfileOriginRef.current = false;');
    expect(source).toContain('primaryProfileOriginRef.current)');
  });

  it('defers an opaque saved-chart id until access, resolving only the admitted profile', async () => {
    expect(profileChartRunInput([], SAVED_CHART.id)).toBeNull();
    expect(profileChartRunInput([{
      ...SAVED_CHART,
      id: '22222222-2222-4222-8222-222222222222',
    }], SAVED_CHART.id))
      .toBeNull();
    expect(profileChartRunInput([SAVED_CHART], SAVED_CHART.id)).toMatchObject({
      date: '1990-06-15',
      name: 'Private A',
      subjectMode: 'other',
      city: { tz: 'America/New_York' },
    });
    expect(profileChartRunInput([{
      ...SAVED_CHART,
      relationship: 'self',
    }], SAVED_CHART.id)).toMatchObject({ subjectMode: 'self' });

    const source = await readFile(new URL('./ChartCalculator.tsx', import.meta.url), 'utf8');
    const profileManager = await readFile(new URL('./ProfileManager.tsx', import.meta.url), 'utf8');
    const branch = source.slice(
      source.indexOf("if (params.has('profileChartId'))"),
      source.indexOf("if (params.has('c') && params.has('p'))"),
    );
    expect(profileManager).toContain('profileChartHandoffFragment(chart.id)');
    expect(profileManager).not.toContain('encodeChartLink');
    expect(branch.indexOf('clearFragment();')).toBeLessThan(branch.indexOf('profileAccessAllowed()'));
    expect(branch).toContain("window.addEventListener('zodiacs:profile-access', onProfileAccess);");
    expect(branch).toContain('accessGeneration !== profileAccessGeneration.current');
    expect(branch).toContain('loadProfileChartEditInput(profileChartId)');
    expect(branch).toContain('setDate(input.date);');
    expect(branch).toContain('if (linkCity) void runChart({ ...input, city: linkCity }, false);');
    expect(branch).toContain('primaryProfileChartIdRef.current = profileChartId;');
    expect(branch).toContain('handoffId === profileHandoffIdRef.current');
  });

  it('lets manual work cancel a delayed private open without declassifying its source', async () => {
    const source = await readFile(new URL('./ChartCalculator.tsx', import.meta.url), 'utf8');
    const invalidation = source.slice(
      source.indexOf('function invalidateProfileHandoff()'),
      source.indexOf('// ── Chart Explorer state'),
    );
    expect(invalidation).toContain('profileHandoffIdRef.current += 1;');
    expect(invalidation).toContain('primaryProfileChartIdRef.current = null;');
    expect(invalidation).not.toContain('primaryProfileOriginRef.current = false;');
    expect(source).toContain('onDateChange={(value) => {');
    expect(source).toContain('onCityChange={(value) => {');
    expect(source).toMatch(/onDateChange=\{\(value\) => \{[\s\S]*?invalidateProfileHandoff\(\);[\s\S]*?setDate\(value\);/u);
    expect(source).toMatch(/onCityChange=\{\(value\) => \{[\s\S]*?invalidateProfileHandoff\(\);[\s\S]*?setCity\(value\);/u);

    const compute = source.slice(source.indexOf('function compute('), source.indexOf('const shareUrl'));
    expect(compute).toContain('invalidateProfileHandoff();');

    const another = source.slice(
      source.indexOf('const anotherChartHref'),
      source.indexOf('useEffect(() =>', source.indexOf('const anotherChartHref')),
    );
    expect(another).toContain('primaryProfileOriginRef.current');
    expect(another).toContain("'/birth-chart/someone-else/'");
    expect(another).toContain('someoneElseHandoffPath(shareInput)');
  });

  it('never persists exact chart identity in first-reading progress', async () => {
    const source = await readFile(new URL('./ChartCalculator.tsx', import.meta.url), 'utf8');
    expect(source).not.toContain('firstReadingChartKey');
    expect(source).not.toContain('firstReading.chartKey');
    expect(source).toContain('setFirstReading(readFirstReadingProgress(localStorage));');
  });

  it('keeps submission reachable and focuses the first incomplete field', async () => {
    const [source, placeSearch] = await Promise.all([
      readFile(new URL('./ChartCalculator.tsx', import.meta.url), 'utf8'),
      readFile(new URL('./PlaceSearch.tsx', import.meta.url), 'utf8'),
    ]);
    const compute = source.slice(source.indexOf('function compute('), source.indexOf('const shareUrl'));
    expect(source).toContain('disabled={busy}');
    expect(source).not.toContain('disabled={!canCompute || busy}');
    expect(source).toContain('aria-busy={busy} noValidate');
    expect(compute).toContain("date: date === '' ? 'required'");
    expect(compute).toContain("dateInput?.validity.valid === false ? 'range'");
    expect(compute).toContain("time: timeKnown && time === ''");
    expect(compute).toContain('place: city === null');
    expect(compute.indexOf("? 'birth-date'")).toBeLessThan(compute.indexOf("? 'birth-time'"));
    expect(compute.indexOf("? 'birth-time'")).toBeLessThan(compute.indexOf("? 'place'"));
    expect(compute).toContain('querySelector<HTMLElement>(`#${firstIncomplete}`)?.focus()');
    expect(placeSearch).toContain('!selected && query.trim() ? selectionHint');
    expect(placeSearch).toContain('aria-required={required || undefined}');
    expect(placeSearch).toContain("t(locale, 'placeNoResults')");
  });
});
