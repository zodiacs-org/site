import type { VNode } from 'preact';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { LunarReturnExportModel } from '../islands/lunar-return/export-model';
import type { BodyName } from './engine/types';

const hooks = vi.hoisted(() => ({ download: vi.fn(), render: vi.fn() }));
vi.mock('./share-card', () => ({ downloadPreparedChartCard: hooks.download }));
vi.mock('preact', async (original) => ({ ...await original<typeof import('preact')>(), render: hooks.render }));
import { downloadLunarReturnCard, prepareLunarReturnCard, shareLunarReturnCard } from './lunar-return-card';

function model(): LunarReturnExportModel {
  return {
    title: 'Lunar return', instantUtc: '2026-09-24T13:14:15.678Z', referenceUtc: '2026-09-05T10:00:00.000Z', engineVersion: '9.3.0',
    wheel: {
      bodies: (['Sun', 'Moon', 'Mercury'] as BodyName[]).map((body, i) => ({ body, lon: i * 60, lat: 0, speed: 1, retrograde: false })),
      angles: { asc: 15, mc: 105, dsc: 195, ic: 285 }, houses: { system: 'whole', cusps: Array.from({ length: 12 }, (_, i) => i * 30) },
      aspects: [{ a: 'Moon', b: 'Mercury', type: 'sextile', orb: 0, applying: true }],
    },
    reading: [{ kind: 'moon-house', text: 'Look at the habits that help you feel secure. Make room for one practical comfort you can sustain.' },
      { kind: 'moon-aspect', text: 'Consider how communication can support your emotional needs. Notice what helps, then give it a little more attention.' }],
    readingBasis: ['Moon 0° Gemini · house 3', 'Moon sextile Mercury · 0.0° orb'],
    notes: ['Astrological interpretations are prompts for reflection, not predictions of events.', 'Whole-sign houses are used because Placidus is unavailable at this location.'],
  };
}

function install() {
  const painted: { text: string; y: number }[] = [];
  const context = {
    font: '', textAlign: 'left', textBaseline: 'top', fillStyle: '',
    measureText: vi.fn(function (this: { font: string }, text: string) {
      return { width: text.length * Number(this.font.match(/(\d+)px/u)?.[1] ?? 20) * .58 };
    }),
    fillText: vi.fn((text: string, _x: number, y: number) => { painted.push({ text, y }); }),
    fillRect: vi.fn(), drawImage: vi.fn(), save: vi.fn(), restore: vi.fn(),
  };
  const sizes: number[][] = [];
  const canvas = { width: 0, height: 0, getContext: vi.fn(() => context),
    toBlob: vi.fn((callback: (value: Blob | null) => void) => {
      sizes.push([canvas.width, canvas.height]); callback(new Blob(['png'], { type: 'image/png' }));
    }) };
  const discs = Array.from({ length: 12 }, (_, i) => {
    let href = `/assets/zodiac-icons/400/${i}.webp`;
    return { getAttribute: vi.fn(() => href), setAttribute: vi.fn((_name: string, value: string) => { href = value; }) };
  });
  const labels = [
    { text: 'ASC', family: 'var(--font-mono)' },
    { text: '1', family: null as string | null },
    { text: 'Rx', family: 'var(--font-mono)' },
  ].map((value) => ({ ...value, setAttribute(name: string, family: string) { if (name === 'font-family') this.family = family; } }));
  const svg = {
    get outerHTML() { return `<svg>${labels.map(label => `<text${label.family ? ` font-family="${label.family}"` : ''}>${label.text}</text>`).join('')}</svg>`; },
    setAttribute: vi.fn(), querySelectorAll: (selector: string) => selector === 'text' ? labels : discs,
  };
  const host = { querySelector: vi.fn(() => svg) };
  const fonts = { load: vi.fn(async () => [{ status: 'loaded' }]) };
  const fetch = vi.fn(async (_path: RequestInfo | URL, _init?: RequestInit) => ({ ok: true, blob: async () => new Blob(['canonical artwork'], { type: 'image/webp' }) }) as Response);
  const close = vi.fn();
  const images: { src: string; onload: null | (() => void); onerror: null | (() => void) }[] = [];
  const imageControl = { complete: true };
  vi.stubGlobal('Image', class {
    value = ''; onload: null | (() => void) = null; onerror: null | (() => void) = null;
    constructor() { images.push(this); }
    set src(value: string) { this.value = value; if (value && imageControl.complete) queueMicrotask(() => this.onload?.()); }
    get src() { return this.value; }
  });
  vi.stubGlobal('document', { fonts, createElement: vi.fn((tag: string) => tag === 'canvas' ? canvas : tag === 'template' ? { content: host } : host) });
  vi.stubGlobal('fetch', fetch); vi.stubGlobal('createImageBitmap', vi.fn(async () => ({ close })));
  let serial = 0;
  vi.spyOn(URL, 'createObjectURL').mockImplementation(() => `blob:lunar-${++serial}`);
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
  hooks.render.mockReset();
  return { context, canvas, sizes, painted, discs, labels, host, svg, fonts, fetch, close, images, imageControl };
}
beforeEach(() => { hooks.download.mockReset().mockReturnValue('downloaded'); });
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('dedicated lunar image content', () => {
  it('serializes every wheel label with a self-contained concrete monospace face', async () => {
    const fixture = install();
    await prepareLunarReturnCard(model());
    const svgBlob = vi.mocked(URL.createObjectURL).mock.calls
      .map(([value]) => value).find(value => value instanceof Blob && value.type === 'image/svg+xml') as Blob;
    const serialized = await svgBlob.text();
    expect(serialized).not.toContain('var(');
    for (const label of ['ASC', '1', 'Rx']) {
      expect(serialized).toContain(`<text font-family="ui-monospace, Menlo, Consolas, monospace">${label}</text>`);
    }
    expect(fixture.labels).toHaveLength(3);
  });

  it('paints complete event/reference/readings with the actual wheel input and canonical brand', async () => {
    const fixture = install(), card = model();
    const prepared = await prepareLunarReturnCard({ ...card, privateName: 'NEVER_PAINT_PRIVATE' } as LunarReturnExportModel);
    const text = fixture.painted.map((row) => row.text).join(' ');
    // The return and its reference to the whole minute, never the seconds.
    expect(text).toContain('Lunar return'); expect(text).toContain('Return: 2026-09-24 13:14 UTC');
    expect(text).toContain('Next after: 2026-09-05 10:00 UTC'); expect(text).not.toMatch(/13:14:15|\.678/u);
    card.reading.forEach((row) => expect(text).toContain(row.text));
    [...card.readingBasis, ...card.notes].forEach((value) => expect(text).toContain(value));
    expect(text).toContain('zodiacs.org'); expect(text).not.toContain('NEVER_PAINT_PRIVATE');
    const node = hooks.render.mock.calls[0][0] as VNode<{ signImageHrefs: Record<string, string> }>;
    // The angles at the middle of their whole degree, as a chart's link keeps them.
    expect(node.props).toMatchObject({ bodies: card.wheel.bodies, asc: 15.5, mc: 105.5, dsc: 195.5, ic: 285.5, cusps: card.wheel.houses!.cusps, aspects: card.wheel.aspects });
    expect(node.props).not.toHaveProperty('input');
    const hrefs = node.props.signImageHrefs;
    expect(Object.keys(hrefs)).toHaveLength(12);
    expect(Object.values(hrefs).every((href) => href.startsWith('data:image/webp;base64,'))).toBe(true);
    expect(fixture.fetch).toHaveBeenCalledTimes(13);
    expect(fixture.context.drawImage).toHaveBeenCalledTimes(2);
    expect(hooks.render).toHaveBeenLastCalledWith(null, fixture.host);
    expect(fixture.sizes).toEqual([[1080, 1350]]); expect(fixture.canvas.width).toBe(0);
    expect(fixture.close).toHaveBeenCalledOnce(); expect(fixture.images[0].src).toBe('');
    expect(prepared.filename).toBe('zodiacs-lunar-return-20260924T1314Z.png');
    expect(prepared.blob.type).toBe('image/png');
  });
  it('rejects incomplete or nonfinite geometry before allocating a wheel or fetching artwork', async () => {
    const fixture = install();
    const invalid = [
      { ...model(), wheel: { ...model().wheel, angles: null } },
      { ...model(), wheel: { ...model().wheel, houses: null } },
      { ...model(), wheel: { ...model().wheel, angles: { asc: NaN, mc: 105, dsc: 195, ic: 285 } } },
      { ...model(), wheel: { ...model().wheel, bodies: model().wheel.bodies.filter((point) => point.body !== 'Moon') } },
      { ...model(), wheel: { ...model().wheel, bodies: model().wheel.bodies.map((point) => ({ ...point, lon: NaN })) } },
      { ...model(), referenceUtc: model().instantUtc },
    ];
    for (const card of invalid) await expect(prepareLunarReturnCard(card)).rejects.toThrow('lunar_card_unavailable');
    expect(fixture.fetch).not.toHaveBeenCalled(); expect(hooks.render).not.toHaveBeenCalled();
  });
  it('leaves out Placidus houses and the house they put the Moon in, and says so', async () => {
    const fixture = install(), card = model();
    card.wheel.houses = { system: 'placidus', cusps: [15, 44, 73, 105, 137, 166, 195, 224, 253, 285, 317, 346] };
    card.readingBasis = ['Moon 0°00′ Gemini · house 3', 'Moon sextile Mercury · 0.0° orb'];
    await prepareLunarReturnCard(card);
    const text = fixture.painted.map((row) => row.text).join(' ');
    expect(text).toContain('Moon 0°00′ Gemini'); expect(text).not.toContain('house 3');
    expect(text).not.toContain(card.reading[0].text); expect(text).toContain(card.reading[1].text);
    expect(text).toContain('Placidus houses are left out of this image.');
    const node = hooks.render.mock.calls[0][0] as VNode<Record<string, unknown>>;
    expect(node.props.cusps).toBeUndefined();
  });
  it('fails overflowing copy instead of clipping its qualification and releases allocated resources', async () => {
    const fixture = install(); const card = model(); card.notes = ['A '.repeat(2000)];
    await expect(prepareLunarReturnCard(card)).rejects.toThrow('lunar_text_overflow');
    expect(fixture.canvas.toBlob).not.toHaveBeenCalled(); expect(fixture.close).toHaveBeenCalledOnce();
    expect(fixture.canvas.width).toBe(0); expect(fixture.images[0].src).toBe('');
  });
  it('rejects unavailable fonts and permits retry after an artwork failure', async () => {
    const fixture = install(); fixture.fonts.load.mockResolvedValueOnce([]);
    await expect(prepareLunarReturnCard(model())).rejects.toThrow('lunar_fonts_unavailable');
    expect(fixture.fetch).not.toHaveBeenCalled();
    fixture.fetch.mockRejectedValueOnce(new Error('offline'));
    await expect(prepareLunarReturnCard(model())).rejects.toThrow('offline');
    await expect(prepareLunarReturnCard(model())).resolves.toMatchObject({ filename: expect.stringContaining('lunar-return') });
  });
});

describe('finite preparation and resource ownership', () => {
  it.each(['fonts', 'headers', 'body', 'bytes', 'SVG', 'bitmap', 'PNG'] as const)('bounds stalled %s to one fifteen-second window', async (stage) => {
    vi.useFakeTimers(); const fixture = install();
    let complete!: (value: any) => void;
    const held = new Promise<any>((resolve) => { complete = resolve; });
    if (stage === 'fonts') fixture.fonts.load.mockReturnValueOnce(held);
    if (stage === 'headers') fixture.fetch.mockReturnValueOnce(held);
    if (stage === 'body') fixture.fetch.mockResolvedValueOnce({ ok: true, blob: () => held } as Response);
    if (stage === 'bytes') fixture.fetch.mockResolvedValueOnce({ ok: true, blob: async () => ({ type: 'image/webp', arrayBuffer: () => held }) } as unknown as Response);
    if (stage === 'SVG') fixture.imageControl.complete = false;
    if (stage === 'bitmap') vi.mocked(createImageBitmap).mockReturnValueOnce(held);
    if (stage === 'PNG') fixture.canvas.toBlob.mockImplementationOnce((callback) => { complete = callback; });
    const failure = prepareLunarReturnCard(model()).catch((cause) => cause);
    await vi.advanceTimersByTimeAsync(15_000);
    expect((await failure).message).toBe('lunar_prepare_timeout'); expect(vi.getTimerCount()).toBe(0);
    expect(fixture.canvas.width).toBe(0);
    const writes = fixture.painted.length;
    if (stage === 'bitmap') { const lateClose = vi.fn(); complete({ close: lateClose }); await vi.advanceTimersByTimeAsync(0); expect(lateClose).toHaveBeenCalledOnce(); }
    else if (stage === 'fonts') complete([{ status: 'loaded' }]);
    else if (stage === 'headers') complete(new Response(new Blob(['late'])));
    else if (stage === 'bytes') complete(new ArrayBuffer(1));
    else if (stage !== 'SVG') complete(new Blob(['late']));
    await vi.advanceTimersByTimeAsync(0); expect(fixture.painted).toHaveLength(writes);
    if (stage === 'SVG') {
      expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:lunar-1');
      expect(fixture.images[0]).toMatchObject({ src: '', onload: null, onerror: null });
      expect(hooks.render).toHaveBeenLastCalledWith(null, fixture.host);
    }
    if (stage === 'PNG') expect(fixture.close).toHaveBeenCalledOnce();
  });
  it('cleans up the WebKit brand decoding URL after source abort', async () => {
    const fixture = install(); vi.stubGlobal('createImageBitmap', undefined);
    const controller = new AbortController();
    fixture.fetch.mockImplementation(async (path) => {
      if (String(path).includes('/brand/')) fixture.imageControl.complete = false;
      return { ok: true, blob: async () => new Blob(['artwork'], { type: 'image/png' }) } as Response;
    });
    // The fallback's second image is held, after the real wheel image decodes.
    const original = fixture.fetch.getMockImplementation()!;
    fixture.fetch.mockImplementation(async (...args) => {
      if (fixture.fetch.mock.calls.length === 13) fixture.imageControl.complete = false;
      return original(...args);
    });
    const failure = prepareLunarReturnCard(model(), controller.signal).catch((cause) => cause);
    for (let step = 0; step < 60; step++) await Promise.resolve();
    expect(fixture.images).toHaveLength(2);
    controller.abort(new Error('source replaced')); expect((await failure).message).toBe('source replaced');
    for (let step = 0; step < 10; step++) await Promise.resolve();
    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(2);
    expect(fixture.images.every((image) => image.src === '' && image.onload === null && image.onerror === null)).toBe(true);
  });
  it('honors an already-revoked parent before any async work', async () => {
    const fixture = install(), controller = new AbortController(); controller.abort(new Error('source revoked'));
    await expect(prepareLunarReturnCard(model(), controller.signal)).rejects.toThrow('source revoked');
    expect(fixture.fonts.load).not.toHaveBeenCalled(); expect(fixture.fetch).not.toHaveBeenCalled();
  });
  it('releases a successfully decoded WebKit brand and a failed PNG before retry', async () => {
    const fixture = install(); vi.stubGlobal('createImageBitmap', undefined);
    fixture.canvas.toBlob.mockImplementationOnce((callback) => callback(null));
    await expect(prepareLunarReturnCard(model())).rejects.toThrow('lunar_png_unavailable');
    expect(fixture.images).toHaveLength(2);
    expect(fixture.images.every((image) => image.src === '' && image.onload === null && image.onerror === null)).toBe(true);
    expect(fixture.canvas.width).toBe(0);
    await expect(prepareLunarReturnCard(model())).resolves.toMatchObject({ filename: expect.stringContaining('lunar-return') });
  });
});

describe('prepared share transport', () => {
  const prepared = { blob: new Blob(['ready'], { type: 'image/png' }), filename: 'lunar.png' };
  it('reuses explicit download and invokes files-only native sharing in the click turn', async () => {
    expect(downloadLunarReturnCard).toBe(hooks.download);
    const share = vi.fn().mockResolvedValue(undefined); vi.stubGlobal('navigator', { canShare: () => true, share });
    const pending = shareLunarReturnCard(prepared);
    expect(share).toHaveBeenCalledOnce(); expect(Object.keys(share.mock.calls[0][0])).toEqual(['files']);
    await expect(pending).resolves.toBe('shared'); expect(hooks.download).not.toHaveBeenCalled();
  });
  it('keeps cancellation distinct from sharing and downloading', async () => {
    vi.stubGlobal('navigator', { canShare: () => true, share: () => Promise.reject(new DOMException('cancelled', 'AbortError')) });
    await expect(shareLunarReturnCard(prepared)).resolves.toBe('cancelled'); expect(hooks.download).not.toHaveBeenCalled();
  });
  it.each(['unsupported', 'rejected'])('retains the existing download fallback when %s', async (condition) => {
    vi.stubGlobal('navigator', { canShare: () => condition !== 'unsupported', share: () => Promise.reject(new Error('unavailable')) });
    await expect(shareLunarReturnCard(prepared)).resolves.toBe('downloaded');
    expect(hooks.download).toHaveBeenCalledExactlyOnceWith(prepared);
  });
  it('never downloads an old file after delayed native rejection', async () => {
    let reject!: (cause: unknown) => void, current = true;
    vi.stubGlobal('navigator', { canShare: () => true, share: () => new Promise((_resolve, fail) => { reject = fail; }) });
    const pending = shareLunarReturnCard(prepared, () => current); current = false; reject(new Error('share failed'));
    await expect(pending).resolves.toBe('cancelled'); expect(hooks.download).not.toHaveBeenCalled();
  });
});
