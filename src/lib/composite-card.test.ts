import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const harness = vi.hoisted(() => ({ render: vi.fn(), share: vi.fn(), download: vi.fn() }));
vi.mock('preact', async (importOriginal) => ({ ...await importOriginal<typeof import('preact')>(), render: harness.render }));
// The frozen Solar stack supplies this transport; never duplicate it in product code.
vi.mock('./share-card', () => ({ savePreparedChartCard: harness.share, downloadPreparedChartCard: harness.download }));
vi.mock('./share-card-brand', async (importOriginal) => ({
  ...await importOriginal<typeof import('./share-card-brand')>(),
  withShareBrandIcon: (paint: (icon: null) => unknown) => paint(null),
}));
import { COMPOSITE_COPY } from '../islands/synastry/compositeCopy';
import { buildCompositeTabData } from '../islands/synastry/relationshipData';
import { planetLabel } from './i18n/astrology';
import { formatLongitude } from './signs';
import { prepareCompositeCard, shareCompositeCard, downloadCompositeCard } from './composite-card';

const points = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto', 'North Node', 'South Node'].map((body, index) => ({ body, lon: index * 30 + 0.25 }));
const data = buildCompositeTabData(points, points, { aTimeKnown: true, bTimeKnown: true });
interface PaintedText { value: string; x: number; y: number; font: string }
let serial = 0;
function install({ encode = true, imageLoads = true, contextAvailable = true } = {}) {
  const painted: PaintedText[] = [];
  const context = {
    font: '', fillStyle: '', textAlign: 'left', textBaseline: 'alphabetic',
    fillText: vi.fn(function (this: { font: string }, value: string, x: number, y: number) { painted.push({ value, x, y, font: this.font }); }),
    // Deterministic typography is only a painter contract; CI observes real font ink.
    measureText: vi.fn(function (this: { font: string }, value: string) { return { width: value.length * Number(this.font.match(/(\d+)px/u)?.[1] ?? 20) * 0.6 }; }),
    drawImage: vi.fn(), fillRect: vi.fn(), save: vi.fn(), restore: vi.fn(),
  };
  const canvas = { width: 0, height: 0, getContext: vi.fn(() => contextAvailable ? context : null),
    toBlob: vi.fn((callback: (value: Blob | null) => void) => callback(encode ? new Blob(['encoded-png'], { type: 'image/png' }) : null)) };
  const attributes = new Map<string, string>();
  const imageAttributes = new Map([['data-href', `/assets/zodiac-icons/128/test-${++serial}.webp`]]);
  const svgImage = { getAttribute: (key: string) => imageAttributes.get(key), setAttribute: (key: string, value: string) => imageAttributes.set(key, value), removeAttribute: (key: string) => imageAttributes.delete(key) };
  const svg = { setAttribute: (key: string, value: string) => attributes.set(key, value), querySelectorAll: () => [svgImage],
    get outerHTML() { return `<svg xmlns="${attributes.get('xmlns')}" width="${attributes.get('width')}" height="${attributes.get('height')}"><image href="${imageAttributes.get('href')}"/></svg>`; } };
  const host = { querySelector: () => svg };
  const fonts = { load: vi.fn(() => Promise.resolve([{ status: 'loaded' }] as Array<{ status: string }>)) };
  vi.stubGlobal('document', { fonts, createElement: vi.fn((tag) => tag === 'canvas' ? canvas : host) });
  vi.stubGlobal('Image', class {
    onload = () => {}; onerror = () => {};
    set src(_value: string) { queueMicrotask(() => imageLoads ? this.onload?.() : this.onerror?.()); }
  });
  const fetch = vi.fn().mockResolvedValue(new Response(new Blob(['canonical-icon'], { type: 'image/webp' })));
  vi.stubGlobal('fetch', fetch);
  const urls: Blob[] = [];
  vi.spyOn(URL, 'createObjectURL').mockImplementation((blob) => { urls.push(blob as Blob); return `blob:wheel-${urls.length}`; });
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
  return { canvas, context, painted, fonts, host, urls, fetch, imageAttributes };
}
beforeEach(() => { harness.render.mockClear(); });
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('dedicated composite image receipts', () => {
  it.each(['en', 'es', 'pt', 'fr', 'it', 'ru'] as const)('paints all exact reference facts and localized uncertainty in %s without natal or private data', async (locale) => {
    const fixture = install();
    const input = { ...data, moonProvisional: true };
    const prepared = await prepareCompositeCard(input, locale);
    expect(prepared.filename).toBe('zodiacs-composite.png'); expect(prepared.blob.type).toBe('image/png');
    expect([fixture.canvas.width, fixture.canvas.height]).toEqual([1080, 1350]);
    expect(fixture.context.drawImage).toHaveBeenCalledOnce();
    const text = fixture.painted.map((row) => row.value).join(' ').replace(/\s+/gu, ' ');
    expect(text).toContain(COMPOSITE_COPY[locale].imageTitle);
    expect(text).toContain('Zodiacs.org');
    expect(text).toContain(COMPOSITE_COPY[locale].imageReceipt);
    for (const point of input.points) {
      expect(text).toContain(`${planetLabel(locale, point.body)}${point.body === 'Moon' ? ' *' : ''} · ${formatLongitude(point.lon, locale)}`);
    }
    expect(text).toContain(COMPOSITE_COPY[locale].moonTimeNotice);
    expect(text).toContain(COMPOSITE_COPY[locale].oppositeConvention);
    expect(text).not.toMatch(/\b(?:ASC|MC|Rx|applying|separating)\b|Chart A|Chart B|\d{4}-\d{2}-\d{2}/u);
    expect(harness.render.mock.calls[0][0].props.data).toBe(input);
    expect(harness.render.mock.calls[0][0].props.onSelect).toBeUndefined();
    expect(harness.render.mock.calls[0][0].props.deferIcons).toBe(true);
    expect(fixture.fonts.load).toHaveBeenCalledTimes(3);
    expect(fixture.urls).toHaveLength(1);
    const serialized = await fixture.urls[0].text();
    expect(serialized).toContain('data:image/webp;base64,');
    expect(serialized).not.toContain('/assets/');
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:wheel-1');
    expect(harness.render).toHaveBeenLastCalledWith(null, fixture.host);
    // Card labels remain within their allocated bands in this deterministic fixture.
    expect(fixture.painted.every((row) => row.y > 40 && row.y < 1320)).toBe(true);
  });

  it('supports a sparse chart with no contacts without inventing a Moon or other placements', async () => {
    const fixture = install();
    const sparse = buildCompositeTabData([{ body: 'Sun', lon: 0 }], [{ body: 'Sun', lon: 180 }]);
    await prepareCompositeCard(sparse);
    const text = fixture.painted.map((row) => row.value).join(' ');
    expect(text).toContain(COMPOSITE_COPY.en.noAspects);
    expect(text).toContain(`Sun · ${formatLongitude(90, 'en')}`);
    expect(text).not.toContain(COMPOSITE_COPY.en.moonTimeNotice);
    expect(text).not.toMatch(/Moon|Venus|Mercury/u);
  });

  it('uses the approved native share and explicit download transports directly', () => {
    expect(shareCompositeCard).toBe(harness.share);
    expect(downloadCompositeCard).toBe(harness.download);
  });
});

describe('composite painter failure cleanup', () => {
  it('evicts a failed icon fetch so the same input can recover on retry', async () => {
    const fixture = install();
    fixture.fetch.mockRejectedValueOnce(new TypeError('offline'));
    await expect(prepareCompositeCard(data)).rejects.toThrow('offline');
    expect(harness.render).toHaveBeenLastCalledWith(null, fixture.host);
    await expect(prepareCompositeCard(data)).resolves.toMatchObject({ filename: 'zodiacs-composite.png' });
    expect(fixture.fetch).toHaveBeenCalledTimes(2);
  });
  it('releases the detached SVG URL when the image decoder fails', async () => {
    const fixture = install({ imageLoads: false });
    await expect(prepareCompositeCard(data)).rejects.toThrow('composite_wheel_unavailable');
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:wheel-1');
    expect(harness.render).toHaveBeenLastCalledWith(null, fixture.host);
    expect(fixture.canvas.toBlob).not.toHaveBeenCalled();
  });
  it.each(['canvas', 'encoder'])('reports %s failure without returning a misleading prepared image', async (failure) => {
    install({ encode: failure !== 'encoder', contextAvailable: failure !== 'canvas' });
    await expect(prepareCompositeCard(data)).rejects.toThrow(failure === 'canvas' ? 'composite_canvas_unavailable' : 'composite_png_unavailable');
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:wheel-1');
  });
  it('rejects a missing font face instead of silently exporting fallback typography', async () => {
    const fixture = install();
    fixture.fonts.load.mockResolvedValueOnce([]);
    await expect(prepareCompositeCard(data)).rejects.toThrow('composite_fonts_unavailable');
    expect(fixture.canvas.toBlob).not.toHaveBeenCalled();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:wheel-1');
  });
  it('refuses an empty point set before acquiring fonts or artwork', async () => {
    const fixture = install();
    await expect(prepareCompositeCard({ points: [], aspects: [], moonProvisional: false })).rejects.toThrow('composite_points_unavailable');
    expect(fixture.fetch).not.toHaveBeenCalled(); expect(fixture.fonts.load).not.toHaveBeenCalled();
  });
});


describe('composite preparation has a finite recovery window', () => {
  it.each(['headers', 'body reader', 'body buffer'])('aborts stalled %s and evicts the same artwork cache entry for retry', async (stage) => {
    vi.useFakeTimers();
    const fixture = install();
    const never = () => new Promise<never>(() => {});
    if (stage === 'headers') fixture.fetch.mockReturnValueOnce(never());
    else fixture.fetch.mockResolvedValueOnce({ ok: true, blob: stage === 'body reader' ? never : async () => ({ type: 'image/webp', arrayBuffer: never }) });
    let settled = false;
    const failure = prepareCompositeCard(data).then(() => null, (error) => { settled = true; return error; });
    await vi.advanceTimersByTimeAsync(14_999);
    expect(settled).toBe(false);
    const signal = fixture.fetch.mock.calls[0][1].signal as AbortSignal;
    expect(signal.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect((await failure)?.message).toBe('composite_prepare_timeout');
    expect(signal.aborted).toBe(true);
    expect(fixture.canvas.toBlob).not.toHaveBeenCalled();
    expect(harness.render).toHaveBeenLastCalledWith(null, fixture.host);
    expect(vi.getTimerCount()).toBe(0);
    const retry = prepareCompositeCard(data);
    await vi.advanceTimersByTimeAsync(0);
    await expect(retry).resolves.toMatchObject({ filename: 'zodiacs-composite.png' });
    expect(fixture.fetch).toHaveBeenCalledTimes(2);
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each(['font', 'SVG decode', 'PNG encode'])('returns a recoverable failure after a stalled native %s', async (stage) => {
    vi.useFakeTimers();
    const fixture = install();
    if (stage === 'font') fixture.fonts.load.mockReturnValueOnce(new Promise(() => {}));
    if (stage === 'SVG decode') vi.stubGlobal('Image', class { onload = null; onerror = null; src = ''; });
    if (stage === 'PNG encode') fixture.canvas.toBlob.mockImplementationOnce(() => {});
    const failure = prepareCompositeCard(data).then(() => null, (error) => error);
    await vi.advanceTimersByTimeAsync(15_000);
    expect((await failure)?.message).toBe('composite_prepare_timeout');
    expect(vi.getTimerCount()).toBe(0);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:wheel-1');
  });

  it('fails preparation when the minimum text size still exceeds the allocated width', async () => {
    const fixture = install();
    fixture.context.measureText.mockReturnValue({ width: 5000 });
    await expect(prepareCompositeCard(data)).rejects.toThrow('composite_text_overflow');
    expect(fixture.canvas.toBlob).not.toHaveBeenCalled();
    expect(fixture.painted).toHaveLength(0);
  });
});
