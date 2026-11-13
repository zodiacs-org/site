import type { CardLocale } from './cards';

/** The share control's words, per live locale. */
export const CARD_SHARE_LABELS: Record<CardLocale, {
  pairHeading: string; pairLede: string; bigThreeHeading: string; bigThreeLede: string;
  share: string; download: string; copied: string; imageAlt: (name: string) => string;
}> = {
  en: {
    pairHeading: 'Share this pairing', pairLede: 'A card for this pair, with a link back to this page.',
    bigThreeHeading: 'Share a sign’s big three', bigThreeLede: 'One card per sign: what it means as a Sun, a Moon and a Rising sign, with a link to its guide.',
    share: 'Share the card', download: 'Download the card', copied: 'Link copied', imageAlt: (name) => `${name}, a share card from Zodiacs.org`,
  },
  es: {
    pairHeading: 'Comparte esta combinación', pairLede: 'Una tarjeta de esta pareja, con un enlace a esta página.',
    bigThreeHeading: 'Comparte los tres grandes de un signo', bigThreeLede: 'Una tarjeta por signo: lo que significa como Sol, como Luna y como Ascendente, con un enlace a su guía.',
    share: 'Compartir la tarjeta', download: 'Descargar la tarjeta', copied: 'Enlace copiado', imageAlt: (name) => `${name}, tarjeta de Zodiacs.org para compartir`,
  },
  pt: {
    pairHeading: 'Compartilhe este par', pairLede: 'Um cartão deste par, com um link para esta página.',
    bigThreeHeading: 'Compartilhe os três signos de um signo', bigThreeLede: 'Um cartão por signo: o que ele significa como Sol, como Lua e como Ascendente, com um link para o guia.',
    share: 'Compartilhar o cartão', download: 'Baixar o cartão', copied: 'Link copiado', imageAlt: (name) => `${name}, cartão do Zodiacs.org para compartilhar`,
  },
  fr: {
    pairHeading: 'Partager ce duo', pairLede: 'Une carte pour ce duo, avec un lien vers cette page.',
    bigThreeHeading: 'Partager les trois piliers d’un signe', bigThreeLede: 'Une carte par signe : ce qu’il signifie en Soleil, en Lune et en Ascendant, avec un lien vers son guide.',
    share: 'Partager la carte', download: 'Télécharger la carte', copied: 'Lien copié', imageAlt: (name) => `${name}, carte à partager de Zodiacs.org`,
  },
  it: {
    pairHeading: 'Condividi questa coppia', pairLede: 'Una card per questa coppia, con un link a questa pagina.',
    bigThreeHeading: 'Condividi i tre pilastri di un segno', bigThreeLede: 'Una card per segno: che cosa significa come Sole, come Luna e come Ascendente, con un link alla sua guida.',
    share: 'Condividi la card', download: 'Scarica la card', copied: 'Link copiato', imageAlt: (name) => `${name}, card da condividere di Zodiacs.org`,
  },
};
