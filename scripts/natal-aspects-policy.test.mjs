import { describe, expect, it, vi } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import {
  NATAL_ASPECT_PAIRS,
  NATAL_PAIR_ENTRYPOINT,
  assertNatalPairEntries,
  natalAspectRoutes,
  natalAspectsState,
} from './natal-aspects-policy.mjs';

const reviewed = {
  released: true,
  updated: '2026-10-24',
  reviewer: 'Editorial review fixture',
  reviewedAt: '2026-10-24',
  indexingEvidence: 'fixtures/reviewed-indexing.json',
};
const entries = (draft = true, ids = NATAL_ASPECT_PAIRS) => ids.map((id) => ({ id, data: { pair: id, draft } }));

describe('natal aspect publication policy', () => {
  it('publishes only a complete released record', () => {
    expect(natalAspectsState(reviewed, {})).toEqual({ published: true, preview: false, enabled: true });
  });

  it.each(['released', 'reviewer', 'reviewedAt', 'indexingEvidence'])('withholds publication when %s is missing', (field) => {
    expect(natalAspectsState({ ...reviewed, [field]: null }, {})).toEqual({ published: false, preview: false, enabled: false });
  });

  it('lets the review flag build the pages without publishing them', () => {
    const state = natalAspectsState({ ...reviewed, released: false }, { PUBLIC_NATAL_ASPECTS_PREVIEW: '1' });
    expect(state).toEqual({ published: false, preview: true, enabled: true });
    expect(natalAspectsState({ ...reviewed, released: false }, { PUBLIC_NATAL_ASPECTS_PREVIEW: 'true' }).enabled).toBe(false);
  });

  it('releases the committed record with its named review and indexing evidence', () => {
    const record = JSON.parse(readFileSync('src/data/natal-aspects-publication.json', 'utf8'));
    expect(natalAspectsState(record, {})).toEqual({ published: true, preview: false, enabled: true });
    expect(record).toMatchObject({ reviewer: 'Dias Malayev', reviewedAt: '2026-10-25', updated: '2026-10-25' });
    expect(record.holdReason).toBeNull();
    expect(existsSync(record.indexingEvidence)).toBe(true);
  });

  it('moves every article to draft: false, so the released build passes the draft guard', () => {
    for (const pair of NATAL_ASPECT_PAIRS) {
      const source = readFileSync(`src/content/natal-aspect-pairs/${pair}.mdx`, 'utf8');
      expect(source).toMatch(/^draft: false$/m);
    }
  });

  it('wires both discovery hooks behind the publication state', () => {
    const hub = readFileSync('src/pages/learn/aspects/index.astro', 'utf8');
    expect(hub).toContain('{natalAspectsEnabled && <NatalAspectsHubSection />}');
    const guide = readFileSync('src/pages/learn/aspects/[slug].astro', 'utf8');
    expect(guide).toContain('{natalAspectsEnabled && <NatalPairLinks type={type} />}');
  });

  it('injects exactly three static pair routes, and none while held', () => {
    const injectRoute = vi.fn();
    natalAspectRoutes(true).hooks['astro:config:setup']({ injectRoute });
    expect(injectRoute.mock.calls).toEqual([
      [{ pattern: '/learn/aspects/sun-moon/', entrypoint: NATAL_PAIR_ENTRYPOINT }],
      [{ pattern: '/learn/aspects/moon-venus/', entrypoint: NATAL_PAIR_ENTRYPOINT }],
      [{ pattern: '/learn/aspects/venus-mars/', entrypoint: NATAL_PAIR_ENTRYPOINT }],
    ]);
    expect(injectRoute.mock.calls.every(([route]) => !route.pattern.includes('['))).toBe(true);
    const held = vi.fn();
    natalAspectRoutes(false).hooks['astro:config:setup']({ injectRoute: held });
    expect(held).not.toHaveBeenCalled();
  });

  it('keeps the pages outside the Phase 1 protected Learn scope', async () => {
    const { protectedPathLabels } = await import('./phase1-scope-guard.mjs');
    for (const path of [NATAL_PAIR_ENTRYPOINT.slice(2), 'src/content/natal-aspect-pairs/sun-moon.mdx',
      'src/components/learn/NatalAspectPairPage.astro', 'scripts/natal-aspects-policy.mjs']) {
      expect(protectedPathLabels(path)).toEqual([]);
    }
  });

  it('holds the pair records to the closed three-pair allowlist', () => {
    expect(() => assertNatalPairEntries(entries(), false)).not.toThrow();
    expect(() => assertNatalPairEntries(entries(true, ['sun-moon', 'moon-venus']), false)).toThrow('must be exactly sun-moon, moon-venus, venus-mars');
    expect(() => assertNatalPairEntries(entries(true, [...NATAL_ASPECT_PAIRS, 'sun-mars']), false)).toThrow('found moon-venus, sun-mars, sun-moon, venus-mars');
    expect(() => assertNatalPairEntries([{ id: 'sun-moon', data: { pair: 'moon-venus', draft: true } }, ...entries().slice(1)], false)).toThrow('must be exactly');
  });

  it('fails a complete publication record that still carries drafts', () => {
    expect(() => assertNatalPairEntries(entries(true), true)).toThrow(
      'natal publication record complete but 3 entries still draft: moon-venus, sun-moon, venus-mars',
    );
    expect(() => assertNatalPairEntries(entries(false), true)).not.toThrow();
  });
});
