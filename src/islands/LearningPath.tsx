import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { activeLearningStep, PAGE_ONLY_COPY, type StepId } from '../lib/learning-progress';
import { useLearningProgress } from '../lib/use-learning-progress';
import './LearningPractice.css';
export { activeLearningStep, normalizeLearningProgress, normalizeLearningState, updateLearningProgress } from '../lib/learning-progress';
export type { StepId, LearningProgress, LearningStepCue } from '../lib/learning-progress';

const STEPS = [
  {
    id: 'big-three',
    eyebrow: 'Why am I like this?',
    title: 'Meet the three sides of you',
    body: 'Your Sun, Moon, and rising sign separate what drives you, what you need, and how people first read you.',
    why: 'It can explain why the outside version of you does not always match how you feel inside.',
    href: '/birth-chart/',
    action: 'Show me my three',
    reflection: 'I have read my available chart placements and can describe what one means.',
  },
  {
    id: 'planets-houses',
    eyebrow: 'Where does it show up?',
    title: 'Find the life areas that matter most',
    body: 'The houses place your chart in real life: work, love, home, money, friendships, and the parts of you kept private.',
    why: 'It turns personality language into something you can actually notice in your day-to-day life.',
    href: '/learn/houses/',
    action: 'See the life areas',
    reflection: 'I can name one house and the area of life it describes.',
  },
  {
    id: 'aspects',
    eyebrow: 'Why does this repeat?',
    title: 'Recognize one pattern you keep meeting',
    body: 'Aspects connect two sides of you. They can describe a natural talent, a familiar tension, or a choice that keeps returning.',
    why: 'Naming the pattern gives you a chance to use it on purpose instead of running it on autopilot.',
    href: '/learn/aspects/',
    action: 'Understand my patterns',
    reflection: 'I can describe how one aspect connects two planets.',
  },
  {
    id: 'whole-chart',
    eyebrow: 'What is happening now?',
    title: 'See which themes may be louder today',
    body: 'Your birth chart stays the same. The moving sky adds timing by showing which parts of it are being activated now.',
    why: 'This is useful for reflection and planning, not proof that one unavoidable event will happen.',
    href: '/today/',
    action: 'See what is active now',
    reflection: 'I have read today’s themes and considered one in my own life.',
  },
  {
    id: 'follow-sky',
    eyebrow: 'What comes next?',
    title: 'Choose your way to look ahead',
    body: 'Use your Sun-sign horoscope for a simple monthly forecast, or your saved chart for a more personal birthday-year view.',
    why: 'Think weather, not fate: a forecast can point to a theme, while your choices shape what happens next.',
    href: '/horoscopes/',
    action: 'Read my horoscope',
    reflection: 'I have read a forecast and chosen one theme to reflect on.',
  },
] as const;

function track(action: string) {
  (window as Window & {
    zodiacsAnalytics?: { track?: (name: string, properties: Record<string, string>) => void };
  }).zodiacsAnalytics?.track?.('next_action_clicked', {
    state: 'learning_path',
    action,
  });
}

export default function LearningPath() {
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
    <section class="learning-path shell" aria-labelledby="learning-path-title">
      <div class="core learning-path__core">
        <header class="learning-path__head">
          <div>
            <h2 id="learning-path-title">Your reading path</h2>
            <p class="learning-path__note">Check off each step as you go. {progress.pageOnly ? PAGE_ONLY_COPY : 'Your progress stays on this device.'}</p>
          </div>
          <div class="learning-path__progress" aria-live="polite">
            <span>{ready ? `${count} of ${STEPS.length} complete${inProgressCount ? ` · ${inProgressCount} started` : ''}` : `${STEPS.length} steps to explore`}</span>
            {ready && <div
              class="learning-path__bar"
              role="progressbar"
              aria-label="Learning path progress"
              aria-valuemin={0}
              aria-valuemax={STEPS.length}
              aria-valuenow={count}
              aria-valuetext={`${count} of ${STEPS.length} steps complete`}
            >
              <span style={{ width: `${(count / STEPS.length) * 100}%` }} />
            </div>}
          </div>
        </header>

        <details class="learning-path__practice">
          <summary>Practice with a saved chart</summary>
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
            return (
              <li
                key={step.id}
                data-learning-step={step.id}
                data-learning-state={done ? 'completed' : hasStarted ? 'started' : 'new'}
                class={`learning-step${active ? ' learning-step--active' : ''}${done ? ' learning-step--done' : ''}`}
              >
                {done ? (
                  <>
                    <span class="learning-step__check learning-step__check--status" aria-hidden="true">✓</span>
                    <span class="sr-only">{step.title}, completed.</span>
                  </>
                ) : (
                  <span class="learning-step__check learning-step__check--status" aria-hidden="true">
                    {index + 1}
                  </span>
                )}
                <div class="learning-step__copy">
                  <span class="mono learning-step__eyebrow">{step.eyebrow}</span>
                  <h3>{step.title}</h3>
                  <p>{step.body}</p>
                  <p class="learning-step__why"><strong>Why it matters:</strong> {step.why}</p>
                  {ready && hasStarted && !done && (
                    <label class="learning-step__reflection">
                      <input type="checkbox" checked={done} onChange={() => complete(step.id)} />
                      <span>{step.reflection}</span>
                    </label>
                  )}
                </div>
                <div class="learning-step__action-wrap">
                  {(active || hasStarted || done) && (
                    <span class="mono learning-step__next-cue">{done ? 'Completed' : hasStarted ? 'Started' : activeStep?.cue}</span>
                  )}
                  <a
                    class={`btn ${active ? 'btn--primary' : 'btn--ghost'} learning-step__action`}
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
                    <span>{done ? 'Open again' : hasStarted ? 'Continue reading' : step.action}</span>
                    <span class="orb" aria-hidden="true">→</span>
                  </a>
                </div>
              </li>
            );
          })}
        </ol>

        {ready && started.length > 0 && (
          <button class="learning-path__restart" type="button" onClick={restart}>
            Start this path over
          </button>
        )}
      </div>
    </section>
  );
}
