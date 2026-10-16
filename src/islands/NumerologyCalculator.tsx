/**
 * Numerology calculator: birth date (and, optionally, full name at birth)
 * in, the Pythagorean core numbers out. The arithmetic is tiny and runs
 * synchronously on submit; nothing is stored and nothing leaves the page.
 * Every Y in the name is a real button, so the vowel/consonant call the
 * rule made can be flipped by hand and the chart recomputed.
 *
 * English only by design: this island never reads the UI catalogue.
 */
import { useEffect, useRef, useState } from 'preact/hooks';
import EvidenceDisclosure from './EvidenceDisclosure';
import {
  formatChain,
  lifePathExample,
  numerologyProfile,
  NumerologyInputError,
  type CoreNumber,
  type KarmicDebt,
  type NamePartNumbers,
  type NumerologyProfile,
  type Reduction,
  type SingleDigit,
  type YOverride,
} from '../lib/numerology';
import {
  KARMIC_DEBT_MEANINGS,
  NUMBER_HUES,
  NUMBER_MEANINGS,
  PERSONAL_YEAR_MEANINGS,
  POSITIONS,
  type NumberMeaning,
  type PositionKey,
} from '../data/numerology-meanings';

const UNSUPPORTED_LETTERS_MESSAGE =
  'This name uses letters outside A to Z once accents are removed. The Pythagorean table only covers the Latin alphabet.';
const INVALID_DATE_MESSAGE = 'That date is not a real calendar date.';
const GENERIC_MESSAGE = 'The numbers could not be computed. Check the date and the name and try again.';
const NAME_EMPTIED_NOTE =
  'Nothing was left of that name once titles, suffixes, and anything that is not a letter were removed, so these are the date numbers only.';

const POSITION_LABEL: Record<PositionKey, string> = Object.fromEntries(
  POSITIONS.map((p) => [p.key, p.label]),
) as Record<PositionKey, string>;

const POSITION_SOURCE: Record<PositionKey, string> = Object.fromEntries(
  POSITIONS.map((p) => [p.key, p.source]),
) as Record<PositionKey, string>;

const ORDINAL = ['First', 'Second', 'Third', 'Fourth'] as const;

interface Submitted {
  name: string;
  date: string;
  today: string;
}

/** Local calendar date as YYYY-MM-DD; personal cycles run on the reader's own calendar. */
function localIsoDate(d: Date): string {
  const y = String(d.getFullYear()).padStart(4, '0');
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** The first sentence of a summary: everything up to the first full stop that ends a sentence. */
function firstSentence(text: string): string {
  const match = /^[\s\S]*?[.!?](?=\s|$)/.exec(text);
  return match ? match[0] : text;
}

function meaningFor(value: number): NumberMeaning | null {
  return value === 0 ? null : (NUMBER_MEANINGS[value as CoreNumber] ?? null);
}

function hueFor(value: number): string {
  return value === 0 ? 'var(--accent)' : (NUMBER_HUES[value as CoreNumber] ?? 'var(--accent)');
}

/** "16/7" when the total needed reducing; '' when the chain is the number itself. */
function chainIfLonger(r: Reduction): string {
  return r.chain.length > 1 ? formatChain(r) : '';
}

function arrows(r: Reduction): string {
  return r.chain.join(' → ');
}

function errorMessage(err: unknown): string {
  if (err instanceof NumerologyInputError) {
    if (err.code === 'unsupported-letters') {
      return err.detail ? `${UNSUPPORTED_LETTERS_MESSAGE} The letter "${err.detail}" cannot be read.` : UNSUPPORTED_LETTERS_MESSAGE;
    }
    if (err.code === 'invalid-date') return INVALID_DATE_MESSAGE;
  }
  return GENERIC_MESSAGE;
}

interface Computed {
  profile: NumerologyProfile;
  /** The Life Path arithmetic as one mono line, worked once per submit rather than per render. */
  example: string;
  /** Set when a non-blank name normalised to nothing and the date numbers were computed alone. */
  nameEmptied: boolean;
}

function compute(input: Submitted, overrides: readonly YOverride[]): Computed {
  const example = lifePathExample(input.date);
  try {
    return {
      profile: numerologyProfile({ birthDate: input.date, fullName: input.name, today: input.today, yOverrides: overrides }),
      example,
      nameEmptied: false,
    };
  } catch (err) {
    if (err instanceof NumerologyInputError && err.code === 'empty-name') {
      return {
        profile: numerologyProfile({ birthDate: input.date, today: input.today }),
        example,
        nameEmptied: input.name.trim() !== '',
      };
    }
    throw err;
  }
}

interface CardProps {
  position: PositionKey;
  value: number;
  chain?: string;
  /** Replaces the first-sentence summary from NUMBER_MEANINGS when set. */
  summary?: string;
  /** An extra line under the number (personal month and day). */
  meta?: string;
}

function NumberCard({ position, value, chain = '', summary, meta }: CardProps) {
  const meaning = meaningFor(value);
  const label = POSITION_LABEL[position];
  return (
    <div class="tile num__tile" style={`--sign:${hueFor(value)}`}>
      <span class="mono--label num__label">{label}</span>
      <div class="num__figure">
        <span class="display num__number">{value}</span>
        {chain && <span class="mono num__chain">{chain}</span>}
      </div>
      {meta && <span class="num__meta">{meta}</span>}
      {meaning ? (
        <>
          <p class="num__epithet">
            <strong>{meaning.name}</strong>
            <span class="num__keywords">{meaning.keywords.join(' · ')}</span>
          </p>
          <p class="num__summary">{summary ?? firstSentence(meaning.summary)}</p>
        </>
      ) : (
        <p class="num__summary">
          No letters counted toward this number, so it has no value. {label} is read from {POSITION_SOURCE[position]}.
        </p>
      )}
    </div>
  );
}

function LetterTable({
  part, partIndex, onToggleY,
}: { part: NamePartNumbers; partIndex: number; onToggleY: (part: number, index: number, vowel: boolean) => void }) {
  const folded = part.letters !== part.raw.toUpperCase();
  return (
    <div class="num__part">
      <span class="num__part-name">
        <span>{part.raw}</span>
        {folded && <span class="num__part-folded">read as {part.letters}</span>}
      </span>
      <ol class="num__letters" aria-label={`Letters of ${part.raw} with their values`}>
        {part.cells.map((cell) => (
          <li key={cell.index} class={`num__cell${cell.vowel ? ' num__cell--vowel' : ''}`}>
            {cell.isY ? (
              <button
                type="button"
                class="num__y"
                aria-pressed={cell.vowel}
                aria-label={`Y, value ${cell.value}, letter ${cell.index + 1} of ${part.raw}: count as a vowel`}
                onClick={() => onToggleY(partIndex, cell.index, !cell.vowel)}
              >
                <span class="num__letter">Y</span>
                <span class="mono num__value">{cell.value}</span>
              </button>
            ) : (
              <>
                <span class="num__letter">{cell.letter}</span>
                <span class="mono num__value">{cell.value}</span>
                {cell.vowel && <span class="sr-only"> (vowel)</span>}
              </>
            )}
          </li>
        ))}
      </ol>
      <p class="mono num__sums">
        all letters {arrows(part.expression)} · vowels {arrows(part.soulUrge)} · consonants {arrows(part.personality)}
      </p>
    </div>
  );
}

function wholeNameLine(parts: readonly NamePartNumbers[], pick: (p: NamePartNumbers) => Reduction, whole: Reduction): string {
  return `${parts.map((p) => pick(p).value).join(' + ')} = ${arrows(whole)}`;
}

/** "A", "A and B", "A, B, and C". */
function listJoin(items: readonly string[]): string {
  if (items.length < 3) return items.join(' and ');
  return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`;
}

function ageSpan(starts: readonly number[], i: number): string {
  const from = starts[i] ?? 0;
  const next = starts[i + 1];
  if (i === 0) return `birth to age ${(next ?? 1) - 1}`;
  if (next === undefined) return `age ${from} onward`;
  return `ages ${from} to ${next - 1}`;
}

interface Props {
  /** The Life Path whose page this island sits on, so the lead does not link the reader to where they already are. */
  currentLifePath?: CoreNumber;
}

export default function NumerologyCalculator({ currentLifePath }: Props) {
  const [name, setName] = useState('');
  const [date, setDate] = useState('');
  const [submitted, setSubmitted] = useState<Submitted | null>(null);
  const [overrides, setOverrides] = useState<YOverride[]>([]);
  const [result, setResult] = useState<Computed | null>(null);
  // Bumped on every submit so the focus effect below runs even when the
  // outcome (say, the same error message twice) leaves the other state unchanged.
  const [attempt, setAttempt] = useState(0);
  const [error, setError] = useState('');
  const resultHeadingRef = useRef<HTMLHeadingElement>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);
  const focusAfterComputeRef = useRef(false);

  function submit(e: Event) {
    e.preventDefault();
    if (!date) return;
    focusAfterComputeRef.current = true;
    setError('');
    setAttempt((n) => n + 1);
    // Y overrides index into one specific name; a different name starts clean.
    const nextOverrides = submitted && submitted.name === name ? overrides : [];
    const input: Submitted = { name, date, today: localIsoDate(new Date()) };
    try {
      setResult(compute(input, nextOverrides));
      setSubmitted(input);
      setOverrides(nextOverrides);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  function toggleY(part: number, index: number, vowel: boolean) {
    if (!submitted) return;
    const next: YOverride[] = [
      ...overrides.filter((o) => !(o.part === part && o.index === index)),
      { part, index, as: vowel ? 'vowel' : 'consonant' },
    ];
    try {
      setError('');
      setResult(compute(submitted, next));
      setOverrides(next);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  useEffect(() => {
    if (!focusAfterComputeRef.current) return;
    if (error) {
      errorRef.current?.focus();
      focusAfterComputeRef.current = false;
      return;
    }
    if (result) {
      resultHeadingRef.current?.focus();
      focusAfterComputeRef.current = false;
    }
  }, [error, result, attempt]);

  const profile = result?.profile ?? null;
  const example = result?.example ?? '';
  const lifePath = profile?.date.lifePath ?? null;
  const lifePathMeaning = lifePath ? meaningFor(lifePath.value) : null;
  const cycles = profile?.personalCycles ?? null;

  const debtCarriers = (debt: KarmicDebt): string[] => {
    if (!profile) return [];
    const carriers: [PositionKey, Reduction | null | undefined][] = [
      ['lifePath', profile.date.lifePath],
      ['birthday', profile.date.birthday],
      ['expression', profile.name?.expression],
      ['soulUrge', profile.name?.soulUrge],
      ['personality', profile.name?.personality],
    ];
    return carriers.filter(([, r]) => r?.karmicDebt === debt).map(([key]) => POSITION_LABEL[key]);
  };

  return (
    <div class="calc num">
      <form class="calc__form shell" onSubmit={submit}>
        <div class="core calc__core">
          <div class="calc__fields">
            <div class="field">
              <label class="field__label" for="num-name">
                Full name at birth <span class="field__optional">optional</span>
              </label>
              <input
                id="num-name" class="field__input" type="text" autocomplete="name"
                value={name} aria-describedby="num-name-help"
                onInput={(e) => setName((e.target as HTMLInputElement).value)}
              />
              <p class="field__help" id="num-name-help">
                As written on your birth certificate, with middle names. Leave blank for the date numbers only.
              </p>
            </div>
            <div class="field">
              <label class="field__label" for="num-date">Birth date</label>
              <input
                id="num-date" class="field__input" type="date" required
                min="1800-01-01" max="2199-12-31" value={date} aria-describedby="num-date-help"
                onInput={(e) => setDate((e.target as HTMLInputElement).value)}
              />
              <p class="field__help" id="num-date-help">Month, day, and year. No time or place needed.</p>
            </div>
          </div>

          <button class="btn btn--primary calc__submit" type="submit" disabled={!date}>
            <span>Find my numbers</span>
            <span class="orb">↗</span>
          </button>
          <p class="calc__privacy">Private by default. Your name and birth date stay in this browser.</p>
          {error && <p key={attempt} class="calc__error" role="alert" tabIndex={-1} ref={errorRef}>{error}</p>}
        </div>
      </form>

      {profile && lifePath && cycles && (
        <div class="calc__result" style={`--sign:${hueFor(lifePath.value)}`}>
          <h2 class="sr-only" tabIndex={-1} ref={resultHeadingRef}>Your numbers</h2>

          {result?.nameEmptied && <p class="notice" role="status">{NAME_EMPTIED_NOTE}</p>}

          <div class="num__lead shell tinted" style={`--sign:${hueFor(lifePath.value)}`}>
            <div class="core tinted num__lead-core">
              <span class="mono--label num__label">Life Path</span>
              <div class="num__figure num__figure--lead">
                <span class="display num__number num__number--lead">{lifePath.value}</span>
                {chainIfLonger(lifePath) && <span class="mono num__chain">{formatChain(lifePath)}</span>}
              </div>
              {lifePathMeaning && (
                <>
                  <p class="num__epithet num__epithet--lead">
                    <strong>{lifePathMeaning.name}</strong>
                    <span class="num__keywords">{lifePathMeaning.keywords.join(' · ')}</span>
                  </p>
                  <p class="num__summary num__summary--lead">{lifePathMeaning.summary}</p>
                </>
              )}
              <p class="num__source">From your birth date, {profile.date.iso}</p>
              {lifePath.value !== currentLifePath && (
                <a class="btn btn--ghost num__read" href={`/numerology/life-path/${lifePath.value}/`}>
                  <span>Read about Life Path {lifePath.value}</span><span class="orb">→</span>
                </a>
              )}
            </div>
          </div>

          <div class="num__grid">
            <NumberCard position="birthday" value={profile.date.birthday.value} chain={chainIfLonger(profile.date.birthday)} />
            {profile.name && (
              <>
                <NumberCard position="expression" value={profile.name.expression.value} chain={chainIfLonger(profile.name.expression)} />
                <NumberCard position="soulUrge" value={profile.name.soulUrge.value} chain={chainIfLonger(profile.name.soulUrge)} />
                <NumberCard position="personality" value={profile.name.personality.value} chain={chainIfLonger(profile.name.personality)} />
              </>
            )}
            {profile.maturity && (
              <NumberCard position="maturity" value={profile.maturity.value} chain={chainIfLonger(profile.maturity)} />
            )}
            <NumberCard position="attitude" value={profile.date.attitude} />
            <NumberCard
              position="personalYear"
              value={cycles.year}
              meta={`Personal month ${cycles.month} · personal day ${cycles.day}`}
              summary={PERSONAL_YEAR_MEANINGS[cycles.year as SingleDigit]}
            />
          </div>

          {profile.karmicDebts.length > 0 && (
            <div class="num__debts">
              <h3 class="num__debts-head">Karmic debt</h3>
              {profile.karmicDebts.map((debt) => (
                <p key={debt} class="num__debt">
                  <span class="mono num__debt-number">{debt}</span>{' '}
                  <span>
                    Carried by your {listJoin(debtCarriers(debt))}. {KARMIC_DEBT_MEANINGS[debt]}
                  </span>
                </p>
              ))}
            </div>
          )}

          <EvidenceDisclosure label="How we compute" variant="panel" className="num__how">
            <div class="num__how-block">
              <span class="mono--label num__label">Life Path from {profile.date.iso}</span>
              <p class="mono num__line">{example}</p>
              <p class="num__how-note">
                Month, day, and the digit sum of the year are each reduced, with 11, 22, and 33 kept; the three are added and reduced once more.
              </p>
            </div>

            {profile.name && (
              <div class="num__how-block">
                <span class="mono--label num__label">Letters</span>
                <p class="num__how-note">
                  A to I are 1 to 9, J to R are 1 to 9 again, S to Z are 1 to 8. Vowels are underlined. Each Y is a button: press it to count it the other way and the numbers update.
                </p>
                {profile.name.parts.map((part, i) => (
                  <LetterTable key={`${i}-${part.letters}`} part={part} partIndex={i} onToggleY={toggleY} />
                ))}
                {profile.name.parts.length > 1 && (
                  <dl class="num__whole mono">
                    <div><dt>Expression</dt><dd>{wholeNameLine(profile.name.parts, (p) => p.expression, profile.name.expression)}</dd></div>
                    <div><dt>Soul Urge</dt><dd>{wholeNameLine(profile.name.parts, (p) => p.soulUrge, profile.name.soulUrge)}</dd></div>
                    <div><dt>Personality</dt><dd>{wholeNameLine(profile.name.parts, (p) => p.personality, profile.name.personality)}</dd></div>
                  </dl>
                )}
                {profile.maturity && (
                  <p class="mono num__line">
                    Maturity: {profile.date.lifePath.value} + {profile.name.expression.value} = {arrows(profile.maturity)}
                  </p>
                )}
              </div>
            )}

            <div class="num__how-block">
              <span class="mono--label num__label">Cycles for {cycles.forDate}</span>
              <p class="mono num__line">
                personal year {cycles.year} · personal month {cycles.month} · personal day {cycles.day}
              </p>
              <p class="num__how-note">
                Birth month and day added to the current year, then to the current month, then to the day, each reduced to one digit.
              </p>
            </div>

            <details class="num__cycles">
              <summary>Pinnacles and challenges</summary>
              <div class="num__cycles-body">
                <p class="num__how-note">
                  Four pinnacles from the reduced month, day, and year taken in pairs; four challenges from their differences. Both are timing conventions of the tradition.
                </p>
                <dl class="num__whole mono">
                  {profile.date.pinnacles.map((p, i) => (
                    <div key={`p${i}`}>
                      <dt>{ORDINAL[i]} pinnacle</dt>
                      <dd>{p} · {ageSpan(profile.date.pinnacleAgeStarts, i)}</dd>
                    </div>
                  ))}
                  {profile.date.challenges.map((c, i) => (
                    <div key={`c${i}`}>
                      <dt>{ORDINAL[i]} challenge</dt>
                      <dd>{c}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            </details>
          </EvidenceDisclosure>

          <div class="calc__actions">
            <a class="btn btn--ghost" href="/tools/">
              <span>All tools</span><span class="orb">→</span>
            </a>
            <a class="btn btn--ghost" href="/birth-chart/">
              <span>Your birth chart</span><span class="orb">↗</span>
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
