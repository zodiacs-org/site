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

// The share links' query key (RESULT_SHARE_ROUTE_KEY in src/server/result-preview.ts, held equal by its test).
// The share module is the heaviest this function would load at start, and share links are a few calls a week, so
// it loads when one is asked for and a cold start for /mcp, nearly all of this function's traffic, skips it.
export const COMPATIBILITY_SHARE_ROUTE_KEY = '__zodiacs_share';

// /mcp is nearly all of this function's traffic. On Vercel (VERCEL_ENV is set) the AI runtime loads, and answers
// initialize and tools/list once inside the instance (warmUp), while the instance starts, so a prewarmed instance
// answers its first /mcp call at warm speed instead of loading and warming then. This module awaits both: a
// promise left running would not be waited for when the instance is prewarmed, and could still be loading when
// the first call arrives. Every cold start pays for it, including the few for other routes, which /mcp's share
// of the traffic outweighs. Elsewhere (tests, local tools) it loads on first use, as before. A failed load is not
// kept: the next /mcp call tries again (Node itself keeps an error thrown while the module ran), and a failed
// warm-up changes nothing, so neither can stop this function from starting.
let aiHandler: Promise<typeof import('./_ai/handler.js')> | undefined;
function loadAiHandler(): Promise<typeof import('./_ai/handler.js')> {
  aiHandler ??= import('./_ai/handler.js').catch((error: unknown) => {
    aiHandler = undefined;
    throw error;
  });
  return aiHandler;
}
// Start-up waits two seconds at most: a load or warm-up that has not finished by then goes on in the background.
const WARM_UP_WAIT_MS = 2000;
if (process.env.VERCEL_ENV) {
  await Promise.race([
    loadAiHandler().then((ai) => ai.warmUp()).catch(() => undefined),
    new Promise<void>((resolve) => setTimeout(resolve, WARM_UP_WAIT_MS).unref()),
  ]);
}

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
  if (req.query?.__zodiacs_ai !== undefined) {
    const ai = await loadAiHandler();
    await (req.query.__zodiacs_ai === 'de440' ? ai.de440 : ai.default)(req, res);
    return;
  }
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
  // Share links for a compatibility score and a date's rating, and their preview images.
  const shareRoute = req.query?.[COMPATIBILITY_SHARE_ROUTE_KEY];
  if (shareRoute !== undefined) {
    const share = await import('../src/server/result-preview.js');
    if (share.isResultShareRoute(shareRoute)) {
      await share.handleResultShareNodeRequest(req, res, shareRoute);
      return;
    }
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
