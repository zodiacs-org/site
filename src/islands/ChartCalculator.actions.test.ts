import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { CATALOG_LOCALES, UI } from '../lib/i18n';

const wheelActionKeys = [
  'chartWheelActions', 'chartWheelGuide', 'chartWheelReplay', 'chartWheelAnother',
  'chartWheelSignatureSelf', 'chartWheelSignatureOther', 'chartWheelCompareMine',
  'chartWheelCompareAdd', 'chartWheelShareOther',
] as const;

// Freeze the released wording while moving it out of the eager island bundle.
const wheelActionCopy = {
  en: ['Chart actions', 'Take the guided tour', 'Replay the tour', 'Read another chart', 'Your chart signature', 'Their chart signature', 'Compare with mine', 'Add my chart to compare', 'Share this chart'],
  es: ['Acciones de la carta', 'Hacer el recorrido guiado', 'Repetir el recorrido', 'Leer otra carta', 'La firma de tu carta', 'La firma de su carta', 'Comparar con la mía', 'Añadir mi carta para comparar', 'Compartir esta carta'],
  pt: ['Ações do mapa', 'Fazer o tour guiado', 'Repetir o tour', 'Ler outro mapa', 'A assinatura do seu mapa', 'A assinatura deste mapa', 'Comparar com o meu', 'Adicionar meu mapa para comparar', 'Compartilhar este mapa'],
  fr: ['Actions du thème', 'Faire la visite guidée', 'Rejouer la visite', 'Lire un autre thème', 'La signature de ton thème', 'La signature de son thème', 'Comparer avec le mien', 'Ajouter mon thème pour comparer', 'Partager ce thème'],
  it: ['Azioni del tema', 'Inizia il tour guidato', 'Ripeti il tour', 'Leggi un altro tema', 'La firma del tuo tema', 'La firma del suo tema', 'Confronta con il mio', 'Aggiungi il mio tema per confrontare', 'Condividi questo tema'],
  ru: ['Действия с картой', 'Пройти экскурсию', 'Повторить экскурсию', 'Прочитать другую карту — пока по-английски', 'Характерный рисунок вашей карты', 'Характерный рисунок этой карты', 'Сравнить с моей — пока по-английски', 'Добавить мою карту для сравнения — пока по-английски', 'Поделиться этой картой'],
};

describe('Chart result action contract', () => {
  it.each(CATALOG_LOCALES)('offers localized sensitive-file wording for %s', (locale) => {
    expect(UI[locale].chartReceiptDownload).toContain('.json');
    expect(UI[locale].chartReceiptPrivacy.length).toBeGreaterThan(30);
    expect(UI[locale].chartReceiptError.length).toBeGreaterThan(20);
    expect(UI[locale].chartReceiptUnavailable.length).toBeGreaterThan(20);
    if (locale !== 'en') {
      expect(UI[locale].chartReceiptPrivacy).not.toBe(UI.en.chartReceiptPrivacy);
      expect(UI[locale].chartReceiptError).not.toBe(UI.en.chartReceiptError);
    }
  });

  it('keeps the exact 3D trigger copy in the per-page catalog rather than an eager locale table', async () => {
    const calculator = await readFile(new URL('./ChartCalculator.tsx', import.meta.url), 'utf8');
    expect(calculator).not.toContain('DEPTH_TOGGLE');
    expect(calculator).toContain("t(locale, depthOpen ? 'chartDepthClose' : 'chartDepthOpen')");
    expect(Object.values(UI).map((copy) => [copy.chartDepthOpen, copy.chartDepthClose])).toEqual([
      ['See it in three dimensions', 'Hide the third dimension'],
      ['Verla en tres dimensiones', 'Ocultar la tercera dimensión'],
      ['Ver em três dimensões', 'Ocultar a terceira dimensão'],
      ['Voir en trois dimensions', 'Masquer la troisième dimension'],
      ['Vedilo in tre dimensioni', 'Nascondi la terza dimensione'],
      ['Показать в трёх измерениях — пока по-английски', 'Скрыть третье измерение — пока по-английски'],
    ]);
  });

  it.each(['ChartCalculator.tsx', 'BigThreeQuick.tsx'])('respects reduced motion when %s scrolls to a result', async (file) => {
    const source = await readFile(new URL(`./${file}`, import.meta.url), 'utf8');
    expect(source).toContain("behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'");
    expect(source).not.toContain("scrollIntoView({ behavior: 'smooth', block: 'start' })");
  });

  it.each(CATALOG_LOCALES)('preserves the exact %s wheel action wording in the per-page catalog', (locale) => {
    expect(wheelActionKeys.map((key) => UI[locale][key])).toEqual(wheelActionCopy[locale]);
  });

  it('reads wheel action labels from the page catalog and retains the Russian runtime override', async () => {
    const calculator = await readFile(new URL('./ChartCalculator.tsx', import.meta.url), 'utf8');
    expect(calculator).not.toContain('WHEEL_ACTION_COPY');
    expect(calculator).toContain('russianCopy?.chart.wheelActions ?? {');
    for (const key of wheelActionKeys) expect(calculator).toContain(`t(locale, '${key}')`);
  });

  it('keeps the ephemeris out of the idle page load and warms it on form focus', async () => {
    const calculator = await readFile(new URL('./ChartCalculator.tsx', import.meta.url), 'utf8');

    expect(calculator).toContain('onFocusCapture={() => { void loadEngine(); }}');
    expect(calculator).not.toContain('requestIdleCallback');
    expect(calculator).not.toContain('onWarm={loadEngine}');
  });

  it('keeps an announced, inactive save confirmation in the dock', async () => {
    const calculator = await readFile(new URL('./ChartCalculator.tsx', import.meta.url), 'utf8');
    const dock = await readFile(new URL('./ChartActionDock.tsx', import.meta.url), 'utf8');

    expect(calculator).toContain("saveLabel={saved === 'saved'\n                              ? t(locale, 'chartSavedDevice')");
    expect(calculator).toContain("if (subjectMode === 'self')");
    expect(calculator).toContain("void commitSave(undefined, 'skip')");
    expect(calculator).toContain("const saveError = saved === 'full'");
    expect(calculator).toContain("mode !== 'full' && saveError");
    expect(calculator).toContain("data-primary-action={subjectMode === 'other' ? 'saved_charts' : 'today'}");
    expect(calculator).toContain("href={subjectMode === 'other' ? localizePath(locale, '/profile/') : '/today/'}");
    expect(dock).toContain('!tourOpen && saveLabel');
    expect(dock).toContain('aria-disabled={!onSave}');
    expect(dock).toContain('aria-live="polite"');
    expect(dock).toContain("{onSave ? '+' : '✓'}");
    expect(dock).not.toContain('saveDisabled');
  });

  it('mounts the naming prompt immediately beside the chart action dock', async () => {
    const calculator = await readFile(new URL('./ChartCalculator.tsx', import.meta.url), 'utf8');
    const dock = await readFile(new URL('./ChartActionDock.tsx', import.meta.url), 'utf8');

    expect(calculator).toContain('class="chart-action-dock calc__actions"');
    expect(calculator).toContain("createModuleLoader(() => import('./ChartActionDock'))");
    expect(calculator).toContain("if (mode === 'full' && !chartActionDockModule) requestChartControls();");
    expect(calculator).toContain('{renderSavePrompt()}');
    expect(calculator).toContain("function isConnectedSaveControl(candidate: EventTarget | null | undefined)");
    expect(calculator).toContain("candidate.hasAttribute('data-save-chart')");
    expect(calculator).toContain('function saveFocusFallback(): HTMLElement | null');
    expect(calculator).toContain("?.querySelector<HTMLElement>('[data-chart-action-dock] [data-save-chart]')");
    expect(calculator).toContain('trigger?: EventTarget | null');
    expect(calculator).toContain("openSavePrompt('free', trigger)");
    expect(calculator).toContain("openSavePrompt('free', event.currentTarget)");
    expect(calculator).toContain('saveReturnRef.current = null;');
    expect(dock).toContain('onSave?.(event.currentTarget)');
    expect(dock).not.toContain('savePrompt');
  });

  it('loads natal readings with result controls and keeps the quick guide unavailable until they arrive', async () => {
    const calculator = await readFile(new URL('./ChartCalculator.tsx', import.meta.url), 'utf8');
    const result = await readFile(new URL('./ChartActionDock.tsx', import.meta.url), 'utf8');
    expect(calculator).not.toMatch(/import .*from ['"](?:\.\/explorer\/Inspector|\.\.\/lib\/natal)['"]/);
    expect(result).toContain("export { default as Inspector } from './explorer/Inspector'");
    expect(result).toContain("export { chartWeather, natalAspectLine, planetInHouseLine, topAspects } from '../lib/natal'");
    expect(calculator).toContain('disabled={!chartActionDockModule} data-first-reading-start');
    expect(calculator).toContain('const Inspector = chartActionDockModule?.Inspector');
    expect(calculator).toContain('if (!chart || mode !== \'full\' || !chartActionDockModule) return null;');
    expect(UI.en.explorerControlsLoading).toContain('readings and controls');
    expect(UI.en.explorerControlsError).toContain('readings and controls');
  });
});
