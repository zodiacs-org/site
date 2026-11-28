/**
 * Consumer-facing notices for the three flags added in @zodiacs/engine 2.0.0
 * (`polar-angles`, `calendar-unknown`, `host-zone-data-differs`). Kept in a
 * chart-only module so unrelated AI panels and non-calculator pages do not
 * bundle these strings.
 */
import type { CatalogLocale } from './i18n/core';

export type Engine2NoticeFlag = 'polar-angles' | 'calendar-unknown' | 'host-zone-data-differs';
export type Engine2NoticeKey =
  | Engine2NoticeFlag
  | 'calendar-unknown-julian'
  | 'calendar-unknown-saved'
  | 'host-zone-data-differs-saved';

const NOTICES: Readonly<Record<CatalogLocale, Readonly<Record<Engine2NoticeKey, string>>>> = Object.freeze({
  en: {
    'polar-angles': 'This birthplace is inside a polar circle, where standard angles behave differently.',
    'calendar-unknown': 'Some countries switched from the Julian to the Gregorian calendar around this date. Check whether your birth record used the Gregorian (New Style) calendar.',
    'calendar-unknown-julian': 'Some countries switched from the Julian to the Gregorian calendar around this date. Because you chose Old Style (Julian), check whether your birth record used the Julian calendar rather than Gregorian (New Style).',
    'calendar-unknown-saved': 'Some countries switched from the Julian to the Gregorian calendar around this date. Check which calendar your birth record used.',
    'host-zone-data-differs': "Your device's time-zone data differs from our historical table near this date, so your device's offset was used.",
    'host-zone-data-differs-saved': 'The device that originally calculated this saved chart had time-zone data that differed from our historical table near this date, so that offset was used.',
  },
  es: {
    'polar-angles': 'Este lugar de nacimiento está dentro de un círculo polar, donde los ángulos estándar se comportan de forma distinta.',
    'calendar-unknown': 'Algunos países cambiaron del calendario juliano al gregoriano alrededor de esta fecha. Comprueba si tu registro de nacimiento usó el calendario gregoriano (estilo nuevo).',
    'calendar-unknown-julian': 'Algunos países cambiaron del calendario juliano al gregoriano alrededor de esta fecha. Como elegiste el estilo antiguo (juliano), comprueba si tu registro de nacimiento usó el calendario juliano en lugar del gregoriano (estilo nuevo).',
    'calendar-unknown-saved': 'Algunos países cambiaron del calendario juliano al gregoriano alrededor de esta fecha. Comprueba qué calendario usó tu registro de nacimiento.',
    'host-zone-data-differs': 'Los datos de zona horaria de tu dispositivo difieren de nuestra tabla histórica cerca de esta fecha, así que se usó el desplazamiento de tu dispositivo.',
    'host-zone-data-differs-saved': 'El dispositivo que calculó originalmente esta carta guardada tenía datos de zona horaria distintos de nuestra tabla histórica cerca de esta fecha, así que se usó ese desplazamiento.',
  },
  pt: {
    'polar-angles': 'Este local de nascimento fica dentro de um círculo polar, onde os ângulos padrão se comportam de forma diferente.',
    'calendar-unknown': 'Alguns países mudaram do calendário juliano para o gregoriano por volta desta data. Verifique se o seu registro de nascimento usou o calendário gregoriano (estilo novo).',
    'calendar-unknown-julian': 'Alguns países mudaram do calendário juliano para o gregoriano por volta desta data. Como você escolheu o estilo antigo (juliano), verifique se o seu registro de nascimento usou o calendário juliano em vez do gregoriano (estilo novo).',
    'calendar-unknown-saved': 'Alguns países mudaram do calendário juliano para o gregoriano por volta desta data. Verifique qual calendário o seu registro de nascimento usou.',
    'host-zone-data-differs': 'Os dados de fuso horário do seu dispositivo diferem da nossa tabela histórica perto desta data, então o deslocamento do seu dispositivo foi usado.',
    'host-zone-data-differs-saved': 'O dispositivo que calculou originalmente este mapa salvo tinha dados de fuso horário diferentes da nossa tabela histórica perto desta data, então esse deslocamento foi usado.',
  },
  fr: {
    'polar-angles': 'Ce lieu de naissance se trouve à l’intérieur d’un cercle polaire, où les angles standards se comportent différemment.',
    'calendar-unknown': 'Certains pays sont passés du calendrier julien au calendrier grégorien autour de cette date. Vérifie que ton acte de naissance utilise le calendrier grégorien (nouveau style).',
    'calendar-unknown-julian': 'Certains pays sont passés du calendrier julien au calendrier grégorien autour de cette date. Comme tu as choisi l’ancien style (julien), vérifie que ton acte de naissance utilise le calendrier julien plutôt que le calendrier grégorien (nouveau style).',
    'calendar-unknown-saved': 'Certains pays sont passés du calendrier julien au calendrier grégorien autour de cette date. Vérifie quel calendrier ton acte de naissance utilise.',
    'host-zone-data-differs': 'Les données de fuseau horaire de ton appareil diffèrent de notre table historique autour de cette date, donc le décalage de ton appareil a été utilisé.',
    'host-zone-data-differs-saved': 'L’appareil qui a calculé ce thème enregistré avait des données de fuseau horaire différentes de notre table historique autour de cette date, donc ce décalage a été utilisé.',
  },
  it: {
    'polar-angles': 'Questo luogo di nascita si trova dentro un circolo polare, dove gli angoli standard si comportano diversamente.',
    'calendar-unknown': 'Alcuni paesi sono passati dal calendario giuliano a quello gregoriano intorno a questa data. Verifica se il tuo atto di nascita usa il calendario gregoriano (nuovo stile).',
    'calendar-unknown-julian': 'Alcuni paesi sono passati dal calendario giuliano a quello gregoriano intorno a questa data. Poiché hai scelto il vecchio stile (giuliano), verifica se il tuo atto di nascita usa il calendario giuliano anziché quello gregoriano (nuovo stile).',
    'calendar-unknown-saved': 'Alcuni paesi sono passati dal calendario giuliano a quello gregoriano intorno a questa data. Verifica quale calendario usa il tuo atto di nascita.',
    'host-zone-data-differs': 'I dati del fuso orario del tuo dispositivo differiscono dalla nostra tabella storica vicino a questa data, quindi è stato usato lo scarto del tuo dispositivo.',
    'host-zone-data-differs-saved': 'Il dispositivo che ha calcolato questo tema salvato aveva dati di fuso orario diversi dalla nostra tabella storica vicino a questa data, quindi è stato usato quello scarto.',
  },
  ru: {
    'polar-angles': 'Это место рождения находится за полярным кругом, где стандартные углы ведут себя иначе.',
    'calendar-unknown': 'Около этой даты некоторые страны переходили с юлианского календаря на григорианский. Проверьте, указана ли дата в вашей записи о рождении по григорианскому (новому) стилю.',
    'calendar-unknown-julian': 'Около этой даты некоторые страны переходили с юлианского календаря на григорианский. Поскольку вы выбрали старый (юлианский) стиль, проверьте, указана ли дата в вашей записи о рождении именно по юлианскому календарю, а не по григорианскому (новому) стилю.',
    'calendar-unknown-saved': 'Около этой даты некоторые страны переходили с юлианского календаря на григорианский. Проверьте, по какому календарю указана дата в вашей записи о рождении.',
    'host-zone-data-differs': 'Данные часовых поясов вашего устройства отличаются от нашей исторической таблицы около этой даты, поэтому использовано смещение вашего устройства.',
    'host-zone-data-differs-saved': 'У устройства, на котором изначально была рассчитана эта сохранённая карта, данные часовых поясов отличались от нашей исторической таблицы около этой даты, поэтому было использовано то смещение.',
  },
});

export interface Engine2NoticeItem {
  key: Engine2NoticeKey;
  text: string;
}

export function engine2Notice(locale: CatalogLocale, flag: Engine2NoticeKey): string {
  return NOTICES[locale][flag];
}

export function resolveEngine2Notices(
  locale: CatalogLocale,
  flags: readonly string[],
  options: { convertedFromJulian?: boolean; fromSavedChart?: boolean; fromSavedSummary?: boolean } = {},
): Engine2NoticeItem[] {
  const keys: Engine2NoticeKey[] = [];
  if (flags.includes('polar-angles')) keys.push('polar-angles');
  if (flags.includes('calendar-unknown')) {
    keys.push(
      options.convertedFromJulian
        ? 'calendar-unknown-julian'
        : options.fromSavedChart
          ? 'calendar-unknown-saved'
          : 'calendar-unknown',
    );
  }
  if (flags.includes('host-zone-data-differs')) {
    keys.push(options.fromSavedSummary ? 'host-zone-data-differs-saved' : 'host-zone-data-differs');
  }
  return keys.map((key) => ({ key, text: engine2Notice(locale, key) }));
}
