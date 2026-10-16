import { useEffect, useMemo, useState } from 'preact/hooks';
import { COMPUTE_ENDPOINTS, computePath, type ComputeEndpoint } from '../lib/compute-api/constants';
import {
  LANGUAGES,
  LANGUAGE_NAMES,
  PLAYGROUND_ENGINE_PATH,
  PLAYGROUND_EXAMPLES_PATH,
  citesItsReceipt,
  codeSamples,
  compactBody,
  differences,
  readLink,
  shareLink,
  verdict,
  type Difference,
  type Language,
  type PlaygroundExample,
} from '../lib/developer-playground';
import { CopyLinkButton, type CopyLinkState } from './CopyLinkButton';

interface Answer {
  status: number;
  /** The parsed body, or the text when it is not JSON. */
  body: unknown;
  milliseconds: number;
  citation: Awaited<ReturnType<typeof citesItsReceipt>>;
}

type Side = 'hosted' | 'here';

const SIDE_NAMES: Record<Side, string> = { hosted: 'The API', here: 'This browser' };
// The same, inside a sentence.
const SIDE_IN_TEXT: Record<Side, string> = { hosted: 'the API', here: 'this browser' };

const pretty = (value: unknown) => (typeof value === 'string' ? value : JSON.stringify(value, null, 2));

function parse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function answerOf(status: number, body: unknown, started: number): Promise<Answer> {
  return { status, body, milliseconds: Math.round(performance.now() - started), citation: await citesItsReceipt(body) };
}

function VerdictLine({ found, left, right }: { found: Difference[]; left: string; right: string }) {
  const outcome = verdict(found);
  if (outcome === 'same') return <p class="pg__verdict" data-verdict="same">{left} and {right} gave the same answer, byte for byte.</p>;
  if (outcome === 'runtime') {
    return (
      <p class="pg__verdict" data-verdict="runtime">
        {left} and {right} gave the same answer. Their receipts differ only where each names the runtime that read local times, and
        so do their citations' digests.
      </p>
    );
  }
  if (outcome === 'rounding') {
    return (
      <p class="pg__verdict" data-verdict="rounding">
        {left} and {right} gave the same answer, but for numbers that differ by 1e-8 or less, where a runtime's own sine and cosine
        move the last digits.
      </p>
    );
  }
  return <p class="pg__verdict pg__verdict--different" data-verdict="different">{left} and {right} gave different answers.</p>;
}

function DifferenceTable({ found }: { found: Difference[] }) {
  if (found.length === 0) return null;
  const shown = found.slice(0, 12);
  return (
    <div class="pg__table-wrap" tabindex={0} role="region" aria-label="Where the two answers differ">
      <table class="pg__table">
        <thead><tr><th scope="col">Where</th><th scope="col">Why</th><th scope="col">First</th><th scope="col">Second</th></tr></thead>
        <tbody>
          {shown.map((row) => (
            <tr key={row.path}>
              <td><code>{row.path}</code></td>
              <td>{row.kind}</td>
              <td><code>{JSON.stringify(row.left)}</code></td>
              <td><code>{JSON.stringify(row.right)}</code></td>
            </tr>
          ))}
        </tbody>
      </table>
      {found.length > shown.length && <p class="pg__note">And {found.length - shown.length} more.</p>}
    </div>
  );
}

function AnswerPanel({ side, answer, running, problem }: { side: Side; answer: Answer | null; running: boolean; problem: string | null }) {
  return (
    <section class="pg__answer" aria-labelledby={`pg-${side}`} data-answer={side}>
      <h3 id={`pg-${side}`}>{SIDE_NAMES[side]}</h3>
      {running && <p class="pg__note">Working…</p>}
      {problem && <p class="pg__error" role="alert">{problem}</p>}
      {answer && !running && (
        <>
          <p class="pg__status mono" data-status={answer.status}>
            {answer.status} · {answer.milliseconds} ms
          </p>
          {answer.citation && (
            <p class="pg__note" data-citation={answer.citation.matches ? 'matches' : 'differs'}>
              {answer.citation.matches
                ? 'Its citation is the digest of its receipt: this page computed the same SHA-256.'
                : `Its citation does not match its receipt: this page computed ${answer.citation.computed}.`}
            </p>
          )}
          <pre tabindex={0} role="region" aria-label={`${SIDE_NAMES[side]}: the answer`}><code>{pretty(answer.body)}</code></pre>
        </>
      )}
    </section>
  );
}

export default function DeveloperPlayground() {
  const [examples, setExamples] = useState<PlaygroundExample[] | null>(null);
  const [loadProblem, setLoadProblem] = useState<string | null>(null);
  const [exampleId, setExampleId] = useState<string | null>(null);
  const [endpoint, setEndpoint] = useState<ComputeEndpoint>('chart');
  const [text, setText] = useState('');
  const [answers, setAnswers] = useState<Record<Side, Answer | null>>({ hosted: null, here: null });
  const [running, setRunning] = useState<Record<Side, boolean>>({ hosted: false, here: false });
  const [problems, setProblems] = useState<Record<Side, string | null>>({ hosted: null, here: null });
  const [language, setLanguage] = useState<Language>('curl');
  const [includeRequest, setIncludeRequest] = useState(false);
  const [copyState, setCopyState] = useState<CopyLinkState>('idle');
  const [codeCopy, setCodeCopy] = useState<'idle' | 'copied' | 'manual'>('idle');

  useEffect(() => {
    let cancelled = false;
    fetch(PLAYGROUND_EXAMPLES_PATH)
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
      })
      .then((document: { examples: PlaygroundExample[]; refusals: PlaygroundExample[] }) => {
        if (cancelled) return;
        const all = [...document.examples, ...document.refusals];
        setExamples(all);
        const link = readLink(window.location.href, COMPUTE_ENDPOINTS);
        const chosen = all.find((example) => example.id === link.example) ?? null;
        if (link.text !== null) {
          setEndpoint((link.endpoint as ComputeEndpoint | null) ?? chosen?.endpoint ?? 'chart');
          setExampleId(null);
          setText(link.text);
        } else if (chosen) {
          choose(chosen);
        } else {
          const first = all.find((example) => example.endpoint === (link.endpoint ?? 'chart')) ?? all[0];
          choose(first);
        }
      })
      .catch(() => {
        if (!cancelled) setLoadProblem('The documented examples did not load. You can still write a request and send it.');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function choose(example: PlaygroundExample) {
    setExampleId(example.id);
    setEndpoint(example.endpoint);
    setText(typeof example.body === 'string' ? example.body : JSON.stringify(example.body, null, 2));
    setAnswers({ hosted: null, here: null });
    setProblems({ hosted: null, here: null });
    setCopyState('idle');
  }

  const example = useMemo(() => examples?.find((candidate) => candidate.id === exampleId) ?? null, [examples, exampleId]);
  // The documented answer applies while the request is still the example's, whatever its layout.
  const documented = example && example.endpoint === endpoint
    && compactBody(text) === compactBody(typeof example.body === 'string' ? example.body : JSON.stringify(example.body))
    ? example : null;
  const samples = useMemo(() => codeSamples(endpoint, text), [endpoint, text]);
  // The page renders on the server too, where there is no window: links name zodiacs.org until the browser takes over.
  const origin = typeof window === 'undefined' ? undefined : window.location.origin;
  const link = shareLink({ endpoint, example: documented ? documented.id : null, text }, includeRequest, origin);

  async function sendToApi() {
    setRunning((state) => ({ ...state, hosted: true }));
    setProblems((state) => ({ ...state, hosted: null }));
    const started = performance.now();
    try {
      const response = await fetch(computePath(endpoint), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: text,
      });
      const answer = await answerOf(response.status, parse(await response.text()), started);
      setAnswers((state) => ({ ...state, hosted: answer }));
    } catch {
      setAnswers((state) => ({ ...state, hosted: null }));
      setProblems((state) => ({ ...state, hosted: 'The API did not answer from this address.' }));
    } finally {
      setRunning((state) => ({ ...state, hosted: false }));
    }
  }

  async function runHere() {
    setRunning((state) => ({ ...state, here: true }));
    setProblems((state) => ({ ...state, here: null }));
    const started = performance.now();
    try {
      const engine = await import(/* @vite-ignore */ PLAYGROUND_ENGINE_PATH);
      const result = await engine.answerHere(endpoint, text);
      const answer = await answerOf(result.status, result.body, started);
      setAnswers((state) => ({ ...state, here: answer }));
    } catch {
      setAnswers((state) => ({ ...state, here: null }));
      setProblems((state) => ({ ...state, here: 'The engine did not load in this browser.' }));
    } finally {
      setRunning((state) => ({ ...state, here: false }));
    }
  }

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(samples[language]);
      setCodeCopy('copied');
    } catch {
      setCodeCopy('manual');
    }
  }

  const both = answers.hosted && answers.here ? differences(answers.hosted.body, answers.here.body) : null;
  const statusesDiffer = answers.hosted && answers.here && answers.hosted.status !== answers.here.status;

  return (
    <div class="shell pg" data-playground>
      <div class="core pg__core">
        <div class="pg__request">
          <label class="pg__field">
            <span class="pg__label">Example</span>
            <select
              class="pg__input"
              value={exampleId ?? ''}
              onChange={(event) => {
                const chosen = examples?.find((candidate) => candidate.id === (event.currentTarget as HTMLSelectElement).value);
                if (chosen) choose(chosen);
              }}
              disabled={!examples}
              data-example-select
            >
              {exampleId === null && <option value="">Your own request</option>}
              {COMPUTE_ENDPOINTS.map((name) => (
                <optgroup key={name} label={computePath(name)}>
                  {(examples ?? []).filter((candidate) => candidate.endpoint === name).map((candidate) => (
                    <option key={candidate.id} value={candidate.id}>{candidate.summary}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>
          <label class="pg__field">
            <span class="pg__label">Endpoint</span>
            <select
              class="pg__input"
              value={endpoint}
              onChange={(event) => setEndpoint((event.currentTarget as HTMLSelectElement).value as ComputeEndpoint)}
              data-endpoint-select
            >
              {COMPUTE_ENDPOINTS.map((name) => <option key={name} value={name}>POST {computePath(name)}</option>)}
            </select>
          </label>
          <label class="pg__field pg__body">
            <span class="pg__label">Request body (JSON)</span>
            <textarea
              class="pg__input pg__input--code mono"
              rows={12}
              spellcheck={false}
              value={text}
              onInput={(event) => {
                setText((event.currentTarget as HTMLTextAreaElement).value);
                setCopyState('idle');
              }}
              data-request-body
            />
          </label>
          {loadProblem && <p class="pg__error" role="alert">{loadProblem}</p>}
          <div class="pg__actions">
            <button type="button" class="cmp__btn" onClick={() => void sendToApi()} disabled={running.hosted} data-send>
              Send to the API
            </button>
            <button type="button" class="cmp__btn" onClick={() => void runHere()} disabled={running.here} data-run-here>
              Run in this browser
            </button>
            {example && !documented && (
              <button type="button" class="cmp__btn" onClick={() => choose(example)} data-reset>Back to the example</button>
            )}
          </div>
          <p class="pg__note">
            Send posts this body to <code>{computePath(endpoint)}</code> on zodiacs.org. Run in this browser loads the API's
            calculations into this page, about 155 KB compressed, and sends nothing.
          </p>
        </div>

        <div class="pg__answers" aria-live="polite">
          <AnswerPanel side="hosted" answer={answers.hosted} running={running.hosted} problem={problems.hosted} />
          <AnswerPanel side="here" answer={answers.here} running={running.here} problem={problems.here} />
        </div>

        {(both || documented) && (
          <section class="pg__compare" aria-labelledby="pg-compare" data-comparison>
            <h3 id="pg-compare">Comparison</h3>
            {both && (
              <>
                {statusesDiffer && <p class="pg__verdict pg__verdict--different">The two answered with different statuses.</p>}
                <VerdictLine found={both} left="The API" right="this browser" />
                <DifferenceTable found={both} />
              </>
            )}
            {documented && (['hosted', 'here'] as Side[]).map((side) => {
              const answer = answers[side];
              if (!answer) return null;
              const found = differences(documented.answer, answer.body);
              return (
                <div key={side} data-documented={side} data-documented-verdict={answer.status === documented.status ? verdict(found) : 'different'}>
                  <VerdictLine found={answer.status === documented.status ? found : [{ path: '', kind: 'value', left: documented.status, right: answer.status }]} left="The documentation" right={SIDE_IN_TEXT[side]} />
                </div>
              );
            })}
          </section>
        )}

        <section class="pg__code" aria-labelledby="pg-code">
          <h3 id="pg-code">This request in code</h3>
          <div class="pg__tabs" role="group" aria-label="Language">
            {LANGUAGES.map((name) => (
              <button
                key={name}
                type="button"
                class="cmp__btn"
                aria-pressed={language === name}
                onClick={() => {
                  setLanguage(name);
                  setCodeCopy('idle');
                }}
                data-language={name}
              >
                {LANGUAGE_NAMES[name]}
              </button>
            ))}
          </div>
          <pre tabindex={0} role="region" aria-label={`${LANGUAGE_NAMES[language]} code`} data-code={language}><code>{samples[language]}</code></pre>
          <div class="pg__actions">
            <button type="button" class="cmp__btn" onClick={() => void copyCode()} data-copy-code>
              {codeCopy === 'copied' ? 'Copied' : 'Copy the code'}
            </button>
          </div>
          {codeCopy === 'manual' && <p class="pg__note">Copying did not work here; select the code above instead.</p>}
          <p class="pg__note">Each uses its language's standard library and prints the answer's body.</p>
        </section>

        <section class="pg__link" aria-labelledby="pg-link">
          <h3 id="pg-link">A link to this request</h3>
          <label class="pg__check">
            <input
              type="checkbox"
              checked={includeRequest}
              onChange={(event) => {
                setIncludeRequest((event.currentTarget as HTMLInputElement).checked);
                setCopyState('idle');
              }}
              data-include-request
            />
            <span>Put the request in the link</span>
          </label>
          <p class="pg__note">
            {includeRequest
              ? 'The request goes after the # in the link, which a browser never sends to a server. Anyone with the link can read it.'
              : documented
                ? 'The link opens this documented example. Nothing you typed is in it.'
                : 'The link opens the playground at this endpoint. Nothing you typed is in it.'}
          </p>
          <p class="pg__url mono" data-link>{link}</p>
          <CopyLinkButton
            url={link}
            state={copyState}
            onStateChange={setCopyState}
            idleLabel="Copy the link"
            copiedLabel="Link copied"
            ariaLabel="The playground link"
            buttonClass="cmp__btn"
            dataHook="details"
          />
        </section>
      </div>
    </div>
  );
}
