import { afterEach, expect, it, vi } from 'vitest';
import { initProfileNavigation } from './navigation-avatar.mjs';
import { ACCOUNT_V2_LOCAL_OWNER_KEY, ACCOUNT_V2_RETAINED_OWNER_KEY } from '../account-v2/storage-identity';

afterEach(() => vi.unstubAllGlobals());

it.each([ACCOUNT_V2_LOCAL_OWNER_KEY, ACCOUNT_V2_RETAINED_OWNER_KEY])(
  'does not read private profile data on a static page with %s and no account reader', (ownerKey) => {
    const slot = { hidden: false, textContent: 'Old name', style: { removeProperty: vi.fn() }, parentElement: { classList: { toggle: vi.fn() } } };
    const read = vi.fn((key: string) => {
      if (key === ownerKey) return '{"version":1,"accountId":"owned"}';
      if (key === 'zodiacs.me.v1' || key === 'zodiacs.profile.v1') throw new Error('Private read before access');
      return null;
    });
    vi.stubGlobal('document', { querySelectorAll: () => [slot], documentElement: { hasAttribute: () => false } });
    vi.stubGlobal('window', { addEventListener: vi.fn(), removeEventListener: vi.fn() });
    vi.stubGlobal('localStorage', { getItem: read });
    const cleanup = initProfileNavigation();
    expect(read.mock.calls.flat()).not.toContain('zodiacs.me.v1');
    expect(read.mock.calls.flat()).not.toContain('zodiacs.profile.v1');
    expect(slot.hidden).toBe(true);
    expect(slot.textContent).toBe('');
    cleanup?.();
  },
);
