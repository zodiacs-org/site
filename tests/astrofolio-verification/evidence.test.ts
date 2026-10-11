import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { EN } from '../../src/strings/en.mjs';
import receipts from '../../src/data/registry-origin-receipts.json';
import { BASE_COMPARISON_NOTE, NORMALIZATION_NOTE } from '../../src/registry/astrofolio-verification/checker';
import {
  evidence, registrySha256, sourceRevision, STATUS_LABELS,
  assertSourcePin, createEvidence, validateClaims, claimFreshness,
} from '../../src/registry/astrofolio-verification/evidence';

const registryText = readFileSync('public/registry/zodiacs.registry.json', 'utf8');
const registry = JSON.parse(registryText);
const fixtures = JSON.parse(readFileSync('docs/astrofolio-trust/evaluation-fixtures.json', 'utf8'));
const claim = (id: string) => evidence.claims.find((entry) => entry.id === id)!;

describe('Astrofolio source adapter', () => {
  it('derives every displayed identifier and network from the canonical source', () => {
    const canonical = registry.assets.flatMap((asset: { sign: string; representations: Array<{ address: string; chain: string; kind: string }> }) => (
      asset.representations.map((entry) => ({ sign: asset.sign, address: entry.address, chain: entry.chain, kind: entry.kind }))
    ));
    expect(evidence.records.map(({ sign, address, chain, kind }) => ({ sign, address, chain, kind }))).toEqual(canonical);
    expect(evidence.records).toHaveLength(24);
    expect(evidence.records.filter((entry) => entry.chain === 'base').every((entry) => entry.chainId === 8453 && entry.kind === 'bridged')).toBe(true);
    expect(evidence.records.filter((entry) => entry.chain === 'solana').every((entry) => !entry.chainId && entry.kind === 'native')).toBe(true);
  });

  it('exposes the exact raw-byte hash and immutable revision', () => {
    expect(registrySha256).toBe(createHash('sha256').update(registryText).digest('hex'));
    expect(evidence.registrySha256).toBe(registrySha256);
    expect(evidence.registryVersion).toBe(registry.version);
    expect(sourceRevision).toBe('7f953e3fca0e7d5009e5602a1dad69edff0f54cc');
    for (const entry of evidence.claims.flatMap((item) => item.sources)) {
      if (entry.sha256) {
        expect(entry.revision).toBe(sourceRevision);
        expect(entry.url).toContain(`/blob/${sourceRevision}/`);
        expect(entry.sha256).toMatch(/^[a-f0-9]{64}$/u);
      }
    }
  });

  it('fails closed if a canonical source changes under its old immutable reference', () => {
    expect(() => createEvidence({ registryText: registryText.replace('"version": "0.2.0"', '"version": "0.2.1"') })).toThrow(/repin/u);
    expect(() => createEvidence({ registryText: '{}' })).toThrow(/source changed/u);
    expect(() => assertSourcePin('src/strings/en.mjs', 'unreviewed disclosure')).toThrow(/repin/u);
  });

  it('rejects a replaced address, missing origin evidence and contradictory review flags', () => {
    const replaced = structuredClone(registry);
    replaced.assets[0].representations[0].address = registry.assets[1].native.address;
    expect(() => createEvidence({ registryText: JSON.stringify(replaced) })).toThrow(/source changed/u);
    const missing = structuredClone(receipts);
    missing.receipts.pop();
    expect(() => createEvidence({ receipts: missing })).toThrow(/Origin evidence differs/u);
    const contradicted = structuredClone(receipts);
    contradicted.receipts[0].verification.rpc.initializeMintObserved = false;
    expect(() => createEvidence({ receipts: contradicted })).toThrow(/Origin evidence differs/u);
  });

  it('never uses a native-mint receipt as evidence of Base bridge creation', () => {
    for (const entry of evidence.records) {
      const receipt = receipts.receipts.find((item) => item.sign === entry.sign)!;
      if (entry.chain === 'solana') expect(entry.originReceipt).toEqual({ blockTime: receipt.blockTime, explorerUrl: receipt.explorerUrl });
      else expect(entry.originReceipt).toBeUndefined();
    }
    expect(claim('native-origin').qualifications.join(' ')).toContain('Base bridge creation date');
  });

  it('preserves canonical operator wording rather than inventing another attestation', () => {
    expect(claim('operator-relationship').statement).toBe(EN['disclosure.operatorStatement']);
    expect(claim('economic-interests').statement).toBe(EN['disclosure.economicStatement']);
    expect(claim('registry-match').statement).toBe(EN['disclosure.adviceEvidence']);
  });

  it('keeps JSON losslessly serializable, including unknown dates and qualifications', () => {
    expect(JSON.parse(JSON.stringify(evidence))).toEqual(evidence);
    expect(evidence.claims.every((entry) => entry.sources.length && entry.qualifications.length && entry.review.method)).toBe(true);
    expect(claim('holder-rights').observedAt).toBeNull();
  });

  it('preserves the actual chain comparison and failure rules in the public machine model', () => {
    expect(evidence.comparisonPolicy.normalization).toBe(NORMALIZATION_NOTE);
    expect(evidence.comparisonPolicy.base).toBe(BASE_COMPARISON_NOTE);
    expect(evidence.comparisonPolicy.source).toContain('no silent snapshot fallback');
    expect(evidence.comparisonPolicy.privacy).toContain('contains no pasted address');
    expect(evidence.comparisonPolicy.scope).toContain('not transaction checksum validation');
    expect(evidence.comparisonPolicy.scope).toContain('does not prove wallet control');
  });
});

describe('evidence uncertainty and freshness', () => {
  it('never refreshes holdings or origin checks to a build or page-read date', () => {
    expect(claim('economic-interests').observedAt).toBe('2026-08-02');
    expect(claim('operator-relationship').observedAt).toBe('2026-08-23');
    expect(claim('native-origin').observedAt).toBe('2024-07-05T17:54:34.000Z');
    expect(claim('native-origin').review.reviewedAt).toBe('2026-07-23');
    const changed = structuredClone(receipts);
    changed.reviewedAt = '2030-01-01';
    expect(() => createEvidence({ receipts: changed })).toThrow(/repin/u);
  });

  it('keeps historical records valid in scope without an arbitrary expiry', () => {
    expect(claimFreshness(claim('native-origin'), '2040-01-01')).toBe('historical-record');
    expect(claim('native-origin').review.policy).toBe('historical-record');
  });

  it('labels dated attestations and release observations without promoting them', () => {
    const before = structuredClone(evidence.claims);
    expect(claimFreshness(claim('economic-interests'), '2030-01-01')).toBe('dated-observation-not-current-verification');
    expect(claimFreshness(claim('platform-candidate'), '2030-01-01')).toBe('dated-observation-not-current-verification');
    expect(claimFreshness(claim('holder-rights'), '2030-01-01')).toBe('unresolved');
    expect(claimFreshness(claim('former-domain'), '2030-01-01')).toBe('superseded');
    expect(evidence.claims).toEqual(before);
  });

  it.each(['operator-relationship', 'economic-interests', 'holder-rights', 'source-conflict', 'former-domain', 'platform-candidate'])(
    'rejects an unsupported positive status for %s', (id) => {
      const promoted = structuredClone(evidence.claims);
      promoted.find((entry) => entry.id === id)!.status = 'supported-by-public-record';
      expect(() => validateClaims(promoted)).toThrow(/promotion/u);
    },
  );

  it('rejects disappearing evidence and unknown statuses', () => {
    const missing = structuredClone(evidence.claims);
    missing[0].sources = [];
    expect(() => validateClaims(missing)).toThrow(/lacks source/u);
    const unknown = structuredClone(evidence.claims);
    Object.assign(unknown[0], { status: 'independently-certified' });
    expect(() => validateClaims(unknown)).toThrow(/Unknown evidence status/u);
  });

  it('keeps rights unknown and scope of independent review limited', () => {
    expect(claim('holder-rights').status).toBe('unresolved');
    expect(claim('holder-rights').qualifications.join(' ')).toContain('not a determination that no rights can exist');
    expect(claim('native-origin').qualifications.join(' ')).toContain('not an independent security or legal certification');
    expect(claim('source-conflict').status).toBe('unresolved');
    expect(claim('source-conflict').statement).toContain('does not independently verify');
  });

  it('distinguishes the exact engine candidate from older published Registry SDK versions', () => {
    expect(claim('platform-candidate').subject).toBe('@zodiacs/engine@0.1.1-rc.1');
    expect(claim('platform-candidate').status).toBe('planned');
    expect(claim('platform-candidate').qualifications.join(' ')).toContain('Earlier published @zodiacs/sdk versions');
  });
});

describe('neutral evaluation fixtures', () => {
  it('keeps the actual supplied-source run distinct from pending discovery evaluation', () => {
    expect(fixtures.questions).toHaveLength(20);
    expect(new Set(fixtures.questions.map((entry: { id: string }) => entry.id)).size).toBe(20);
    expect(fixtures.evaluations.sourceGrounded.status).toBe('executed-with-supplied-evidence');
    expect(fixtures.evaluations.unprimedBrowsing.status).toBe('pending');
    const run = JSON.parse(readFileSync(fixtures.evaluations.sourceGrounded.runs[0], 'utf8'));
    expect(run.metadata.answerCount).toBe(20);
    expect(run.answers.map((answer: { id: string }) => answer.id)).toEqual(fixtures.questions.map((question: { id: string }) => question.id));
    expect(run.answers.every((answer: { answerVerbatim: string; citations: string[] }) => answer.answerVerbatim && answer.citations.length)).toBe(true);
    expect(run.findings.answersWithCitationGaps).toBeGreaterThan(0);
    expect(fixtures.evaluations.unprimedBrowsing.runs).toEqual([]);
    for (const question of fixtures.questions) {
      expect(question.requiredConclusions.length).toBeGreaterThan(0);
      expect(question.forbiddenConclusions.length).toBeGreaterThan(0);
      for (const id of question.claimIds) expect(claim(id), question.id).toBeDefined();
    }
  });

  it('covers every evidence status and required adversarial scenario', () => {
    expect(new Set(evidence.claims.map((entry) => entry.status))).toEqual(new Set(Object.keys(STATUS_LABELS)));
    const tags = new Set(fixtures.questions.flatMap((question: { tags: string[] }) => question.tags));
    for (const tag of ['same-ticker', 'wrong-network', 'candidate-as-shipped', 'proposed-benefit-as-right', 'unrelated-project-as-fake', 'source-failure', 'unicode', 'case-sensitive']) expect(tags.has(tag)).toBe(true);
  });
});
