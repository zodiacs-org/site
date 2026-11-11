import { h } from 'preact';
import render from 'preact-render-to-string';
import { readFile } from 'node:fs/promises';
import { describe, expect, it, vi } from 'vitest';
import {
  AccountWeeklyDigestView,
  saveWeeklyDigestChoice,
  type AccountWeeklyDigestViewProps,
} from './AccountWeeklyDigest';

function view(overrides: Partial<AccountWeeklyDigestViewProps>): string {
  return render(h(AccountWeeklyDigestView, {
    optIn: false,
    chartEmails: false,
    loadState: 'ready',
    locked: false,
    message: '',
    onChange: () => {},
    ...overrides,
  }));
}

describe('weekly digest on the v2 profile', () => {
  it('saves the opt in and the opt out through the digest preference', async () => {
    const save = vi.fn().mockResolvedValue(true);
    await expect(saveWeeklyDigestChoice(true, false, save))
      .resolves.toEqual({ optIn: true, message: 'The weekly digest is on.' });
    await expect(saveWeeklyDigestChoice(false, true, save))
      .resolves.toEqual({ optIn: false, message: 'The weekly digest is off.' });
    expect(save.mock.calls).toEqual([[true], [false]]);
  });

  it('puts the box back when the choice did not save', async () => {
    for (const save of [vi.fn().mockResolvedValue(false), vi.fn().mockRejectedValue(new Error('offline'))]) {
      await expect(saveWeeklyDigestChoice(true, false, save))
        .resolves.toEqual({ optIn: false, message: 'That did not save. Please try again.' });
    }
  });

  it('is off until checked and says which edition the digest will be', () => {
    const sky = view({});
    expect(sky).toContain('Send me the Monday digest');
    expect(sky).toContain('Off until you check this box.');
    expect(sky).toContain('notable sky events');
    expect(sky).not.toMatch(/<input type="checkbox" checked/u);
    expect(view({ optIn: true, chartEmails: true })).toContain('It uses your synced chart, because chart emails are on.');
    expect(view({ optIn: true })).toMatch(/<input type="checkbox" checked/u);
    expect(sky).not.toMatch(/[–—]/u);
  });

  it('cannot be changed until the current choice is known', () => {
    expect(view({ loadState: 'loading' })).toMatch(/<input type="checkbox" disabled/u);
    expect(view({ loadState: 'error' })).toContain('We could not check your weekly digest just now.');
  });

  it('is shown in the v2 panel under the same switch as the earlier profile checkbox', async () => {
    const panel = await readFile(new URL('./AccountSyncV2Panel.tsx', import.meta.url), 'utf8');
    expect(panel).toMatch(/\{weeklyDigestSignupEnabled\(\) && \(\s*<AccountWeeklyDigest/u);
    const manager = await readFile(new URL('./ProfileManager.tsx', import.meta.url), 'utf8');
    expect(manager).toContain('weeklyDigestSignupEnabled() && (');
  });
});
