import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import EvidenceDisclosure from './EvidenceDisclosure';
import { BirthFields, birthDateForChart, type CalendarChoice } from './BirthFields';
import type { City } from '../lib/geo/search';
import { pairSlug } from '../lib/compat';
import { decodeChartLink, NAME_MAX, type ShareChartInput } from '../lib/share';
import { decodePositionsLink, type PositionsShareChart } from '../lib/share-positions';
import {
  chartHandoffFragment,
  compatibilityHandoffPath,
  mineHandoffFromHash,
  profileHandoffOriginsFromHash,
  type MineHandoff,
} from '../lib/chart-handoff';
import { useProfile } from '../lib/hooks/useProfile';
import { useProfileAccessGeneration } from '../lib/hooks/useProfileAccessGeneration';
import { bigThree } from '../lib/interpretations';
import { SIGNS, SIGN_SLUGS, signBySlug, signForLongitude, signName } from '../lib/signs';
import { signIcon } from '../lib/sign-icon';
import '../styles/someone-else.css';

type EntryMode = 'details' | 'big-three' | 'link';
type SharedChart =
  | { kind: 'details'; token: string; input: ShareChartInput }
  | { kind: 'positions'; token: string; chart: PositionsShareChart };

const BIRTH_CHART_PATH_RE = /^\/(?:(?:es|pt|fr|it)\/)?birth-chart\/?$/;

function isSign(value: string): boolean {
  return SIGN_SLUGS.includes(value);
}

/** Strictly accept a Zodiacs birth-chart URL with exactly one supported token. */
export function parseSharedChartUrl(value: string, currentOrigin = 'https://zodiacs.org'): SharedChart | null {
  try {
    const url = new URL(value.trim());
    const current = new URL(currentOrigin);
    const allowedHost = url.hostname === 'zodiacs.org'
      || url.hostname === 'www.zodiacs.org'
      || url.hostname === current.hostname;
    if (!allowedHost || !BIRTH_CHART_PATH_RE.test(url.pathname)) return null;

    const fragment = new URLSearchParams(url.hash.slice(1));
    const detailTokens = fragment.getAll('c');
    const positionTokens = fragment.getAll('p');
    const subjectValues = fragment.getAll('subject');
    const knownEntries = detailTokens.length + positionTokens.length + subjectValues.length;
    if (knownEntries !== fragment.size || detailTokens.length + positionTokens.length !== 1) return null;
    if (subjectValues.length > 1 || (subjectValues.length === 1 && subjectValues[0] !== 'other')) return null;

    if (detailTokens.length === 1) {
      const input = decodeChartLink(detailTokens[0]);
      return input ? { kind: 'details', token: detailTokens[0], input } : null;
    }
    const chart = decodePositionsLink(positionTokens[0]);
    return chart ? { kind: 'positions', token: positionTokens[0], chart } : null;
  } catch {
    return null;
  }
}

export function comparisonPath(ownSun: string | null, theirSun: string): string {
  if (!isSign(theirSun)) return '/compatibility/#calculator';
  if (!ownSun || !isSign(ownSun)) return '/compatibility/#calculator';
  return `/compatibility/${pairSlug(ownSun, theirSun)}/`;
}

export function bigThreeFromPositions(chart: PositionsShareChart): {
  sun: string;
  moon: string;
  rising: string | null;
} {
  const sun = chart.bodies.find((body) => body.body === 'Sun');
  const moon = chart.bodies.find((body) => body.body === 'Moon');
  return {
    sun: signForLongitude(sun?.lon ?? 0).slug,
    moon: signForLongitude(moon?.lon ?? 0).slug,
    rising: chart.angles ? signForLongitude(chart.angles.asc).slug : null,
  };
}

export function manualBigThreeReadings(input: {
  sun: string;
  moon?: string;
  rising?: string;
}): Array<{
  kind: 'sun' | 'moon' | 'rising';
  role: string;
  slug: string;
  reading: string;
}> {
  const placements = [
    { kind: 'sun' as const, role: 'Core identity', slug: input.sun },
    { kind: 'moon' as const, role: 'Emotional needs', slug: input.moon ?? '' },
    { kind: 'rising' as const, role: 'First impression', slug: input.rising ?? '' },
  ];
  return placements
    .filter((placement) => isSign(placement.slug))
    .map((placement) => ({
      ...placement,
      reading: bigThree(placement.kind, placement.slug),
    }));
}

function displayPlace(city: City): string {
  return [city.name, city.admin1, city.country].filter(Boolean).join(', ');
}

function go(path: string): void {
  window.location.assign(path);
}

function SignPreview({ role, slug }: { role: string; slug: string | null }) {
  if (!slug || !isSign(slug)) {
    return (
      <li class="other-chart__sign other-chart__sign--unknown">
        <span class="other-chart__sign-disc" aria-hidden="true">?</span>
        <span><small>{role}</small><strong>Not known</strong></span>
      </li>
    );
  }
  const sign = signBySlug(slug);
  return (
    <li class="other-chart__sign" style={`--sign:${sign.hue}`}>
      <picture class="other-chart__sign-disc" aria-hidden="true">
        <img src={signIcon(48, slug)} width="42" height="42" alt="" />
      </picture>
      <span><small>{role}</small><strong>{signName(sign)}</strong></span>
    </li>
  );
}

function SignSelect({
  id,
  label,
  value,
  required = false,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  required?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <div class="other-chart__select-field">
      <label for={id}>{label}</label>
      <select
        id={id}
        required={required}
        value={value}
        onChange={(event) => onChange((event.currentTarget as HTMLSelectElement).value)}
      >
        <option value="">{required ? 'Choose a sign' : 'Not known'}</option>
        {SIGNS.map((sign) => <option key={sign.slug} value={sign.slug}>{sign.name}</option>)}
      </select>
    </div>
  );
}

export default function SomeoneElseChart() {
  const [mode, setMode] = useState<EntryMode>('details');
  const [name, setName] = useState('');
  const [consent, setConsent] = useState(false);
  const [date, setDate] = useState('');
  const [calendar, setCalendar] = useState<CalendarChoice>('gregorian');
  const [dateError, setDateError] = useState('');
  const [time, setTime] = useState('');
  const [timeKnown, setTimeKnown] = useState(true);
  const [city, setCity] = useState<City | null>(null);
  const [houseSystem, setHouseSystem] = useState<'whole' | 'placidus'>('whole');
  const [sun, setSun] = useState('');
  const [moon, setMoon] = useState('');
  const [rising, setRising] = useState('');
  const [manualOwnSun, setManualOwnSun] = useState('');
  const [sharedUrl, setSharedUrl] = useState('');
  const [shared, setShared] = useState<SharedChart | null>(null);
  const [linkError, setLinkError] = useState('');
  const [manualReadOpen, setManualReadOpen] = useState(false);
  const [currentMine, setCurrentMine] = useState<MineHandoff | null>(null);
  const [pendingProfileMineId, setPendingProfileMineId] = useState<string | null>(null);
  const currentMineProfileOrigin = useRef(false);
  const manualReadHeading = useRef<HTMLHeadingElement>(null);
  const { profile, ready: profileReady } = useProfile();
  useProfileAccessGeneration(() => {
    if (!currentMineProfileOrigin.current) return;
    currentMineProfileOrigin.current = false;
    setCurrentMine(null);
  });

  const latestChart = useMemo(() => profile.charts.reduce((latest, chart) => (
    !latest || chart.updatedAt > latest.updatedAt ? chart : latest
  ), profile.charts[0] ?? null), [profile]);
  const savedOwnSun = useMemo(() => {
    const position = latestChart?.summary.bodies.find((body) => body.body === 'Sun');
    return position ? signForLongitude(position.lon).slug : null;
  }, [latestChart]);
  const ownSun = savedOwnSun ?? (isSign(manualOwnSun) ? manualOwnSun : null);
  const comparisonMine = currentMine ?? (!pendingProfileMineId && latestChart
    ? { kind: 'saved' as const, id: latestChart.id }
    : null);
  const comparisonMineProfileOrigin = currentMine !== null
    ? currentMineProfileOrigin.current
    : pendingProfileMineId === null && latestChart !== null;
  const manualReadings = useMemo(
    () => manualBigThreeReadings({ sun, moon, rising }),
    [sun, moon, rising],
  );

  useEffect(() => {
    setLinkError('');
  }, [mode]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.slice(1));
    if (!params.has('mine') && !params.has('mineId')) return;
    const mine = mineHandoffFromHash(window.location.hash);
    const profileOrigin = profileHandoffOriginsFromHash(window.location.hash).mine;
    if (profileOrigin && mine?.kind === 'saved') {
      setPendingProfileMineId(mine.id);
    } else {
      currentMineProfileOrigin.current = false;
      setCurrentMine(mine);
    }
    history.replaceState(null, '', window.location.pathname + window.location.search);
  }, []);

  useEffect(() => {
    const id = pendingProfileMineId;
    if (!profileReady || !id) return;
    setPendingProfileMineId(null);
    if (!profile.charts.some((chart) => chart.id === id)) return;
    currentMineProfileOrigin.current = true;
    setCurrentMine({ kind: 'saved', id });
  }, [pendingProfileMineId, profile, profileReady]);

  const permission = (
    <label class="other-chart__permission">
      <input
        type="checkbox"
        checked={consent}
        onChange={(event) => setConsent((event.currentTarget as HTMLInputElement).checked)}
      />
      <span>
        <strong>I have their permission to use this information.</strong>
        <small>Birth details are personal. Only enter or paste what this person chose to share with you.</small>
      </span>
    </label>
  );

  /** Their details for the handoff, with a date before 1924 read in its calendar first. */
  async function fullDetailsInput(): Promise<ShareChartInput | null> {
    if (!consent || !date || !city || (timeKnown && !time)) return null;
    const entry = await birthDateForChart('en', date, calendar);
    if ('error' in entry) {
      setDateError(entry.error);
      return null;
    }
    return {
      date: entry.date,
      time: timeKnown ? time : null,
      timeKnown,
      lat: city.lat,
      lon: city.lon,
      tz: city.tz,
      place: displayPlace(city),
      houseSystem,
      ...(name.trim() ? { name: name.trim() } : {}),
    };
  }

  async function openFullChart(event: Event) {
    event.preventDefault();
    const input = await fullDetailsInput();
    if (!input) return;
    go(`/birth-chart/#${chartHandoffFragment(input, {
      subjectMode: 'other',
      mine: comparisonMine,
      mineProfileOrigin: comparisonMineProfileOrigin,
    })}`);
  }

  async function compareFullChart() {
    const input = await fullDetailsInput();
    if (!input) return;
    go(compatibilityHandoffPath(input, comparisonMine));
  }

  function validateSharedLink(event: Event) {
    event.preventDefault();
    const parsed = parseSharedChartUrl(sharedUrl, window.location.origin);
    setShared(parsed);
    setLinkError(parsed ? '' : 'Paste a complete Zodiacs birth-chart link with valid chart details or positions.');
  }

  const sharedBigThree = shared?.kind === 'positions' ? bigThreeFromPositions(shared.chart) : null;
  const theirComparisonSun = mode === 'big-three' ? sun : sharedBigThree?.sun ?? '';
  const compareHref = comparisonPath(ownSun, theirComparisonSun);

  function openSharedChart() {
    if (!shared || !consent) return;
    if (shared.kind === 'positions') {
      go(`/birth-chart/#p=${shared.token}&subject=other`);
      return;
    }
    const input = name.trim()
      ? { ...shared.input, name: name.trim() }
      : shared.input;
    go(`/birth-chart/#${chartHandoffFragment(input, {
      subjectMode: 'other',
      mine: comparisonMine,
      mineProfileOrigin: comparisonMineProfileOrigin,
    })}`);
  }

  function compareSharedDetails() {
    if (!shared || shared.kind !== 'details' || !consent) return;
    const input = name.trim()
      ? { ...shared.input, name: name.trim() }
      : shared.input;
    go(compatibilityHandoffPath(input, comparisonMine));
  }

  function openManualReading() {
    if (!consent || !sun) return;
    setManualReadOpen(true);
    requestAnimationFrame(() => manualReadHeading.current?.focus());
  }

  return (
    <div class="other-chart" data-someone-else>
      <section class="other-chart__setup shell" aria-labelledby="other-chart-setup-title">
        <div class="other-chart__setup-core core">
          <div class="other-chart__identity">
            <label for="other-chart-name">Their name <span>(optional)</span></label>
            <input
              id="other-chart-name"
              type="text"
              maxlength={NAME_MAX}
              autocomplete="off"
              value={name}
              onInput={(event) => setName((event.currentTarget as HTMLInputElement).value)}
              placeholder="A first name or nickname"
            />
            <p>Names stay in this browser unless you intentionally include one in a full-details link. The birth details stay in this browser unless you share them.</p>
          </div>

          <fieldset class="other-chart__mode">
            <legend id="other-chart-setup-title">What did they share with you?</legend>
            <div class="other-chart__mode-grid">
              {([
                ['details', 'Birth details', 'Date, time, and birthplace'],
                ['big-three', 'Their Big Three', 'Sun, Moon, and Rising signs'],
                ['link', 'A Zodiacs link', 'Full details or positions only'],
              ] as const).map(([value, label, help]) => (
                <button
                  key={value}
                  type="button"
                  class="other-chart__mode-button"
                  aria-pressed={mode === value}
                  onClick={() => setMode(value)}
                >
                  <strong>{label}</strong>
                  <span>{help}</span>
                </button>
              ))}
            </div>
          </fieldset>
          {currentMine && (
            <p class="other-chart__saved-context" role="status">
              Your current chart is ready to use when you choose “Compare with mine.”
            </p>
          )}
        </div>
      </section>

      {mode === 'details' && (
        <form class="other-chart__panel shell" onSubmit={openFullChart} data-entry-mode="details">
          <div class="other-chart__panel-core core">
            <header>
              <span class="other-chart__step">Most complete</span>
              <h2>Use their birth details</h2>
              <p>Get their full chart — houses, angles, aspects, and a guided reading — or compare it with yours.</p>
            </header>
            <div class="other-chart__birth-fields">
              <BirthFields
                locale="en"
                dateId="other-birth-date"
                timeId="other-birth-time"
                placeId="other-birth-place"
                date={date}
                time={time}
                timeKnown={timeKnown}
                city={city}
                onDateChange={(value) => { setDate(value); setDateError(''); }}
                calendar={calendar}
                onCalendarChange={(value) => { setCalendar(value); setDateError(''); }}
                dateError={dateError || undefined}
                onTimeChange={setTime}
                onTimeKnownChange={setTimeKnown}
                onCityChange={setCity}
                requireKnownTime
                timeHelp="An exact time gives the Rising sign and houses. Choose “I don’t know it” if needed."
                placeHelp="Search for the city where they were born."
              />
              <div class="field other-chart__house-system">
                <label class="field__label" for="other-house-system">House system</label>
                <select
                  id="other-house-system"
                  class="field__input"
                  value={houseSystem}
                  onChange={(event) => setHouseSystem((event.currentTarget as HTMLSelectElement).value as 'whole' | 'placidus')}
                >
                  <option value="whole">Whole sign (default)</option>
                  <option value="placidus">Placidus</option>
                </select>
                <p class="field__help">You can change this again on the chart.</p>
              </div>
            </div>
            {permission}
            <div class="other-chart__actions">
              <button
                class="btn btn--primary other-chart__primary"
                type="submit"
                disabled={!consent || !date || !city || (timeKnown && !time)}
              >
                <span>Open their full chart</span><span class="orb" aria-hidden="true">→</span>
              </button>
              <button
                class="btn btn--ghost"
                type="button"
                disabled={!consent || !date || !city || (timeKnown && !time)}
                onClick={compareFullChart}
              >
                <span>{comparisonMine ? 'Compare with mine' : 'Add my chart to compare'}</span>
              </button>
            </div>
            <EvidenceDisclosure label="How their information is handled">
              <p>The handoff uses a URL fragment, which is not sent to the site’s server. The chart removes it from the address bar after reading it.</p>
            </EvidenceDisclosure>
          </div>
        </form>
      )}

      {mode === 'big-three' && (
        <section class="other-chart__panel shell" data-entry-mode="big-three">
          <div class="other-chart__panel-core core">
            <header>
              <span class="other-chart__step">A useful starting point</span>
              <h2>Enter what you already know</h2>
              <p>The Sun is enough for a quick pairing guide. Moon and Rising add context, but they cannot recreate a full birth chart.</p>
            </header>
            <div class="other-chart__select-grid">
              <SignSelect id="other-sun" label="Their Sun sign" value={sun} required onChange={setSun} />
              <SignSelect id="other-moon" label="Their Moon sign (optional)" value={moon} onChange={setMoon} />
              <SignSelect id="other-rising" label="Their Rising sign (optional)" value={rising} onChange={setRising} />
            </div>
            {sun && (
              <ul class="other-chart__signs" aria-label={`${name.trim() || 'Their'} Big Three`}>
                <SignPreview role="Sun" slug={sun} />
                <SignPreview role="Moon" slug={moon || null} />
                <SignPreview role="Rising" slug={rising || null} />
              </ul>
            )}
            {!savedOwnSun && profileReady && (
              <div class="other-chart__own-sign">
                <SignSelect id="own-sun" label="Your Sun sign (optional, for a pairing guide)" value={manualOwnSun} onChange={setManualOwnSun} />
              </div>
            )}
            {savedOwnSun && (
              <p class="other-chart__saved-context">Using your most recently saved chart: {signName(signBySlug(savedOwnSun))} Sun.</p>
            )}
            {permission}
            <div class="other-chart__actions">
              <button
                class="btn btn--primary other-chart__primary"
                type="button"
                disabled={!consent || !sun}
                onClick={openManualReading}
              >
                <span>Read their chart</span>
                <span class="orb" aria-hidden="true">→</span>
              </button>
              <button
                class="btn btn--ghost"
                type="button"
                disabled={!consent || !sun}
                onClick={() => go(compareHref)}
              >
                <span>{ownSun ? 'Compare your Sun signs' : 'Open compatibility'}</span>
              </button>
            </div>
            {manualReadOpen && consent && (
              <article class="other-chart__manual-profile" aria-labelledby="other-chart-manual-title">
                <header>
                  <span class="other-chart__step">Limited sign profile</span>
                  <h3 id="other-chart-manual-title" ref={manualReadHeading} tabIndex={-1}>
                    {name.trim() ? `${name.trim()}’s Big Three` : 'Their Big Three'}
                  </h3>
                  <p>
                    These readings speak directly to the person whose signs they are, so you can read them together.
                  </p>
                </header>
                <div class="other-chart__reading-grid">
                  {manualReadings.map((placement) => {
                    const sign = signBySlug(placement.slug);
                    const placementLabel = placement.kind === 'rising'
                      ? 'Rising'
                      : placement.kind[0].toUpperCase() + placement.kind.slice(1);
                    return (
                      <section class="other-chart__reading" key={placement.kind} style={`--sign:${sign.hue}`}>
                        <div class="other-chart__reading-title">
                          <div class="other-chart__reading-sign">
                            <picture class="other-chart__sign-disc" aria-hidden="true">
                              <img src={signIcon(48, placement.slug)} width="42" height="42" alt="" />
                            </picture>
                            <span><small>{placementLabel}</small><strong>{signName(sign)}</strong></span>
                          </div>
                          <span>{placement.role}</span>
                        </div>
                        <p>{placement.reading}</p>
                        <a href={`/signs/${placement.slug}/`}>Read {signName(sign)} →</a>
                      </section>
                    );
                  })}
                </div>
                <footer>
                  <strong>What this cannot show</strong>
                  <p>No houses, aspects, exact degrees, or timing are inferred. Those require complete birth details or a valid chart link.</p>
                </footer>
              </article>
            )}
            <p class="other-chart__privacy">No birth details are invented from these signs. A full chart or full compatibility reading still needs complete birth information.</p>
          </div>
        </section>
      )}

      {mode === 'link' && (
        <section class="other-chart__panel shell" data-entry-mode="link">
          <div class="other-chart__panel-core core">
            <header>
              <span class="other-chart__step">Fastest</span>
              <h2>Use the link they sent</h2>
              <p>Paste a Zodiacs birth-chart link. Full-details links and positions-only links both work.</p>
            </header>
            <form class="other-chart__link-form" onSubmit={validateSharedLink}>
              <label for="other-chart-link">Zodiacs chart link</label>
              <div>
                <input
                  id="other-chart-link"
                  type="url"
                  required
                  value={sharedUrl}
                  onInput={(event) => {
                    setSharedUrl((event.currentTarget as HTMLInputElement).value);
                    setShared(null);
                    setLinkError('');
                  }}
                  placeholder="https://zodiacs.org/birth-chart/#…"
                />
                <button class="btn btn--ghost" type="submit"><span>Check link</span></button>
              </div>
            </form>
            {linkError && <p class="other-chart__error" role="alert">{linkError}</p>}
            {shared && (
              <div class="other-chart__link-result" role="status">
                <span class="other-chart__valid" aria-hidden="true">✓</span>
                <div>
                  <strong>{shared.kind === 'details' ? 'Full-details chart recognized' : 'Positions-only chart recognized'}</strong>
                  <p>{shared.kind === 'details'
                    ? `Includes a ${shared.input.timeKnown ? 'known' : 'missing'} birth time. The details stay inside the link fragment.`
                    : shared.chart.angles
                      ? 'The link has no name, date, time or place fields. Its exact positions still give their birth date and time, and their birthplace roughly: an area about 110 km wide and hundreds of kilometres long near the equator, smaller nearer the poles, and near the Arctic Circle sometimes a strip less than a kilometre from north to south.'
                      : 'The link has no name, date, time or place fields. With no birth time, its positions give their birth date.'}</p>
                </div>
              </div>
            )}
            {sharedBigThree && (
              <ul class="other-chart__signs" aria-label="Big Three found in the shared positions">
                <SignPreview role="Sun" slug={sharedBigThree.sun} />
                <SignPreview role="Moon" slug={sharedBigThree.moon} />
                <SignPreview role="Rising" slug={sharedBigThree.rising} />
              </ul>
            )}
            {shared?.kind === 'positions' && !savedOwnSun && profileReady && (
              <div class="other-chart__own-sign">
                <SignSelect id="link-own-sun" label="Your Sun sign (optional, for a pairing guide)" value={manualOwnSun} onChange={setManualOwnSun} />
              </div>
            )}
            {permission}
            <div class="other-chart__actions">
              <button class="btn btn--primary" type="button" disabled={!shared || !consent} onClick={openSharedChart}>
                <span>Open their chart</span><span class="orb" aria-hidden="true">→</span>
              </button>
              {shared?.kind === 'details' ? (
                <button class="btn btn--ghost" type="button" disabled={!consent} onClick={compareSharedDetails}>
                  <span>{comparisonMine ? 'Compare with mine' : 'Add my chart to compare'}</span>
                </button>
              ) : sharedBigThree ? (
                <button class="btn btn--ghost" type="button" disabled={!consent} onClick={() => go(compareHref)}>
                  <span>{ownSun ? 'Read your Sun-sign pairing' : 'Open compatibility'}</span>
                </button>
              ) : null}
            </div>
            {shared?.kind === 'positions' && (
              <p class="other-chart__privacy">A positions-only link opens here as a read-only chart. The current full-chart comparison accepts saved charts or full-details links; the Sun-sign guide remains available without inventing missing data.</p>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
