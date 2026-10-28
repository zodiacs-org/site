/**
 * The developer demo (/developers/demo/): pick one of three questions and read
 * the real answer, its JSON, the cURL command and MCP call that ask the same
 * question, and how the answer was checked.
 *
 * The answers it opens with are src/data/developer-demo.json, which
 * scripts/build-developer-demo.ts writes with the compute API's own code and
 * the hosted get_compatibility tool. An edited birth chart or Mercury date runs
 * in this browser with the playground's bundle of the compute API
 * (public/developers/playground/engine.mjs), loaded only when asked. Nothing
 * here sends a request to the API: tests/api/compute-api-privacy.test.ts holds
 * it to that.
 */
import { useState } from 'preact/hooks';
import demo from '../data/developer-demo.json';
import type { City } from '../lib/geo/rank';
import { PLAYGROUND_ENGINE_PATH, PLAYGROUND_PATH } from '../lib/developer-playground';
import {
  CHART_PRESET,
  MERCURY_MAX_WINDOWS,
  MERCURY_PRESET,
  MERCURY_WINDOW_DAYS,
  QUESTION_IDS,
  QUESTION_LABELS,
  capitalize,
  chartBody,
  computeCurl,
  longDate,
  mcpCall,
  mcpCurl,
  mercuryAnswered,
  mercuryBody,
  mercuryStations,
  offsetLabel,
  position,
  pretty,
  utcMinute,
  type ChartInput,
  type QuestionId,
  type Station,
} from '../lib/developer-demo';
import PlaceSearch from './PlaceSearch';

/* eslint-disable @typescript-eslint/no-explicit-any -- the answers are the API's JSON, read field by field */
type Json = any;

interface Engine {
  answerHere(endpoint: string, text: string): Promise<{ status: number; body: Json }>;
}

let engineLoad: Promise<Engine> | null = null;
function loadEngine(): Promise<Engine> {
  engineLoad ??= import(/* @vite-ignore */ PLAYGROUND_ENGINE_PATH).catch((error) => {
    engineLoad = null;
    throw error;
  });
  return engineLoad;
}

const PRESET_CITY: City = {
  name: 'Paris',
  admin1: 'Île-de-France',
  country: 'France',
  lat: CHART_PRESET.latitude,
  lon: CHART_PRESET.longitude,
  tz: CHART_PRESET.zone,
  pop: 0,
};

const ENGINE_NOTE = 'The first run loads the compute API’s own calculations into this page, about 155 KB compressed. Nothing is sent.';

function refusal(body: Json): string {
  return body?.error?.message ?? 'The engine refused this request.';
}

function engineLine(receipt: Json): string {
  const engine = receipt?.engine;
  return engine ? `${engine.name} ${engine.version} with ${engine.ephemeris.name} ${engine.ephemeris.version}` : 'the engine';
}

function runtimeLine(receipt: Json): string {
  const runtime = receipt?.provenance?.runtime;
  if (!runtime) return 'the runtime that computed it';
  return runtime.tzdbVersion ? `${runtime.name === 'node' ? 'Node' : runtime.name} with tzdb ${runtime.tzdbVersion}` : 'this browser';
}

function Code({ label, text }: { label: string; text: string }) {
  return <pre class="demo__pre" tabindex={0} role="region" aria-label={label}><code>{text}</code></pre>;
}

function JsonResponse({ value, label }: { value: unknown; label: string }) {
  return (
    <details class="demo__json" data-json>
      <summary>{label}</summary>
      <Code label={label} text={pretty(value)} />
    </details>
  );
}

function Sample({ computedHere, onReset }: { computedHere: boolean; onReset: () => void }) {
  return (
    <p class="demo__note" data-source={computedHere ? 'browser' : 'build'}>
      {computedHere
        ? 'Computed in this browser with the compute API’s own code.'
        : 'Computed with the compute API’s own code when this page was built.'}
      {computedHere && (
        <>
          {' '}
          <button type="button" class="demo__link" onClick={onReset} data-reset>Back to the sample</button>
        </>
      )}
    </p>
  );
}

// ── Birth chart ─────────────────────────────────────────────────────

const BODY_ORDER = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto'];

function ChartAnswer({ input, answer }: { input: ChartInput; answer: Json }) {
  const result = answer.result;
  const bodies: Json[] = result.bodies.filter((row: Json) => BODY_ORDER.includes(row.body));
  const sun = bodies.find((row) => row.body === 'Sun');
  const moon = bodies.find((row) => row.body === 'Moon');
  const flags: string[] = result.local?.flags ?? [];
  return (
    <div class="demo__answer" data-answer="chart">
      <p class="demo__lead">
        On {longDate(input.date)} at {input.time} in {input.place} ({offsetLabel(result.local.offsetMinutes)}, which
        is {utcMinute(result.instant)}), the Sun was at {position(sun.lon)}, the Moon at {position(moon.lon)} and the
        Ascendant at {position(result.angles.asc)}.
      </p>
      {flags.length > 0 && (
        <p class="demo__note" data-flags>The local time carries the flags {flags.join(', ')}; the receipt says how it was read.</p>
      )}
      <div class="demo__table-wrap" tabindex={0} role="region" aria-label="Positions">
        <table class="demo__table">
          <thead>
            <tr><th scope="col">Body</th><th scope="col">Position</th><th scope="col">Motion</th></tr>
          </thead>
          <tbody>
            {bodies.map((row) => (
              <tr key={row.body}>
                <th scope="row">{row.body}</th>
                <td class="mono">{position(row.lon)}</td>
                <td>{row.retrograde ? 'Retrograde' : 'Direct'}</td>
              </tr>
            ))}
            <tr><th scope="row">Ascendant</th><td class="mono">{position(result.angles.asc)}</td><td /></tr>
            <tr><th scope="row">Midheaven</th><td class="mono">{position(result.angles.mc)}</td><td /></tr>
          </tbody>
        </table>
      </div>
      <p class="demo__note">
        Whole-sign houses, so the first house is the Ascendant&rsquo;s sign. The chart has {result.aspects.length} major
        aspects between the Sun, the Moon and the eight planets; the JSON lists them with their orbs.
      </p>
    </div>
  );
}

function ChartQuestion() {
  const [input, setInput] = useState<ChartInput>(demo.chart.input);
  const [date, setDate] = useState(CHART_PRESET.date);
  const [time, setTime] = useState(CHART_PRESET.time);
  const [city, setCity] = useState<City | null>(PRESET_CITY);
  const [answer, setAnswer] = useState<Json>(demo.chart.answer);
  const [computedHere, setComputedHere] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState('');
  const body = chartBody(input);

  async function compute(event: Event) {
    event.preventDefault();
    if (!city) {
      setProblem('Choose a place from the list.');
      return;
    }
    const next: ChartInput = {
      date,
      time,
      zone: city.tz,
      latitude: city.lat,
      longitude: city.lon,
      place: [city.name, city.country].filter(Boolean).join(', '),
    };
    setBusy(true);
    setProblem('');
    try {
      const engine = await loadEngine();
      const result = await engine.answerHere('chart', JSON.stringify(chartBody(next)));
      if (result.status !== 200) {
        setProblem(refusal(result.body));
        return;
      }
      setInput(next);
      setAnswer(result.body);
      setComputedHere(true);
    } catch {
      setProblem('The engine did not load in this browser.');
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setInput(demo.chart.input);
    setDate(CHART_PRESET.date);
    setTime(CHART_PRESET.time);
    setCity(PRESET_CITY);
    setAnswer(demo.chart.answer);
    setComputedHere(false);
    setProblem('');
  }

  const utc = answer.result.instant.replace('.000Z', 'Z');
  const natalArgs = { utc, latitude: input.latitude, longitude: input.longitude, houseSystem: 'whole' };
  const timeArgs = { local: body.local, longitude: input.longitude };
  return (
    <>
      <form class="demo__form" onSubmit={(event) => void compute(event)} data-chart-form>
        <label class="demo__field">
          <span class="demo__label">Date</span>
          <input class="demo__input" type="date" min="1800-01-01" max="2199-12-31" required value={date}
            onInput={(event) => setDate((event.currentTarget as HTMLInputElement).value)} data-date />
        </label>
        <label class="demo__field">
          <span class="demo__label">Local time</span>
          <input class="demo__input" type="time" required value={time}
            onInput={(event) => setTime((event.currentTarget as HTMLInputElement).value)} data-time />
        </label>
        <div class="demo__field demo__field--place">
          <label class="demo__label" for="demo-place">Place</label>
          <PlaceSearch id="demo-place" selected={city} onSelect={setCity} required />
        </div>
        <div class="demo__actions">
          <button type="submit" class="cmp__btn" disabled={busy} data-compute>{busy ? 'Computing' : 'Compute in this browser'}</button>
        </div>
        <p class="demo__note">{ENGINE_NOTE}</p>
        {problem && <p class="demo__error" role="alert">{problem}</p>}
      </form>

      <div aria-live="polite">
        <ChartAnswer input={input} answer={answer} />
        <Sample computedHere={computedHere} onReset={reset} />
      </div>
      <JsonResponse value={answer} label="The JSON response" />

      <h3>The same request with cURL</h3>
      <Code label="cURL command" text={computeCurl('chart', body)} />
      <p class="demo__note">POST /api/v1/chart answers with the same JSON, with no key. Open it in <a href={PLAYGROUND_PATH}>the playground</a> to send it and compare the two answers.</p>

      <h3>The same question as MCP tool calls</h3>
      <Code label="MCP tool calls" text={`${pretty(mcpCall('resolve_birth_time', timeArgs, 1))}\n\n${pretty(mcpCall('calculate_natal_chart', natalArgs, 2))}`} />
      <p class="demo__note">
        The <a href="/developers/mcp/">local MCP adapter</a> takes the instant in UTC, so the local time is read first
        with resolve_birth_time, which runs the compute API&rsquo;s time calculation. Both run on your own machine.
      </p>

      <section class="demo__checked" aria-labelledby="demo-checked-chart">
        <h3 id="demo-checked-chart">How this was checked</h3>
        <ul>
          <li>Computed by {engineLine(answer.receipt)}, as the answer&rsquo;s receipt names them. The local time was read with {runtimeLine(answer.receipt)}.</li>
          <li>An automated test compares the engine&rsquo;s positions with NASA JPL Horizons at 2020 (ten bodies) and 1907 (Sun, Moon and Mars). The sample maximum difference is 14.8 arcseconds (Neptune, 2020).</li>
          <li>Compared with Swiss Ephemeris 2.10.03 every tenth day from 1800 to 2026, the sample maximum difference in longitude is 22.9 arcseconds (Venus, 1878).</li>
          <li>A sample maximum is the largest difference found in the cases measured. It is not a bound for every date.</li>
          <li>The answer cites its receipt as <code class="demo__digest">{answer.cite?.receipt}</code>, the SHA-256 of the receipt&rsquo;s canonical JSON, which <a href={PLAYGROUND_PATH}>the playground</a> computes again.</li>
        </ul>
      </section>
    </>
  );
}

// ── Mercury retrograde ──────────────────────────────────────────────

const COUNT_WORDS: Readonly<Record<number, string>> = { 2: 'two', 3: 'three' };

function stationLine(station: Station): string {
  return `${utcMinute(station.at)}, at ${position(station.lon)}`;
}

function MercuryAnswer({ after, answers }: { after: string; answers: Json[] }) {
  const { retrograde, direct } = mercuryStations(answers);
  const first = answers.flatMap((answer) => answer.result.events as Station[])[0];
  const already = first && first.type === 'direct' && retrograde && Date.parse(first.at) < Date.parse(retrograde.at) ? first : null;
  if (!retrograde) return <p class="demo__lead" data-answer="mercury">No retrograde station was found in the windows searched.</p>;
  return (
    <div class="demo__answer" data-answer="mercury">
      {already && (
        <p class="demo__lead">On {longDate(after)} Mercury is already retrograde. It turns direct on {stationLine(already)}.</p>
      )}
      <p class="demo__lead">
        {already ? 'It next turns retrograde' : `After ${longDate(after)}, Mercury next turns retrograde`} on{' '}
        {stationLine(retrograde)}{direct ? `, and turns direct again on ${stationLine(direct)}` : ''}.
      </p>
      <p class="demo__note">
        Retrograde means Mercury appears to move backward along the zodiac as seen from Earth. A station is the moment
        that apparent motion turns.
      </p>
    </div>
  );
}

function MercuryQuestion() {
  const [after, setAfter] = useState(MERCURY_PRESET.after);
  const [field, setField] = useState(MERCURY_PRESET.after);
  const [requests, setRequests] = useState<Json[]>(demo.mercury.requests);
  const [answers, setAnswers] = useState<Json[]>(demo.mercury.answers);
  const [computedHere, setComputedHere] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState('');

  async function compute(event: Event) {
    event.preventDefault();
    setBusy(true);
    setProblem('');
    try {
      const engine = await loadEngine();
      const asked: Json[] = [];
      const answered: Json[] = [];
      for (let index = 0; index < MERCURY_MAX_WINDOWS && !mercuryAnswered(answered); index += 1) {
        const request = mercuryBody({ after: field }, index);
        const result = await engine.answerHere('events', JSON.stringify(request));
        if (result.status !== 200) {
          setProblem(refusal(result.body));
          return;
        }
        asked.push(request);
        answered.push(result.body);
      }
      setAfter(field);
      setRequests(asked);
      setAnswers(answered);
      setComputedHere(true);
    } catch {
      setProblem('The engine did not load in this browser.');
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setAfter(MERCURY_PRESET.after);
    setField(MERCURY_PRESET.after);
    setRequests(demo.mercury.requests);
    setAnswers(demo.mercury.answers);
    setComputedHere(false);
    setProblem('');
  }

  const receipt = answers[0]?.receipt;
  const search = receipt?.search;
  const curls = requests.map((request) => computeCurl('events', request)).join('\n\n');
  const calls = requests.map((request, index) => pretty(mcpCall('get_upcoming_events', request, index + 1))).join('\n\n');
  return (
    <>
      <form class="demo__form" onSubmit={(event) => void compute(event)} data-mercury-form>
        <label class="demo__field">
          <span class="demo__label">After this date (from 00:00 UTC)</span>
          <input class="demo__input" type="date" min="1800-01-01" max="2199-03-01" required value={field}
            onInput={(event) => setField((event.currentTarget as HTMLInputElement).value)} data-after />
        </label>
        <div class="demo__actions">
          <button type="submit" class="cmp__btn" disabled={busy} data-compute>{busy ? 'Computing' : 'Compute in this browser'}</button>
        </div>
        <p class="demo__note">{ENGINE_NOTE}</p>
        {problem && <p class="demo__error" role="alert">{problem}</p>}
      </form>

      <div aria-live="polite">
        <MercuryAnswer after={after} answers={answers} />
        <Sample computedHere={computedHere} onReset={reset} />
      </div>
      <JsonResponse value={answers.length === 1 ? answers[0] : answers} label={answers.length === 1 ? 'The JSON response' : `The ${COUNT_WORDS[answers.length] ?? answers.length} JSON responses`} />

      <h3>The same requests with cURL</h3>
      <Code label="cURL commands" text={curls} />
      <p class="demo__note">
        An events window is at most {MERCURY_WINDOW_DAYS} days long, so the demo asks window by window
        until it has the next retrograde station and the direct station after it. This answer took{' '}
        {requests.length === 1 ? 'one request' : `${COUNT_WORDS[requests.length] ?? requests.length} requests`}.
      </p>

      <h3>The same question as MCP tool calls</h3>
      <Code label="MCP tool calls" text={calls} />
      <p class="demo__note">
        get_upcoming_events on the hosted MCP server at https://zodiacs.org/mcp runs the same search and adds a display
        time zone. This sends one of them from a terminal:
      </p>
      <Code label="MCP call with cURL" text={mcpCurl('get_upcoming_events', requests[requests.length - 1])} />

      <section class="demo__checked" aria-labelledby="demo-checked-mercury">
        <h3 id="demo-checked-mercury">How this was checked</h3>
        <ul>
          <li>Computed by {engineLine(receipt)}, as the answer&rsquo;s receipt names them.</li>
          {search && (
            <li>The search samples Mercury&rsquo;s motion every {search.stepDays.default} days and narrows each turn with {search.bisections} bisections. Its receipt says the search is {search.completeness === 'tested-not-proven' ? 'tested, not proven to miss nothing' : search.completeness}.</li>
          )}
          <li>The stations this site publishes for 2026 to 2030 were compared with Swiss Ephemeris: across 92 stations the sample maximum difference is 419 seconds, about seven minutes.</li>
          <li>A sample maximum is the largest difference found in the cases measured. It is not a bound for every date.</li>
        </ul>
      </section>
    </>
  );
}

// ── Compatibility ───────────────────────────────────────────────────

function personLine(person: Json, input: Json): string {
  const parts = [`Sun in ${capitalize(person.sun)}`];
  if (person.moon) parts.push(`Moon in ${capitalize(person.moon)}`);
  if (person.rising) parts.push(`${capitalize(person.rising)} rising`);
  return `${person.label}, born ${longDate(person.birthDate)} at ${input.time} in ${person.place}: ${parts.join(', ')}.`;
}

function CompatibilityQuestion() {
  const { input, arguments: args, result } = demo.compatibility;
  const data: Json = result.data;
  return (
    <>
      <div class="demo__answer" data-answer="compatibility">
        <ul class="demo__people">
          <li>{personLine(data.a, input.a)}</li>
          <li>{personLine(data.b, input.b)}</li>
        </ul>
        {data.signPair && (
          <p class="demo__lead">
            Their Suns are in {capitalize(data.signPair.signs[0])} and {capitalize(data.signPair.signs[1])}.{' '}
            {data.signPair.element.label}: {data.signPair.element.note} {data.signPair.modality.label}:{' '}
            {data.signPair.modality.note}
          </p>
        )}
        <p class="demo__lead">
          Score: {data.score.overall} of 100 (attraction {data.score.areas.attraction}, communication{' '}
          {data.score.areas.communication}, stability {data.score.areas.stability}). {data.score.headline}
        </p>
        <h3>The closest contacts</h3>
        <ul class="demo__contacts">
          {data.contacts.slice(0, 4).map((contact: Json) => (
            <li key={`${contact.aBody}-${contact.bBody}`}>
              <span class="mono">{contact.aBody} {contact.aspect} {contact.bBody}, orb {contact.orb}°</span>: {contact.line}
            </li>
          ))}
        </ul>
        <p class="demo__note">{data.note}</p>
        <p class="demo__note" data-source="build">Computed with the hosted get_compatibility tool&rsquo;s own code when this page was built, for two synthetic births.</p>
      </div>
      <JsonResponse value={result} label="The JSON result" />

      <h3>The same question as an MCP tool call</h3>
      <Code label="MCP tool call" text={pretty(mcpCall('get_compatibility', args))} />
      <p class="demo__note">
        get_compatibility is a tool of the hosted MCP server at https://zodiacs.org/mcp. The compute API has no
        compatibility endpoint, so the call over HTTP is the MCP request itself:
      </p>
      <h3>The same request with cURL</h3>
      <Code label="cURL command" text={mcpCurl('get_compatibility', args)} />
      <p class="demo__note">The answer&rsquo;s structuredContent is the JSON result above. The tool saves none of the birth details it is given.</p>

      <section class="demo__checked" aria-labelledby="demo-checked-compatibility">
        <h3 id="demo-checked-compatibility">How this was checked</h3>
        <ul>
          <li>Both charts come from {engineLine(demo.chart.answer.receipt)}, the engine behind the birth chart question, so their positions carry the same sample maxima: 14.8 arcseconds against NASA JPL Horizons and 22.9 arcseconds against Swiss Ephemeris.</li>
          <li>The score, the sign pair notes and the contact lines are astrology&rsquo;s reading, in the site&rsquo;s own compatibility wording. No reference can check them, so they are not measured.</li>
        </ul>
      </section>
    </>
  );
}

// ── The demo ────────────────────────────────────────────────────────

export default function DeveloperDemo() {
  const [question, setQuestion] = useState<QuestionId>('chart');
  return (
    <div class="shell demo" data-demo data-question={question}>
      <div class="core demo__core">
        <div class="demo__questions" role="group" aria-labelledby="demo-pick">
          <p class="demo__label" id="demo-pick">Pick a question</p>
          <div class="demo__choices">
            {QUESTION_IDS.map((id, index) => (
              <button
                key={id}
                type="button"
                class="cmp__btn demo__choice"
                aria-pressed={question === id}
                aria-controls="demo-panel"
                onClick={() => setQuestion(id)}
                data-choose={id}
              >
                <span class="demo__number" aria-hidden="true">{index + 1}</span>
                {QUESTION_LABELS[id]}
              </button>
            ))}
          </div>
        </div>
        <section class="demo__panel" id="demo-panel" aria-labelledby="demo-question">
          <h2 class="demo__question" id="demo-question">{QUESTION_LABELS[question]}</h2>
          {question === 'chart' && <ChartQuestion />}
          {question === 'mercury' && <MercuryQuestion />}
          {question === 'compatibility' && <CompatibilityQuestion />}
        </section>
      </div>
    </div>
  );
}
