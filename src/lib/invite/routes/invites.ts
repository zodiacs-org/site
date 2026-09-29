import { authenticateEmailUser } from '../../email/daily-server.js';
import { sendInviteJson, allowInviteMethods, validInviteBrowserRequest } from '../api.js';
import {
  compatibilityInviteBaseUrl,
  compatibilityInviteCreationEnabled,
  compatibilityInviteUserAllowed,
  hasCompatibilityInviteContract,
} from '../config.js';
import {
  createCompatibilityInvite,
  getOwnedSyncedChartPayload,
  listCompatibilityInvites,
} from '../server.js';
import {
  compatibilityInviteTokenHash,
  createCompatibilityInviteToken,
} from '../token.js';
import { deriveInviteChartFromSyncedPayload, parseCreateInviteBody } from '../validate.js';
import { POSITION_BODY_ORDER } from '../../share-positions.js';

export default async function handler(req: any, res: any): Promise<void> {
  if (req.method !== 'GET' && req.method !== 'POST') {
    allowInviteMethods(res, ['GET', 'POST']);
    sendInviteJson(res, 405, { error: 'method' });
    return;
  }
  if (!validInviteBrowserRequest(req, req.method === 'POST')) {
    sendInviteJson(res, 403, { error: 'forbidden' });
    return;
  }
  if (!hasCompatibilityInviteContract(process.env)) {
    sendInviteJson(res, 404, { error: 'not_found' });
    return;
  }
  if (req.method === 'POST' && !compatibilityInviteCreationEnabled(process.env)) {
    sendInviteJson(res, 404, { error: 'not_found' });
    return;
  }

  try {
    const owner = await authenticateEmailUser(req);
    if (!owner) {
      sendInviteJson(res, 401, { error: 'sign_in_required' });
      return;
    }
    if (req.method === 'GET') {
      const invites = await listCompatibilityInvites(owner.id);
      sendInviteJson(res, 200, { invites });
      return;
    }
    if (!compatibilityInviteUserAllowed(owner.id, process.env)) {
      sendInviteJson(res, 403, { error: 'canary_only' });
      return;
    }
    const input = parseCreateInviteBody(req.body);
    if (!input) {
      sendInviteJson(res, 400, { error: 'invalid_request' });
      return;
    }
    const syncedPayload = await getOwnedSyncedChartPayload(owner.id, input.chartId);
    // A chart without a birth time is shared as the sky at 12:00 UTC on its
    // date, and one whose instant has seconds (before standard time) at its
    // whole minute; the server ephemeris computes them (loaded only on this path).
    const { bodyLongitude } = await import('../../engine/server-ephemeris.js');
    const chart = deriveInviteChartFromSyncedPayload(
      syncedPayload,
      (utc) => POSITION_BODY_ORDER.map((body) => ({ body, lon: bodyLongitude(body, utc) })),
    );
    if (!chart) {
      sendInviteJson(res, 404, { error: 'chart_not_found' });
      return;
    }

    let token = createCompatibilityInviteToken();
    let tokenHash = compatibilityInviteTokenHash(token)!;
    let created = await createCompatibilityInvite(owner, chart, input.notify, tokenHash);
    if (created.outcome === 'token_conflict') {
      token = createCompatibilityInviteToken();
      tokenHash = compatibilityInviteTokenHash(token)!;
      created = await createCompatibilityInvite(owner, chart, input.notify, tokenHash);
    }
    if (created.outcome === 'active_limit') {
      sendInviteJson(res, 409, { error: 'active_limit' });
      return;
    }
    if (created.outcome === 'creation_rate_limit') {
      res.setHeader('Retry-After', '3600');
      sendInviteJson(res, 429, { error: 'creation_rate_limit' });
      return;
    }
    if (created.outcome !== 'created') {
      sendInviteJson(res, created.outcome === 'not_found' ? 404 : 503, {
        error: created.outcome === 'not_found' ? 'chart_not_found' : 'unavailable',
      });
      return;
    }
    const base = compatibilityInviteBaseUrl(process.env);
    sendInviteJson(res, 201, {
      id: created.id,
      url: `${base}/c/${token}/`,
      expiresAt: created.expiresAt,
      state: 'waiting',
    });
  } catch {
    sendInviteJson(res, 503, { error: 'unavailable' });
  }
}
