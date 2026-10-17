import type { ComponentChildren } from 'preact';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { activeLearningStep, PAGE_ONLY_COPY, type StepId } from '../lib/learning-progress';
import { useLearningProgress } from '../lib/use-learning-progress';
import './LearningPractice.css';
export { activeLearningStep, normalizeLearningProgress, normalizeLearningState, updateLearningProgress } from '../lib/learning-progress';
export type { StepId, LearningProgress, LearningStepCue } from '../lib/learning-progress';

/**
 * The five lessons, in the order a chart is read. Opening a lesson records
 * it as started; a lesson counts as read only when its reflection is
 * confirmed. Each id is the one the saved-chart practice and stored
 * progress use (see LEARNING_STEP_IDS).
 */
const STEPS = [
  {
    id: 'signs',
    title: 'The signs',
    body: 'Twelve characters, and the one you already know. What each sign is like, and the element, mode and planet behind it.',
    href: '#signs',
    reflection: 'I can name my Sun sign and its element.',
  },
  {
    id: 'planets',
    title: 'The planets',
    body: 'Ten parts of you, each with a job. The Sun is who you are, the Moon is what you need, Venus is how you love.',
    href: '/learn/planets/',
    reflection: 'I can name one planet and the part of life it describes.',
  },
  {
    id: 'planets-houses',
    title: 'The houses',
    body: 'Where in your life each planet shows up: home, money, work, love, friends, and the parts you keep private.',
    href: '/learn/houses/',
    reflection: 'I can name one house and the area of life it describes.',
  },
  {
    id: 'aspects',
    title: 'The aspects',
    body: 'How the planets talk to each other. One angle can describe a natural talent, a familiar tension, or a choice that keeps returning.',
    href: '/learn/aspects/',
    reflection: 'I can describe how one aspect connects two planets.',
  },
  {
    id: 'big-three',
    title: 'Your big three',
    body: 'Put it together: your Sun, Moon and rising sign. Why the version of you people meet does not always match how you feel inside.',
    href: '/big-three/',
    reflection: 'I have read my available chart placements and can describe what one means.',
  },
] as const;

/** What the page adds around each lesson: its picture, a line of detail and its guide count. */
export interface LessonDecor {
  art?: { src: string; srcset?: string; alt: string; width: number; height: number };
  /** Twelve sign discs, the planet glyphs, or a short line of detail. */
  minis?: { discs: { src: string }[] } | { glyphs: string[] } | { text: string };
  /** "12 guides · 5 min". */
  meta?: string;
}

function track(action: string) {
  (window as Window & {
    zodiacsAnalytics?: { track?: (name: string, properties: Record<string, string>) => void };
  }).zodiacsAnalytics?.track?.('next_action_clicked', {
    state: 'learning_path',
    action,
  });
}

function Minis({ minis }: { minis: NonNullable<LessonDecor['minis']> }) {
  if ('discs' in minis) {
    return (
      <span class="lesson__minis" aria-hidden="true">
        {minis.discs.map((disc) => <img src={disc.src} alt="" width={18} height={18} loading="lazy" decoding="async" />)}
      </span>
    );
  }
  if ('glyphs' in minis) {
    return (
      <span class="lesson__minis lesson__minis--glyphs" aria-hidden="true">
        {minis.glyphs.map((glyph) => <span>{glyph}</span>)}
      </span>
    );
  }
  return <span class="lesson__minis">{minis.text}</span>;
}

export default function LearningPath({ lessons = {}, children }: {
  lessons?: Partial<Record<StepId, LessonDecor>>;
  /** Where the path leads after the five lessons (the page passes the birth chart panel). */
  children?: ComponentChildren;
} = {}) {
  const { progress, ready, act } = useLearningProgress();
  const [savedEntry, setSavedEntry] = useState<typeof import('./LearningSavedEntry') | null>(null);
  const [entryError, setEntryError] = useState(false);
  const [entryBusy, setEntryBusy] = useState(false);
  const entryLoad = useRef(0);
  const entryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { entryLoad.current += 1; if (entryTimer.current) clearTimeout(entryTimer.current); }, []);
  const SavedEntry = savedEntry?.default;

  const { started, completed } = progress;
  const completedSet = useMemo(() => new Set(completed), [completed]);
  const startedSet = useMemo(() => new Set(started), [started]);
  const activeStep = useMemo(() => activeLearningStep(completed), [completed]);

  function complete(id: StepId) {
    if (!completedSet.has(id)) void act({ type: 'complete', id });
  }

  function restart() {
    void act({ type: 'restart' }).then((accepted) => { if (accepted) track('restart'); });
  }

  const count = completed.length;
  const inProgressCount = started.filter((id) => !completedSet.has(id)).length;
  const allDone = count === STEPS.length;

  return (
    <section class="learning-path" aria-labelledby="learning-path-title">
      <header class="learning-path__head">
        <div>
          <span class="kicker">Start here</span>
          <h2 class="h-2" id="learning-path-title">Five short lessons, in order</h2>
          <p>New to astrology? Each lesson is a few minutes of reading. Together they teach you to read any birth chart, starting with yours.</p>
        </div>
        <div class="learning-path__progress" aria-live="polite">
          <span>{ready ? `${count} of ${STEPS.length} read${inProgressCount ? ` · ${inProgressCount} started` : ''}` : `${STEPS.length} lessons to read`}</span>
          {ready && <div
            class="learning-path__bar"
            role="progressbar"
            aria-label="Learning path progress"
            aria-valuemin={0}
            aria-valuemax={STEPS.length}
            aria-valuenow={count}
            aria-valuetext={`${count} of ${STEPS.length} lessons read`}
          >
            {STEPS.map((step) => <i key={step.id} class={completedSet.has(step.id) ? 'is-on' : undefined} />)}
          </div>}
          <small class={`learning-path__note${progress.pageOnly ? ' learning-path__note--warn' : ''}`}>{progress.pageOnly ? PAGE_ONLY_COPY : 'Your progress stays on this device.'}</small>
        </div>
      </header>

      {ready && allDone && (
        <div class="learning-path__complete" role="status">
          <strong>You have a way forward.</strong>
          <span>Return to your chart when you want depth, or your horoscope when you want a quick check-in.</span>
        </div>
      )}

      <ol class="learning-path__steps">
        {STEPS.map((step, index) => {
          const done = completedSet.has(step.id);
          const hasStarted = startedSet.has(step.id);
          const active = activeStep?.id === step.id;
          const decor = lessons[step.id] ?? {};
          const state = done ? 'Read' : hasStarted ? 'Started' : active ? activeStep?.cue : null;
          return (
            <li
              key={step.id}
              data-learning-step={step.id}
              data-learning-state={done ? 'completed' : hasStarted ? 'started' : 'new'}
              class={`learning-step${active ? ' learning-step--active' : ''}${done ? ' learning-step--done' : ''}`}
            >
              <a
                class="learning-step__action lesson"
                href={step.href}
                onClick={(event) => {
                  if (event.button !== 0) return;
                  const nativeNavigation = event.metaKey || event.ctrlKey || event.shiftKey || event.altKey;
                  if (!nativeNavigation) event.preventDefault();
                  void act({ type: 'start', id: step.id }).then((accepted) => {
                    if (!accepted) return;
                    track(step.id);
                    if (!nativeNavigation) window.location.assign(step.href);
                  });
                }}
              >
                <span class="lesson__n" aria-hidden="true">{index + 1}</span>
                <span class="lesson__art" aria-hidden={decor.art ? undefined : 'true'}>
                  {decor.art && (
                    <img
                      src={decor.art.src}
                      srcset={decor.art.srcset}
                      sizes="(max-width: 760px) 92px, 196px"
                      width={decor.art.width}
                      height={decor.art.height}
                      alt={decor.art.alt}
                      loading="lazy"
                      decoding="async"
                    />
                  )}
                </span>
                <span class="lesson__body">
                  <span class="lesson__t">
                    {step.title}
                    {done && <span class="sr-only">, read</span>}
                  </span>
                  <span class="lesson__text">{step.body}</span>
                  {decor.minis && <Minis minis={decor.minis} />}
                </span>
                <span class="lesson__meta">
                  {state && (
                    <span class={`lesson__state${done ? ' lesson__state--done' : ''}`}>
                      {done && <svg viewBox="0 0 12 12" fill="none" aria-hidden="true"><path d="M2.5 6.4l2.3 2.3 4.7-5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" /></svg>}
                      {state}
                    </span>
                  )}
                  {decor.meta && <span>{decor.meta}</span>}
                </span>
                <span class="lesson__go" aria-hidden="true">→</span>
              </a>
              {ready && hasStarted && !done && (
                <label class="learning-step__reflection">
                  <input type="checkbox" checked={done} onChange={() => complete(step.id)} />
                  <span>{step.reflection}</span>
                </label>
              )}
            </li>
          );
        })}
      </ol>

      {ready && started.length > 0 && (
        <button class="learning-path__restart" type="button" onClick={restart}>
          Start this path over
        </button>
      )}

      {children}

      <details class="learning-path__practice">
        <summary>Have a saved chart? <span>Practice each lesson with your own placements</span></summary>
        {ready && (SavedEntry ? <SavedEntry /> : <div class="learning-practice learning-practice--entry">
          <h3>Learn with your chart</h3>
          <p>Practice a placement, a house and an aspect with a chart saved on this device.</p>
          <button type="button" class="btn btn--ghost" disabled={entryBusy} onClick={() => {
            if (entryBusy) return;
            const operation = ++entryLoad.current;
            setEntryBusy(true); setEntryError(false);
            entryTimer.current = setTimeout(() => {
              if (operation !== entryLoad.current) return;
              entryLoad.current += 1; setEntryBusy(false); setEntryError(true);
            }, 15_000);
            void import('./LearningSavedEntry').then((module) => {
              if (operation !== entryLoad.current) return;
              if (entryTimer.current) clearTimeout(entryTimer.current);
              setSavedEntry(module); setEntryBusy(false);
            }, () => {
              if (operation !== entryLoad.current) return;
              if (entryTimer.current) clearTimeout(entryTimer.current);
              setEntryError(true); setEntryBusy(false);
            });
          }}>{entryBusy ? 'Opening saved charts…' : 'Choose a saved chart'}</button>
          {entryError && <div role="alert"><p>Saved charts could not load. Reload this page to try again.</p>
            <button type="button" class="btn btn--ghost" onClick={() => window.location.reload()}>Reload page</button></div>}
        </div>)}
      </details>
    </section>
  );
}
