import type { VNode } from 'preact';
import { renderToString } from 'preact-render-to-string';
import { afterEach, expect, it, vi } from 'vitest';
import { HOROSCOPE_DISCLOSURE, softenMinorPanel, type HoroscopePanelData, type PanelReading } from './reading';

const harness = vi.hoisted(() => ({
  app: null as (() => VNode) | null,
  cursor: 0,
  slots: [] as unknown[],
  mounted: false,
  mountEffects: [] as Array<() => void | (() => void)>,
  cleanups: [] as Array<() => void>,
}));

vi.mock('preact', async (importOriginal) => ({
  ...await importOriginal<typeof import('preact')>(),
  render: (app: VNode) => { harness.app = app.type as () => VNode; },
}));

vi.mock('preact/hooks', () => ({
  useRef: (initial: unknown) => {
    const slot = harness.cursor++;
    return harness.slots[slot] ??= { current: initial };
  },
  useState: (initial: unknown) => {
    const slot = harness.cursor++;
    if (!(slot in harness.slots)) harness.slots[slot] = initial;
    return [harness.slots[slot], (next: unknown) => {
      harness.slots[slot] = typeof next === 'function' ? next(harness.slots[slot]) : next;
    }];
  },
  useEffect: (effect: () => void | (() => void)) => {
    if (!harness.mounted) harness.mountEffects.push(effect);
  },
}));

function markup() {
  harness.cursor = 0;
  return renderToString(harness.app!());
}

afterEach(() => {
  harness.cleanups.forEach((cleanup) => cleanup());
  vi.unstubAllGlobals();
});

it('keeps the minor reading disclosure when the host sends another sign without the minor flag', async () => {
  const host = { toolOutput: {}, toolResponseMetadata: {} };
  const window = new EventTarget();
  Object.assign(window, { parent: window, openai: host });
  vi.stubGlobal('window', window);
  vi.stubGlobal('document', { getElementById: () => ({}), documentElement: { dataset: {} } });
  vi.stubGlobal('HOROSCOPE_SIGN_TABLE', []);
  vi.stubGlobal('HOROSCOPE_ICONS', {});
  vi.stubGlobal('CARD_ART', {});
  await import('./app');
  markup();
  // Run the mount effects once so subsequent host updates use the original subscription.
  harness.mounted = true;
  for (const effect of harness.mountEffects.splice(0)) {
    const cleanup = effect();
    if (cleanup) harness.cleanups.push(cleanup);
  }

  const date = '2026-11-20';
  const reading: PanelReading = {
    status: 'available', paragraphs: [{ text: 'Make time to reflect.' }], facts: [], houses: [],
    from: date, through: date, shareUrl: null,
  };
  const panel: HoroscopePanelData = {
    sign: 'leo', signName: 'Leo', requested: { period: 'day', focus: 'general', date, zone: 'UTC' },
    days: [{ date, focuses: { general: reading, love: reading, career: reading } }], weeks: [],
    note: '', disclosure: HOROSCOPE_DISCLOSURE,
  };
  function deliver(data: HoroscopePanelData, disclosure: string) {
    host.toolOutput = { ok: true, tool: 'get_horoscope', data: { status: 'available', disclosure } };
    host.toolResponseMetadata = { 'zodiacs/horoscope': data };
    window.dispatchEvent(new CustomEvent('openai:set_globals', { detail: { globals: host } }));
  }

  const disclosure = `${HOROSCOPE_DISCLOSURE} Reading confidence 40%. For a month, a year or a career week, use get_horoscope_period.`;
  deliver(softenMinorPanel(panel), disclosure);
  expect(markup()).toContain(`<p class="fine">${disclosure}</p>`);

  const nextDisclosure = `${HOROSCOPE_DISCLOSURE} Reading confidence 40%. For a month, a year, or a love or career week, use get_horoscope_period.`;
  deliver({ ...panel, sign: 'virgo', signName: 'Virgo' }, nextDisclosure);
  const updated = markup();
  expect(updated).toContain('>Virgo</h1>');
  expect(updated).toContain(`<p class="fine">${disclosure}</p>`);
});
