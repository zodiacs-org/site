import { afterEach, describe, expect, it, vi } from "vitest";
import {
  PORTRAIT_SHARE_CARD_BRAND_LAYOUT,
  SHARE_CARD_BRAND_INK,
  SHARE_CARD_BRAND_NAME_INK,
  SHARE_CARD_BRAND_TLD_INK,
  SHARE_CARD_BRAND_TYPE_SCALE,
  SHARE_CARD_BRAND_WORDMARK,
  drawShareBrandLockup,
  loadShareBrandIcon,
  prepareShareBrandLockup,
  withShareBrandIcon,
} from "./share-card-brand";
import { TILTED_RING_DOTS, tiltedRingDots } from "./brand-lockup.mjs";

afterEach(() => {
  vi.unstubAllGlobals();
});

/** A canvas context that records text and dots; every letter measures `letter` px. */
function canvasHarness({ letterSpacing = true, letter = 10 } = {}) {
  const painted: Array<Record<string, unknown>> = [];
  const arcs: Array<{ x: number; y: number; r: number; fill: unknown; alpha: unknown }> = [];
  const context: Record<string, unknown> = {
    arc: vi.fn((x: number, y: number, r: number) => arcs.push({ x, y, r, fill: context.fillStyle, alpha: context.globalAlpha })),
    beginPath: vi.fn(),
    drawImage: vi.fn(),
    fill: vi.fn(),
    fillText: vi.fn((text: string, x: number, y: number) => painted.push({
      text,
      x,
      y,
      fillStyle: context.fillStyle,
      font: context.font,
      letterSpacing: context.letterSpacing,
      textAlign: context.textAlign,
      textBaseline: context.textBaseline,
    })),
    measureText: vi.fn((text: string) => ({ width: [...text].length * letter })),
    restore: vi.fn(),
    save: vi.fn(),
    fillStyle: "initial",
    font: "initial",
    globalAlpha: 1,
    textAlign: "right",
    textBaseline: "middle",
  };
  if (letterSpacing) context.letterSpacing = "0px";
  return { context: context as unknown as CanvasRenderingContext2D, raw: context, painted, arcs };
}

describe("export lockup preparation", () => {
  it("fetches nothing: the lockup draws no image", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    await expect(loadShareBrandIcon()).resolves.toBeNull();
    const render = vi.fn((icon: unknown) => icon);
    await expect(withShareBrandIcon(render)).resolves.toBeNull();
    expect(render).toHaveBeenCalledWith(null);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("loads the lockup's regular and medium faces before a card paints, and never throws", async () => {
    const load = vi.fn(async () => []);
    vi.stubGlobal("document", { fonts: { load } });
    await prepareShareBrandLockup();
    expect(load).toHaveBeenCalledWith('400 20px "EB Garamond", Georgia, serif');
    expect(load).toHaveBeenCalledWith('500 20px "EB Garamond", Georgia, serif');
    vi.stubGlobal("document", { fonts: { load: vi.fn(async () => { throw new Error("offline"); }) } });
    await expect(prepareShareBrandLockup()).resolves.toBeUndefined();
  });
});

describe("approved export lockup", () => {
  it("pins the tilted ring and ZODIACS · ORG inside the portrait frame's safe area", () => {
    expect(SHARE_CARD_BRAND_WORDMARK).toBe("ZODIACS · ORG");
    expect(PORTRAIT_SHARE_CARD_BRAND_LAYOUT.wordmarkX).toBe(1014);
    expect(PORTRAIT_SHARE_CARD_BRAND_LAYOUT.centerY).toBe(1290);
    expect(PORTRAIT_SHARE_CARD_BRAND_LAYOUT.fontSize * SHARE_CARD_BRAND_TYPE_SCALE).toBe(20);
    // The ring is 2.625 times the type size wide and 4/7 as tall: 52.5 by 30 at 20px.
    expect(PORTRAIT_SHARE_CARD_BRAND_LAYOUT.centerY + (20 * 2.625 * 4) / 7 / 2).toBeLessThan(1321.5);
  });

  it("draws the ring, then the capitals at 0.2em tracking, the dot muted and centred, ORG dimmer, ending at wordmarkX", () => {
    const harness = canvasHarness();
    drawShareBrandLockup(harness.context, null, PORTRAIT_SHARE_CARD_BRAND_LAYOUT);
    expect(harness.raw.save).toHaveBeenCalled();
    expect(harness.raw.restore).toHaveBeenCalled();
    expect(harness.raw.drawImage).not.toHaveBeenCalled();

    // Each letter measures 10px; tracking is 4px (0.2em of 20px); the dot has 4px either side.
    const name = 7 * 10 + 7 * 4;
    const dot = 10 + 4;
    const tld = 3 * 10 + 3 * 4;
    const words = name + 4 + dot + 4 + tld - 4;
    const start = 1014 - words;
    expect(harness.painted.map(({ text, x, fillStyle, letterSpacing, textAlign, textBaseline }) => ({ text, x, fillStyle, letterSpacing, textAlign, textBaseline }))).toEqual([
      { text: "ZODIACS", x: start, fillStyle: SHARE_CARD_BRAND_NAME_INK, letterSpacing: "4px", textAlign: "left", textBaseline: "alphabetic" },
      { text: "·", x: start + name + 4, fillStyle: SHARE_CARD_BRAND_INK, letterSpacing: "4px", textAlign: "left", textBaseline: "alphabetic" },
      { text: "ORG", x: start + name + 4 + dot + 4, fillStyle: SHARE_CARD_BRAND_TLD_INK, letterSpacing: "4px", textAlign: "left", textBaseline: "alphabetic" },
    ]);
    expect(String(harness.painted[0]?.font)).toBe('400 20px "EB Garamond", Georgia, serif');
    expect(String(harness.painted[2]?.font)).toBe('500 20px "EB Garamond", Georgia, serif');
    // The capitals centre on centerY: the baseline sits half a cap height (0.65em) below it.
    expect(harness.painted.every(({ y }) => y === 1290 + 6.5)).toBe(true);

    // Twelve dots, back to front, in a ring 52.5px wide that ends 15px (0.75em) before the words and centres on centerY.
    expect(harness.arcs).toHaveLength(12);
    const scale = 52.5 / 28;
    const left = start - 15 - 52.5;
    const top = 1290 - 30 / 2;
    harness.arcs.forEach((arc, index) => {
      const dotSpec = TILTED_RING_DOTS[index];
      expect(arc.x).toBeCloseTo(left + (dotSpec.cx + 2) * scale, 6);
      expect(arc.y).toBeCloseTo(top + (dotSpec.cy - 4) * scale, 6);
      expect(arc.r).toBeCloseTo(dotSpec.r * scale, 6);
      expect(arc.fill).toBe(dotSpec.fill);
      expect(arc.alpha).toBe(dotSpec.opacity);
    });
  });

  it("spaces the letters itself where the canvas cannot", () => {
    const harness = canvasHarness({ letterSpacing: false });
    drawShareBrandLockup(harness.context, null, PORTRAIT_SHARE_CARD_BRAND_LAYOUT);
    expect(harness.painted.map(({ text }) => text).join("")).toBe("ZODIACS·ORG");
    const xs = harness.painted.slice(0, 7).map(({ x }) => x as number);
    expect(xs.slice(1).map((x, index) => x - xs[index])).toEqual([14, 14, 14, 14, 14, 14]);
  });

  it("turns the ring to a person's sign when the card passes one, and only the inks move", () => {
    const own = canvasHarness();
    drawShareBrandLockup(own.context, null, PORTRAIT_SHARE_CARD_BRAND_LAYOUT);
    const turned = canvasHarness();
    drawShareBrandLockup(turned.context, null, { ...PORTRAIT_SHARE_CARD_BRAND_LAYOUT, front: "cancer" });
    const front = turned.arcs.at(-1);
    expect(front?.fill).toBe(tiltedRingDots("cancer").at(-1)?.fill);
    expect(front?.fill).toBe("#4A8FBD");
    expect(front?.alpha).toBe(1);
    expect(turned.arcs.map(({ x, y, r, alpha }) => ({ x, y, r, alpha }))).toEqual(own.arcs.map(({ x, y, r, alpha }) => ({ x, y, r, alpha })));
    expect(turned.painted).toEqual(own.painted);
    const unknown = canvasHarness();
    drawShareBrandLockup(unknown.context, null, { ...PORTRAIT_SHARE_CARD_BRAND_LAYOUT, front: null });
    expect(unknown.arcs).toEqual(own.arcs);
  });

  it("never paints the old sentence-case wordmark", () => {
    const harness = canvasHarness();
    drawShareBrandLockup(harness.context, null, PORTRAIT_SHARE_CARD_BRAND_LAYOUT);
    expect(harness.painted.map(({ text }) => text)).not.toContain("Zodiacs.org");
  });
});
