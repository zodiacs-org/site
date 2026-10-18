/**
 * "Why do these two charts differ?", answered on the device.
 *
 * Nothing here uploads, stores or transmits anything: the files are read in the
 * page with `file.text()`, compared in memory, and dropped when the page closes
 * or the visitor resets. The engine is pulled in only when a comparison runs —
 * the preset titles are plain data for that reason — so the page itself stays
 * light and renders its controls without JavaScript.
 */
import { useCallback, useRef, useState } from 'preact/hooks';
import { formatDelta } from '../lib/compare/angles';
import { PRESETS } from '../lib/compare/presets';
import type { Comparison, Difference } from '../lib/compare/diff';

type Side = 'left' | 'right';

interface Loaded {
  readonly name: string;
  readonly envelope: unknown;
}

type Status =
  | { kind: 'idle' }
  | { kind: 'working' }
  | {
      kind: 'ready'; comparison: Comparison; leftName: string; rightName: string;
      /** Which preset produced this, or null when it came from imported files. */
      preset: string | null;
      /** The two envelopes this result is actually about, for the export. */
      sides: readonly [unknown, unknown] | null;
    }
  | { kind: 'failed'; message: string };

const EVIDENCE_COPY: Record<string, { label: string; note: string }> = {
  reproduced: { label: 'Reproduced', note: 'Recalculated here, changing one setting and nothing else.' },
  reported: { label: 'Reported', note: 'Read directly from what the two files state.' },
  hypothesis: { label: 'Hypothesis', note: 'Fits the evidence. Not demonstrated.' },
  unresolved: { label: 'Unresolved', note: 'Nothing available accounts for this.' },
};

const KIND_COPY: Record<Difference['kind'], string> = {
  numeric: 'differs',
  metadata: 'differs',
  display: 'agrees to displayed precision',
};

interface Source {
  readonly left: unknown;
  readonly right: unknown;
  readonly leftName: string;
  readonly rightName: string;
  readonly preset: string | null;
  /** Null for a preset: a summary of made-up records is nobody's to keep. */
  readonly sides: readonly [unknown, unknown] | null;
}

export default function ChartCompare() {
  const [files, setFiles] = useState<Record<Side, Loaded | null>>({ left: null, right: null });
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const [hint, setHint] = useState<string | null>(null);
  const [detail, setDetail] = useState(false);
  // Only the newest comparison may land: an interrupted one must never be
  // mistaken for the current answer.
  const run = useRef(0);

  const compare = useCallback(async (get: () => Promise<Source>) => {
    const ticket = ++run.current;
    setStatus({ kind: 'working' });
    try {
      const [{ compareEnvelopes }, engine, source] = await Promise.all([
        import('../lib/compare/diff'),
        import('../lib/compare/replay'),
        get(),
      ]);
      if (ticket !== run.current) return;
      const comparison = compareEnvelopes(source.left as never, source.right as never, {
        engineVersion: engine.engineVersion, replay: engine.replay,
      });
      if (ticket !== run.current) return;
      setStatus({
        kind: 'ready', comparison, leftName: source.leftName, rightName: source.rightName,
        preset: source.preset, sides: source.sides,
      });
    } catch (error) {
      if (ticket !== run.current) return;
      // A failed dynamic import is a loading problem, not something the reader
      // can act on from a bundler's wording.
      const message = error instanceof Error && /dynamically imported module/i.test(error.message)
        ? 'The comparison code could not be loaded. Check your connection and try again.'
        : error instanceof Error ? error.message : 'The comparison could not be completed.';
      setStatus({ kind: 'failed', message });
    }
  }, []);

  const runPreset = useCallback((id: string) => {
    setHint(PRESETS.find((entry) => entry.id === id)?.summary ?? null);
    void compare(async () => {
      const module = await import('../lib/compare/fixtures');
      const chosen = module.PRESETS.find((entry) => entry.id === id) ?? module.PRESETS[0];
      const { left, right } = module.presetEnvelopes(chosen);
      return { left, right, leftName: 'Example A', rightName: 'Example B', preset: id, sides: null };
    });
  }, [compare]);

  const readFile = useCallback(async (side: Side, file: File) => {
    const { NATAL_ENVELOPE_LIMITS, parseNatalEnvelope } = await import('@zodiacs/engine/receipt');
    if (file.size > NATAL_ENVELOPE_LIMITS.bytes) {
      throw new Error(`${file.name} is ${file.size} bytes; the limit is ${NATAL_ENVELOPE_LIMITS.bytes}.`);
    }
    const text = await file.text();
    const parsed = parseNatalEnvelope(text);
    if (!parsed.ok) throw new Error(`${file.name} is not a calculation record this page can read.`);
    setFiles((current) => ({ ...current, [side]: { name: file.name, envelope: parsed.envelope } }));
  }, []);

  const onPick = useCallback((side: Side) => async (event: Event) => {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    // Choosing a file abandons whatever comparison is running, so its result
    // cannot land on top of what this choice is about to say.
    run.current += 1;
    try {
      await readFile(side, file);
      setStatus({ kind: 'idle' });
    } catch (error) {
      setStatus({ kind: 'failed', message: error instanceof Error ? error.message : 'That file could not be read.' });
    }
  }, [readFile]);

  const compareFiles = useCallback(() => {
    const { left, right } = files;
    if (!left || !right) return;
    setHint(null);
    void compare(async () => ({
      left: left.envelope, right: right.envelope, leftName: left.name, rightName: right.name,
      preset: null, sides: [left.envelope, right.envelope] as const,
    }));
  }, [compare, files]);

  const reset = useCallback(() => {
    run.current += 1;
    setFiles({ left: null, right: null });
    setStatus({ kind: 'idle' });
    setHint(null);
    for (const input of document.querySelectorAll<HTMLInputElement>('[data-compare-file]')) input.value = '';
  }, []);

  const exportSummary = useCallback(async () => {
    if (status.kind !== 'ready') return;
    const { redactNatalEnvelope } = await import('@zodiacs/engine/receipt');
    const summary = {
      schema: 'zodiacs.compare-summary.draft-v1',
      note: status.sides
        ? 'Redacted, which is not the same as anonymous. It still describes two specific calculations, '
          + 'and it keeps the exact difference between them.'
        : 'An example comparison. The two records it describes are synthetic and describe nobody.',
      differences: status.comparison.differences.map(({ id, area, label, kind, delta }) => ({ id, area, label, kind, delta })),
      explanations: status.comparison.explanations.map(({ id, evidence, statement }) => ({ id, evidence, statement })),
      limits: status.comparison.limits,
      sides: status.sides
        ? status.sides.map((side) => redactNatalEnvelope(side as never))
        : null,
    };
    const blob = new Blob([`${JSON.stringify(summary, null, 2)}\n`], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'zodiacs-comparison-summary.json';
    anchor.click();
    URL.revokeObjectURL(url);
  }, [status]);

  const comparison = status.kind === 'ready' ? status.comparison : null;
  const leftHead = status.kind === 'ready' ? status.leftName : 'First';
  const rightHead = status.kind === 'ready' ? status.rightName : 'Second';
  const substantive = comparison?.differences.filter((row) => row.kind !== 'display') ?? [];
  const areas = [...new Set(substantive.map((row) => row.area))];
  // Three outcomes, not two: no difference at all, a difference too small to
  // show at the precision these records carry, and a real difference. Calling
  // the middle one "differs in 0 places" would be a sentence about nothing.
  const verdict = !comparison ? 'identical'
    : comparison.identical ? 'identical'
      : substantive.length === 0 ? 'rounding' : 'differs';
  const bothChosen = Boolean(files.left && files.right);
  const count = `${substantive.length} ${substantive.length === 1 ? 'value differs' : 'values differ'}`;

  return (
    <section class="shell cmp" data-chart-compare>
      <div class="core cmp__core">
        <div class="cmp__head">
          <h2 id="compare-heading">Compare two calculations</h2>
          <p>
            Load two calculation records and see exactly what differs between them, and how
            much of that difference anything in the files can actually explain. Everything
            happens in this browser: your records are never uploaded and never kept.
          </p>
        </div>

        <fieldset class="cmp__presets">
          <legend>Start with an example</legend>
          <div class="cmp__preset-row">
            {PRESETS.map((entry) => (
              <button
                key={entry.id}
                type="button"
                class="cmp__btn"
                // Pressed only when this preset produced what is on screen. A
                // default that reads as pressed announces a demo nobody ran.
                aria-pressed={status.kind === 'ready' && status.preset === entry.id}
                onClick={() => runPreset(entry.id)}
                data-compare-preset={entry.id}
              >{entry.title}</button>
            ))}
          </div>
          {hint && <p class="cmp__note" data-compare-hint>{hint}</p>}
        </fieldset>

        <fieldset class="cmp__files">
          <legend>Or compare your own records</legend>
          <p class="cmp__note">
            Use the calculation record a birth chart offers for download, or one produced by
            the developer starter. A full record contains birth details. Treat it as private.
          </p>
          {(['left', 'right'] as const).map((side) => (
            <label key={side} class="cmp__file">
              <span>{side === 'left' ? 'First record' : 'Second record'}</span>
              <input type="file" accept="application/json,.json" onChange={onPick(side)} data-compare-file={side} />
              {/* The file input already says "no file chosen"; echoing it would
                  put the words on screen twice and into the accessible name. */}
              {files[side] && <span class="cmp__filename mono">{files[side]!.name}</span>}
            </label>
          ))}
          <div class="cmp__actions">
            {/* Kept focusable while inert: a control a keyboard user never
                reaches cannot tell them what it is waiting for. */}
            <button
              type="button"
              class="cmp__btn"
              aria-disabled={!bothChosen}
              onClick={() => { if (bothChosen) compareFiles(); }}
              data-compare-run
            >{bothChosen ? 'Compare these two' : 'Choose both records to compare'}</button>
            <button type="button" class="cmp__btn" onClick={reset} data-compare-reset>Clear</button>
          </div>
        </fieldset>

        <p class="sr-only" role="status" aria-live="polite" data-compare-live>
          {status.kind === 'working' ? 'Comparing.' : status.kind === 'ready'
            ? (verdict === 'identical' ? 'The two records match.'
              : verdict === 'rounding' ? 'The two records agree to the precision they display.'
                : `${count}.`)
            : ''}
        </p>

        {status.kind === 'working' && <p class="cmp__working" data-compare-working>Comparing…</p>}
        {status.kind === 'failed' && <p class="cmp__error" role="alert" data-compare-error>{status.message}</p>}

        {comparison && (
          <div class="cmp__result" data-compare-result={verdict}>
            <h3 class="cmp__verdict">
              {verdict === 'identical'
                ? 'These two records describe the same calculation.'
                : verdict === 'rounding'
                  ? 'These two records agree on every value they display. What differs is below the sixth decimal place shown, which is rounding rather than a different calculation.'
                  : `${count}${areas.length ? `: ${areas.join(', ').toLowerCase()}` : ''}.`}
            </h3>

            {comparison.explanations.length > 0 && (
              <ol class="cmp__why" data-compare-explanations>
                {comparison.explanations.map((item) => (
                  <li key={item.id} data-evidence={item.evidence}>
                    <span class="cmp__badge" data-badge={item.evidence}>{EVIDENCE_COPY[item.evidence].label}</span>
                    <p class="cmp__statement">{item.statement}</p>
                    <p class="cmp__evidence-note">{EVIDENCE_COPY[item.evidence].note}{item.detail ? ` ${item.detail}` : ''}</p>
                  </li>
                ))}
              </ol>
            )}

            {comparison.limits.length > 0 && (
              <div class="cmp__limits" data-compare-limits>
                <h4>What this cannot tell you</h4>
                <ul>{comparison.limits.map((limit) => <li key={limit}>{limit}</li>)}</ul>
              </div>
            )}

            {comparison.differences.length > 0 && (
              <details class="cmp__table" open={detail} onToggle={(event) => setDetail((event.currentTarget as HTMLDetailsElement).open)}>
                <summary>Every difference, as read from the two files</summary>
                <table data-compare-table>
                  <thead>
                    <tr><th scope="col">What</th><th scope="col">{leftHead}</th>
                      <th scope="col">{rightHead}</th><th scope="col">Difference</th></tr>
                  </thead>
                  <tbody>
                    {comparison.differences.map((row) => (
                      <tr key={row.id} data-difference={row.id} data-kind={row.kind}>
                        <th scope="row">{row.area} · {row.label}</th>
                        {/* On a phone the header row is hidden and each cell is
                            stacked, so it carries its own column name. */}
                        <td class="mono" data-label={leftHead}>{row.left}</td>
                        <td class="mono" data-label={rightHead}>{row.right}</td>
                        <td class="mono" data-label="Difference">{row.kind === 'display' || row.delta === null ? KIND_COPY[row.kind] : formatDelta(row.delta)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </details>
            )}

            <div class="cmp__actions">
              <button type="button" class="cmp__btn" onClick={() => void exportSummary()} data-compare-export>
                Download a redacted summary
              </button>
            </div>
            <p class="cmp__note">
              The summary leaves out dates, coordinates and positions, but keeps the exact
              difference between them. That makes it safer to share than a full record; it does
              not make it anonymous, and anyone holding one of the two charts can recover the
              other from it.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
