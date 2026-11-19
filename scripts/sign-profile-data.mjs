// Human context for the twelve Registry profiles. The People slugs are checked
// against src/data/people.json by build-sign-pages.mjs before any page is
// written, so a broken or misclassified profile fails the build.
export const SIGN_PROFILE_PEOPLE = Object.freeze({
  aries: ['aretha-franklin', 'lisa', 'charlie-chaplin', 'vincent-van-gogh'],
  taurus: ['audrey-hepburn', 'sabrina-carpenter', 'karl-marx', 'mrbeast'],
  gemini: ['marilyn-monroe', 'prince', 'judy-garland', 'kendrick-lamar'],
  cancer: ['alan-turing', 'frida-kahlo', 'nelson-mandela', 'erling-haaland'],
  leo: ['alfred-hitchcock', 'amelia-earhart', 'andy-warhol', 'kylie-jenner'],
  virgo: ['freddie-mercury', 'amy-winehouse', 'mary-shelley', 'zendaya'],
  libra: ['john-lennon', 'mahatma-gandhi', 'max-verstappen', 'jenna-ortega'],
  scorpio: ['marie-curie', 'pablo-picasso', 'bill-gates', 'leonardo-dicaprio'],
  sagittarius: ['bruce-lee', 'jane-austen', 'taylor-swift', 'tina-turner'],
  capricorn: ['david-bowie', 'elvis-presley', 'martin-luther-king-jr', 'timothee-chalamet'],
  aquarius: ['bob-marley', 'harry-styles', 'rosa-parks', 'wolfgang-amadeus-mozart'],
  pisces: ['albert-einstein', 'rihanna', 'bad-bunny', 'olivia-rodrigo'],
});

// One short line of sign pride for each Registry profile. These are rally
// lines, not factual personality claims, so they stay concise and clearly
// editorial rather than pretending to describe every person born under a sign.
export const SIGN_PROFILE_RALLY_LINES = Object.freeze({
  aries: 'Aries is ready to begin.',
  taurus: 'Taurus holds steady.',
  gemini: 'Gemini always finds another angle.',
  cancer: 'Cancer keeps its people close.',
  leo: 'Leo brings the room to life.',
  virgo: 'Virgo notices what others miss.',
  libra: 'Libra knows balance takes work.',
  scorpio: 'Scorpio never does anything halfway.',
  sagittarius: 'Sagittarius keeps looking beyond the horizon.',
  capricorn: 'Capricorn keeps climbing.',
  aquarius: 'Aquarius sees another way.',
  pisces: 'Pisces feels the current.',
});

export function validateSignProfileRallyLines(signs) {
  const errors = [];
  const expected = [...signs];
  const actual = Object.keys(SIGN_PROFILE_RALLY_LINES);
  const missing = expected.filter((sign) => !actual.includes(sign));
  const extra = actual.filter((sign) => !expected.includes(sign));
  if (missing.length) errors.push(`Missing rally lines: ${missing.join(', ')}`);
  if (extra.length) errors.push(`Unexpected rally lines: ${extra.join(', ')}`);

  const seen = new Set();
  for (const sign of expected) {
    const line = SIGN_PROFILE_RALLY_LINES[sign];
    const name = sign.charAt(0).toUpperCase() + sign.slice(1);
    if (typeof line !== 'string' || line !== line.trim() || line.length < 16 || line.length > 72) {
      errors.push(`${sign}: rally line must be a trimmed string between 16 and 72 characters`);
      continue;
    }
    if (!line.startsWith(`${name} `)) errors.push(`${sign}: rally line must begin with “${name}”`);
    if (!/[.!?]$/u.test(line)) errors.push(`${sign}: rally line must end with punctuation`);
    if (seen.has(line)) errors.push(`${sign}: rally line must be unique`);
    seen.add(line);
  }
  return errors;
}

// Living People profiles are protected by default. These are the only
// owner-authorized exceptions (2026-08-16 and 2026-11-18), each only as a
// direct nofollow link from its own sign's Registry profile. The page builder
// also checks this allowlist against the reviewed People index policy before
// emitting any page.
export const SIGN_PROFILE_PROTECTED_LINKS = Object.freeze({
  'bill-gates': Object.freeze({
    sign: 'scorpio',
    surface: '/registry/scorpio/',
    rel: 'nofollow',
  }),
  'leonardo-dicaprio': Object.freeze({
    sign: 'scorpio',
    surface: '/registry/scorpio/',
    rel: 'nofollow',
  }),
  'lisa': Object.freeze({
    sign: 'aries',
    surface: '/registry/aries/',
    rel: 'nofollow',
  }),
  'sabrina-carpenter': Object.freeze({
    sign: 'taurus',
    surface: '/registry/taurus/',
    rel: 'nofollow',
  }),
  'mrbeast': Object.freeze({
    sign: 'taurus',
    surface: '/registry/taurus/',
    rel: 'nofollow',
  }),
  'kendrick-lamar': Object.freeze({
    sign: 'gemini',
    surface: '/registry/gemini/',
    rel: 'nofollow',
  }),
  'erling-haaland': Object.freeze({
    sign: 'cancer',
    surface: '/registry/cancer/',
    rel: 'nofollow',
  }),
  'kylie-jenner': Object.freeze({
    sign: 'leo',
    surface: '/registry/leo/',
    rel: 'nofollow',
  }),
  'zendaya': Object.freeze({
    sign: 'virgo',
    surface: '/registry/virgo/',
    rel: 'nofollow',
  }),
  'max-verstappen': Object.freeze({
    sign: 'libra',
    surface: '/registry/libra/',
    rel: 'nofollow',
  }),
  'jenna-ortega': Object.freeze({
    sign: 'libra',
    surface: '/registry/libra/',
    rel: 'nofollow',
  }),
  'taylor-swift': Object.freeze({
    sign: 'sagittarius',
    surface: '/registry/sagittarius/',
    rel: 'nofollow',
  }),
  'timothee-chalamet': Object.freeze({
    sign: 'capricorn',
    surface: '/registry/capricorn/',
    rel: 'nofollow',
  }),
  'harry-styles': Object.freeze({
    sign: 'aquarius',
    surface: '/registry/aquarius/',
    rel: 'nofollow',
  }),
  'bad-bunny': Object.freeze({
    sign: 'pisces',
    surface: '/registry/pisces/',
    rel: 'nofollow',
  }),
  'rihanna': Object.freeze({
    sign: 'pisces',
    surface: '/registry/pisces/',
    rel: 'nofollow',
  }),
  'olivia-rodrigo': Object.freeze({
    sign: 'pisces',
    surface: '/registry/pisces/',
    rel: 'nofollow',
  }),
});

export function registryProfilePersonLinkRel({ sign, person, policyAuthorization }) {
  const protectedAuthorization = SIGN_PROFILE_PROTECTED_LINKS[person.slug] ?? null;
  if (person.indexEligibility?.eligible) {
    if (person.living || protectedAuthorization) {
      throw new Error(`${person.slug}: protected-link authorization and People eligibility disagree`);
    }
    return null;
  }

  const policyProfiles = policyAuthorization?.profiles ?? [];
  if (
    !person.living
    || !protectedAuthorization
    || protectedAuthorization.sign !== sign
    || protectedAuthorization.surface !== `/registry/${sign}/`
    || protectedAuthorization.rel !== 'nofollow'
    || policyAuthorization?.surfaces?.[person.slug] !== protectedAuthorization.surface
    || !policyProfiles.includes(person.slug)
  ) {
    throw new Error(
      `${person.slug}: protected/non-indexable People records require exact, surface-specific authorization`
    );
  }
  return 'nofollow';
}
