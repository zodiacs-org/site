import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import {
  consumeAssistantStream,
  guideDayAnchorMatches,
  parseAssistantMarkdown,
  parseAssistantSseFrame,
  placementSummaryForChart,
  selectedSelfChartFromJson,
  todaySkySummary,
} from './open-assistant';
import { GUIDE_CLOUD_DISCLOSURE_POLICY_VERSION } from '../guide-server/policy';
import { GUIDE_KNOWLEDGE_ENTRIES } from '../guide-knowledge/catalog';
import { GUIDE_SHELL_URL, guideLoaderSource } from './guide-loader.mjs';
import { computeBodies, computeChart } from '../engine/full';
import { sharedTimedInstant } from '../share-positions-noon';
import { degreeInSign, signForLongitude } from '../signs';
import { prepareLocalTime, resolveLocalToUtc } from '../time/localToUtc';

const ACCOUNT_ID = '11111111-1111-4111-8111-111111111111';
const OLDER_ID = '22222222-2222-4222-8222-222222222222';
const NEWER_ID = '33333333-3333-4333-8333-333333333333';

function profileJson({
  houseSystem = 'whole',
  timeKnown = true,
}: {
  houseSystem?: 'whole' | 'placidus';
  timeKnown?: boolean;
} = {}) {
  return JSON.stringify({
    version: 1,
    charts: [
      {
        id: OLDER_ID,
        name: 'Someone else',
        updatedAt: '2026-01-01T00:00:00.000Z',
        birth: { date: '1980-01-01', time: '12:00', timeKnown: true, place: null },
        summary: {
          houseSystem: 'whole',
          bodies: [{ body: 'Sun', lon: 280, retrograde: false }],
          angles: { asc: 12, mc: 282 },
          utcISO: '1980-01-01T12:00:00.000Z',
        },
      },
      {
        id: NEWER_ID,
        name: 'Secret Person',
        updatedAt: '2026-07-12T00:00:00.000Z',
        birth: {
          date: '1990-04-17',
          time: timeKnown ? '08:45' : null,
          timeKnown,
          place: {
            name: 'Bangkok',
            country: 'TH',
            lat: 13.7563,
            lon: 100.5018,
            tz: 'Asia/Bangkok',
          },
        },
        summary: {
          houseSystem,
          bodies: [
            { body: 'Sun', lon: 15, retrograde: false },
            { body: 'Moon', lon: 95.5, retrograde: false },
            { body: 'Mercury', lon: 355.25, retrograde: true },
          ],
          angles: { asc: 5, mc: 275 },
          // 08:45 in Bangkok (UTC+7), or its noon without a birth time.
          utcISO: timeKnown ? '1990-04-17T01:45:00.000Z' : '1990-04-17T05:00:00.000Z',
        },
      },
    ],
  });
}

const ownerJson = () => JSON.stringify({ version: 1, accountId: ACCOUNT_ID });
const metadataJson = (selectedIds = [NEWER_ID]) => JSON.stringify({
  version: 1,
  accountId: ACCOUNT_ID,
  deviceId: '44444444-4444-4444-8444-444444444444',
  serverCursor: null,
  pendingConsentOperation: null,
  charts: [OLDER_ID, NEWER_ID].map((chartId) => ({
    chartId,
    selectedForSync: selectedIds.includes(chartId),
    serverRevision: 1,
    pendingOperation: null,
  })),
});

const selfChart = (profile = profileJson()) => (
  selectedSelfChartFromJson(profile, ownerJson(), metadataJson())
);

function polarProfileJson({ corrected = false, malformed = false } = {}) {
  const profile = JSON.parse(profileJson());
  const selected = profile.charts[1];
  selected.birth = {
    date: '2001-12-21', time: '09:00', timeKnown: true,
    place: { name: 'Polar fixture', lat: 78.2232, lon: 15.6267, tz: 'UTC' },
  };
  selected.summary.engineVersion = '0.1.0';
  selected.summary.utcISO = '2001-12-21T09:00:00.000Z';
  selected.summary.angles = {
    asc: corrected ? 23.871984112302016 : 203.87198411230202,
    mc: 242.6868131443143,
  };
  if (!malformed) selected.summary.flags = ['polar-fallback'];
  return JSON.stringify(profile);
}

describe('saved-chart assistant context', () => {
  it('uses the same repaired polar ASC and whole-sign houses as the saved profile without revealing birth input', async () => {
    const chart = selfChart(polarProfileJson());
    expect(chart?.id).toBe(NEWER_ID);
    expect(chart?.accountRevision).toBe(1);
    expect(chart?.summary.angles?.asc).toBeCloseTo(23.871984112302016, 10);
    expect(chart?.summary.angles?.mc).toBe(242.6868131443143);
    const summary = await placementSummaryForChart(chart!);
    expect(summary).toContain('ASC: 23° Aries · house 1');
    expect(summary).toContain('Sun: 15°00′ Aries · house 1');
    expect(summary).not.toMatch(/Secret Person|2001-12-21|09:00|Polar fixture|78\.2232|15\.6267|UTC/);
    expect(selectedSelfChartFromJson(polarProfileJson(), ownerJson(), metadataJson([]))).toBeNull();
    expect(selectedSelfChartFromJson(polarProfileJson(), ownerJson(), metadataJson([OLDER_ID, NEWER_ID]))).toBeNull();
  });

  it('does not change an already-correct current polar summary', async () => {
    const chart = selfChart(polarProfileJson({ corrected: true }));
    expect(chart?.summary.angles?.asc).toBe(23.871984112302016);
    expect(await placementSummaryForChart(chart!)).toContain('ASC: 23° Aries · house 1');
  });

  it('leaves unfamiliar legacy records to the existing context parser without inferring a repair', () => {
    const chart = selfChart(polarProfileJson({ malformed: true }));
    expect(chart?.id).toBe(NEWER_ID);
    expect(chart?.summary.angles?.asc).toBe(203.87198411230202);
  });

  it('uses only the explicitly selected account-v2 self chart and serializes placements without PII', async () => {
    const chart = selfChart();
    expect(chart?.updatedAt).toBe('2026-07-12T00:00:00.000Z');

    const summary = await placementSummaryForChart(chart!);
    expect(summary).toBe([
      'Tropical chart placements:',
      'Sun: 15°00′ Aries · house 1',
      'Moon: 5°30′ Cancer · house 4',
      'Mercury: 25°15′ Pisces · house 12 · retrograde',
      'ASC: 5° Aries · house 1',
      'MC: 5° Capricorn · house 10',
    ].join('\n'));
    expect(summary).not.toMatch(/Secret Person|1990-04-17|08:45|Bangkok|13\.7563|100\.5018|Asia\/Bangkok/);
  });

  it('does not infer self ownership from chart order, name, or an ambiguous selection', () => {
    expect(selectedSelfChartFromJson(profileJson(), ownerJson(), null)).toBeNull();
    expect(selectedSelfChartFromJson(profileJson(), ownerJson(), metadataJson([]))).toBeNull();
    expect(selectedSelfChartFromJson(
      profileJson(),
      ownerJson(),
      metadataJson([OLDER_ID, NEWER_ID]),
    )).toBeNull();
    expect(selectedSelfChartFromJson(
      profileJson(),
      JSON.stringify({ version: 1, accountId: '55555555-5555-4555-8555-555555555555' }),
      metadataJson(),
    )).toBeNull();
  });

  it('sends a chart without a birth time as the sky at 12:00 UTC on its date, without the Moon, angles or houses', async () => {
    // The saved positions are noon in Bangkok, whose bodies to the arcminute
    // would give the time zone; Guide gets noon UTC on the date instead.
    const summary = (await placementSummaryForChart(selfChart(profileJson({ timeKnown: false }))!))!;
    const arcminute = (lon: number) => {
      const within = degreeInSign(lon);
      return `${Math.floor(within)}°${String(Math.floor((within - Math.floor(within)) * 60 + 1e-7)).padStart(2, '0')}′ ${signForLongitude(lon).name}`;
    };
    const noonUtc = computeBodies(new Date('1990-04-17T12:00:00Z'));
    expect(summary.split('\n')).toEqual([
      'Tropical chart placements at 12:00 UTC on the birth date (birth time not known):',
      ...noonUtc.map(({ body, lon, retrograde }) => (body === 'Moon'
        ? 'Moon: sign not known without a birth time'
        : `${body}: ${arcminute(lon)}${retrograde ? ' · retrograde' : ''}`)),
    ]);
    expect(summary).not.toContain('Sun: 15°00′ Aries');
    expect(summary).not.toMatch(/house|ASC:|MC:/);
    // Nothing in it comes from the birthplace: another place on the date gives the same lines.
    const elsewhere = JSON.parse(profileJson({ timeKnown: false }));
    elsewhere.charts[1].birth.place = { name: 'Honolulu', country: 'US', lat: 21.31, lon: -157.86, tz: 'Pacific/Honolulu' };
    elsewhere.charts[1].summary.bodies = [{ body: 'Sun', lon: 27.3, retrograde: false }];
    expect(await placementSummaryForChart(selfChart(JSON.stringify(elsewhere))!)).toBe(summary);
  });

  it('sends a chart with a birth time as its link carries it, at its UTC instant rounded to the whole minute', async () => {
    // Before standard time a chart keeps the birthplace's own mean time, so
    // its instant has seconds (19:40:26 UTC here, from Rochester's
    // longitude). The bodies at that instant, to the arcminute, fitted a
    // window of about 104 s, which with a link's minute gave the birth to
    // 14.5 s; Guide now sends the bodies at the minute, as the link does.
    const birth = { date: '1870-06-15', time: '14:30', zone: 'America/New_York', lat: 43.1566, lon: -77.6088 };
    await prepareLocalTime(birth.date, birth.zone);
    const utc = resolveLocalToUtc(birth.date, birth.time, birth.zone, { longitude: birth.lon }).utc;
    expect(utc.toISOString()).toBe('1870-06-15T19:40:26.000Z');
    const minute = sharedTimedInstant(utc)!.getTime();
    const chartAt = (ms: number) => {
      const chart = computeChart({ utc: new Date(ms), latitude: birth.lat, longitude: birth.lon, houseSystem: 'whole', timeKnown: true });
      const profile = JSON.parse(profileJson());
      profile.charts[1].birth = { date: birth.date, time: birth.time, timeKnown: true,
        place: { name: 'Rochester', country: 'US', lat: birth.lat, lon: birth.lon, tz: birth.zone } };
      profile.charts[1].summary = {
        houseSystem: 'whole', engineVersion: chart.engineVersion, utcISO: chart.input.utc.toISOString(),
        bodies: chart.bodies.map(({ body, lon, retrograde }) => ({ body, lon, retrograde })),
        angles: { asc: chart.angles!.asc, mc: chart.angles!.mc },
      };
      return { chart, stored: selfChart(JSON.stringify(profile))! };
    };
    // The bodies' lines alone: the angles' lines keep the whole degree of the chart's own angles.
    const bodyLines = (summary: string | null) => summary!.split('\n').slice(1)
      .filter((line) => !/^(?:ASC|MC):/u.test(line)).map((line) => line.replace(/ · house \d+/u, ''));
    const arcminute = (lon: number) => {
      const within = degreeInSign(lon);
      return `${Math.floor(within)}°${String(Math.floor((within - Math.floor(within)) * 60 + 1e-7)).padStart(2, '0')}′ ${signForLongitude(lon).name}`;
    };
    const linkLines = computeBodies(new Date(minute))
      .map(({ body, lon, retrograde }) => `${body}: ${arcminute(lon)}${retrograde ? ' · retrograde' : ''}`);
    const sent = new Set<string>();
    const exact = new Set<string>();
    for (let ms = minute - 30_000; ms < minute + 30_000; ms += 500) {
      const { chart, stored } = chartAt(ms);
      const lines = bodyLines(await placementSummaryForChart(stored));
      expect(lines).toEqual(linkLines);
      sent.add(lines.join('\n'));
      exact.add(chart.bodies.map(({ body, lon, retrograde }) => `${body}: ${arcminute(lon)}${retrograde ? ' · retrograde' : ''}`).join('\n'));
    }
    // Every instant in the minute sends the same lines; the exact instants' own lines differ.
    expect(sent.size).toBe(1);
    expect(exact.size).toBeGreaterThan(1);
    // A chart already on a whole minute keeps its own bodies, and one without an instant sends nothing.
    const { chart, stored } = chartAt(minute);
    expect(bodyLines(await placementSummaryForChart(stored))).toEqual(linkLines);
    expect(stored.summary.utcISO).toBe(chart.input.utc.toISOString());
    const noInstant = JSON.parse(profileJson());
    delete noInstant.charts[1].summary.utcISO;
    expect(await placementSummaryForChart(selfChart(JSON.stringify(noInstant))!)).toBeNull();
  });

  it('asks consent for a chart without a birth time in words true of its noon-UTC lines, in every locale', async () => {
    const source = await readFile(new URL('./open-assistant.ts', import.meta.url), 'utf8');
    const noTime = [...source.matchAll(/consentBodyNoTime: '([^'\n]+)'/gu)].map((match) => match[1] ?? '');
    expect(noTime).toHaveLength(5);
    for (const body of noTime) {
      expect(body).toContain('12:00 UTC');
      expect(body).toContain('OpenAI');
    }
    expect(source).toContain('const body = chart.birth.timeKnown ? copy.consentBody : copy.consentBodyNoTime;');
  });

  it('gives a Placidus chart no house numbers, which would need the exact angles', async () => {
    const chart = selfChart(profileJson({ houseSystem: 'placidus' }));
    const summary = await placementSummaryForChart(chart!);
    expect(summary).toBe([
      'Tropical chart placements:',
      'Sun: 15°00′ Aries',
      'Moon: 5°30′ Cancer',
      'Mercury: 25°15′ Pisces · retrograde',
      'ASC: 5° Aries',
      'MC: 5° Capricorn',
    ].join('\n'));
    expect(summary).not.toMatch(/Secret Person|1990-04-17|08:45|Bangkok|13\.7563|100\.5018|Asia\/Bangkok/);
  });

  it('sends the ascendant and midheaven only to the whole degree, as a shared chart code does', async () => {
    // 23.871984° and 242.686813° would be 23°52′ Aries and 2°41′ Sagittarius to the arcminute.
    const summary = (await placementSummaryForChart(selfChart(polarProfileJson({ corrected: true }))!))!;
    expect(summary).toContain('ASC: 23° Aries');
    expect(summary).toContain('MC: 2° Sagittarius');
    expect(summary).not.toMatch(/(?:ASC|MC): \d+°\d{2}′/);
    // The bodies keep the arcminute, which gives the birth date and time.
    expect(summary).toMatch(/Sun: 15°00′ Aries/);
  });
});

describe('Guide day and retry boundaries', () => {
  it('rotates on either local-date or time-zone change', () => {
    expect(guideDayAnchorMatches('2026-08-13', 'Asia/Bangkok', '2026-08-13', 'Asia/Bangkok'))
      .toBe(true);
    expect(guideDayAnchorMatches('2026-08-13', 'Asia/Bangkok', '2026-08-14', 'Asia/Bangkok'))
      .toBe(false);
    expect(guideDayAnchorMatches('2026-08-13', 'Asia/Bangkok', '2026-08-13', 'Europe/Rome'))
      .toBe(false);
  });

  it('rechecks the day after consent awaits and rejects stale context retries', async () => {
    const source = await readFile(new URL('./open-assistant.ts', import.meta.url), 'utf8');
    const submit = source.slice(
      source.indexOf('async function submitQuestion()'),
      source.indexOf('async function retryTurn()'),
    );
    const retry = source.slice(
      source.indexOf('async function retryTurn()'),
      source.indexOf('function focusableControls()'),
    );
    const run = source.slice(
      source.indexOf('async function runTurn('),
      source.indexOf('async function submitQuestion()'),
    );
    expect(submit).toContain('if (!await requestCloudConsent()) return;\n    if (rotateGuideDayIfNeeded()) return;');
    expect(submit).toContain('await requestChartConsent(expectedGeneration);\n    }\n    if (rotateGuideDayIfNeeded()) return;');
    expect(run).toContain('if (rotateGuideDayIfNeeded())');
    expect(retry).toContain('prior.body.contextEpoch !== state.contextEpoch');
    expect(retry).toContain('prior.body.baseRevision !== state.revision');
  });
});

describe('Guide quick prompts', () => {
  it('drafts an opener prompt into the composer only, never into context or the URL', async () => {
    const source = await readFile(new URL('./open-assistant.ts', import.meta.url), 'utf8');
    const open = source.slice(
      source.indexOf('export async function openAssistant('),
      source.indexOf('function prefillFromOpener('),
    );
    const prefill = source.slice(
      source.indexOf('function prefillFromOpener('),
      source.indexOf('function prefillFromOpener(') + 600,
    );
    expect(open).toContain('prefillFromOpener(from);\n  textarea!.focus();');
    expect(prefill).toContain('from?.dataset?.assistantPrompt?.trim()');
    expect(prefill).toContain('textarea.value.trim()) return;');
    expect(prefill).toContain('textarea.value = prompt.slice(0, 280);');
    expect(prefill).not.toContain('location.');
    expect(prefill).not.toContain('contextScope');
    expect(prefill).not.toContain('submitQuestion');
  });
});

describe('Guide cloud-processing disclosure', () => {
  it('keeps the browser consent version aligned with the server after the disclosure change', async () => {
    const source = await readFile(new URL('./open-assistant.ts', import.meta.url), 'utf8');
    expect(GUIDE_CLOUD_DISCLOSURE_POLICY_VERSION)
      .toBe('guide-cloud-processing-2026-08-14.2');
    expect(source).toContain(
      `const CONSENT_POLICY_VERSION = '${GUIDE_CLOUD_DISCLOSURE_POLICY_VERSION}';`,
    );
    expect(source).not.toContain('guide-cloud-processing.draft.v1');
  });

  it('discloses both safety passes, generated draft processing, and local-only state in all locales', async () => {
    const source = await readFile(new URL('./open-assistant.ts', import.meta.url), 'utf8');
    const cloudBodies = [...source.matchAll(/cloudBody: '([^'\n]+)'/gu)]
      .map((match) => match[1] ?? '');
    expect(cloudBodies).toHaveLength(5);

    const localizedRequirements = [
      ['recent Guide messages', 'visible sources above', 'generated draft reply back to OpenAI', 'second safety check', 'stays only in this browser session', 'not stored as text by Zodiacs.org'],
      ['los mensajes recientes', 'las fuentes visibles', 'borrador de respuesta generado de nuevo a OpenAI', 'segunda revisión de seguridad', 'permanece solo en esta sesión del navegador', 'Zodiacs.org no almacena su texto'],
      ['as mensagens recentes', 'as fontes visíveis', 'rascunho de resposta gerado de volta à OpenAI', 'segunda verificação de segurança', 'fica apenas nesta sessão do navegador', 'não é armazenada como texto pelo Zodiacs.org'],
      ['les messages récents', 'les sources visibles', 'brouillon de réponse généré à OpenAI', 'second contrôle de sécurité', 'reste uniquement dans cette session du navigateur', 'n’est pas stockée sous forme de texte par Zodiacs.org'],
      ['i messaggi recenti', 'le fonti visibili', 'bozza di risposta generata', 'secondo controllo di sicurezza', 'resta soltanto in questa sessione del browser', 'non viene archiviata come testo da Zodiacs.org'],
    ] as const;

    for (const [index, requirements] of localizedRequirements.entries()) {
      const body = cloudBodies[index] ?? '';
      expect((body.match(/OpenAI/gu) ?? []).length, `locale ${index} names both provider passes`)
        .toBeGreaterThanOrEqual(2);
      for (const requirement of requirements) {
        expect(body, `locale ${index}: ${requirement}`).toContain(requirement);
      }
    }
  });
});

describe('assistant SSE frames', () => {
  it('parses text, completion, and error frames', () => {
    expect(parseAssistantSseFrame('data: {"t":"hello"}')).toEqual({ delta: 'hello' });
    expect(parseAssistantSseFrame('data: [DONE]')).toEqual({ done: true });
    expect(parseAssistantSseFrame('event: message\ndata: {"error":"unavailable"}'))
      .toEqual({ error: 'unavailable' });
  });

  it('fails closed on malformed model data', () => {
    expect(parseAssistantSseFrame('data: <b>not json</b>'))
      .toEqual({ error: 'temporarily_unavailable' });
    expect(parseAssistantSseFrame(': keepalive')).toEqual({});
  });

  it('rejects a truncated stream that ends without DONE', async () => {
    const deltas: string[] = [];
    await expect(consumeAssistantStream(
      new Response('data: {"t":"partial"}\n\n'),
      (delta) => deltas.push(delta),
    )).rejects.toThrow('unavailable');
    expect(deltas).toEqual(['partial']);
  });
});

describe('assistant markdown subset', () => {
  it('parses paragraphs, bold, italics, lists, and labelled same-site links', () => {
    const blocks = parseAssistantMarkdown([
      'Your **Sun sign** is *core identity*.',
      '',
      "To find your Moon sign, you'll need:",
      '',
      '- Your full birth date, including **year**',
      '- Your birthplace',
      '',
      'Enter those in the [birth-chart calculator](/birth-chart/).',
    ].join('\n'));

    expect(blocks).toEqual([
      {
        kind: 'paragraph',
        children: [
          { kind: 'text', text: 'Your ' },
          { kind: 'strong', children: [{ kind: 'text', text: 'Sun sign' }] },
          { kind: 'text', text: ' is ' },
          { kind: 'em', children: [{ kind: 'text', text: 'core identity' }] },
          { kind: 'text', text: '.' },
        ],
      },
      {
        kind: 'paragraph',
        children: [{ kind: 'text', text: "To find your Moon sign, you'll need:" }],
      },
      {
        kind: 'list',
        ordered: false,
        items: [
          [
            { kind: 'text', text: 'Your full birth date, including ' },
            { kind: 'strong', children: [{ kind: 'text', text: 'year' }] },
          ],
          [{ kind: 'text', text: 'Your birthplace' }],
        ],
      },
      {
        kind: 'paragraph',
        children: [
          { kind: 'text', text: 'Enter those in the ' },
          { kind: 'link', path: '/birth-chart/', label: 'birth-chart calculator' },
          { kind: 'text', text: '.' },
        ],
      },
    ]);
  });

  it('splits a paragraph followed by list lines without a blank separator', () => {
    expect(parseAssistantMarkdown('Bring:\n- a date\n1. a time')).toEqual([
      { kind: 'paragraph', children: [{ kind: 'text', text: 'Bring:' }] },
      { kind: 'list', ordered: false, items: [[{ kind: 'text', text: 'a date' }]] },
      { kind: 'list', ordered: true, items: [[{ kind: 'text', text: 'a time' }]] },
    ]);
  });

  it('links bare catalog paths and keeps everything else literal text', () => {
    expect(parseAssistantMarkdown('See /learn/ and /registry/aries/ or 2*3*4.')).toEqual([
      {
        kind: 'paragraph',
        children: [
          { kind: 'text', text: 'See ' },
          { kind: 'link', path: '/learn/', label: '/learn/' },
          { kind: 'text', text: ' and /registry/aries/ or 2*3*4.' },
        ],
      },
    ]);
  });

  it('degrades disallowed named links and headings to plain text', () => {
    expect(parseAssistantMarkdown('## Watch\n[shop](/registry/) now')).toEqual([
      {
        kind: 'paragraph',
        children: [{ kind: 'text', text: 'Watch\n[shop](/registry/) now' }],
      },
    ]);
    expect(parseAssistantMarkdown('[evil](https://example.com/x) text')).toEqual([
      {
        kind: 'paragraph',
        children: [{ kind: 'text', text: '[evil](https://example.com/x) text' }],
      },
    ]);
  });
});

describe('today-sky context', () => {
  it('summarizes the current computed sky as placement lines without location data', async () => {
    const summary = await todaySkySummary(new Date('2026-08-31T12:00:00.000Z'));
    expect(summary).toContain('Current sky (tropical, geocentric), computed 2026-08-31 12:00 UTC:');
    expect(summary).toMatch(/Sun: \d+°\d{2}′ [A-Z][a-z]+/);
    expect(summary).toMatch(/Moon: \d+°\d{2}′ [A-Z][a-z]+/);
    expect(summary).not.toMatch(/lat|lon|house/i);
  });
});

describe('Guide response links', () => {
  it('links only exact server-approved catalog paths', async () => {
    const source = await readFile(new URL('./open-assistant.ts', import.meta.url), 'utf8');
    const allowlist = source.slice(
      source.indexOf('const GUIDE_LINK_PATHS'),
      source.indexOf('let stylesheetPromise'),
    );
    const renderer = source.slice(
      source.indexOf('export function assistantLinkPath'),
      source.indexOf('function scrollTranscript'),
    );
    const moonPath = GUIDE_KNOWLEDGE_ENTRIES.find(({ id }) => id === 'moon-sign')?.canonicalPath;
    expect(moonPath).toBe('/moon-sign/');
    expect(allowlist).toContain(`'${moonPath}'`);
    expect(allowlist).not.toMatch(/\/(?:astrofolio|registry|terminal|sdk|disclosure)\//u);
    expect(allowlist).not.toContain("'/private/'");
    expect(renderer).toContain('GUIDE_LINK_PATHS.has(`${url.pathname}${url.hash}`)');
    expect(renderer).toContain("url.search === ''");
  });

  it('uses a dedicated fixed catalog selector for Moon-sign pages', async () => {
    const source = await readFile(new URL('./open-assistant.ts', import.meta.url), 'utf8');
    const pageCatalog = source.slice(
      source.indexOf('const PAGE_CATALOG'),
      source.indexOf('function clearPendingRetry'),
    );
    expect(pageCatalog).toContain("'moon-sign': { title: 'Moon sign'");
    expect(pageCatalog).toContain("if (/^\\/moon-sign(?:\\/|$)/.test(path)) return 'moon-sign';");
  });
});

describe('Guide typography boundary', () => {
  it('keeps launcher fonts on the page-owned no-swap tokens', async () => {
    const css = await readFile(new URL('./assistant.css', import.meta.url), 'utf8');
    const proactiveSurfaces = css.slice(css.indexOf('.zguide-launcher {'));
    expect(proactiveSurfaces).toContain('font: 600 14px/1 var(--font-sans);');
    expect(proactiveSurfaces).not.toMatch(/['"](?:Instrument Sans|EB Garamond)['"]/u);
  });

  it('labels the launcher on wide viewports and collapses it to the avatar on small ones', async () => {
    const [drawerCss, shellCss, shellSource] = await Promise.all([
      readFile(new URL('./assistant.css', import.meta.url), 'utf8'),
      readFile(new URL('./guide-bootstrap.css', import.meta.url), 'utf8'),
      readFile(new URL('./guide-bootstrap.ts', import.meta.url), 'utf8'),
    ]);
    const launcherRule = shellCss.slice(
      shellCss.indexOf('.zguide-launcher {'),
      shellCss.indexOf('.zguide-launcher[data-footer-guide-visible]'),
    );
    expect(launcherRule).not.toContain('font-size: 0;');
    const collapse = shellCss.slice(shellCss.indexOf('@media (max-width: 560px)'));
    expect(collapse).toContain('width: 48px;');
    expect(collapse).toContain('height: 48px;');
    expect(collapse).toContain('font-size: 0;');
    expect(shellSource).toContain("launcher.setAttribute('aria-label', currentCopy().open);");
    expect(shellSource).toContain('label.textContent = currentCopy().label;');
    expect(drawerCss).toContain('@media (max-width: 560px)');
  });
});

describe('Guide avatar identity', () => {
  it('ships one bounded local derivative and uses it accessibly across Guide surfaces', async () => {
    const root = new URL('../../../', import.meta.url);
    const avatar = await readFile(new URL('public/assets/guide-avatar.webp', root));
    const metadata = await sharp(avatar).metadata();
    expect(metadata).toMatchObject({ format: 'webp', width: 256, height: 256 });
    expect(avatar.byteLength).toBeLessThan(20_000);
    expect(createHash('sha256').update(avatar).digest('hex'))
      .toBe('9970c7c5d7d20343e20a7f59422f3647c2ff3bf38a0565ac145d5bed0f96bb11');

    const source = await readFile(new URL('./open-assistant.ts', import.meta.url), 'utf8');
    const css = await readFile(new URL('./assistant.css', import.meta.url), 'utf8');
    const build = await readFile(new URL('../../../scripts/build-assistant-ui.mjs', import.meta.url), 'utf8');
    expect(source).toContain("const GUIDE_AVATAR_SRC = '/assets/guide-avatar.webp';");
    expect(source).toContain("image.alt = '';");
    expect(source).toContain("image.loading = 'lazy';");
    expect(source).toContain("image.decoding = 'async';");
    expect(source).toContain("image.setAttribute('aria-hidden', 'true');");
    expect(source).toContain("image.setAttribute('fetchpriority', 'low');");
    for (const surface of [
      "createGuideAvatar('zguide-launcher__avatar', 32)",
      "createGuideAvatar('zassistant__avatar', 38)",
      "createGuideAvatar('zassistant__message-avatar', 20)",
    ]) expect(source).toContain(surface);
    expect(css).toContain('.zguide-avatar {');
    expect(css).toContain('.zguide-launcher__avatar { width: 32px; height: 32px; }');
    expect(build).toContain("const avatarSource = resolve(repo, 'public/assets/guide-avatar.webp');");
    expect(build).toContain('await copyFile(avatarSource, avatar);');
    expect(build).toContain('if (avatarSize > 20_000)');
  });
});

describe('assistant profile-access privacy fence', () => {
  it('invalidates first, then scrubs every account-derived assistant surface on denial', async () => {
    const source = await readFile(new URL('./open-assistant.ts', import.meta.url), 'utf8');
    const clearStart = source.indexOf('function clearAssistantForProfileRevocation()');
    const handlerStart = source.indexOf('function onProfileAccessChange()');
    const consentStart = source.indexOf('async function requestChartConsent(');
    const clear = source.slice(clearStart, handlerStart);
    const handler = source.slice(handlerStart, consentStart);

    expect(clearStart).toBeGreaterThan(-1);
    expect(handler).toContain('profileAccessGeneration += 1;');
    expect(handler.indexOf('profileAccessGeneration += 1;'))
      .toBeLessThan(handler.indexOf('profileAccessAllowed()'));
    expect(handler).toContain('refreshSavedChart();');
    expect(handler).toContain('clearAssistantForProfileRevocation();');

    for (const requiredScrub of [
      'abortRequest();',
      'dismissPendingConsent?.();',
      'dismissPendingCloudConsent?.();',
      'dismissPendingConsent = null;',
      'dismissPendingCloudConsent = null;',
      'savedChart = null;',
      'chartSummaryPromise = null;',
      'chartConsented = false;',
      'chartEnabled = false;',
      'chartSourceId = null;',
      'pendingRetry = null;',
      'replaceWithFreshSession();',
      'transcript?.replaceChildren();',
      "textarea.value = '';",
      'setBusy(false);',
    ]) {
      expect(clear, requiredScrub).toContain(requiredScrub);
    }
    expect(source).toContain(
      "window.addEventListener('zodiacs:profile-access', onProfileAccessChange);",
    );
    expect(source).toContain("window.addEventListener('zodiacs:profile', onProfileDataChange);");
    expect(source).toContain("window.addEventListener('storage', onGuideStorageChange);");
    expect(source).toContain('if (event.key === null || event.key === PROFILE_KEY');
    expect(source).toContain('getSession().authBoundary !== `account:${ownerId}`');
  });

  it('scrubs private DOM before BFCache and requires a fresh auth snapshot after restore', async () => {
    const source = await readFile(new URL('./open-assistant.ts', import.meta.url), 'utf8');
    const suspend = source.slice(
      source.indexOf('function suspendGuideForPageCache()'),
      source.indexOf('function restoreGuideAfterPageCache('),
    );
    const restore = source.slice(
      source.indexOf('function restoreGuideAfterPageCache('),
      source.indexOf('function onProfileAccessChange()'),
    );
    expect(suspend).toContain('profileAccessGeneration += 1;');
    expect(suspend).toContain('authFenceCleanup?.();');
    expect(suspend).toContain('authFencePromise = null;');
    expect(suspend).toContain('transcript?.replaceChildren();');
    expect(suspend).toContain('if (root) root.hidden = true;');
    expect(restore).toContain('if (!event.persisted) return;');
    expect(restore).toContain('void ensureGuideAuthFence();');
    expect(source).toContain("window.addEventListener('pagehide', suspendGuideForPageCache);");
    expect(source).toContain("window.addEventListener('pageshow', restoreGuideAfterPageCache);");
  });

  it('fences consent, network send, stream paint, and completion state to one access generation', async () => {
    const source = await readFile(new URL('./open-assistant.ts', import.meta.url), 'utf8');
    const consentStart = source.indexOf('async function requestChartConsent(');
    const submitStart = source.indexOf('async function submitQuestion()');
    const focusStart = source.indexOf('function focusableControls()');
    const consent = source.slice(consentStart, submitStart);
    const submit = source.slice(submitStart, focusStart);

    expect(consent).toContain('expectedGeneration = profileAccessGeneration');
    expect(consent).toContain('!currentProfileAccessGeneration(expectedGeneration)');
    expect(consent.indexOf('const summary = await chartSummaryPromise;'))
      .toBeLessThan(consent.indexOf('savedChart !== chart'));
    expect(consent).toContain('return current && granted;');

    expect(submit).toContain('const expectedGeneration = profileAccessGeneration;');
    expect(submit).toContain('await requestCloudConsent()');
    expect(submit).toContain('requestChartConsent(expectedGeneration)');
    expect(submit).toContain('!currentProfileAccessGeneration(expectedGeneration)');

    const runStart = source.indexOf('async function runTurn(');
    const submitEnd = source.indexOf('async function submitQuestion()');
    const run = source.slice(runStart, submitEnd);
    expect(run).toContain('activeRequest === request');
    expect(run).toContain("const response = await fetch('/v1/guide/turn'");
    expect(run).toContain('signal: request.signal');
    expect(run).toContain('await response.body?.cancel().catch(() => {});');
    expect(run).toContain('if (!requestIsCurrent()) return;');
    expect(run).toContain('if (activeRequest === request) setBusy(false);');
    expect(run).toContain('sameSelfChartAuthority');
    expect(run).toContain('window.setInterval');
    expect(run).toContain('onProfileDataChange();');

    const toggleStart = source.indexOf('function toggleChart()');
    const buildStart = source.indexOf('function build()');
    const toggle = source.slice(toggleStart, buildStart);
    expect(toggle).toContain('requestChartConsent(expectedGeneration)');
    expect(toggle).toContain('invalidateContext(true);');
  });

  it('limits page context to a fixed public catalog and never reads private URL surfaces', async () => {
    const source = await readFile(new URL('./open-assistant.ts', import.meta.url), 'utf8');
    const pageStart = source.indexOf('const PAGE_CATALOG =');
    const contextStart = source.indexOf('function invalidateContext(');
    const pageBoundary = source.slice(pageStart, contextStart);

    expect(pageBoundary).toContain("sourceId: `page:${id}`");
    expect(pageBoundary).toContain('approvedPageId(location.pathname)');
    expect(pageBoundary).not.toMatch(/location\.(?:search|href|hash)|document\.referrer|document\.title/);
    expect(pageBoundary).toContain("if (!id) return null;");
  });

  it('refreshes previously cached Guide entrypoints and revalidates future updates', async () => {
    const config = JSON.parse(await readFile(new URL('../../../vercel.json', import.meta.url), 'utf8'));
    const shellUrl = new URL(GUIDE_SHELL_URL, 'https://zodiacs.org');
    expect(shellUrl.searchParams.get('v')).toBe('ask-guide-4');
    expect(guideLoaderSource('en')).toContain(`import('${GUIDE_SHELL_URL}')`);

    for (const path of [
      shellUrl.pathname,
      '/assets/assistant-ui.css',
      '/assets/assistant-drawer.js',
      '/assets/assistant-drawer.css',
    ]) {
      const rules = config.headers.filter((rule: { source: string }) => rule.source === path);
      expect(rules, path).toHaveLength(1);
      expect(rules[0].headers).toContainEqual({
        key: 'Cache-Control',
        value: 'public, max-age=0, must-revalidate',
      });
    }
  });

  it('bootstraps a quiet launcher without reading a chart or calling Guide', async () => {
    const [shell, loader, drawer, buildScript] = await Promise.all([
      readFile(new URL('./guide-bootstrap.ts', import.meta.url), 'utf8'),
      readFile(new URL('./guide-loader.mjs', import.meta.url), 'utf8'),
      readFile(new URL('./open-assistant.ts', import.meta.url), 'utf8'),
      readFile(new URL('../../../scripts/build-assistant-ui.mjs', import.meta.url), 'utf8'),
    ]);
    const bootstrapStart = shell.indexOf('export async function bootstrapGuide(');
    const bootstrap = shell.slice(bootstrapStart);

    expect(shell).toContain("const DRAWER_MODULE_HREF = '/assets/assistant-drawer.js?v=ask-guide-4';");
    expect(shell).not.toContain('INVITE_DELAY_MS');
    expect(shell).not.toContain('INVITE_KEY');
    expect(shell).not.toContain('showInvite');
    expect(shell).not.toContain('zguide-invite');
    expect(bootstrap).not.toContain('setTimeout(');
    expect(shell).toContain('context.drawImage(image, 0, 0, size, size);');
    expect(shell).toContain("canvas.setAttribute('aria-hidden', 'true');");
    expect(shell).toContain('drawerModulePromise ??= import(DRAWER_MODULE_HREF)');
    expect(loader).toContain('export const GUIDE_POST_LOAD_DELAY_MS = 500;');
    expect(loader).toContain("export const GUIDE_SHELL_URL = '/assets/assistant-ui.js?v=ask-guide-4';");
    expect(loader).toContain("modulePromise = import('${GUIDE_SHELL_URL}')");
    expect(shell).toContain("const STYLESHEET_HREF = '/assets/assistant-ui.css?v=ask-guide-4';");
    expect(loader).toContain("window.addEventListener('load', scheduleGuide, { once: true });");
    expect(loader).toContain("document.addEventListener('click', onGuideIntent, true);");
    expect(loader).toContain('event.stopImmediatePropagation();');
    expect(loader).toContain('return mod.openAssistant(');
    expect(bootstrap).not.toContain('loadDrawer(');
    expect(bootstrap).not.toContain('readSelectedSelfChart');
    expect(bootstrap).not.toContain('fetch(');
    expect(bootstrap).not.toContain('.focus()');
    expect(shell).not.toContain('/v1/guide/turn');
    expect(shell).not.toContain('zodiacs.guide.daily-session.v1');
    expect(drawer).toContain("const STYLESHEET_HREF = '/assets/assistant-drawer.css?v=ask-guide-4';");
    expect(drawer).toContain("document.querySelector<HTMLButtonElement>('[data-guide-launcher]')");
    expect(drawer).not.toContain('function wireOpeners(');
    expect(buildScript).toContain("'assistant-ui': resolve(repo, 'src/lib/assistant/guide-bootstrap.ts')");
    expect(buildScript).toContain("'assistant-drawer': resolve(repo, 'src/lib/assistant/open-assistant.ts')");
  });

  it('keeps remote analytics out of the Guide route and static wing surfaces', async () => {
    const root = new URL('../../../', import.meta.url);
    const base = await readFile(new URL('src/layouts/Base.astro', root), 'utf8');
    const shell = await readFile(new URL('src/lib/assistant/guide-bootstrap.ts', root), 'utf8');
    const loader = await readFile(new URL('src/lib/assistant/guide-loader.mjs', root), 'utf8');
    const guide = await readFile(new URL('src/pages/ask/index.astro', root), 'utf8');
    expect(base).not.toContain('guideRuntimeEnabled');
    expect(base).toContain('plausibleScriptUrl && (!props.noindex || props.analyticsOnNoindex) && !props.privateSurface');
    expect(base).toContain('&& !accountSyncV2Enabled,');
    expect(base).toContain('data-guide-analytics-boundary={plausibleEnabled || webAnalyticsEnabled ?');
    expect(base).toContain("sessionStorage.getItem(guidePrivateSessionKey) === '1'");
    expect(loader).toContain("export const GUIDE_PRIVATE_SESSION_KEY = 'zodiacs.guide.private-session.v1';");
    expect(loader).toContain("sessionStorage.setItem(privateSessionKey, '1');");
    expect(loader).toContain('location.reload();');
    expect(shell).toContain('if (beginPrivateTransition()) return;');
    expect(guide).toContain('privateSurface');
    for (const path of [
      'public/archive/index.html',
      'public/astrofolio/index.html',
      'public/registry/index.html',
      'public/registry/aries/index.html',
      'public/registry/technical/index.html',
      'public/sdk/index.html',
      'public/terminal/index.html',
      'public/terminal/markets/index.html',
      'public/thesis/index.html',
    ]) {
      const html = await readFile(new URL(path, root), 'utf8');
      expect(html, path).not.toContain('plausible.io/js');
      expect(html, path).not.toContain('zodiacs-analytics:start');
      expect(html, path).not.toContain('window.plausible = window.plausible');
      expect(html, path).toContain('data-guide-loader="zodiacs-guide-loader-v1"');
      expect(html, path).toContain('return mod.bootstrapGuide(defaultLocale)');
    }
  });
});
