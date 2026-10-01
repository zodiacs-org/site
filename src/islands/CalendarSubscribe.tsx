import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import {
  encodeSharedPositionsLink,
  type PositionsShareInput,
} from '../lib/share-positions';
import { onWholeMinute } from '../lib/share-positions-noon';
import { loadTimedSharedPositions, loadUntimedSharedPositions } from '../lib/share-positions-untimed';
import type { TransitContact } from '../lib/engine/transit-scan';
import type { CatalogLocale as Locale } from '../lib/i18n';
import { formatDate } from '../lib/i18n/dates';
import {
  createCalendarFeed,
  calendarFeedClearEpoch,
  calendarFeedRequestPending,
  hasUnstoredCalendarFeeds,
  readAvailableCalendarFeeds,
  removeCalendarFeed,
  watchCalendarFeeds,
  type KeptCalendarFeed,
} from '../lib/calendar-feed/client';
import { calendarFeedWebcalUrl } from '../lib/calendar-feed/shared';

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
    adding: 'Adding…',
    note: 'Subscribing saves this chart’s positions on our server under a random address that carries nothing else. No name, place or birth time is saved, but the planets still give your birth date and time, to the minute, and the Ascendant and Midheaven narrow your birthplace to an area about 110 km wide near the equator, smaller nearer the poles. The feed keeps the Ascendant and Midheaven to the whole degree, so its contacts to those two points are approximate. Your calendar service fetches the address to stay current, and anyone who has the address can read the calendar. The saved positions are deleted when you remove the calendar here, or after 12 months without a fetch. This browser keeps the address and the key that removes it until you remove the calendar here or clear this site’s data.',
    noteNoTime: 'Subscribing saves the sky at 12:00 UTC on your birth date on our server, under a random address that carries nothing else. It gives your birth date but nothing about your birthplace. Where your Moon was that day is not known, so dates of contacts to your Moon can be days or months off. Your calendar service fetches the address to stay current, and anyone who has the address can read the calendar. The saved positions are deleted when you remove the calendar here, or after 12 months without a fetch. This browser keeps the address and the key that removes it until you remove the calendar here or clear this site’s data.',
    address: 'Calendar address',
    open: 'Open in your calendar app',
    copy: 'Copy address',
    copied: 'Copied',
    remove: 'Remove this calendar',
    removing: 'Removing…',
    removed: 'Removed. The address stops working within the hour; delete the calendar in your calendar app too.',
    addFailed: 'The calendar could not be added. Try again later.',
    removeFailed: 'The calendar could not be removed. Try again later.',
    rateLimited: 'Too many requests. Try again in a minute.',
    offline: 'You are offline. Try again when you are connected.',
    notKept: 'This browser would not keep the key that removes this calendar, so you can remove it only here, before you leave the page.',
    others: 'Other calendars made in this browser',
    kept: 'Calendars made in this browser',
    made: 'Made',
    download: 'Download these dates (.ics)',
    downloadNote: 'The file is a snapshot of the exact dates shown here, built in your browser; the subscription above keeps itself current. The times in the file come from your exact chart, so anyone you share it with, or any online calendar you import it into, can work out your birth time from them, and your birthplace from those for your Ascendant or Midheaven.',
  },
  es: {
    action: 'Añadir a tu calendario',
    unavailable: 'Enlace de calendario no disponible',
    adding: 'Añadiendo…',
    note: 'Al suscribirte, guardamos las posiciones de esta carta en nuestro servidor, bajo una dirección aleatoria que no lleva nada más. No se guarda ningún nombre, lugar ni hora de nacimiento, pero los planetas siguen dando tu fecha y hora de nacimiento, al minuto, y el Ascendente y el Medio Cielo acotan tu lugar de nacimiento a una zona de unos 110 km de ancho cerca del ecuador, más pequeña hacia los polos. Este calendario lleva el Ascendente y el Medio Cielo al grado entero, así que sus contactos con esos dos puntos son aproximados. Tu servicio de calendario consulta la dirección para mantenerse al día, y cualquiera que tenga la dirección puede leer el calendario. Las posiciones guardadas se borran cuando quitas el calendario aquí, o tras 12 meses sin ninguna consulta. Este navegador guarda la dirección y la clave que lo quita hasta que lo quites aquí o borres los datos de este sitio.',
    noteNoTime: 'Al suscribirte, guardamos en nuestro servidor el cielo de las 12:00 UTC de tu fecha de nacimiento, bajo una dirección aleatoria que no lleva nada más. Da tu fecha de nacimiento, pero nada sobre tu lugar de nacimiento. No se sabe dónde estaba tu Luna ese día, así que las fechas de los contactos con tu Luna pueden desviarse días o meses. Tu servicio de calendario consulta la dirección para mantenerse al día, y cualquiera que tenga la dirección puede leer el calendario. Las posiciones guardadas se borran cuando quitas el calendario aquí, o tras 12 meses sin ninguna consulta. Este navegador guarda la dirección y la clave que lo quita hasta que lo quites aquí o borres los datos de este sitio.',
    address: 'Dirección del calendario',
    open: 'Abrir en tu app de calendario',
    copy: 'Copiar la dirección',
    copied: 'Copiada',
    remove: 'Quitar este calendario',
    removing: 'Quitando…',
    removed: 'Quitado. La dirección deja de funcionar en menos de una hora; borra también el calendario en tu app de calendario.',
    addFailed: 'No se pudo añadir el calendario. Inténtalo de nuevo más tarde.',
    removeFailed: 'No se pudo quitar el calendario. Inténtalo de nuevo más tarde.',
    rateLimited: 'Demasiadas solicitudes. Inténtalo de nuevo dentro de un minuto.',
    offline: 'No tienes conexión. Inténtalo de nuevo cuando vuelvas a tenerla.',
    notKept: 'Este navegador no quiso guardar la clave que quita este calendario, así que solo puedes quitarlo aquí, antes de salir de la página.',
    others: 'Otros calendarios creados en este navegador',
    kept: 'Calendarios creados en este navegador',
    made: 'Creado el',
    download: 'Descargar estas fechas (.ics)',
    downloadNote: 'El archivo es una instantánea de las fechas exactas que ves aquí, creada en tu navegador; la suscripción de arriba se mantiene al día por sí sola. Las horas del archivo salen de tu carta exacta, así que cualquiera con quien lo compartas, o cualquier calendario en línea al que lo importes, puede deducir de ellas tu hora de nacimiento y, de las de tu Ascendente o tu Medio Cielo, tu lugar de nacimiento.',
  },
  pt: {
    action: 'Adicionar ao seu calendário',
    unavailable: 'Link do calendário indisponível',
    adding: 'Adicionando…',
    note: 'Ao assinar, guardamos as posições deste mapa no nosso servidor, sob um endereço aleatório que não leva mais nada. Nenhum nome, local ou hora de nascimento é guardado, mas os planetas ainda indicam sua data e hora de nascimento, com precisão de minuto, e o Ascendente e o Meio do Céu restringem o seu local de nascimento a uma área de cerca de 110 km de largura perto do equador, menor perto dos polos. Neste calendário, o Ascendente e o Meio do Céu ficam em graus inteiros, então os contatos dele com esses dois pontos são aproximados. O seu serviço de calendário consulta o endereço para se manter atualizado, e qualquer pessoa que tenha o endereço pode ler o calendário. As posições guardadas são apagadas quando você remove o calendário aqui, ou depois de 12 meses sem nenhuma consulta. Este navegador guarda o endereço e a chave que o remove até você removê-lo aqui ou apagar os dados deste site.',
    noteNoTime: 'Ao assinar, guardamos no nosso servidor o céu das 12:00 UTC da sua data de nascimento, sob um endereço aleatório que não leva mais nada. Isso indica a sua data de nascimento, mas nada sobre o seu local de nascimento. Não se sabe onde estava a sua Lua nesse dia, então as datas dos contatos com a sua Lua podem errar por dias ou meses. O seu serviço de calendário consulta o endereço para se manter atualizado, e qualquer pessoa que tenha o endereço pode ler o calendário. As posições guardadas são apagadas quando você remove o calendário aqui, ou depois de 12 meses sem nenhuma consulta. Este navegador guarda o endereço e a chave que o remove até você removê-lo aqui ou apagar os dados deste site.',
    address: 'Endereço do calendário',
    open: 'Abrir no seu app de calendário',
    copy: 'Copiar o endereço',
    copied: 'Copiado',
    remove: 'Remover este calendário',
    removing: 'Removendo…',
    removed: 'Removido. O endereço deixa de funcionar em menos de uma hora; apague também o calendário no seu app de calendário.',
    addFailed: 'Não foi possível adicionar o calendário. Tente novamente mais tarde.',
    removeFailed: 'Não foi possível remover o calendário. Tente novamente mais tarde.',
    rateLimited: 'Solicitações demais. Tente novamente daqui a um minuto.',
    offline: 'Você está sem conexão. Tente novamente quando estiver conectado.',
    notKept: 'Este navegador não guardou a chave que remove este calendário, então você só pode removê-lo aqui, antes de sair da página.',
    others: 'Outros calendários criados neste navegador',
    kept: 'Calendários criados neste navegador',
    made: 'Criado em',
    download: 'Baixar estas datas (.ics)',
    downloadNote: 'O arquivo é um retrato das datas exatas mostradas aqui, criado no seu navegador; a assinatura acima se mantém atualizada sozinha. Os horários do arquivo vêm do seu mapa exato, então qualquer pessoa com quem você o compartilhar, ou qualquer calendário on-line para o qual você o importar, pode descobrir por eles a sua hora de nascimento e, pelos do seu Ascendente ou Meio do Céu, o seu local de nascimento.',
  },
  fr: {
    action: 'Ajouter à ton calendrier',
    unavailable: 'Lien de calendrier indisponible',
    adding: 'Ajout…',
    note: 'En t’abonnant, tu fais enregistrer les positions de ce thème sur notre serveur, sous une adresse aléatoire qui ne contient rien d’autre. Aucun nom, lieu ni heure de naissance n’est enregistré, mais les planètes donnent quand même ta date et ton heure de naissance, à la minute près, et l’Ascendant et le Milieu du Ciel situent ton lieu de naissance dans une zone d’environ 110 km de large près de l’équateur, plus petite vers les pôles. Dans ce calendrier, l’Ascendant et le Milieu du Ciel sont gardés au degré entier : ses contacts avec ces deux points sont donc approximatifs. Ton service de calendrier consulte l’adresse pour rester à jour, et toute personne qui a l’adresse peut lire le calendrier. Les positions enregistrées sont effacées quand tu retires le calendrier ici, ou après 12 mois sans aucune consultation. Ce navigateur garde l’adresse et la clé qui le retire jusqu’à ce que tu le retires ici ou que tu effaces les données de ce site.',
    noteNoTime: 'En t’abonnant, tu fais enregistrer sur notre serveur le ciel de 12:00 UTC à ta date de naissance, sous une adresse aléatoire qui ne contient rien d’autre. Il donne ta date de naissance, mais rien sur ton lieu de naissance. On ne sait pas où était ta Lune ce jour-là, donc les dates des contacts avec ta Lune peuvent être décalées de plusieurs jours ou mois. Ton service de calendrier consulte l’adresse pour rester à jour, et toute personne qui a l’adresse peut lire le calendrier. Les positions enregistrées sont effacées quand tu retires le calendrier ici, ou après 12 mois sans aucune consultation. Ce navigateur garde l’adresse et la clé qui le retire jusqu’à ce que tu le retires ici ou que tu effaces les données de ce site.',
    address: 'Adresse du calendrier',
    open: 'Ouvrir dans ton app de calendrier',
    copy: 'Copier l’adresse',
    copied: 'Copiée',
    remove: 'Retirer ce calendrier',
    removing: 'Retrait…',
    removed: 'Retiré. L’adresse cesse de fonctionner dans l’heure ; supprime aussi le calendrier dans ton app de calendrier.',
    addFailed: 'Le calendrier n’a pas pu être ajouté. Réessaie plus tard.',
    removeFailed: 'Le calendrier n’a pas pu être retiré. Réessaie plus tard.',
    rateLimited: 'Trop de demandes. Réessaie dans une minute.',
    offline: 'Tu es hors ligne. Réessaie une fois connecté.',
    notKept: 'Ce navigateur n’a pas gardé la clé qui retire ce calendrier : tu ne peux le retirer qu’ici, avant de quitter la page.',
    others: 'Autres calendriers créés dans ce navigateur',
    kept: 'Calendriers créés dans ce navigateur',
    made: 'Créé le',
    download: 'Télécharger ces dates (.ics)',
    downloadNote: 'Le fichier est un instantané des dates exactes affichées ici, créé dans ton navigateur ; l’abonnement ci-dessus reste à jour tout seul. Ses heures viennent de ton thème exact : toute personne avec qui tu le partages, ou tout calendrier en ligne où tu l’importes, peut en déduire ton heure de naissance et, par celles de ton Ascendant ou de ton Milieu du Ciel, ton lieu de naissance.',
  },
  it: {
    action: 'Aggiungi al tuo calendario',
    unavailable: 'Link al calendario non disponibile',
    adding: 'Aggiunta…',
    note: 'Con l’iscrizione salviamo le posizioni di questo tema sul nostro server, sotto un indirizzo casuale che non contiene nient’altro. Non vengono salvati né nome, né luogo, né ora di nascita, ma i pianeti indicano comunque data e ora della tua nascita, al minuto, e Ascendente e Medio Cielo restringono il luogo di nascita a una zona larga circa 110 km vicino all’equatore, più piccola verso i poli. In questo calendario Ascendente e Medio Cielo sono tenuti al grado intero, quindi i suoi contatti con questi due punti sono approssimativi. Il tuo servizio di calendario consulta l’indirizzo per restare aggiornato, e chiunque abbia l’indirizzo può leggere il calendario. Le posizioni salvate vengono cancellate quando rimuovi il calendario qui, oppure dopo 12 mesi senza alcuna consultazione. Questo browser conserva l’indirizzo e la chiave che lo rimuove finché non lo rimuovi qui o non cancelli i dati di questo sito.',
    noteNoTime: 'Con l’iscrizione salviamo sul nostro server il cielo delle 12:00 UTC della tua data di nascita, sotto un indirizzo casuale che non contiene nient’altro. Indica la data di nascita, ma nulla del luogo di nascita. Non si sa dove fosse la tua Luna quel giorno, quindi le date dei contatti con la tua Luna possono sbagliare di giorni o mesi. Il tuo servizio di calendario consulta l’indirizzo per restare aggiornato, e chiunque abbia l’indirizzo può leggere il calendario. Le posizioni salvate vengono cancellate quando rimuovi il calendario qui, oppure dopo 12 mesi senza alcuna consultazione. Questo browser conserva l’indirizzo e la chiave che lo rimuove finché non lo rimuovi qui o non cancelli i dati di questo sito.',
    address: 'Indirizzo del calendario',
    open: 'Apri nella tua app di calendario',
    copy: 'Copia l’indirizzo',
    copied: 'Copiato',
    remove: 'Rimuovi questo calendario',
    removing: 'Rimozione…',
    removed: 'Rimosso. L’indirizzo smette di funzionare entro un’ora; elimina il calendario anche nella tua app di calendario.',
    addFailed: 'Non è stato possibile aggiungere il calendario. Riprova più tardi.',
    removeFailed: 'Non è stato possibile rimuovere il calendario. Riprova più tardi.',
    rateLimited: 'Troppe richieste. Riprova tra un minuto.',
    offline: 'Sei offline. Riprova quando sei connesso.',
    notKept: 'Questo browser non ha conservato la chiave che rimuove questo calendario, quindi puoi rimuoverlo solo qui, prima di lasciare la pagina.',
    others: 'Altri calendari creati in questo browser',
    kept: 'Calendari creati in questo browser',
    made: 'Creato il',
    download: 'Scarica queste date (.ics)',
    downloadNote: 'Il file è un’istantanea delle date esatte mostrate qui, creata nel tuo browser; l’iscrizione qui sopra si tiene aggiornata da sola. I suoi orari vengono dal tuo tema esatto, quindi chiunque con cui lo condividi, o qualsiasi calendario online in cui lo importi, può ricavarne la tua ora di nascita e, da quelli del tuo Ascendente o Medio Cielo, il tuo luogo di nascita.',
  },
  ru: {
    action: 'Добавить в календарь',
    unavailable: 'Ссылка на календарь недоступна',
    adding: 'Добавляем…',
    note: 'При подписке мы сохраняем положения этой карты на нашем сервере под случайным адресом, который больше ничего не содержит. Имя, место и время рождения не сохраняются, но планеты всё равно выдают дату и время вашего рождения с точностью до минуты, а Асцендент и MC сужают место рождения до области шириной около 110 км у экватора и меньше ближе к полюсам. В этой ленте Асцендент и MC сохранены до целого градуса, поэтому её контакты с этими двумя точками приблизительны. Ваш календарный сервис обращается по адресу, чтобы получать обновления, и любой, у кого есть адрес, может прочитать календарь. Сохранённые положения удаляются, когда вы удаляете календарь здесь, или через 12 месяцев без обращений. Этот браузер хранит адрес и ключ для удаления, пока вы не удалите календарь здесь или не очистите данные этого сайта.',
    noteNoTime: 'При подписке мы сохраняем на нашем сервере небо на 12:00 UTC в день вашего рождения под случайным адресом, который больше ничего не содержит. Оно выдаёт дату рождения, но ничего не говорит о месте рождения. Где была ваша Луна в тот день, неизвестно, поэтому даты контактов с вашей Луной могут ошибаться на дни или месяцы. Ваш календарный сервис обращается по адресу, чтобы получать обновления, и любой, у кого есть адрес, может прочитать календарь. Сохранённые положения удаляются, когда вы удаляете календарь здесь, или через 12 месяцев без обращений. Этот браузер хранит адрес и ключ для удаления, пока вы не удалите календарь здесь или не очистите данные этого сайта.',
    address: 'Адрес календаря',
    open: 'Открыть в приложении календаря',
    copy: 'Скопировать адрес',
    copied: 'Скопировано',
    remove: 'Удалить этот календарь',
    removing: 'Удаляем…',
    removed: 'Удалено. Адрес перестанет работать в течение часа; удалите календарь и в приложении календаря.',
    addFailed: 'Не удалось добавить календарь. Попробуйте позже.',
    removeFailed: 'Не удалось удалить календарь. Попробуйте позже.',
    rateLimited: 'Слишком много запросов. Попробуйте через минуту.',
    offline: 'Нет подключения к сети. Попробуйте, когда оно появится.',
    notKept: 'Этот браузер не сохранил ключ для удаления этого календаря, поэтому удалить его можно только здесь, пока вы не ушли со страницы.',
    others: 'Другие календари, созданные в этом браузере',
    kept: 'Календари, созданные в этом браузере',
    made: 'Создан',
    download: 'Скачать эти даты (.ics)',
    downloadNote: 'Файл — снимок точных дат, показанных здесь, созданный в вашем браузере; подписка выше обновляется сама. Время в файле взято из вашей точной карты, поэтому любой, с кем вы им поделитесь, или любой онлайн-календарь, в который вы его импортируете, сможет вычислить по нему время вашего рождения, а по контактам с Асцендентом или MC — и место рождения.',
  },
} as const;

/**
 * The feed's code: every position to 0.001°, ASC and MC to the whole degree.
 * Given positions a code may carry: at the whole minute with a birth time,
 * at 12:00 UTC on the birth date without one. The code leaves the device
 * only in the body of the request that makes a feed; the feed's address
 * carries a random id and nothing else.
 */
export function calendarToken(positions: Omit<CalendarPositionsSource, 'utc'>): string | null {
  return encodeSharedPositionsLink(positions as PositionsShareInput);
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

type FeedMessage = keyof Pick<typeof COPY.en,
  'removed' | 'addFailed' | 'removeFailed' | 'rateLimited' | 'offline' | 'notKept'>;

/** Keep every removal key observed in this visit, even if storage is unavailable. */
function mergeFeeds(...groups: KeptCalendarFeed[][]): KeptCalendarFeed[] {
  const feeds = new Map<string, KeptCalendarFeed>();
  for (const group of groups) {
    for (const feed of group) if (!feeds.has(feed.id)) feeds.set(feed.id, feed);
  }
  return [...feeds.values()].sort((a, b) => b.madeAt - a.madeAt);
}

function FeedAddress({ feed, copy }: { feed: KeptCalendarFeed; copy: (typeof COPY)[Locale] }) {
  const [copied, setCopied] = useState(false);
  const webcal = calendarFeedWebcalUrl(feed.url);
  return (
    <>
      <label class="calendar-subscribe__address">
        <span class="field__label">{copy.address}</span>
        <input
          class="field__input"
          type="text"
          readOnly
          value={feed.url}
          onFocus={(event) => (event.currentTarget as HTMLInputElement).select()}
          data-calendar-feed-url
        />
      </label>
      {webcal && (
        <a class="btn btn--glass" href={webcal} data-calendar-open>
          <span>{copy.open}</span>
          <span class="orb">↗</span>
        </a>
      )}
      <button
        type="button"
        class="btn btn--ghost"
        onClick={() => {
          void navigator.clipboard?.writeText(feed.url).then(() => setCopied(true), () => setCopied(false));
        }}
        data-calendar-copy
      >
        <span>{copied ? copy.copied : copy.copy}</span>
        <span class="orb">{copied ? '✓' : '⧉'}</span>
      </button>
    </>
  );
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
  const loadSource = useMemo(() => ({}), [birthDate, houseSystem, engineVersion, wholeMinute, bodies, asc, mc, instant]);
  const [loadedSource, setLoaded] = useState<{ source: typeof loadSource; token: string | null } | null>(null);
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
      if (current) setLoaded({ source: loadSource, token: shared ? calendarToken(shared) : null });
    }, (error) => console.error(error));
    return () => { current = false; };
  }, [loadSource]);
  // A passive effect has not necessarily run yet when new chart props render.
  const loaded = loadedSource?.source === loadSource ? loadedSource.token : null;
  const token = wholeMinute ? direct : loaded;
  const chart = useRef({ token, revision: 0 });
  if (chart.current.token !== token) chart.current = { token, revision: chart.current.revision + 1 };
  const revision = chart.current.revision;

  // The feeds this browser made. Nothing about a chart is kept with them, so
  // only the feed made during this visit is shown as this chart's, even if
  // this browser would not keep it; the rest are listed below.
  const [kept, setKept] = useState<KeptCalendarFeed[]>([]);
  const [made, setMade] = useState<{ feed: KeptCalendarFeed; revision: number } | null>(null);
  const [pending, setPending] = useState<'adding' | string | null>(null);
  const requestInFlight = useRef(false);
  const mounted = useRef(true);
  const [message, setMessage] = useState<FeedMessage | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    mounted.current = true;
    const refresh = () => {
      const feeds = readAvailableCalendarFeeds();
      setKept(feeds);
      setMade((previous) => previous && feeds.some((feed) => feed.id === previous.feed.id) ? previous : null);
      setPending(calendarFeedRequestPending());
      if (hasUnstoredCalendarFeeds()) setMessage('notKept');
      else setMessage((previous) => previous === 'notKept' ? null : previous);
    };
    const stop = watchCalendarFeeds(refresh);
    setKept((previous) => mergeFeeds(previous, readAvailableCalendarFeeds()));
    setPending(calendarFeedRequestPending());
    if (hasUnstoredCalendarFeeds()) setMessage('notKept');
    return () => { mounted.current = false; stop(); };
  }, []);
  // A different chart never inherits a feed, including before effects run or
  // when an older request finishes. Its removal key stays in the visit's list.
  const own = made?.revision === revision ? made.feed : null;
  const others = kept.filter((feed) => feed.id !== own?.id);

  async function subscribe(): Promise<void> {
    if (!mounted.current || !token || requestInFlight.current || calendarFeedRequestPending()
      || chart.current.revision !== revision) return;
    const clearEpoch = calendarFeedClearEpoch();
    requestInFlight.current = true;
    setPending('adding');
    setMessage(null);
    try {
      const result = await createCalendarFeed(token);
      if (!mounted.current || calendarFeedClearEpoch() !== clearEpoch) return;
      if (result.state === 'created') {
        setKept((previous) => mergeFeeds([result.feed], previous, readAvailableCalendarFeeds()));
        if (chart.current.revision === revision) setMade({ feed: result.feed, revision });
        if (!result.kept) setMessage('notKept');
        track('calendar_subscribe');
      } else if (result.state !== 'busy' && result.state !== 'cancelled') {
        setMessage(result.state === 'rate-limited'
          ? 'rateLimited'
          : result.state === 'offline' ? 'offline' : 'addFailed');
      }
    } finally {
      requestInFlight.current = false;
      if (mounted.current) setPending(calendarFeedRequestPending());
    }
  }

  async function remove(feed: KeptCalendarFeed): Promise<void> {
    if (!mounted.current || requestInFlight.current || calendarFeedRequestPending()) return;
    const clearEpoch = calendarFeedClearEpoch();
    requestInFlight.current = true;
    setPending(feed.id);
    setMessage(null);
    try {
      const result = await removeCalendarFeed(feed);
      if (!mounted.current || calendarFeedClearEpoch() !== clearEpoch) return;
      if (result === 'removed') {
        setMade((previous) => previous?.feed.id === feed.id ? null : previous);
        setKept((previous) => mergeFeeds(previous, readAvailableCalendarFeeds()).filter((other) => other.id !== feed.id));
        setMessage('removed');
      } else if (result !== 'busy') {
        setMessage(result === 'offline' ? 'offline' : 'removeFailed');
      }
    } finally {
      requestInFlight.current = false;
      if (mounted.current) setPending(calendarFeedRequestPending());
    }
  }

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

  const failure = message === 'addFailed' || message === 'removeFailed'
    || message === 'rateLimited' || message === 'offline';

  return (
    <div class="calendar-subscribe">
      {own ? (
        <>
          <FeedAddress feed={own} copy={copy} />
          <button
            type="button"
            class="btn btn--ghost"
            disabled={pending !== null}
            onClick={() => { void remove(own); }}
            data-calendar-remove
          >
            <span>{pending === own.id ? copy.removing : copy.remove}</span>
          </button>
        </>
      ) : (
        <button
          type="button"
          class="btn btn--glass"
          disabled={!token || pending !== null}
          onClick={() => { void subscribe(); }}
          data-calendar-subscribe
        >
          <span>{!token ? copy.unavailable : pending === 'adding' ? copy.adding : copy.action}</span>
          <span class="orb">↗</span>
        </button>
      )}
      {message && (
        <p class={failure ? 'calendar-subscribe__error' : 'calendar-subscribe__status'} role={failure ? 'alert' : 'status'}>
          {copy[message]}
        </p>
      )}
      <p class="calendar-subscribe__note">{timeUnknown ? copy.noteNoTime : copy.note}</p>
      {others.length > 0 && (
        <details class="calendar-subscribe__others" data-calendar-others>
          <summary>{own ? copy.others : copy.kept} ({others.length})</summary>
          <ul>
            {others.map((feed) => (
              <li key={feed.id}>
                <span>
                  {copy.made}{' '}
                  {formatDate(locale, new Date(feed.madeAt), { year: 'numeric', month: 'long', day: 'numeric' })}
                </span>
                <code class="calendar-subscribe__url">{feed.url}</code>
                <button
                  type="button"
                  class="btn btn--ghost"
                  disabled={pending !== null}
                  onClick={() => { void remove(feed); }}
                  data-calendar-remove-other
                >
                  <span>{pending === feed.id ? copy.removing : copy.remove}</span>
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}
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
