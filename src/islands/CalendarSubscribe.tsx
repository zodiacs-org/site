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
  },
  es: {
    download: 'Descargar estas fechas (.ics)',
    downloadNote: 'El archivo es una instantánea de las fechas exactas que ves aquí, creada en tu navegador. Las horas del archivo salen de tu carta exacta, así que cualquiera con quien lo compartas, o cualquier calendario en línea al que lo importes, puede deducir de ellas tu hora de nacimiento y, de las de tu Ascendente o tu Medio Cielo, tu lugar de nacimiento.',
  },
  pt: {
    download: 'Baixar estas datas (.ics)',
    downloadNote: 'O arquivo é um retrato das datas exatas mostradas aqui, criado no seu navegador. Os horários do arquivo vêm do seu mapa exato, então qualquer pessoa com quem você o compartilhar, ou qualquer calendário on-line para o qual você o importar, pode descobrir por eles a sua hora de nascimento e, pelos do seu Ascendente ou Meio do Céu, o seu local de nascimento.',
  },
  fr: {
    download: 'Télécharger ces dates (.ics)',
    downloadNote: 'Le fichier est un instantané des dates exactes affichées ici, créé dans ton navigateur. Ses heures viennent de ton thème exact : toute personne avec qui tu le partages, ou tout calendrier en ligne où tu l’importes, peut en déduire ton heure de naissance et, par celles de ton Ascendant ou de ton Milieu du Ciel, ton lieu de naissance.',
  },
  it: {
    download: 'Scarica queste date (.ics)',
    downloadNote: 'Il file è un’istantanea delle date esatte mostrate qui, creata nel tuo browser. I suoi orari vengono dal tuo tema esatto, quindi chiunque con cui lo condividi, o qualsiasi calendario online in cui lo importi, può ricavarne la tua ora di nascita e, da quelli del tuo Ascendente o Medio Cielo, il tuo luogo di nascita.',
  },
  ru: {
    download: 'Скачать эти даты (.ics)',
    downloadNote: 'Файл — снимок точных дат, показанных здесь, созданный в вашем браузере. Время в файле взято из вашей точной карты, поэтому любой, с кем вы им поделитесь, или любой онлайн-календарь, в который вы его импортируете, сможет вычислить по нему время вашего рождения, а по контактам с Асцендентом или MC — и место рождения.',
  },
} as const;

function track(name: 'calendar_download'): void {
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
          <p class="calendar-subscribe__note">{copy.downloadNote}</p>
        </>
      )}
    </div>
  );
}
