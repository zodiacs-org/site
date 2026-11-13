import { existsSync, readdirSync, readFileSync } from 'node:fs';
import Ajv from 'ajv';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TWIN_DIRECTORY } from '../sharing/twin-directory';
import { CALCULATOR_TOOL_NAMES, runCalculatorTool } from './calculator-runtime';
import { CALCULATOR_TOOLS, calculatorToolForPath } from './calculator-tools';
import { readDate, readInstant } from './calculators/input';
import { pairSlug } from '../pair-slug';
import { SIGN_SLUGS } from '../signs';
import { LIFE_PATH_NUMBERS } from '../../data/numerology-pages';
import { LONDON, PARIS, SYDNEY, TOKYO } from '../../../tests/webmcp/calculator-fixtures';
import { calculatorTool, webMcpToolsForPage } from './register';

const pages = new URL('../../pages/', import.meta.url);
const LOCALES = ['es', 'pt', 'fr', 'it', 'ru'] as const;
const SHARING = ['/big-three/', '/chart-twins/', '/group-charts/'];

/** Whether the site builds a page at `path` (a static page, or a localized sharing page from [sharingLocale]). */
function pageExists(path: string): boolean {
  const locale = LOCALES.find((code) => path.startsWith(`/${code}/`));
  if (locale && SHARING.includes(path.slice(locale.length + 1))) return existsSync(new URL(`[sharingLocale]${path.slice(locale.length + 1)}index.astro`, pages));
  return existsSync(new URL(`.${path}index.astro`, pages));
}

// One valid input per tool: synthetic births only.
const BIRTH = { date: '1990-06-15', time: '14:30', place: LONDON };
const VALID: Record<string, unknown> = {
  'zodiacs.birth_chart': { ...BIRTH, houseSystem: 'placidus' },
  'zodiacs.moon_sign': { date: '1985-03-02', place: TOKYO },
  'zodiacs.rising_sign': BIRTH,
  'zodiacs.big_three': BIRTH,
  'zodiacs.compatibility': { first: BIRTH, second: { date: '1992-01-20', place: SYDNEY } },
  'zodiacs.transits': { birth: BIRTH, at: '2026-10-15T12:00:00Z' },
  'zodiacs.saturn_return': { date: '1990-06-15', time: '14:30', place: LONDON },
  'zodiacs.solar_return': { birth: BIRTH, year: 2027, castPlace: PARIS, houseSystem: 'whole' },
  'zodiacs.lunar_return': { birth: BIRTH, after: '2026-10-15T00:00:00Z' },
  'zodiacs.numerology': { birthDate: '1990-06-15', fullName: 'Alex Synthetic Example', today: '2026-10-15' },
  'zodiacs.moon_phase': { date: '2024-03-20', time: '21:45', place: PARIS },
  'zodiacs.baby_zodiac': { dueDate: '2027-02-10' },
  'zodiacs.chart_twins': BIRTH,
  'zodiacs.group_chart': { people: [{ name: 'A', birth: BIRTH }, { birth: { date: '1985-03-02', place: TOKYO } }, { name: 'C', birth: { date: '2003-11-20', time: '23:59', place: SYDNEY } }] },
  'zodiacs.chart_pdf': { date: '1985-03-02', place: TOKYO },
  'zodiacs.year_wrapped': { birth: BIRTH, year: 2026 },
};

// Inputs each schema refuses, and the runtime with it.
const INVALID: Array<[string, unknown]> = [
  ['zodiacs.birth_chart', { ...BIRTH, extra: 1 }],
  ['zodiacs.birth_chart', { ...BIRTH, date: '1799-12-31' }],
  ['zodiacs.birth_chart', { ...BIRTH, date: '2200-01-01' }],
  ['zodiacs.birth_chart', { ...BIRTH, time: '24:00' }],
  ['zodiacs.birth_chart', { ...BIRTH, houseSystem: 'koch' }],
  ['zodiacs.birth_chart', { date: BIRTH.date }],
  ['zodiacs.birth_chart', { ...BIRTH, place: { ...LONDON, latitude: 91 } }],
  ['zodiacs.rising_sign', { date: BIRTH.date, place: LONDON }],
  ['zodiacs.big_three', { date: BIRTH.date, place: LONDON }],
  ['zodiacs.compatibility', { first: BIRTH }],
  ['zodiacs.transits', { birth: BIRTH, at: '2026-10-15 12:00' }],
  ['zodiacs.solar_return', { birth: BIRTH, year: 2200 }],
  ['zodiacs.solar_return', { birth: BIRTH, year: 2026.5 }],
  ['zodiacs.lunar_return', { birth: { date: BIRTH.date, place: LONDON } }],
  ['zodiacs.numerology', { birthDate: '1990-06-15', fullName: 'x'.repeat(201) }],
  ['zodiacs.moon_phase', { date: '2024-3-20' }],
  ['zodiacs.baby_zodiac', { dueDate: '1989-12-31' }],
  ['zodiacs.baby_zodiac', { dueDate: '2029-01-01' }],
  ['zodiacs.group_chart', { people: [{ birth: BIRTH }, { birth: BIRTH }] }],
  ['zodiacs.group_chart', { people: [{ name: 'x'.repeat(25), birth: BIRTH }, { birth: BIRTH }, { birth: BIRTH }] }],
  ['zodiacs.chart_pdf', { date: BIRTH.date }],
  ['zodiacs.year_wrapped', { birth: BIRTH, year: 1799 }],
];

afterEach(() => { vi.unstubAllGlobals(); });

function serveDirectory() {
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    expect(url).toBe('/data/chart-twins.json');
    return new Response(JSON.stringify({ schema: 'zodiacs.chart-twins.v1', people: TWIN_DIRECTORY }));
  }));
}

describe('the calculator tools', () => {
  it('cover every calculator once, each with a calculation behind it', () => {
    const names = CALCULATOR_TOOLS.map((tool) => tool.name);
    expect(new Set(names).size).toBe(names.length);
    expect([...names].sort()).toEqual([...CALCULATOR_TOOL_NAMES].sort());
    expect(Object.keys(VALID).sort()).toEqual([...names].sort());
    for (const tool of CALCULATOR_TOOLS) {
      expect(tool.name).toMatch(/^zodiacs\.[a-z_]+$/);
      expect(tool.description.length).toBeLessThan(600);
    }
  });

  it('are found from each page path, in every locale the page is built in', () => {
    let localized = 0;
    for (const tool of CALCULATOR_TOOLS) {
      expect(pageExists(tool.path)).toBe(true);
      expect(calculatorToolForPath(tool.path)).toBe(tool);
      for (const locale of LOCALES) {
        const path = `/${locale}${tool.path}`;
        if (!pageExists(path)) continue;
        localized += 1;
        expect(calculatorToolForPath(path)).toBe(tool);
      }
    }
    expect(localized).toBeGreaterThan(40);
    expect(calculatorToolForPath('/')).toBeNull();
    expect(calculatorToolForPath('/birth-chart/someone-else/')).toBeNull();
    expect(calculatorToolForPath('/registry/')).toBeNull();
  });

  it('are found from every address the host serves as the page', () => {
    // Vercel serves /birth-chart/index.html and /birth%2Dchart/ as /birth-chart/; a build with trailingSlash 'ignore'
    // serves /birth-chart too. location.pathname keeps the address as it was opened.
    const routes = CALCULATOR_TOOLS.flatMap((tool) => [tool.path, ...(tool.alsoOn ?? [])].map((path): [string, string] => [path, tool.name]));
    let addresses = 0;
    for (const [route, name] of routes) {
      for (const path of [route, ...LOCALES.map((locale) => `/${locale}${route}`)]) {
        const escaped = path.replace(/[a-z]/u, (letter) => `%${letter.charCodeAt(0).toString(16).toUpperCase()}`);
        for (const address of [path, path.slice(0, -1), `${path}index.html`, escaped]) {
          expect(calculatorToolForPath(address)?.name, address).toBe(name);
          addresses += 1;
        }
      }
    }
    expect(addresses).toBe(routes.length * (1 + LOCALES.length) * 4);
    for (const path of ['/index.html', '/es', '/es/index.html', '/birth-chart/someone-else', '/birth-chart/someone-else/index.html',
      '/birth-chart/index.htm', '/birth-chart/index', '/birth-chartx/', '/birth-chart/x/', '/birth-chart/%', '/%E0%A4%A']) {
      expect(calculatorToolForPath(path), path).toBeNull();
    }
  });

  it('are found on the pages that embed a calculator: each rising sign, each compatibility pair, each Life Path', () => {
    const embedded: Array<[string, string]> = [
      ...SIGN_SLUGS.map((sign): [string, string] => [`/rising-sign/${sign}/`, 'zodiacs.rising_sign']),
      ...SIGN_SLUGS.flatMap((first, index) => SIGN_SLUGS.slice(index)
        .map((second): [string, string] => [`/compatibility/${pairSlug(first, second)}/`, 'zodiacs.compatibility'])),
      ...LIFE_PATH_NUMBERS.map((n): [string, string] => [`/numerology/life-path/${n}/`, 'zodiacs.numerology']),
    ];
    expect(embedded).toHaveLength(12 + 78 + 12);
    for (const [path, name] of embedded) {
      expect(calculatorToolForPath(path)?.name, path).toBe(name);
      expect(calculatorToolForPath(`/es${path}`)?.name, path).toBe(name);
    }
    for (const path of ['/compatibility/invite/', '/compatibility/taurus-aries/', '/rising-sign/aries/more/', '/numerology/life-path/10/']) {
      expect(calculatorToolForPath(path), path).toBeNull();
    }
  });

  it('are all checked in the built site by scripts/check-dist.mjs', () => {
    const checkDist = readFileSync(new URL('../../../scripts/check-dist.mjs', import.meta.url), 'utf8');
    for (const tool of CALCULATOR_TOOLS) expect(checkDist).toContain(`['${tool.name}', '${tool.path}', `);
  });

  it('register on a page beside search on English pages, and alone elsewhere', () => {
    const names = (page: { path: string; search: boolean }) => webMcpToolsForPage(page).map((tool) => tool.name);
    expect(names({ path: '/birth-chart/', search: true })).toEqual(['zodiacs.search', 'zodiacs.birth_chart']);
    expect(names({ path: '/es/birth-chart/', search: false })).toEqual(['zodiacs.birth_chart']);
    expect(names({ path: '/fr/big-three/', search: false })).toEqual(['zodiacs.big_three']);
    expect(names({ path: '/', search: true })).toEqual(['zodiacs.search']);
    expect(names({ path: '/es/', search: false })).toEqual([]);
    for (const tool of webMcpToolsForPage({ path: '/transits/', search: true })) {
      expect(tool.annotations).toEqual({ readOnlyHint: true });
    }
  });

  it('load the calculations only when called, and pass the call through', async () => {
    const load = vi.fn(async () => ({ runCalculatorTool: vi.fn(async (name: string, input: unknown) => ({ ok: true, data: { name, input } })) }));
    const tool = calculatorTool(CALCULATOR_TOOLS[0], load);
    expect(load).not.toHaveBeenCalled();
    await expect(tool.execute({ date: '2000-01-01' })).resolves.toEqual({ ok: true, data: { name: 'zodiacs.birth_chart', input: { date: '2000-01-01' } } });
    expect(load).toHaveBeenCalledOnce();
  });
});

describe('each tool\'s schema and its reader agree', () => {
  const ajv = new Ajv({ strict: true, allErrors: true });
  const validators = new Map(CALCULATOR_TOOLS.map((tool) => [tool.name, ajv.compile(tool.inputSchema)]));

  it.each(Object.entries(VALID))('%s accepts a valid input and answers it', async (name, input) => {
    expect(validators.get(name)!(input)).toBe(true);
    if (name === 'zodiacs.chart_twins') serveDirectory();
    const envelope = await runCalculatorTool(name, input);
    expect(envelope).toMatchObject({ ok: true });
    const text = JSON.stringify(envelope);
    expect(JSON.parse(text)).toEqual(envelope);
    expect(text).not.toMatch(/NaN|Infinity/);
  });

  it.each(INVALID)('%s refuses %j', async (name, input) => {
    expect(validators.get(name)!(input)).toBe(false);
    const envelope = await runCalculatorTool(name, input);
    expect(envelope).toEqual({ ok: false, error: { code: 'INVALID_INPUT', message: expect.any(String) } });
  });

  it('count a text\'s length as the schema does, in code points rather than UTF-16 code units', async () => {
    // Every bounded text field in the schemas. A field added later fails here until it is checked below; a time zone
    // name is ASCII, so only free text can tell the two counts apart.
    const bounded = new Set<string>();
    const walk = (node: unknown, key: string) => {
      if (Array.isArray(node)) node.forEach((item) => walk(item, key));
      else if (node && typeof node === 'object') {
        const schema = node as Record<string, unknown>;
        if (schema.type === 'string' && ('maxLength' in schema || 'minLength' in schema)) bounded.add(key);
        for (const [child, value] of Object.entries(schema)) {
          if (child === 'properties') for (const [property, field] of Object.entries(value as object)) walk(field, property);
          else walk(value, key);
        }
      }
    };
    for (const tool of CALCULATOR_TOOLS) walk(tool.inputSchema, '');
    expect([...bounded].sort()).toEqual(['fullName', 'name', 'timeZone']);
    // A crescent moon is one code point and two UTF-16 code units; a lone surrogate is one of each.
    const moon = '\u{1F319}';
    const group = (name: string) => ({ people: [{ name, birth: BIRTH }, ...(VALID['zodiacs.group_chart'] as { people: unknown[] }).people.slice(1)] });
    const cases: Array<[string, unknown, boolean]> = [
      ['zodiacs.group_chart', group(moon.repeat(24)), true],
      ['zodiacs.group_chart', group(`Ana ${moon.repeat(20)}`), true],
      ['zodiacs.group_chart', group('\uD83D'.repeat(24)), true],
      ['zodiacs.group_chart', group(moon.repeat(25)), false],
      ['zodiacs.group_chart', group(`${'x'.repeat(24)}\uDE19`), false],
      ['zodiacs.numerology', { birthDate: '1990-06-15', fullName: moon.repeat(200), today: '2026-10-15' }, true],
      ['zodiacs.numerology', { birthDate: '1990-06-15', fullName: moon.repeat(201), today: '2026-10-15' }, false],
    ];
    for (const [name, input, fits] of cases) {
      expect(validators.get(name)!(input), JSON.stringify(input)).toBe(fits);
      const envelope = await runCalculatorTool(name, input);
      expect(envelope.ok || envelope.error.code !== 'INVALID_INPUT', JSON.stringify(input)).toBe(fits);
    }
    // A name that fits is shown as given.
    const named = await runCalculatorTool('zodiacs.group_chart', group(moon.repeat(24)));
    expect(JSON.stringify(named)).toContain(moon.repeat(24));
  });

  it('take exactly the calendar dates and the instants their readers take', () => {
    const property = (name: string, key: string) => ajv.compile(
      (CALCULATOR_TOOLS.find((tool) => tool.name === name)!.inputSchema as { properties: Record<string, object> }).properties[key],
    );
    const pageDate = property('zodiacs.numerology', 'birthDate');
    const dueDate = property('zodiacs.baby_zodiac', 'dueDate');
    const instant = property('zodiacs.transits', 'at');
    const two = (n: number) => String(n).padStart(2, '0');
    const disagree: string[] = [];
    // Every year from just before the pages' range to just after it, every month and day from 00 to an impossible one.
    for (let year = 1799; year <= 2200; year += 1) {
      for (let month = 0; month <= 13; month += 1) {
        for (let day = 0; day <= 32; day += 1) {
          const date = `${year}-${two(month)}-${two(day)}`;
          if (pageDate(date) !== (readDate(date) !== undefined)) disagree.push(date);
          if (dueDate(date) !== (readDate(date, '1990-01-01', '2028-12-31') !== undefined)) disagree.push(`due ${date}`);
        }
      }
    }
    // Instants: every date from just before the span to just after it at clock times on and past their limits, and
    // years far outside it. Transits take the pages' span; a lunar return's reference stops where its scan would
    // leave it.
    const reference = property('zodiacs.lunar_return', 'after');
    const times = ['00:00', '23:59:59.999', '24:00', '23:60', '12:00:60', '12:00:00.1234'];
    const instants = (year: number | string) => {
      const out: string[] = [];
      for (let month = 0; month <= 13; month += 1) {
        for (let day = 0; day <= 32; day += 1) for (const time of times) out.push(`${year}-${two(month)}-${two(day)}T${time}Z`);
      }
      return out;
    };
    for (const year of [1799, 1800, 1801, 1900, 2000, 2024, 2100, 2198, 2199, 2200, '0000', '9999']) {
      for (const at of instants(year)) {
        if (instant(at) !== (readInstant(at) !== undefined)) disagree.push(at);
        if (reference(at) !== (readInstant(at, '1800-01-02', '2199-11-21') !== undefined)) disagree.push(`after ${at}`);
      }
    }
    expect(disagree).toEqual([]);
    // The patterns are not trivially permissive or empty.
    expect([pageDate('2000-02-29'), pageDate('1900-02-29'), pageDate('2023-02-29'), pageDate('1990-02-30')]).toEqual([true, false, false, false]);
    expect([dueDate('2028-02-29'), dueDate('2027-02-29'), instant('2024-02-29T23:59Z'), instant('2024-01-01T24:00Z')]).toEqual([true, false, true, false]);
    expect([instant('1800-01-01T00:00Z'), instant('2199-12-31T23:59:59.999Z'), instant('1799-12-31T23:59Z'), instant('2200-01-01T00:00Z')]).toEqual([true, true, false, false]);
    expect([reference('1800-01-02T00:00Z'), reference('2199-11-21T23:59:59.999Z'), reference('1800-01-01T23:59Z'), reference('2199-11-22T00:00Z')]).toEqual([true, true, false, false]);
  });
});

describe('refusals', () => {
  const refusal = async (name: string, input: unknown) => {
    const envelope = await runCalculatorTool(name, input);
    expect(envelope.ok).toBe(false);
    return envelope.ok ? null : envelope.error;
  };

  it('name the problem with a fixed sentence that repeats nothing given', async () => {
    const cases: Array<[string, unknown, string]> = [
      ['zodiacs.saturn_return', { date: '1990-06-15', time: '14:30' }, 'TIME_NEEDS_PLACE'],
      ['zodiacs.birth_chart', { date: '2011-12-30', place: { latitude: -13.8333, longitude: -171.7513, timeZone: 'Pacific/Apia' } }, 'LOCAL_DATE_REFERENCE'],
      ['zodiacs.lunar_return', { birth: { date: '2021-03-28', time: '01:30', place: LONDON } }, 'CLOCK_CHANGE'],
      ['zodiacs.numerology', { birthDate: '1990-06-15', fullName: 'Алекс Синтетический' }, 'UNSUPPORTED_NAME'],
      ['zodiacs.group_chart', { people: [{ name: 'A', birth: BIRTH }, { name: 'a', birth: BIRTH }, { birth: BIRTH }] }, 'DUPLICATE_PERSON'],
      ['zodiacs.birth_chart', { ...BIRTH, place: { ...LONDON, timeZone: 'Mars/Olympus_Mons' } }, 'INVALID_INPUT'],
      ['zodiacs.numerology', { birthDate: '1990-02-30' }, 'INVALID_INPUT'],
      ['zodiacs.moon_phase', { date: '2023-02-29' }, 'INVALID_INPUT'],
      ['zodiacs.unknown', {}, 'UNKNOWN_TOOL'],
    ];
    for (const [name, input, code] of cases) {
      const error = await refusal(name, input);
      expect(error?.code).toBe(code);
      for (const value of ['1990', '14:30', 'Apia', 'Алекс', 'Olympus', '2021-03-28']) expect(error?.message).not.toContain(value);
    }
  });

  it('say when the directory cannot be read, rather than finding no twins', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 503 })));
    expect((await refusal('zodiacs.chart_twins', BIRTH))?.code).toBe('DIRECTORY_UNAVAILABLE');
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ schema: 'other', people: [] }))));
    expect((await refusal('zodiacs.chart_twins', BIRTH))?.code).toBe('DIRECTORY_UNAVAILABLE');
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('offline'); }));
    expect((await refusal('zodiacs.chart_twins', BIRTH))?.code).toBe('DIRECTORY_UNAVAILABLE');
  });
});

describe('the twin directory', () => {
  it('holds names and signs only', () => {
    expect(TWIN_DIRECTORY.length).toBeGreaterThan(100);
    for (const person of TWIN_DIRECTORY) expect(Object.keys(person).sort()).toEqual(['moon', 'name', 'slug', 'sun']);
    expect(readdirSync(pages).includes('data')).toBe(true);
  });
});
