import { COMPUTE_ROUTE_PARAM } from '../src/lib/compute-api/constants.js';
import { sendInviteJson } from '../src/lib/invite/api.js';
import { handleGamesApi } from '../src/lib/games/server.js';
import { handleRegistryNews } from './_registry/news-handler.js';
import { handleChartPreviewNodeRequest } from '../src/server/chart-preview.js';
import completeHandler from '../src/lib/invite/routes/invite-complete.js';
import exchangeHandler from '../src/lib/invite/routes/invite-exchange.js';
import hideHandler from '../src/lib/invite/routes/invite-hide.js';
import revokeHandler from '../src/lib/invite/routes/invite-revoke.js';
import sessionHandler from '../src/lib/invite/routes/invite-session.js';
import sweepHandler from '../src/lib/invite/routes/invite-sweep.js';
import invitesHandler from '../src/lib/invite/routes/invites.js';

type InviteHandler = (req: any, res: any) => Promise<void>;

export const COMPATIBILITY_INVITE_ACTIONS = [
  'invites',
  'invite-exchange',
  'invite-session',
  'invite-complete',
  'invite-revoke',
  'invite-hide',
  'invite-sweep',
] as const;

type CompatibilityInviteAction = typeof COMPATIBILITY_INVITE_ACTIONS[number];

const HANDLERS: Readonly<Record<CompatibilityInviteAction, InviteHandler>> = Object.freeze({
  invites: invitesHandler,
  'invite-exchange': exchangeHandler,
  'invite-session': sessionHandler,
  'invite-complete': completeHandler,
  'invite-revoke': revokeHandler,
  'invite-hide': hideHandler,
  'invite-sweep': sweepHandler,
});

export function compatibilityInviteHandlerForAction(value: unknown): InviteHandler | null {
  if (typeof value !== 'string'
    || !COMPATIBILITY_INVITE_ACTIONS.includes(value as CompatibilityInviteAction)) {
    return null;
  }
  return HANDLERS[value as CompatibilityInviteAction];
}

export default async function handler(req: any, res: any): Promise<void> {
  // The compute API (/api/v1/chart and five more) rewrites here (vercel.json)
  // so it does not add a deployed function. Its handler owns everything past
  // this line for those routes, and loads only when one is asked for.
  if (req.query?.[COMPUTE_ROUTE_PARAM] !== undefined) {
    const { default: computeApi } = await import('./_compute/handler.js');
    await computeApi(req, res);
    return;
  }
  const previewRoute = req.query?.__zodiacs_og_route;
  if (previewRoute === 'link' || previewRoute === 'image') {
    await handleChartPreviewNodeRequest(req, res, previewRoute);
    return;
  }
  // /api/games rewrites here (vercel.json) so the Zodiac Games do not add a
  // deployed function; the Games handler owns everything past this line.
  if (req.query?.__zodiacs_games_route === '1') {
    await handleGamesApi(req, res);
    return;
  }
  if (req.query?.action === 'registry-news') {
    await handleRegistryNews(req, res);
    return;
  }
  const route = compatibilityInviteHandlerForAction(req.query?.action);
  if (!route) {
    sendInviteJson(res, 404, { error: 'not_found' });
    return;
  }
  await route(req, res);
}
