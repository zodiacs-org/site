import { createHash } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildAspectPatternModel, selectedPatternCard } from './aspect-pattern-model';
import { matchAspect } from './engine/aspects';
import type { PatternKind, PatternPoint } from './engine/aspect-patterns';

const transport = vi.hoisted(() => ({ download: vi.fn() }));
vi.mock('./share-card', () => ({ downloadPreparedChartCard: transport.download }));
import { aspectPatternCardFilename, downloadAspectPatternCard, prepareAspectPatternCard, shareAspectPatternCard } from './aspect-pattern-card';

const fixtures: Record<PatternKind, PatternPoint[]> = {
  'grand-trine': [{ body: 'Mercury', lon: 0 }, { body: 'Venus', lon: 120 }, { body: 'Mars', lon: 240 }],
  't-square': [{ body: 'Mercury', lon: 0 }, { body: 'Venus', lon: 180 }, { body: 'Mars', lon: 90 }],
  'grand-cross': [{ body: 'Mercury', lon: 0 }, { body: 'Venus', lon: 90 }, { body: 'Mars', lon: 180 }, { body: 'Jupiter', lon: 270 }],
  kite: [{ body: 'Mercury', lon: 0 }, { body: 'Venus', lon: 120 }, { body: 'Mars', lon: 240 }, { body: 'Jupiter', lon: 180 }],
};
function selected(kind: PatternKind = 'grand-cross', context: 'natal' | 'composite' = 'natal') {
  const points = fixtures[kind];
  const aspects = points.flatMap((a, i) => points.slice(i + 1).flatMap((b) => {
    const match = matchAspect(a.body, a.lon, b.body, b.lon);
    return match ? [{ a: a.body, b: b.body, type: match.def.type, orb: match.orb }] : [];
  }));
  const model = buildAspectPatternModel({ context, sourceKey: 'private-source-do-not-paint', timeKnown: true, points, aspects });
  return selectedPatternCard(model, model.roots.find((pattern) => pattern.kind === kind)!.id)!;
}

function install() {
  const painted: { text: string; x: number; y: number; font: string }[] = [];
  const stack: Record<string, unknown>[] = [];
  const context = {
    font: '', textAlign: 'left', textBaseline: 'alphabetic', fillStyle: '', strokeStyle: '', lineWidth: 1,
    fillText: vi.fn(function (this: { font: string }, text: string, x: number, y: number) { painted.push({ text, x, y, font: this.font }); }),
    measureText: vi.fn(function (this: { font: string }, text: string) { return { width: text.length * Number(this.font.match(/(\d+)px/u)?.[1] ?? 20) * .58 }; }),
    save: vi.fn(function () { stack.push({ font: context.font, textAlign: context.textAlign }); }),
    restore: vi.fn(function () { Object.assign(context, stack.pop()); }),
    drawImage: vi.fn(), fillRect: vi.fn(), translate: vi.fn(), scale: vi.fn(), beginPath: vi.fn(), arc: vi.fn(),
    moveTo: vi.fn(), lineTo: vi.fn(), stroke: vi.fn(), fill: vi.fn(), strokeText: vi.fn(),
  };
  const encodedSizes: number[][] = [];
  const canvas = { width: 0, height: 0, getContext: vi.fn(() => context),
    toBlob: vi.fn((callback: (blob: Blob | null) => void) => {
      encodedSizes.push([canvas.width, canvas.height]); callback(new Blob(['png'], { type: 'image/png' }));
    }) };
  const fonts = { load: vi.fn(async () => [{ status: 'loaded' }]) };
  const fetch = vi.fn(async () => ({ ok: true, blob: async () => new Blob(['canonical brand']) }) as Response);
  const close = vi.fn();
  vi.stubGlobal('document', { fonts, createElement: vi.fn(() => canvas) });
  vi.stubGlobal('fetch', fetch);
  vi.stubGlobal('createImageBitmap', vi.fn(async () => ({ close })));
  vi.stubGlobal('crypto', { subtle: { digest: vi.fn(async (_algorithm, data) => new Uint8Array(createHash('sha256').update(data).digest()).buffer) } });
  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:pattern-brand');
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
  return { context, canvas, painted, fonts, fetch, close, encodedSizes };
}
beforeEach(() => { transport.download.mockReset().mockReturnValue('downloaded'); });
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('selected pattern image facts and ownership', () => {
  it.each((['grand-trine', 't-square', 'grand-cross', 'kite'] as const).flatMap((kind) =>
    (['natal', 'composite'] as const).map((context) => [kind, context] as const)))('paints complete %s facts in %s context', async (kind, context) => {
    const fixture = install(), card = selected(kind, context);
    const prepared = await prepareAspectPatternCard(card);
    const text = fixture.painted.map((row) => row.text).join(' ').replace(/\s+/gu, ' ');
    expect(text).toContain(card.title); expect(text).toContain(card.reading); expect(text).toContain(card.scope);
    card.receipt.forEach((receipt) => expect(text).toContain(receipt));
    card.points.forEach((point) => expect(text).toContain(`${point.body} · ${point.lon}°`));
    expect(text).toContain('Zodiacs.org'); expect(text).not.toContain('private-source');
    expect(fixture.context.drawImage).toHaveBeenCalledOnce(); expect(fixture.close).toHaveBeenCalledOnce();
    expect(fixture.encodedSizes).toEqual([[1080, 1350]]); expect(fixture.canvas.width).toBe(0);
    expect(prepared.filename).toMatch(new RegExp(`^zodiacs-${context}-${kind}-[a-f0-9]{16}\\.png$`));
    expect(prepared.blob.type).toBe('image/png');
    expect(fixture.painted.filter((row) => row.y > 590 && row.text !== 'Zodiacs.org').every((row) => row.y <= 1224)).toBe(true);
  });

  it('draws T-square chords at true positions, independently of the collision labels', async () => {
    const fixture = install(); await prepareAspectPatternCard(selected('t-square'));
    const starts = fixture.context.moveTo.mock.calls.slice(0, 3), ends = fixture.context.lineTo.mock.calls.slice(0, 3);
    expect(starts[0][0]).toBeCloseTo(60); expect(starts[0][1]).toBeCloseTo(200);
    expect(ends[0][0]).toBeCloseTo(200); expect(ends[0][1]).toBeCloseTo(340);
    expect(starts[1][0]).toBeCloseTo(60); expect(ends[1][0]).toBeCloseTo(340);
    expect(starts[2][0]).toBeCloseTo(340); expect(ends[2][0]).toBeCloseTo(200);
  });

  it('hashes complete selected ownership without exposing it in the filename', async () => {
    install(); const card = selected();
    const first = await aspectPatternCardFilename(card);
    expect(await aspectPatternCardFilename({ ...card })).toBe(first);
    expect(await aspectPatternCardFilename({ ...card, identity: `${card.identity}:source-revised` })).not.toBe(first);
    expect(await aspectPatternCardFilename(selected('t-square'))).not.toBe(first);
    expect(await aspectPatternCardFilename(selected('grand-cross', 'composite'))).not.toBe(first);
    expect(first).not.toContain('Mercury'); expect(first).not.toContain('private-source');
  });
});

describe('finite preparation and resource release', () => {
  it('retries the same image after a brand failure without a poisoned cache', async () => {
    const fixture = install(); fixture.fetch.mockRejectedValueOnce(new Error('offline'));
    await expect(prepareAspectPatternCard(selected())).rejects.toThrow('offline');
    await expect(prepareAspectPatternCard(selected())).resolves.toMatchObject({ filename: expect.stringContaining('grand-cross') });
    expect(fixture.fetch).toHaveBeenCalledTimes(2);
  });
  it.each(['fonts', 'headers', 'body', 'bitmap', 'PNG'] as const)('bounds stalled %s to one total fifteen-second window', async (stage) => {
    vi.useFakeTimers(); const fixture = install();
    let complete!: (value: any) => void;
    const held = new Promise<any>((resolve) => { complete = resolve; });
    if (stage === 'fonts') fixture.fonts.load.mockReturnValueOnce(held);
    if (stage === 'headers') fixture.fetch.mockReturnValueOnce(held);
    if (stage === 'body') fixture.fetch.mockResolvedValueOnce({ ok: true, blob: () => held } as Response);
    if (stage === 'bitmap') vi.mocked(createImageBitmap).mockReturnValueOnce(held);
    if (stage === 'PNG') fixture.canvas.toBlob.mockImplementationOnce((callback) => { complete = callback; });
    const failure = prepareAspectPatternCard(selected()).catch((cause) => cause);
    await vi.advanceTimersByTimeAsync(15_000);
    expect((await failure).message).toBe('pattern_prepare_timeout');
    expect(vi.getTimerCount()).toBe(0); expect(fixture.canvas.width).toBe(0);
    if (stage === 'PNG') expect(fixture.close).toHaveBeenCalledOnce();
    const writes = fixture.painted.length;
    if (stage === 'bitmap') { const lateClose = vi.fn(); complete({ close: lateClose }); await vi.advanceTimersByTimeAsync(0); expect(lateClose).toHaveBeenCalledOnce(); }
    else if (stage === 'fonts') complete([{ status: 'loaded' }]);
    else if (stage === 'headers') complete(new Response(new Blob(['late'])));
    else complete(new Blob(['late']));
    await vi.advanceTimersByTimeAsync(0); expect(fixture.painted).toHaveLength(writes);
  });
  it('revokes a stalled WebKit image URL and releases its handlers on abort', async () => {
    vi.useFakeTimers(); install(); vi.stubGlobal('createImageBitmap', undefined);
    const images: { src: string; onload: unknown; onerror: unknown }[] = [];
    vi.stubGlobal('Image', class { src = ''; onload = null; onerror = null; constructor() { images.push(this); } });
    const failure = prepareAspectPatternCard(selected()).catch((cause) => cause);
    await vi.advanceTimersByTimeAsync(15_000);
    expect((await failure).message).toBe('pattern_prepare_timeout');
    expect(URL.revokeObjectURL).toHaveBeenCalledExactlyOnceWith('blob:pattern-brand');
    expect(images[0]).toMatchObject({ src: '', onload: null, onerror: null });
    expect(vi.getTimerCount()).toBe(0);
  });
  it('honors parent revocation before fetching or painting', async () => {
    const fixture = install(), controller = new AbortController(); controller.abort(new Error('source replaced'));
    await expect(prepareAspectPatternCard(selected(), controller.signal)).rejects.toThrow('source replaced');
    expect(fixture.fetch).not.toHaveBeenCalled(); expect(fixture.canvas.toBlob).not.toHaveBeenCalled();
  });
  it('fails unpaintable text and releases brand ownership', async () => {
    const fixture = install(); fixture.context.measureText.mockReturnValue({ width: 5000 });
    await expect(prepareAspectPatternCard(selected())).rejects.toThrow('pattern_text_overflow');
    expect(fixture.close).toHaveBeenCalledOnce(); expect(fixture.canvas.toBlob).not.toHaveBeenCalled();
  });
  it('fails unavailable fonts without painting a substitute', async () => {
    const fixture = install(); fixture.fonts.load.mockResolvedValueOnce([]);
    await expect(prepareAspectPatternCard(selected())).rejects.toThrow('pattern_fonts_unavailable');
    expect(fixture.fetch).not.toHaveBeenCalled();
  });
});

describe('prepared native transport with revocation', () => {
  const file = { blob: new Blob(['prepared'], { type: 'image/png' }), filename: 'pattern.png' };
  it('uses the shared explicit download transport', () => { expect(downloadAspectPatternCard).toBe(transport.download); });
  it('invokes native share synchronously in the click turn', async () => {
    const share = vi.fn().mockResolvedValue(undefined); vi.stubGlobal('navigator', { canShare: () => true, share });
    const pending = shareAspectPatternCard(file, () => true);
    expect(share).toHaveBeenCalledOnce(); await expect(pending).resolves.toBe('shared');
    expect(transport.download).not.toHaveBeenCalled();
  });
  it('keeps native cancellation neutral', async () => {
    vi.stubGlobal('navigator', { canShare: () => true, share: () => Promise.reject(new DOMException('cancelled', 'AbortError')) });
    await expect(shareAspectPatternCard(file, () => true)).resolves.toBe('cancelled');
    expect(transport.download).not.toHaveBeenCalled();
  });
  it.each(['unsupported', 'rejected'])('uses the existing download fallback when native share is %s', async (condition) => {
    vi.stubGlobal('navigator', { canShare: () => condition !== 'unsupported', share: () => Promise.reject(new Error('unavailable')) });
    await expect(shareAspectPatternCard(file, () => true)).resolves.toBe('downloaded');
    expect(transport.download).toHaveBeenCalledExactlyOnceWith(file);
  });
  it('never downloads an old file after a pending native share rejects', async () => {
    let reject!: (cause: unknown) => void, current = true;
    vi.stubGlobal('navigator', { canShare: () => true, share: () => new Promise((_resolve, fail) => { reject = fail; }) });
    const pending = shareAspectPatternCard(file, () => current);
    current = false; reject(new Error('share unavailable'));
    await expect(pending).resolves.toBe('cancelled'); expect(transport.download).not.toHaveBeenCalled();
  });
});
