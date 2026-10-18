import { readFile, readdir } from 'node:fs/promises';
import { extname, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('account sync v2 cutover guards', () => {
  it('suppresses legacy account UI on every localized profile route', async () => {
    for (const locale of ['es', 'fr', 'it', 'pt', 'ru']) {
      const source = await readFile(
        new URL(`../../pages/${locale}/profile/index.astro`, import.meta.url),
        'utf8',
      );
      expect(source).toContain('accountSyncV2Enabled ? (');
      expect(source).toContain('<AccountBoundProfileSurface');
      expect(source).toContain(`<ProfileDashboard locale="${locale}"`);
      expect(source).toContain(`<ProfileManager locale="${locale}"`);
      expect(source).toContain('PUBLIC_ACCOUNT_SYNC_V2_PREVIEW_ACK');
      expect(source).toContain('privateSurface={accountSyncV2Enabled}');
    }
  });

  it('keeps the English chart surfaces out of the DOM until the local owner matches', async () => {
    const page = await readFile(new URL('../../pages/profile/index.astro', import.meta.url), 'utf8');
    const gate = await readFile(
      new URL('../../islands/AccountBoundProfileSurface.tsx', import.meta.url),
      'utf8',
    );
    expect(page).toContain('<AccountBoundProfileSurface');
    expect(page).toContain('accountSyncV2Enabled ? (');
    expect(page).toContain('privateSurface={accountSyncV2Enabled || livingChartSurfaceEnabled}');
    expect(gate).toContain("return boundary.status === 'ready' ? 'visible' : 'withheld';");
    expect(gate).toContain("if (access !== 'visible') return null;");
  });

  it('subscribes to auth before reading a session snapshot', async () => {
    for (const relativePath of [
      '../../islands/AccountProfileAccessBootstrap.tsx',
      '../../islands/AccountBoundProfileSurface.tsx',
    ]) {
      const source = await readFile(new URL(relativePath, import.meta.url), 'utf8');
      expect(source.indexOf('api.onSyncAuthChange('), relativePath).toBeGreaterThan(-1);
      expect(source.indexOf('api.onSyncAuthChange('), relativePath)
        .toBeLessThan(source.indexOf('await api.getSyncSession()'));
      expect(source, relativePath).toContain('authVersion !== snapshotVersion');
    }
  });

  it('blocks both queued and direct legacy synchronization in a v2 preview build', async () => {
    const source = await readFile(new URL('../profile/sync.ts', import.meta.url), 'utf8');
    expect(source).toContain('export async function syncNow(): Promise<boolean> {\n  if (ACCOUNT_SYNC_V2_ENABLED) return false;');
    expect(source).toContain('export function scheduleCloudSync(delay = 500): void {\n  if (ACCOUNT_SYNC_V2_ENABLED) return;');
  });

  it('guards non-profile chart readers before they touch shared local storage', async () => {
    const assistant = await readFile(new URL('../assistant/open-assistant.ts', import.meta.url), 'utf8');
    const today = await readFile(new URL('../../pages/today/index.astro', import.meta.url), 'utf8');
    const horoscope = await readFile(
      new URL('../../components/HoroscopeProgramPage.astro', import.meta.url),
      'utf8',
    );
    expect(assistant).toContain('if (!profileAccessAllowed()) return null;');
    expect(today).toContain('window.zodiacsProfileAccess.canRead()');
    expect(horoscope).toContain('window.zodiacsProfileAccess.canRead()');
  });

  it('keeps direct private-profile storage access inside approved guarded adapters', async () => {
    const sourceRoot = resolve(new URL('../..', import.meta.url).pathname);
    const sourceFiles = await sourceFilesBelow(sourceRoot);
    const privateKeys = [
      'PROFILE_KEY',
      'PROFILE_DELETIONS_KEY',
      'PAIRS_KEY',
      'YEAR_AHEAD_CACHE_KEY',
      'DAILY_CHART_SELECTION_KEY',
      'ME_KEY',
      'CIRCLE_KEY',
      "['\"]zodiacs\\.profile\\.v1['\"]",
      "['\"]zodiacs\\.profile\\.deletions\\.v1['\"]",
      "['\"]zodiacs\\.pairs\\.v1['\"]",
      "['\"]zodiacs\\.yearahead\\.v1['\"]",
      "['\"]zodiacs\\.daily-chart-selection\\.v1['\"]",
      "['\"]zodiacs\\.me\\.v1['\"]",
      "['\"]zodiacs\\.circle\\.v1['\"]",
    ].join('|');
    const directAccess = new RegExp(
      `localStorage\\s*\\.\\s*(?:getItem|setItem|removeItem)\\s*\\(\\s*(?:${privateKeys})`,
      'gu',
    );
    const approvedAdapters = new Set([
      'components/HoroscopeProgramPage.astro',
      'components/SiteNav.astro',
      'components/profile/ProfilePrepaint.astro',
      'islands/ProfileDashboard.tsx',
      'lib/assistant/open-assistant.ts',
      'lib/profile/circle.ts',
      'lib/profile/daily-email-client.ts',
      'lib/profile/deletions.ts',
      'lib/profile/me.ts',
      'lib/profile/pairs.ts',
      'lib/profile/read-store.ts',
      'lib/profile/store.ts',
      'pages/today/index.astro',
    ]);
    const discovered: string[] = [];
    for (const file of sourceFiles) {
      const source = await readFile(file, 'utf8');
      if (directAccess.test(source)) discovered.push(relative(sourceRoot, file));
      directAccess.lastIndex = 0;
    }

    expect(discovered.sort()).toEqual([...approvedAdapters].sort());

    for (const path of [
      'components/HoroscopeProgramPage.astro',
      'components/SiteNav.astro',
      'components/profile/ProfilePrepaint.astro',
      'pages/today/index.astro',
    ]) {
      const source = await readFile(resolve(sourceRoot, path), 'utf8');
      const guard = source.indexOf('zodiacsProfileAccess');
      const access = source.indexOf("localStorage.getItem('zodiacs.profile.v1')");
      expect(guard, path).toBeGreaterThan(-1);
      expect(access, path).toBeGreaterThan(guard);
    }

    for (const path of [
      'islands/ProfileDashboard.tsx',
      'lib/assistant/open-assistant.ts',
      'lib/profile/circle.ts',
      'lib/profile/daily-email-client.ts',
      'lib/profile/me.ts',
      'lib/profile/deletions.ts',
      'lib/profile/pairs.ts',
      'lib/profile/read-store.ts',
      'lib/profile/store.ts',
    ]) {
      const source = await readFile(resolve(sourceRoot, path), 'utf8');
      expect(source, path).toContain('profileAccessAllowed');
    }
  });

  it('keeps the synchronous profile guard out of the full account state bundle', async () => {
    const source = await readFile(new URL('./profile-access.ts', import.meta.url), 'utf8');
    const reader = await readFile(new URL('./profile-access-reader.ts', import.meta.url), 'utf8');
    expect(source).toContain("from './storage-identity';");
    expect(source).not.toContain("from './local-state';");
    expect(source).toContain("from './profile-access-reader';");
    expect(reader).toContain("Reflect.get(window, 'zodiacsProfileAccess')");
    expect(reader).not.toContain("from './storage-identity';");
  });

  it('scopes remote analytics away from Guide and the private preview build', async () => {
    const base = await readFile(new URL('../../layouts/Base.astro', import.meta.url), 'utf8');
    const guide = await readFile(new URL('../../pages/ask/index.astro', import.meta.url), 'utf8');
    expect(base).not.toContain('guideRuntimeEnabled');
    expect(base).toContain('plausibleScriptUrl && (!props.noindex || props.analyticsOnNoindex) && !props.privateSurface');
    expect(base).toContain('&& !accountSyncV2Enabled,');
    expect(base).toContain('data-guide-analytics-boundary={plausibleEnabled || webAnalyticsEnabled ?');
    // The flagged Vercel pageview counter sits behind the same surface exclusions
    // and the same private-session check as Plausible.
    expect(base).toContain('vercelWebAnalyticsFlag(import.meta.env) && (!props.noindex || props.analyticsOnNoindex) && !props.privateSurface');
    const vercelBlock = base.slice(base.indexOf('{webAnalyticsEnabled && ('), base.indexOf('<slot name="head" />'));
    expect(vercelBlock).toContain("sessionStorage.getItem(guidePrivateSessionKey) === '1'");
    expect(vercelBlock).toContain("insights.src = '/_vercel/insights/script.js';");
    expect(vercelBlock).toContain('url.search = \'\';');
    expect(base).toContain("sessionStorage.getItem(guidePrivateSessionKey) === '1'");
    expect(guide).toContain('privateSurface');
    expect(base).toContain('Object.keys(value).length === expectedLength');
    expect(base).toContain("profileAccountId.test(grant.accountId)");
    expect(base).toContain("profileAccountId.test(owner.accountId)");
  });
});

async function sourceFilesBelow(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) return sourceFilesBelow(path);
    return ['.astro', '.ts', '.tsx'].includes(extname(entry.name)) && !entry.name.includes('.test.')
      ? [path]
      : [];
  }));
  return nested.flat();
}
