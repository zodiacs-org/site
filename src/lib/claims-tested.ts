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
 * repository or one of its pull requests, with that evidence as its source.
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
const SOURCE = /^https:\/\/(?:github\.com\/zodiacs-org\/site\/(?:pull\/\d+|blob\/main\/[\w./-]+)|zodiacs\.org\/[\w/-]*)$/u;

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

/** The page is off unless PUBLIC_CLAIMS_TESTED_ENABLED is exactly '1'; it stays noindex until the owner approves publishing. */
export const CLAIMS_TESTED_SWITCH = 'PUBLIC_CLAIMS_TESTED_ENABLED';
