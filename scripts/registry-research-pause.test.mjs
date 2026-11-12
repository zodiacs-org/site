import { execFileSync } from 'node:child_process';
import { cp, mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  REGISTRY_RESEARCH_FEED_SCHEMA,
  REGISTRY_RESEARCH_LEDGER_SCHEMA,
  buildRegistryResearchLedger,
  canonicalRegistryResearchJson,
  compactRegistryResearchItem,
  immutableRegistryResearchItem,
  publishRegistryResearch,
  registryResearchIsPaused,
  registryResearchPauseNotice,
  registryResearchRss,
  validateRegistryResearchPause,
} from './registry-research-lib.mjs';
import { registryPairingProblems } from './check-registry-pairing.mjs';
import { readRegistryResearchPause } from './registry-research-pause.mjs';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DAY_MS = 86_400_000;

async function json(relativePath, root = repositoryRoot) {
  return JSON.parse(await readFile(resolve(root, relativePath), 'utf8'));
}

function addDays(date, days) {
  return new Date(Date.parse(`${date}T00:00:00.000Z`) + (days * DAY_MS)).toISOString().slice(0, 10);
}

function monthsCovering(date, days) {
  const months = new Set();
  for (let offset = 0; offset <= days; offset += 1) months.add(addDays(date, offset).slice(0, 7));
  return [...months];
}

// The generator's inputs for the committed outlook's own edition day, with
// approvals cleared and the pilot moved over that day so that every item
// needs an exact-hash approval to publish.
async function editionInputs() {
  const [outlook, marketHistory, approvalManifest] = await Promise.all([
    json('public/assets/registry-outlook.json'),
    json('public/assets/data/registry-market-history.v1.json'),
    json('src/data/registry-research/approval-manifest.json'),
  ]);
  const date = outlook.daily.date;
  const transitMonths = await Promise.all(monthsCovering(date, 8).map((month) => json(`src/data/transits-${month}.json`)));
  approvalManifest.approvals = [];
  approvalManifest.pilot.startsOn = date;
  approvalManifest.pilot.endsOn = addDays(date, 8);
  return {
    daily: { date, snapshotAt: `${date}T12:00:00.000Z` },
    outlook,
    transitMonths,
    marketHistory,
    approvalManifest,
  };
}

function pauseAt(pausedAt, status = 'paused') {
  return {
    schema: 'zodiacs.registry-research-pause.v1',
    status,
    pausedAt,
    reason: 'Test pause: no new sky reading beside market data.',
  };
}

function approvalFor(item, reviewedAt) {
  return { itemId: item.id, artifactSha256: item.artifactHash, reviewer: 'Registry editorial reviewer', reviewedAt };
}

function rssFor(publication, pause) {
  return registryResearchRss({
    schema: REGISTRY_RESEARCH_FEED_SCHEMA,
    generatedAt: publication.generatedAt,
    publisher: publication.publisher,
    window: publication.window,
    items: publication.items.filter((item) => publication.rollingItemIds.includes(item.id)).map(compactRegistryResearchItem),
  }, { pause });
}

describe('the committed pause record', () => {
  it('is valid, and while paused carries the owner decision of 12 November 2026', async () => {
    const pause = await readRegistryResearchPause();
    expect(pause).not.toBeNull();
    expect(() => validateRegistryResearchPause(pause)).not.toThrow();
    if (pause.status === 'paused') {
      expect(pause.pausedAt).toBe('2026-11-12T03:15:00.000Z');
      expect(pause.pausedAtLocal).toBe('2026-11-12 10:15 Asia/Bangkok');
      expect(pause.reason).toContain('8 October no-market-timing rule');
      expect(registryResearchPauseNotice(pause)).toBe(
        'Publishing has been paused since 12 November 2026. No new notes are being added; the notes listed here stay as an archive, as they were published.',
      );
    }
  });

  it('is reversed by its status alone, and a malformed record is refused', () => {
    const paused = pauseAt('2026-11-12T03:15:00.000Z');
    expect(registryResearchIsPaused(paused)).toBe(true);
    expect(registryResearchIsPaused({ ...paused, status: 'publishing' })).toBe(false);
    expect(registryResearchIsPaused(null)).toBe(false);
    expect(registryResearchPauseNotice({ ...paused, status: 'publishing' })).toBeNull();
    expect(() => validateRegistryResearchPause({ ...paused, status: 'off' })).toThrow('pause.status');
    expect(() => validateRegistryResearchPause({ ...paused, pausedAt: '2026-11-12 10:15' })).toThrow('canonical ISO instant');
    expect(() => validateRegistryResearchPause({ ...paused, reason: '' })).toThrow('pause.reason');
    expect(() => validateRegistryResearchPause({ ...paused, schema: 'other' })).toThrow('pause record must use');
  });

  it('writes no em or en dash into the notice', () => {
    expect(registryResearchPauseNotice(pauseAt('2026-11-12T03:15:00.000Z'))).not.toMatch(/[–—]/u);
  });
});

describe('while Registry Research is paused', () => {
  it('keeps the committed ledger and generates no draft from the next day\'s sky and market', async () => {
    const inputs = await editionInputs();
    const first = buildRegistryResearchLedger(inputs);
    const pause = pauseAt(first.generatedAt);

    // The next day: Daily Sky has moved on, a new market snapshot exists,
    // and the outlook still holds its last edition.
    const nextDay = structuredClone(inputs);
    nextDay.daily = { date: addDays(inputs.daily.date, 1), snapshotAt: `${addDays(inputs.daily.date, 1)}T12:00:00.000Z` };
    const snapshot = structuredClone(nextDay.marketHistory.snapshots.at(-1));
    snapshot.date = nextDay.daily.date;
    snapshot.source.readAt = `${nextDay.daily.date}T00:08:00.000Z`;
    nextDay.marketHistory.snapshots.push(snapshot);

    // Publishing, that tree is refused: the pairing gate wants today's outlook.
    expect(() => buildRegistryResearchLedger({ ...nextDay, existingLedger: first }))
      .toThrow('outlook daily and weekly editions must match daily.date');
    // Paused, the committed ledger is returned exactly as it was.
    const kept = buildRegistryResearchLedger({ ...nextDay, existingLedger: first, pause });
    expect(kept).toBe(first);
    expect(publishRegistryResearch({ ledger: kept, approvalManifest: inputs.approvalManifest, pause }))
      .toEqual(publishRegistryResearch({ ledger: first, approvalManifest: inputs.approvalManifest }));
  });

  it('needs a committed ledger to keep', async () => {
    const inputs = await editionInputs();
    expect(() => buildRegistryResearchLedger({ ...inputs, pause: pauseAt('2026-11-12T03:15:00.000Z') }))
      .toThrow('Registry Research is paused and there is no committed ledger to keep');
  });

  it('publishes no feed or RSS entry for an approval recorded after the pause, and reveals no scheduled item', async () => {
    const inputs = await editionInputs();
    const eventAt = `${addDays(inputs.daily.date, 1)}T12:00:00.000Z`;
    inputs.transitMonths[0].ingresses.push({ planet: 'Mercury', at: eventAt, sign: 'libra', retrograde: false });
    const ledger = buildRegistryResearchLedger(inputs);
    const event = ledger.items.find((item) => item.kind === 'event-brief' && item.visibleAt === eventAt);
    const brief = ledger.items.find((item) => item.kind === 'daily-market-brief');
    expect(event).toBeDefined();
    expect(brief).toBeDefined();

    const pause = pauseAt(ledger.generatedAt);
    const manifest = structuredClone(inputs.approvalManifest);
    // Approved before the pause: the event brief, still scheduled.
    manifest.approvals.push(approvalFor(event, pause.pausedAt));
    // Approved after the pause, late enough to move the clock past the event.
    manifest.approvals.push(approvalFor(brief, new Date(Date.parse(eventAt) + 60_000).toISOString()));

    const publishing = publishRegistryResearch({ ledger, approvalManifest: manifest });
    expect(publishing.feed.items.map((item) => item.id)).toEqual(expect.arrayContaining([brief.id, event.id]));
    expect(publishing.publication.items.find((item) => item.id === event.id).status).toBe('published');

    const paused = publishRegistryResearch({ ledger, approvalManifest: manifest, pause });
    expect(paused.publication.generatedAt).toBe(pause.pausedAt);
    expect(paused.publication.items.map((item) => item.id)).toEqual([event.id]);
    expect(paused.publication.items[0].status).toBe('scheduled');
    const rss = rssFor(paused.publication, pause);
    expect(rss).not.toContain('<item>');
    expect(rss).toContain('Publishing has been paused since');
  });

  it('resumes generation when the record is reversed to "publishing"', async () => {
    const inputs = await editionInputs();
    const kept = { schema: REGISTRY_RESEARCH_LEDGER_SCHEMA, generatedAt: '2026-11-01T00:00:00.000Z', items: [] };
    const paused = pauseAt('2026-11-12T03:15:00.000Z');
    expect(buildRegistryResearchLedger({ ...inputs, existingLedger: kept, pause: paused })).toBe(kept);
    const resumed = buildRegistryResearchLedger({ ...inputs, existingLedger: kept, pause: { ...paused, status: 'publishing' } });
    expect(resumed.items.some((item) => item.id === `zrx-daily-market-brief-${inputs.daily.date}`)).toBe(true);
    expect(resumed.items.some((item) => item.kind === 'market-check')).toBe(true);
  });
});

describe('the committed archive while paused', () => {
  it('is exactly what the frozen ledger publishes, so no item file has to be rewritten', async () => {
    const [pause, ledger, approvalManifest, publication, feed, index] = await Promise.all([
      readRegistryResearchPause(),
      json('src/data/registry-research/drafts.json'),
      json('src/data/registry-research/approval-manifest.json'),
      json('src/data/registry-research/publication.json'),
      json('public/assets/registry-research-feed.json'),
      json('public/assets/data/registry-research/index.json'),
    ]);
    const derived = publishRegistryResearch({ ledger, approvalManifest, pause });
    expect(canonicalRegistryResearchJson(derived.publication)).toBe(canonicalRegistryResearchJson(publication));
    expect(canonicalRegistryResearchJson(derived.feed)).toBe(canonicalRegistryResearchJson(feed));
    expect(canonicalRegistryResearchJson(index)).toBe(canonicalRegistryResearchJson(publication));

    const files = (await readdir(resolve(repositoryRoot, 'public/assets/data/registry-research/items'))).sort();
    expect(files).toEqual(publication.items.map((item) => `${item.id}.json`).sort());
    for (const item of publication.items) {
      const stored = await json(`public/assets/data/registry-research/items/${item.id}.json`);
      expect(canonicalRegistryResearchJson(stored), item.id).toBe(canonicalRegistryResearchJson(immutableRegistryResearchItem(item)));
    }
  });
});

describe('the builders, run on a copy of the tree', () => {
  let root;
  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'registry-research-pause-'));
  });
  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  async function copy(paths) {
    for (const path of paths) {
      await mkdir(dirname(join(root, path)), { recursive: true });
      await cp(resolve(repositoryRoot, path), join(root, path), { recursive: true });
    }
  }

  async function bytes(paths) {
    const entries = [];
    for (const path of paths) {
      const full = join(root, path);
      const names = path.endsWith('/') ? (await readdir(full)).sort().map((name) => `${path}${name}`) : [path];
      for (const name of names) entries.push([name, await readFile(join(root, name), 'utf8')]);
    }
    return entries;
  }

  const node = (script, args = []) => execFileSync(process.execPath, [join(root, script), ...args], {
    cwd: root, encoding: 'utf8', env: { ...process.env, TARGET_DATE: '' }, stdio: ['ignore', 'pipe', 'pipe'],
  });

  it('writes no draft, item, feed or index while paused, in build mode or --check, without reading the Daily Sky', async () => {
    const research = [
      'src/data/registry-research/approval-manifest.json',
      'src/data/registry-research/drafts.json',
      'src/data/registry-research/publication.json',
      'public/assets/registry-research-feed.json',
      'public/assets/data/registry-research/index.json',
      'public/assets/data/registry-research/items/',
    ];
    await copy([
      'scripts/build-registry-research.mjs',
      'scripts/registry-research-lib.mjs',
      'scripts/registry-research-pause.mjs',
      'src/data/registry-research/pause.json',
      ...research.map((path) => path.replace(/\/$/u, '')),
    ]);
    await writeFile(join(root, 'src/data/registry-research/pause.json'), JSON.stringify(pauseAt('2026-11-12T03:15:00.000Z')));
    const before = await bytes(research);
    expect(node('scripts/build-registry-research.mjs')).toContain('Registry Research paused: nothing written');
    expect(node('scripts/build-registry-research.mjs', ['--check'])).toContain('Registry Research paused (verified): nothing written');
    expect(await bytes(research)).toEqual(before);

    // A new item file appearing during the pause is refused.
    await writeFile(join(root, 'public/assets/data/registry-research/items/zrx-new-after-pause.json'), '{}\n');
    expect(() => node('scripts/build-registry-research.mjs', ['--check'])).toThrow('not in the committed publication');
  });

  it('publishes no new outlook edition while paused, and a new one once the record is reversed', async () => {
    const outlook = await json('public/assets/registry-outlook.json');
    const nextDate = addDays(outlook.daily.date, 1);
    await copy([
      'scripts/build-registry-outlook.mjs',
      'scripts/registry-outlook-artifact.mjs',
      'scripts/registry-research-lib.mjs',
      'scripts/registry-research-pause.mjs',
      'src/registry/outlook.mjs',
      'src/data/ingresses.json',
      'public/assets/data/registry-market-history.v1.json',
      'public/assets/registry-outlook.json',
      ...monthsCovering(nextDate, 7).map((month) => `src/data/transits-${month}.json`),
    ]);
    // The Daily Sky has moved on to the next day.
    await writeFile(join(root, 'src/data/daily.json'), JSON.stringify({ date: nextDate, snapshotAt: `${nextDate}T12:00:00.000Z` }));
    const pausePath = join(root, 'src/data/registry-research/pause.json');
    await mkdir(dirname(pausePath), { recursive: true });
    await writeFile(pausePath, JSON.stringify(pauseAt('2026-11-12T03:15:00.000Z')));
    const before = await bytes(['public/assets/registry-outlook.json']);

    expect(node('scripts/build-registry-outlook.mjs')).toContain('Registry Outlook paused: nothing written');
    expect(await bytes(['public/assets/registry-outlook.json'])).toEqual(before);

    await writeFile(pausePath, JSON.stringify(pauseAt('2026-11-12T03:15:00.000Z', 'publishing')));
    expect(node('scripts/build-registry-outlook.mjs')).toContain(`edition ${nextDate}`);
    expect((await json('public/assets/registry-outlook.json', root)).daily.date).toBe(nextDate);
  });

  it('keeps build-app from writing the outlook while paused', async () => {
    const source = await readFile(resolve(repositoryRoot, 'scripts/build-app.mjs'), 'utf8');
    expect(source).toContain('const outlookPaused = registryResearchIsPaused(await readRegistryResearchPause(root));');
    expect(source).toContain('outlookPaused ? null : writeFile(REGISTRY_OUTLOOK,');
  });
});

describe('the workflows\' dated pairing check', () => {
  const day = '2026-11-13';
  const artifacts = (marketDate, editionDate) => ({
    history: { snapshots: [{ date: marketDate, source: { readAt: `${marketDate}T00:08:00.000Z` } }] },
    outlook: { daily: { date: editionDate }, weekly: { date: editionDate } },
    researchDrafts: { generatedAt: `${editionDate}T00:08:24.499Z` },
    researchPublication: { generatedAt: `${editionDate}T00:08:24.499Z` },
    researchFeed: { generatedAt: `${editionDate}T00:08:24.499Z` },
  });

  it('wants every artifact dated today while publishing', () => {
    const publishing = pauseAt('2026-11-12T03:15:00.000Z', 'publishing');
    expect(registryPairingProblems({ target: day, pause: publishing, ...artifacts(day, day) })).toEqual([]);
    expect(registryPairingProblems({ target: day, pause: publishing, ...artifacts(day, '2026-11-12') }))
      .toContain('dailyOutlook artifact is 2026-11-12; expected 2026-11-13');
  });

  it('accepts the last published outlook and research while paused, but still wants today\'s market archive', () => {
    const pause = pauseAt('2026-11-12T03:15:00.000Z');
    expect(registryPairingProblems({ target: day, pause, ...artifacts(day, '2026-11-12') })).toEqual([]);
    expect(registryPairingProblems({ target: day, pause, ...artifacts('2026-11-12', '2026-11-12') }))
      .toContain('market artifact is 2026-11-12; expected 2026-11-13');
    const split = artifacts(day, '2026-11-12');
    split.researchFeed.generatedAt = '2026-11-11T00:08:24.499Z';
    expect(registryPairingProblems({ target: day, pause, ...split }))
      .toContain('paused research publication and compact feed carry different clocks');
  });

  it('is what both workflows run', async () => {
    for (const workflow of ['daily-horoscopes.yml', 'registry-market-snapshot.yml']) {
      const source = await readFile(resolve(repositoryRoot, '.github/workflows', workflow), 'utf8');
      expect(source, workflow).toContain('node scripts/check-registry-pairing.mjs');
      expect(source, workflow).not.toContain("readFile('public/assets/registry-outlook.json'");
    }
  });
});

describe('the public feeds while paused', () => {
  it('say publishing is paused and list only what was published before the pause', async () => {
    const pause = await readRegistryResearchPause();
    const publication = await json('src/data/registry-research/publication.json');
    const { GET: rss } = await import('../src/pages/feeds/market-research.xml.ts');
    const { GET: jsonFeed } = await import('../src/pages/feeds/market-research.json.ts');
    const xml = await rss({}).text();
    const feed = await jsonFeed({}).json();
    const expectedItems = publication.items.filter((item) => publication.rollingItemIds.includes(item.id)
      && item.status === 'published' && item.visibleAt <= publication.generatedAt);

    expect(xml.match(/<item>/gu) ?? []).toHaveLength(expectedItems.length);
    expect(feed.items.map((item) => item.id)).toEqual(expectedItems.map((item) => item.id));
    expect(feed.generatedAt).toBe(publication.generatedAt);
    if (registryResearchIsPaused(pause)) {
      const notice = registryResearchPauseNotice(pause);
      expect(xml).toContain(`<description>${notice} Deterministic symbolic research`);
      expect(feed.description.startsWith(notice)).toBe(true);
      expect(feed._zodiacs).toEqual({ publishing: 'paused', pausedAt: pause.pausedAt, note: notice });
    } else {
      expect(feed._zodiacs).toBeUndefined();
    }
  });

  it('the archive page carries the notice and calls its list an archive', async () => {
    const page = await readFile(resolve(repositoryRoot, 'src/pages/terminal/research/index.astro'), 'utf8');
    expect(page).toContain("import pause from '../../../data/registry-research/pause.json';");
    expect(page).toContain('const pauseNotice = registryResearchPauseNotice(pause);');
    expect(page).toContain('<strong>Publishing paused</strong>');
    expect(page).toContain("{pauseNotice ? 'Archive' : 'Latest editions'}");
    expect(page).not.toMatch(/href="\/(?:horoscopes|today|birth-chart|signs)\//u);
  });
});
