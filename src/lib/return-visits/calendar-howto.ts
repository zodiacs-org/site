/**
 * Step-by-step help for adding the public sky calendar to Google Calendar and
 * Apple Calendar, shown on /sky-calendar/ and its translated copies. Kept out
 * of ./copy.ts, which the AI tools bundle byte for byte.
 *
 * Menu names follow each app's own wording in that language; the address
 * itself is printed on the page above the steps.
 */
import type { CatalogLocale } from '../i18n/core';

export interface CalendarHowto {
  title: string;
  google: { name: string; steps: string[]; note: string };
  apple: { name: string; steps: string[] };
}

const HOWTO: Record<CatalogLocale, CalendarHowto> = {
  en: {
    title: 'Add it to your calendar',
    google: {
      name: 'Google Calendar',
      steps: [
        'Copy the calendar address above.',
        'On a computer, open calendar.google.com. Next to “Other calendars”, press + and choose “From URL”.',
        'Paste the address and press “Add calendar”.',
      ],
      note: 'Google only adds calendars by address on the web, but the events then show on your phone too. Google checks for new events on its own schedule, often once a day.',
    },
    apple: {
      name: 'Apple Calendar',
      steps: [
        'On an iPhone or iPad, open this page in Safari, tap “Subscribe to calendar” above, then “Subscribe” in the box that opens, then “Add”.',
        'On a Mac, open Calendar, choose File, then “New Calendar Subscription”, paste the address and press “Subscribe”.',
      ],
    },
  },
  es: {
    title: 'Añádelo a tu calendario',
    google: {
      name: 'Google Calendar',
      steps: [
        'Copia la dirección del calendario que aparece arriba.',
        'En un ordenador, abre calendar.google.com. Junto a “Otros calendarios”, pulsa + y elige “Desde URL”.',
        'Pega la dirección y pulsa “Añadir calendario”.',
      ],
      note: 'Google solo añade calendarios por dirección desde la web, pero después los eventos también aparecen en tu móvil. Google busca eventos nuevos según su propio ritmo, a menudo una vez al día.',
    },
    apple: {
      name: 'Calendario de Apple',
      steps: [
        'En un iPhone o iPad, abre esta página en Safari, toca “Suscribirse al calendario” arriba, luego “Suscribirse” en el cuadro que se abre y después “Añadir”.',
        'En un Mac, abre Calendario, elige Archivo y luego “Nueva suscripción a calendario”, pega la dirección y pulsa “Suscribirse”.',
      ],
    },
  },
  pt: {
    title: 'Adicione à sua agenda',
    google: {
      name: 'Google Agenda',
      steps: [
        'Copie o endereço da agenda mostrado acima.',
        'Em um computador, abra calendar.google.com. Ao lado de “Outras agendas”, clique em + e escolha “Do URL”.',
        'Cole o endereço e clique em “Adicionar agenda”.',
      ],
      note: 'O Google só adiciona agendas por endereço na web, mas depois os eventos aparecem também no seu celular. O Google procura eventos novos no seu próprio ritmo, muitas vezes uma vez por dia.',
    },
    apple: {
      name: 'Calendário da Apple',
      steps: [
        'Em um iPhone ou iPad, abra esta página no Safari, toque em “Assinar calendário” acima, depois em “Assinar” na caixa que se abre e então em “Adicionar”.',
        'Em um Mac, abra o Calendário, escolha Arquivo e depois “Nova Assinatura de Calendário”, cole o endereço e clique em “Assinar”.',
      ],
    },
  },
  fr: {
    title: 'Ajoute-le à ton agenda',
    google: {
      name: 'Google Agenda',
      steps: [
        'Copie l’adresse de l’agenda indiquée plus haut.',
        'Sur un ordinateur, ouvre calendar.google.com. À côté de « Autres agendas », clique sur + puis sur « À partir de l’URL ».',
        'Colle l’adresse et clique sur « Ajouter un agenda ».',
      ],
      note: 'Google n’ajoute un agenda par adresse que sur le web, mais les événements apparaissent ensuite aussi sur ton téléphone. Google cherche les nouveaux événements à son propre rythme, souvent une fois par jour.',
    },
    apple: {
      name: 'Calendrier d’Apple',
      steps: [
        'Sur un iPhone ou un iPad, ouvre cette page dans Safari, touche « S’abonner au calendrier » plus haut, puis « S’abonner » dans la fenêtre qui s’ouvre, puis « Ajouter ».',
        'Sur un Mac, ouvre Calendrier, choisis Fichier puis « Nouvel abonnement à un calendrier », colle l’adresse et clique sur « S’abonner ».',
      ],
    },
  },
  it: {
    title: 'Aggiungilo al tuo calendario',
    google: {
      name: 'Google Calendar',
      steps: [
        'Copia l’indirizzo del calendario qui sopra.',
        'Su un computer, apri calendar.google.com. Accanto a “Altri calendari”, premi + e scegli “Da URL”.',
        'Incolla l’indirizzo e premi “Aggiungi calendario”.',
      ],
      note: 'Google aggiunge un calendario tramite indirizzo solo dal web, ma poi gli eventi compaiono anche sul telefono. Google cerca i nuovi eventi con i suoi tempi, spesso una volta al giorno.',
    },
    apple: {
      name: 'Calendario di Apple',
      steps: [
        'Su un iPhone o un iPad, apri questa pagina in Safari, tocca “Iscriviti al calendario” qui sopra, poi “Iscriviti” nella finestra che si apre, poi “Aggiungi”.',
        'Su un Mac, apri Calendario, scegli Archivio e poi “Nuova iscrizione a calendario”, incolla l’indirizzo e premi “Iscriviti”.',
      ],
    },
  },
  ru: {
    title: 'Добавьте его в свой календарь',
    google: {
      name: 'Google Календарь',
      steps: [
        'Скопируйте адрес календаря, указанный выше.',
        'На компьютере откройте calendar.google.com. Рядом с разделом «Другие календари» нажмите + и выберите «Добавить по URL».',
        'Вставьте адрес и нажмите «Добавить календарь».',
      ],
      note: 'Google добавляет календарь по адресу только в веб-версии, но затем события появляются и на телефоне. Google проверяет новые события по своему расписанию, часто раз в день.',
    },
    apple: {
      name: 'Календарь Apple',
      steps: [
        'На iPhone или iPad откройте эту страницу в Safari, нажмите «Подписаться на календарь» выше, затем «Подписаться» в открывшемся окне и «Добавить».',
        'На Mac откройте Календарь, выберите «Файл», затем «Новая подписка на календарь», вставьте адрес и нажмите «Подписаться».',
      ],
    },
  },
};

export function calendarHowto(locale: CatalogLocale): CalendarHowto {
  return HOWTO[locale] ?? HOWTO.en;
}

export const CALENDAR_HOWTO = HOWTO;
