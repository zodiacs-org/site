import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  BADGE_COLORS,
  BADGE_RECEIPT_URL,
  BADGE_REFERENCE,
  badgeEmbedSnippets,
  engineVersionFromDependency,
  isEngineAtLeast110,
  skyCheckBadge,
} from './sky-check-badge.mjs';

function makeSnapshot({
  date = '2026-11-12',
  engineVersion = '1.1.0',
  ephemeris = 'jpl-de440',
  suiteWithin = 240,
  suiteTotal = 240,
  rollingWithin = 120,
  rollingTotal = 120,
} = {}) {
  return {
    date,
    engine: {
      version: engineVersion,
      ephemerides: [{ name: ephemeris, version: 'test' }],
    },
    sets: {
      suite: { total: suiteTotal, within: suiteWithin },
      rolling: { total: rollingTotal, within: rollingWithin },
    },
  };
}

function relativeLuminance(hex) {
  const match = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/iu.exec(hex);
  if (!match) throw new Error(`Invalid hex colour: ${hex}`);
  const [r, g, b] = match.slice(1).map((part) => {
    const channel = parseInt(part, 16) / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastRatio(hexA, hexB) {
  const a = relativeLuminance(hexA);
  const b = relativeLuminance(hexB);
  const lighter = Math.max(a, b);
  const darker = Math.min(a, b);
  return (lighter + 0.05) / (darker + 0.05);
}

/** Seeded PRNG (mulberry32) for deterministic property testing. */
function mulberry32(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe('skyCheckBadge', () => {
  it('returns pass when all positions match within 1 arcsec and run is 14 days old or less', () => {
    const snapshot = makeSnapshot({ date: '2026-11-12' });
    const day0 = skyCheckBadge(snapshot, '2026-11-12', { siteEngineVersion: '1.1.0' });
    const day14 = skyCheckBadge(snapshot, '2026-11-26', { siteEngineVersion: '1.1.0' });

    for (const badge of [day0, day14]) {
      expect(badge).not.toBeNull();
      expect(badge.state).toBe('pass');
      expect(badge.left).toBe('sky positions');
      expect(badge.right).toBe('360 of 360 match NASA · 12 Nov 2026');
      expect(badge.json).toEqual({
        state: 'pass',
        checked: '2026-11-12',
        within: 360,
        total: 360,
        engine: '1.1.0',
        ephemeris: 'jpl-de440',
        reference: BADGE_REFERENCE,
        receipt: BADGE_RECEIPT_URL,
      });
    }
  });

  it('switches to stale at day 15 with neutral colour and no count', () => {
    const snapshot = makeSnapshot({ date: '2026-11-12' });
    const day15 = skyCheckBadge(snapshot, '2026-11-27', { siteEngineVersion: '1.1.0' });

    expect(day15).not.toBeNull();
    expect(day15.state).toBe('stale');
    expect(day15.right).toBe('last checked 12 Nov 2026');
    expect(day15.svg).not.toContain('360 of 360');
    expect(day15.svg).not.toContain(BADGE_COLORS.passBg);
    expect(day15.svg).toContain(BADGE_COLORS.neutralBg);
  });

  it('returns attention with neutral colour when any position is outside 1 arcsec', () => {
    const snapshot = makeSnapshot({ date: '2026-11-12', suiteWithin: 239, suiteTotal: 240, rollingWithin: 120, rollingTotal: 120 });
    const badge = skyCheckBadge(snapshot, '2026-11-15', { siteEngineVersion: '1.1.0' });

    expect(badge).not.toBeNull();
    expect(badge.state).toBe('attention');
    expect(badge.right).toBe('359 of 360 match NASA · 12 Nov 2026');
    expect(badge.svg).not.toContain(BADGE_COLORS.passBg);
    expect(badge.svg).toContain(BADGE_COLORS.neutralBg);
  });

  it('uses the pass colour exclusively in the pass state', () => {
    const pass = skyCheckBadge(makeSnapshot(), '2026-11-12');
    const stale = skyCheckBadge(makeSnapshot(), '2026-11-27');
    const attention = skyCheckBadge(makeSnapshot({ rollingWithin: 119 }), '2026-11-12');

    expect(pass.svg).toContain(BADGE_COLORS.passBg);
    expect(stale.svg).not.toContain(BADGE_COLORS.passBg);
    expect(attention.svg).not.toContain(BADGE_COLORS.passBg);
  });

  it('returns null when snapshot is missing or engine is older than stable 1.1.0', () => {
    expect(skyCheckBadge(null, '2026-11-12')).toBeNull();
    expect(skyCheckBadge(makeSnapshot({ engineVersion: '1.1.0-rc.2' }), '2026-11-12')).toBeNull();
    expect(skyCheckBadge(makeSnapshot({ engineVersion: '1.0.0' }), '2026-11-12')).toBeNull();
    expect(skyCheckBadge(makeSnapshot({ engineVersion: '1.1.0' }), '2026-11-12', { siteEngineVersion: '1.1.0-rc.9' })).toBeNull();
    expect(isEngineAtLeast110('1.1.0')).toBe(true);
    expect(isEngineAtLeast110('2.0.0')).toBe(true);
    expect(isEngineAtLeast110('1.1.0-rc.2')).toBe(false);
    expect(engineVersionFromDependency('file:vendor/zodiacs-engine-1.1.0.tgz')).toBe('1.1.0');
  });

  it('produces well-formed, accessible, self-contained SVG under 1,500 bytes matching the snapshot', () => {
    const latest = JSON.parse(readFileSync(resolve(process.cwd(), 'src/data/accuracy/latest.json'), 'utf8'));
    const badge = skyCheckBadge(latest, latest.date, { siteEngineVersion: '1.1.0' });
    expect(badge).not.toBeNull();

    const bytes = Buffer.byteLength(badge.svg, 'utf8');
    expect(bytes).toBeLessThan(1500);
    expect(badge.svg).toContain('xmlns="http://www.w3.org/2000/svg"');
    expect(badge.svg).toContain('role="img"');
    expect(badge.svg).toContain(`aria-label="${badge.label}"`);
    expect(badge.svg).toContain(`<title>${badge.label}</title>`);
    expect(badge.svg).not.toMatch(/<script/iu);

    // No external URLs other than the SVG XML namespace.
    const urls = badge.svg.match(/https?:\/\/[^"'\s<>]+/gu) ?? [];
    expect(urls).toEqual(['http://www.w3.org/2000/svg']);

    // Count and date inside the SVG match the committed snapshot.
    const total = latest.sets.suite.total + latest.sets.rolling.total;
    const within = latest.sets.suite.within + latest.sets.rolling.within;
    expect(badge.svg).toContain(`${within} of ${total} match NASA`);
    expect(badge.svg).toContain('19 Nov 2026');

    // Zero dash characters (hyphen-minus, en dash, em dash) in visible badge text.
    expect(badge.left).not.toMatch(/[-–—]/u);
    expect(badge.right).not.toMatch(/[-–—]/u);
    expect(badge.label).not.toMatch(/[-–—]/u);

    const snippets = badgeEmbedSnippets(badge);
    expect(snippets.markdown).toContain('https://zodiacs.org/badges/sky-check.svg');
    expect(snippets.markdown).toContain(BADGE_RECEIPT_URL);
    expect(snippets.html).toContain('https://zodiacs.org/badges/sky-check.svg');
  });

  it('meets WCAG 2.2 AA 4.5:1 text contrast in every state', () => {
    expect(contrastRatio(BADGE_COLORS.leftText, BADGE_COLORS.leftBg)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(BADGE_COLORS.passText, BADGE_COLORS.passBg)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(BADGE_COLORS.neutralText, BADGE_COLORS.neutralBg)).toBeGreaterThanOrEqual(4.5);
  });

  it('prints UTC date consistently regardless of viewer timezone', () => {
    const badge = skyCheckBadge(makeSnapshot({ date: '2026-11-02' }), new Date('2026-11-02T23:59:59Z'));
    expect(badge.right).toBe('360 of 360 match NASA · 2 Nov 2026');
  });

  it('property: across 1,000 fixed-seed random snapshots, state is pass iff within === total and age <= 14 days', () => {
    const rand = mulberry32(20261122);
    const baseMs = Date.UTC(2026, 0, 1);
    for (let i = 0; i < 1000; i += 1) {
      const checkOffset = Math.floor(rand() * 300);
      const age = Math.floor(rand() * 40); // 0..39 days
      const checkedIso = new Date(baseMs + checkOffset * 86_400_000).toISOString().slice(0, 10);
      const todayIso = new Date(baseMs + (checkOffset + age) * 86_400_000).toISOString().slice(0, 10);
      const suiteTotal = 1 + Math.floor(rand() * 300);
      const rollingTotal = 1 + Math.floor(rand() * 200);
      const allMatch = rand() < 0.45;
      const suiteWithin = allMatch ? suiteTotal : Math.floor(rand() * (suiteTotal + 1));
      const rollingWithin = allMatch ? rollingTotal : Math.floor(rand() * (rollingTotal + 1));
      const snapshot = makeSnapshot({
        date: checkedIso,
        engineVersion: rand() < 0.5 ? '1.1.0' : '2.0.0',
        suiteTotal,
        suiteWithin,
        rollingTotal,
        rollingWithin,
      });
      const badge = skyCheckBadge(snapshot, todayIso, { siteEngineVersion: '1.1.0' });
      expect(badge).not.toBeNull();
      const within = suiteWithin + rollingWithin;
      const total = suiteTotal + rollingTotal;
      const shouldPass = within === total && age <= 14;
      expect(badge.state === 'pass', `case ${i}: within=${within}/${total}, age=${age}`).toBe(shouldPass);
      if (age > 14) expect(badge.state).toBe('stale');
      else if (within < total) expect(badge.state).toBe('attention');
    }
  });
});
