/**
 * "Astrology claims, tested": the claims Zodiacs has tested and the honest
 * result of each, results at chance included. The entries live in
 * src/data/claims-tested.json; this module checks them and orders them for
 * the page (src/pages/claims-tested/index.astro).
 *
 * Two kinds, kept apart on the page so a pass on arithmetic is never read as
 * evidence that astrology predicts: "prediction" (does a reading foretell
 * anything) and "calculation" (is the sky we compute right).
 *
 * An entry is added only for a test whose result is already in this
 * repository, with that evidence as its source: a file on main or a page on
 * zodiacs.org, never a pull request.
 * The astro-markets lab's results stay out until the owner releases them.
 */
import { z } from 'zod';
import data from '../data/claims-tested.json';

export const CLAIM_KINDS = ['prediction', 'calculation'] as const;
export const CLAIM_VERDICTS = {
  passed: 'Passed',
  'passed-after-correction': 'Passed after a correction',
  mixed: 'Mixed',
  'at-chance': 'At chance',
  failed: 'Did not hold',
  pending: 'Still running',
} as const;
export type ClaimVerdict = keyof typeof CLAIM_VERDICTS;

const DATE = /^\d{4}-\d{2}-\d{2}$/u;
// A file on main or a page on zodiacs.org, never a pull request: a pull request can change or close.
const SOURCE = /^https:\/\/(?:github\.com\/zodiacs-org\/site\/blob\/main\/[\w./-]+|zodiacs\.org\/[\w/-]*)$/u;

export const claimEntry = z.strictObject({
  id: z.string().regex(/^[a-z0-9-]+$/u),
  kind: z.enum(CLAIM_KINDS),
  claim: z.string().min(10),
  verdict: z.enum(Object.keys(CLAIM_VERDICTS) as [ClaimVerdict, ...ClaimVerdict[]]),
  result: z.string().min(10),
  sample: z.string().min(5),
  method: z.string().min(10),
  whatWeDid: z.string().min(10),
  preregistered: z.boolean(),
  tested: z.string().regex(DATE),
  source: z.strictObject({ label: z.string().min(3), url: z.string().regex(SOURCE) }),
});
export type ClaimEntry = z.infer<typeof claimEntry>;

export const claimsTested = z.strictObject({
  schema: z.literal('zodiacs.claims-tested.v1'),
  updated: z.string().regex(DATE),
  entries: z.array(claimEntry).min(1),
});

/** The checked entries, newest test first within each kind. */
export function claimsTestedEntries(input: unknown = data): { updated: string; prediction: ClaimEntry[]; calculation: ClaimEntry[] } {
  const parsed = claimsTested.parse(input);
  const ids = new Set<string>();
  for (const entry of parsed.entries) {
    if (ids.has(entry.id)) throw new Error(`claims-tested: duplicate id ${entry.id}`);
    ids.add(entry.id);
  }
  const order = (a: ClaimEntry, b: ClaimEntry) => b.tested.localeCompare(a.tested) || a.id.localeCompare(b.id);
  return {
    updated: parsed.updated,
    prediction: parsed.entries.filter((entry) => entry.kind === 'prediction').sort(order),
    calculation: parsed.entries.filter((entry) => entry.kind === 'calculation').sort(order),
  };
}

export type ClaimTally = { n: number; held: number; not: number; other: number };

/**
 * One kind's tally for the page: held up (passed, passed after a correction),
 * at chance or did not hold (at-chance, failed), and mixed or still running
 * (mixed, pending). The three always add up to n.
 */
export function claimTally(entries: readonly ClaimEntry[]): ClaimTally {
  const tally: ClaimTally = { n: entries.length, held: 0, not: 0, other: 0 };
  for (const { verdict } of entries) {
    if (verdict === 'passed' || verdict === 'passed-after-correction') tally.held += 1;
    else if (verdict === 'at-chance' || verdict === 'failed') tally.not += 1;
    else tally.other += 1;
  }
  return tally;
}

/**
 * The page's summary line for one kind, e.g. "Calculation checks: 2. Held up: 2."
 * A clause whose count is 0 is left out, except "Held up"; a kind with no
 * entries reads "none yet".
 */
export function tallyLine(kind: (typeof CLAIM_KINDS)[number], tally: ClaimTally): string {
  const label = kind === 'prediction' ? 'Prediction tests' : 'Calculation checks';
  const not = kind === 'prediction' ? 'At chance or did not hold' : 'Did not hold';
  const clauses = [`${label}: ${tally.n === 0 ? 'none yet' : tally.n}.`, `Held up: ${tally.held}.`];
  if (tally.not) clauses.push(`${not}: ${tally.not}.`);
  if (tally.other) clauses.push(`Mixed or still running: ${tally.other}.`);
  return clauses.join(' ');
}

/** The page is off unless PUBLIC_CLAIMS_TESTED_ENABLED is exactly '1'; it stays noindex until the owner approves publishing. */
export const CLAIMS_TESTED_SWITCH = 'PUBLIC_CLAIMS_TESTED_ENABLED';
