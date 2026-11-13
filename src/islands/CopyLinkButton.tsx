import type { ComponentChildren } from 'preact';

export type CopyLinkState = 'idle' | 'copied' | 'manual';

interface CopyLinkButtonProps {
  url: string;
  state: CopyLinkState;
  onStateChange: (state: CopyLinkState) => void;
  idleLabel: ComponentChildren;
  copiedLabel: ComponentChildren;
  ariaLabel: string;
  buttonClass: string;
  dataHook: 'share' | 'invite' | 'positions' | 'preview' | 'details';
  onCopied?: () => void;
  children?: ComponentChildren;
}

/** Clipboard button with the existing select-and-copy fallback. */
export function CopyLinkButton({
  url,
  state,
  onStateChange,
  idleLabel,
  copiedLabel,
  ariaLabel,
  buttonClass,
  dataHook,
  onCopied,
  children,
}: CopyLinkButtonProps) {
  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      onStateChange('copied');
      onCopied?.();
    } catch {
      onStateChange('manual');
    }
  }

  return (
    <>
      <div class="calc__actions">
        <button
          class={buttonClass}
          type="button"
          onClick={copy}
          data-share-link={dataHook === 'share' ? true : undefined}
          data-invite-link={dataHook === 'invite' ? true : undefined}
          data-positions-link={dataHook === 'positions' ? true : undefined}
          data-preview-link={dataHook === 'preview' ? true : undefined}
          data-details-link={dataHook === 'details' ? true : undefined}
        >
          <span>{state === 'copied' ? copiedLabel : idleLabel}</span>
          <span class="orb" aria-hidden="true">{state === 'copied' ? '✓' : '⧉'}</span>
        </button>
      </div>
      {state === 'manual' && (
        <input
          class="field__input calc__share-url" type="text" readOnly value={url}
          aria-label={ariaLabel}
          onFocus={(e) => (e.target as HTMLInputElement).select()}
        />
      )}
      {children}
    </>
  );
}
