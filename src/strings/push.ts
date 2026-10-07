import type { ReleasedLocale as Locale } from '../lib/i18n';

const EN = {
  heading: 'Sky alerts, when they’re earned?',
  body: 'A notification only for the dates that matter — full moons, eclipses, retrograde turns. Most days, nothing.',
  ios: 'On iPhone and iPad, alerts work only after you add Zodiacs to your Home Screen. Install first, then return here.',
  accept: 'Turn on sky alerts',
  installing: 'Turning on…',
  dismiss: 'Not now',
  dismissLabel: 'Dismiss the sky-alerts offer',
  on: 'Sky alerts are on — only the dates that matter, never more than one a day.',
  off: 'Turn off',
  denied: 'Notifications are blocked in this browser, so sky alerts can’t reach you. Your browser’s site settings can change that whenever you like.',
  error: 'Sky alerts are unavailable right now. Try again later.',
} as const;

export const PUSH_COPY = {
  en: EN,
  es: {
    heading: '¿Avisos del cielo, solo cuando hace falta?',
    body: 'Una notificación solo en las fechas que importan: lunas llenas, eclipses, cambios de dirección retrógrada. La mayoría de los días, nada.',
    ios: 'En iPhone y iPad, los avisos solo funcionan después de agregar Zodiacs a la pantalla de inicio. Instálalo primero y vuelve aquí.',
    accept: 'Activar avisos del cielo',
    installing: 'Activando…',
    dismiss: 'Ahora no',
    dismissLabel: 'Descartar la oferta de avisos del cielo',
    on: 'Los avisos del cielo están activados: solo las fechas que importan, nunca más de uno al día.',
    off: 'Desactivar',
    denied: 'Las notificaciones están bloqueadas en este navegador, así que los avisos del cielo no pueden llegarte. Puedes cambiarlo en la configuración del sitio cuando quieras.',
    error: 'Los avisos del cielo no están disponibles ahora. Inténtalo más tarde.',
  },
  pt: {
    heading: 'Alertas do céu, só quando valem a pena?',
    body: 'Uma notificação apenas nas datas que importam: luas cheias, eclipses, viradas de retrógrados. Na maioria dos dias, nada.',
    ios: 'No iPhone e no iPad, os alertas só funcionam depois que você adiciona o Zodiacs à Tela de Início. Instale primeiro e depois volte aqui.',
    accept: 'Ativar alertas do céu',
    installing: 'Ativando…',
    dismiss: 'Agora não',
    dismissLabel: 'Dispensar a oferta de alertas do céu',
    on: 'Os alertas do céu estão ativados: só as datas que importam, nunca mais de um por dia.',
    off: 'Desativar',
    denied: 'As notificações estão bloqueadas neste navegador, então os alertas do céu não chegam até você. Você pode mudar isso nas configurações do site quando quiser.',
    error: 'Os alertas do céu não estão disponíveis agora. Tente mais tarde.',
  },
  fr: {
    heading: 'Des alertes du ciel, seulement quand elles le méritent\u202f?',
    body: 'Une notification uniquement pour les dates qui comptent\u202f: pleines lunes, éclipses, stations rétrogrades. La plupart des jours, rien.',
    ios: 'Sur iPhone et iPad, les alertes fonctionnent uniquement après l’ajout de Zodiacs à l’écran d’accueil. Installe-le d’abord, puis reviens ici.',
    accept: 'Activer les alertes du ciel',
    installing: 'Activation…',
    dismiss: 'Pas maintenant',
    dismissLabel: 'Fermer la proposition d’alertes du ciel',
    on: 'Les alertes du ciel sont activées\u202f: seulement les dates qui comptent, jamais plus d’une par jour.',
    off: 'Désactiver',
    denied: 'Les notifications sont bloquées dans ce navigateur, donc les alertes du ciel ne peuvent pas t’atteindre. Tu peux modifier ce réglage dans les paramètres du site quand tu veux.',
    error: 'Les alertes du ciel sont indisponibles pour le moment. Réessaie plus tard.',
  },
  it: {
    heading: 'Avvisi dal cielo, solo quando contano?',
    body: 'Una notifica solo per le date che contano: lune piene, eclissi, cambi di moto retrogrado. Quasi tutti i giorni, niente.',
    ios: 'Su iPhone e iPad, gli avvisi funzionano solo dopo aver aggiunto Zodiacs alla schermata Home. Installalo prima, poi torna qui.',
    accept: 'Attiva gli avvisi dal cielo',
    installing: 'Attivazione…',
    dismiss: 'Non ora',
    dismissLabel: 'Chiudi la proposta degli avvisi dal cielo',
    on: 'Gli avvisi dal cielo sono attivi: solo le date che contano, mai più di uno al giorno.',
    off: 'Disattiva',
    denied: 'Le notifiche sono bloccate in questo browser, quindi gli avvisi dal cielo non possono raggiungerti. Puoi cambiare questa impostazione nelle preferenze del sito quando vuoi.',
    error: 'Gli avvisi dal cielo non sono disponibili al momento. Riprova più tardi.',
  },
} as const satisfies Record<Locale, Record<keyof typeof EN, string>>;

/** Shown beside the offer in every language; kept outside PUSH_COPY so the additive manifest's key set stays fixed. */
export const PUSH_CAP: Record<Locale, string> = {
  en: 'Never more than one a day, or two a week.',
  es: 'Nunca más de uno al día ni de dos por semana.',
  pt: 'Nunca mais de um por dia nem de dois por semana.',
  fr: 'Jamais plus d’une par jour, ni de deux par semaine.',
  it: 'Mai più di uno al giorno, né di due a settimana.',
};
export const PUSH_REOFFER: Record<Locale, string> = {
  en: 'Your sky alerts lapsed with this browser’s subscription. Turn them back on?',
  es: 'Tus avisos del cielo vencieron junto con la suscripción de este navegador. ¿Quieres volver a activarlos?',
  pt: 'Seus alertas do céu expiraram junto com a assinatura deste navegador. Quer ativá-los de novo?',
  fr: 'Tes alertes du ciel ont expiré avec l’abonnement de ce navigateur. Les réactiver\u202f?',
  it: 'I tuoi avvisi dal cielo sono scaduti insieme all’iscrizione di questo browser. Vuoi riattivarli?',
};

export type PushCopyKey = keyof typeof EN;

export function pushText(locale: Locale, key: PushCopyKey): string {
  return PUSH_COPY[locale]?.[key] ?? PUSH_COPY.en[key];
}
