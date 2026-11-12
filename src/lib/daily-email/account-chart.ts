import {
  decryptAccountChartSource,
  type AccountChartSource,
} from '../account-api/chart-sources';
import { savedChartFromRemote } from '../account-v2/remote-chart';
import type { SavedChart } from '../profile/schema';

type Environment = Record<string, unknown>;

/**
 * Decrypts one opted-in account's self chart in this job and reads it the way
 * the site restores a cloud chart (current engine, birthplace clock). The
 * result lives only in memory for this run. Null when the envelope cannot be
 * decrypted or read; the caller then leaves that account to the Sun tier.
 */
export async function savedChartFromAccountSource(
  source: AccountChartSource,
  env: Environment,
  nowIso: string,
): Promise<SavedChart | null> {
  const payload = decryptAccountChartSource(source, env);
  if (!payload) return null;
  try {
    const restored = await savedChartFromRemote({
      outcome: 'ready',
      chart_id: source.chartId,
      label: payload.label,
      subject_kind: 'self',
      subject_attestation: 'self_declared_v1',
      revision: source.revision,
      created_at: nowIso,
      updated_at: nowIso,
      derived: {
        positions: payload.derived.positions,
        time_known: payload.derived.timeKnown,
        sun_sign: payload.derived.sunSign,
        engine_version: payload.derived.engineVersion,
        house_system: payload.derived.houseSystem,
      },
      birth: payload.birth,
    });
    return restored?.chart ?? null;
  } catch {
    return null;
  }
}
