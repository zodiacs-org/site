/** Display only the known, bounded fields of an assistant's saved result. */
import type { SavedPageKind } from './saved-pages-config';

export interface SavedReadingSection { title: string; lines: string[] }
export interface SavedReading { sections: SavedReadingSection[]; note: string }
const object = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
const text = (value: unknown): string => typeof value === 'string' && value.length <= 600 ? value.replace(/[\p{Cc}]/gu, '').trim() : '';
const strings = (value: unknown): string[] => Array.isArray(value) ? value.slice(0, 20).map(text).filter(Boolean) : [];
const score = (value: unknown): string => typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 100 ? `${value}/100` : '';
const titleCase = (value: unknown): string => text(value).replace(/^./u, (char) => char.toUpperCase());

export function assistantSavedReading(value: unknown, kind: SavedPageKind): SavedReading | null {
  try {
    if (new TextEncoder().encode(JSON.stringify(value)).length > 8192) return null;
    const record = object(value);
    if (record.schema !== 'zodiacs.assistant-save.v1' || record.kind !== (kind === 'compatibility' ? 'comparison' : kind)) return null;
    const data = object(record.data);
    const sections: SavedReadingSection[] = [];
    const add = (title: string, lines: string[]) => { if (lines.some(Boolean)) sections.push({ title, lines: lines.filter(Boolean) }); };
    const chart = (raw: unknown, fallback: string) => {
      const person = object(raw);
      add(text(person.name) || text(person.label) || fallback, [
        [text(person.birthDate), text(person.time), text(person.zone), text(person.place)].filter(Boolean).join(' · '),
        ...['sun', 'moon', 'rising'].flatMap((body) => person[body] ? [`${titleCase(body)}: ${titleCase(person[body])}`] : []),
        person.timeKnown === false ? 'Birth time unknown; time-dependent placements are omitted.' : '',
      ]);
    };
    if (kind === 'chart') chart(data, 'Birth chart');
    if (kind === 'compatibility') {
      const rating = object(data.score), areas = object(rating.areas);
      add('Compatibility', [score(rating.overall), text(rating.verdict), text(rating.headline), ...['attraction', 'communication', 'stability'].flatMap((key) => score(areas[key]) ? [`${titleCase(key)}: ${score(areas[key])}`] : [])]);
      chart(data.a, 'Person A'); chart(data.b, 'Person B');
      add('Chart contacts', strings(data.contacts)); add('About this comparison', strings(data.notes));
    }
    if (kind === 'occasion') {
      const card = object(data.card), rating = object(data.rating), sky = object(data.sky);
      add(text(card.title) || 'Your occasion', [text(data.names), [text(data.date), text(data.time), text(data.zone), text(data.place)].filter(Boolean).join(' · '), text(card.interpretation), text(card.closing)]);
      add('Date rating', [score(rating.score), text(rating.verdict), ...strings(rating.reasons)]);
      add('The sky', [sky.sun ? `Sun: ${titleCase(sky.sun)}` : '', sky.moon ? `Moon: ${titleCase(sky.moon)}` : '', text(sky.moonPhase), strings(sky.retrograde).length ? `Retrograde: ${strings(sky.retrograde).join(', ')}` : '']);
      const bestDays = object(data.bestDays);
      if (Array.isArray(bestDays.best)) add('Suggested dates', bestDays.best.slice(0, 5).map((raw) => { const day = object(raw); return [text(day.date), score(day.score), text(day.verdict)].filter(Boolean).join(' · '); }));
    }
    if (kind === 'week') {
      if (!Array.isArray(data.items)) return null;
      add('Your saved week', [text(data.from) ? `Week from ${text(data.from)}` : '', text(data.zone), data.timeKnown === false ? 'Birth time unknown; time-dependent placements are omitted.' : '']);
      for (const raw of data.items.slice(0, 20)) {
        const item = object(raw);
        add(text(item.title) || 'This week', [text(item.when), text(item.line)]);
      }
      if (data.items.length === 0) add('This week', ['No close contacts to your chart this week.']);
    }
    return sections.length ? { sections, note: text(data.note) } : null;
  } catch { return null; }
}
