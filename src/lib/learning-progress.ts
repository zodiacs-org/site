/**
 * The five lessons on /learn/, in reading order: the signs, the planets, the
 * houses, the aspects, then the big three. 'planets-houses', 'aspects' and
 * 'big-three' keep the ids the saved-chart practice exercises and earlier
 * stored progress use; ids no longer on the path are dropped on read.
 */
export const LEARNING_STEP_IDS = ['signs', 'planets', 'planets-houses', 'aspects', 'big-three'] as const;
export type StepId = (typeof LEARNING_STEP_IDS)[number];
export type LearningStepCue = 'Start here' | 'Up next';

export function activeLearningStep(completed: readonly StepId[]): {
  id: StepId;
  cue: LearningStepCue;
} | null {
  const completedSet = new Set(completed);
  const next = LEARNING_STEP_IDS.find((id) => !completedSet.has(id));
  if (!next) return null;
  return { id: next, cue: completed.length === 0 ? 'Start here' : 'Up next' };
}

export function normalizeLearningProgress(value: unknown): StepId[] {
  if (!Array.isArray(value)) return [];
  const requested = new Set(value.filter((id): id is string => typeof id === 'string'));
  return LEARNING_STEP_IDS.filter((id) => requested.has(id));
}

export interface LearningProgress {
  started: StepId[];
  completed: StepId[];
}

export function normalizeLearningState(value: unknown): LearningProgress {
  // The old array recorded link opens as completion. Preserve those visits
  // as started; they cannot establish that somebody read a lesson.
  if (Array.isArray(value)) return { started: normalizeLearningProgress(value), completed: [] };
  if (!value || typeof value !== 'object' || !('version' in value) || value.version !== 2) {
    return { started: [], completed: [] };
  }
  const record = value as Record<string, unknown>;
  const started = normalizeLearningProgress(record.started);
  return {
    started,
    completed: normalizeLearningProgress(record.completed).filter((id) => started.includes(id)),
  };
}

export function updateLearningProgress(
  progress: LearningProgress,
  action: 'start' | 'complete',
  id: StepId,
): LearningProgress {
  if (action === 'start') {
    return { ...progress, started: normalizeLearningProgress([...progress.started, id]) };
  }
  if (!progress.started.includes(id)) return progress;
  return { ...progress, completed: normalizeLearningProgress([...progress.completed, id]) };
}

export const LEARNING_STORAGE_KEY = 'zodiacs:learning-path:v2';
export const LEGACY_LEARNING_KEY = 'zodiacs:learning-path:v1';
export const LEARNING_LOCK = 'zodiacs:learning-path:v2:write';
export const LEARNING_SAVE_BOUND_MS = 1_500;
export const PAGE_ONLY_COPY = 'Changes on this page cannot be saved. Returning may show your last saved progress.';
export type LearningAction = { type: 'start' | 'complete'; id: StepId } | { type: 'restart' };
export interface LearningSnapshot extends LearningProgress { pageOnly: boolean }
export interface LearningEnvironment {
  read(key: string): string | null;
  write(key: string, value: string): void;
  lock?: (name: string, signal: AbortSignal, transaction: () => void) => Promise<unknown>;
}

/** One owner per document. Only cooperating lock holders write persisted v2. */
export function createLearningProgressOwner(env: LearningEnvironment) {
  let state: LearningSnapshot = { started: [], completed: [], pageOnly: false };
  let generation = 0;
  const listeners = new Set<() => void>();
  const snapshot = (): LearningSnapshot => ({ ...state, started: [...state.started], completed: [...state.completed] });
  const notify = () => listeners.forEach((listener) => { try { listener(); } catch { /* A surface cannot roll back a commit. */ } });
  const read = () => normalizeLearningState(JSON.parse(env.read(LEARNING_STORAGE_KEY)
    ?? env.read(LEGACY_LEARNING_KEY) ?? 'null'));
  function refresh() {
    if (state.pageOnly) return;
    try { state = { ...read(), pageOnly: false }; }
    catch { state = { ...state, pageOnly: true }; }
    notify();
  }
  function act(action: LearningAction, current: () => boolean = () => true): Promise<boolean> {
    const requestGeneration = generation;
    const allowed = () => { try { return requestGeneration === generation && current(); } catch { return false; } };
    const apply = (progress: LearningProgress) => action.type === 'restart'
      ? { started: [], completed: [] } : updateLearningProgress(progress, action.type, action.id);
    const admissible = (progress: LearningProgress) => action.type !== 'complete' || progress.started.includes(action.id);
    function publish(next: LearningProgress, pageOnly: boolean) {
      if (action.type === 'restart') generation += 1;
      state = { ...next, pageOnly };
      notify();
    }
    function fallback() {
      // Preserve the last successful snapshot; never refresh over unsaved work.
      state = { ...state, pageOnly: true };
      if (!allowed() || !admissible(state)) { notify(); return false; }
      publish(apply(state), true);
      return true;
    }
    if (!allowed()) return Promise.resolve(false);
    if (state.pageOnly || !env.lock) return Promise.resolve(fallback());
    return new Promise<boolean>((resolve) => {
      const controller = new AbortController();
      let finished = false;
      const finish = (accepted: boolean) => { finished = true; clearTimeout(timer); resolve(accepted); };
      const fail = () => {
        if (finished) return;
        // Invalidate before abort/fallback: even a nonconforming late callback cannot write.
        finished = true;
        controller.abort();
        clearTimeout(timer);
        resolve(fallback());
      };
      const timer = setTimeout(fail, LEARNING_SAVE_BOUND_MS);
      try {
        Promise.resolve(env.lock!(LEARNING_LOCK, controller.signal, () => {
          if (finished) return;
          if (!allowed()) { finish(false); return; }
          if (state.pageOnly) { finish(fallback()); return; }
          try {
            const latest = read();
            // Keep last successful read for a possible write failure.
            state = { ...latest, pageOnly: false };
            if (!admissible(latest)) { notify(); finish(false); return; }
            const next = apply(latest);
            env.write(LEARNING_STORAGE_KEY, JSON.stringify({ version: 2, ...next }));
            publish(next, false);
            finish(true);
          } catch { fail(); }
        })).catch(fail);
      } catch { fail(); }
    });
  }
  refresh();
  return { snapshot, refresh, act, restartGeneration: () => generation,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; } };
}

export type LearningProgressOwner = ReturnType<typeof createLearningProgressOwner>;
let documentOwner: LearningProgressOwner | undefined;
export function learningProgressOwner(): LearningProgressOwner {
  if (typeof window === 'undefined') throw new Error('Learning progress is browser-owned');
  if (!documentOwner) {
    let lock: LearningEnvironment['lock'];
    try {
      if (typeof navigator.locks?.request === 'function') {
        lock = (name, signal, transaction) => navigator.locks.request(name, { mode: 'exclusive', signal }, transaction);
      }
    } catch { /* An inaccessible lock service selects the same page-only fallback. */ }
    documentOwner = createLearningProgressOwner({
      read: (key) => window.localStorage.getItem(key),
      write: (key, value) => window.localStorage.setItem(key, value),
      lock,
    });
    window.addEventListener('storage', (event) => {
      if (event.key === null || event.key === LEARNING_STORAGE_KEY || event.key === LEGACY_LEARNING_KEY) documentOwner!.refresh();
    });
    window.addEventListener('pageshow', () => documentOwner!.refresh());
  }
  return documentOwner;
}
