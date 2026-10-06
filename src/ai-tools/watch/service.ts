import { ProtocolError } from '@modelcontextprotocol/server';
import { z } from 'zod';
import { callbackPost, callbackUrl, verifyCallback, type CallbackPost } from './callback';
import { destinationVault, digest, signingKey } from './crypto';
import { DAY, EVENT_DEFINITIONS, FILTERS, subscriptionParams, unsubscribeParams, type Principal, type Rpc } from './contracts';
import { watchRpc } from './store';
import { configuredWatchOAuth, type WatchOAuth } from './oauth';

export class SkyWatch {
  readonly vault: ReturnType<typeof destinationVault>;
  constructor(readonly rpc: Rpc, encryptionKey: string, readonly post: CallbackPost = callbackPost, readonly now = Date.now, readonly oauth?: WatchOAuth) {
    this.vault = destinationVault(encryptionKey);
  }
  async authenticate(header: unknown): Promise<Principal | null> {
    if (this.oauth) return typeof header === 'string' && header.startsWith('Bearer ') ? this.oauth.authenticate(header.slice(7)) : null;
    if (typeof header !== 'string' || !/^Bearer zsw_[A-Za-z0-9_-]{43}$/.test(header)) return null;
    return this.rpc<Principal | null>('authenticate', { token_hash: digest(header.slice(7)) });
  }
  async subscribe(owner: Principal, raw: unknown) {
    const params = subscriptionParams.parse(raw);
    const filters = FILTERS[params.name].parse(params.arguments);
    const url = callbackUrl(params.delivery.url).href; const secret = params.delivery.secret;
    signingKey(secret);
    const id = `sub_${digest(JSON.stringify([owner.id, params.name, filters, url]))}`;
    const previous = await this.rpc<any>('get', { owner: owner.id, id });
    const previousValue = previous?.sealed ? this.vault.open(previous.sealed, id) : null;
    // Verification is reused only for this principal/identity and unchanged signing key.
    const needsVerification = !previousValue || previousValue.secret !== secret || Date.parse(previous.verified_until) <= this.now();
    if (needsVerification) {
      try { await verifyCallback(url, secret, id, this.post, this.now()); }
      catch (error) { throw new ProtocolError(-32015, 'The callback could not be verified.', { reason: error instanceof Error && error.message === 'timeout' ? 'timeout' : 'challenge_failed' }); }
    }
    const result = await this.rpc<any>('subscribe', { owner: owner.id, id, name: params.name, filters,
      sealed: this.vault.seal({ url, secret }, id),
      // CAS prevents a concurrent refresh/unsubscribe from resurrecting an old request.
      expected_revision: previous?.revision ?? 0,
      rotated: previousValue !== null && previousValue.secret !== secret,
      verified: needsVerification,
      ttl_ms: Math.min(params.ttlMs ?? DAY, 7 * DAY),
    });
    if (!result) throw new ProtocolError(-32000, 'Subscription changed or access expired. Retry the request.');
    return { id, refreshBefore: result.expires_at as string, cursor: null, truncated: false };
  }
  async unsubscribe(owner: Principal, raw: unknown) {
    const params = unsubscribeParams.parse(raw);
    const filters = FILTERS[params.name].parse(params.arguments);
    const url = callbackUrl(params.delivery.url).href;
    const id = `sub_${digest(JSON.stringify([owner.id, params.name, filters, url]))}`;
    await this.rpc('unsubscribe', { owner: owner.id, id, name: params.name, filters });
    return {};
  }
}

/** The hosted preview uses OAuth; the local operator runner retains synthetic grants.
 * Both are preview-only and individually revocable. Never activate this mode in production.
 */
export function configuredSkyWatch(env: Readonly<Record<string, string | undefined>>): SkyWatch | undefined {
  if (env.ZODIACS_SKY_WATCH_ENABLED !== '1') return undefined;
  if (env.VERCEL_ENV !== 'preview' || !env.ZODIACS_SKY_WATCH_KEY) throw new Error('watch-preview-unavailable');
  const rpc = watchRpc(env);
  return new SkyWatch(rpc, env.ZODIACS_SKY_WATCH_KEY, callbackPost, Date.now, configuredWatchOAuth(env, rpc));
}

export function registerSkyWatch(server: import('@modelcontextprotocol/server').McpServer, watch: SkyWatch, owner: Principal) {
  const meta = { _meta: z.record(z.string(), z.unknown()).optional() };
  const guarded = <T>(run: () => Promise<T>) => run().catch(error => {
    if (error instanceof ProtocolError) throw error;
    throw new ProtocolError(-32602, 'The event request could not be completed under its schema or availability requirements.');
  });
  server.server.setRequestHandler('events/list', { params: z.object({ ...meta, cursor: z.null().optional() }).strict() },
    async () => ({ events: EVENT_DEFINITIONS }));
  server.server.setRequestHandler('events/subscribe', { params: subscriptionParams.extend(meta) },
    async ({ _meta, ...params }) => guarded(() => watch.subscribe(owner, params)));
  server.server.setRequestHandler('events/unsubscribe', { params: unsubscribeParams.extend(meta) },
    async ({ _meta, ...params }) => guarded(() => watch.unsubscribe(owner, params)));
}
