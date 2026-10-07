import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { ASSISTANT_CONTEXT } from '../api/_assistant/context.ts';
import {
  BANNED_CONSUMER_VOCABULARY,
  MAX_CONTEXT_BYTES,
  MIN_CONTEXT_BYTES,
  TOOL_ROUTES,
  buildAssistantContext,
  extractCanonicalLabels,
  extractLearnTopics,
  generateAssistantContext,
} from './build-assistant-context.mjs';

let temporaryDirectory;

afterEach(async () => {
  if (temporaryDirectory) {
    await rm(temporaryDirectory, { force: true, recursive: true });
    temporaryDirectory = undefined;
  }
});

describe('assistant site context', () => {
  it('contains every tool route and the complete live route families', async () => {
    const { context, counts } = await generateAssistantContext();

    expect(TOOL_ROUTES).toEqual([
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
    for (const route of TOOL_ROUTES) expect(context).toContain(`- ${route} —`);

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
      consumerRoutes: 706,
      glossary: 145,
      guides: 12,
      learn: 159,
      pairs: 78,
      staticPages: 67,
      tools: 28,
    });
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
    expect(context).toContain('The public Guide sends chat messages to OpenAI');
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
    const topics = extractLearnTopics(`
      <a class="tile clusters__card" href="/learn/planets/">
        <strong>The planets</strong><p>Ten planets, ten jobs.</p>
      </a>
    `);
    expect(topics).toEqual([{
      route: '/learn/planets/',
      title: 'The planets',
      description: 'Ten planets, ten jobs.',
    }]);

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

    const first = await buildAssistantContext({ output });
    const firstBytes = await readFile(output);
    const second = await buildAssistantContext({ output });
    const secondBytes = await readFile(output);

    expect(second.context).toBe(first.context);
    expect(second.source).toBe(first.source);
    expect(secondBytes.equals(firstBytes)).toBe(true);
    expect(ASSISTANT_CONTEXT).toBe(first.context);
  });
});
