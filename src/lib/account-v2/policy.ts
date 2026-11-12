/** Auditable notice version accepted by both the browser and server boundary. */
export const ACCOUNT_SYNC_V2_CHART_SYNC_POLICY_VERSION = 'chart-sync-2026-08-12.v1' as const;
/** "Use my chart for my emails": off by default, its own notice version. */
export const ACCOUNT_SYNC_V2_CHART_EMAILS_POLICY_VERSION = 'chart-emails-2026-11-11.v1' as const;

export type AccountConsentPurpose = 'chart_sync' | 'chart_emails';

export function accountConsentPolicyVersion(purpose: AccountConsentPurpose): string {
  return purpose === 'chart_emails'
    ? ACCOUNT_SYNC_V2_CHART_EMAILS_POLICY_VERSION
    : ACCOUNT_SYNC_V2_CHART_SYNC_POLICY_VERSION;
}
