export const ACCOUNT_EXPORT_SCHEMA = 'zodiacs.account.export.v1' as const;
export const ACCOUNT_SYNC_V2_EXPORT_SCHEMA = 'zodiacs.account-sync-v2.export.v1' as const;

export type AccountApiErrorCode =
  | 'disabled'
  | 'method_not_allowed'
  | 'forbidden'
  | 'unauthorized'
  | 'invalid_action'
  | 'invalid_request'
  | 'reauthentication_required'
  | 'deletion_conflict'
  | 'deletion_blocked'
  | 'deletion_receipt_not_found'
  | 'deletion_receipt_expired'
  | 'authentication_unavailable'
  | 'sync_unavailable'
  | 'export_unavailable'
  | 'deletion_unavailable';

export interface AccountApiErrorBody {
  error: AccountApiErrorCode;
}

export interface AccountAuthExportV1 {
  id: string;
  email: string;
  phone: string | null;
  providers: string[];
  isAnonymous: boolean;
  createdAt: string | null;
  updatedAt: string | null;
  lastSignInAt: string | null;
  emailConfirmedAt: string | null;
  phoneConfirmedAt: string | null;
}

export interface LegacyProfileExportV1 {
  settings: Record<string, unknown>;
  digestOptIn: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface LegacyChartExportV1 {
  id: string;
  payload: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface LegacyChartDeletionExportV1 {
  id: string;
  deletedAt: string;
  createdAt: string;
}

export interface DailyChartPreferenceExportV1 {
  chartId: string | null;
  timezone: string;
  state: 'pending' | 'confirmed';
  confirmedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CompatibilityInviteExportV1 {
  id: string;
  label: string;
  sunSign: string;
  positions: Record<string, unknown> | null;
  timeKnown: boolean;
  status: string;
  notifyOnComplete: boolean;
  createdAt: string;
  expiresAt: string;
  openedAt: string | null;
  completedAt: string | null;
  revokedAt: string | null;
  expiredAt: string | null;
  authorityDestroyedAt: string | null;
  deleteAfter: string | null;
  ownerHiddenAt: string | null;
}

export interface AccountSyncV2ExportV1 {
  outcome: 'ready';
  schema: typeof ACCOUNT_SYNC_V2_EXPORT_SCHEMA;
  account: {
    status: 'active' | 'deleting';
    created_at: string;
    updated_at: string;
    deletion_started_at: string | null;
  } | null;
  consents: Array<{
    purpose: string;
    state: 'granted' | 'withdrawn';
    policy_version: string;
    granted_at: string | null;
    withdrawn_at: string | null;
    updated_at: string;
  }>;
  consent_events: Array<{
    event_id: number;
    purpose: string;
    decision: 'grant' | 'withdraw';
    policy_version: string;
    source: 'web' | 'ios' | 'support' | 'system';
    occurred_at: string;
  }>;
  devices: Array<{
    device_id: string;
    platform: 'web' | 'ios' | 'unknown';
    last_cursor: number;
    created_at: string;
    last_seen_at: string;
    revoked_at: string | null;
  }>;
  daily_sun_aliases: Array<{
    schema: 'zodiacs.account.daily-sun-alias.v1';
    email: string | null;
    locatorStatus: 'available' | 'unavailable';
    boundAt: string;
    updatedAt: string;
  }>;
  charts: Array<{
    chart_id: string;
    subject_kind: 'self';
    subject_attestation: 'self_declared_v1';
    revision: number;
    created_at: string;
    updated_at: string;
  }>;
  private_charts: Array<{
    chart_id: string;
    revision: number;
    schema: 'zodiacs.account.private-chart.v1';
    label: string;
    birth: {
      date: string;
      time: string | null;
      timeKnown: boolean;
      place: null | {
        name: string;
        admin1: string;
        country: string;
        lat: number;
        lon: number;
        tz: string;
      };
    };
    derived: {
      positions: {
        b: number[];
        a?: [number, number];
        h: 'w' | 'p';
        v: string;
      };
      timeKnown: boolean;
      sunSign: string;
      engineVersion: string;
      houseSystem: 'whole' | 'placidus';
    };
  }>;
  encrypted_sources: Array<{
    chart_id: string;
    revision: number;
    ciphertext: string;
    nonce: string;
    format: 'opaque_v1';
    key_scope: 'service';
    key_version: number;
    wrapped_key: string;
    created_at: string;
    updated_at: string;
  }>;
  changes: Array<{
    seq: number;
    entity_type: 'chart' | 'consent' | 'account';
    entity_id: string | null;
    operation: 'upsert' | 'delete' | 'grant' | 'withdraw';
    revision: number;
    created_at: string;
  }>;
  tombstones: Array<{
    chart_id: string;
    revision: number;
    deleted_at: string;
  }>;
}

export interface ZodiacsAccountExportV1 {
  schema: typeof ACCOUNT_EXPORT_SCHEMA;
  exportedAt: string;
  account: AccountAuthExportV1;
  cloud: {
    profile: LegacyProfileExportV1 | null;
    charts: LegacyChartExportV1[];
    chartDeletions: LegacyChartDeletionExportV1[];
    dailyChartPreference: DailyChartPreferenceExportV1 | null;
    compatibilityInvites: CompatibilityInviteExportV1[];
    accountSyncV2: AccountSyncV2ExportV1;
  };
}
