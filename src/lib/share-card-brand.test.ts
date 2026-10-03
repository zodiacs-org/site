import { afterEach, describe, expect, it, vi } from "vitest";
import {
  PORTRAIT_SHARE_CARD_BRAND_LAYOUT,
  SHARE_CARD_BRAND_INK,
  SHARE_CARD_BRAND_WORDMARK,
  drawShareBrandLockup,
  loadShareBrandIcon,
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

describe("share-card brand asset", () => {
  it("loads the canonical profile image as a bitmap", async () => {
    const blob = new Blob(["brand"], { type: "image/png" });
    const bitmap = { close: vi.fn() };
    const fetch = vi.fn(async () => ({ ok: true, blob: async () => blob }));
    const createImageBitmap = vi.fn(async () => bitmap);
    vi.stubGlobal("fetch", fetch);
    vi.stubGlobal("createImageBitmap", createImageBitmap);

    await expect(loadShareBrandIcon()).resolves.toBe(bitmap);
    expect(fetch).toHaveBeenCalledWith("/assets/app-icons/v3/icon-512.png");
    expect(createImageBitmap).toHaveBeenCalledWith(blob);
  });

  it("falls back to an image element when WebKit cannot bitmap-decode the PNG", async () => {
    const revokeObjectURL = vi.fn();
    vi.stubGlobal("URL", {
      createObjectURL: vi.fn(() => "blob:brand"),
      revokeObjectURL,
    });
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: true,
      blob: async () => new Blob(["brand"], { type: "image/png" }),
    })));
    vi.stubGlobal("createImageBitmap", vi.fn(async () => {
      throw new Error("decode failed");
    }));
    const images: Array<{ src: string }> = [];
    vi.stubGlobal("Image", class {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      private value = "";

      set src(value: string) {
        this.value = value;
        images.push(this);
        queueMicrotask(() => this.onload?.());
      }

      get src(): string {
        return this.value;
      }
    });

    const icon = await loadShareBrandIcon();
    expect(icon).toBe(images[0]);
    expect(images[0]?.src).toBe("blob:brand");
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:brand");
  });

  it("returns null without throwing when the canonical asset is unavailable", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false })));
    await expect(loadShareBrandIcon()).resolves.toBeNull();
  });

  it("closes a decoded bitmap when the renderer throws", async () => {
    const close = vi.fn();
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: true,
      blob: async () => new Blob(["brand"], { type: "image/png" }),
    })));
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
