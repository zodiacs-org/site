import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { ASSISTANT_CONTEXT } from '../api/_assistant/context.ts';
import {
  ALL_TOOL_ROUTES,
  BANNED_CONSUMER_VOCABULARY,
  LAUNCH_FLAGGED_ROUTES,
  MAX_CONTEXT_BYTES,
  MIN_CONTEXT_BYTES,
  buildAssistantContext,
  extractCanonicalLabels,
  learnTopics,
  generateAssistantContext,
  toolRoutes,
} from './build-assistant-context.mjs';

let temporaryDirectory;

// The committed module is the output with every launch switch unset; the
// tarot draw joins the tools and the inventory only while its switch is '1'.
const FLAGS_OFF = Object.freeze({});
const TAROT_ON = Object.freeze({ PUBLIC_TAROT_ENABLED: '1' });
const TAROT_LINE = '- /tarot/ —';
const MAIN_TOOL_ROUTES = Object.freeze([
  '/ask/',
  '/sky-calendar/',
  '/astrologer-kit/',
  '/your-sky-wrapped/',
  '/chart-of-the-day/',
  '/baby-zodiac/',
  '/big-three/',
  '/chart-twins/',
  '/compatibility/invite/',
  '/group-charts/',
  '/birth-chart/',
  '/birthday/',
  '/compatibility/',
  '/eclipses/',
  '/full-moon-calendar/',
  '/lunar-return/',
  '/mercury-retrograde/',
  '/moon-phase/',
  '/moon-sign/',
  '/numerology/',
  '/profile/',
  '/retrogrades/',
  '/rising-sign/',
  '/saturn-return/',
  '/solar-return/',
  '/transits/',
  '/void-of-course-moon/',
  '/widgets/',
]);
const withTarot = (routes) => [...routes.slice(0, routes.indexOf('/solar-return/') + 1), '/tarot/', ...routes.slice(routes.indexOf('/solar-return/') + 1)];

afterEach(async () => {
  if (temporaryDirectory) {
    await rm(temporaryDirectory, { force: true, recursive: true });
    temporaryDirectory = undefined;
  }
});

describe('assistant site context', () => {
  it.each([
    ['unset', FLAGS_OFF],
    ['on', TAROT_ON],
  ])('contains every tool route and the complete live route families (tarot switch %s)', async (_mode, env) => {
    const tarot = env.PUBLIC_TAROT_ENABLED === '1';
    const { context, counts } = await generateAssistantContext({ env });
    const routes = toolRoutes(env);

    expect(routes).toEqual(tarot ? withTarot(MAIN_TOOL_ROUTES) : [...MAIN_TOOL_ROUTES]);
    for (const route of routes) expect(context).toContain(`- ${route} —`);

    expect(counts).toEqual({
      birthdays: 366,
      // /race/ joined the listing in R2.1 and the Trophy Hall joined in
      // R2.3; Packet C removes the two wing-only routes from Guide context;
      // /developers/ (the sky data API documentation) joined the static pages.
      // Lunar return adds one English tool and one consumer route.
      // The numerology calculator adds one English tool and one static page;
      // its twelve Life Path pages come from a dynamic route and are not counted.
      // The void-of-course Moon calendar adds one more English tool and static page.
      // Developer support and runnable examples add two static pages.
      // The chart-difference tool at /developers/compare/ adds one more.
      // The local MCP adapter's page at /developers/mcp/ adds one more again.
      // The engine's own product page at /developers/engine/ adds one more.
      // The conformance suite's results page at /developers/conformance/ adds one more.
      // The compute API, AI integrations and sky benchmark each add a page.
      // The three occasion cards (/occasions/, milestones, baby shower) add three.
      // The conventions registry at /developers/conventions/ adds one more.
      // The assistant showcase at /apps/ adds one evergreen page.
      // The developer demo at /developers/demo/ adds one more.
      // The time atlas at /developers/time-atlas/ adds one more.
      // The tarot draw adds one English tool and one consumer route and static
      // page, only while PUBLIC_TAROT_ENABLED is '1'.
      consumerRoutes: 717 + Number(tarot),
      glossary: 145,
      guides: 12,
      learn: 159,
      pairs: 78,
      staticPages: 78 + Number(tarot),
      tools: 28 + Number(tarot),
    });
    if (tarot) expect(context).toContain(TAROT_LINE);
    else expect(context).not.toContain('/tarot/');
    expect(context).toContain('- /birthday/february-29/ — Pisces birthday guide.');
    expect(context).toContain('- /compatibility/aries-pisces/ — Aries and Pisces in love and the long run.');
    expect(context).toContain('- /learn/placements/sun-in-aries/ — What Sun in Aries means in a birth chart.');
    expect(context).toContain('- /rising-sign/pisces/ — What Pisces rising means.');
    expect(context).not.toContain('ASTROFOLIO, TERMINAL, AND REGISTRY');
    expect(context).not.toMatch(/\/(?:astrofolio|disclosure|fomo|registry|sdk|terminal|thesis)\//u);
    expect(context).not.toContain('/bio/');
    expect(context).not.toMatch(/\b(?:Astrofolio|Registry|Terminal)\b/u);
    expect(context).not.toContain('Zodiac Terminal');
  });

  it('keeps privacy, calculation, time-zone, unknown-time, and horoscope-date boundaries explicit', async () => {
    const { context } = await generateAssistantContext();

    expect(context).toContain('Chart calculation does not send birth fields to a chart API.');
    expect(context).toContain('optional account sync, which starts when a person signs in, uploads their saved charts');
    expect(context).not.toContain('only the charts a person chooses');
    expect(context).toContain('The public Guide sends chat messages to Anthropic');
    expect(context).toContain('placements-only chart summary only after the person explicitly chooses “Attach my chart”');
    expect(context).not.toContain('Birth details stay on the device.');

    expect(context).toContain('IANA/ICU history supplied by the visitor’s browser or device runtime');
    expect(context).toContain('historical coverage and tzdb version depend on that host');
    expect(context).toContain('uses 12:00 local civil time as a reference');
    expect(context).toContain('omits the rising sign, angles, and houses');
    expect(context).toContain('marks the Moon’s sign as unverified, because the Moon can change sign during that local date');

    expect(context).toContain('PAGE INVENTORY — DAILY AND MONTHLY HOROSCOPES');
    expect(context).toContain('Treat “today” as an exact UTC-date claim');
    expect(context).toContain('- /horoscopes/aries/ — Aries daily horoscope.');
    expect(context).toMatch(/- \/horoscopes\/aries\/monthly\/ — Aries in [A-Z][a-z]+ 20\d{2}/u);
    expect(context).not.toContain('PAGE INVENTORY — MONTHLY HOROSCOPES');
  });

  it('stays inside the cache-size band without localized routes or consumer-banned vocabulary', async () => {
    const { context } = await generateAssistantContext();
    const bytes = Buffer.byteLength(context);

    expect(bytes).toBeGreaterThanOrEqual(MIN_CONTEXT_BYTES);
    expect(bytes).toBeLessThanOrEqual(MAX_CONTEXT_BYTES);
    expect(context).not.toMatch(/(?:^|\s)\/es\//m);
    expect(context).not.toMatch(/(?:^|\s)\/pt\//m);
    expect(context).not.toMatch(/(?:^|\s)\/ru\//m);
    for (const word of BANNED_CONSUMER_VOCABULARY) {
      expect(context).not.toMatch(new RegExp(`\\b${word}(?:s)?\\b`, 'i'));
    }
  });

  it('extracts the learn-hub topics and the canonical strategy labels from their sources', () => {
    const topics = learnTopics([
      { route: '/learn/planets/', title: 'The planets', description: 'Ten planets, ten jobs.' },
    ]);
    expect(topics).toEqual([{
      route: '/learn/planets/',
      title: 'The planets',
      description: 'Ten planets, ten jobs.',
    }]);
    expect(learnTopics().map((topic) => topic.route)).toContain('/learn/glossary/');
    expect(() => learnTopics([{ route: '/learn/planets/', title: '', description: 'x' }])).toThrow(/Incomplete learn topic/);

    const labels = extractCanonicalLabels(`
## 4. Voice & microcopy
Canonical labels: "Get your free birth chart" · "Save this chart" · "Saved charts" ·
"Find your moon sign" · "Find your rising sign" · "Read your sign" · "Registry" ·
"Registro" · "the Twelve" · "View the record" · "Nothing saved yet"

## 5. Next
    `);
    expect(labels).toContain('Get your free birth chart');
    expect(labels).toContain('the Twelve');
  });

  it('is byte-identical across two builds and matches the committed module', async () => {
    temporaryDirectory = await mkdtemp(join(tmpdir(), 'zodiacs-assistant-context-'));
    const output = join(temporaryDirectory, 'context.ts');

    const first = await buildAssistantContext({ output, env: FLAGS_OFF });
    const firstBytes = await readFile(output);
    const second = await buildAssistantContext({ output, env: FLAGS_OFF });
    const secondBytes = await readFile(output);

    expect(second.context).toBe(first.context);
    expect(second.source).toBe(first.source);
    expect(secondBytes.equals(firstBytes)).toBe(true);
    expect(ASSISTANT_CONTEXT).toBe(first.context);
  });

  it('commits the switches-unset output, and the tarot switch adds exactly its one line', async () => {
    expect(LAUNCH_FLAGGED_ROUTES).toEqual({ '/tarot/': 'PUBLIC_TAROT_ENABLED' });
    expect(ALL_TOOL_ROUTES).toEqual(withTarot(MAIN_TOOL_ROUTES));
    temporaryDirectory = await mkdtemp(join(tmpdir(), 'zodiacs-assistant-context-'));

    const off = await buildAssistantContext({ output: join(temporaryDirectory, 'off.ts'), env: FLAGS_OFF });
    expect(ASSISTANT_CONTEXT).toBe(off.context);
    expect(off.context).not.toContain('/tarot/');

    for (const value of ['', '0', 'true', ' 1']) {
      const notOn = await generateAssistantContext({ env: { PUBLIC_TAROT_ENABLED: value } });
      expect(notOn.context).toBe(off.context);
      expect(toolRoutes({ PUBLIC_TAROT_ENABLED: value })).toEqual([...MAIN_TOOL_ROUTES]);
    }

    const on = await buildAssistantContext({ output: join(temporaryDirectory, 'on.ts'), env: TAROT_ON });
    const offLines = off.context.split('\n');
    const added = on.context.split('\n').filter((line) => !offLines.includes(line));
    expect(added).toHaveLength(1);
    expect(added[0].startsWith(TAROT_LINE)).toBe(true);
    expect(on.context.split('\n').filter((line) => line !== added[0])).toEqual(offLines);
  });
});
