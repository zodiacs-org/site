/*
 * The claims ledger (step 1.14 of the engine brief) held to the copy.
 *
 * docs/claims/ledger.json lists every public sentence about accuracy, time
 * handling or privacy that scripts/claims-ledger-lib.mjs selects, with the
 * claim it makes, and every claim with its status and evidence. Each rule
 * below is its own test so a failure names what drifted:
 *
 * R1 a selected sentence the ledger does not list (a new or edited claim);
 * R2 a listed sentence the copy no longer has;
 * R3 evidence that does not resolve; R4 a binding whose fact changed;
 * R5 a false or stale claim off the protected paths, an overstated claim
 *    without a resolution, or more open overstated claims than the ratchet;
 * R6 translations; R7 the receipt's own conventions; R8 exemptions;
 * R9 orphans; R10 the extractor's controls.
 *
 * `node scripts/claims-ledger.mjs --unlisted` prints what R1 would, with the
 * nearest listed sentence, and `--skeleton <path>` drafts records.
 */
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import { natalChart } from '@zodiacs/engine';
import { createNatalEnvelope } from '@zodiacs/engine/receipt';
import {
  ASTRO_COMPILER_VERSION,
  CLAIM_STATUSES,
  CLAIM_TOPICS,
  EXEMPT_REASONS,
  LEDGER_PATH,
  LEXICON_VERSION,
  nearestRecord,
  readLedger,
  SCOPE_ADD,
  selectFileSentences,
  selectSentences,
  splitSentences,
  normalizeText,
  tierOf,
} from './claims-ledger-lib.mjs';
import { protectedPathLabels } from './phase1-scope-guard.mjs';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(resolve(repoRoot, path), 'utf8');
const exists = (path) => existsSync(resolve(repoRoot, path));

const ledger = readLedger(repoRoot);
const claimsById = new Map(ledger.claims.map((claim) => [claim.id, claim]));
const listedByPath = new Map();
for (const record of ledger.sentences) {
  if (!listedByPath.has(record.path)) listedByPath.set(record.path, []);
  listedByPath.get(record.path).push(record);
}

let selection;
beforeAll(async () => {
  selection = await selectSentences(repoRoot);
}, 180_000);

function report(problems) {
  return problems.length ? `\n  ${problems.join('\n  ')}\n` : '';
}

describe('claims ledger', () => {
  it('is sorted, one record per line, on the current lexicon and parser', () => {
    expect(ledger.version).toBe(1);
    expect(ledger.lexiconVersion).toBe(LEXICON_VERSION);
    const compiler = JSON.parse(read('node_modules/@astrojs/compiler/package.json'));
    expect(compiler.version, 'a new Astro parser can split pages differently: re-run the ledger test and review what moved')
      .toBe(ASTRO_COMPILER_VERSION);
    const ids = ledger.claims.map((claim) => claim.id);
    expect(ids).toEqual([...ids].sort());
    expect(new Set(ids).size).toBe(ids.length);
    const keys = ledger.sentences.map((record) => `${record.path}\u0000${record.text}`);
    expect(keys).toEqual([...keys].sort());
    expect(new Set(keys).size).toBe(keys.length);
    const lines = read(LEDGER_PATH).split('\n');
    const recordLines = lines.filter((line) => line.startsWith('    {'));
    expect(recordLines.length).toBe(ledger.claims.length + ledger.machine.length + ledger.sentences.length);
  });

  it('R1 lists every sentence the extractor selects', () => {
    const problems = [];
    for (const [path, sentences] of selection.selected) {
      const listed = new Set((listedByPath.get(path) ?? []).map((record) => record.text));
      for (const { text, topics } of sentences) {
        if (listed.has(text)) continue;
        const near = nearestRecord(text, listedByPath.get(path) ?? []);
        problems.push(`${path}: new claim sentence (${topics.join(', ') || 'dense block'}): "${text}"`
          + (near ? `\n      did you edit "${near.text}"?` : ''));
      }
    }
    expect(problems, report(problems)).toEqual([]);
  });

  it('R2 finds every listed sentence in its file, still selected', () => {
    const problems = [];
    for (const [path, records] of listedByPath) {
      const selected = new Set((selection.selected.get(path) ?? []).map((sentence) => sentence.text));
      const inScope = selection.files.includes(path);
      for (const record of records) {
        if (selected.has(record.text)) continue;
        problems.push(inScope
          ? `${path}: listed sentence not found (edited, removed, or no longer triggered): "${record.text}"`
          : `${path}: not in the ledger's scope: "${record.text}"`);
      }
    }
    expect(problems, report(problems)).toEqual([]);
  });

  it('R3 resolves every claim\'s evidence', () => {
    const findings = read('docs/platform/evidence/engine-audit-2026-09-22/LEDGER.md');
    const brief = read('docs/platform/ENGINE-AND-PLATFORM-BRIEF.md');
    const ciSources = ciCorpus();
    const problems = [];
    for (const claim of ledger.claims) {
      if (!Array.isArray(claim.evidence) || claim.evidence.length === 0) {
        problems.push(`${claim.id}: no evidence`);
        continue;
      }
      for (const item of claim.evidence) {
        const where = `${claim.id} ${item.kind} ${item.path ?? item.url}${item.anchor ? ` "${item.anchor}"` : ''}`;
        if (item.kind === 'finding') {
          // An audit finding is a '## <id> — ' heading in the audit ledger; a
          // brief risk is an R-row of the brief's table.
          const id = item.anchor;
          const found = item.path === 'docs/platform/ENGINE-AND-PLATFORM-BRIEF.md'
            ? new RegExp(`\\n\\| ${escapeRegExp(id ?? '')} \\|`, 'u').test(brief)
            : item.path === 'docs/platform/evidence/engine-audit-2026-09-22/LEDGER.md' && findings.includes(`\n## ${id} — `);
          if (!id || !found) problems.push(`${where}: no such finding`);
          continue;
        }
        if (item.kind === 'external') {
          if (!/^https:\/\//u.test(item.url ?? '')) problems.push(`${where}: external evidence needs an https url`);
          if (!/^\d{4}-\d{2}-\d{2}$/u.test(item.retrieved ?? '')) problems.push(`${where}: external evidence needs a retrieved date`);
          continue;
        }
        if (!['test', 'code', 'data'].includes(item.kind)) {
          problems.push(`${where}: unknown evidence kind`);
          continue;
        }
        const files = item.path?.includes('*') ? expandGlob(item.path) : [item.path];
        if (!item.path || files.length === 0 || !files.every((file) => exists(file))) {
          problems.push(`${where}: path does not exist`);
          continue;
        }
        if (/chunk-[A-Za-z0-9]{6,}\.js$/u.test(item.path)) problems.push(`${where}: names a hashed chunk; cite the dist/*.js glob`);
        const text = files.map(read).join('\n');
        if (item.match !== undefined && !text.includes(item.match)) problems.push(`${where}: match not found: "${item.match}"`);
        if (item.sha256 !== undefined) {
          const digest = createHash('sha256').update(readFileSync(resolve(repoRoot, item.path))).digest('hex');
          if (digest !== item.sha256) problems.push(`${where}: sha256 is ${digest}, not ${item.sha256}`);
        }
        if (item.kind === 'data' && item.path.endsWith('.json')) {
          try { JSON.parse(text); } catch { problems.push(`${where}: does not parse`); }
        }
        if (item.kind === 'test') {
          if (!item.anchor) {
            problems.push(`${where}: a test needs an anchor`);
          } else if (/\.test\.[cm]?[jt]sx?$/u.test(item.path)) {
            // The title is a call's first argument: it('…'), describe('…'),
            // it.each(rows)('… %s'), it.runIf(cond)('…').
            const title = new RegExp(`\\(\\s*(['"\`])${escapeRegExp(item.anchor)}\\1`, 'u');
            if (!title.test(text) || !/\b(?:it|test|describe)\b/u.test(text)) problems.push(`${where}: no test titled "${item.anchor}"`);
          } else {
            if (!text.includes(item.anchor)) problems.push(`${where}: anchor not found: "${item.anchor}"`);
            const name = item.path.split('/').at(-1);
            if (!ciSources.includes(name)) problems.push(`${where}: not run in CI (package.json, the workflows, or a file they name)`);
          }
        }
      }
      for (const path of claim.enforcedBy ?? []) {
        if (!exists(path)) problems.push(`${claim.id}: enforcedBy ${path} does not exist`);
      }
    }
    expect(problems, report(problems)).toEqual([]);
  });

  it('R4 finds every binding in its code or data', () => {
    const problems = [];
    for (const claim of ledger.claims) {
      for (const bind of claim.binds ?? []) {
        const target = bind.path ?? bind.glob;
        if (/chunk-[A-Za-z0-9]{6,}\.js$/u.test(target)) {
          problems.push(`${claim.id}: ${target} names a hashed chunk; bind the dist/*.js glob instead`);
          continue;
        }
        const files = target.includes('*') ? expandGlob(target) : [target];
        if (files.length === 0 || !files.every((file) => exists(file))) {
          problems.push(`${claim.id}: ${target} does not exist`);
          continue;
        }
        if (!files.some((file) => read(file).includes(bind.match))) {
          problems.push(`${claim.id}: "${bind.match}" is no longer in ${target}; the fact the copy restates changed`);
        }
      }
    }
    expect(problems, report(problems)).toEqual([]);
  });

  it('R5 keeps false and stale claims to protected paths and overstated claims to the ratchet', () => {
    const problems = [];
    for (const claim of ledger.claims) {
      if (!CLAIM_STATUSES.includes(claim.status)) problems.push(`${claim.id}: unknown status ${claim.status}`);
      if (!CLAIM_TOPICS.includes(claim.topic)) problems.push(`${claim.id}: unknown topic ${claim.topic}`);
      if (claim.status === 'false' || claim.status === 'stale') {
        for (const record of ledger.sentences.filter((sentence) => sentence.claim === claim.id)) {
          if (protectedPathLabels(record.path).length === 0) {
            problems.push(`${claim.id} is ${claim.status}, but ${record.path} is not protected: correct "${record.text}"`);
          }
        }
        if (ledger.machine.some((entry) => entry.claim === claim.id)) {
          problems.push(`${claim.id} is ${claim.status}, but the engine's receipt states it`);
        }
      }
      if (claim.status !== 'supported') {
        const resolution = claim.resolution ?? {};
        if (!(resolution.step || resolution.owner || resolution.allowance) || !resolution.note) {
          problems.push(`${claim.id} is ${claim.status} and needs a resolution (step, owner or allowance, and a note)`);
        }
      }
    }
    const open = ledger.claims.filter((claim) => claim.status === 'overstated');
    const listing = open.map((claim) => `${claim.id} → ${claim.resolution?.step ?? claim.resolution?.owner ?? claim.resolution?.allowance}`);
    if (open.length > ledger.maxOpenOverstated) {
      problems.push(`${open.length} open overstated claims exceed maxOpenOverstated ${ledger.maxOpenOverstated}:\n    ${listing.join('\n    ')}`);
    } else if (open.length < ledger.maxOpenOverstated) {
      problems.push(`only ${open.length} overstated claims remain open; lower maxOpenOverstated to ${open.length}`);
    }
    expect(problems, report(problems)).toEqual([]);
  });

  it('R6 holds translations to the English claims and computes their protection', () => {
    const problems = [];
    const englishClaims = new Set([
      ...ledger.sentences.filter((record) => tierOf(record.path) !== 'mirror' && record.claim).map((record) => record.claim),
      ...ledger.machine.map((entry) => entry.claim),
    ]);
    for (const record of ledger.sentences) {
      const claim = record.claim && claimsById.get(record.claim);
      if (tierOf(record.path) === 'mirror') {
        if (claim && claim.status !== 'stale' && !englishClaims.has(claim.id)) {
          problems.push(`${record.path}: translates ${claim.id}, which no English copy states: "${record.text}"`);
        }
      } else if (claim?.status === 'stale') {
        problems.push(`${record.path}: stale marks a translation the English has moved past; correct the English: "${record.text}"`);
      }
      if ('protected' in record) problems.push(`${record.path}: protection is computed, not declared`);
    }
    expect(problems, report(problems)).toEqual([]);
  });

  it('R7 matches the conventions and coverage the engine\'s receipt states', () => {
    const sourceInstant = '2000-01-01T12:00:00Z';
    const chart = natalChart({ utc: sourceInstant, latitude: 51.5, longitude: 0, houseSystem: 'placidus', timeKnown: true });
    const { receipt } = createNatalEnvelope(chart, { sourceInstant });
    const actual = [
      ...Object.entries(receipt.conventions).map(([key, value]) => [`receipt.conventions.${key}`, value]),
      ...Object.entries(receipt.coverage).map(([key, value]) => [`receipt.coverage.${key}`, value]),
    ].sort(([a], [b]) => a.localeCompare(b));
    const listed = ledger.machine.map((entry) => [entry.source, entry.value]);
    expect(listed).toEqual(actual);
    for (const entry of ledger.machine) expect(claimsById.has(entry.claim), entry.source).toBe(true);
  });

  it('R8 exempts only for a listed reason, citing third parties', () => {
    const problems = [];
    for (const record of ledger.sentences) {
      const hasClaim = typeof record.claim === 'string';
      const hasExempt = typeof record.exempt === 'string';
      if (hasClaim === hasExempt) {
        problems.push(`${record.path}: a record has exactly one of claim or exempt: "${record.text}"`);
        continue;
      }
      if (hasExempt && !EXEMPT_REASONS.includes(record.exempt)) problems.push(`${record.path}: unknown exemption ${record.exempt}`);
      if (record.exempt === 'third-party' && !/https:\/\//u.test(record.source ?? '')) {
        problems.push(`${record.path}: a third-party exemption cites that party's published source: "${record.text}"`);
      }
    }
    expect(problems, report(problems)).toEqual([]);
  });

  it('R9 leaves no orphans', () => {
    const problems = [];
    const used = new Set([
      ...ledger.sentences.map((record) => record.claim).filter(Boolean),
      ...ledger.machine.map((entry) => entry.claim),
    ]);
    for (const claim of ledger.claims) if (!used.has(claim.id)) problems.push(`${claim.id}: no sentence or receipt value makes this claim`);
    for (const id of used) if (!claimsById.has(id)) problems.push(`${id}: used but not defined`);
    expect(problems, report(problems)).toEqual([]);
  });

  it('R10 extracts and triggers the injected controls, and the splitter holds its goldens', async () => {
    const controls = [
      {
        path: 'src/pages/methodology/index.astro',
        inject: (source) => source.replace('<section', '<p>Charts here are accurate to the second. Nothing is sent to a server.</p>\n<section'),
        texts: ['Charts here are accurate to the second.', 'Nothing is sent to a server.'],
      },
      {
        path: 'src/pages/about/index.astro',
        inject: (source) => source.replace('<section', '<p>We checked every position against the <a href="/x/">Swiss Ephemeris</a>. Your birth data never leaves this browser.</p>\n<section'),
        texts: ['We checked every position against the Swiss Ephemeris.', 'Your birth data never leaves this browser.'],
      },
      {
        path: 'src/islands/ChartCalculator.tsx',
        inject: (source) => `${source}\nexport const Control = () => (<p>Positions are verified against <strong>JPL</strong> to 2″. Nothing is stored on your device beyond this tab.</p>);\n`,
        texts: ['Positions are verified against JPL to 2″.', 'Nothing is stored on your device beyond this tab.'],
      },
      {
        path: 'src/content/learn/rising/aries.mdx',
        inject: (source) => `${source}\n\nThe _local mean time_ of your birthplace is used. Your chart is computed on your device and **never sent** anywhere.\n`,
        texts: ['The local mean time of your birthplace is used.', 'Your chart is computed on your device and never sent anywhere.'],
      },
      {
        path: 'src/lib/i18n/ui/es.ts',
        inject: (source) => `${source}\nexport const control = { a: 'Posiciones verificadas con NASA JPL Horizons.', b: \`La hora se lee en UTC a las 12:00 del día.\` };\n`,
        texts: ['Posiciones verificadas con NASA JPL Horizons.', 'La hora se lee en UTC a las 12:00 del día.'],
      },
    ];
    controls.push({
      // A TypeDoc page is read for its doc comments, so a claim written in one is selected.
      path: 'public/developers/engine/reference/functions/engine.natalChart.html',
      inject: (source) => source.replace('<div class="tsd-comment tsd-typography"><p>', '<div class="tsd-comment tsd-typography"><p>Positions are verified against <code>JPL</code> to 2″.</p><p>'),
      texts: ['Positions are verified against JPL to 2″.'],
    });
    controls.push({
      // The archived reference's notice has no extension; it is read as plain text, sentence by sentence.
      path: 'public/sdk/engine/media/NOTICE',
      inject: (source) => `${source}\nPositions are verified against JPL to 2″. Nothing is sent to a server.\n`,
      texts: ['Positions are verified against JPL to 2″.', 'Nothing is sent to a server.'],
    });
    expect(selection.files).toContain('public/sdk/engine/media/NOTICE');
    controls.push({
      // The skills the plugin archives ship are read as the READMEs are.
      path: 'plugins/zodiacs-developer/skills/verify-astrology-output/SKILL.md',
      inject: (source) => `${source}\nPositions are verified against JPL to 2″. Nothing is sent to a server.\n`,
      texts: ['Positions are verified against JPL to 2″.', 'Nothing is sent to a server.'],
    });
    for (const skill of ['zodiacs-developer/skills/build-with-zodiacs', 'zodiacs-developer/skills/test-astrology-integration', 'zodiacs-developer/skills/verify-astrology-output', 'zodiacs-sky/skills/explore-the-sky']) {
      expect(selection.files).toContain(`plugins/${skill}/SKILL.md`);
    }
    controls.push({
      // A plugin manifest is read string by string, as every JSON file in scope is.
      path: 'plugins/zodiacs-sky/.claude-plugin/plugin.json',
      inject: (source) => source.replace('"displayName": "Zodiacs",', '"displayName": "Zodiacs",\n  "summary": "Positions are verified against JPL to 2″. Nothing is sent to a server.",'),
      texts: ['Positions are verified against JPL to 2″.', 'Nothing is sent to a server.'],
    });
    controls.push({
      // The starter's pages are read as HTML.
      path: 'examples/platform/src/widget.html',
      inject: (source) => source.replace('<fieldset>', '<p>Positions are verified against <code>JPL</code> to 2″. Nothing is sent to a server.</p>\n<fieldset>'),
      texts: ['Positions are verified against JPL to 2″.', 'Nothing is sent to a server.'],
    });
    controls.push({
      // The adapter's NOTICE, like the archived reference's, is plain text.
      path: 'examples/mcp-server/NOTICE',
      inject: (source) => `${source}\nPositions are verified against JPL to 2″. Nothing is sent to a server.\n`,
      texts: ['Positions are verified against JPL to 2″.', 'Nothing is sent to a server.'],
    });
    controls.push({
      // The starter's scripts are read for their strings, as the site's own code is.
      path: 'examples/platform/src/calculate.mjs',
      inject: (source) => `${source}\nexport const control = 'Positions are verified against JPL to 2″. Nothing is sent to a server.';\n`,
      texts: ['Positions are verified against JPL to 2″.', 'Nothing is sent to a server.'],
    });
    controls.push({
      // A fence with no language only lays prose out, so its lines are read.
      path: 'examples/precision-alpha/README.md',
      inject: (source) => `${source}\n\n\`\`\`\nPositions are verified against JPL to 2″. Nothing is sent to a server.\n\`\`\`\n`,
      texts: ['Positions are verified against JPL to 2″.', 'Nothing is sent to a server.'],
    });
    controls.push({
      // An inline script on a page that is not a TypeDoc reference is read for its strings.
      path: 'public/sdk/examples/simastry-aura/index.html',
      inject: (source) => source.replace('</body>', "<script>document.title = 'Positions are verified against JPL to 2″. Nothing is sent to a server.';</script></body>"),
      texts: ['Positions are verified against JPL to 2″.', 'Nothing is sent to a server.'],
    });
    for (const path of ['examples/platform/src/app.mjs', 'examples/platform/scripts/build.mjs', 'examples/platform/tests/receipt.check.mjs', 'examples/mcp-server/verify.mjs', 'plugins/zodiacs-developer/examples/calendar.mjs']) {
      expect(selection.files).toContain(path);
    }
    for (const path of SCOPE_ADD) expect(selection.files).toContain(path);
    // A directory shows a manifest's description whole, so it is read whole.
    for (const path of SCOPE_ADD.filter((file) => /plugin\.json$/u.test(file))) expect(tierOf(path), path).toBe('dense');
    const missed = [];
    for (const control of controls) {
      const source = read(control.path);
      const injected = control.inject(source);
      expect(injected, control.path).not.toBe(source);
      const selected = new Set((await selectFileSentences(control.path, injected)).map((sentence) => sentence.text));
      for (const text of control.texts) if (!selected.has(text)) missed.push(`${control.path}: "${text}"`);
    }
    expect(missed, report(missed)).toEqual([]);

    // Its signatures and member names are code, not prose: the same words there are not selected.
    const page = read('public/developers/engine/reference/functions/engine.natalChart.html');
    const signature = page.replace('<div class="tsd-signature tsd-anchor-link" id="natalchart">', '<div class="tsd-signature tsd-anchor-link" id="natalchart">deltaT verified against JPL to 2″ ');
    expect(signature).not.toBe(page);
    expect((await selectFileSentences('public/developers/engine/reference/functions/engine.natalChart.html', signature))
      .filter((sentence) => sentence.text.includes('JPL'))).toEqual([]);
    // Fenced code in a language is code: the same words there are not selected.
    const fenced = `${read('examples/precision-alpha/README.md')}\n\n\`\`\`js\n// Positions are verified against JPL to 2″.\nconst note = 'Nothing is sent to a server.';\n\`\`\`\n`;
    expect((await selectFileSentences('examples/precision-alpha/README.md', fenced))
      .filter((sentence) => /JPL to 2″|Nothing is sent/u.test(sentence.text))).toEqual([]);

    expect(splitSentences('It is accurate, e.g. to 1″ in 2020. The next sentence starts here.'))
      .toEqual(['It is accurate, e.g. to 1″ in 2020.', 'The next sentence starts here.']);
    expect(splitSentences('The U.S. Naval Observatory publishes ΔT. It was 69.1 s in 2026. Yes.'))
      .toEqual(['The U.S. Naval Observatory publishes ΔT.', 'It was 69.1 s in 2026.']);
    expect(splitSentences('Births at 12:00 p.m. Noon is assumed when the time is unknown.'))
      .toEqual(['Births at 12:00 p.m. Noon is assumed when the time is unknown.']);
    expect(splitSentences('The value is ${…}. ${…} shows the zone. (A note in brackets follows here.)'))
      .toEqual(['The value is ${…}.', '${…} shows the zone.', '(A note in brackets follows here.)']);
    expect(normalizeText('Visitor&rsquo;s&nbsp;chart &amp;  data\n  stays')).toBe('Visitor’s chart & data stays');
  });
});

/**
 * The text of everything CI runs: package.json and the workflows, then each
 * script, test or SQL file they name, and the files those name, three levels
 * down. A test cited as evidence has to be in it, or it is not evidence.
 */
function ciCorpus() {
  const workflows = readdirSync(resolve(repoRoot, '.github/workflows'))
    .filter((name) => name.endsWith('.yml')).map((name) => `.github/workflows/${name}`);
  const seen = new Set();
  const texts = [];
  let queue = ['package.json', ...workflows];
  for (let depth = 0; depth < 4 && queue.length; depth += 1) {
    const next = [];
    for (const file of queue) {
      if (seen.has(file) || !exists(file)) continue;
      seen.add(file);
      const text = read(file);
      texts.push(text);
      for (const match of text.matchAll(/(?:scripts|tests|examples|supabase)\/[\w./-]+\.(?:mjs|cjs|js|ts|sh|sql)/gu)) next.push(match[0]);
      for (const match of text.matchAll(/'(tests\/[\w.-]+\.check\.mjs)'/gu)) next.push(`examples/platform/${match[1]}`);
      // A workflow step that runs `npm test` in a package's own directory runs
      // that package's test script, and the files its globs name.
      for (const match of text.matchAll(/working-directory: (examples\/[\w.-]+)\n\s+run: npm test\n/gu)) {
        const files = packageTestFiles(match[1]);
        texts.push(files.join('\n'));
        next.push(...files);
      }
    }
    queue = next;
  }
  return texts.join('\n');
}

/** The files a package's `npm test` script names, its `dir/*.ext` globs expanded. */
function packageTestFiles(directory) {
  const script = JSON.parse(read(`${directory}/package.json`)).scripts?.test ?? '';
  return [...script.matchAll(/([\w./-]+\/\*[\w.-]+)/gu)].flatMap(([, glob]) => expandGlob(`${directory}/${glob}`));
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}

/** A directory and a basename pattern with one `*`, e.g. node_modules/@zodiacs/engine/dist/*.js. */
function expandGlob(glob) {
  const slash = glob.lastIndexOf('/');
  const directory = glob.slice(0, slash);
  const pattern = new RegExp(`^${escapeRegExp(glob.slice(slash + 1)).replace('\\*', '[^/]*')}$`, 'u');
  if (!exists(directory)) return [];
  return readdirSync(resolve(repoRoot, directory)).filter((name) => pattern.test(name)).map((name) => `${directory}/${name}`);
}
