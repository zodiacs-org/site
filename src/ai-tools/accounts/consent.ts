/**
 * The consent page Supabase's OAuth server sends a person to when an assistant
 * asks to connect their Zodiacs account. It runs on zodiacs.org with the same
 * client settings as the site, so a person signed in on the site is signed in
 * here. Built into integrations/generated/accounts-consent.mjs by
 * scripts/build-accounts-consent.mjs; served only while ZODIACS_ACCOUNTS_ENABLED=1.
 */
import { createClient } from '@supabase/supabase-js';

const get = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const show = (id: string, visible: boolean) => { get(id).hidden = !visible; };
const message = (text: string) => { get('status').textContent = text; };
let busy = false;
async function run(fn: () => Promise<void>) {
  if (busy) return; busy = true;
  document.querySelectorAll<HTMLButtonElement>('button').forEach(button => { button.disabled = true; });
  try { await fn(); } catch { message('This could not be completed. Try again, or write to admin@zodiacs.org.'); }
  finally { busy = false; document.querySelectorAll<HTMLButtonElement>('button').forEach(button => { button.disabled = false; }); }
}

/** Only the assistants' own OAuth return addresses, and never anything else. */
export function allowedRedirect(value: string): boolean {
  let url: URL;
  try { url = new URL(value); } catch { return false; }
  if (url.protocol !== 'https:' || url.username || url.password || url.port) return false;
  if (url.hostname === 'chatgpt.com') return url.pathname.startsWith('/connector/oauth/') || url.pathname === '/connector_platform_oauth_redirect';
  if (url.hostname === 'claude.ai' || url.hostname === 'claude.com') return url.pathname === '/api/mcp/auth_callback';
  return false;
}
function redirect(value: string) {
  if (!allowedRedirect(value)) throw new Error('redirect-refused');
  location.assign(value);
}

export function consentKind(client: string, config: { clients: readonly string[]; previewWatchClients?: readonly string[] }): 'accounts' | 'watch' | undefined {
  const accounts = config.clients.includes(client);
  const watch = config.previewWatchClients?.includes(client) ?? false;
  return accounts === watch ? undefined : accounts ? 'accounts' : 'watch';
}

const WATCH_PERMISSIONS = [
  'Read computed public sky events.',
  'Create, refresh and cancel watches you request.',
  'Deliver those events to your connected ChatGPT account.',
  'The connected application receives your preview account ID and email address.',
];

async function start() {
  const raw = get('zodiacs-consent-config').textContent ?? '';
  const config = JSON.parse(raw) as { url: string; key: string; clients: string[]; previewWatchClients?: string[] };
  if (config.previewWatchClients?.length) get('consent-intro').textContent = 'Connect an assistant to your Zodiacs preview account. Review the access for this connection before allowing it.';
  // The site's own client settings, so the site's sign-in is shared.
  const client = createClient(config.url, config.key, { auth: { autoRefreshToken: true, detectSessionInUrl: true, persistSession: true } });
  const authorization = new URL(location.href).searchParams.get('authorization_id');
  let continuation: string | undefined;
  async function account() {
    const { data, error } = await client.auth.getUser();
    const signedIn = !error && !!data.user;
    show('login', !signedIn); show('account', signedIn); show('consent', false);
    if (!signedIn) { message(authorization ? 'Sign in to your Zodiacs account to connect your assistant.' : 'Sign in to see the assistants connected to your account.'); return; }
    get('identity').textContent = data.user.email ?? 'Signed in';
    if (authorization) {
      if (!/^[A-Za-z0-9_-]{8,256}$/.test(authorization)) throw new Error('invalid-authorization');
      const result = await client.auth.oauth.getAuthorizationDetails(authorization);
      if (result.error) { message('This connection request has expired. Go back to your assistant and connect again.'); return; }
      if ('redirect_url' in result.data) {
        continuation = result.data.redirect_url;
        get('client-name').textContent = 'Continue your connection';
        get('scope-list').textContent = 'You have already allowed this assistant.';
        show('permission-details', false);
      } else {
        const kind = consentKind(result.data.client.id, config);
        if (!kind) { message('This application cannot connect to Zodiacs accounts.'); return; }
        if (kind === 'watch') {
          const list = get('permission-list'); list.replaceChildren();
          for (const text of WATCH_PERMISSIONS) { const item = document.createElement('li'); item.textContent = text; list.append(item); }
          get('permission-note').textContent = 'No birth details are needed for Sky Watch. Watches expire within seven days unless you refresh them. Disconnecting stops further deliveries.';
        }
        show('permission-details', true);
        get('client-name').textContent = `Connect ${result.data.client.name}`;
        get('scope-list').textContent = `${result.data.client.name} will be able to:`;
      }
      show('consent', true); message('Check what you are allowing before you continue.');
    } else message(config.previewWatchClients?.length ? 'These applications are connected to your preview account.' : 'These assistants can save to your account.');
    const grants = await client.auth.oauth.listGrants();
    if (grants.error) throw grants.error;
    const list = get('connections'); list.replaceChildren();
    for (const grant of grants.data.filter(grant => consentKind(grant.client.id, config))) {
      const row = document.createElement('li'); const name = document.createElement('span'); name.textContent = grant.client.name;
      const button = document.createElement('button'); button.type = 'button'; button.textContent = 'Disconnect'; button.className = 'secondary';
      button.addEventListener('click', () => void run(async () => {
        const result = await client.auth.oauth.revokeGrant({ clientId: grant.client.id });
        if (result.error) throw result.error;
        await account(); message(consentKind(grant.client.id, config) === 'watch'
          ? 'Disconnected. That application can no longer watch sky events for you.'
          : 'Disconnected. That assistant can no longer save to your account. What it saved stays until you delete it.');
      }));
      row.append(name, button); list.append(row);
    }
    if (!list.children.length) { const empty = document.createElement('li'); empty.textContent = 'No assistants are connected.'; list.append(empty); }
  }
  get<HTMLFormElement>('login-form').addEventListener('submit', event => {
    event.preventDefault(); void run(async () => {
      // Back to this exact page, with its authorization request, after the link is opened.
      const result = await client.auth.signInWithOtp({ email: get<HTMLInputElement>('email').value.trim(), options: { emailRedirectTo: location.href, shouldCreateUser: true } });
      if (result.error) { message('The sign-in link could not be sent. Check the address and try again in a minute.'); return; }
      message('Check your email for the sign-in link, and open it on this device.');
    });
  });
  get<HTMLFormElement>('password-form').addEventListener('submit', event => {
    event.preventDefault(); void run(async () => {
      const result = await client.auth.signInWithPassword({ email: get<HTMLInputElement>('password-email').value.trim(), password: get<HTMLInputElement>('password').value });
      get<HTMLInputElement>('password').value = '';
      if (result.error) { message('Sign-in failed. Check the email address and password.'); return; }
      await account();
    });
  });
  get('approve').addEventListener('click', () => void run(async () => {
    if (continuation) { redirect(continuation); return; }
    if (!authorization) return;
    const result = await client.auth.oauth.approveAuthorization(authorization, { skipBrowserRedirect: true });
    if (result.error) throw result.error; redirect(result.data.redirect_url);
  }));
  get('deny').addEventListener('click', () => void run(async () => {
    if (!authorization) return;
    const result = await client.auth.oauth.denyAuthorization(authorization, { skipBrowserRedirect: true });
    if (result.error) throw result.error; redirect(result.data.redirect_url);
  }));
  get('sign-out').addEventListener('click', () => void run(async () => {
    const result = await client.auth.signOut({ scope: 'local' }); if (result.error) throw result.error;
    await account(); message('Signed out of this page. Connected assistants stay connected until you disconnect them.');
  }));
  await account();
}

if (typeof document !== 'undefined' && document.getElementById('zodiacs-consent-config')) void run(start);
