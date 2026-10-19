import type { ClientDirective } from 'astro';

const intentEvents = ['pointerover', 'pointerdown', 'focusin', 'keydown'] as const;
type FormControl = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
type FormControlState = {
  control: FormControl;
  index: number;
  id: string;
  value: string;
  checked: boolean | undefined;
  selected: string[] | undefined;
  dirty: boolean;
};
type PendingSubmit = {
  form: HTMLFormElement;
  submitter: HTMLButtonElement | HTMLInputElement | null;
};

function selectedState(control: FormControl) {
  return control instanceof HTMLSelectElement && control.multiple
    ? Array.from(control.selectedOptions, (option) => option.value)
    : undefined;
}

function hasNativeEdit(control: FormControl) {
  // Use native reset semantics, including normalized input defaults, disabled
  // first options and multiple selections, without changing the live control.
  const defaults = control.cloneNode(true) as FormControl;
  defaults.removeAttribute('form');
  const form = document.createElement('form');
  form.append(defaults);
  HTMLFormElement.prototype.reset.call(form);
  if (control instanceof HTMLSelectElement) {
    return Array.from(control.options).some((option, index) => option.selected !== (defaults as HTMLSelectElement).options[index]?.selected);
  }
  return control.value !== defaults.value
    || (control instanceof HTMLInputElement && control.checked !== (defaults as HTMLInputElement).checked);
}

function findFormState(states: FormControlState[], control: FormControl, index: number) {
  return states.find((candidate) => candidate.control === control)
    ?? (control.id ? states.find((candidate) => candidate.id === control.id) : undefined)
    ?? states.find((candidate) => candidate.index === index);
}

function formState(element: HTMLElement, previous: FormControlState[] = []): FormControlState[] {
  return Array.from(element.querySelectorAll<FormControl>('input, select, textarea')).map((control, index) => ({
    control,
    index,
    id: control.id,
    value: control.value,
    checked: control instanceof HTMLInputElement ? control.checked : undefined,
    selected: selectedState(control),
    // A tracked edit remains intentional even after returning to the default.
    dirty: findFormState(previous, control, index)?.dirty === true || hasNativeEdit(control),
  }));
}

function updateFormState(
  element: HTMLElement,
  states: FormControlState[],
  control: FormControl,
) {
  const controls = Array.from(element.querySelectorAll<FormControl>('input, select, textarea'));
  const index = controls.indexOf(control);
  const state = findFormState(states, control, index);
  if (!state) return;

  state.control = control;
  state.index = index;
  state.id = control.id;
  state.value = control.value;
  state.checked = control instanceof HTMLInputElement ? control.checked : undefined;
  state.selected = selectedState(control);
  state.dirty = true;
}

function restoreFormState(
  element: HTMLElement,
  states: ReturnType<typeof formState>,
) {
  const controls = Array.from(element.querySelectorAll<FormControl>('input, select, textarea'));
  let restored = false;
  for (const state of states) {
    // Shared/profile effects may initialize untouched fields during hydration.
    // Replaying their SSR defaults would overwrite that component state.
    if (!state.dirty) continue;
    const control = state.control.isConnected
      ? state.control
      : state.id
        ? element.querySelector<FormControl>(`#${CSS.escape(state.id)}`)
        : controls[state.index] ?? null;
    if (!control) continue;

    const valueChanged = control.value !== state.value;
    const checkedChanged = control instanceof HTMLInputElement
      && state.checked !== undefined
      && control.checked !== state.checked;
    const selectedChanged = state.selected !== undefined
      && JSON.stringify(selectedState(control)) !== JSON.stringify(state.selected);
    if (!valueChanged && !checkedChanged && !selectedChanged) continue;

    restored = true;
    control.value = state.value;
    if (control instanceof HTMLInputElement && state.checked !== undefined) {
      control.checked = state.checked;
    }
    if (control instanceof HTMLSelectElement && state.selected !== undefined) {
      // Hydration may reorder options. Preserve selected values, rather than
      // applying old option indexes to a new option order.
      const remaining = [...state.selected];
      Array.from(control.options).forEach((option) => {
        const index = remaining.indexOf(option.value);
        option.selected = index >= 0;
        if (index >= 0) remaining.splice(index, 1);
      });
    }
    control.dispatchEvent(new Event('input', { bubbles: true }));
    control.dispatchEvent(new Event('change', { bubbles: true }));
  }
  return restored;
}

function afterHydrationCommit() {
  return new Promise<void>((resolve) => {
    let firstFrame: number | undefined;
    let secondFrame: number | undefined;
    let settled = false;
    const timeout = window.setTimeout(finish, 120);

    function finish() {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      if (firstFrame !== undefined) window.cancelAnimationFrame(firstFrame);
      if (secondFrame !== undefined) window.cancelAnimationFrame(secondFrame);
      resolve();
    }

    // Hidden documents can suspend animation frames indefinitely. The timeout
    // above is the commit barrier in that state and also protects a tab that
    // becomes hidden between the two visible frames.
    if (document.visibilityState === 'hidden') return;
    firstFrame = window.requestAnimationFrame(() => {
      secondFrame = window.requestAnimationFrame(finish);
    });
  });
}

function replaySubmit(element: HTMLElement, pending: PendingSubmit) {
  const form = pending.form.isConnected
    ? pending.form
    : element.querySelector<HTMLFormElement>('form');
  if (!form) return;
  const submitter = pending.submitter?.isConnected && form.contains(pending.submitter)
    ? pending.submitter
    : null;

  if (typeof form.requestSubmit === 'function') {
    if (submitter) form.requestSubmit(submitter);
    else form.requestSubmit();
    return;
  }

  // requestSubmit reached Safari in 15.4. The fallback preserves the component
  // submit handler on older engines; this form performs its own validation.
  const event = typeof SubmitEvent === 'function'
    ? new SubmitEvent('submit', { bubbles: true, cancelable: true, submitter })
    : new Event('submit', { bubbles: true, cancelable: true });
  form.dispatchEvent(event);
}

/**
 * Hydrate an SSR island on first intent, or shortly after the document load.
 * Shared-chart receivers hydrate immediately because their URL state is itself
 * an explicit request to open the interactive result.
 */
const interactionDirective: ClientDirective = (load, options, element) => {
  let started = false;
  let ready = false;
  let intentArmed = false;
  let hydrationAttempted = false;
  let fallback: number | undefined;
  let pendingFormState = formState(element);
  let pendingSubmit: PendingSubmit | null = null;

  const cleanupIntent = () => {
    if (!intentArmed) return;
    intentArmed = false;
    for (const eventName of intentEvents) {
      element.removeEventListener(eventName, start, true);
    }
    window.removeEventListener('load', scheduleFallback);
    if (fallback !== undefined) window.clearTimeout(fallback);
    fallback = undefined;
  };
  const scheduleFallback = () => {
    fallback = window.setTimeout(start, 600);
  };
  const armIntent = () => {
    if (intentArmed || ready) return;
    intentArmed = true;
    for (const eventName of intentEvents) {
      element.addEventListener(eventName, start, { capture: true, once: true });
    }
  };
  const rearmAfterFailure = () => {
    started = false;
    armIntent();
  };
  const start = () => {
    if (started || ready) return;
    started = true;
    cleanupIntent();
    void (async () => {
      let hydrate: Awaited<ReturnType<typeof load>>;
      try {
        hydrate = await load();
      } catch {
        rearmAfterFailure();
        return;
      }

      // Intent can arrive while the island module is still in flight. Snapshot
      // at the last possible moment on the first hydration attempt so browser
      // autofill and native edits made without an input event are also kept.
      if (!hydrationAttempted) pendingFormState = formState(element, pendingFormState);
      hydrationAttempted = true;
      try {
        await hydrate();
      } catch {
        rearmAfterFailure();
        return;
      }

      await afterHydrationCommit();
      element.removeEventListener('input', trackFormChange, true);
      element.removeEventListener('change', trackFormChange, true);
      const restored = restoreFormState(element, pendingFormState);
      // Controlled input handlers update component state from the synthetic
      // events above. Let that state commit before replaying a queued submit.
      if (restored) await afterHydrationCommit();
      ready = true;
      element.removeEventListener('submit', guardSubmit, true);

      const submit = pendingSubmit;
      pendingSubmit = null;
      if (submit) replaySubmit(element, submit);
    })();
  };
  const trackFormChange = (event: Event) => {
    const control = event.target;
    if (
      control instanceof HTMLInputElement
      || control instanceof HTMLSelectElement
      || control instanceof HTMLTextAreaElement
    ) {
      updateFormState(element, pendingFormState, control);
    }
  };
  const guardSubmit = (event: Event) => {
    if (ready || !(event.target instanceof HTMLFormElement)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const submitter = 'submitter' in event
      && (event.submitter instanceof HTMLButtonElement || event.submitter instanceof HTMLInputElement)
      ? event.submitter
      : null;
    pendingSubmit ??= { form: event.target, submitter };
    start();
  };

  element.addEventListener('input', trackFormChange, true);
  element.addEventListener('change', trackFormChange, true);
  element.addEventListener('submit', guardSubmit, true);
  armIntent();

  const directiveValue: unknown = options.value;
  const eagerHash = typeof directiveValue === 'object'
    && directiveValue !== null
    && 'eagerHash' in directiveValue
    && directiveValue.eagerHash === true;
  if (eagerHash && /(?:^|[&#])(?:p|c)=/u.test(window.location.hash)) {
    start();
  } else if (document.readyState === 'complete') {
    scheduleFallback();
  } else {
    window.addEventListener('load', scheduleFallback, { once: true });
  }
};

export default interactionDirective;
