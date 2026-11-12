import { render } from 'preact-render-to-string';
import { describe, expect, it } from 'vitest';
import { CATALOG_LOCALES, t } from '../lib/i18n';
import { BirthFields } from './BirthFields';

const noop = () => {};

function fields(locale: (typeof CATALOG_LOCALES)[number]) {
  return render(
    <div>
      <BirthFields
        locale={locale} dateId="d" timeId="bt" placeId="p"
        date="" time="" timeKnown city={null}
        onDateChange={noop} onTimeChange={noop} onTimeKnownChange={noop} onCityChange={noop}
      />
    </div>,
  );
}

const escape = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;');

describe('the unknown birth time checkbox', () => {
  it.each(CATALOG_LOCALES)('is named after the Birth time label it belongs to (%s)', (locale) => {
    const html = fields(locale);
    const checkbox = html.match(/<input[^>]*type="checkbox"[^>]*>/)?.[0] ?? '';
    expect(checkbox).toContain('aria-labelledby="bt-label bt-unknown"');
    // Both ids exist and carry the locale's own words, Birth time first.
    const label = html.match(/<label[^>]*id="bt-label"[^>]*>([^<]*)<\/label>/)?.[1];
    const own = html.match(/<span id="bt-unknown">([^<]*)<\/span>/)?.[1];
    expect(label).toBe(escape(t(locale, 'birthTime')));
    expect(own).toBe(escape(t(locale, 'noBirthTime')));
    // The visible label still points at the time input.
    expect(html).toMatch(/<label[^>]*for="bt"/);
  });
});
