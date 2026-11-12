import {
  accountChartBodies,
  decryptAccountChartSource,
  type AccountChartSource,
} from '../account-api/chart-sources';
import type { MinimalBody } from '../engine/synastry';

/**
 * The weekly digest's chart edition, for an account that holds chart_sync and
 * chart_emails, and the discipline around it:
 *
 * - The content snapshot (weekly_digest_content_v1) names the account's self
 *   chart id and revision only while it is eligible. The chart is decrypted
 *   only after a fresh read of the account's eligible self chart, made
 *   immediately before decryption, still shows that same id and revision.
 * - Immediately before dispatch, weekly_digest_authorized_v1 recomputes the
 *   snapshot under the profile row lock and refuses an envelope built from a
 *   snapshot that has moved. A refusal is read again: if the account is now
 *   on the sky edition (it withdrew chart emails during the run), the digest
 *   is rebuilt as the sky edition and authorized once more.
 *
 * Nothing here logs; a failure only means the sky edition.
 */

const CONTROL_CHARACTER = /[\u0000-\u001f\u007f]/u;

export interface DigestChart {
  name: string;
  bodies: MinimalBody[];
}

export interface DigestChartReference {
  chartId: string;
  revision: number;
}

function objectValue(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

/** A renderable digest chart: a bounded name and finite longitudes, or null. */
export function digestChart(value: unknown): DigestChart | null {
  const chart = objectValue(value);
  if (!chart
    || typeof chart.name !== 'string'
    || [...chart.name].length < 1
    || [...chart.name].length > 200
    || CONTROL_CHARACTER.test(chart.name)
    || !Array.isArray(chart.bodies)
    || chart.bodies.length < 1
    || chart.bodies.length > 64) return null;

  const bodies: MinimalBody[] = [];
  for (const valueBody of chart.bodies) {
    const body = objectValue(valueBody);
    if (!body
      || typeof body.body !== 'string'
      || [...body.body].length < 1
      || [...body.body].length > 32
      || CONTROL_CHARACTER.test(body.body)
      || typeof body.lon !== 'number'
      || !Number.isFinite(body.lon)
      || body.lon < 0
      || body.lon >= 360) return null;
    bodies.push({ body: body.body, lon: body.lon });
  }
  return { name: chart.name, bodies };
}

export type DigestChartOutcome = 'sky' | 'chart' | 'fell_back';

/**
 * The chart for this digest, or none. `loadSource` reads the account's
 * current eligible self chart fresh (account_v2_chart_email_sources for this
 * one account); it is called only when the snapshot names a chart, and the
 * envelope is decrypted only when it still has the snapshot's id and
 * revision. Any failure, or a chart that moved, means the sky edition.
 */
export async function decryptDigestChart(
  reference: DigestChartReference | null,
  {
    loadSource,
    env,
    decrypt = decryptAccountChartSource,
  }: {
    loadSource: () => Promise<AccountChartSource | null>;
    env: Record<string, unknown>;
    decrypt?: typeof decryptAccountChartSource;
  },
): Promise<{ outcome: DigestChartOutcome; charts: DigestChart[] }> {
  if (!reference) return { outcome: 'sky', charts: [] };
  try {
    const source = await loadSource();
    if (source
      && source.chartId.toLowerCase() === reference.chartId.toLowerCase()
      && source.revision === reference.revision) {
      const payload = decrypt(source, env);
      const chart = payload
        ? digestChart({ name: payload.label, bodies: accountChartBodies(payload) })
        : null;
      if (chart) return { outcome: 'chart', charts: [chart] };
    }
  } catch {
    // The sky edition is sent instead.
  }
  return { outcome: 'fell_back', charts: [] };
}

export type WeeklyAuthorization<Recipient, Prepared> =
  | { authorized: true; recipient: Recipient; prepared: Prepared }
  | { authorized: false };

/**
 * Builds the envelope and authorizes it against fresh content. Before each
 * authorization the content is read again (without decrypting anything); if
 * it moved, the digest is rebuilt from the new content. If the authorization
 * is refused, the content is read once more and, if it moved (for example
 * chart emails were withdrawn between the read and the authorization), the
 * digest is rebuilt and authorized again. At most `attempts` envelopes are
 * built; anything else is not authorized and the caller cancels.
 */
export async function authorizeWithFreshContent<
  Content extends { contentDigest: string },
  Recipient extends Content,
  Prepared,
>({
  initial,
  readContent,
  withCharts,
  prepare,
  authorize,
  attempts = 2,
}: {
  initial: Recipient;
  /** The current content snapshot, no chart decrypted; null when not eligible. */
  readContent: () => Promise<Content | null>;
  /** Adds the chart for content that names one (see decryptDigestChart). */
  withCharts: (content: Content) => Promise<Recipient>;
  prepare: (recipient: Recipient) => Prepared;
  authorize: (prepared: Prepared, recipient: Recipient) => Promise<boolean>;
  attempts?: number;
}): Promise<WeeklyAuthorization<Recipient, Prepared>> {
  let recipient = initial;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const prepared = prepare(recipient);
    const current = await readContent();
    if (!current) return { authorized: false };
    if (current.contentDigest !== recipient.contentDigest) {
      recipient = await withCharts(current);
      continue;
    }
    if (await authorize(prepared, recipient)) return { authorized: true, recipient, prepared };
    const after = await readContent();
    if (!after || after.contentDigest === recipient.contentDigest) return { authorized: false };
    recipient = await withCharts(after);
  }
  return { authorized: false };
}
