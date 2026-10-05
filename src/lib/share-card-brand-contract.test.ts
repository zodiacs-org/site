import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const CLIENT_GENERATORS = [
  "share-card.ts",
  "compatibility-card.ts",
  "wallet/share-card.ts",
  "aura-share-card.ts",
  "aura-cabinet-card.ts",
  "games/share-card.ts",
] as const;

function libSource(path: string): string {
  return readFileSync(new URL(path, import.meta.url), "utf8");
}

describe("export-image brand coverage", () => {
  it.each(CLIENT_GENERATORS)("uses the canonical image lockup in %s", (path) => {
    const source = libSource(path);
    expect(source).toMatch(/(?:load|with)ShareBrandIcon/);
    expect(source).toContain("drawShareBrandLockup");
    expect(source).not.toMatch(/ZODIACS\s*·\s*ORG/);
  });

  it("brands all six natal portrait variants, the solar return and the technical sheet", () => {
    const source = libSource("share-card.ts");
    expect(source.match(/await drawPortraitShareBrand\(ctx\);/g)).toHaveLength(6);
    expect(source).toContain("await drawPortraitShareBrand(ctx, 1850);");
    expect(source).toContain("drawShareBrandLockup(ctx, brandIcon");
    expect(source).toContain("withShareBrandIcon");
  });

  it("embeds the same local profile image in the dynamic shared-chart preview", () => {
    const source = readFileSync(
      new URL("../server/chart-preview.ts", import.meta.url),
      "utf8",
    );
    expect(source).toContain("public/assets/app-icons/v3/icon-512.png");
    expect(source).toContain("data:image/png;base64,");
    expect(source).toContain("'zodiacs.org'");
    expect(source).toContain("fontFamily: 'EB Garamond'");
    expect(source).toContain("width: 48");
    expect(source).toContain("height: 48");
    expect(source).not.toMatch(/ZODIACS\s*·\s*ORG/);
  });
});
