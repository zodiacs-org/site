/**
 * Two resources a host can read before it calls a tool: the conventions
 * vocabulary the engine's calculation records speak, and how this server
 * calculates. Both are built into the bundle; reading one opens no file and
 * makes no request.
 *
 * The vocabulary is the engine's own data. `NATAL_RECEIPT_CONVENTION_SETS` is
 * every conventions set a record may carry, the current one first. The engine
 * does not export its coverage statement, so it is read from a receipt the
 * engine writes for a fixed instant, as the compute API reads it. What is written
 * here is only what the engine leaves to its documentation: which versions
 * wrote each set, and a sentence on what each key and flag covers. The tests
 * compare both with the engine's sets.
 */
import { ENGINE_VERSION, EPHEMERIS, natalChart } from '@zodiacs/engine';
import { NATAL_RECEIPT_CONVENTION_SETS, NATAL_RECEIPT_SCHEMA, createNatalEnvelope } from '@zodiacs/engine/receipt';
import { ADAPTER_NAME, ADAPTER_VERSION } from './bounds';

export const CONVENTIONS_URI = 'zodiacs://conventions';
export const METHODOLOGY_URI = 'zodiacs://methodology';
export const VOCABULARY_SCHEMA = 'zodiacs.conventions-vocabulary.v1';

/**
 * The engine versions that wrote each set of `NATAL_RECEIPT_CONVENTION_SETS`,
 * in its order, as the engine's declarations document them. `to: null` is the
 * current set.
 */
export const SET_WRITERS = Object.freeze([
  { from: '0.1.1-rc.16', to: null },
  { from: '0.1.1-rc.15', to: '0.1.1-rc.15' },
  { from: '0.1.1-rc.8', to: '0.1.1-rc.14' },
  { from: '0.1.1-rc.7', to: '0.1.1-rc.7' },
  { from: '0.1.1-rc.3', to: '0.1.1-rc.6' },
] as const);

/** What each key of a conventions set covers. Its value is the engine's own token. */
export const CONVENTION_KEYS: Readonly<Record<string, string>> = Object.freeze({
  calendar: 'The calendar dates are read on.',
  zodiac: 'The zodiac longitudes are measured in.',
  planetPositions: 'How the planets\' positions are reduced: the observer, the frame, and which corrections apply.',
  moonPosition: 'Where the Moon\'s position comes from, and which corrections apply to it.',
  moonNodes: 'How the lunar nodes are found.',
  nutation: 'The nutation series, and the terms of the equation of the equinoxes.',
  angles: 'The sidereal time and the obliquity the angles and house cusps are computed from.',
  deltaT: 'What ΔT is, and where a record gives the value it used; the sets of 0.1.1-rc.8 to rc.14 also say the instant was read as UT1.',
  timeScale: 'How an instant became UT1 and Terrestrial Time, and where a record says so.',
  localTime: 'How a local civil time in a record was resolved to an instant.',
  speed: 'The unit of daily motion, and the interval it is differenced over.',
  aspects: 'Which aspects, between which bodies, and how applying is judged.',
  longitudeUnit: 'The unit and range of a longitude.',
});

/** What each chart flag reports. */
export const FLAG_MEANINGS: Readonly<Record<string, string>> = Object.freeze({
  'dst-gap': 'The local time given did not exist, because a clock change skipped it; it was moved forward.',
  'dst-fold': 'The local time given happened twice, because a clock change repeated it; the earlier was taken.',
  lmt: 'The local time given was read on a local mean time: the birthplace\'s own, from its longitude, where the record has one, otherwise the time zone\'s.',
  'no-time': 'No birth time was known: the instant is a reference, and angles and houses are absent.',
  'polar-fallback': 'The house system requested is undefined at this latitude, so whole sign was used.',
  'outside-reference-span': 'The instant falls outside the engine\'s reference span, 1800 to 2200.',
});

export function conventionsVocabulary() {
  const sets = NATAL_RECEIPT_CONVENTION_SETS.map((conventions, index) => ({
    writtenBy: SET_WRITERS[index],
    current: index === 0,
    conventions,
  }));
  const keys = Object.fromEntries(Object.entries(CONVENTION_KEYS).map(([key, covers]) => {
    // The earliest set carrying the key: the sets run from the current one back.
    const earliest = [...sets].reverse().find((set) => key in set.conventions);
    return [key, { covers, recordedFrom: earliest?.writtenBy.from ?? null }];
  }));
  return {
    schema: VOCABULARY_SCHEMA,
    note: 'A Zodiacs-owned draft vocabulary, not an industry interoperability standard. Each calculation record names the set it was computed under in receipt.conventions; a record is read only under a set the engine version it names wrote.',
    receiptSchema: NATAL_RECEIPT_SCHEMA,
    engine: { name: '@zodiacs/engine', version: ENGINE_VERSION, ephemeris: { name: EPHEMERIS.name, version: EPHEMERIS.version } },
    keys,
    sets,
    coverage: createNatalEnvelope(natalChart({ utc: '2000-01-01T12:00:00Z', timeKnown: false })).receipt.coverage,
    flags: FLAG_MEANINGS,
  };
}

const METHODOLOGY_SECTIONS = Object.freeze([
  '## What a chart holds',
  'Twelve bodies: the Sun, the Moon, the planets from Mercury to Pluto, and the two lunar nodes of the Moon\'s instantaneous orbit. Each comes with its tropical ecliptic longitude of date, in degrees from 0 up to 360, its latitude, and its daily motion in longitude, which is negative while it is retrograde. The resource zodiacs://conventions lists the conventions the engine\'s calculation records state.',
  '## Time',
  '`utc` must carry its zone, `Z` or an offset. This server applies the offset written there and nothing else: it looks up no place and no time zone. From 1972 to the end of the IERS table it carries, the engine reads the instant as UTC, taking Terrestrial Time from the IERS leap seconds and UT1 from IERS UT1 − UTC. It reads any other instant as UT1, with ΔT (TT − UT1) from its versioned model. A calculation record states the ΔT used, with its uncertainty and its source, and how the instant became UT1 and Terrestrial Time.',
  '## An unknown birth time',
  'With `timeKnown: false` the instant is a reference, not a birth time. The positions are those at that instant, angles and houses are left out, and the reply says why. Nothing implies noon: `reference: "utc-noon"` records that midday UTC stands in for an unknown time.',
  '## Houses',
  'Thirteen house systems, each as Swiss Ephemeris defines it. Inside the polar circle Placidus and Koch are undefined: there the engine uses whole sign, the reply names the system requested beside the one used, and the result carries the `polar-fallback` flag. The engine does not compute angles at the exact poles.',
  '## Aspects',
  'The five major aspects, conjunction, sextile, square, trine and opposition, between the Sun, the Moon and the eight planets; the nodes take none. An aspect is applying only while its orb is shrinking at the instant, judged from the two daily motions.',
  '## Comparing two records',
  '`compare_calculation_records` lists where two records differ: the inputs, the house settings, the conventions, the flags, ΔT and the time basis, and the computed values. A record\'s extensions, and what it says about its own origin other than its engine version, are not compared. Then it gives what accounts for each difference, labelled by its evidence: reproduced by recalculating here, reported by the records themselves, a hypothesis that fits, or unresolved. Only a difference of house system is tested by recalculating. A cause is reproduced only when both records name the engine version bundled here, each record\'s own values come back from its own inputs, and changing only the house system turns each chart into the other, in both directions. A version, checksum or source inside a record is the record\'s claim about itself, and nothing here authenticates it.',
  '## Dates',
  'Requests are accepted from 1800 to 2199. That is the range the rest of Zodiacs supports, not a range in which every date has been checked: the engine\'s records state `broadDateRange: "not-certified"`.',
  '## Citing a result',
  'Every result other than a refusal carries `cite`: `url`, the tool\'s entry on the developer page; `receipt`, `sha256:` and the SHA-256 of a receipt\'s RFC 8785 canonical JSON; and the engine and its version. A chart cites the engine\'s calculation receipt, which the record carries. That receipt holds the instant as it was written, offset included, the coordinates and the settings, so its digest identifies the birth details from either side: with the date and the place, trying each time of day finds the time; with the instant, which the positions give away, trying places from a list of towns finds the place, even for a chart with no known time, whose summary shows no angle, cusp or coordinate. With `timeKnown: false` the coordinates change nothing else in the result, so leaving them out keeps them out of the receipt. Quote the digest only where the birth details may be known. A comparison and the capabilities reply cite the adapter\'s own receipt, which they carry and which holds nothing from a record.',
]);

export function methodology(): string {
  return [
    '# How this server calculates',
    '',
    `${ADAPTER_NAME} ${ADAPTER_VERSION} runs @zodiacs/engine ${ENGINE_VERSION}, with astronomy-engine ${EPHEMERIS.version}, on the machine it runs on.`,
    'The site\'s methodology page, https://zodiacs.org/methodology/, describes the same engine as the site\'s calculators use it, and https://zodiacs.org/developers/engine/ reports how far its results were from other software in dated measurements. This text says what the three tools do with it.',
    '',
    ...METHODOLOGY_SECTIONS.flatMap((section) => [section, '']),
  ].join('\n');
}

export interface ResourceDefinition {
  readonly name: string;
  readonly uri: string;
  readonly title: string;
  readonly description: string;
  readonly mimeType: string;
  readonly read: () => string;
}

export const RESOURCES: readonly ResourceDefinition[] = Object.freeze([
  {
    name: 'conventions',
    uri: CONVENTIONS_URI,
    title: 'Calculation conventions',
    description: 'The conventions vocabulary of the calculation records this server writes and reads: every set a record may carry and the engine versions that wrote it, what each key covers, the coverage statement, and what each chart flag reports.',
    mimeType: 'application/json',
    read: () => `${JSON.stringify(conventionsVocabulary(), null, 1)}\n`,
  },
  {
    name: 'methodology',
    uri: METHODOLOGY_URI,
    title: 'How this server calculates',
    description: 'What a chart holds, how an instant is read, unknown birth times, house systems, aspects, comparisons, the accepted dates, and what a result cites.',
    mimeType: 'text/markdown',
    read: methodology,
  },
]);
