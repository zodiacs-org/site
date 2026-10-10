/**
 * Saves the public incident lists of a fixed set of status pages, for the
 * Mercury Retrograde Reality Check (24 Oct–13 Nov 2026). Statuspage feeds
 * show only their 50 most recent incidents, so a daily copy is the only way
 * to keep the record. Public data only: no keys, no personal data.
 *
 * Run: node scripts/status-archive.mjs --out <directory>
 * Writes one <slug>.json per feed as received, and summary.json.
 * Exits 1 only when no feed could be read.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

/** Atlassian Statuspage sites, read through the public /api/v2/incidents.json. */
export const STATUS_FEEDS = Object.freeze([
  { slug: 'github', name: 'GitHub', url: 'https://www.githubstatus.com/api/v2/incidents.json' },
  { slug: 'cloudflare', name: 'Cloudflare', url: 'https://www.cloudflarestatus.com/api/v2/incidents.json' },
  { slug: 'atlassian', name: 'Atlassian', url: 'https://status.atlassian.com/api/v2/incidents.json' },
  { slug: 'discord', name: 'Discord', url: 'https://discordstatus.com/api/v2/incidents.json' },
  { slug: 'reddit', name: 'Reddit', url: 'https://www.redditstatus.com/api/v2/incidents.json' },
  { slug: 'zoom', name: 'Zoom', url: 'https://status.zoom.us/api/v2/incidents.json' },
  { slug: 'dropbox', name: 'Dropbox', url: 'https://status.dropbox.com/api/v2/incidents.json' },
  { slug: 'digitalocean', name: 'DigitalOcean', url: 'https://status.digitalocean.com/api/v2/incidents.json' },
  { slug: 'twilio', name: 'Twilio', url: 'https://status.twilio.com/api/v2/incidents.json' },
  { slug: 'vercel', name: 'Vercel', url: 'https://www.vercel-status.com/api/v2/incidents.json' },
]);

/** Reads one feed; never throws. */
export async function readFeed(feed, fetchImpl = fetch, timeoutMs = 20_000) {
  try {
    const response = await fetchImpl(feed.url, { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(timeoutMs) });
    if (!response.ok) return { ok: false, error: `HTTP ${response.status}` };
    const text = await response.text();
    const data = JSON.parse(text);
    if (!Array.isArray(data?.incidents)) return { ok: false, error: 'no incidents list' };
    const created = data.incidents.map((incident) => incident.created_at).filter((at) => typeof at === 'string').sort();
    return { ok: true, text, incidents: data.incidents.length, oldest: created[0] ?? null, newest: created.at(-1) ?? null };
  } catch (error) {
    return { ok: false, error: error?.name === 'TimeoutError' ? 'timed out' : String(error?.message ?? error) };
  }
}

export async function archiveStatusFeeds(out, { feeds = STATUS_FEEDS, fetchImpl = fetch, now = () => new Date() } = {}) {
  await mkdir(out, { recursive: true });
  const results = [];
  for (const feed of feeds) {
    const result = await readFeed(feed, fetchImpl);
    if (result.ok) await writeFile(join(out, `${feed.slug}.json`), result.text);
    const { text, ...rest } = result;
    results.push({ slug: feed.slug, name: feed.name, url: feed.url, ...rest });
  }
  const summary = { schema: 'zodiacs.status-archive.v1', savedAt: now().toISOString(), feeds: results };
  await writeFile(join(out, 'summary.json'), `${JSON.stringify(summary, null, 2)}\n`);
  return summary;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const at = process.argv.indexOf('--out');
  if (at < 0 || !process.argv[at + 1]) throw new Error('Usage: node scripts/status-archive.mjs --out <directory>');
  const summary = await archiveStatusFeeds(process.argv[at + 1]);
  for (const feed of summary.feeds) {
    console.log(feed.ok ? `saved ${feed.name}: ${feed.incidents} incidents, ${feed.oldest} to ${feed.newest}` : `missed ${feed.name}: ${feed.error}`);
  }
  if (!summary.feeds.some((feed) => feed.ok)) {
    console.error('No status feed could be read.');
    process.exit(1);
  }
}
