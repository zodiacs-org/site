/**
 * The Explorer's layer controls — map-style toggles under the wheel.
 * v1 exposes the two filters that answer real questions: the five aspect
 * types (each a pressed-state chip in its semantic chord color) and the
 * house spokes. The zodiac ring and planets ARE the chart, not layers.
 */
import AspectGlyph from '../../components/AspectGlyph';
import { aspectLabel } from '../../lib/i18n/astrology';
import { t, type CatalogLocale as Locale } from '../../lib/i18n';
import type { AspectType } from '../../lib/engine/types';
import { ALL_ASPECT_TYPES } from '../../lib/scene/types';

interface Props {
  aspectTypes: AspectType[];
  onAspectTypes: (types: AspectType[]) => void;
  showHouses: boolean;
  onShowHouses: (on: boolean) => void;
  /** House chip hidden entirely on no-time charts. */
  hasHouses: boolean;
  locale: Locale;
}

export default function LayerChips({
  aspectTypes, onAspectTypes, showHouses, onShowHouses, hasHouses, locale,
}: Props) {
  const toggle = (type: AspectType) => {
    onAspectTypes(aspectTypes.includes(type)
      ? aspectTypes.filter((x) => x !== type)
      : ALL_ASPECT_TYPES.filter((x) => x === type || aspectTypes.includes(x)));
  };
  return (
    <div class="xplr-chips" role="group" aria-label={t(locale, 'layersLabel')}>
      {ALL_ASPECT_TYPES.map((type) => (
        <button
          key={type}
          type="button"
          class="xplr-chip"
          data-aspect={type}
          aria-pressed={aspectTypes.includes(type)}
          onClick={() => toggle(type)}
        >
          <AspectGlyph type={type} size={11} class="xplr-chip__glyph" /> {aspectLabel(locale, type)}
        </button>
      ))}
      {hasHouses && (
        <button
          type="button"
          class="xplr-chip xplr-chip--houses"
          aria-pressed={showHouses}
          onClick={() => onShowHouses(!showHouses)}
        >
          {t(locale, 'layerHouses')}
        </button>
      )}
    </div>
  );
}
