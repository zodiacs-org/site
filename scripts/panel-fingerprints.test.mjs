import { readFile } from 'node:fs/promises';
import { expect, it } from 'vitest';
import { STUDIO_HTML } from '../integrations/generated/chart-studio.mjs';
import { HOROSCOPES_HTML } from '../integrations/generated/horoscopes.mjs';
import { OCCASIONS_HTML } from '../integrations/generated/occasions.mjs';
import { READINGS_HTML } from '../integrations/generated/readings.mjs';
import { WIDGET_HTML } from '../integrations/generated/sky-calendar.mjs';
import { assertPanelFingerprints, nextPanelFingerprints, panelFingerprintEntries } from './panel-fingerprints.mjs';

const recorded = JSON.parse(await readFile(new URL('../src/ai-tools/panel-fingerprints.json', import.meta.url), 'utf8'));
const entries = await panelFingerprintEntries({
  'sky-events': WIDGET_HTML,
  'chart-studio': STUDIO_HTML,
  horoscopes: HOROSCOPES_HTML,
  occasions: OCCASIONS_HTML,
  readings: READINGS_HTML,
});

it('keeps each current panel URI tied to its HTML', () => {
  expect(() => assertPanelFingerprints(entries, recorded)).not.toThrow();
});

it('accepts fingerprints retained for previously published panel URIs', () => {
  const historical = { ...recorded, 'ui://zodiacs/sky-events-v3.html': 'a'.repeat(64) };
  expect(() => assertPanelFingerprints(entries, historical)).not.toThrow();
  expect(nextPanelFingerprints(entries, historical)).toEqual(historical);
  expect(() => nextPanelFingerprints(
    entries.map((entry) => entry.name === 'sky-events' ? { ...entry, uri: 'ui://zodiacs/sky-events-v3.html' } : entry),
    historical,
  )).toThrow('Panel sky-events changed: give it a new URI in contracts.ts');
});

it('keeps the retired readings URIs recorded, so neither can be reused for other bytes', () => {
  // readings-v1 and readings-v2 were built for staging drives before 0.6.1 (readings-v2 was driven on staging).
  expect(recorded['ui://zodiacs/readings-v1.html']).toMatch(/^[0-9a-f]{64}$/u);
  expect(recorded['ui://zodiacs/readings-v2.html']).toMatch(/^[0-9a-f]{64}$/u);
  expect(entries.find((entry) => entry.name === 'readings')?.uri).toBe('ui://zodiacs/readings-v3.html');
  expect(() => assertPanelFingerprints(entries.map((entry) => entry.name === 'readings' ? { ...entry, uri: 'ui://zodiacs/readings-v2.html' } : entry), recorded))
    .toThrow('Panel readings changed: give it a new URI in contracts.ts');
});

it('rejects changed HTML at the same panel URI', () => {
  const changed = entries.map((entry) => entry.name === 'occasions'
    ? { ...entry, sha256: '0'.repeat(64) }
    : entry);
  expect(() => assertPanelFingerprints(changed, recorded))
    .toThrow('Panel occasions changed: give it a new URI in contracts.ts');
});
