import { afterEach, expect, it, vi } from 'vitest';
import { recordHelpers } from './saved-records-browser-lib.mjs';
afterEach(() => vi.unstubAllGlobals());
it('returns the terminal keep state observed by the wait even if another tab immediately reopens the scope', async () => {
  let state = 'changed';
  const dispose = vi.fn(async () => {});
  vi.stubGlobal('document', { querySelector: () => ({ getAttribute: () => state }) });
  const page = {
    waitForFunction: vi.fn(async (predicate, wanted) => {
      const observed = predicate(wanted);
      state = 'opening';
      return { jsonValue: async () => observed, dispose };
    }),
    getAttribute: vi.fn(async () => state),
  };
  expect(await recordHelpers('http://localhost').waitKeepState(page, ['changed'], { timeout: 5000 })).toBe('changed');
  expect(page.getAttribute).not.toHaveBeenCalled();
  expect(page.waitForFunction.mock.calls[0][2]).toEqual({ timeout: 5000 });
  expect(dispose).toHaveBeenCalledOnce();
});
