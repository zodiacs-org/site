import { randomBytes } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import type { AccountChartSource } from '../account-api/chart-sources';
import { decryptAccountChartSource } from '../account-api/chart-sources';
import { encryptAccountPrivatePayload } from '../account-api/encryption';
import { serializeAccountPrivateChartPayload } from '../account-api/sync-wire';
import { authorizeWithFreshContent, decryptDigestChart } from './chart-edition';

const USER_ID = '10000000-0000-4000-8000-000000000002';
const CHART_A = '10000000-0000-4000-8000-0000000000aa';
const CHART_B = '10000000-0000-4000-8000-0000000000bb';
const keyring = () => ({
  ACCOUNT_SYNC_V2_ENCRYPTION_KEYS: JSON.stringify({ 1: randomBytes(32).toString('base64') }),
  ACCOUNT_SYNC_V2_ACTIVE_KEY_VERSION: '1',
});
const ENV = keyring();

function source(chartId: string, revision: number, env = ENV): AccountChartSource {
  const bodies = Array.from({ length: 12 }, (_, index) => (index * 29.5) % 360);
  const payload = {
    label: 'Synced chart label',
    birth: { date: '1990-01-01', time: '12:00', timeKnown: true, place: null },
    derived: {
      positions: { b: bodies, a: [0, 270] as [number, number], h: 'w' as const, v: 'fixture' },
      timeKnown: true,
      sunSign: 'aries' as const,
      engineVersion: 'fixture',
      houseSystem: 'whole' as const,
    },
  };
  return {
    userId: USER_ID,
    chartId,
    revision,
    envelope: encryptAccountPrivatePayload(
      serializeAccountPrivateChartPayload(payload),
      { userId: USER_ID, chartId, revision },
      env,
    ),
  };
}

describe('weekly digest chart decryption', () => {
  it('reads nothing for an account on the sky edition', async () => {
    const loadSource = vi.fn();
    await expect(decryptDigestChart(null, { loadSource, env: ENV }))
      .resolves.toEqual({ outcome: 'sky', charts: [] });
    expect(loadSource).not.toHaveBeenCalled();
  });

  it('decrypts the chart the snapshot names when a fresh read still shows it', async () => {
    const loadSource = vi.fn().mockResolvedValue(source(CHART_A, 3));
    const result = await decryptDigestChart({ chartId: CHART_A, revision: 3 }, { loadSource, env: ENV });
    expect(loadSource).toHaveBeenCalledOnce();
    expect(result.outcome).toBe('chart');
    expect(result.charts).toHaveLength(1);
    expect(result.charts[0]!.name).toBe('Synced chart label');
    expect(result.charts[0]!.bodies.map((body) => body.body)).toEqual([
      'Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter',
      'Saturn', 'Uranus', 'Neptune', 'Pluto', 'North Node', 'South Node',
    ]);
  });

  it('decrypts nothing and sends the sky edition when the account is no longer eligible', async () => {
    const decrypt = vi.fn(decryptAccountChartSource);
    for (const current of [
      null, // chart emails or chart sync withdrawn after the snapshot, or account in deletion
      source(CHART_A, 4), // the chart changed after the snapshot
      source(CHART_B, 1), // chart A removed and chart B synced
    ]) {
      const result = await decryptDigestChart(
        { chartId: CHART_A, revision: 3 },
        { loadSource: vi.fn().mockResolvedValue(current), env: ENV, decrypt },
      );
      expect(result).toEqual({ outcome: 'fell_back', charts: [] });
    }
    expect(decrypt).not.toHaveBeenCalled();
  });

  it('falls back to the sky edition when the lookup fails or the key cannot open the chart', async () => {
    await expect(decryptDigestChart({ chartId: CHART_A, revision: 3 }, {
      loadSource: vi.fn().mockRejectedValue(new Error('database down')),
      env: ENV,
    })).resolves.toEqual({ outcome: 'fell_back', charts: [] });
    await expect(decryptDigestChart({ chartId: CHART_A, revision: 3 }, {
      loadSource: vi.fn().mockResolvedValue(source(CHART_A, 3, keyring())),
      env: ENV,
    })).resolves.toEqual({ outcome: 'fell_back', charts: [] });
  });
});

describe('weekly digest authorization against fresh content', () => {
  interface Content { contentDigest: string; chart: boolean }
  interface Recipient extends Content { charts: string[] }
  const chartContent: Content = { contentDigest: 'chart-digest', chart: true };
  const skyContent: Content = { contentDigest: 'sky-digest', chart: false };
  const withCharts = vi.fn(async (content: Content): Promise<Recipient> => ({
    ...content,
    charts: content.chart ? ['chart'] : [],
  }));
  const prepare = (recipient: Recipient) => ({ edition: recipient.charts.length ? 'chart' : 'sky' });

  it('authorizes the prepared digest when the content has not moved', async () => {
    const authorize = vi.fn().mockResolvedValue(true);
    const initial = await withCharts(chartContent);
    const result = await authorizeWithFreshContent({
      initial,
      readContent: vi.fn().mockResolvedValue(chartContent),
      withCharts,
      prepare,
      authorize,
    });
    expect(result).toEqual({ authorized: true, recipient: initial, prepared: { edition: 'chart' } });
    expect(authorize).toHaveBeenCalledOnce();
  });

  it('sends the sky edition when chart emails are withdrawn between the last read and authorization', async () => {
    // The account withdraws chart emails after the job re-read its content
    // but before the authorization RPC. The RPC recomputes the content under
    // the profile lock and refuses the chart envelope; the job reads again,
    // rebuilds the digest as the sky edition and has that authorized.
    let withdrawn = false;
    const readContent = vi.fn(async () => (withdrawn ? skyContent : chartContent));
    const authorize = vi.fn(async (prepared: { edition: string }, recipient: Recipient) => {
      if (prepared.edition === 'chart') withdrawn = true;
      return recipient.contentDigest === (withdrawn ? skyContent : chartContent).contentDigest;
    });
    const charts = vi.fn(withCharts);
    const result = await authorizeWithFreshContent({
      initial: await withCharts(chartContent),
      readContent,
      withCharts: charts,
      prepare,
      authorize,
    });
    expect(result).toMatchObject({ authorized: true, prepared: { edition: 'sky' }, recipient: { charts: [] } });
    expect(authorize).toHaveBeenCalledTimes(2);
    expect(charts).toHaveBeenCalledWith(skyContent);
  });

  it('rebuilds once when the content moved before authorization and gives up after that', async () => {
    const authorize = vi.fn().mockResolvedValue(true);
    const moved = await authorizeWithFreshContent({
      initial: await withCharts(chartContent),
      readContent: vi.fn().mockResolvedValue(skyContent),
      withCharts,
      prepare,
      authorize,
    });
    expect(moved).toMatchObject({ authorized: true, prepared: { edition: 'sky' } });

    let reads = 0;
    const prepareSpy = vi.fn(prepare);
    const restless = await authorizeWithFreshContent({
      initial: await withCharts(chartContent),
      readContent: async () => ({ contentDigest: `moving-${reads += 1}`, chart: false }),
      withCharts,
      prepare: prepareSpy,
      authorize,
    });
    expect(restless).toEqual({ authorized: false });
    expect(prepareSpy).toHaveBeenCalledTimes(2);
  });

  it('sends nothing when the subscriber is gone or the refusal is not explained by moved content', async () => {
    const authorize = vi.fn().mockResolvedValue(false);
    await expect(authorizeWithFreshContent({
      initial: await withCharts(chartContent),
      readContent: vi.fn().mockResolvedValue(null),
      withCharts,
      prepare,
      authorize,
    })).resolves.toEqual({ authorized: false });
    expect(authorize).not.toHaveBeenCalled();

    await expect(authorizeWithFreshContent({
      initial: await withCharts(chartContent),
      readContent: vi.fn().mockResolvedValue(chartContent),
      withCharts,
      prepare,
      authorize,
    })).resolves.toEqual({ authorized: false });
    expect(authorize).toHaveBeenCalledOnce();
  });
});
