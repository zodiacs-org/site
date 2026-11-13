import { readFile } from 'node:fs/promises';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const harness = vi.hoisted(() => ({
  accessAllowed: true,
  cleanup: undefined as undefined | (() => void),
}));

vi.mock('preact/hooks', () => ({
  useRef: (value: unknown) => ({ current: value }),
  useEffect: (effect: () => void | (() => void)) => {
    const cleanup = effect();
    harness.cleanup = typeof cleanup === 'function' ? cleanup : undefined;
  },
}));

vi.mock('../account-v2/profile-access-reader', () => ({
  profileAccessAllowed: () => harness.accessAllowed,
}));

import { useProfileAccessGeneration } from './useProfileAccessGeneration';

beforeEach(() => {
  harness.accessAllowed = true;
  harness.cleanup = undefined;
  vi.stubGlobal('window', new EventTarget());
});

afterEach(() => {
  harness.cleanup?.();
  vi.unstubAllGlobals();
});

describe('profile-access generation privacy fence', () => {
  it('increments on every access boundary so a captured generation becomes stale', () => {
    const generation = useProfileAccessGeneration(vi.fn());
    const captured = generation.current;

    window.dispatchEvent(new Event('zodiacs:profile-access'));

    expect(generation.current).toBe(captured + 1);
    expect(captured).not.toBe(generation.current);
  });

  it('scrubs rendered state only when the reevaluated access is denied', () => {
    const scrub = vi.fn();
    const generation = useProfileAccessGeneration(scrub);

    harness.accessAllowed = true;
    window.dispatchEvent(new Event('zodiacs:profile-access'));
    expect(generation.current).toBe(1);
    expect(scrub).not.toHaveBeenCalled();

    harness.accessAllowed = false;
    window.dispatchEvent(new Event('zodiacs:profile-access'));
    expect(generation.current).toBe(2);
    expect(scrub).toHaveBeenCalledOnce();
  });

  it('removes its boundary listener during effect cleanup', () => {
    const scrub = vi.fn();
    const generation = useProfileAccessGeneration(scrub);
    harness.cleanup?.();
    harness.accessAllowed = false;

    window.dispatchEvent(new Event('zodiacs:profile-access'));

    expect(generation.current).toBe(0);
    expect(scrub).not.toHaveBeenCalled();
  });
});

describe('profile-derived result surfaces', () => {
  it('installs the generation fence in every concrete result holder', async () => {
    const surfaces = [
      { file: 'BigThreeQuick.tsx', scrub: 'setPlacements(null)' },
      { file: 'TransitTracker.tsx', scrub: 'setResult(null)' },
      { file: 'SolarReturnCalculator.tsx', scrub: 'setResult(null)' },
      { file: 'SynastryCalculator.tsx', scrub: 'setResult(null)' },
      { file: 'RegistryAura.tsx', scrub: 'setResult(null)' },
      { file: 'PostChartDailyBrief.tsx', scrub: "setView({ kind: 'idle' })" },
    ] as const;

    for (const surface of surfaces) {
      const source = await resultSurfaceSource(surface.file);
      expect(source, surface.file).toMatch(
        /from\s+["']\.\.\/lib\/hooks\/useProfileAccessGeneration["']/u,
      );
      const installation = source.match(
        /const\s+(\w+)\s*=\s*useProfileAccessGeneration\s*\(\s*\(\)\s*=>\s*\{/u,
      );
      expect(installation, surface.file).not.toBeNull();
      const hookIndex = installation?.index ?? -1;
      const scrubIndex = source.indexOf(surface.scrub, hookIndex);
      expect(scrubIndex, `${surface.file} scrubs its result near the fence installation`)
        .toBeGreaterThan(hookIndex);
      expect(scrubIndex - hookIndex, `${surface.file} keeps the scrub callback concrete`)
        .toBeLessThan(1_200);

      const generationName = installation?.[1] ?? '';
      const generationReads = source.match(new RegExp(`${generationName}\\.current`, 'gu')) ?? [];
      expect(generationReads.length, `${surface.file} captures and rechecks its generation`)
        .toBeGreaterThanOrEqual(2);
    }
  });

  it('fences delayed profile writes outside the result holders', async () => {
    const calculator = await resultSurfaceSource('ChartCalculator.tsx');
    expect(calculator).toContain("import { useProfileAccessGeneration } from '../lib/hooks/useProfileAccessGeneration';");
    expect(calculator).toContain('const profileAccessGeneration = useProfileAccessGeneration(() => {');
    expect(calculator).toContain('setSavePromptOpen(false);');
    expect(calculator).toMatch(/const accessGeneration = profileAccessGeneration\.current;[\s\S]{0,800}await import\('\.\.\/lib\/profile\/store'\);[\s\S]{0,240}accessGeneration !== profileAccessGeneration\.current/u);

    const invite = await readFile(
      new URL('../../islands/synastry/InviteExperience.tsx', import.meta.url),
      'utf8',
    );
    expect(invite).toContain("import { useProfileAccessGeneration } from '../../lib/hooks/useProfileAccessGeneration';");
    expect(invite).toContain('const profileAccessGeneration = useProfileAccessGeneration(() => {');
    expect(invite).toContain('setCreated(null);');
    expect(invite).toMatch(/const accessGeneration = profileAccessGeneration\.current;[\s\S]{0,1600}accessGeneration !== profileAccessGeneration\.current/u);
  });
});

async function resultSurfaceSource(file: string): Promise<string> {
  return readFile(new URL(`../../islands/${file}`, import.meta.url), 'utf8');
}
