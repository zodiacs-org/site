export const ACCOUNT_SYNC_V2_PUBLIC_FLAG = 'PUBLIC_ACCOUNT_SYNC_V2_ENABLED';
/** Retired second interlock from the access-controlled preview. Ignored since launch. */
export const ACCOUNT_SYNC_V2_PREVIEW_ACK_FLAG = 'PUBLIC_ACCOUNT_SYNC_V2_PREVIEW_ACK';

export interface AccountSyncV2PublicEnv {
  PUBLIC_ACCOUNT_SYNC_V2_ENABLED?: string;
  /** Accepted for older call sites and ignored. */
  PUBLIC_ACCOUNT_SYNC_V2_PREVIEW_ACK?: string;
}

/**
 * The one public build switch for the v2 account client. The site is
 * statically rendered, so this is global for the deployment: every visitor
 * gets the v2 client and the v1 chart sync client is suppressed. That is the
 * launched state (v1 writes are paused in the database).
 */
export function accountSyncV2Enabled(
  env: AccountSyncV2PublicEnv = {
    PUBLIC_ACCOUNT_SYNC_V2_ENABLED: import.meta.env.PUBLIC_ACCOUNT_SYNC_V2_ENABLED,
  },
): boolean {
  return env.PUBLIC_ACCOUNT_SYNC_V2_ENABLED === '1';
}
