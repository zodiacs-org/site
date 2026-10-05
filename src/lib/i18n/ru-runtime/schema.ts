import type { PluralCatalog } from '../plural';

export interface RussianRuntimePayload {
  signs: {
    names: Readonly<Record<string, string>>;
    dates: Readonly<Record<string, string>>;
    essences: Readonly<Record<string, string>>;
    prepositional: Readonly<Record<string, string>>;
    elements: Readonly<Record<'fire' | 'earth' | 'air' | 'water', string>>;
    modalities: Readonly<Record<'cardinal' | 'fixed' | 'mutable', string>>;
  };
  astrology: {
    planets: Readonly<Record<string, string>>;
    aspects: Readonly<Record<string, string>>;
    moonPhases: Readonly<Record<string, string>>;
  };
  chart: {
    lens: Readonly<Record<'rail' | 'natal' | 'sky' | 'progressed' | 'return', string>>;
    detail: Readonly<{ lead: string; placements: string; aspects: string }>;
    wheelActions: Readonly<{
      actions: string;
      guide: string;
      replay: string;
      another: string;
      signatureSelf: string;
      signatureOther: string;
      compareMine: string;
      compareAdd: string;
      shareOther: string;
      spotlight: string;
    }>;
    chartBook: Readonly<{ label: string; save: string; skip: string }>;
    registryAura: Readonly<{
      discover: string;
      discoverLink: string;
      return: string;
      returnLink: string;
    }>;
    personChartTemplate: string;
    otherSubject: Readonly<{
      unnamed: string;
      namedTemplate: string;
      headingTemplate: string;
      headingUnnamed: string;
      submit: string;
      privacy: string;
    }>;
    /** Legacy «{знак} Солнце» label; kept so earlier automatic names stay recognizable. */
    autoNameSun: string;
    /** Current automatic chart name; {sign} is the prepositional sign name. */
    autoNameSunTemplate: string;
    sharedBirthplace: string;
    englishOnlyTitle: string;
    englishOnlySuffix: string;
  };
  plurals: PluralCatalog;
}

export interface RussianRuntimeClientPayload {
  locale: 'ru';
  data: RussianRuntimePayload;
}
