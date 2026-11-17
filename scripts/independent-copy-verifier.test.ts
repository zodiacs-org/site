import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import dailyPublication from '../src/data/daily-publication.json';
import dailyManifest from '../src/data/daily-publication-manifest.json';
import horoscopeProgram from '../src/data/horoscope-program.json';
import aspectDayProgram from './fixtures/horoscope-program.aspect-day.json';
import constitution from '../src/lib/editorial-policy/constitution.v1.json';
import {
  independentWordCount,
  verifyDailyPublicationCopy,
  verifyHoroscopeProgramCopy,
} from './independent-copy-verifier';

function ruleIds(failures: ReturnType<typeof verifyDailyPublicationCopy>): string[] {
  return failures.map((failure) => failure.ruleId);
}

describe('independent copy verifier', () => {
  it('accepts the committed daily and multi-surface packages', () => {
    expect(verifyDailyPublicationCopy(dailyPublication)).toEqual([]);
    expect(verifyHoroscopeProgramCopy(horoscopeProgram)).toEqual([]);
  });

  it('records independent copy approval separately from same-renderer replay', () => {
    const copyRole = constitution.roles.find((role) => role.id === 'copy-verifier');
    expect(copyRole?.kind).toBe('independent-serialized-copy-policy');
    expect(dailyManifest.verification.copyVerifierIndependentFromGenerator).toBe(true);
    expect(dailyManifest.verification.astronomyAudit).toMatchObject({
      kind: 'site-engine-parity-and-event-physics',
      sourceOfTruth: '@zodiacs/engine',
      independentFromSnapshotBuilder: true,
      independentAstronomyImplementation: false,
      status: 'passed',
    });
    expect(dailyManifest.verification.copyCheck).toMatchObject({
      implementation: 'zodiacs.independent-copy-verifier.v1',
      independentImplementation: true,
      status: 'passed',
    });
    expect(dailyManifest.verification.deterministicReplay).toMatchObject({
      independentImplementation: false,
      status: 'passed',
    });
  });

  it('fails closed on malformed roots', () => {
    expect(ruleIds(verifyDailyPublicationCopy(null))).toContain('COPY-STRUCT-ROOT');
    expect(ruleIds(verifyHoroscopeProgramCopy([]))).toContain('COPY-STRUCT-ROOT');
  });

  it('independently catches daily structure, evidence, length, voice, and duplication', () => {
    const tampered = structuredClone(dailyPublication) as unknown as {
      signs: Array<{
        headline: string;
        lines: Array<{ text: string; evidenceRefs: string[] }>;
      }>;
    };
    tampered.signs[0].headline = 'Too short';
    tampered.signs[0].lines[0].text += ' Delve!';
    tampered.signs[0].lines[0].evidenceRefs = ['missing:fact'];
    tampered.signs[1].headline = tampered.signs[2].headline;
    tampered.signs[1].lines[1].text = tampered.signs[2].lines[1].text;

    const ids = ruleIds(verifyDailyPublicationCopy(tampered));
    expect(ids).toContain('COPY-LENGTH-WORDS');
    expect(ids).toContain('COPY-VOICE-ai-delve');
    expect(ids).toContain('COPY-VOICE-EXCLAMATION');
    expect(ids).toContain('COPY-EVIDENCE-UNKNOWN');
    expect(ids).toContain('COPY-DIST-EXACT');
  });

  it('independently catches program evidence, declared length, voice, and distinctness', () => {
    const tampered = structuredClone(horoscopeProgram) as unknown as {
      signs: Array<{
        sign: string;
        readings: Record<string, {
          sign: string;
          passages: Array<{ text: string; evidenceRefs: string[] }>;
          text: string;
          wordCount: number;
        }>;
      }>;
    };
    const ariesToday = tampered.signs[0].readings.today;
    ariesToday.passages[0].evidenceRefs[0] = 'missing:fact';
    ariesToday.passages[0].text += ' Delve!';
    ariesToday.text = ariesToday.passages.map((passage) => passage.text).join('\n\n');
    ariesToday.wordCount = independentWordCount(ariesToday.text);

    const geminiToday = tampered.signs[2].readings.today;
    tampered.signs[1].readings.today = structuredClone(geminiToday);
    tampered.signs[1].readings.today.sign = tampered.signs[1].sign;
    tampered.signs[1].readings.tomorrow.wordCount = 1;

    const ids = ruleIds(verifyHoroscopeProgramCopy(tampered));
    expect(ids).toContain('COPY-EVIDENCE-UNKNOWN');
    expect(ids).toContain('COPY-LENGTH-DECLARATION');
    expect(ids).toContain('COPY-VOICE-BANNED');
    expect(ids).toContain('COPY-VOICE-EXCLAMATION');
    expect(ids).toContain('COPY-DIST-EXACT');
  });

  it('caps exact sentence reuse across signs and surfaces', () => {
    type MutableProgram = {
      signs: Array<{
        readings: Record<string, {
          passages: Array<{ text: string }>;
          text: string;
          wordCount: number;
        }>;
      }>;
    };
    const addSharedSentence = (program: MutableProgram, signCount: number): void => {
      for (const signProgram of program.signs.slice(0, signCount)) {
        const reading = signProgram.readings.today;
        reading.passages[0].text = `Write one concrete next step before noon. ${reading.passages[0].text}`;
        reading.text = reading.passages.map((passage) => passage.text).join('\n\n');
        reading.wordCount = independentWordCount(reading.text);
      }
    };

    const allowed = structuredClone(horoscopeProgram) as unknown as MutableProgram;
    addSharedSentence(allowed, 3);
    expect(ruleIds(verifyHoroscopeProgramCopy(allowed)))
      .not.toContain('COPY-DIST-SENTENCE-REUSE');

    const blocked = structuredClone(horoscopeProgram) as unknown as MutableProgram;
    addSharedSentence(blocked, 4);
    expect(ruleIds(verifyHoroscopeProgramCopy(blocked)))
      .toContain('COPY-DIST-SENTENCE-REUSE');
  });

  it('rejects near-duplicate actions inside one short-form reading', () => {
    const tampered = structuredClone(horoscopeProgram) as unknown as {
      signs: Array<{
        sign: string;
        readings: Record<string, {
          passages: Array<{ text: string }>;
          text: string;
          wordCount: number;
        }>;
      }>;
    };
    const reading = tampered.signs.find((entry) => entry.sign === 'aquarius')?.readings.today;
    expect(reading).toBeDefined();
    if (!reading) return;
    const repeatedAction = reading.passages[1].text.match(/^[^.]+\./u)?.[0];
    expect(repeatedAction).toBeDefined();
    reading.passages[2].text = reading.passages[2].text.replace(
      /^[^.]+\./u,
      repeatedAction ?? '',
    );
    reading.text = reading.passages.map((passage) => passage.text).join('\n\n');
    reading.wordCount = independentWordCount(reading.text);

    expect(ruleIds(verifyHoroscopeProgramCopy(tampered)))
      .toContain('COPY-DIST-INTRA-ACTION');
  });

  it('rejects a tomorrow edition that merely relabels today', () => {
    const tampered = structuredClone(horoscopeProgram) as unknown as {
      signs: Array<{
        sign: string;
        readings: Record<string, {
          passages: Array<{ text: string }>;
          text: string;
          wordCount: number;
        }>;
      }>;
    };
    const signProgram = tampered.signs.find((entry) => entry.sign === 'aries');
    expect(signProgram).toBeDefined();
    if (!signProgram) return;
    const today = signProgram.readings.today;
    const tomorrow = signProgram.readings.tomorrow;
    tomorrow.passages = structuredClone(today.passages);
    tomorrow.passages[0].text = tomorrow.passages[0].text.replace(/^Today,/u, 'Tomorrow,');
    tomorrow.text = tomorrow.passages.map((passage) => passage.text).join('\n\n');
    tomorrow.wordCount = independentWordCount(tomorrow.text);

    expect(ruleIds(verifyHoroscopeProgramCopy(tampered)))
      .toContain('COPY-DIST-TODAY-TOMORROW');
  });

  it('independently reconciles prose claims to phase, sign, aspect, house, and event receipts', () => {
    // The live sky may publish a day with no exact aspect (2026-08-03 shipped
    // none), so tampering runs against the pinned 2026-08-02 program instead
    // of the committed day. The untampered fixture must verify clean so every
    // failure below is caused by the tampering alone; refresh the fixture from
    // any newer day whose prose cites a sky-event aspect receipt.
    expect(verifyHoroscopeProgramCopy(aspectDayProgram)).toEqual([]);

    const tampered = structuredClone(aspectDayProgram) as unknown as {
      evidence: Array<Record<string, unknown>>;
      signs: Array<{
        readings: Record<string, {
          passages: Array<{ text: string; evidenceRefs: string[] }>;
          text: string;
          wordCount: number;
        }>;
      }>;
    };
    const reading = tampered.signs[0].readings.today;
    const moon = tampered.evidence.find((receipt) => (
      reading.passages[0].evidenceRefs.includes(String(receipt.id))
      && receipt.kind === 'body-position'
      && receipt.body === 'Moon'
    ));
    const signedBody = tampered.evidence.find((receipt) => (
      reading.passages[1].evidenceRefs.includes(String(receipt.id))
      && receipt.kind === 'body-position'
      && typeof receipt.sign === 'string'
    ));
    const derived = tampered.evidence.find((receipt) => (
      reading.passages[0].evidenceRefs.includes(String(receipt.id))
      && receipt.kind === 'solar-house'
      && typeof receipt.house === 'number'
    ));
    const referencedIds = new Set(tampered.signs.flatMap((entry) => (
      Object.values(entry.readings).flatMap((candidate) => (
        candidate.passages.flatMap((passage) => passage.evidenceRefs)
      ))
    )));
    const skyEvent = tampered.evidence.find((receipt) => (
      referencedIds.has(String(receipt.id))
      && receipt.kind === 'sky-event'
      && typeof receipt.sign === 'string'
    ));

    expect(moon).toBeDefined();
    expect(signedBody).toBeDefined();
    expect(derived).toBeDefined();
    expect(skyEvent).toBeDefined();
    if (!moon || !signedBody || !derived || !skyEvent) return;

    moon.moonPhase = moon.moonPhase === 'Full Moon' ? 'New Moon' : 'Full Moon';
    signedBody.sign = signedBody.sign === 'aries' ? 'taurus' : 'aries';
    derived.house = (Number(derived.house) % 12) + 1;
    skyEvent.sign = skyEvent.sign === 'aries' ? 'taurus' : 'aries';

    const failures = verifyHoroscopeProgramCopy(tampered);
    const ids = ruleIds(failures);
    expect(ids).toContain('COPY-EVIDENCE-CLAIM');
    expect(ids).toContain('COPY-EVIDENCE-THEME');
    expect(ids).toContain('COPY-EVIDENCE-DERIVATION');
    // The moon and sign tampers also raise COPY-EVIDENCE-CLAIM, so the aspect
    // tamper must be pinned to its own failure or it could regress unnoticed.
    expect(failures.some((violation) => (
      violation.ruleId === 'COPY-EVIDENCE-CLAIM' && violation.message.includes('aspect')
    ))).toBe(true);
  });

  it('has no renderer, builder, or generator-validator dependency', () => {
    const source = readFileSync(new URL('./independent-copy-verifier.ts', import.meta.url), 'utf8');
    expect(source).not.toMatch(/from\s+['"][^'"]*(?:daily-publication|horoscope-program)['"]/u);
    expect(source).not.toMatch(/\bbuild(?:DailyPublication|HoroscopeProgram)\b/u);
    expect(source).not.toMatch(/\bvalidate(?:DailyPublication|HoroscopeProgram)\b/u);
  });
});
