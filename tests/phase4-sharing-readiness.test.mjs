import { describe, expect, it, vi } from 'vitest';
import { waitForFeatureOffComparison } from './phase4-sharing-readiness.mjs';

function pageWith(formWait = async () => {}, stateWait = async () => {}) {
  const waitFor = vi.fn(formWait);
  return { locator: vi.fn(() => ({ waitFor })), waitForFunction: vi.fn(stateWait), waitFor };
}

describe('sharing readiness deadline', () => {
  it('shares the existing 30-second budget between form visibility and hydration', async () => {
    let clock = 0;
    const page = pageWith(async () => { clock = 25_000; });
    expect(await waitForFeatureOffComparison(page, { now: () => clock })).toBe(true);
    expect(page.waitFor).toHaveBeenCalledWith({ state: 'visible', timeout: 30_000 });
    expect(page.waitForFunction.mock.calls[0][2]).toEqual({ timeout: 5_000 });
  });

  it('does not start an extra wait after the existing deadline is exhausted', async () => {
    let clock = 0;
    const page = pageWith(async () => { clock = 30_000; });
    expect(await waitForFeatureOffComparison(page, { now: () => clock })).toBe(false);
    expect(page.waitForFunction).not.toHaveBeenCalled();
  });

  it('keeps missing controls a failed readiness result', async () => {
    const page = pageWith(undefined, async () => { throw Object.assign(new Error('missing'), { name: 'TimeoutError' }); });
    expect(await waitForFeatureOffComparison(page)).toBe(false);
  });

  it('does not hide a missing visible form or an unexpected browser failure', async () => {
    const formError = Object.assign(new Error('no form'), { name: 'TimeoutError' });
    await expect(waitForFeatureOffComparison(pageWith(async () => { throw formError; }))).rejects.toBe(formError);
    const pageError = new Error('page closed');
    await expect(waitForFeatureOffComparison(pageWith(undefined, async () => { throw pageError; }))).rejects.toBe(pageError);
  });
});
