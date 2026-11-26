import { useState } from 'preact/hooks';
import type { PositionsShareInput } from '../lib/share-positions';
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
    download: 'Download these dates (.ics)',
    downloadNote: 'The file is a snapshot of the exact dates shown here, built in your browser. The times in the file come from your exact chart, so anyone you share it with, or any online calendar you import it into, can work out your birth time from them, and your birthplace from those for your Ascendant or Midheaven.',
    downloadNoteCalendarUnknown: 'The file is a snapshot of the dates shown here, built in your browser. Those dates depend on which calendar your birth record used, and anyone you share the file with, or any online calendar you import it into, can still work out your birth time from them, and your birthplace from those for your Ascendant or Midheaven.',
    downloadNoteHostZoneDiffers: 'The file is a snapshot of the dates shown here, built in your browser. The times in the file come from your supplied birth time using the offset from a device whose time-zone data differed from our historical table near your birth date. Contacts to your natal Moon, Ascendant, and Midheaven are omitted, but anyone you share the file with, or any online calendar you import it into, can still work out your birth time from the remaining planetary contacts.',
  },
  es: {
    download: 'Descargar estas fechas (.ics)',
    downloadNote: 'El archivo es una instantánea de las fechas exactas que ves aquí, creada en tu navegador. Las horas del archivo salen de tu carta exacta, así que cualquiera con quien lo compartas, o cualquier calendario en línea al que lo importes, puede deducir de ellas tu hora de nacimiento y, de las de tu Ascendente o tu Medio Cielo, tu lugar de nacimiento.',
    downloadNoteCalendarUnknown: 'El archivo es una instantánea de las fechas que ves aquí, creada en tu navegador. Esas fechas dependen del calendario que usó tu registro de nacimiento, y cualquiera con quien lo compartas, o cualquier calendario en línea al que lo importes, aún puede deducir de ellas tu hora de nacimiento y, de las de tu Ascendente o tu Medio Cielo, tu lugar de nacimiento.',
    downloadNoteHostZoneDiffers: 'El archivo es una instantánea de las fechas que ves aquí, creada en tu navegador. Las horas del archivo salen de la hora de nacimiento que indicaste usando el desfase de un dispositivo cuyos datos de zona horaria diferían de nuestra tabla histórica cerca de tu fecha de nacimiento. Se omiten los contactos con tu Luna natal, tu Ascendente y tu Medio Cielo, pero cualquiera con quien compartas el archivo, o cualquier calendario en línea al que lo importes, aún puede deducir tu hora de nacimiento a partir de los demás contactos planetarios.',
  },
  pt: {
    download: 'Baixar estas datas (.ics)',
    downloadNote: 'O arquivo é um retrato das datas exatas mostradas aqui, criado no seu navegador. Os horários do arquivo vêm do seu mapa exato, então qualquer pessoa com quem você o compartilhar, ou qualquer calendário on-line para o qual você o importar, pode descobrir por eles a sua hora de nascimento e, pelos do seu Ascendente ou Meio do Céu, o seu local de nascimento.',
    downloadNoteCalendarUnknown: 'O arquivo é um retrato das datas mostradas aqui, criado no seu navegador. Essas datas dependem do calendário que o seu registro de nascimento usou, e qualquer pessoa com quem você o compartilhar, ou qualquer calendário on-line para o qual você o importar, ainda pode descobrir por eles a sua hora de nascimento e, pelos do seu Ascendente ou Meio do Céu, o seu local de nascimento.',
    downloadNoteHostZoneDiffers: 'O arquivo é um retrato das datas mostradas aqui, criado no seu navegador. Os horários do arquivo vêm da hora de nascimento informada usando o deslocamento de um dispositivo cujos dados de fuso horário diferiam da nossa tabela histórica perto da sua data de nascimento. Os contatos com sua Lua natal, seu Ascendente e seu Meio do Céu são omitidos, mas qualquer pessoa com quem você compartilhar o arquivo, ou qualquer calendário on-line para o qual o importar, ainda pode deduzir sua hora de nascimento pelos demais contatos planetários.',
  },
  fr: {
    download: 'Télécharger ces dates (.ics)',
    downloadNote: 'Le fichier est un instantané des dates exactes affichées ici, créé dans ton navigateur. Ses heures viennent de ton thème exact : toute personne avec qui tu le partages, ou tout calendrier en ligne où tu l’importes, peut en déduire ton heure de naissance et, par celles de ton Ascendant ou de ton Milieu du Ciel, ton lieu de naissance.',
    downloadNoteCalendarUnknown: 'Le fichier est un instantané des dates affichées ici, créé dans ton navigateur. Ces dates dépendent du calendrier utilisé par ton acte de naissance, et toute personne avec qui tu le partages, ou tout calendrier en ligne où tu l’importes, peut encore en déduire ton heure de naissance et, par celles de ton Ascendant ou de ton Milieu du Ciel, ton lieu de naissance.',
    downloadNoteHostZoneDiffers: 'Le fichier est un instantané des dates affichées ici, créé dans ton navigateur. Ses heures viennent de l’heure de naissance fournie avec le décalage d’un appareil dont les données de fuseau horaire différaient de notre table historique près de ta date de naissance. Les contacts avec ta Lune natale, ton Ascendant et ton Milieu du Ciel sont omis, mais toute personne avec qui tu partages le fichier, ou tout calendrier en ligne où tu l’importes, peut encore en déduire ton heure de naissance à partir des autres contacts planétaires.',
  },
  it: {
    download: 'Scarica queste date (.ics)',
    downloadNote: 'Il file è un’istantanea delle date esatte mostrate qui, creata nel tuo browser. I suoi orari vengono dal tuo tema esatto, quindi chiunque con cui lo condividi, o qualsiasi calendario online in cui lo importi, può ricavarne la tua ora di nascita e, da quelli del tuo Ascendente o Medio Cielo, il tuo luogo di nascita.',
    downloadNoteCalendarUnknown: 'Il file è un’istantanea delle date mostrate qui, creata nel tuo browser. Queste date dipendono dal calendario usato dal tuo atto di nascita, e chiunque con cui lo condividi, o qualsiasi calendario online in cui lo importi, può comunque ricavarne la tua ora di nascita e, da quelli del tuo Ascendente o Medio Cielo, il tuo luogo di nascita.',
    downloadNoteHostZoneDiffers: 'Il file è un’istantanea delle date mostrate qui, creata nel tuo browser. I suoi orari vengono dall’ora di nascita indicata usando lo scarto di un dispositivo i cui dati di fuso orario differivano dalla nostra tabella storica vicino alla tua data di nascita. I contatti con la tua Luna natale, il tuo Ascendente e il tuo Medio Cielo sono omessi, ma chiunque con cui condividi il file, o qualsiasi calendario online in cui lo importi, può comunque ricavare la tua ora di nascita dagli altri contatti planetari.',
  },
  ru: {
    download: 'Скачать эти даты (.ics)',
    downloadNote: 'Файл — снимок точных дат, показанных здесь, созданный в вашем браузере. Время в файле взято из вашей точной карты, поэтому любой, с кем вы им поделитесь, или любой онлайн-календарь, в который вы его импортируете, сможет вычислить по нему время вашего рождения, а по контактам с Асцендентом или MC — и место рождения.',
    downloadNoteCalendarUnknown: 'Файл представляет собой снимок дат, показанных здесь, и создается в вашем браузере. Эти даты зависят от того, по какому календарю указана дата в вашей записи о рождении, а любой, с кем вы им поделитесь, или любой онлайн-календарь, в который вы его импортируете, все равно сможет вычислить по ним время вашего рождения, а по контактам с Асцендентом или MC и место рождения.',
    downloadNoteHostZoneDiffers: 'Файл представляет собой снимок дат, показанных здесь, и создается в вашем браузере. Время в файле рассчитано по указанному вами часу рождения со смещением устройства, данные часовых поясов которого расходились с нашей исторической таблицей вблизи вашей даты рождения. Контакты с натальной Луной, Асцендентом и MC исключены, но любой, с кем вы поделитесь файлом, или любой онлайн-календарь, в который вы его импортируете, все равно сможет вычислить время вашего рождения по остальным планетным контактам.',
  },
} as const;

function track(name: 'calendar_download'): void {
  const analytics = (window as Window & {
    zodiacsAnalytics?: { track?: (name: string, props: { feed: 'transits' }) => void };
  }).zodiacsAnalytics;
  analytics?.track?.(name, { feed: 'transits' });
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
  /** Whether the chart used a device time-zone offset that differs from the historical table. */
  hostZoneDiffers?: boolean;
  /** Additional caveats (such as calendar-changeover uncertainty) appended to exported events. */
  notes?: readonly string[];
}

export default function CalendarSubscribe({ locale, positions, birthDate, contacts, hostZoneDiffers = false, notes }: CalendarSubscribeProps) {
  const copy = COPY[locale];
  const [busy, setBusy] = useState(false);

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
        ...(hostZoneDiffers ? { hostZoneDiffers: true } : {}),
        ...(notes?.length ? { notes } : {}),
      });
      downloadCalendarFile(calendar, 'zodiacs-transit-contacts.ics');
      track('calendar_download');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div class="calendar-subscribe">
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
          <p class="calendar-subscribe__note">
            {hostZoneDiffers
              ? (notes?.length ? `${copy.downloadNoteHostZoneDiffers} ${notes.join(' ')}` : copy.downloadNoteHostZoneDiffers)
              : notes?.length
                ? copy.downloadNoteCalendarUnknown
                : copy.downloadNote}
          </p>
        </>
      )}
    </div>
  );
}
