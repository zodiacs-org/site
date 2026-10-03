import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
const read = path => readFileSync(path, 'utf8');
describe('owner privacy boundaries', () => {
  it('offers chart sharing through fragments and local image files only', () => {
    const source = read('src/islands/ChartShareDialog.tsx');
    expect(source).toContain('${receiverPath}#p=${token}');
    expect(source).toContain('savePreparedChartCard(artifact)');
    expect(source).not.toMatch(/api\/og|previewQuery|links\.preview/);
  });
  it('offers local calendar snapshots without server-bound birth codes', () => {
    const source = read('src/islands/CalendarSubscribe.tsx');
    expect(source).toContain("downloadCalendarFile(calendar, 'zodiacs-transit-contacts.ics')");
    expect(source).not.toMatch(/webcal:|api\/calendar|calendarToken|data-calendar-subscribe/);
    expect(read('api/calendar/transits.ts')).toContain("send(res, 410, 'text/plain'");
  });
  it('ships both approved notices in all six catalogs and privacy pages', () => {
    for (const locale of ['en', 'es', 'pt', 'fr', 'it', 'ru']) {
      const catalog = read(`src/lib/i18n/ui/${locale}.ts`);
      expect(catalog).toContain('trustWalletNotice:');
      expect(catalog).toContain('trustGuideNotice:');
      const page = read(`src/pages/${locale === 'en' ? '' : `${locale}/`}privacy/index.astro`);
      expect(page).toContain(`t('${locale}', 'trustGuideNotice')`);
      expect(page).toContain(`t('${locale}', 'trustWalletNotice')`);
      expect(page).not.toMatch(/Attach my chart|Guide offers to attach/);
    }
  });
});
