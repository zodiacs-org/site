#!/usr/bin/env node
/*
 * The engine and platform programme's completion ledger.
 *
 * docs/platform/programme/acceptance-ledger.json lists every acceptance unit
 * of the brief's programme with a fixed weight, and this script derives the
 * completion figures from it. A unit counts only when its status is
 * "accepted": its gate has committed evidence and it is in the release state
 * the gate asks for. Blocked units stay in the denominator.
 *
 *   node scripts/programme-ledger.mjs            write docs/platform/programme/LEDGER.md
 *   node scripts/programme-ledger.mjs --check    fail if the ledger is invalid or LEDGER.md is stale
 *   node scripts/programme-ledger.mjs --summary  print the completion figures
 */
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const LEDGER_JSON = 'docs/platform/programme/acceptance-ledger.json';
export const LEDGER_MD = 'docs/platform/programme/LEDGER.md';
export const STATUSES = Object.freeze([
  'accepted', // gate met with committed evidence, in the required release state
  'validated', // gate evidence exists, but the release state or a ratification is missing
  'merged', // code merged; gate not yet evidenced
  'implemented', // code exists outside main (an open PR or a prototype)
  'partial', // some of the unit exists
  'failed', // gate measured and failed
  'not-started',
]);
export const RELEASES = Object.freeze(['deployed', 'released', 'merged', 'unmerged', 'none']);
export const EXCLUSIONS = Object.freeze(['later', 'research', 'deferred', 'demand-gated', 'outcome', 'counted-elsewhere']);

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export function readProgrammeLedger(root = repoRoot) {
  return JSON.parse(readFileSync(resolve(root, LEDGER_JSON), 'utf8'));
}

export function denominatorDigest(units) {
  const lines = [...units].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)).map((unit) => `${unit.id}\t${unit.weight}`);
  return createHash('sha256').update(lines.join('\n')).digest('hex');
}

const round = (value, places = 2) => Math.round(value * 10 ** places) / 10 ** places;

export function validate(ledger) {
  const problems = [];
  const ids = new Set();
  for (const unit of ledger.units) {
    const where = `unit ${unit.id}`;
    if (ids.has(unit.id)) problems.push(`${where}: duplicate id`);
    ids.add(unit.id);
    if (!(typeof unit.weight === 'number' && unit.weight > 0)) problems.push(`${where}: weight must be positive`);
    if (!STATUSES.includes(unit.status)) problems.push(`${where}: unknown status ${unit.status}`);
    if (!RELEASES.includes(unit.release)) problems.push(`${where}: unknown release ${unit.release}`);
    for (const field of ['area', 'title', 'source', 'gate']) {
      if (typeof unit[field] !== 'string' || unit[field].trim() === '') problems.push(`${where}: ${field} is required`);
    }
    if (unit.status === 'accepted') {
      if (!Array.isArray(unit.evidence) || unit.evidence.length === 0) problems.push(`${where}: accepted without evidence`);
      if (!['deployed', 'released', 'merged'].includes(unit.release)) problems.push(`${where}: accepted but release is ${unit.release}`);
      if (unit.blockedBy) problems.push(`${where}: accepted but still blocked`);
    }
    if (unit.status === 'validated' && (!Array.isArray(unit.evidence) || unit.evidence.length === 0)) {
      problems.push(`${where}: validated without evidence`);
    }
    if (unit.blockedBy && (typeof unit.blockedBy.action !== 'string' || !unit.blockedBy.action.trim())) {
      problems.push(`${where}: blockedBy needs an action`);
    }
  }
  for (const unit of ledger.units) {
    for (const dependency of unit.dependsOn ?? []) {
      if (!ids.has(dependency)) problems.push(`unit ${unit.id}: depends on unknown ${dependency}`);
    }
  }
  for (const item of ledger.excluded) {
    if (ids.has(item.id)) problems.push(`excluded ${item.id}: also a unit`);
    if (!EXCLUSIONS.includes(item.classification)) problems.push(`excluded ${item.id}: unknown classification ${item.classification}`);
    if (typeof item.basis !== 'string' || !item.basis.trim()) problems.push(`excluded ${item.id}: basis is required`);
  }
  const total = round(ledger.units.reduce((sum, unit) => sum + unit.weight, 0), 4);
  if (total !== ledger.denominator.totalWeight) problems.push(`total weight is ${total}, not the fixed ${ledger.denominator.totalWeight}`);
  if (ledger.units.length !== ledger.denominator.unitCount) problems.push(`${ledger.units.length} units, not the fixed ${ledger.denominator.unitCount}`);
  const digest = denominatorDigest(ledger.units);
  if (digest !== ledger.denominator.digest) problems.push(`denominator digest is ${digest}; a change of ids or weights needs a recorded decision`);
  const last = ledger.denominator.changes.at(-1);
  if (!last || last.digest !== ledger.denominator.digest) problems.push('the last recorded denominator change must carry the current digest');
  for (const change of ledger.denominator.changes) {
    if (!change.date || !change.reason || !change.decision) problems.push('every denominator change needs a date, a reason and a decision');
  }
  return problems;
}

export function figures(ledger) {
  const total = ledger.denominator.totalWeight;
  const sum = (units) => round(units.reduce((acc, unit) => acc + unit.weight, 0), 4);
  const accepted = ledger.units.filter((unit) => unit.status === 'accepted');
  const blocked = ledger.units.filter((unit) => unit.status !== 'accepted' && unit.blockedBy);
  const byStatus = Object.fromEntries(STATUSES.map((status) => [status, sum(ledger.units.filter((unit) => unit.status === status))]));
  const areas = [...new Set(ledger.units.map((unit) => unit.area))];
  const byArea = areas.map((area) => {
    const units = ledger.units.filter((unit) => unit.area === area);
    const weight = sum(units);
    const done = sum(units.filter((unit) => unit.status === 'accepted'));
    return { area, units: units.length, weight, accepted: done, percent: Math.round((100 * done) / weight) };
  });
  return {
    total,
    accepted: sum(accepted),
    blocked: sum(blocked),
    percent: Math.round((100 * sum(accepted)) / total),
    blockedPercent: Math.round((100 * sum(blocked)) / total),
    byStatus,
    byArea,
  };
}

const cell = (text) => String(text ?? '').replace(/\|/gu, '\\|').replace(/\n/gu, ' ');

export function render(ledger) {
  const f = figures(ledger);
  const out = [];
  out.push('# Programme ledger');
  out.push('');
  out.push(`Generated by \`node scripts/programme-ledger.mjs\` from \`acceptance-ledger.json\`; do not edit by hand. Method and weights: [README.md](README.md).`);
  out.push('');
  out.push(`**Overall delivery: ${f.percent}%** — ${f.accepted} of ${f.total} weighted units accepted; blocked on owner or external action: ${f.blockedPercent}% (${f.blocked}).`);
  out.push('');
  out.push(`As of ${ledger.asOf}. Weight by status: ${STATUSES.map((status) => `${status} ${f.byStatus[status]}`).join(', ')}.`);
  out.push('');
  out.push('| area | units | weight | accepted | % |');
  out.push('| --- | ---: | ---: | ---: | ---: |');
  for (const row of f.byArea) out.push(`| ${cell(row.area)} | ${row.units} | ${row.weight} | ${row.accepted} | ${row.percent}% |`);
  out.push('');
  for (const row of f.byArea) {
    out.push(`## ${row.area}`);
    out.push('');
    out.push('| id | unit | weight | status | release | gate | evidence and notes |');
    out.push('| --- | --- | ---: | --- | --- | --- | --- |');
    for (const unit of ledger.units.filter((candidate) => candidate.area === row.area)) {
      const notes = [
        ...(unit.evidence ?? []),
        unit.dependsOn?.length ? `depends on ${unit.dependsOn.join(', ')}` : '',
        unit.blockedBy ? `**blocked:** ${unit.blockedBy.action}` : '',
        unit.notes ?? '',
      ].filter(Boolean).join('; ');
      out.push(`| ${cell(unit.id)} | ${cell(unit.title)} | ${unit.weight} | ${unit.status} | ${unit.release} | ${cell(unit.gate)} | ${cell(notes)} |`);
    }
    out.push('');
  }
  out.push('## Not in the denominator');
  out.push('');
  out.push('| id | item | classification | basis |');
  out.push('| --- | --- | --- | --- |');
  for (const item of ledger.excluded) out.push(`| ${cell(item.id)} | ${cell(item.title)} | ${item.classification} | ${cell(item.basis)} |`);
  out.push('');
  out.push('## Outcomes, tracked separately');
  out.push('');
  for (const item of ledger.outcomes) out.push(`- **${item.id}.** ${item.title} (${item.source}).`);
  out.push('');
  out.push('## Denominator changes');
  out.push('');
  for (const change of ledger.denominator.changes) out.push(`- ${change.date}: ${change.reason} Decision: ${change.decision}. Digest \`${change.digest.slice(0, 12)}\`.`);
  out.push('');
  return out.join('\n');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const ledger = readProgrammeLedger();
  const problems = validate(ledger);
  if (problems.length) {
    console.error(`programme-ledger: ${problems.length} problem(s)\n  ${problems.join('\n  ')}`);
    process.exit(1);
  }
  const text = render(ledger);
  if (process.argv.includes('--check')) {
    const current = readFileSync(resolve(repoRoot, LEDGER_MD), 'utf8');
    if (current !== text) {
      console.error(`programme-ledger: ${LEDGER_MD} is stale; run node scripts/programme-ledger.mjs`);
      process.exit(1);
    }
    console.log('programme-ledger: OK');
  } else if (process.argv.includes('--summary')) {
    const f = figures(ledger);
    console.log(`Overall delivery: ${f.percent}% (${f.accepted} of ${f.total}); blocked ${f.blockedPercent}% (${f.blocked})`);
    for (const row of f.byArea) console.log(`  ${row.area}: ${row.percent}% (${row.accepted} of ${row.weight})`);
  } else {
    writeFileSync(resolve(repoRoot, LEDGER_MD), text);
    console.log(`programme-ledger: wrote ${LEDGER_MD}`);
  }
}
