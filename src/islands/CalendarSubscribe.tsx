import { useEffect, useMemo, useState } from 'preact/hooks';
import {
  encodeSharedPositionsLink,
  type PositionsShareInput,
} from '../lib/share-positions';
import { onWholeMinute } from '../lib/share-positions-noon';
import { loadTimedSharedPositions, loadUntimedSharedPositions } from '../lib/share-positions-untimed';
import type { TransitContact } from '../lib/engine/transit-scan';
import type { CatalogLocale as Locale } from '../lib/i18n';

/** Saved summaries carry body names as strings; the existing encoder remains
 * the runtime authority and rejects incomplete or non-canonical inputs. */
export interface CalendarPositionsSource {
  bodies: readonly { body: string; lon: number }[];
  angles: PositionsShareInput['angles'];
  houseSystem: PositionsShareInput['houseSystem'];
  engineVersion: string;
  /**
   * The chart's UTC instant. With a birth time, the feed's code carries the
   * bodies at this instant rounded to the whole minute (sharedTimedInstant),
   * so before standard time its seconds cannot give the birthplace's
   * longitude.
   */
  utc: Date | string;
}

const COPY = {
  en: {
    action: 'Add to your calendar',
    unavailable: 'Calendar link unavailable',
    note: 'This is a live feed. Subscribe once and your calendar refreshes it. The link carries your chart code, which has no name, date, time or place fields. Its positions still give your birth date and time, to the minute. The Ascendant and Midheaven are kept to the whole degree, so contacts to those two points are approximate, and the code narrows your birthplace only to an area about 110 km wide and hundreds of kilometres long near the equator, smaller nearer the poles, and near the Arctic Circle sometimes a strip less than a kilometre from north to south. Our server, its cache and your calendar service receive the code at each refresh.',
    noteNoTime: 'This is a live feed. Subscribe once and your calendar refreshes it. The link carries your chart code, which has no name, date, time or place fields. With no birth time, the code carries the sky at 12:00 UTC on your birth date, so it gives your birth date but nothing about your birthplace. Where your Moon was that day is not known, so dates of contacts to your Moon can be days or months off. Our server, its cache and your calendar service receive the code at each refresh.',
    download: 'Download these dates (.ics)',
    downloadNote: 'The file is a snapshot of the exact dates shown here, built in your browser; the subscription above keeps itself current.',
  },
  es: {
    action: 'Añadir a tu calendario',
    unavailable: 'Enlace de calendario no disponible',
    note: 'Es un calendario actualizado. Suscríbete una vez y tu calendario lo actualizará. El enlace lleva el código de tu carta, que no tiene campos de nombre, fecha, hora ni lugar. Sus posiciones siguen dando tu fecha y hora de nacimiento, al minuto. El Ascendente y el Medio Cielo van al grado entero, así que los contactos con esos dos puntos son aproximados, y el código solo acota tu lugar de nacimiento a una zona de unos 110 km de ancho y cientos de kilómetros de largo cerca del ecuador, más pequeña hacia los polos y, cerca del círculo polar ártico, a veces una franja de menos de un kilómetro de norte a sur. Nuestro servidor, su caché y tu servicio de calendario reciben el código en cada actualización.',
    noteNoTime: 'Es un calendario actualizado. Suscríbete una vez y tu calendario lo actualizará. El enlace lleva el código de tu carta, que no tiene campos de nombre, fecha, hora ni lugar. Sin hora de nacimiento, el código lleva el cielo de las 12:00 UTC de tu fecha de nacimiento, así que da tu fecha de nacimiento pero nada sobre tu lugar de nacimiento. No se sabe dónde estaba tu Luna ese día, así que las fechas de los contactos con tu Luna pueden desviarse días o meses. Nuestro servidor, su caché y tu servicio de calendario reciben el código en cada actualización.',
    download: 'Descargar estas fechas (.ics)',
    downloadNote: 'El archivo es una instantánea de las fechas exactas que ves aquí, creada en tu navegador; la suscripción de arriba se mantiene al día por sí sola.',
  },
  pt: {
    action: 'Adicionar ao seu calendário',
    unavailable: 'Link do calendário indisponível',
    note: 'Este é um calendário com atualização automática. Assine uma vez, e seu calendário manterá os eventos atualizados. O link leva o código do seu mapa, que não tem campos de nome, data, hora ou local. Suas posições ainda indicam sua data e hora de nascimento, com precisão de minuto. O Ascendente e o Meio do Céu ficam em graus inteiros, então os contatos com esses dois pontos são aproximados, e o código só restringe o seu local de nascimento a uma área de cerca de 110 km de largura e centenas de quilômetros de comprimento perto do equador, menor perto dos polos e, perto do Círculo Polar Ártico, às vezes uma faixa de menos de um quilômetro de norte a sul. Nosso servidor, o cache dele e o seu serviço de calendário recebem o código a cada atualização.',
    noteNoTime: 'Este é um calendário com atualização automática. Assine uma vez, e seu calendário manterá os eventos atualizados. O link leva o código do seu mapa, que não tem campos de nome, data, hora ou local. Sem a hora de nascimento, o código leva o céu das 12:00 UTC da sua data de nascimento; por isso indica a sua data de nascimento, mas nada sobre o seu local de nascimento. Não se sabe onde estava a sua Lua nesse dia, então as datas dos contatos com a sua Lua podem errar por dias ou meses. Nosso servidor, o cache dele e o seu serviço de calendário recebem o código a cada atualização.',
    download: 'Baixar estas datas (.ics)',
    downloadNote: 'O arquivo é um retrato das datas exatas mostradas aqui, criado no seu navegador; a assinatura acima se mantém atualizada sozinha.',
  },
  fr: {
    action: 'Ajouter à ton calendrier',
    unavailable: 'Lien de calendrier indisponible',
    note: 'Ce calendrier se met à jour automatiquement. Abonne-toi une seule fois, puis ton calendrier actualisera les événements. Le lien contient le code de ton thème, sans champ de nom, de date, d’heure ou de lieu. Ses positions donnent quand même ta date et ton heure de naissance, à la minute près. L’Ascendant et le Milieu du Ciel sont gardés au degré entier : les contacts avec ces deux points sont donc approximatifs, et le code ne situe ton lieu de naissance que dans une zone d’environ 110 km de large et de plusieurs centaines de kilomètres de long près de l’équateur, plus petite vers les pôles et, près du cercle polaire arctique, parfois une bande de moins d’un kilomètre du nord au sud. Notre serveur, son cache et ton service de calendrier reçoivent le code à chaque actualisation.',
    noteNoTime: 'Ce calendrier se met à jour automatiquement. Abonne-toi une seule fois, puis ton calendrier actualisera les événements. Le lien contient le code de ton thème, sans champ de nom, de date, d’heure ou de lieu. Sans heure de naissance, le code contient le ciel de 12:00 UTC à ta date de naissance : il donne ta date de naissance, mais rien sur ton lieu de naissance. On ne sait pas où était ta Lune ce jour-là, donc les dates des contacts avec ta Lune peuvent être décalées de plusieurs jours ou mois. Notre serveur, son cache et ton service de calendrier reçoivent le code à chaque actualisation.',
    download: 'Télécharger ces dates (.ics)',
    downloadNote: 'Le fichier est un instantané des dates exactes affichées ici, créé dans ton navigateur ; l’abonnement ci-dessus reste à jour tout seul.',
  },
  it: {
    action: 'Aggiungi al tuo calendario',
    unavailable: 'Link al calendario non disponibile',
    note: 'Questo calendario si aggiorna automaticamente. Iscriviti una volta e il tuo calendario manterrà aggiornati gli eventi. Il link contiene il codice del tuo tema, senza campi per nome, data, ora o luogo. Le sue posizioni indicano comunque data e ora della tua nascita, al minuto. Ascendente e Medio Cielo sono tenuti al grado intero, quindi i contatti con questi due punti sono approssimativi, e il codice restringe il luogo di nascita solo a una zona larga circa 110 km e lunga centinaia di chilometri vicino all’equatore, più piccola verso i poli e, vicino al Circolo polare artico, a volte una striscia di meno di un chilometro da nord a sud. Il nostro server, la sua cache e il tuo servizio di calendario ricevono il codice a ogni aggiornamento.',
    noteNoTime: 'Questo calendario si aggiorna automaticamente. Iscriviti una volta e il tuo calendario manterrà aggiornati gli eventi. Il link contiene il codice del tuo tema, senza campi per nome, data, ora o luogo. Senza ora di nascita, il codice contiene il cielo delle 12:00 UTC della tua data di nascita, quindi indica la data di nascita ma nulla del luogo di nascita. Non si sa dove fosse la tua Luna quel giorno, quindi le date dei contatti con la tua Luna possono sbagliare di giorni o mesi. Il nostro server, la sua cache e il tuo servizio di calendario ricevono il codice a ogni aggiornamento.',
    download: 'Scarica queste date (.ics)',
    downloadNote: 'Il file è un’istantanea delle date esatte mostrate qui, creata nel tuo browser; l’iscrizione qui sopra si tiene aggiornata da sola.',
  },
  ru: {
    action: 'Добавить в календарь',
    unavailable: 'Ссылка на календарь недоступна',
    note: 'Это обновляемая лента. Подпишитесь один раз, и календарь будет получать свежие события. В ссылке есть код вашей карты — без полей имени, даты, времени и места. Положения в нём всё равно выдают дату и время вашего рождения с точностью до минуты. Асцендент и MC в коде сохранены до целого градуса, поэтому контакты с этими двумя точками приблизительны, а место рождения код сужает лишь до области шириной около 110 км и длиной в сотни километров у экватора, меньшей ближе к полюсам, а у Северного полярного круга иногда до полосы меньше километра с севера на юг. Наш сервер, его кэш и ваш календарный сервис получают код при каждом обновлении.',
    noteNoTime: 'Это обновляемая лента. Подпишитесь один раз, и календарь будет получать свежие события. В ссылке есть код вашей карты — без полей имени, даты, времени и места. Без времени рождения код содержит небо на 12:00 UTC в день вашего рождения, поэтому выдаёт дату рождения, но ничего не говорит о месте рождения. Где была ваша Луна в тот день, неизвестно, поэтому даты контактов с вашей Луной могут ошибаться на дни или месяцы. Наш сервер, его кэш и ваш календарный сервис получают код при каждом обновлении.',
    download: 'Скачать эти даты (.ics)',
    downloadNote: 'Файл — снимок точных дат, показанных здесь, созданный в вашем браузере; подписка выше обновляется сама.',
  },
} as const;

/**
 * The feed's code: every position to 0.001°, ASC and MC to the whole degree.
 * Given positions a code may carry: at the whole minute with a birth time,
 * at 12:00 UTC on the birth date without one.
 */
export function calendarToken(positions: Omit<CalendarPositionsSource, 'utc'>): string | null {
  return encodeSharedPositionsLink(positions as PositionsShareInput);
}

export function calendarWebcalUrl(origin: string, token: string): string {
  const url = new URL('/api/calendar/transits', origin);
  url.searchParams.set('token', token);
  return `webcal://${url.host}${url.pathname}${url.search}`;
}

function track(name: 'calendar_subscribe' | 'calendar_download'): void {
  const analytics = (window as Window & {
    zodiacsAnalytics?: { track?: (name: string, props: Record<string, never>) => void };
  }).zodiacsAnalytics;
  analytics?.track?.(name, {});
}

interface CalendarSubscribeProps {
  locale: Locale;
  positions: CalendarPositionsSource;
  /**
   * The civil birth date, given only for a chart without a birth time. The
   * feed's code then carries the sky at 12:00 UTC on that date instead of
   * the chart's own positions, which are noon at the birthplace and would
   * give the place away (see sharedReferenceInstant).
   */
  birthDate?: string;
  /**
   * Exact contacts already computed on the page. When present, a download
   * button offers them as one .ics file built in the browser. The serializer
   * loads on the click so the route's first paint carries none of it.
   */
  contacts?: readonly TransitContact[];
}

export default function CalendarSubscribe({ locale, positions, birthDate, contacts }: CalendarSubscribeProps) {
  const copy = COPY[locale];
  const timeUnknown = birthDate !== undefined;
  const { bodies, angles, houseSystem, engineVersion, utc } = positions;
  // A chart with a birth time on a whole UTC minute is shared as it is; one
  // with seconds (before standard time) waits for its bodies at the minute.
  const wholeMinute = !timeUnknown && onWholeMinute(utc);
  const direct = useMemo(() => (wholeMinute ? calendarToken(positions) : null), [positions, wholeMinute]);
  // Callers rebuild `positions` on every render, so the load is keyed on its values.
  const asc = angles?.asc ?? null;
  const mc = angles?.mc ?? null;
  const utcMs = utc instanceof Date ? utc.getTime() : Date.parse(String(utc));
  const instant = Number.isFinite(utcMs) ? utcMs : null;
  const [loaded, setLoaded] = useState<string | null>(null);
  useEffect(() => {
    setLoaded(null);
    if (wholeMinute) return undefined;
    let current = true;
    const ready = birthDate !== undefined
      ? loadUntimedSharedPositions({ houseSystem, engineVersion }, birthDate)
      : instant === null
        ? Promise.resolve(null)
        : loadTimedSharedPositions({
          bodies, angles: asc === null || mc === null ? null : { asc, mc }, houseSystem, engineVersion,
        } as PositionsShareInput, new Date(instant));
    void ready.then((shared) => {
      if (current) setLoaded(shared ? calendarToken(shared) : null);
    }, (error) => console.error(error));
    return () => { current = false; };
  }, [birthDate, houseSystem, engineVersion, wholeMinute, bodies, asc, mc, instant]);
  const token = wholeMinute ? direct : loaded;
  const [href, setHref] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setHref(token ? calendarWebcalUrl(window.location.origin, token) : '');
  }, [token]);

  async function download(): Promise<void> {
    if (!contacts?.length || busy) return;
    setBusy(true);
    try {
      const [{ serializeTransitContacts }, { downloadCalendarFile }] = await Promise.all([
        import('../lib/ical'),
        import('../lib/ical-download'),
      ]);
      const calendar = serializeTransitContacts(contacts, {
        generatedAt: new Date(),
        calendarName: 'Zodiacs.org transit contacts',
      });
      downloadCalendarFile(calendar, 'zodiacs-transit-contacts.ics');
      track('calendar_download');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div class="calendar-subscribe">
      <a
        class="btn btn--glass"
        href={href || undefined}
        aria-disabled={!href}
        onClick={(event) => {
          if (!href) {
            event.preventDefault();
            return;
          }
          track('calendar_subscribe');
        }}
        data-calendar-subscribe
      >
        <span>{href ? copy.action : copy.unavailable}</span>
        <span class="orb">↗</span>
      </a>
      <p class="calendar-subscribe__note">{timeUnknown ? copy.noteNoTime : copy.note}</p>
      {contacts && contacts.length > 0 && (
        <>
          <button
            type="button"
            class="btn btn--ghost calendar-subscribe__download"
            onClick={() => { void download(); }}
            disabled={busy}
            data-calendar-download
          >
            <span>{copy.download}</span>
            <span class="orb">↓</span>
          </button>
          <p class="calendar-subscribe__note">{copy.downloadNote}</p>
        </>
      )}
    </div>
  );
}
