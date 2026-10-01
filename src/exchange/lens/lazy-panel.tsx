import type { ComponentType } from 'preact';
import { useEffect, useState } from 'preact/hooks';

/** Route-owned lazy panels without enlarging the shared compatibility runtime. */
export function lazyPanel<P extends object>(load: () => Promise<{ default: ComponentType<P> }>): ComponentType<P> {
  let cached: Promise<{ default: ComponentType<P> }> | null = null;
  return function PanelBoundary(props: P) {
    const [loaded, setLoaded] = useState<{ default: ComponentType<P> } | null>(null);
    const [error, setError] = useState(false);
    const [attempt, setAttempt] = useState(0);
    useEffect(() => {
      let active = true;
      setError(false);
      (cached ??= load()).then(module => { if (active) setLoaded(module); }).catch(() => { cached = null; if (active) setError(true); });
      return () => { active = false; };
    }, [attempt]);
    const Component = loaded?.default;
    if (Component) return <Component {...props} />;
    return error ? <p class="lens-error" role="alert">This panel could not load. <button class="lens-button" onClick={() => setAttempt(attempt + 1)}>Retry panel</button></p> : <p class="lens-muted" role="status">Opening workspace…</p>;
  };
}
