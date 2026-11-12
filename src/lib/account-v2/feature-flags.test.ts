import { describe, expect, it } from 'vitest';
import { accountSyncV2Enabled } from './feature-flags';

describe('account sync v2 feature flag', () => {
  it('turns on with the one public flag exactly 1 and fails closed otherwise', () => {
    expect(accountSyncV2Enabled({})).toBe(false);
    expect(accountSyncV2Enabled({ PUBLIC_ACCOUNT_SYNC_V2_ENABLED: '' })).toBe(false);
    expect(accountSyncV2Enabled({ PUBLIC_ACCOUNT_SYNC_V2_ENABLED: 'true' })).toBe(false);
    expect(accountSyncV2Enabled({ PUBLIC_ACCOUNT_SYNC_V2_ENABLED: '0' })).toBe(false);
    expect(accountSyncV2Enabled({ PUBLIC_ACCOUNT_SYNC_V2_ENABLED: ' 1' })).toBe(false);
    expect(accountSyncV2Enabled({ PUBLIC_ACCOUNT_SYNC_V2_ENABLED: '1' })).toBe(true);
  });

  it('ignores the retired preview acknowledgement', () => {
    expect(accountSyncV2Enabled({ PUBLIC_ACCOUNT_SYNC_V2_PREVIEW_ACK: '1' })).toBe(false);
    expect(accountSyncV2Enabled({
      PUBLIC_ACCOUNT_SYNC_V2_ENABLED: '1',
      PUBLIC_ACCOUNT_SYNC_V2_PREVIEW_ACK: '0',
    })).toBe(true);
  });
});
