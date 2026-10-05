import { afterEach, describe, expect, it, vi } from "vitest";
import {
  AURA_SHARE_FILENAME,
  AURA_SHARE_LAYOUT,
  auraShareAccessibleDescription,
  auraShareSnapshot,
  canShareAuraCardBlob,
  downloadAuraCardBlob,
  drawAuraShareCard,
  shareAuraCardBlob,
  type AuraShareCardInput,
} from "./aura-share-card";

const input: AuraShareCardInput = {
  heldSigns: ["leo", "aries", "cancer", "aries"],
  holdings: [
    { sign: "aries", finish: "pastel" },
    { sign: "cancer", finish: "silver" },
    { sign: "leo", finish: "gold", goldCount: "3" },
  ],
  checkedAt: "2026-07-16T04:00:00.000Z",
  skyAt: "2026-07-16T04:05:00.000Z",
  currentSky: { sun: "leo", moon: "cancer" },
};

interface CanvasHarness {
  painted: Array<{
    text: string;
    font: string;
    fillStyle: string;
    textAlign: string;
    textBaseline: string;
    x: number;
    y: number;
  }>;
  canvas: { width: number; height: number };
  context: Record<string, unknown>;
  fetch: ReturnType<typeof vi.fn>;
  decodedIcons: Array<{ close: ReturnType<typeof vi.fn> }>;
  fallbackImages: Array<{ src: string }>;
  share: ReturnType<typeof vi.fn>;
  anchor: {
    href: string;
    download: string;
    click: ReturnType<typeof vi.fn>;
    remove: ReturnType<typeof vi.fn>;
  };
  appendChild: ReturnType<typeof vi.fn>;
  revokeObjectURL: ReturnType<typeof vi.fn>;
}

function installCanvas(
  options: {
    encode?: boolean;
    canShare?: boolean;
    icons?: boolean;
    missingIcon?: string;
    context?: boolean;
    brandBitmap?: boolean;
  } = {},
): CanvasHarness {
  const painted: CanvasHarness["painted"] = [];
  const context = {
    arc: vi.fn(),
    beginPath: vi.fn(),
    drawImage: vi.fn(),
    fill: vi.fn(),
    fillRect: vi.fn(),
    fillText: vi.fn((text: string, x: number, y: number) => painted.push({
      text,
      font: context.font,
      fillStyle: context.fillStyle,
      textAlign: context.textAlign,
      textBaseline: context.textBaseline,
      x,
      y,
    })),
    lineTo: vi.fn(),
    measureText: vi.fn((text: string) => ({ width: text.length * 14 })),
    moveTo: vi.fn(),
    roundRect: vi.fn(),
    save: vi.fn(),
    setLineDash: vi.fn(),
    stroke: vi.fn(),
    restore: vi.fn(),
    fillStyle: "",
    font: "",
    globalAlpha: 1,
    imageSmoothingEnabled: false,
    imageSmoothingQuality: "low",
    lineWidth: 1,
    strokeStyle: "",
    textAlign: "left",
    textBaseline: "middle",
  };
  const canvas = {
    width: 0,
    height: 0,
    getContext: vi.fn(() => (options.context === false ? null : context)),
    toBlob: vi.fn((callback: (blob: Blob | null) => void) =>
      callback(options.encode === false ? null : new Blob(["png"], { type: "image/png" })),
    ),
  };
  const anchor = {
    href: "",
    download: "",
    click: vi.fn(),
    remove: vi.fn(),
  };
  const appendChild = vi.fn();
  vi.stubGlobal("document", {
    fonts: {
      ready: Promise.resolve(),
      load: vi.fn(() => Promise.resolve()),
    },
    createElement: vi.fn((tag: string) => (tag === "canvas" ? canvas : anchor)),
    body: { appendChild },
  });
  const share = vi.fn(() => Promise.resolve());
  vi.stubGlobal("navigator", {
    canShare: vi.fn(() => options.canShare !== false),
    share,
  });
  const revokeObjectURL = vi.fn();
  vi.stubGlobal("URL", {
    createObjectURL: vi.fn(() => "blob:talisman-preview"),
    revokeObjectURL,
  });
  const fetch = vi.fn(async (path: string) => ({
    ok: options.icons !== false && !path.endsWith(`/${options.missingIcon}.webp`),
    blob: async () => new Blob(
      ["official-zodiac-icon"],
      { type: path.endsWith(".png") ? "image/png" : "image/webp" },
    ),
  }));
  const decodedIcons: Array<{ close: ReturnType<typeof vi.fn> }> = [];
  const fallbackImages: Array<{ src: string }> = [];
  vi.stubGlobal("fetch", fetch);
  vi.stubGlobal("createImageBitmap", vi.fn(async (blob: Blob) => {
    if (options.brandBitmap === false && blob.type === "image/png") {
      throw new Error("bitmap_decode_failed");
    }
    const bitmap = { close: vi.fn() };
    decodedIcons.push(bitmap);
    return bitmap;
  }));
  vi.stubGlobal("Image", class {
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    private value = "";

    set src(value: string) {
      this.value = value;
      fallbackImages.push(this);
      queueMicrotask(() => this.onload?.());
    }

    get src(): string {
      return this.value;
    }
  });
  return {
    painted,
    canvas,
    context,
    fetch,
    decodedIcons,
    fallbackImages,
    share,
    anchor,
    appendChild,
    revokeObjectURL,
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Registry Aura collection talisman snapshot", () => {
  it("canonicalizes the represented set and produces deterministic seal geometry", () => {
    const first = auraShareSnapshot(input);
    const second = auraShareSnapshot({
      ...input,
      heldSigns: ["cancer", "aries", "leo"],
    });

    expect(first).toEqual(second);
    expect({
      represented: first.represented.map((sign) => sign.slug),
      editions: first.represented.map((sign) => (
        `${sign.slug}:${sign.finish}${sign.goldCountLabel ?? ""}`
      )),
      mode: first.geometry.collectionMode,
      closed: first.geometry.closed,
      fullTwelve: first.geometry.fullTwelve,
      segments: first.geometry.collectionSegments.map((segment) =>
        `${segment.fromSign}-${segment.toSign}`,
      ),
      sky: first.skyMarks.map((mark) => ({
        body: mark.body,
        sign: mark.sign.slug,
        x: mark.x,
        y: mark.y,
      })),
    }).toMatchInlineSnapshot(`
      {
        "closed": true,
        "editions": [
          "aries:pastel",
          "cancer:silver",
          "leo:gold×3",
        ],
        "fullTwelve": false,
        "mode": "polygon",
        "represented": [
          "aries",
          "cancer",
          "leo",
        ],
        "segments": [
          "aries-cancer",
          "cancer-leo",
          "leo-aries",
        ],
        "sky": [
          {
            "body": "Sun",
            "sign": "leo",
            "x": 0.66617,
            "y": 0.66617,
          },
          {
            "body": "Moon",
            "sign": "cancer",
            "x": 0.726993,
            "y": 0.560822,
          },
        ],
      }
    `);
    expect(first.checkedDate).toBe("Jul 16, 2026 UTC");
    expect(first.skyDate).toBe("Jul 16, 2026 UTC");
  });

  it("exposes only the collection, visit dates, and public sky facts", () => {
    expect(Object.keys(input).sort()).toEqual([
      "checkedAt",
      "currentSky",
      "heldSigns",
      "holdings",
      "skyAt",
    ]);
    const serialized = JSON.stringify(auraShareSnapshot(input));
    expect(serialized).toContain("aries");
    expect(serialized).toContain("leo");
    expect(serialized).not.toMatch(/address|wallet|balance|price|birth|name of owner/i);
  });

  it("separates Sun and Moon marks at an exact conjunction", () => {
    const snapshot = auraShareSnapshot({
      ...input,
      currentSky: { sun: "leo", moon: "leo" },
    });
    const [sun, moon] = snapshot.skyMarks;
    expect([sun.sign.slug, moon.sign.slug]).toEqual(["leo", "leo"]);
    expect(Math.hypot(moon.x - sun.x, moon.y - sun.y)).toBeGreaterThanOrEqual(0.104);
  });

  it("shows exact Gold counts through ninety-nine and caps larger public tallies", () => {
    const exact = auraShareSnapshot({
      ...input,
      holdings: input.holdings?.map((holding) => (
        holding.sign === "leo"
          ? { sign: "leo", finish: "gold" as const, goldCount: "2" }
          : holding
      )),
    }).represented.find((sign) => sign.slug === "leo")!;
    const capped = auraShareSnapshot({
      ...input,
      holdings: input.holdings?.map((holding) => (
        holding.sign === "leo"
          ? { sign: "leo", finish: "gold" as const, goldCount: "470" }
          : holding
      )),
    }).represented.find((sign) => sign.slug === "leo")!;

    expect(exact).toMatchObject({ goldCountLabel: "×2", goldTallyArcs: 1, edition: "gold" });
    expect(capped).toMatchObject({ goldCountLabel: "×99+", goldTallyArcs: 2, edition: "crown" });
  });

  it("ignores runtime extra fields so private data cannot reach the snapshot", () => {
    const poisoned = {
      ...input,
      address: "0xPRIVATE",
      chart: { name: "Alex", birthDate: "1989-12-20", rising: "pisces" },
      quantity: 999,
      prices: ["$1,000"],
      url: "https://private.invalid/chart",
      unrelatedHoldings: ["secret-token"],
    } as AuraShareCardInput & Record<string, unknown>;
    expect(auraShareSnapshot(poisoned)).toEqual(auraShareSnapshot(input));
    const serialized = JSON.stringify(auraShareSnapshot(poisoned));
    for (const forbidden of [
      "0xPRIVATE",
      "Alex",
      "1989-12-20",
      "$1,000",
      "private.invalid",
      "secret-token",
    ]) {
      expect(serialized).not.toContain(forbidden);
    }
  });

  it("rejects empty, malformed, noncanonical, and undated inputs", () => {
    expect(() => auraShareSnapshot({ ...input, heldSigns: [] })).toThrow(
      /at least one represented sign/i,
    );
    expect(() =>
      auraShareSnapshot({ ...input, heldSigns: "aries" as never }),
    ).toThrow(/array/i);
    expect(() =>
      auraShareSnapshot({ ...input, heldSigns: ["ophiuchus" as "aries"] }),
    ).toThrow(/canonical zodiac/i);
    expect(() => auraShareSnapshot({ ...input, checkedAt: "Jul 16, 2026" })).toThrow(
      /ISO date/i,
    );
    expect(() => auraShareSnapshot({ ...input, skyAt: "not-a-date" })).toThrow(
      /ISO date/i,
    );
    expect(() =>
      auraShareSnapshot({
        ...input,
        currentSky: { sun: "ophiuchus" as "leo", moon: "cancer" },
      }),
    ).toThrow(/canonical zodiac/i);
  });

  it("provides a complete privacy-safe text equivalent without a URL", () => {
    const description = auraShareAccessibleDescription(input);
    for (const required of [
      "Cabinet of Twelve collection seal dated Jul 16, 2026 UTC",
      "Represented Zodiac set: Aries, pastel; Cancer, silver; Leo, gold ×3",
      "Sun in Leo; Moon in Cancer",
      "Your collection, set against today’s sky",
      "Public edition · collection + dated sky",
      "Registry record checked Jul 16, 2026 UTC",
      "zodiacs.org",
    ]) {
      expect(description).toContain(required);
    }
    expect(description).not.toMatch(/https?:|zodiacs\.org\//i);
  });
});

describe("Registry Aura talisman PNG", () => {
  it("paints a 1080×1350 collection seal, represented set, method, and wordmark", async () => {
    const harness = installCanvas();
    const blob = await drawAuraShareCard(input);
    expect(blob.type).toBe("image/png");
    expect(harness.canvas).toMatchObject({ width: 1080, height: 1350 });
    const text = harness.painted.map((entry) => entry.text).join(" ");
    for (const required of [
      "THE CABINET OF TWELVE",
      "PUBLIC EDITION",
      "Collection seal",
      "3 / 12",
      "SIGNS REPRESENTED",
      "JUL 16, 2026 UTC",
      "REPRESENTED ZODIACS",
      "ARIES",
      "CANCER",
      "LEO",
      "PASTEL",
      "SILVER",
      "GOLD · ×3",
      "Your collection, set against today’s sky.",
      "PUBLIC EDITION · COLLECTION + DATED SKY",
      "REGISTRY CHECKED JUL 16, 2026 UTC",
      "Zodiacs.org",
    ]) {
      expect(text).toContain(required);
    }
    expect(harness.context.lineTo).toHaveBeenCalled();
    expect(harness.context.arc).toHaveBeenCalled();
    expect(text).not.toMatch(/https?:|zodiacs\.org\//i);
  });

  it("keeps every two-row Crown ring clear of its labels, the next row, and divider", async () => {
    const outerRingRadius = AURA_SHARE_LAYOUT.representedRingRadius
      + AURA_SHARE_LAYOUT.representedMaxRingPadding;
    const firstCenter = AURA_SHARE_LAYOUT.representedTwoRowY;
    const secondCenter = firstCenter + AURA_SHARE_LAYOUT.representedRowGap;
    const firstNameTop = firstCenter
      + AURA_SHARE_LAYOUT.representedNameOffset
      - AURA_SHARE_LAYOUT.representedNameFontSize / 2;
    const firstNameBottom = firstCenter
      + AURA_SHARE_LAYOUT.representedNameOffset
      + AURA_SHARE_LAYOUT.representedNameFontSize / 2;
    const firstEditionTop = firstCenter
      + AURA_SHARE_LAYOUT.representedEditionOffset
      - AURA_SHARE_LAYOUT.representedEditionFontSize / 2;
    const firstEditionBottom = firstCenter
      + AURA_SHARE_LAYOUT.representedEditionOffset
      + AURA_SHARE_LAYOUT.representedEditionFontSize / 2;
    const secondNameTop = secondCenter
      + AURA_SHARE_LAYOUT.representedNameOffset
      - AURA_SHARE_LAYOUT.representedNameFontSize / 2;
    const secondEditionBottom = secondCenter
      + AURA_SHARE_LAYOUT.representedEditionOffset
      + AURA_SHARE_LAYOUT.representedEditionFontSize / 2;

    const headingBottom = AURA_SHARE_LAYOUT.representedHeadingY
      + AURA_SHARE_LAYOUT.representedHeadingFontSize / 2;

    expect((firstCenter - outerRingRadius) - headingBottom).toBeGreaterThanOrEqual(8);
    expect(firstNameTop - (firstCenter + outerRingRadius)).toBeGreaterThanOrEqual(8);
    expect(firstEditionTop - firstNameBottom).toBeGreaterThanOrEqual(5);
    expect((secondCenter - outerRingRadius) - firstEditionBottom).toBeGreaterThanOrEqual(8);
    expect(secondNameTop - (secondCenter + outerRingRadius)).toBeGreaterThanOrEqual(8);
    expect(AURA_SHARE_LAYOUT.representedDividerY - secondEditionBottom)
      .toBeGreaterThanOrEqual(8);

    const heldSigns = [
      "aries", "taurus", "gemini", "cancer", "leo", "virgo",
      "libra", "scorpio", "sagittarius", "capricorn", "aquarius", "pisces",
    ] as const;
    const harness = installCanvas();
    await drawAuraShareCard({
      ...input,
      heldSigns,
      holdings: heldSigns.map((sign) => ({
        sign,
        finish: "gold" as const,
        goldCount: "10",
      })),
    });

    expect(harness.painted.find(({ text }) => text === "ARIES")?.y)
      .toBe(firstCenter + AURA_SHARE_LAYOUT.representedNameOffset);
    expect(harness.painted.find(({ text }) => text === "LIBRA")?.y)
      .toBe(secondCenter + AURA_SHARE_LAYOUT.representedNameOffset);

    const heading = harness.painted.find(({ text }) => text === "REPRESENTED ZODIACS")!;
    const firstName = harness.painted.find(({ text }) => text === "ARIES")!;
    const secondName = harness.painted.find(({ text }) => text === "LIBRA")!;
    const firstEdition = harness.painted.find(({ text, y }) => (
      text === "CROWN · ×10" && y < secondCenter
    ))!;
    const secondEdition = harness.painted.find(({ text, y }) => (
      text === "CROWN · ×10" && y > secondCenter
    ))!;
    const arc = harness.context.arc as ReturnType<typeof vi.fn>;
    const moveTo = harness.context.moveTo as ReturnType<typeof vi.fn>;
    const lineTo = harness.context.lineTo as ReturnType<typeof vi.fn>;

    expect(arc).toHaveBeenCalledWith(
      expect.any(Number),
      firstCenter,
      outerRingRadius,
      0,
      Math.PI * 2,
    );
    expect(arc).toHaveBeenCalledWith(
      expect.any(Number),
      secondCenter,
      outerRingRadius,
      0,
      Math.PI * 2,
    );
    expect(firstEdition.y).toBe(firstCenter + AURA_SHARE_LAYOUT.representedEditionOffset);
    expect(secondEdition.y).toBe(secondCenter + AURA_SHARE_LAYOUT.representedEditionOffset);
    expect(moveTo).toHaveBeenCalledWith(66, AURA_SHARE_LAYOUT.representedDividerY);
    expect(lineTo).toHaveBeenCalledWith(1014, AURA_SHARE_LAYOUT.representedDividerY);

    const sealCrownArcs = arc.mock.calls.filter(([, y, radius]) => (
      radius === 42 && y < firstCenter
    ));
    const sealArtworkBottom = Math.max(
      ...sealCrownArcs.map(([, y, radius]) => Number(y) + Number(radius)),
    );
    expect(sealCrownArcs.length).toBe(12);
    expect(
      heading.y - AURA_SHARE_LAYOUT.representedHeadingFontSize / 2 - sealArtworkBottom,
    ).toBeGreaterThanOrEqual(8);
    expect(
      firstName.y - AURA_SHARE_LAYOUT.representedNameFontSize / 2
      - (firstCenter + outerRingRadius),
    ).toBeGreaterThanOrEqual(8);
    expect(
      secondName.y - AURA_SHARE_LAYOUT.representedNameFontSize / 2
      - (secondCenter + outerRingRadius),
    ).toBeGreaterThanOrEqual(8);
    expect(
      AURA_SHARE_LAYOUT.representedDividerY
      - (secondEdition.y + AURA_SHARE_LAYOUT.representedEditionFontSize / 2),
    ).toBeGreaterThanOrEqual(8);
  });

  it("draws the canonical SDK-derived pastel icons in the orbit and ledger", async () => {
    const harness = installCanvas({ icons: true });
    await drawAuraShareCard(input);

    expect(harness.fetch.mock.calls.map(([path]) => path)).toEqual([
      "/assets/zodiac-icons/128/aries.webp",
      "/assets/zodiac-icons/128/taurus.webp",
      "/assets/zodiac-icons/128/gemini.webp",
      "/assets/zodiac-icons/128/cancer.webp",
      "/assets/zodiac-icons/128/leo.webp",
      "/assets/zodiac-icons/128/virgo.webp",
      "/assets/zodiac-icons/128/libra.webp",
      "/assets/zodiac-icons/128/scorpio.webp",
      "/assets/zodiac-icons/128/sagittarius.webp",
      "/assets/zodiac-icons/128/capricorn.webp",
      "/assets/zodiac-icons/128/aquarius.webp",
      "/assets/zodiac-icons/128/pisces.webp",
      "/assets/app-icons/v3/icon-512.png",
    ]);
    expect(harness.context.drawImage).toHaveBeenCalledTimes(16);
    expect(harness.painted.filter(({ text }) => text.includes("×3"))).toHaveLength(1);
    const brand = harness.painted.find(({ text }) => text === "Zodiacs.org");
    expect(brand).toMatchObject({
      fillStyle: "#8E96AB",
      textAlign: "right",
      textBaseline: "middle",
      x: 1014,
      y: 1290,
    });
    expect(brand?.font).toContain('22px "EB Garamond"');
    expect(harness.context.drawImage).toHaveBeenLastCalledWith(
      harness.decodedIcons.at(-1),
      expect.any(Number),
      1268,
      44,
      44,
    );
    expect(harness.decodedIcons).toHaveLength(13);
    harness.decodedIcons.forEach((icon) => expect(icon.close).toHaveBeenCalledOnce());
  });

  it("fails cleanly instead of painting Unicode when canonical art is unavailable", async () => {
    const harness = installCanvas({ missingIcon: "libra" });
    await expect(drawAuraShareCard(input)).rejects.toThrow("zodiac_icon_unavailable:libra");
    expect(harness.painted).toEqual([]);
    expect(harness.decodedIcons).toHaveLength(11);
    harness.decodedIcons.forEach((icon) => expect(icon.close).toHaveBeenCalledOnce());
  });

  it("keeps the profile mark when WebKit cannot bitmap-decode the brand PNG", async () => {
    const harness = installCanvas({ brandBitmap: false });
    await drawAuraShareCard(input);

    expect(harness.fallbackImages).toHaveLength(1);
    expect(harness.context.drawImage).toHaveBeenCalledTimes(16);
    expect(harness.decodedIcons).toHaveLength(12);
    harness.decodedIcons.forEach((icon) => expect(icon.close).toHaveBeenCalledOnce());
  });

  it("cannot paint private or financial fields appended at runtime", async () => {
    const harness = installCanvas();
    await drawAuraShareCard({
      ...input,
      address: "0xPRIVATE",
      chartName: "Alex",
      birthDate: "1989-12-20",
      coordinates: "42.87, 74.59",
      quantities: [12],
      prices: ["$1,000"],
      url: "https://private.invalid/chart",
    } as AuraShareCardInput & Record<string, unknown>);
    const text = harness.painted.map((entry) => entry.text).join("\n");
    for (const forbidden of [
      "0xPRIVATE",
      "Alex",
      "1989-12-20",
      "42.87",
      "$1,000",
      "private.invalid",
    ]) {
      expect(text).not.toContain(forbidden);
    }
  });

  it("fails clearly when PNG encoding is unavailable", async () => {
    const harness = installCanvas({ encode: false });
    await expect(drawAuraShareCard(input)).rejects.toThrow("png_encode_failed");
    harness.decodedIcons.forEach((icon) => expect(icon.close).toHaveBeenCalledOnce());
  });

  it("releases canonical artwork when the canvas context is unavailable", async () => {
    const harness = installCanvas({ context: false });
    await expect(drawAuraShareCard(input)).rejects.toThrow("canvas_unavailable");
    expect(harness.decodedIcons).toHaveLength(13);
    harness.decodedIcons.forEach((icon) => expect(icon.close).toHaveBeenCalledOnce());
  });
});

describe("Registry Aura talisman share and download", () => {
  it("uses the required constant filename and shares only the reviewed PNG", async () => {
    const harness = installCanvas();
    const blob = await drawAuraShareCard(input);
    expect(AURA_SHARE_FILENAME).toBe("zodiacs-collection-seal.png");
    expect(canShareAuraCardBlob(blob)).toBe(true);
    await expect(shareAuraCardBlob(blob)).resolves.toBe("shared");
    const payload = harness.share.mock.calls[0][0] as ShareData;
    expect(Object.keys(payload)).toEqual(["files"]);
    expect(payload.files).toHaveLength(1);
    expect(payload.files?.[0].name).toBe(AURA_SHARE_FILENAME);
    expect(payload).not.toHaveProperty("text");
    expect(payload).not.toHaveProperty("title");
    expect(payload).not.toHaveProperty("url");
  });

  it("keeps unsupported native sharing on the explicit download path", async () => {
    const harness = installCanvas({ canShare: false });
    const blob = new Blob(["png"], { type: "image/png" });
    expect(canShareAuraCardBlob(blob)).toBe(false);
    await expect(shareAuraCardBlob(blob)).resolves.toBe("unavailable");
    expect(harness.share).not.toHaveBeenCalled();
    expect(downloadAuraCardBlob(blob)).toBe("downloaded");
    expect(harness.anchor).toMatchObject({
      href: "blob:talisman-preview",
      download: AURA_SHARE_FILENAME,
    });
    expect(harness.appendChild).toHaveBeenCalledWith(harness.anchor);
    expect(harness.anchor.click).toHaveBeenCalledOnce();
    expect(harness.anchor.remove).toHaveBeenCalledOnce();
    expect(harness.revokeObjectURL).toHaveBeenCalledWith("blob:talisman-preview");
  });

  it("reports cancellation separately from native share errors", async () => {
    const cancelled = installCanvas();
    const abort = new Error("cancelled");
    Object.defineProperty(abort, "name", { value: "AbortError" });
    cancelled.share.mockRejectedValueOnce(abort);
    await expect(
      shareAuraCardBlob(new Blob(["png"], { type: "image/png" })),
    ).resolves.toBe("cancelled");

    const failed = installCanvas();
    failed.share.mockRejectedValueOnce(new Error("share failed"));
    await expect(
      shareAuraCardBlob(new Blob(["png"], { type: "image/png" })),
    ).resolves.toBe("unavailable");
  });
});
