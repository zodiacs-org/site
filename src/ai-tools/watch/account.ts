import { createClient } from '@supabase/supabase-js';

const get = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const status = get('status');
const show = (id: string, visible: boolean) => { get(id).hidden = !visible; };
const message = (text: string) => { status.textContent = text; };
let busy = false;
async function run(fn: () => Promise<void>) {
  if (busy) return; busy = true;
  document.querySelectorAll<HTMLButtonElement>('button').forEach(button => { button.disabled = true; });
  try { await fn(); } catch { message('This request could not be completed. Try again, or contact admin@zodiacs.org.'); }
  finally { busy = false; document.querySelectorAll<HTMLButtonElement>('button').forEach(button => { button.disabled = false; }); }
}
function redirect(value: string) {
  const url = new URL(value);
  // Provider-supplied destinations are constrained too. No arbitrary external navigation.
  if (url.protocol !== 'https:' || url.username || url.password || url.port
    || !(url.hostname === 'chatgpt.com' && (url.pathname.startsWith('/connector/oauth/') || url.pathname === '/connector_platform_oauth_redirect')
      || url.origin === location.origin && url.pathname === '/oauth/test-callback')) throw new Error('redirect-refused');
  location.assign(url.href);
}
void run(async () => {
  const response = await fetch('/account-config', { cache: 'no-store' });
  if (!response.ok) throw new Error('unavailable');
  const config = await response.json() as { url: string; key: string; clients: string[] };
  const client = createClient(config.url, config.key, { auth: { persistSession: true, storage: sessionStorage,
    autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce', storageKey: 'zodiacs-sky-watch-preview' } });
  const authorization = new URL(location.href).searchParams.get('authorization_id');
  let continuation: string | undefined;
  async function account() {
    const { data, error } = await client.auth.getUser();
    const signedIn = !error && !!data.user;
    show('login', !signedIn); show('account', signedIn); show('consent', false);
    if (!signedIn) { message('Sign in to connect Sky Watch or manage your connections.'); return; }
    get('identity').textContent = data.user.email ?? 'Signed in';
    if (authorization) {
      if (!/^[A-Za-z0-9_-]{8,256}$/.test(authorization)) throw new Error('invalid-authorization');
      const result = await client.auth.oauth.getAuthorizationDetails(authorization);
      if (result.error) { message('This connection request has expired. Return to ChatGPT and try connecting again.'); return; }
      if ('redirect_url' in result.data) {
        continuation = result.data.redirect_url;
        get('client-name').textContent = 'Continue your existing connection';
        get('scope-list').textContent = 'You already approved this connection.';
      } else {
        if (!config.clients.includes(result.data.client.id)) { message('This application is not enabled for the Sky Watch preview.'); return; }
        get('client-name').textContent = `Connect ${result.data.client.name}`;
        get('scope-list').textContent = `Requested identity access: ${result.data.scope.split(' ').join(', ')}.`;
      }
      show('consent', true); message('Review the access below before continuing.');
    } else message('Manage the applications you have connected to Sky Watch.');
    const grants = await client.auth.oauth.listGrants();
    if (grants.error) throw grants.error;
    const list = get('connections'); list.replaceChildren();
    for (const grant of grants.data.filter(grant => config.clients.includes(grant.client.id))) {
      const row = document.createElement('li'); const name = document.createElement('span'); name.textContent = grant.client.name;
      const button = document.createElement('button'); button.type = 'button'; button.textContent = 'Disconnect'; button.className = 'secondary';
      button.addEventListener('click', () => void run(async () => {
        const result = await client.auth.oauth.revokeGrant({ clientId: grant.client.id });
        if (result.error) throw result.error;
        await account(); message('Disconnected. Further deliveries for this connection are stopped.');
      }));
      row.append(name, button); list.append(row);
    }
    if (!list.children.length) { const empty = document.createElement('li'); empty.textContent = 'No connected applications.'; list.append(empty); }
  }
  get<HTMLFormElement>('login-form').addEventListener('submit', event => {
    event.preventDefault(); void run(async () => {
      const result = await client.auth.signInWithPassword({ email: get<HTMLInputElement>('email').value.trim(), password: get<HTMLInputElement>('password').value });
      get<HTMLInputElement>('password').value = '';
      if (result.error) { message('Sign-in failed. Check your email, password and email confirmation.'); return; }
      await account();
    });
  });
  get('create-account').addEventListener('click', () => void run(async () => {
    const form = get<HTMLFormElement>('login-form'); if (!form.reportValidity()) return;
    if (get<HTMLInputElement>('password').value.length < 12) { message('Choose a unique password with at least 12 characters for your preview account.'); return; }
    const result = await client.auth.signUp({ email: get<HTMLInputElement>('email').value.trim(), password: get<HTMLInputElement>('password').value,
      options: { emailRedirectTo: `${location.origin}/oauth/consent` } });
    get<HTMLInputElement>('password').value = '';
    if (result.error) { message('Account creation is unavailable. This private preview uses a limited email service; contact admin@zodiacs.org for access.'); return; }
    message('Check your email to confirm your preview account, then return to ChatGPT to connect.');
  }));
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
    await account(); message('Signed out of this page. Use Disconnect to stop an application’s watches.');
  }));
  await account();
});
