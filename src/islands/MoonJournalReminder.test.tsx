import { render } from 'preact-render-to-string';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Lunation } from '../lib/moon-journal/types';

const lunations: Lunation[] = [
  { type: 'full', at: '2026-10-26T04:12:00.000Z', sign: 'taurus' },
  { type: 'new', at: '2026-11-09T07:02:05.269Z', sign: 'scorpio' },
  { type: 'full', at: '2026-11-24T14:53:31.000Z', sign: 'gemini' },
  { type: 'new', at: '2026-12-09T00:51:00.000Z', sign: 'sagittarius' },
];
const signNames = { taurus: 'Taurus', scorpio: 'Scorpio', gemini: 'Gemini', sagittarius: 'Sagittarius' };

async function renderJournal(flag: string): Promise<string> {
  vi.stubEnv('PUBLIC_WEB_PUSH_ENABLED', flag);
  vi.resetModules();
  const { default: MoonJournal } = await import('./MoonJournal');
  return render(<MoonJournal lunations={lunations} signNames={signNames} builtAt="2026-11-12T12:00:00.000Z" />);
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe('the Moon journal reminder control', () => {
  it('is absent, with no dead button, when the build has push off', async () => {
    const html = await renderJournal('');
    expect(html).toContain('data-moon-journal');
    expect(html).not.toContain('data-mj-remind');
    expect(html).not.toContain('Remind me at each new and full Moon');
  });

  it('is in the server render when push is on, disabled until the browser is read', async () => {
    const html = await renderJournal('1');
    expect(html).toContain('data-mj-remind="checking"');
    expect(html).toMatch(/<button[^>]*disabled[^>]*data-mj-remind-on[^>]*>Remind me at each new and full Moon<\/button>/u);
    expect(html).toContain('Turning them on stores this browser’s push subscription with us, and nothing you write here.');
    // It sits before the downloads, inside the journal island.
    expect(html.indexOf('data-mj-remind')).toBeLessThan(html.indexOf('mj-tools-head'));
  });
});
