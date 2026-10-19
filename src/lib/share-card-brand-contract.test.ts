import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * Every image the site makes signs with the brand lockup (DESIGN.md, "Brand
 * Lockup"), owner-chosen 2026-10-19: the tilted ring and ZODIACS · ORG. The
 * canvas cards draw it through src/lib/share-card-brand.ts and the server
 * previews through src/server/brand-lockup-image.ts; none paints the earlier
 * profile-image and sentence-case "Zodiacs.org" lockup.
 */
const CLIENT_GENERATORS = [
  "share-card.ts",
  "compatibility-card.ts",
  "composite-card.ts",
  "lunar-return-card.ts",
  "aspect-pattern-card.ts",
  "chart-context-card.ts",
  "wallet/share-card.ts",
  "aura-share-card.ts",
  "aura-cabinet-card.ts",
  "games/share-card.ts",
  "sharing/group-card.ts",
  "return-visits/wrapped-card.ts",
] as const;

function libSource(path: string): string {
  return readFileSync(new URL(path, import.meta.url), "utf8");
}

const serverSource = (path: string) => readFileSync(new URL(`../server/${path}`, import.meta.url), "utf8");

describe("export-image brand coverage", () => {
  it.each(CLIENT_GENERATORS)("signs %s with the brand lockup", (path) => {
    const source = libSource(path);
    expect(source).toContain("drawShareBrandLockup");
    expect(source).not.toMatch(/fillText\(\s*["'`]Zodiacs\.org/u);
    expect(source).not.toContain("icon-512.png");
    // The lockup draws its own ring, so no generator fetches a brand image for it.
    expect(source).not.toMatch(/BRAND_ICON_PATHS|icon512/u);
  });

  it("draws the tilted ring and ZODIACS · ORG, and fetches no image for it", () => {
    const source = libSource("share-card-brand.ts");
    expect(source).toContain('from "./brand-lockup.mjs"');
    expect(source).toContain("tiltedRingDots(front)");
    expect(source).toContain("layout.front");
    expect(source).toContain("LOCKUP_WORDS.name");
    expect(source).toContain("LOCKUP_WORDS.tld");
    expect(source).not.toMatch(/\bfetch\(/u);
    expect(source).not.toContain("drawImage");
  });

  it("brands all six natal portrait variants, the solar return and the technical sheet", () => {
    const source = libSource("share-card.ts");
    // Each card turns the ring to the person's Sun sign (ring-front.ts).
    expect(source.match(/await drawPortraitShareBrand\(ctx, undefined, cardRingFront\(chart\)\);/g)).toHaveLength(5);
    expect(source).toContain("await drawPortraitShareBrand(ctx, undefined, ringFront(model.wheel.bodies, !model.noTime));");
    expect(source).toContain("await drawPortraitShareBrand(ctx, 1850, cardRingFront(chart));");
    expect(source).toContain("front: cardRingFront(chart),");
    expect(source).toContain("drawShareBrandLockup(ctx, brandIcon");
    expect(source).toContain("withShareBrandIcon");
  });

  it.each(["chart-preview.ts", "result-preview.ts"])("signs the server preview %s with the same lockup", (path) => {
    const source = serverSource(path);
    expect(source).toContain("from './brand-lockup-image.js'");
    expect(source).toMatch(/\blockupImage\(/u);
    expect(source).toContain("eb-garamond-latin-400-normal.woff");
    expect(source).not.toContain("icon-512.png");
    // No element draws the earlier sentence-case wordmark (the host fallback "zodiacs.org" is not drawn).
    expect(source).not.toMatch(/\},\s*'zodiacs\.org'\)/u);
  });

  it("draws the server lockup from the shared ring and words", () => {
    const source = serverSource("brand-lockup-image.ts");
    expect(source).toContain("from '../lib/brand-lockup.mjs'");
    expect(source).toContain("tiltedRingDots(front).map");
    expect(source).toContain("LOCKUP_WORDS.name");
    expect(source).toContain("LOCKUP_WORDS.dot");
    expect(source).toContain("LOCKUP_WORDS.tld");
  });

  it("turns the ring to the person's sign on the images made for one person", () => {
    expect(libSource("compatibility-card.ts")).toContain("front: ringFront(a.bodies, a.asc !== null),");
    expect(libSource("games/share-card.ts")).toContain("front: snapshot.sign.slug,");
    expect(serverSource("chart-preview.ts")).toContain("lockupImage(undefined, undefined, model.ringFront)");
    expect(serverSource("result-preview.ts")).toContain("model.people[0].slug");
  });
});
