/**
 * The Zodiacs sky-fact benchmark, v0 (public/developers/sky-benchmark/v0/).
 *
 * The published files are what scripts/build-sky-benchmark.mjs writes, and
 * v0 keeps the bytes it was published with. The key comes from the engine's
 * longitudes, speeds and Moon phase sampled every 10 minutes to 6 hours;
 * check_sky_fact answers from the compute API's search, which samples every 5
 * days or every day. Here check_sky_fact is held to the key on every question:
 * on the fact the key's answer names, on every other sign, on the dates either
 * side of a date answer, and on every entry into a sign while retrograde in a
 * question's period. Each question is read back against its key's facts, and
 * every rule and margin the generator publishes is derived again from the
 * engine, by other steps. The scorer reads replies as its header says.
 *
 * v0 was drawn with engine 0.1.1-rc.16 and the ΔT tables of 24 September
 * 2026. With another engine the generator refuses to draw or check v0 again,
 * and the one test that needs v0's own engine, the rules derived again and
 * held to its instants, does not run. check_sky_fact is still held to every
 * answer, since v0's margins keep the answers from turning on the engine's
 * error, and to every entry into a sign while retrograde in the ingress
 * questions' periods, found again in the installed engine.
 */
import { createHash } from 'node:crypto';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  ANY_OFFSET_DAY, DRAWN_FILES, ENGINE_ERROR_ARCSEC, REFERENCE_DATE, SIGNS, VERSION, datesHolding, drawnWith, factFor, folderOf,
  installedEngine, periodReach, redrawRefusal, replyDifferences, windowOf, writeOrCheck,
} from '../../scripts/build-sky-benchmark.mjs';
import {
  INSTRUCTIONS as SCORER_INSTRUCTIONS, SIGNS as SIGN_NAMES, readReply, scoreReply, scoreRun,
} from '../../public/developers/sky-benchmark/v0/scorer.mjs';
import { ANY_ZONE_DAY } from '../../src/lib/compute-api/constants';
import { moonPhase, positions } from '@zodiacs/engine';
import { bodyLongitude, longitudeSpeed } from '@zodiacs/engine/internal';
import { checkSkyFact } from '../../src/mcp/sky-tools';

const DIR = new URL('../../public/developers/sky-benchmark/v0/', import.meta.url);
const read = (name: string) => JSON.parse(readFileSync(new URL(name, DIR), 'utf8'));
const items = read('items.json');
const key = read('key.json');
const tool = read('tool-answers.json');

type Request = Record<string, unknown>;
async function reply(request: Request): Promise<any> {
  const outcome = await checkSkyFact(request as any);
  if (!outcome.ok) throw new Error(`refused ${JSON.stringify(request)}: ${outcome.refusal}`);
  return (outcome.value as any).result;
}

const MINUTE = 60_000;
const HOUR = 3_600_000;
const DAY = 86_400_000;
const shift = (date: string, days: number) => new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY).toISOString().slice(0, 10);
const signName = (slug: string) => slug[0].toUpperCase() + slug.slice(1);
const signIndex = (lon: number) => Math.floor((((lon % 360) + 360) % 360) / 30);
const wrap180 = (angle: number) => ((((angle + 180) % 360) + 360) % 360) - 180;
const near = (a: string | number, b: string | number, ms = 2000) => Math.abs((typeof a === 'string' ? Date.parse(a) : a) - (typeof b === 'string' ? Date.parse(b) : b)) <= ms;
const iso = (ms: number) => new Date(ms).toISOString();

/** The installed engine's longitudes and speeds, scanned here by steps of the test's own, not the generator's. */
const lon = (body: string, ms: number) => bodyLongitude(body as any, new Date(ms));
const speed = (body: string, ms: number) => longitudeSpeed(body as any, new Date(ms));
const narrow = (lo: number, hi: number, holds: (t: number) => boolean) => {
  while (hi - lo > 500) {
    const mid = Math.floor((lo + hi) / 2);
    if (holds(mid)) lo = mid;
    else hi = mid;
  }
  return hi;
};
/** Every sign change in [from, to), each narrowed to half a second, and whether the body was moving backward. */
const changes = (body: string, from: number, to: number, step: number) => {
  const found: Array<{ at: number; into: string; retrograde: boolean }> = [];
  for (let t = from; t < to; t += step) {
    const end = Math.min(t + step, to);
    const before = signIndex(lon(body, t));
    const after = signIndex(lon(body, end));
    if (before === after) continue;
    const at = narrow(t, end, (u) => signIndex(lon(body, u)) === before);
    if (at < to) found.push({ at, into: SIGNS[after], retrograde: wrap180(lon(body, end) - lon(body, t)) < 0 });
  }
  return found;
};
/** Every station in [from, to), each narrowed to half a second. */
const turns = (body: string, from: number, to: number, step: number) => {
  const found: Array<{ at: number; type: string }> = [];
  for (let t = from; t < to; t += step) {
    const end = Math.min(t + step, to);
    const before = speed(body, t) < 0;
    if (before === (speed(body, end) < 0)) continue;
    found.push({ at: narrow(t, end, (u) => (speed(body, u) < 0) === before), type: before ? 'direct' : 'retrograde' });
  }
  return found;
};

/** The bytes v0 was published with. A change to the generator or the engine that moves them is a new version, not a new v0. */
const V0_SHA256: Record<string, string> = {
  'items.json': '8521a288178929e18f9598bda34d7c70f975e9b168a4b7107920ee657f6fe532',
  'key.json': '4d1ec5f76cce20830962d9bb0c876ad03fc85a9ace8a24a78f28ff4bd36abcb2',
  'tool-answers.json': '7477701a8aeb90b23fe5102b66696017f02a47c1a7f131a91937c536f8ac092c',
  'scorer.mjs': '728355f27bccf8713b09125f08044895c85e66b54edc77c7eea4e39c0df28217',
};

/** The engine and ΔT tables v0 was drawn with, and whether the installed engine is the same. */
const drawn = drawnWith(key, tool);
const sameEngine = redrawRefusal(drawn, await installedEngine()) === null;

describe('the sky-fact benchmark, v0', () => {
  it("is what the generator draws, the questions and key byte for byte and check_sky_fact's answers and facts, and with another engine the generator refuses to draw it again", async () => {
    // Once the generator draws a later version, v0 is held by its pinned bytes alone.
    if (sameEngine && VERSION === 'v0') expect(await writeOrCheck('v0', { check: true })).toEqual([]);
    else await expect(writeOrCheck('v0', { check: true })).rejects.toThrow(/v0 is frozen/u);
  }, 300_000);

  it('names the engine and the ΔT tables it was drawn with, and the generator draws it only with those', () => {
    expect(drawn.engine).toBe('0.1.1-rc.16');
    expect(drawn.deltaT.map(({ model, table, tableDigest }: any) => `${model} ${table} ${tableDigest}`))
      .toEqual(['iers-utc/1 2026-09-24 064d98b4a531053a', 'zodiacs-deltat/1 2026-09-24 6371988c510a1c6c']);
    for (const { id, reply: published } of tool.answers) {
      expect([published.receipt.engine.version, published.receipt.deltaT], id).toEqual([drawn.engine, drawn.deltaT]);
    }
    expect(redrawRefusal(drawn, structuredClone(drawn))).toBeNull();
    expect(redrawRefusal(drawn, { ...drawn, engine: '0.1.1-rc.17' }))
      .toMatch(/drawn with @zodiacs\/engine 0\.1\.1-rc\.16 .*installed engine is 0\.1\.1-rc\.17 .*v0 is frozen: raise VERSION/su);
    const refreshed = drawn.deltaT.map((table: any) => ({ ...table, table: '2026-12-31', tableDigest: '0123456789abcdef' }));
    expect(redrawRefusal(drawn, { ...drawn, deltaT: refreshed })).toMatch(/2026-12-31 0123456789abcdef.*v0 is frozen/su);
    // The same engine and tables, written in another order or with more beside them, are not another engine.
    const reordered = drawn.deltaT.map((table: any) => Object.fromEntries(Object.entries(table).reverse()));
    expect(redrawRefusal(drawn, { ...drawn, deltaT: reordered })).toBeNull();
    expect(redrawRefusal(drawn, { ...drawn, deltaT: drawn.deltaT.map((table: any) => ({ ...table, note: 'added' })) })).toBeNull();
    expect(redrawRefusal(drawn, { ...drawn, deltaT: [...drawn.deltaT].reverse() })).toBeNull();
    // Files that do not say which engine and tables drew them are refused, not read as another engine and not thrown on.
    const unsaid = [
      drawnWith(key, null), drawnWith(key, { answers: null }), drawnWith(key, { answers: [null] }),
      drawnWith(key, { answers: [{ reply: {} }] }), drawnWith({}, tool), drawnWith(null, tool),
      { ...drawn, deltaT: [] }, { ...drawn, deltaT: [null] }, { ...drawn, deltaT: drawn.deltaT.map(({ tableDigest, ...table }: any) => table) },
      { ...drawn, engine: '' }, { ...drawn, deltaT: drawn.deltaT.map((table: any) => ({ ...table, model: '' })) },
    ];
    for (const files of unsaid) {
      expect(redrawRefusal(files, drawn), JSON.stringify(files)).toMatch(/v0's files do not say which engine and ΔT tables drew it: .*v0 is frozen: restore its files/su);
    }
  });

  it('is never drawn again: not with a file missing, not over the published files, and not once the generator draws another version', async () => {
    // Every refusal comes before any drawing. The time allowed is for a generator that draws anyway, so that it fails on the assertion.
    const root = mkdtempSync(join(tmpdir(), 'zodiacs-sky-benchmark-frozen-'));
    try {
      const dir = join(root, folderOf('v0'));
      mkdirSync(dir, { recursive: true });
      for (const name of DRAWN_FILES) copyFileSync(fileURLToPath(new URL(name, DIR)), join(dir, name));
      // Over the published files, with or without the engine they name.
      await expect(writeOrCheck('v0', { root })).rejects.toThrow(sameEngine ? /v0 is published\. v0 is frozen: check it with --check/u : /v0 is frozen: raise VERSION/u);
      for (const name of DRAWN_FILES) {
        rmSync(join(dir, name));
        await expect(writeOrCheck('v0', { root }), name).rejects.toThrow(new RegExp(`${name.replace('.', '\\.')} is missing\\. v0 is frozen: restore it`, 'u'));
        await expect(writeOrCheck('v0', { check: true, root }), name).rejects.toThrow(/is missing\. v0 is frozen/u);
        copyFileSync(fileURLToPath(new URL(name, DIR)), join(dir, name));
      }
      // A drawn file that is a link to a file that is not there is missing too, and the refusal says so.
      // A drawn file that does not read as JSON, or files that do not say which engine drew them, are refused rather than thrown on.
      writeFileSync(join(dir, 'key.json'), '{"engine":');
      await expect(writeOrCheck('v0', { check: true, root })).rejects.toThrow(/v0's key\.json does not read as JSON \(.+\)\. v0 is frozen: restore it/u);
      copyFileSync(fileURLToPath(new URL('key.json', DIR)), join(dir, 'key.json'));
      for (const text of ['', 'null', '{"answers":[null]}']) {
        writeFileSync(join(dir, 'tool-answers.json'), text);
        await expect(writeOrCheck('v0', { check: true, root }), text).rejects.toThrow(text === '' ? /tool-answers\.json does not read as JSON/u : /v0's files do not say which engine and ΔT tables drew it/u);
      }
      copyFileSync(fileURLToPath(new URL('tool-answers.json', DIR)), join(dir, 'tool-answers.json'));
      // A drawn file that cannot be read stops the generator, which names it.
      rmSync(join(dir, 'items.json'));
      mkdirSync(join(dir, 'items.json'));
      await expect(writeOrCheck('v0', { check: true, root })).rejects.toThrow(/v0's items\.json cannot be read: EISDIR/u);
      rmSync(join(dir, 'items.json'), { recursive: true });
      symlinkSync(join(root, 'nowhere.json'), join(dir, 'items.json'));
      await expect(writeOrCheck('v0', { check: true, root })).rejects.toThrow(/v0 is published, but items\.json is missing\. items\.json is a link to a file that is not there\. v0 is frozen: restore it/u);
      for (const name of DRAWN_FILES.slice(1)) {
        rmSync(join(dir, name));
        symlinkSync(join(root, 'nowhere.json'), join(dir, name));
      }
      await expect(writeOrCheck('v0', { check: true, root })).rejects.toThrow(/v0 is published, but items\.json, key\.json and tool-answers\.json are missing\. items\.json, key\.json and tool-answers\.json are links to files that are not there\. v0 is frozen: restore them/u);
      for (const name of DRAWN_FILES) {
        rmSync(join(dir, name));
        copyFileSync(fileURLToPath(new URL(name, DIR)), join(dir, name));
      }
      // A folder holding any file is published: with only the scorer left, the three drawn files are missing, not to be drawn again.
      for (const name of DRAWN_FILES) rmSync(join(dir, name));
      copyFileSync(fileURLToPath(new URL('scorer.mjs', DIR)), join(dir, 'scorer.mjs'));
      for (const check of [false, true]) {
        await expect(writeOrCheck('v0', { check, root }), `check ${check}`).rejects.toThrow(/items\.json, key\.json and tool-answers\.json are missing\. v0 is frozen: restore them/u);
      }
      // There is nothing to check in a version not yet published.
      rmSync(dir, { recursive: true });
      await expect(writeOrCheck('v0', { check: true, root })).rejects.toThrow(/v0 is not published, so there is nothing to check/u);
      mkdirSync(dir, { recursive: true });
      await expect(writeOrCheck('v0', { check: true, root })).rejects.toThrow(/v0 is not published, so there is nothing to check/u);
      // A folder holding only a placeholder is published, and the refusal says what it holds.
      writeFileSync(join(dir, '.gitkeep'), '');
      await expect(writeOrCheck('v0', { check: true, root })).rejects.toThrow(/v0 is published \(its folder holds \.gitkeep\), but items\.json, key\.json and tool-answers\.json are missing/u);
      rmSync(dir, { recursive: true });
      // A folder that cannot be read is neither published nor unpublished: the generator stops.
      writeFileSync(dir, '');
      for (const check of [true, false]) await expect(writeOrCheck('v0', { check, root }), `check ${check}`).rejects.toThrow(/v0's folder cannot be read: ENOTDIR/u);
      rmSync(dir);
      // A version the generator does not draw: a later one is drawn by raising VERSION, and an earlier one is held by its pins.
      await expect(writeOrCheck('v1', { check: true, root })).rejects.toThrow(/this generator draws v0, not v1\. Raise VERSION to draw v1\./u);
      const earlier = join(root, folderOf('v9'));
      mkdirSync(earlier, { recursive: true });
      copyFileSync(fileURLToPath(new URL('items.json', DIR)), join(earlier, 'items.json'));
      await expect(writeOrCheck('v9', { check: true, root })).rejects.toThrow(/this generator draws v0, not v9\. v9 is frozen: its pinned bytes hold it\./u);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  }, 300_000);

  it("holds check_sky_fact's replies to what decides them, and not to the receipts beside them", () => {
    const copy = () => structuredClone(tool);
    expect(replyDifferences(tool, copy())).toEqual([]);
    // Receipts and anything else a reply reports may change.
    const receipts = copy();
    for (const entry of receipts.answers) {
      entry.reply.receipt = { added: true, ...entry.reply.receipt, deltaT: [...entry.reply.receipt.deltaT].reverse() };
      entry.reply.result.facts.flags = ['added'];
      entry.reply.cite.url = 'https://zodiacs.org/elsewhere/';
    }
    expect(replyDifferences(tool, receipts)).toEqual([]);
    // An answer, a sign, a station's type, an event lost or found, or an event more than 2 seconds away may not.
    const changed = (index: number, change: (result: any) => void) => {
      const next = copy();
      change(next.answers[index].reply.result);
      return replyDifferences(tool, next);
    };
    const first = (family: string, holds: (result: any) => boolean = () => true) =>
      tool.answers.findIndex((entry: any, index: number) => items.items[index].family === family && holds(entry.reply.result));
    const instant = first('sign-at-instant');
    const changes_ = first('sign-on-date', (result) => result.facts.changes.length > 0);
    const station = first('retrograde-on-date', (result) => result.facts.stations.length > 0);
    const ingress = first('ingress-date');
    const lunation = first('lunation-date');
    const id = (index: number) => tool.answers[index].id;
    expect(changed(instant, (result) => { result.answer = 'false'; })).toEqual([`${id(instant)}: the answer or the facts behind it`]);
    expect(changed(instant, (result) => { result.facts.sign = 'leo'; })).toEqual([`${id(instant)}: the answer or the facts behind it`]);
    expect(changed(changes_, (result) => { result.facts.changes[0].into = 'leo'; })).toEqual([`${id(changes_)}: the answer or the facts behind it`]);
    expect(changed(station, (result) => { result.facts.stations[0].type = result.facts.stations[0].type === 'direct' ? 'retrograde' : 'direct'; })).toEqual([`${id(station)}: the answer or the facts behind it`]);
    expect(changed(ingress, (result) => { result.facts.ingresses = []; })).toEqual([`${id(ingress)}: the answer or the facts behind it`]);
    expect(changed(lunation, (result) => { result.facts.lunations.push({ ...result.facts.lunations[0] }); })).toEqual([`${id(lunation)}: the answer or the facts behind it`]);
    const moved = (ms: number) => changed(ingress, (result) => { result.facts.ingresses[0].at = iso(Date.parse(result.facts.ingresses[0].at) + ms); });
    expect(moved(1_999)).toEqual([]);
    expect(moved(-1_999)).toEqual([]);
    expect(moved(2_001)).toEqual([expect.stringMatching(new RegExp(`^${id(ingress)}: ingresses `, 'u'))]);
    // An event that lost its time, or whose time does not read as one, is a difference too.
    for (const [index, list] of [[changes_, 'changes'], [station, 'stations'], [ingress, 'ingresses'], [lunation, 'lunations']] as const) {
      const lost: Array<(event: any) => void> = [
        (event) => { event.at = null; },
        (event) => { event.at = 'soon'; },
        (event) => { delete event.at; },
        (event) => { event.time = event.at; delete event.at; },
      ];
      for (const lose of lost) {
        expect(changed(index, (result) => lose(result.facts[list][0])), `${id(index)} ${list}`)
          .toEqual([expect.stringMatching(new RegExp(`^${id(index)}: ${list} \\S+ is now (?:missing|soon)$`, 'u'))]);
      }
      // So is a time lost from the published reply, and an event lost from both.
      const published = copy();
      published.answers[index].reply.result.facts[list][0].at = null;
      expect(replyDifferences(published, tool), `${id(index)} ${list} published`)
        .toEqual([expect.stringMatching(new RegExp(`^${id(index)}: ${list} missing is now \\S+$`, 'u'))]);
      const nulled = copy();
      nulled.answers[index].reply.result.facts[list][0] = null;
      expect(replyDifferences(nulled, structuredClone(nulled)), `${id(index)} ${list} null`).toEqual([`${id(index)}: ${list} missing is now missing`]);
    }
    const asked = copy();
    asked.answers[0].request = { ...asked.answers[0].request, body: 'Moon' };
    expect(replyDifferences(tool, asked)).toEqual([`${id(0)}: the request`]);
    const counted = copy();
    counted.checks.facts += 1;
    expect(replyDifferences(tool, counted)).toEqual(['the header or the counts of facts']);
    const fewer = copy();
    fewer.answers.pop();
    expect(replyDifferences(tool, fewer)).toEqual(['300 replies published, 299 now']);
    // A reply of the wrong shape, on either side, differs rather than throws.
    const malformed: Array<[string, (next: any) => void, string]> = [
      ['no result', (next) => { delete next.answers[instant].reply.result; }, `${id(instant)}: the answer or the facts behind it`],
      ['no reply', (next) => { delete next.answers[instant].reply; }, `${id(instant)}: the answer or the facts behind it`],
      ['null facts', (next) => { next.answers[instant].reply.result.facts = null; }, `${id(instant)}: the answer or the facts behind it`],
      ['facts not an object', (next) => { next.answers[instant].reply.result.facts = 'none'; }, `${id(instant)}: the answer or the facts behind it`],
      ['events not a list', (next) => { next.answers[ingress].reply.result.facts.ingresses = { at: next.answers[ingress].reply.result.facts.ingresses[0].at }; }, `${id(ingress)}: the answer or the facts behind it`],
      ['a null reply', (next) => { next.answers[instant] = null; }, `${id(instant)}: the request`],
    ];
    for (const [label, change, difference] of malformed) {
      const next = copy();
      change(next);
      expect(replyDifferences(tool, next), `${label} now`).toEqual([difference]);
      expect(replyDifferences(next, tool), `${label} published`).toEqual([difference]);
    }
    const unlisted = copy();
    unlisted.answers = null;
    expect(replyDifferences(tool, unlisted)).toEqual(['the replies are not a list']);
    // A file, a reply or a part of one in another form is compared as it is: unlike values differ, and like ones do not.
    const both = (change: (next: any) => void, other: (next: any) => void = change) => {
      const published = copy();
      const next = copy();
      change(published);
      other(next);
      return replyDifferences(published, next);
    };
    expect(replyDifferences(null, tool)).toEqual(['the header or the counts of facts', 'the replies are not a list']);
    expect(replyDifferences(tool, null)).toEqual(['the header or the counts of facts', 'the replies are not a list']);
    expect(replyDifferences(null, null)).toEqual([]);
    for (const [published, current] of [[{ file: 5 }, 5], [[], { file: [] }], [{ file: null }, null]]) {
      expect(replyDifferences(published, current), JSON.stringify([published, current])).toEqual(['the header or the counts of facts', 'the replies are not a list']);
    }
    expect(both((next) => { next.answers[instant] = 5; }, (next) => { next.answers[instant] = 'x'; })).toEqual([`reply ${instant + 1}: the request`]);
    expect(both((next) => { next.answers[instant] = null; })).toEqual([]);
    expect(both((next) => { next.answers[instant].reply = 'x'; }, (next) => { next.answers[instant].reply = 7; })).toEqual([`${id(instant)}: the answer or the facts behind it`]);
    expect(both((next) => { next.answers[instant].reply = { error: 'a' }; }, (next) => { next.answers[instant].reply = { error: 'b' }; })).toEqual([`${id(instant)}: the answer or the facts behind it`]);
    expect(both((next) => { next.answers[instant].reply = { error: 'a' }; })).toEqual([]);
    expect(both((next) => { delete next.answers[instant].reply; }, (next) => { next.answers[instant].reply = { result: {} }; })).toEqual([`${id(instant)}: the answer or the facts behind it`]);
    const at = (next: any) => next.answers[ingress].reply.result.facts.ingresses[0].at;
    expect(both((next) => { next.answers[ingress].reply.result.facts.ingresses = { at: at(next) }; }, (next) => { next.answers[ingress].reply.result.facts.ingresses = { at: 'soon' }; }))
      .toEqual([`${id(ingress)}: the answer or the facts behind it`]);
    // A time that is not a string does not read as one, so it differs even from itself.
    expect(both((next) => { next.answers[ingress].reply.result.facts.ingresses[0].at = 2041; })).toEqual([`${id(ingress)}: ingresses 2041 is now 2041`]);
    // An event that is not an object has no time to read, so it differs even from itself.
    for (const event of ['x', [1, 2], 7]) {
      expect(both((next) => { next.answers[ingress].reply.result.facts.ingresses[0] = event; }), JSON.stringify(event)).toEqual([`${id(ingress)}: ingresses missing is now missing`]);
    }
    // A time that is not a string is shown as JSON.
    expect(changed(ingress, (result) => { result.facts.ingresses[0].at = { when: 'soon' }; }))
      .toEqual([expect.stringMatching(new RegExp(`^${id(ingress)}: ingresses \\S+ is now \\{"when":"soon"\\}$`, 'u'))]);
  });

  it('keeps the bytes it was published with', () => {
    for (const [name, digest] of Object.entries(V0_SHA256)) {
      const actual = createHash('sha256').update(readFileSync(new URL(name, DIR))).digest('hex');
      expect(actual, `${name} changed: v0 is frozen, so publish the change as a new version`).toBe(digest);
    }
  });

  it('asks 300 distinct questions, 60 of each family, each with a key and a published reply', () => {
    expect(items.count).toBe(300);
    expect(new Set(items.items.map((item: any) => item.id)).size).toBe(300);
    expect(new Set(items.items.map((item: any) => item.prompt)).size).toBe(300);
    for (const family of items.families) {
      expect(items.items.filter((item: any) => item.family === family.id)).toHaveLength(60);
    }
    expect(key.items.map((entry: any) => entry.id)).toEqual(items.items.map((item: any) => item.id));
    expect(tool.answers.map((entry: any) => entry.id)).toEqual(items.items.map((item: any) => item.id));
    for (const [index, item] of items.items.entries()) {
      expect(item.prompt.endsWith(items.instructions[item.answer]), item.id).toBe(true);
      expect(key.items[index].accepted, item.id).toContain(key.items[index].answer);
    }
  });

  it("publishes check_sky_fact's own reply to each question, which gives the key's answer and the key's events within 2 seconds", () => {
    for (const [index, item] of items.items.entries()) {
      const entry = key.items[index];
      const { request, answer: expected } = factFor(item, entry);
      const published = tool.answers[index];
      expect(published.request, item.id).toEqual(request);
      expect(published.reply.result.answer, item.id).toBe(expected);
      expect(published.reply.cite.url, item.id).toBe('https://zodiacs.org/developers/mcp/#check_sky_fact');
      const facts = published.reply.result.facts;
      switch (item.family) {
        case 'sign-at-instant':
          expect(facts.lon, item.id).toBe(entry.facts.lon);
          break;
        case 'sign-on-date':
          expect(facts.atStart.sign, item.id).toBe(entry.facts.atStart);
          expect(facts.changes.map((change: any) => [change.into, change.retrograde]), item.id)
            .toEqual(entry.facts.changes.map((change: any) => [change.into, change.retrograde]));
          facts.changes.forEach((change: any, n: number) => expect(near(change.at, entry.facts.changes[n].at), item.id).toBe(true));
          break;
        case 'retrograde-on-date':
          expect(facts.atStart.retrograde, item.id).toBe(entry.facts.retrogradeAtStart);
          expect(facts.stations.map((station: any) => station.type), item.id).toEqual(entry.facts.stations.map((station: any) => station.type));
          facts.stations.forEach((station: any, n: number) => expect(near(station.at, entry.facts.stations[n].at), item.id).toBe(true));
          break;
        case 'ingress-date':
          expect(facts.ingresses, item.id).toHaveLength(1);
          expect(facts.ingresses[0].retrograde, item.id).toBe(false);
          expect(near(facts.ingresses[0].at, entry.facts.at), item.id).toBe(true);
          break;
        case 'lunation-date':
          expect(facts.lunations, item.id).toHaveLength(1);
          expect(near(facts.lunations[0].at, entry.facts.at), item.id).toBe(true);
          break;
        default:
          throw new Error(`unknown family ${item.family}`);
      }
    }
  });

  it("check_sky_fact gives the key's answer to every question, for every sign, and on the dates around each date answer", async () => {
    // v0's margins keep each of these from turning on the engine's error, so they hold with any engine within it.
    let claims = 0;
    for (const [index, item] of items.items.entries()) {
      const { facts, answer: keyed, accepted } = key.items[index];
      const expect_ = (request: Request, expected: string) =>
        reply(request).then((result) => {
          claims += 1;
          expect(result.answer, `${item.id} ${JSON.stringify(request)}`).toBe(expected);
        });
      switch (item.family) {
        case 'sign-at-instant':
          for (const sign of SIGNS) await expect_({ kind: 'sign', body: facts.body, sign, instant: facts.instant }, sign === facts.sign ? 'true' : 'false');
          break;
        case 'sign-on-date': {
          const involved = new Set(facts.changes.flatMap((change: any) => [change.from, change.into]));
          for (const sign of SIGNS) {
            const expected = keyed === 'DEPENDS' ? (involved.has(sign) ? 'depends' : 'false') : sign === facts.atStart ? 'true' : 'false';
            await expect_({ kind: 'sign', body: facts.body, sign, date: facts.date }, expected);
          }
          break;
        }
        case 'retrograde-on-date':
          await expect_({ kind: 'retrograde', body: facts.body, date: facts.date }, { YES: 'true', NO: 'false', DEPENDS: 'depends' }[keyed as 'YES']!);
          break;
        case 'ingress-date':
        case 'lunation-date': {
          const base = item.family === 'ingress-date'
            ? { kind: 'ingress', body: facts.body, sign: facts.sign }
            : { kind: 'phase', phase: facts.phase };
          expect(accepted, item.id).toEqual(datesHolding(Date.parse(facts.at)));
          for (const date of accepted) await expect_({ ...base, date }, 'depends');
          await expect_({ ...base, date: shift(accepted[0], -1) }, 'false');
          await expect_({ ...base, date: shift(accepted[accepted.length - 1], 1) }, 'false');
          break;
        }
        default:
          throw new Error(`unknown family ${item.family}`);
      }
    }
    // The facts the published replies count, less the dates of the entries while retrograde in the next test.
    expect(claims).toBe(tool.checks.facts - tool.checks.retrogradeEntryDates);
    expect(claims).toBe(1986);
  }, 300_000);

  it("check_sky_fact finds every entry into a sign while retrograde in the ingress questions' periods, on every date that holds it", async () => {
    // The entries are found again here, in the installed engine, so this runs with any engine; with v0's own they are the key's.
    let entries = 0;
    let dates = 0;
    for (const [index, item] of items.items.entries()) {
      if (item.family !== 'ingress-date') continue;
      const { facts } = key.items[index];
      const reach = periodReach(Date.parse(`${facts.period.from}T00:00:00Z`), Date.parse(`${facts.period.to}T00:00:00Z`));
      const found = changes(facts.body, reach.from, reach.to, facts.body === 'Moon' ? 20 * MINUTE : 4 * HOUR).filter(({ retrograde }) => retrograde);
      if (sameEngine) {
        const keyed = facts.others.filter((other: any) => other.retrograde);
        expect(found.map(({ into }) => into), item.id).toEqual(keyed.map((other: any) => other.into));
        found.forEach(({ at }, n) => expect(near(at, keyed[n].at), item.id).toBe(true));
      }
      for (const { at, into } of found) {
        entries += 1;
        // The dates whose window holds the entry a minute either way, so this scan and the tool's search fall on the same side of every edge.
        const held = datesHolding(at - MINUTE).filter((date) => datesHolding(at + MINUTE).includes(date));
        if (sameEngine) expect(held, `${item.id} ${iso(at)}`).toEqual(datesHolding(at));
        for (const date of held) {
          const result = await reply({ kind: 'ingress', body: facts.body, sign: into, date });
          expect(result.answer, `${item.id} ${iso(at)} ${date}`).toBe('depends');
          expect(result.facts.ingresses.some((entry: any) => entry.retrograde && near(entry.at, at)), `${item.id} ${iso(at)} ${date}`).toBe(true);
          dates += 1;
        }
      }
    }
    // Every entry is at least 100 hours, and ten times the time its body takes to move 30″, from the edges of the span scanned
    // here (86 hours and nine times from the period's own), and no station in these periods comes within 133″ of a sign
    // boundary: an engine within 30″ of v0's finds the same 18 entries.
    expect(entries).toBe(18);
    // With v0's engine, the counts the published replies state, which the page quotes, with the 1,986 answers above: 2,022 facts.
    if (sameEngine) {
      expect([entries, dates]).toEqual([tool.checks.retrogradeEntries, tool.checks.retrogradeEntryDates]);
      expect([dates, tool.checks.facts]).toEqual([36, 2022]);
    }
  }, 300_000);

  it('samples the same longitudes and speeds that positions() reports', () => {
    // 1,500 instants from 1900 to 2049, each body the benchmark asks about.
    let compared = 0;
    for (let step = 0; step < 1500; step += 1) {
      const instant = new Date(Date.UTC(1900, 0, 1) + step * 36.5 * DAY + step * 3_600_007);
      for (const row of positions(instant).slice(0, 10)) {
        expect(bodyLongitude(row.body, instant), `${row.body} ${instant.toISOString()}`).toBe(row.lon);
        expect(longitudeSpeed(row.body, instant), `${row.body} ${instant.toISOString()}`).toBe(row.speed);
        compared += 1;
      }
    }
    expect(compared).toBe(15_000);
  }, 60_000);

  it('leaves the Moon at least 45 minutes from a sign boundary in the questions about an instant', () => {
    // Its fastest motion from 1900 to 2049, sampled twice a day, is under 16° a day, so 30′ takes over 45 minutes.
    let fastest = 0;
    for (let ms = Date.UTC(1900, 0, 1); ms < Date.UTC(2050, 0, 1); ms += DAY / 2) {
      fastest = Math.max(fastest, longitudeSpeed('Moon', new Date(ms)));
    }
    expect(fastest).toBeLessThan(16);
    expect((0.5 / fastest) * 24 * 60).toBeGreaterThan(45);
    for (const [index, item] of items.items.entries()) {
      const { facts } = key.items[index];
      if (item.family === 'sign-at-instant' && facts.body === 'Moon') expect(facts.boundaryMarginArcsec, item.id).toBeGreaterThanOrEqual(1800);
    }
  }, 60_000);

  it("reads a date's window with the compute API's own constants", () => {
    expect(ANY_OFFSET_DAY).toEqual({
      before: ANY_ZONE_DAY.startHoursBeforeUtcMidnight * HOUR,
      after: ANY_ZONE_DAY.endHoursAfterUtcMidnight * HOUR,
    });
    const { from, to } = windowOf('2026-10-26');
    expect(new Date(from).toISOString()).toBe('2026-10-25T10:00:00.000Z');
    expect(new Date(to).toISOString()).toBe('2026-10-27T12:00:00.000Z');
    // 2026-10-26T11:00Z is on the 25th west of −11:00 and on the 26th or 27th elsewhere.
    expect(datesHolding(Date.parse('2026-10-26T11:00:00Z'))).toEqual(['2026-10-25', '2026-10-26', '2026-10-27']);
    expect(datesHolding(Date.parse('2026-10-26T12:00:00Z'))).toEqual(['2026-10-26', '2026-10-27']);
    // November 1969 in some offset: from 10:00 UTC on 31 October to 12:00 UTC on 1 December.
    const reach = periodReach(Date.UTC(1969, 10, 1), Date.UTC(1969, 11, 1));
    expect([new Date(reach.from).toISOString(), new Date(reach.to).toISOString()]).toEqual(['1969-10-31T10:00:00.000Z', '1969-12-01T12:00:00.000Z']);
  });

  it("says in each question what its key's facts say", () => {
    const BODY = '(the Sun|the Moon|Mercury|Venus|Mars|Jupiter|Saturn|Uranus|Neptune|Pluto)';
    const MONTH = '(January|February|March|April|May|June|July|August|September|October|November|December)';
    const DATE = `(\\d{1,2}) ${MONTH} (\\d{4})`;
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const bodyOf = (text: string) => text.replace(/^the /u, '');
    const dayOf = (d: string, m: string, y: string) => new Date(Date.UTC(Number(y), months.indexOf(m), Number(d))).toISOString().slice(0, 10);
    const reference = Date.parse(`${REFERENCE_DATE}T00:00:00Z`);
    const tense = (past: boolean, ms: number, id: string) => expect(past, `${id} tense`).toBe(ms < reference);
    const PHASE = { 'new moon': 'new', 'first quarter moon': 'first-quarter', 'full moon': 'full', 'last quarter moon': 'last-quarter' } as Record<string, string>;
    for (const [index, item] of items.items.entries()) {
      const { facts } = key.items[index];
      const question = item.prompt.slice(0, item.prompt.length - items.instructions[item.answer].length).trim();
      let match: RegExpExecArray | null;
      switch (item.family) {
        case 'sign-at-instant': {
          match = new RegExp(`^In the tropical zodiac, which sign (was|will) ${BODY} (?:be )?in at (\\d{2}):(\\d{2}) UTC on ${DATE}\\?$`, 'u').exec(question);
          expect(match, item.id).not.toBeNull();
          const [, verb, body, hh, mm, d, m, y] = match!;
          expect(bodyOf(body), item.id).toBe(facts.body);
          expect(`${dayOf(d, m, y)}T${hh}:${mm}:00Z`, item.id).toBe(facts.instant);
          tense(verb === 'was', Date.parse(facts.instant), item.id);
          break;
        }
        case 'sign-on-date': {
          match = new RegExp(`^In the tropical zodiac, which sign (was|will) ${BODY} (?:be )?in on ${DATE}\\?$`, 'u').exec(question);
          expect(match, item.id).not.toBeNull();
          const [, verb, body, d, m, y] = match!;
          expect([bodyOf(body), dayOf(d, m, y)], item.id).toEqual([facts.body, facts.date]);
          tense(verb === 'was', Date.parse(`${facts.date}T00:00:00Z`), item.id);
          break;
        }
        case 'retrograde-on-date': {
          match = new RegExp(`^(Was|Will) ${BODY} (?:be )?retrograde on ${DATE}\\?$`, 'u').exec(question);
          expect(match, item.id).not.toBeNull();
          const [, verb, body, d, m, y] = match!;
          expect([bodyOf(body), dayOf(d, m, y)], item.id).toEqual([facts.body, facts.date]);
          tense(verb === 'Was', Date.parse(`${facts.date}T00:00:00Z`), item.id);
          break;
        }
        case 'ingress-date': {
          match = new RegExp(`^In the tropical zodiac, on what date in (?:${MONTH} )?(\\d{4}) (did|will) ${BODY} enter (\\w+)\\?$`, 'u').exec(question);
          expect(match, item.id).not.toBeNull();
          const [, month, year, verb, body, sign] = match!;
          expect([bodyOf(body), sign], item.id).toEqual([facts.body, signName(facts.sign)]);
          expect(month !== undefined, item.id).toBe(facts.body === 'Moon');
          const from = month ? Date.UTC(Number(year), months.indexOf(month), 1) : Date.UTC(Number(year), 0, 1);
          const to = month ? Date.UTC(Number(year), months.indexOf(month) + 1, 1) : Date.UTC(Number(year) + 1, 0, 1);
          expect(facts.period, item.id).toEqual({ from: new Date(from).toISOString().slice(0, 10), to: new Date(to).toISOString().slice(0, 10) });
          tense(verb === 'did', Date.parse(facts.at), item.id);
          break;
        }
        case 'lunation-date': {
          match = new RegExp(`^On what date (was|will) the (new moon|first quarter moon|full moon|last quarter moon) (?:be )?in ${MONTH} (\\d{4})\\?$`, 'u').exec(question);
          expect(match, item.id).not.toBeNull();
          const [, verb, words, month, year] = match!;
          expect(PHASE[words], item.id).toBe(facts.phase);
          const from = Date.UTC(Number(year), months.indexOf(month), 1);
          const to = Date.UTC(Number(year), months.indexOf(month) + 1, 1);
          expect(facts.period, item.id).toEqual({ from: new Date(from).toISOString().slice(0, 10), to: new Date(to).toISOString().slice(0, 10) });
          tense(verb === 'was', Date.parse(facts.at), item.id);
          break;
        }
        default:
          throw new Error(`unknown family ${item.family}`);
      }
    }
  });

  it.runIf(sameEngine)('keeps every rule and margin it publishes, derived again by other steps from the engine it was drawn with', () => {
    // The page and the evidence record say 30″. The generator's constant is held to that here, not read from it.
    const PUBLISHED_ERROR_ARCSEC = 30;
    expect(ENGINE_ERROR_ARCSEC).toBe(PUBLISHED_ERROR_ARCSEC);
    const margin = (body: string, at: number) => Math.max(10 * MINUTE, ((PUBLISHED_ERROR_ARCSEC / 3600) / Math.abs(speed(body, at))) * DAY);
    const planet = (body: string) => body !== 'Sun' && body !== 'Moon';
    /** Arcseconds from a longitude to the nearest of `boundaries`, or to the nearest sign boundary. */
    const fromBoundary = (l: number, boundaries?: number[]) => {
      if (boundaries) return Math.min(...boundaries.map((boundary) => Math.abs(wrap180(l - boundary)))) * 3600;
      const within = ((l % 30) + 30) % 30;
      return Math.min(within, 30 - within) * 3600;
    };
    const clearOfEdges = (at: number, ms: number) => {
      const timeOfDay = ((at % DAY) + DAY) % DAY;
      return [10 * HOUR, 12 * HOUR].every((edge) => [-DAY, 0, DAY].every((k) => Math.abs(timeOfDay - edge - k) >= ms));
    };
    for (const [index, item] of items.items.entries()) {
      const entry = key.items[index];
      const { facts } = entry;
      switch (item.family) {
        case 'sign-at-instant': {
          const l = lon(facts.body, Date.parse(facts.instant));
          const within = ((l % 30) + 30) % 30;
          expect(Math.min(within, 30 - within) * 3600, item.id).toBeGreaterThanOrEqual(facts.body === 'Moon' ? 1800 : 60);
          expect(entry.accepted, item.id).toEqual([signName(SIGNS[signIndex(l)])]);
          break;
        }
        case 'sign-on-date': {
          const { from, to } = windowOf(facts.date);
          const found = changes(facts.body, from - DAY, to + DAY, facts.body === 'Moon' ? 7 * MINUTE : 2 * HOUR);
          for (const change of found) {
            for (const edge of [from, to]) expect(Math.abs(change.at - edge), `${item.id} ${new Date(change.at).toISOString()}`).toBeGreaterThanOrEqual(margin(facts.body, change.at));
          }
          const inside = found.filter(({ at }) => at >= from && at < to);
          expect(inside.map(({ into }) => into), item.id).toEqual(facts.changes.map((change: any) => change.into));
          inside.forEach(({ at }, n) => expect(near(at, facts.changes[n].at), item.id).toBe(true));
          expect(entry.accepted, item.id).toEqual([inside.length > 0 ? 'DEPENDS' : signName(SIGNS[signIndex(lon(facts.body, from))])]);
          // On a date it stays in one sign, a planet that stations within 30″ of a boundary could cross it in the real sky.
          if (inside.length === 0 && planet(facts.body)) {
            for (const station of turns(facts.body, from - DAY, to + DAY, HOUR)) {
              expect(fromBoundary(lon(facts.body, station.at)), `${item.id} station ${iso(station.at)}`).toBeGreaterThanOrEqual(PUBLISHED_ERROR_ARCSEC);
            }
          }
          break;
        }
        case 'retrograde-on-date': {
          const { from, to } = windowOf(facts.date);
          const found = turns(facts.body, from - DAY, to + DAY, 30 * MINUTE);
          for (const station of found) {
            for (const edge of [from, to]) expect(Math.abs(station.at - edge), item.id).toBeGreaterThanOrEqual(6 * HOUR);
          }
          const inside = found.filter(({ at }) => at >= from && at < to);
          expect(inside.map(({ type }) => type), item.id).toEqual(facts.stations.map((station: any) => station.type));
          inside.forEach(({ at }, n) => expect(near(at, facts.stations[n].at), item.id).toBe(true));
          expect(entry.accepted, item.id).toEqual([inside.length > 0 ? 'DEPENDS' : speed(facts.body, from) < 0 ? 'YES' : 'NO']);
          break;
        }
        case 'ingress-date': {
          const periodFrom = Date.parse(`${facts.period.from}T00:00:00Z`);
          const periodTo = Date.parse(`${facts.period.to}T00:00:00Z`);
          const reach = periodReach(periodFrom, periodTo);
          const found = changes(facts.body, reach.from, reach.to, facts.body === 'Moon' ? 20 * MINUTE : 4 * HOUR);
          const entries = found.filter(({ into }) => into === facts.sign);
          expect(entries, `${item.id} enters ${facts.sign} once in any offset's ${facts.period.from}`).toHaveLength(1);
          const [{ at, retrograde }] = entries;
          expect(retrograde, item.id).toBe(false);
          expect(near(at, facts.at), item.id).toBe(true);
          expect(at - periodFrom >= 2 * DAY && periodTo - at >= 2 * DAY, item.id).toBe(true);
          expect(clearOfEdges(at, margin(facts.body, at)), item.id).toBe(true);
          expect(entry.accepted, item.id).toEqual(datesHolding(at));
          const others = found.filter((change) => change !== entries[0]);
          expect(others.map(({ into, retrograde: back }) => [into, back]), item.id).toEqual(facts.others.map((other: any) => [other.into, other.retrograde]));
          others.forEach((change, n) => expect(near(change.at, facts.others[n].at), item.id).toBe(true));
          // "Exactly once" may not turn on an entry into the sign just outside the span,
          // nor on a station within 30″ of either of the sign's boundaries, where the body could enter it again.
          const step = facts.body === 'Moon' ? 20 * MINUTE : 4 * HOUR;
          const outside = [...changes(facts.body, reach.from - 10 * DAY, reach.from, step), ...changes(facts.body, reach.to, reach.to + 10 * DAY, step)];
          for (const change of outside.filter(({ into }) => into === facts.sign)) {
            expect(Math.min(Math.abs(change.at - reach.from), Math.abs(change.at - reach.to)), `${item.id} enters ${facts.sign} at ${iso(change.at)}`)
              .toBeGreaterThanOrEqual(margin(facts.body, change.at));
          }
          if (planet(facts.body)) {
            const start = SIGNS.indexOf(facts.sign) * 30;
            for (const station of turns(facts.body, reach.from - DAY, reach.to + DAY, 4 * HOUR)) {
              expect(fromBoundary(lon(facts.body, station.at), [start, start + 30]), `${item.id} station ${iso(station.at)}`).toBeGreaterThanOrEqual(PUBLISHED_ERROR_ARCSEC);
            }
          }
          break;
        }
        case 'lunation-date': {
          const periodFrom = Date.parse(`${facts.period.from}T00:00:00Z`);
          const periodTo = Date.parse(`${facts.period.to}T00:00:00Z`);
          const reach = periodReach(periodFrom, periodTo);
          const target = { new: 0, 'first-quarter': 90, full: 180, 'last-quarter': 270 }[facts.phase as 'new']!;
          const offset = (t: number) => wrap180(moonPhase(new Date(t)).angle - target);
          const found: number[] = [];
          for (let t = reach.from - DAY; t < reach.to + DAY; t += 20 * MINUTE) {
            if (offset(t) < 0 && offset(t + 20 * MINUTE) >= 0) found.push(narrow(t, t + 20 * MINUTE, (u) => offset(u) < 0));
          }
          const inReach = found.filter((at) => at >= reach.from && at < reach.to);
          expect(inReach, `${item.id} one ${facts.phase} in any offset's month`).toHaveLength(1);
          const [at] = inReach;
          expect(near(at, facts.at), item.id).toBe(true);
          expect(at - periodFrom >= 2 * DAY && periodTo - at >= 2 * DAY, item.id).toBe(true);
          expect(clearOfEdges(at, 10 * MINUTE), item.id).toBe(true);
          expect(entry.accepted, item.id).toEqual(datesHolding(at));
          // Nor another of the same phase within 10 minutes outside the span.
          for (const other of found.filter((t) => t < reach.from || t >= reach.to)) {
            expect(Math.min(Math.abs(other - reach.from), Math.abs(other - reach.to)), `${item.id} ${iso(other)}`).toBeGreaterThanOrEqual(10 * MINUTE);
          }
          break;
        }
        default:
          throw new Error(`unknown family ${item.family}`);
      }
    }
  }, 300_000);

  it('lets knowing the body asked about beat one answer for every question by no more than a tenth of a family', () => {
    for (const family of ['sign-on-date', 'retrograde-on-date']) {
      const rows = items.items.map((item: any, index: number) => ({ item, entry: key.items[index] })).filter(({ item }: any) => item.family === family);
      const count = (list: string[]) => Math.max(...Object.values(list.reduce((tally: Record<string, number>, answer) => ({ ...tally, [answer]: (tally[answer] ?? 0) + 1 }), {})));
      const constant = count(rows.map(({ entry }: any) => entry.answer));
      const bodies = [...new Set(rows.map(({ entry }: any) => entry.facts.body))] as string[];
      const byBody = bodies.reduce((sum, body) => sum + count(rows.filter(({ entry }: any) => entry.facts.body === body).map(({ entry }: any) => entry.answer)), 0);
      // Knowing the body may help a little, as it does in the sky; never by more than a tenth of the family.
      expect(byBody - constant, family).toBeLessThanOrEqual(6);
    }
  });

  it('was checked against NASA JPL Horizons on every answer, and the check is of the key published here', () => {
    const horizons = JSON.parse(readFileSync(new URL('../../docs/platform/evidence/sky-benchmark-v0/horizons-check.json', import.meta.url), 'utf8'));
    expect([horizons.questions, horizons.agree, horizons.differ]).toEqual([300, 300, []]);
    expect(horizons.benchmark).toEqual({ name: key.name, version: key.version, engine: key.engine });
    horizons.results.forEach((result: any, index: number) => {
      const entry = key.items[index];
      expect([result.id, result.key], result.id).toEqual([entry.id, entry.accepted]);
      // Horizons' own answer, not only the flag the check wrote beside it.
      expect(entry.accepted, result.id).toContain(result.horizons.answer);
      if (result.family === 'ingress-date' || result.family === 'lunation-date') expect(result.horizons.accepted, result.id).toEqual(entry.accepted);
      expect(result.agree, result.id).toBe(true);
    });
  });
});

describe("the benchmark's scorer", () => {
  const promptOf = (family: string) => items.items.find((item: any) => item.family === family).prompt;

  it('reads the last line strictly, and otherwise the one answer the reply names', () => {
    expect(readReply('sign', 'Taurus')).toEqual({ value: 'Taurus', reading: 'strict' });
    expect(readReply('sign', 'The Moon was there.\n\n**taurus**.')).toEqual({ value: 'Taurus', reading: 'strict' });
    expect(readReply('sign', '♉️')).toEqual({ value: 'Taurus', reading: 'strict' });
    expect(readReply('sign', 'It was in Taurus that evening.')).toEqual({ value: 'Taurus', reading: 'lenient' });
    expect(readReply('sign', 'Taurus, moving into Gemini later.')).toEqual({ value: null, reading: 'unparsed' });
    expect(readReply('sign', 'DEPENDS')).toEqual({ value: null, reading: 'unparsed' });
    expect(readReply('sign-or-depends', 'depends')).toEqual({ value: 'DEPENDS', reading: 'strict' });
    expect(readReply('yes-no-depends', 'No.')).toEqual({ value: 'NO', reading: 'strict' });
    expect(readReply('yes-no-depends', 'Yes, it was retrograde then.')).toEqual({ value: 'YES', reading: 'lenient' });
    expect(readReply('yes-no-depends', 'Yes and no.')).toEqual({ value: null, reading: 'unparsed' });
    expect(readReply('date', '2023-03-07')).toEqual({ value: '2023-03-07', reading: 'strict' });
    expect(readReply('date', '`2023-02-30`')).toEqual({ value: null, reading: 'unparsed' });
    expect(readReply('date', 'Saturn entered Pisces on 7 March 2023.')).toEqual({ value: '2023-03-07', reading: 'lenient' });
    expect(readReply('date', 'On March 7th, 2023 (2023-03-07).')).toEqual({ value: '2023-03-07', reading: 'lenient' });
    expect(readReply('date', 'Either 2023-03-07 or 2023-03-08.')).toEqual({ value: null, reading: 'unparsed' });
    expect(readReply('date', '')).toEqual({ value: null, reading: 'unparsed' });
  });

  it('gives no credit for the question repeated, a stray no, or an assistant called Gemini, and reads dates written out', () => {
    const sd = promptOf('sign-on-date');
    const rd = promptOf('retrograde-on-date');
    expect(readReply('sign-or-depends', sd, [sd])).toEqual({ value: null, reading: 'unparsed' });
    expect(readReply('yes-no-depends', rd, [rd])).toEqual({ value: null, reading: 'unparsed' });
    expect(readReply('sign-or-depends', `Taurus\n\n${sd.slice(0, 60)}\n${sd.slice(60)}`, [sd])).toEqual({ value: 'Taurus', reading: 'lenient' });
    expect(readReply('yes-no-depends', `NO\n${rd}`, [rd])).toEqual({ value: 'NO', reading: 'lenient' });
    for (const stray of ['No idea.', 'I have no way of knowing.', 'There is no station that day; it was retrograde all day long.', 'No matter the zone, it was direct.']) {
      expect(readReply('yes-no-depends', stray, [rd]), stray).toEqual({ value: null, reading: 'unparsed' });
    }
    expect(readReply('yes-no-depends', 'The answer is no.', [rd])).toEqual({ value: 'NO', reading: 'lenient' });
    // A word joined to the next by a hyphen is not on its own; a dash between words leaves it so.
    for (const joined of ['No-one can know that without an ephemeris.', "It's a no-brainer: Mercury was retrograde that week."]) {
      expect(readReply('yes-no-depends', joined, [rd]), joined).toEqual({ value: null, reading: 'unparsed' });
    }
    expect(readReply('yes-no-depends', 'No - it was direct all day.', [rd])).toEqual({ value: 'NO', reading: 'lenient' });
    expect(readReply('yes-no-depends', 'No—it was direct.', [rd])).toEqual({ value: 'NO', reading: 'lenient' });
    expect(readReply('sign', 'I am Gemini, a model made by Google, and cannot compute ephemerides.')).toEqual({ value: null, reading: 'unparsed' });
    expect(readReply('sign', 'As Gemini 2.5, I think the Moon was in Taurus.')).toEqual({ value: 'Taurus', reading: 'lenient' });
    expect(readReply('sign', 'As Gemini, I cannot see the sky, but the Moon was in Leo.')).toEqual({ value: 'Leo', reading: 'lenient' });
    expect(readReply('sign', 'Gemini 1.5 Pro thinks the Sun was in Virgo.')).toEqual({ value: 'Virgo', reading: 'lenient' });
    expect(readReply('sign', 'The Sun was in Gemini, a mutable air sign.')).toEqual({ value: 'Gemini', reading: 'lenient' });
    // The sign with a degree after it is the sign, as Taurus 12° is Taurus.
    for (const sign of ['Mars was at Gemini 12° that morning.', 'The Sun was in Gemini, 15° to be exact.', 'Mars was at Gemini 12 degrees.', 'It was in the sign known as Gemini.', 'The Sun would be read as Gemini, I think, at that hour.', 'Mercury in Gemini advanced to 28° that day.']) {
      expect(readReply('sign', sign), sign).toEqual({ value: 'Gemini', reading: 'lenient' });
    }
    // "As Gemini, I" is the assistant where it starts a line or a sentence.
    expect(readReply('sign', 'Note:\nAs Gemini, I cannot see the sky. The Moon was in Leo.')).toEqual({ value: 'Leo', reading: 'lenient' });
    expect(readReply('sign', 'Mars was at Taurus 12° that morning.')).toEqual({ value: 'Taurus', reading: 'lenient' });
    // A number after "Gemini" makes it the assistant only as a version: one digit, perhaps a point and one or two more,
    // then a model's name or the end of a clause. Otherwise "Gemini" is the sign, and a reply naming another sign too names two.
    const geminiNumbers: Array<[string, string | null]> = [
      ['Venus moved from Taurus into Gemini 3 days later.', null],
      ['The Moon was in Gemini 2 hours before it entered Cancer.', null],
      ['Uranus was in Gemini, 1942 to 1949.', 'Gemini'],
      ['The Moon was in Gemini at 14:30 UTC, still Gemini 14:30 by the clock.', 'Gemini'],
      ['Mars was at Gemini 12th degree.', 'Gemini'],
      ['The Sun was in Gemini 5 June that year.', 'Gemini'],
      ['Mars was in Gemini 2.5 days before it stationed.', 'Gemini'],
      ['Gemini 2.5 Flash-Lite says Leo.', 'Leo'],
      ['I asked Gemini 3. It said the Moon was in Leo.', 'Leo'],
      ['(Gemini 2.0) The Moon was in Leo.', 'Leo'],
      // A list's next number, on the line below, is not a version.
      ['It is either\n1. Gemini\n2. Cancer', null],
      ['1. The Sun was at about 88°, which is Gemini\r\n2. It entered Cancer about 4 hours later.', null],
      // Nor is a model's name on the line below, after a version or not, whatever ends the line.
      ['The Sun was in Gemini\nPro tip: check an ephemeris.', 'Gemini'],
      ['The Sun was in Gemini 2\nPro tip: use a table.', 'Gemini'],
      ['The Sun was in Gemini\u2028Pro tip: check an ephemeris.', 'Gemini'],
      ['The Sun was in Gemini 2\u2029Pro tip: use a table.', 'Gemini'],
      ['Sign: Gemini\nModel answer: Leo.', null],
      // A version at the end of the reply, after any spaces, is the assistant's; the mark after one must be on its line.
      ['The Moon was in Leo, says Gemini 2  \n', 'Leo'],
      ['The Sun was in Gemini 2\n. The Moon was in Leo.', null],
      // A sentence does not start after an ellipsis, so "As Gemini, I" there is the sign.
      ['Hmm... As Gemini, I think the Moon was in Leo.', null],
    ];
    for (const [text, sign] of geminiNumbers) expect(readReply('sign', text).value, text).toBe(sign);
    // YES and NO before the marks the header lists, also after an aside in brackets on the same line, and before a bracket or
    // an ellipsis only where a line or a sentence starts, which an ellipsis does not end. The answer words joined by "or",
    // "nor", a slash or a bar with no space around it, each perhaps with an aside, only list the choices and name none of
    // them, nor does a "no" before them; a table's cells are not a list. A hedge names both YES and NO.
    const standing: Array<[string, string | null]> = [
      ['No (Mercury was direct all day).', 'NO'],
      ['Mercury was direct. No (it never stationed).', 'NO'],
      ['**Answer:** No (Mercury was direct all day).', 'NO'],
      ['- No (Mercury was direct all day)', 'NO'],
      ['There is no (direct) way to tell without your time zone.', null],
      ['No… it was direct.', 'NO'],
      ['I have no… certainty here without an ephemeris.', null],
      ['No -- it was direct', 'NO'],
      ['Yes--it was retrograde.', 'YES'],
      ['| Retrograde? | No |', 'NO'],
      ["It's not a simple yes/no.", null],
      ["I can't give a definitive yes/no answer without ephemeris data.", null],
      ['There is no simple yes/no answer: it depends on your time zone.', 'DEPENDS'],
      ['Answer (yes/no): NO', 'NO'],
      ['Yes/No: No', 'NO'],
      ['There is no/little chance it changed.', null],
      ['Is it yes or no? No.', 'NO'],
      ['You asked for YES or NO: NO', 'NO'],
      ['I will answer YES, NO or DEPENDS. NO', 'NO'],
      ['Answer (YES/NO/DEPENDS): NO', 'NO'],
      ['Either yes or no.', null],
      ['Neither yes nor no: it depends on the time zone.', 'DEPENDS'],
      ['It cannot be a simple “yes” or “no”, because it depends on the zone.', 'DEPENDS'],
      ['Yes, no matter the zone, it was retrograde.', 'YES'],
      ['No and yes, depending on the zone.', null],
      ['The answer is no (Mercury was direct).', 'NO'],
      ['So the answer is yes (it was retrograde), whatever the zone.', 'YES'],
      ['I would answer no (with low confidence)', 'NO'],
      ['I have no... certainty here without an ephemeris.', null],
      ['There is... no (simple) way to tell.', null],
      ['The answer is no...', 'NO'],
      ['No... it was direct all day.', 'NO'],
      ['There is no yes/no.', null],
      ['There is no YES, NO or DEPENDS.', null],
      ["There is no 'yes or no' — it's complicated.", null],
      ['Answer (yes|no): NO', 'NO'],
      ['| Retrograde | Station |\n| NO | NO |', 'NO'],
      // An ellipsis in mid-line is a pause, not the end of an answer, for YES as for NO.
      ['The answer is yes... I think.', null],
      ['So no... it was not retrograde.', null],
      ["It's yes... and no too.", null],
      ['no though yes... really.', null],
      // Lists of choices with an aside after each word, so the DEPENDS that follows them stands alone.
      ['It is not yes (retrograde) or no (direct): it depends.', 'DEPENDS'],
      ['It is neither yes (retrograde) nor no (direct); it depends on the zone.', 'DEPENDS'],
      ['Is it yes (retrograde), no (direct) or depends (a station)?', null],
      ['Of yes (retrograde), no (direct) or depends (a station), the answer is depends.', 'DEPENDS'],
      // A hedge names both: "yes and no", with or without a pause after "yes", and one word standing alone beside the other
      // before an ellipsis, a bracket or a word that joins it to another case, or after a contrast.
      ['The honest answer is yes... and no.', null],
      ['Maybe yes… maybe no…', null],
      ['In London, yes... in Tokyo, no.', null],
      ['In London, no... in Tokyo, yes.', null],
      ['Maybe no… maybe yes…', null],
      ['It could be yes... or it could be no, depending on the time zone.', null],
      ['I need a firm yes... or a no.', null],
      ['The answer is yes (in Tokyo) and no (in London).', null],
      ['The answer is both yes (UTC+14) and no (UTC−12).', null],
      ['The answer is yes (in Tokyo) but no (in London).', null],
      ['The answer is no (in London) but yes (in Tokyo).', null],
      ['The answer is yes (but no in Tokyo).', null],
      ['Mercury stationed that day: yes (retrograde) before 14:00 UTC and no (direct) after.', null],
      ['Yes, in Tokyo; no in London.', null],
      ['Yes before noon, no after.', null],
      ['Yes, before 14:00 UTC; no after.', null],
      ['Yes. No before 14:00 UTC, though.', null],
      ['Yes and no.', null],
      ['**Yes** and **no**', null],
      ['Short answer: yes. Long answer: yes and no really.', null],
      ['Short answer: yes. Long answer: no and yes really.', null],
      ['Yes… and no really.', null],
      ['Short answer: yes. Long answer: yes... and no really.', null],
      ['Short answer: yes. Long answer: yes (mostly) and no really.', null],
      ['Yes and no really; it depends on the zone.', null],
      ['Yes. Yes (in Tokyo) and no.', null],
      ["I can't say yes (or no) for sure.", null],
      ['I think no (it was direct), but yes is possible.', null],
      ['I think yes (it was direct), but no is possible.', null],
      ['No in London, yes in Tokyo.', null],
      ['No, not in London; yes in Tokyo.', null],
      // A "no" before a noun, with or without a pause, does not name NO beside a YES, nor a "yes" in passing YES beside a NO.
      ['Yes. There is no doubt: Mercury was retrograde all day.', 'YES'],
      ['Yes, and no station falls on that date.', 'YES'],
      ['Yes, though there is no... certainty without an ephemeris.', null],
      ['No. Mercury was direct all day, so a yes would be wrong.', 'NO'],
      ['NO — Mercury was direct. (It would be YES only if Mercury had stationed before that date.)', 'NO'],
      ['The answer is no, not yes as some tables say.', 'NO'],
      ['No. Yes-or-no questions like this are easy to check in an ephemeris.', 'NO'],
      // A line ends at a line separator or a carriage return too, and an aside in brackets does not run past one.
      ['No\u2028It was direct all day.', 'NO'],
      ['No\rIt was direct all day.', 'NO'],
      ['The answer is no (it was\rdirect).', null],
      ['The answer is no (it was\u2028direct).', null],
      ['The answer is no (it was\ndirect).', null],
      ['The answer is no (it was\u2029direct).', null],
    ];
    for (const [text, word] of standing) expect(readReply('yes-no-depends', text, [rd]).value, text).toBe(word);
    // Every word the header lists as joining a "yes" or a "no" to another case, and every contrast before one.
    const joins = ['and', 'or', 'but', 'if', 'unless', 'except', 'in', 'for', 'at', 'on', 'by', 'when', 'while', 'whereas', 'before', 'after',
      'afterwards', 'thereafter', 'until', 'from', 'since', 'once', 'during', 'outside', 'under', 'beyond', 'around', 'west', 'east',
      'elsewhere', 'otherwise', 'though', 'although', 'depending', 'maybe', 'perhaps'];
    for (const join of joins) {
      expect(readReply('yes-no-depends', `Yes, mostly. No ${join} that, though.`, [rd]).value, `no ${join}`).toBe(null);
      expect(readReply('yes-no-depends', `No, mostly. Yes ${join} that, though.`, [rd]).value, `yes ${join}`).toBe(null);
    }
    // On a question that asks for a sign, a "yes and no" names nothing, and the sign stands.
    expect(readReply('sign-or-depends', 'Yes and no: the Sun was in Leo all day.', [sd]).value).toBe('Leo');
    expect(readReply('yes-no-depends', 'Yes, mostly. No yes about it.', [rd]).value).toBe(null);
    expect(readReply('yes-no-depends', 'No, mostly. Yes no about it.', [rd]).value).toBe(null);
    for (const contrast of ['but', 'though', 'although', 'yet']) {
      expect(readReply('yes-no-depends', `No, ${contrast} yes is possible.`, [rd]).value, `${contrast} yes`).toBe(null);
      expect(readReply('yes-no-depends', `Yes, ${contrast}, no is possible.`, [rd]).value, `${contrast} no`).toBe(null);
    }
    expect(readReply('date', 'It happened at 2023-03-07T10:00Z.')).toEqual({ value: '2023-03-07', reading: 'lenient' });
    expect(readReply('date', 'Sept. 7, 2023')).toEqual({ value: '2023-09-07', reading: 'lenient' });
    expect(readReply('date', 'On 7 Sept 2023.')).toEqual({ value: '2023-09-07', reading: 'lenient' });
    // Two days before one month and year name two dates, so a reply that hedges between them reads as nothing.
    for (const hedge of ['It falls on 18 or 19 March 2041, depending on the time zone.', '19–20 March 2041', 'Between 19 and 20 March 2041.', 'March 19 or 20, 2041', 'March 19 or March 20, 2041', 'The 18th or the 19th of March 2041.', 'The night of 18/19 March 2041.']) {
      expect(readReply('date', hedge), hedge).toEqual({ value: null, reading: 'unparsed' });
    }
    // So do a YYYY-MM-DD or YYYY/MM/DD date and another day of its month, but not a number that runs on into a time, a count
    // or degrees; and the days may also be joined by "&", "thru" or "and/or".
    for (const hedge of ['2041-03-18/19', 'It falls on 2041-03-18 or 19, depending on the zone.', '2041-03-18–19', '2041-03-18 through 19',
      '2041-03-21 or 20, depending on the zone', '2041/03/20 or 21', '2041/03/20–21', '18 & 19 March 2041', '18, & 19 March 2041', '18 thru 19 March 2041',
      '18th and/or 19th March 2041']) {
      expect(readReply('date', hedge), hedge).toEqual({ value: null, reading: 'unparsed' });
    }
    // A date with a hyphen and a one-digit month or day is in no accepted form, so the day after it names nothing either.
    expect(readReply('date', 'It falls on 2041-3-18 or 19.')).toEqual({ value: null, reading: 'unparsed' });
    for (const one of ['It enters at 2041-03-18 to 19:00 UTC.', 'It enters on 2041-03-18, and 2 days later the Moon follows.', 'On 2041-03-18 - 19-hour days.',
      'It enters on 2041-03-18 – 12 h after the new moon.', 'It enters at 2041-03-18 to 10 am.', 'It enters on 2041-03-18 - 4° past the node.',
      'It enters on 2041-03-18 / 20 minutes after sunrise in London.', 'It enters on 2041-03-18 and 3 weeks later the Sun follows.',
      'It enters on 2041-03-18 – 12.5 h after the new moon.', 'It enters on 2041-03-18, and 2.5 days later the Moon follows.',
      'It enters on 2041-03-18 – 9.30 am in London.', 'It enters on 2041-03-18 - 4.5° past the node.']) {
      expect(readReply('date', one), one).toEqual({ value: '2041-03-18', reading: 'lenient' });
    }
    // A decimal counts as a count only before a unit, so a date written with points after a YYYY-MM-DD date is still a second day.
    expect(readReply('date', '2041-03-18 or 19.03.2041')).toEqual({ value: null, reading: 'unparsed' });
    // A date the calendar does not have is still a date the reply names, in every form, and never right; alone, it reads as nothing.
    for (const hedge of ['It falls on 28 or 29 February 2041.', 'February 28 or 29, 2041', '30 or 31 April 2041', 'April 30 or 31, 2041',
      '2041-02-28 or 2041-02-29', '28 February 2041 or 29 February 2041', 'February 28, 2041 or February 29, 2041', '2041/02/28 or 2041/02/29',
      '2041-04-30 or 2041-04-31', '29 February 2041 or 1 March 2041', '2041-02-28/29', '2041-02-29', 'On 31 April 2041.']) {
      expect(readReply('date', hedge), hedge).toEqual({ value: null, reading: 'unparsed' });
    }
    // A number after a letter, a digit, a colon, a full stop, a plus, a hyphen, a minus sign, # or a dash after UTC, GMT or UT
    // is not a hedge's first day.
    const after: Array<[string, string]> = [
      ['At 14:30 – 19 March 2041.', '2041-03-19'],
      ['At 14.30 – 19 March 2041.', '2041-03-19'],
      ['In UTC+10 – 8 March 2023.', '2023-03-08'],
      ['In UTC−10 – 8 March 2023.', '2023-03-08'],
      ['In UTC-10 – 8 March 2023.', '2023-03-08'],
      ['In UTC–10 – 8 March 2023.', '2023-03-08'],
      ['In UTC—10 – 8 March 2023.', '2023-03-08'],
      ['In GMT–5 – 8 March 2023.', '2023-03-08'],
      ['In UT—3 – 8 March 2023.', '2023-03-08'],
      ['GMT+1 - 19 March 2041', '2041-03-19'],
      ['Ingress #2 – 7 March 2023', '2023-03-07'],
      ['Room B12 – 7 March 2023', '2023-03-07'],
      ['c.18–19 March 2041', '2041-03-19'],
    ];
    for (const [text, date] of after) expect(readReply('date', text), text).toEqual({ value: date, reading: 'lenient' });
    // After anything else it is.
    // Among them a dash closed up to the word before it, as is common.
    for (const hedge of ['~18–19 March 2041', '≈18 or 19 March 2041', '—18 or 19 March 2041', '…18 or 19 March 2041', '$18 or 19 March 2041', ',18 or 19 March 2041',
      'The date—18 or 19 March 2041—depends on your zone.', 'It falls on—18 or 19 March 2041.', 'The answer–18 or 19 March 2041.',
      'Mercury enters Aries in 2041—18 or 19 March 2041, depending on the zone.']) {
      expect(readReply('date', hedge), hedge).toEqual({ value: null, reading: 'unparsed' });
    }
    // A reply that only echoes the question scores nothing on any question.
    for (const [index, item] of items.items.entries()) {
      expect(scoreReply(item, key.items[index], item.prompt), item.id).toMatchObject({ value: null, lenient: false });
    }
  });

  it('reads a long reply in time that grows with its length, not with its square', () => {
    // Each of these took seconds while a pattern could split one run of spaces or marks in many ways, or a line's marks were
    // taken off one at a time; each now takes milliseconds. The bound is far above that and far below the slower reading.
    const n = 70_000;
    const long: Array<[string, string]> = [
      ['yes-no-depends', `No${' '.repeat(n)}x`],
      ['yes-no-depends', 'no, '.repeat(n / 4)],
      ['yes-no-depends', `.${'*'.repeat(n)}`],
      ['sign', `As Gemini${' '.repeat(n)}x`],
      ['yes-no-depends', '. '.repeat(n / 2)],
      // U+2028 and U+2029 end a line for ^ and $ and were also read as spaces within one, so a run of them was read again from
      // each of its characters.
      ['yes-no-depends', `${'\u2028'.repeat(n)}x`],
      ['sign', `${'\u2029'.repeat(n)}x`],
      ['yes-no-depends', 'no (x), '.repeat(n / 8)],
      // The look back for a word after "but", "though", "although" or "yet" ran at every character, so a run after a YES or a
      // NO standing alone was read again from each of its characters.
      ['yes-no-depends', `Yes, though${' '.repeat(n)}x`],
      ['yes-no-depends', `no (${'"'.repeat(n)}x`],
    ];
    for (const [kind, reply] of long) {
      const started = performance.now();
      readReply(kind, reply);
      expect(performance.now() - started, `${kind} ${JSON.stringify(reply.slice(0, 12))}`).toBeLessThan(1_000);
    }
  }, 300_000);

  it("reads the questions' own instructions", () => {
    expect(SCORER_INSTRUCTIONS).toEqual(items.instructions);
  });

  it("scores the key's own answers as all correct, and every other sign or word, and the dates either side, as wrong", () => {
    const replies = new Map(items.items.map((item: any, index: number) => [item.id, key.items[index].answer]));
    const run = scoreRun(items, key, replies);
    expect(run.strict).toEqual({ correct: 300, score: 1 });
    expect(run.readings).toEqual({ strict: 300, lenient: 0, unparsed: 0 });
    expect(run.unknown).toEqual([]);
    let wrongs = 0;
    for (const [index, item] of items.items.entries()) {
      const entry = key.items[index];
      const others = item.answer === 'date'
        ? [shift(entry.accepted[0], -1), shift(entry.accepted[entry.accepted.length - 1], 1)]
        : (item.answer === 'yes-no-depends' ? ['YES', 'NO', 'DEPENDS'] : [...SIGN_NAMES, 'DEPENDS']).filter((value) => !entry.accepted.includes(value));
      for (const other of others) {
        expect(scoreReply(item, entry, other), `${item.id} ${other}`).toMatchObject({ strict: false, lenient: false });
        wrongs += 1;
      }
    }
    // 120 questions answered by a sign or DEPENDS, 60 by a word and 120 by a date.
    expect(wrongs).toBe(120 * 12 + 60 * 2 + 120 * 2);
    // A question with no reply counts as unparsed and wrong.
    expect(scoreRun(items, key, new Map()).readings.unparsed).toBe(300);
  });

  it('runs from the command line, through a link too, and names a reply to no question', () => {
    const dir = mkdtempSync(join(tmpdir(), 'zodiacs-sky-benchmark-'));
    try {
      for (const name of ['scorer.mjs', 'items.json', 'key.json']) copyFileSync(fileURLToPath(new URL(name, DIR)), join(dir, name));
      symlinkSync(join(dir, 'scorer.mjs'), join(dir, 'linked-scorer.mjs'));
      writeFileSync(join(dir, 'replies.jsonl'), `${JSON.stringify({ id: items.items[0].id, reply: key.items[0].answer })}\n${JSON.stringify({ id: 'zz-999', reply: 'Leo' })}\n`);
      for (const script of ['scorer.mjs', 'linked-scorer.mjs']) {
        const run = spawnSync(process.execPath, [join(dir, script), join(dir, 'replies.jsonl')], { encoding: 'utf8' });
        expect(run.status, `${script}: ${run.stderr}`).toBe(0);
        const out = JSON.parse(run.stdout);
        expect([out.answered, out.strict.correct, out.unknown], script).toEqual([1, 1, ['zz-999']]);
        expect(run.stderr, script).toMatch(/zz-999/u);
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
