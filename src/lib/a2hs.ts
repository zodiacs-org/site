import type { CatalogLocale as Locale } from './i18n';

export const A2HS_HINT_KEY = 'zodiacs.a2hs.v1';

export type A2hsPlatform = 'ios' | 'android';

export interface A2hsHint {
  platform: A2hsPlatform;
  message: string;
  dismissLabel: string;
}

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const COPY = {
  en: {
    ios: 'To keep your saved charts close, tap Share → Add to Home Screen. Sky alerts on iPhone and iPad work only from the installed site.',
    android: 'To keep your saved charts close, tap Menu → Add to Home screen.',
    dismiss: 'Dismiss home-screen hint',
  },
  es: {
    ios: 'Para tener tus cartas guardadas a mano, toca Compartir → Agregar a inicio. Los avisos del cielo en iPhone y iPad solo funcionan desde el sitio instalado.',
    android: 'Para tener tus cartas guardadas a mano, toca Menú → Agregar a la pantalla principal.',
    dismiss: 'Descartar indicación de pantalla de inicio',
  },
  pt: {
    ios: 'Para manter seus mapas salvos por perto, toque em Compartilhar → Adicionar à Tela de Início. Os alertas do céu no iPhone e no iPad só funcionam pelo site instalado.',
    android: 'Para manter seus mapas salvos por perto, toque em Menu → Adicionar à tela inicial.',
    dismiss: 'Dispensar dica da tela inicial',
  },
  fr: {
    ios: 'Pour garder tes thèmes enregistrés à portée de main, touche Partager → Sur l’écran d’accueil. Sur iPhone et iPad, les alertes du ciel fonctionnent uniquement depuis le site installé.',
    android: 'Pour garder tes thèmes enregistrés à portée de main, touche Menu → Ajouter à l’écran d’accueil.',
    dismiss: 'Ignorer l’indication d’ajout à l’écran d’accueil',
  },
  it: {
    ios: 'Per tenere a portata di mano i temi salvati, tocca Condividi → Aggiungi alla schermata Home. Su iPhone e iPad, gli avvisi dal cielo funzionano solo dal sito installato.',
    android: 'Per tenere a portata di mano i temi salvati, tocca Menu → Aggiungi alla schermata Home.',
    dismiss: 'Ignora il suggerimento per la schermata Home',
  },
  ru: {
    ios: 'Чтобы сохранённые карты всегда были рядом, нажмите «Поделиться» → «На экран Домой». На iPhone и iPad ежедневные уведомления работают только в установленном сайте.',
    android: 'Чтобы сохранённые карты всегда были рядом, нажмите «Меню» → «Добавить на главный экран».',
    dismiss: 'Закрыть подсказку об установке на главный экран',
  },
} as const satisfies Record<Locale, {
  ios: string;
  android: string;
  dismiss: string;
}>;

/** User-agent routing only chooses the instruction; it never changes behavior. */
export function a2hsPlatform(userAgent: string): A2hsPlatform | null {
  const iPadOsSafari = /\bMacintosh\b/.test(userAgent) && /\bMobile\//.test(userAgent);
  const iosSafari = (/\b(?:iPhone|iPad|iPod)\b/.test(userAgent) || iPadOsSafari)
    && /Safari\//.test(userAgent)
    && !/(?:CriOS|FxiOS|EdgiOS|OPiOS)\//.test(userAgent);
  if (iosSafari) return 'ios';

  const androidChrome = /Android/.test(userAgent)
    && /Chrome\/\d/.test(userAgent)
    && !/(?:EdgA|OPR|SamsungBrowser)\//.test(userAgent);
  return androidChrome ? 'android' : null;
}

/** Atomically claims the one-time hint. Storage failure means no repeated prompt. */
export function claimA2hsHint(
  locale: Locale,
  userAgent: string,
  storage: StorageLike,
): A2hsHint | null {
  const platform = a2hsPlatform(userAgent);
  if (!platform) return null;
  try {
    if (storage.getItem(A2HS_HINT_KEY)) return null;
    storage.setItem(A2HS_HINT_KEY, '1');
  } catch {
    return null;
  }
  return {
    platform,
    message: COPY[locale][platform],
    dismissLabel: COPY[locale].dismiss,
  };
}
