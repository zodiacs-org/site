/**
 * Words for the 1080 by 1920 story cards (src/lib/big-three-story-card.ts and the birth-chart share dialog).
 * Kept apart from SHARE_CARD_COPY, whose keys feed the frozen translation handoff (scripts/build-i18n-additions.mjs).
 */
import type { CatalogLocale as Locale } from './i18n';

export const STORY_CARD_COPY = {
  en: {
    storyTitle: 'My big three',
    storyAction: 'Make a story card',
    storyShare: 'Share story',
    storyDownload: 'Download',
    storyNote: 'A 1080 by 1920 image for stories. It shows your signs and nothing else.',
    risingNeedsTime: 'Rising needs a birth time',
  },
  es: {
    storyTitle: 'Mis tres grandes',
    storyAction: 'Crear imagen para historias',
    storyShare: 'Compartir historia',
    storyDownload: 'Descargar',
    storyNote: 'Una imagen de 1080 por 1920 para historias. Solo muestra tus signos.',
    risingNeedsTime: 'El ascendente necesita la hora de nacimiento',
  },
  pt: {
    storyTitle: 'Meus três signos',
    storyAction: 'Criar imagem para stories',
    storyShare: 'Compartilhar story',
    storyDownload: 'Baixar',
    storyNote: 'Uma imagem de 1080 por 1920 para stories. Mostra só os seus signos.',
    risingNeedsTime: 'O ascendente precisa do horário de nascimento',
  },
  fr: {
    storyTitle: 'Mes trois signes',
    storyAction: 'Créer une image pour les stories',
    storyShare: 'Partager la story',
    storyDownload: 'Télécharger',
    storyNote: 'Une image de 1080 sur 1920 pour les stories. Elle ne montre que tes signes.',
    risingNeedsTime: 'L’ascendant demande une heure de naissance',
  },
  it: {
    storyTitle: 'I miei tre segni',
    storyAction: 'Crea un’immagine per le storie',
    storyShare: 'Condividi la storia',
    storyDownload: 'Scarica',
    storyNote: 'Un’immagine 1080 per 1920 per le storie. Mostra solo i tuoi segni.',
    risingNeedsTime: 'L’ascendente richiede l’ora di nascita',
  },
  ru: {
    storyTitle: 'Моя большая тройка',
    storyAction: 'Сделать картинку для сторис',
    storyShare: 'Поделиться в сторис',
    storyDownload: 'Скачать',
    storyNote: 'Изображение 1080 на 1920 для сторис. На нём только ваши знаки.',
    risingNeedsTime: 'Для асцендента нужно время рождения',
  },
} as const satisfies Record<Locale, Record<string, string>>;

export type StoryCardCopyKey = keyof (typeof STORY_CARD_COPY)['en'];

export function storyCardText(locale: Locale, key: StoryCardCopyKey): string {
  return STORY_CARD_COPY[locale][key];
}
