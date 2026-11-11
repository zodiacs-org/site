import type { VNode } from 'preact';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SolarReturnExportModel } from './export-model';

const harness = vi.hoisted(() => ({
  slots: [] as unknown[], cursor: 0, effectCursor: 0,
  effects: [] as Array<{ dependencies: unknown[]; cleanup?: () => void }>,
  pending: [] as Array<() => void>, writes: vi.fn(),
  imageImport: vi.fn(), calendarImport: vi.fn(), prepare: vi.fn(), share: vi.fn(), download: vi.fn(),
  calendar: vi.fn(), calendarDownload: vi.fn(),
}));
vi.mock('preact/hooks', () => ({
  useState: (initial: unknown) => {
    const slot = harness.cursor++;
    if (!(slot in harness.slots)) harness.slots[slot] = initial;
    return [harness.slots[slot], (next: unknown) => {
      harness.writes(slot, next);
      harness.slots[slot] = typeof next === 'function' ? next(harness.slots[slot]) : next;
    }];
  },
  useRef: (initial: unknown) => {
    const slot = harness.cursor++;
    if (!(slot in harness.slots)) harness.slots[slot] = { current: initial };
    return harness.slots[slot];
  },
  useEffect: (effect: () => void | (() => void), dependencies: unknown[]) => {
    const slot = harness.effectCursor++;
    const previous = harness.effects[slot];
    if (previous && dependencies.every((value, i) => Object.is(value, previous.dependencies[i]))) return;
    harness.pending.push(() => {
      previous?.cleanup?.();
      const cleanup = effect();
      harness.effects[slot] = { dependencies, cleanup: typeof cleanup === 'function' ? cleanup : undefined };
    });
  },
}));
vi.mock('../../lib/module-load', async (original) => {
  const actual = await original<typeof import('../../lib/module-load')>();
  return {
    ...actual,
    createModuleLoader: (load: () => Promise<unknown>) => () => actual.loadModule(
      String(load).includes('share-card') ? harness.imageImport : harness.calendarImport,
    ),
  };
});

import SolarReturnActions from './SolarReturnActions';
import CalculationReload from '../CalculationReload';

const model = { returnYear: 2024, instantUtc: '2024-07-06T12:00:00.000Z', noTime: false } as SolarReturnExportModel;
const card = { blob: new Blob(['current return'], { type: 'image/png' }), filename: 'zodiacs-solar-return-2024.png' };
const imageModule = () => ({ prepareSolarReturnCard: harness.prepare, savePreparedChartCard: harness.share, downloadPreparedChartCard: harness.download });
const calendarModule = () => [{ buildSolarReturnCalendar: harness.calendar, solarReturnCalendarFilename: () => 'return.ics' }, { downloadCalendarFile: harness.calendarDownload }];
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
function nodes(value: unknown): VNode<Record<string, any>>[] {
  if (Array.isArray(value)) return value.flatMap(nodes);
  if (!value || typeof value !== 'object' || !('props' in value)) return [];
  const node = value as VNode<Record<string, any>>;
  return [node, ...nodes(node.props.children)];
}
function render(current = model) {
  harness.cursor = 0; harness.effectCursor = 0;
  const tree = SolarReturnActions({ model: current });
  harness.pending.splice(0).forEach((effect) => effect());
  return nodes(tree);
}
const button = (label: string, current = model) => render(current).find((node) => node.type === 'button' && node.props.children === label)!;
const marker = (name: string, current = model) => render(current).find((node) => Object.hasOwn(node.props, name));
const unmount = () => harness.effects.forEach((effect) => effect.cleanup?.());

beforeEach(() => {
  harness.slots = []; harness.cursor = 0; harness.effectCursor = 0; harness.effects = []; harness.pending = [];
  harness.writes.mockClear();
  harness.prepare.mockReset().mockResolvedValue(card);
  harness.share.mockReset().mockResolvedValue('shared');
  harness.download.mockReset().mockReturnValue('downloaded');
  harness.calendar.mockReset().mockReturnValue('BEGIN:VCALENDAR\r\nEND:VCALENDAR\r\n');
  harness.calendarDownload.mockReset();
  harness.imageImport.mockReset().mockResolvedValue(imageModule());
  harness.calendarImport.mockReset().mockResolvedValue(calendarModule());
});
afterEach(() => { unmount(); vi.restoreAllMocks(); });

describe('Solar Return optional export lifecycle', () => {
  it('says the image and calendar give a date, not a clock time, without a birth time', () => {
    const help = (current: SolarReturnExportModel) => render(current).filter((node) => node.props.class === 'field__help').map((node) => String(node.props.children));
    const untimed = help({ ...model, noTime: true });
    expect(untimed).toContain('The image shows this return chart and reading, with the date of the return. The calendar marks that day. Birth details and names are left out.');
    expect(untimed.join(' ')).not.toContain('whole minute');
    unmount(); harness.slots = []; harness.effects = [];
    expect(help(model)).toContain('The image shows this return chart and reading, with the return to the whole minute, the angles to the whole degree and no Placidus houses. The calendar marks the return to the whole minute. Birth details and names are left out.');
  });

  it('keeps the calendar usable while image preparation is pending', async () => {
    let resolve!: (value: unknown) => void;
    harness.prepare.mockReturnValue(new Promise((done) => { resolve = done; }));
    render(); await settle();
    expect(button('Save image').props.disabled).toBe(true);
    await button('Add to calendar').props.onClick();
    expect(harness.calendar).toHaveBeenCalledWith(model, expect.any(Date));
    expect(harness.calendarDownload).toHaveBeenCalledOnce();
    expect(marker('data-sr-calendar-message')?.props.children).toBe('Calendar download started.');
    resolve(card); await settle();
    expect(button('Save image').props.disabled).toBe(false);
  });

  it('retries a failed image without replacing the completed return model', async () => {
    harness.prepare.mockRejectedValueOnce(new Error('Raster failed')).mockResolvedValue(card);
    render(); await settle();
    expect(marker('data-sr-image-error')).toBeDefined();
    button('Prepare image again').props.onClick(); render(); await settle();
    expect(harness.prepare).toHaveBeenNthCalledWith(1, model);
    expect(harness.prepare).toHaveBeenNthCalledWith(2, model);
    expect(marker('data-sr-image-error')).toBeUndefined();
    expect(button('Save image').props.disabled).toBe(false);
  });

  it('offers reload when an image module download fails while retaining calendar access', async () => {
    harness.imageImport.mockRejectedValue(new Error('Chunk missing'));
    render(); await settle();
    expect(render().find((node) => node.type === CalculationReload)?.props.error).toBeTruthy();
    await button('Add to calendar').props.onClick();
    expect(harness.calendarDownload).toHaveBeenCalledOnce();
  });

  it('shares the ready file synchronously and keeps cancellation neutral', async () => {
    render(); await settle();
    harness.share.mockResolvedValue('cancelled');
    const pending = button('Share image').props.onClick();
    expect(harness.share).toHaveBeenCalledExactlyOnceWith(card);
    await pending;
    expect(marker('data-sr-image-message')).toBeUndefined();
    expect(harness.download).not.toHaveBeenCalled();
    button('Save image').props.onClick();
    expect(harness.download).toHaveBeenCalledExactlyOnceWith(card);
    expect(marker('data-sr-image-message')?.props.children).toBe('Image download started.');
  });

  it('drops an older prepared image when relocation replaces a model at the same instant', async () => {
    let resolve!: (value: unknown) => void;
    const relocated = { ...model, noPlace: true };
    const relocatedCard = { ...card, blob: new Blob(['relocated return']) };
    harness.prepare.mockReturnValueOnce(new Promise((done) => { resolve = done; })).mockResolvedValue(relocatedCard);
    render(); await settle();
    render(relocated); await settle();
    const writes = harness.writes.mock.calls.length;
    resolve(card); await settle();
    expect(harness.writes).toHaveBeenCalledTimes(writes);
    button('Save image', relocated).props.onClick();
    expect(harness.download).toHaveBeenCalledExactlyOnceWith(relocatedCard);
  });

  it('does not cancel a pending calendar import when only the image is retried', async () => {
    let resolve!: (value: unknown) => void;
    harness.prepare.mockRejectedValueOnce(new Error('Raster failed')).mockResolvedValue(card);
    harness.calendarImport.mockReturnValue(new Promise((done) => { resolve = done; }));
    render(); await settle();
    const pending = button('Add to calendar').props.onClick();
    button('Prepare image again').props.onClick(); render(); await settle();
    resolve(calendarModule()); await pending;
    expect(harness.calendarDownload).toHaveBeenCalledOnce();
    expect(button('Save image').props.disabled).toBe(false);
  });

  it('prevents a late calendar download after the result has unmounted', async () => {
    let resolve!: (value: unknown) => void;
    harness.calendarImport.mockReturnValue(new Promise((done) => { resolve = done; }));
    render(); await settle();
    const pending = button('Add to calendar').props.onClick();
    unmount();
    const writes = harness.writes.mock.calls.length;
    resolve(calendarModule()); await pending;
    expect(harness.calendarDownload).not.toHaveBeenCalled();
    expect(harness.writes).toHaveBeenCalledTimes(writes);
  });

  it('guards duplicate share taps and ignores completion after unmount', async () => {
    let resolve!: (value: unknown) => void;
    harness.share.mockReturnValue(new Promise((done) => { resolve = done; }));
    render(); await settle();
    const share = button('Share image').props.onClick;
    const save = button('Save image').props.onClick;
    const pending = share(); await share(); save();
    expect(harness.share).toHaveBeenCalledOnce();
    expect(harness.download).not.toHaveBeenCalled();
    unmount();
    const writes = harness.writes.mock.calls.length;
    resolve('shared'); await pending;
    expect(harness.writes).toHaveBeenCalledTimes(writes);
  });

  it('recovers calendar failure independently while the ready image stays downloadable', async () => {
    harness.calendarImport.mockRejectedValueOnce(new Error('Calendar chunk missing')).mockResolvedValue(calendarModule());
    render(); await settle();
    await button('Add to calendar').props.onClick();
    expect(marker('data-sr-calendar-error')).toBeDefined();
    button('Save image').props.onClick();
    expect(harness.download).toHaveBeenCalledOnce();
    await button('Add to calendar').props.onClick();
    expect(harness.calendarDownload).toHaveBeenCalledOnce();
    expect(marker('data-sr-calendar-error')).toBeUndefined();
  });
});
