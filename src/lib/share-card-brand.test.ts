import { afterEach, describe, expect, it, vi } from "vitest";
import {
  PORTRAIT_SHARE_CARD_BRAND_LAYOUT,
  SHARE_CARD_BRAND_INK,
  SHARE_CARD_BRAND_WORDMARK,
  drawShareBrandLockup,
  loadShareBrandIcon,
  loadShareCardImage,
  withShareBrandIcon,
} from "./share-card-brand";

afterEach(() => {
  vi.unstubAllGlobals();
});

function canvasHarness(wordmarkWidth = 96) {
  const painted: Array<Record<string, unknown>> = [];
  const context = {
    drawImage: vi.fn(),
    fillText: vi.fn((text: string, x: number, y: number) => painted.push({
      text,
      x,
      y,
      fillStyle: context.fillStyle,
      font: context.font,
      textAlign: context.textAlign,
      textBaseline: context.textBaseline,
    })),
    measureText: vi.fn(() => ({ width: wordmarkWidth })),
    restore: vi.fn(),
    save: vi.fn(),
    fillStyle: "initial",
    font: "initial",
    imageSmoothingEnabled: false,
    imageSmoothingQuality: "low",
    textAlign: "left",
    textBaseline: "alphabetic",
  };
  return {
    context: context as unknown as CanvasRenderingContext2D,
    raw: context,
    painted,
  };
}

/** Image elements that record their address and decode as `decode` says. */
function stubImages(decode: () => Promise<void> = async () => {}) {
  const images: Array<{ src: string }> = [];
  vi.stubGlobal("Image", class {
    src = "";

    constructor() {
      images.push(this);
    }

    decode() {
      return decode();
    }
  });
  return images;
}

describe("share-card brand asset", () => {
  it("loads the canonical profile image as a bitmap of a decoded image element", async () => {
    const images = stubImages();
    const bitmap = { close: vi.fn() };
    const fetch = vi.fn();
    const createImageBitmap = vi.fn(async () => bitmap);
    vi.stubGlobal("fetch", fetch);
    vi.stubGlobal("createImageBitmap", createImageBitmap);

    await expect(loadShareBrandIcon()).resolves.toBe(bitmap);
    expect(images.map(({ src }) => src)).toEqual(["/assets/app-icons/v3/icon-512.png"]);
    expect(createImageBitmap).toHaveBeenCalledWith(images[0]);
    // A page left while a card is prepared makes WebKit report a refused
    // fetch or Blob read as a page error; an image element's load only fails.
    expect(fetch).not.toHaveBeenCalled();
  });

  it("falls back to the image element when WebKit cannot make a bitmap of it", async () => {
    const images = stubImages();
    vi.stubGlobal("createImageBitmap", vi.fn(async () => {
      throw new Error("decode failed");
    }));

    await expect(loadShareBrandIcon()).resolves.toBe(images[0]);
  });

  it("returns null without throwing when the canonical asset is unavailable", async () => {
    stubImages(async () => {
      throw new DOMException("The source image cannot be decoded.", "EncodingError");
    });
    const createImageBitmap = vi.fn();
    vi.stubGlobal("createImageBitmap", createImageBitmap);

    await expect(loadShareBrandIcon()).resolves.toBeNull();
    expect(createImageBitmap).not.toHaveBeenCalled();
  });

  it("returns null where there is no image element", async () => {
    expect(typeof Image).toBe("undefined");
    await expect(loadShareCardImage("/assets/zodiac-icons/128/leo.webp")).resolves.toBeNull();
  });

  it("closes a decoded bitmap when the renderer throws", async () => {
    const close = vi.fn();
    stubImages();
    vi.stubGlobal("createImageBitmap", vi.fn(async () => ({ close })));

    await expect(withShareBrandIcon(() => {
      throw new Error("paint failed");
    })).rejects.toThrow("paint failed");
    expect(close).toHaveBeenCalledOnce();
  });
});

describe("approved export lockup", () => {
  it("pins a 2:1 icon/type lockup inside the portrait frame safe area", () => {
    expect(SHARE_CARD_BRAND_WORDMARK).toBe("Zodiacs.org");
    expect(PORTRAIT_SHARE_CARD_BRAND_LAYOUT.iconSize)
      .toBe(PORTRAIT_SHARE_CARD_BRAND_LAYOUT.fontSize * 2);
    expect(PORTRAIT_SHARE_CARD_BRAND_LAYOUT.gap).toBe(0);
    expect(PORTRAIT_SHARE_CARD_BRAND_LAYOUT.wordmarkX).toBe(1014);
    expect(PORTRAIT_SHARE_CARD_BRAND_LAYOUT.centerY).toBe(1290);
    expect(
      PORTRAIT_SHARE_CARD_BRAND_LAYOUT.centerY
      + PORTRAIT_SHARE_CARD_BRAND_LAYOUT.iconSize / 2,
    ).toBeLessThan(1321.5);
  });

  it("draws the profile image attached to the lowercase Garamond wordmark", () => {
    const harness = canvasHarness();
    const icon = {} as CanvasImageSource;
    drawShareBrandLockup(harness.context, icon, PORTRAIT_SHARE_CARD_BRAND_LAYOUT);

    expect(harness.raw.save).toHaveBeenCalledOnce();
    expect(harness.raw.restore).toHaveBeenCalledOnce();
    expect(harness.raw.drawImage).toHaveBeenCalledWith(icon, 874, 1268, 44, 44);
    expect(harness.painted).toEqual([expect.objectContaining({
      text: "Zodiacs.org",
      x: 1014,
      y: 1290,
      fillStyle: SHARE_CARD_BRAND_INK,
      textAlign: "right",
      textBaseline: "middle",
    })]);
    expect(String(harness.painted[0]?.font)).toContain('22px "EB Garamond"');
  });

  it("keeps the wordmark when an engine cannot load the profile image", () => {
    const harness = canvasHarness();
    drawShareBrandLockup(harness.context, null, PORTRAIT_SHARE_CARD_BRAND_LAYOUT);
    expect(harness.raw.drawImage).not.toHaveBeenCalled();
    expect(harness.painted.map(({ text }) => text)).toEqual(["Zodiacs.org"]);
  });
});
