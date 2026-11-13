import AspectGlyph from '../../components/AspectGlyph';
import PlanetGlyph from '../../components/PlanetGlyph';
import { contactLine } from '../../lib/contact-line';
import { aspectLabel, planetLabel } from '../../lib/i18n/astrology';
import { t, type CatalogLocale as Locale } from '../../lib/i18n';
import type { RelationshipContact, RelationshipGridData, RelationshipPointName } from './relationshipData';
import { relationshipContactId } from './relationshipData';
import { synastryCorpusLine } from './synastryLines';

interface AspectGridProps {
  locale: Locale;
  aLabel: string;
  bLabel: string;
  grid: RelationshipGridData;
  selectedId: string | null;
  onSelect: (contact: RelationshipContact) => void;
}

const COPY = {
  en: {
    caption: '{a} by {b} aspect grid',
    empty: 'No major aspect',
    contact: ["'s ", ', orb ', ' degrees'],
  },
  es: {
    caption: 'Cuadrícula de aspectos de {a} y {b}',
    empty: 'Sin aspecto mayor',
    contact: [': ', ', orbe ', ' grados'],
  },
  pt: {
    caption: 'Grade de aspectos de {a} e {b}',
    empty: 'Sem aspecto maior',
    contact: [': ', ', orbe ', ' graus'],
  },
  fr: {
    caption: 'Grille des aspects entre {a} et {b}',
    empty: 'Aucun aspect majeur',
    contact: ['\u00a0: ', ', orbe ', ' degrés'],
  },
  it: {
    caption: 'Griglia degli aspetti tra {a} e {b}',
    empty: 'Nessun aspetto maggiore',
    contact: [': ', ', orbita ', ' gradi'],
  },
  ru: {
    caption: 'Сетка аспектов: {a} и {b}',
    empty: 'Нет мажорного аспекта',
    contact: [': ', ', орбис ', '°'],
  },
} as const satisfies Record<Locale, { caption: string; empty: string; contact: readonly [string, string, string] }>;

export const formatRelationshipCopy = (text: string, values: Record<string, string>) =>
  text.replace(/\{(\w+)\}/g, (match, key) => values[key] ?? match);

const isAngle = (name: RelationshipPointName): name is 'ASC' | 'MC' => name === 'ASC' || name === 'MC';
const pointLabel = (locale: Locale, name: RelationshipPointName) => isAngle(name) ? name : planetLabel(locale, name);

export function RelationshipContactPoint({ locale, name }: { locale: Locale; name: RelationshipPointName }) {
  return isAngle(name) ? <>{name}</> : (
    <><PlanetGlyph body={name} size={13} class="pg-inline" /> {planetLabel(locale, name)}</>
  );
}

export function AspectGrid({
  locale,
  aLabel,
  bLabel,
  grid,
  selectedId,
  onSelect,
}: AspectGridProps) {
  const c = COPY[locale];
  const selected = selectedId
    ? grid.contacts.find((contact) => relationshipContactId(contact) === selectedId) ?? null
    : null;
  const curated = selected ? synastryCorpusLine(selected.a, selected.b, selected.type) : null;
  const reading = selected
    ? curated ?? contactLine(aLabel, selected.a, bLabel, selected.b, selected.type)
    : null;
  const caption = formatRelationshipCopy(c.caption, { a: aLabel, b: bLabel });

  return (
    <div class="rgrid" data-relationship-grid>
      <div
        class="rgrid__scroll"
        role="region"
        aria-label={caption}
        tabIndex={0}
      >
        <table class="rgrid__table">
          <caption class="sr-only">{caption}</caption>
          <thead>
            <tr>
              <th class="rgrid__corner" scope="col"><span aria-hidden="true">A × B</span></th>
              {grid.columns.map((column) => (
                <th scope="col" key={column.name}>{pointLabel(locale, column.name)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {grid.rows.map((row, rowIndex) => (
              <tr key={row.name}>
                <th scope="row">{pointLabel(locale, row.name)}</th>
                {grid.cells[rowIndex].map((contact, columnIndex) => {
                  if (!contact) {
                    return (
                      <td key={grid.columns[columnIndex].name}>
                        <span class="rgrid__empty" aria-hidden="true">·</span>
                        <span class="sr-only">{c.empty}</span>
                      </td>
                    );
                  }
                  const id = relationshipContactId(contact);
                  const active = selectedId === id;
                  return (
                    <td key={grid.columns[columnIndex].name}>
                      <button
                        type="button"
                        class={`rgrid__contact rgrid__contact--${contact.type}${active ? ' is-focus' : ''}`}
                        aria-label={`${aLabel}${c.contact[0]}${pointLabel(locale, contact.a)} ${aspectLabel(locale, contact.type)} ${bLabel}${c.contact[0]}${pointLabel(locale, contact.b)}${c.contact[1]}${contact.orb.toFixed(1)}${c.contact[2]}`}
                        aria-pressed={active}
                        onClick={() => onSelect(contact)}
                        data-grid-contact={id}
                      >
                        <AspectGlyph type={contact.type} size={15} />
                        <span class="mono">{contact.orb.toFixed(1)}°</span>
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selected && reading && (
        <div class="tring__focus rgrid__detail" role="status" data-grid-detail>
          <span class="tring__focus-receipt mono">
            {aLabel}: <RelationshipContactPoint locale={locale} name={selected.a} />
            {' '}<AspectGlyph type={selected.type} size={13} class="pg-inline" /> {aspectLabel(locale, selected.type)}
            {' '}{bLabel}: <RelationshipContactPoint locale={locale} name={selected.b} />
            {' · '}{t(locale, 'orb')} {selected.orb.toFixed(1)}°
          </span>
          {locale === 'en' && (
            <p
              class="tring__focus-read"
              data-curated-line={curated ? '' : undefined}
              data-fallback-line={curated ? undefined : ''}
            >
              {reading}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
