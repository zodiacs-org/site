/** Birthplace typeahead over the offline GeoNames index. */
import { useEffect, useRef, useState } from 'preact/hooks';
import type { City } from '../lib/geo/search';
import { t, type CatalogLocale as Locale } from '../lib/i18n';
import { loadModule } from '../lib/module-load';
import CalculationReload, { calculationError } from './CalculationReload';

const loadSearch = () => loadModule(() => import('../lib/geo/search'));

interface Props {
  onSelect: (city: City | null) => void;
  selected: City | null;
  id?: string;
  locale?: Locale;
  validationError?: string;
  selectionHint?: string;
  required?: boolean;
}

export default function PlaceSearch({
  onSelect,
  selected,
  id = 'place',
  locale = 'en',
  validationError,
  selectionHint,
  required = false,
}: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<City[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const debounce = useRef<ReturnType<typeof setTimeout>>();
  const requestToken = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const chipRef = useRef<HTMLInputElement>(null);
  const focusChip = useRef(false);

  // After a keyboard or pointer choice the combobox is replaced by the chip;
  // focus follows to the same field instead of falling back to the body.
  useEffect(() => {
    if (!selected || !focusChip.current) return;
    focusChip.current = false;
    chipRef.current?.focus();
  }, [selected]);
  const pickHint = validationError || (!selected && query.trim() ? selectionHint : '');

  useEffect(() => {
    // Continue a query already entered into the visible server form.
    const draft = inputRef.current?.value;
    if (draft && !requestToken.current) onInput(draft);
    return () => {
      clearTimeout(debounce.current);
      ++requestToken.current;
    };
  }, []);

  useEffect(() => {
    if (selected) {
      clearTimeout(debounce.current);
      ++requestToken.current;
      setOpen(false);
      setLoading(false);
    }
  }, [selected]);

  function onInput(value: string) {
    const token = ++requestToken.current;
    setQuery(value);
    onSelect(null);
    clearTimeout(debounce.current);
    setOpen(false);
    setError('');
    value = value.trim();
    setLoading(value.length >= 2);

    if (!value[1]) return;

    debounce.current = setTimeout(async () => {
      try {
        const { searchCities } = await loadSearch();
        if (token !== requestToken.current) return;
        const cities = await searchCities(value);
        if (token === requestToken.current) {
          setResults(cities);
          setActive(0);
          setOpen(true);
        }
      } catch (cause) {
        if (token === requestToken.current) setError(calculationError(cause, locale, t(locale, 'placeError')));
      } finally {
        if (token === requestToken.current) setLoading(false);
      }
    }, 120);
  }

  function choose(city: City) {
    clearTimeout(debounce.current);
    ++requestToken.current;
    focusChip.current = true;
    onSelect(city);
    setQuery('');
    setOpen(false);
    setLoading(false);
  }

  function onKeyDown(e: KeyboardEvent) {
    if (!open) return;
    if (e.key === 'ArrowDown' && results.length) { e.preventDefault(); setActive((a) => Math.min(a + 1, results.length - 1)); }
    else if (e.key === 'ArrowUp' && results.length) { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); if (results[active]) choose(results[active]); }
    else if (e.key === 'Escape') setOpen(false);
  }

  if (selected) {
    // A real (read-only) input keeps the page's <label for> association
    // alive in the selected state and gives the value back to AT.
    const chipValue = [selected.name, [selected.admin1, selected.country].filter(Boolean).join(', ')]
      .filter(Boolean)
      .join(' · ');
    return (
      <div class="place place--selected">
        <span class="place__chip">
          <input id={id} ref={chipRef} class="place__chip-value" readOnly value={chipValue} />
          <button type="button" class="place__clear" aria-label={t(locale, 'placeChange')} onClick={() => onSelect(null)}>×</button>
        </span>
      </div>
    );
  }

  return (
    <div class="place" onFocusOut={(event) => {
      if (!(event.currentTarget as HTMLDivElement).contains(event.relatedTarget as Node | null)) {
        clearTimeout(debounce.current);
        ++requestToken.current;
        setOpen(false);
        setLoading(false);
      }
    }}>
      <input
        id={id}
        ref={inputRef}
        class="field__input"
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
        aria-controls={`${id}-list`}
        aria-activedescendant={open && results[active] ? `${id}-opt-${active}` : undefined}
        aria-describedby={pickHint ? `${id}-pick-hint` : undefined}
        aria-invalid={validationError ? 'true' : undefined}
        aria-required={required || undefined}
        placeholder={t(locale, 'placePlaceholder')}
        autocomplete="off"
        // Leave an empty first render alone so hydration preserves early input.
        value={query || undefined}
        onFocus={() => { void loadSearch().then(({ preloadIndex }) => { void preloadIndex(); }, () => {}); }}
        onInput={(e) => onInput((e.target as HTMLInputElement).value)}
        onKeyDown={onKeyDown}
      />
      {pickHint && (
        <p
          id={`${id}-pick-hint`}
          class={validationError ? 'place__error' : 'place__hint'}
          role={validationError ? 'alert' : undefined}
        >
          {pickHint}
        </p>
      )}
      {loading && <p class="place__hint" role="status">{t(locale, 'placeSearching')}</p>}
      {error && (
        <div class="place__error">
          <p role="alert">{error}</p>
          <button class="btn btn--glass" type="button" onClick={() => {
            inputRef.current?.focus();
            onInput(query);
          }}>{t(locale, 'calculationRetry')}</button>
          <CalculationReload error={error} locale={locale} />
        </div>
      )}
      {open && (
        <ul class="place__list" id={`${id}-list`} role="listbox">
          {results.length ? (
            results.map((c, i) => (
              <li key={c.name + c.lat + c.lon} role="none">
                <button
                  type="button"
                  id={`${id}-opt-${i}`}
                  role="option"
                  aria-selected={i === active}
                  tabIndex={-1}
                  class={i === active ? 'place__option is-active' : 'place__option'}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => choose(c)}
                >
                  <span class="place__name">{c.name}</span>
                  <span class="place__meta">{[c.admin1, c.country].filter(Boolean).join(', ')}</span>
                </button>
              </li>
            ))
          ) : (
            <li class="place__empty" role="option" aria-disabled={true}>
              {t(locale, 'placeNoResults')}
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
