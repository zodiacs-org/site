import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

const calculatorUrl = new URL('./ChartCalculator.tsx', import.meta.url);

describe('ChartCalculator Registry bridge contract', () => {
  it('commits the singular record bridge only for a known-time calculation', async () => {
    const source = await readFile(calculatorUrl, 'utf8');

    expect(source).toContain('setRegistryRecordSlug(null);');
    expect(source).toContain("const nextRegistryRecordSlug = mode === 'full' && input.timeKnown ? computedSunSlug : null;");
    expect(source).not.toContain('localDateEndpointsUtc');
    expect(source).not.toContain('stableBodySignSlug');
    expect(source).not.toContain('engine.computeBodies(');
    expect(source).toContain('setRegistryRecordSlug(nextRegistryRecordSlug);');
    expect(source).not.toContain("resolveLocalToUtc(input.date, '23:59'");
  });

  it('places one measured bridge after the chart readings and before the result actions', async () => {
    const source = await readFile(calculatorUrl, 'utf8');
    const readings = source.indexOf('<CommunicationRead chart={chart} locale={locale} birthDate={computedInput?.date} />');
    const bridge = source.indexOf('data-registry-bridge-surface="birth_chart"');
    const actions = source.indexOf("{/* One primary action, derived from the visitor's current state. */}");

    expect(readings).toBeGreaterThan(-1);
    expect(bridge).toBeGreaterThan(readings);
    expect(actions).toBeGreaterThan(bridge);
    expect(source.indexOf('data-registry-bridge-surface="birth_chart"', bridge + 1)).toBe(-1);
    expect(source).toContain("trackAnalytics('registry_bridge_impression'");
    expect(source).toContain("trackAnalytics('registry_bridge_click'");
    // The birth chart's bridge is the visitor's own Sun sign: its events carry
    // the surface and locale only, so analytics receive no birth data.
    expect(source).not.toMatch(/trackAnalytics\('registry_bridge_(?:impression|click)', \{\s*sign:/u);
    expect(source).toContain("tf(locale, 'recordChartSun'");
    expect(source).toContain("tf(locale, 'recordChartBody'");
    expect(source).toContain("tf(locale, 'recordChartLink'");
  });
});
