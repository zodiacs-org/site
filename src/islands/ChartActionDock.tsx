export { default as ChartContext } from './explorer/ChartContext';
export { default as AspectPatternFeature } from './aspect-patterns/AspectPatternFeature';
export { default as EntityPicker } from './explorer/EntityPicker';
export { default as ReadingPath } from './explorer/ReadingPath';
export { default as Inspector } from './explorer/Inspector';
export { chartWeather, natalAspectLine, planetInHouseLine, topAspects } from '../lib/natal';

interface SignaturePreview {
  headline: string;
  evidence?: string | null;
}

interface Props {
  tourOpen: boolean;
  shareOnly?: boolean;
  signature: SignaturePreview | null;
  signatureLabel: string;
  actionLabel: string;
  guideLabel: string;
  shareLabel: string;
  shareStatusLabel: string;
  anotherLabel: string;
  anotherHref: string;
  /** Hands an unsaved chart over in session storage on a plain click; the href stays the plain page. */
  onAnotherClick?: (event: MouseEvent) => void;
  compareLabel?: string;
  compareHref?: string;
  onCompareClick?: (event: MouseEvent) => void;
  saveLabel?: string;
  onSave?: (trigger: HTMLButtonElement) => void;
  onGuide: () => void;
  onShare: () => void;
  shareDisabled?: boolean;
}

/**
 * One stable home for chart-result actions. On desktop it occupies the rail
 * beneath the inspector; on mobile it follows the wheel controls. The tour
 * keeps only the contextual Share action, while its sheet supplies the same
 * action where the external rail is covered.
 */
export default function ChartActionDock({
  tourOpen,
  shareOnly = false,
  signature,
  signatureLabel,
  actionLabel,
  guideLabel,
  shareLabel,
  shareStatusLabel,
  anotherLabel,
  anotherHref,
  onAnotherClick,
  compareLabel,
  compareHref,
  onCompareClick,
  saveLabel,
  onSave,
  onGuide,
  onShare,
  shareDisabled = false,
}: Props) {
  const showContextualActions = !tourOpen && !shareOnly;

  return (
    <aside
      class={`chart-action-dock${tourOpen ? ' chart-action-dock--tour' : ''}`}
      aria-label={actionLabel}
      data-chart-action-dock
    >
      {signature && (
        <div class="chart-action-dock__signature">
          <span class="mono--label">{signatureLabel}</span>
          <strong>{signature.headline}</strong>
          {signature.evidence && <small>{signature.evidence}</small>}
        </div>
      )}
      <div class="chart-action-dock__actions">
        {!tourOpen && saveLabel && (
          <button
            class="btn btn--primary"
            type="button"
            onClick={(event) => onSave?.(event.currentTarget)}
            aria-disabled={!onSave}
            data-save-chart
            data-primary-action={onSave ? 'save' : undefined}
          >
            <span aria-live="polite">{saveLabel}</span>
            <span class="orb" aria-hidden="true">{onSave ? '+' : '✓'}</span>
          </button>
        )}
        {showContextualActions && (
          <button class="btn btn--ghost" type="button" onClick={onGuide} data-tour-start>
            <span>{guideLabel}</span>
            <span class="orb" aria-hidden="true">→</span>
          </button>
        )}
        <button
          class="btn btn--ghost"
          type="button"
          onClick={onShare}
          disabled={shareDisabled}
          aria-label={shareLabel}
          data-share-card
        >
          <span>{shareStatusLabel}</span>
          <span class="orb" aria-hidden="true">↗</span>
        </button>
        {!tourOpen && compareLabel && compareHref && (
          <a class="btn btn--ghost" href={compareHref} onClick={onCompareClick} data-compare-with-mine>
            <span>{compareLabel}</span>
            <span class="orb" aria-hidden="true">→</span>
          </a>
        )}
        {showContextualActions && (
          <a class="btn btn--ghost" href={anotherHref} onClick={onAnotherClick} data-read-another-chart>
            <span>{anotherLabel}</span>
            <span class="orb" aria-hidden="true">→</span>
          </a>
        )}
      </div>
    </aside>
  );
}
