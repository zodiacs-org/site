/**
 * The birth forms' calendar copy (engine brief step 1.13b). Kept beside the
 * islands, like saved-records-copy.ts, rather than in the UI catalogs: it
 * loads with the calendar control, once a birth date before 1924 is entered,
 * instead of riding in every page's catalog.
 *
 * Placeholders: {country}, {date}, {julian}, {gregorian}. The country leads a
 * note as a label, so no language has to decline it or give it an article.
 * Dates are the locale's long form.
 */
import type { CatalogLocale } from '../lib/i18n';

export interface BirthCalendarCopy {
  readonly legend: string;
  readonly gregorian: string;
  readonly julian: string;
  /** Placeholder for the Old Style text field. */
  readonly format: string;
  /** Left Gregorian, before the birthplace's country took the New Style. */
  readonly oldStyleNote: string;
  /** Marked Old Style, on or after the day the country took the New Style. */
  readonly newStyleNote: string;
  /** Before the change, where the calendar before was not the Julian. */
  readonly otherCalendarNote: string;
  /** An Old Style date beside the Gregorian date the chart uses. */
  readonly converted: string;
  readonly formatError: string;
  readonly julianError: string;
  readonly gregorianError: string;
}

const en: BirthCalendarCopy = {
  legend: 'Calendar',
  gregorian: 'Gregorian (New Style)',
  julian: 'Julian (Old Style)',
  format: 'YYYY-MM-DD',
  oldStyleNote: '{country}: before {date}, dates were usually written in the Old Style (Julian) calendar. If this date comes from a record of that time, choose Julian.',
  newStyleNote: '{country}: from {date}, dates were usually written in the New Style (Gregorian) calendar. If this date comes from a record of that time, choose Gregorian.',
  otherCalendarNote: '{country}: before {date}, dates were usually written in a different calendar, which this form does not convert. Enter the Gregorian date.',
  converted: '{julian} (Old Style), {gregorian} (New Style)',
  formatError: 'Write the date as year, month and day, for example 1917-10-25.',
  julianError: 'There is no such date in the Julian calendar.',
  gregorianError: 'There is no such date in the Gregorian calendar.',
};

const es: BirthCalendarCopy = {
  legend: 'Calendario',
  gregorian: 'Gregoriano (estilo nuevo)',
  julian: 'Juliano (estilo antiguo)',
  format: 'AAAA-MM-DD',
  oldStyleNote: '{country}: antes del {date}, las fechas solían escribirse en el calendario juliano (estilo antiguo). Si esta fecha viene de un registro de esa época, elige el calendario juliano.',
  newStyleNote: '{country}: desde el {date}, las fechas solían escribirse en el calendario gregoriano (estilo nuevo). Si esta fecha viene de un registro de esa época, elige el calendario gregoriano.',
  otherCalendarNote: '{country}: antes del {date}, las fechas solían escribirse en otro calendario, que este formulario no convierte. Ingresa la fecha del calendario gregoriano.',
  converted: '{julian} (estilo antiguo), {gregorian} (estilo nuevo)',
  formatError: 'Escribe la fecha como año, mes y día; por ejemplo, 1917-10-25.',
  julianError: 'Esa fecha no existe en el calendario juliano.',
  gregorianError: 'Esa fecha no existe en el calendario gregoriano.',
};

const pt: BirthCalendarCopy = {
  legend: 'Calendário',
  gregorian: 'Gregoriano (estilo novo)',
  julian: 'Juliano (estilo antigo)',
  format: 'AAAA-MM-DD',
  oldStyleNote: '{country}: antes de {date}, as datas costumavam ser escritas no calendário juliano (estilo antigo). Se esta data vem de um registro daquela época, escolha o calendário juliano.',
  newStyleNote: '{country}: a partir de {date}, as datas costumavam ser escritas no calendário gregoriano (estilo novo). Se esta data vem de um registro daquela época, escolha o calendário gregoriano.',
  otherCalendarNote: '{country}: antes de {date}, as datas costumavam ser escritas em outro calendário, que este formulário não converte. Informe a data do calendário gregoriano.',
  converted: '{julian} (estilo antigo), {gregorian} (estilo novo)',
  formatError: 'Escreva a data como ano, mês e dia, por exemplo 1917-10-25.',
  julianError: 'Essa data não existe no calendário juliano.',
  gregorianError: 'Essa data não existe no calendário gregoriano.',
};

const fr: BirthCalendarCopy = {
  legend: 'Calendrier',
  gregorian: 'Grégorien (nouveau style)',
  julian: 'Julien (ancien style)',
  format: 'AAAA-MM-JJ',
  oldStyleNote: '{country}\u202f: avant le {date}, les dates suivaient généralement le calendrier julien (ancien style). Si cette date provient d’un document de l’époque, choisis le calendrier julien.',
  newStyleNote: '{country}\u202f: à partir du {date}, les dates suivaient généralement le calendrier grégorien (nouveau style). Si cette date provient d’un document de l’époque, choisis le calendrier grégorien.',
  otherCalendarNote: '{country}\u202f: avant le {date}, les dates suivaient généralement un autre calendrier, que ce formulaire ne convertit pas. Saisis la date du calendrier grégorien.',
  converted: '{julian} (ancien style), {gregorian} (nouveau style)',
  formatError: 'Écris la date sous la forme année, mois, jour, par exemple 1917-10-25.',
  julianError: 'Cette date n’existe pas dans le calendrier julien.',
  gregorianError: 'Cette date n’existe pas dans le calendrier grégorien.',
};

const it: BirthCalendarCopy = {
  legend: 'Calendario',
  gregorian: 'Gregoriano (nuovo stile)',
  julian: 'Giuliano (vecchio stile)',
  format: 'AAAA-MM-GG',
  oldStyleNote: '{country}: prima del giorno {date} le date seguivano di solito il calendario giuliano (vecchio stile). Se questa data viene da un documento dell’epoca, scegli il calendario giuliano.',
  newStyleNote: '{country}: dal giorno {date} le date seguivano di solito il calendario gregoriano (nuovo stile). Se questa data viene da un documento dell’epoca, scegli il calendario gregoriano.',
  otherCalendarNote: '{country}: prima del giorno {date} le date seguivano di solito un altro calendario, che questo modulo non converte. Inserisci la data del calendario gregoriano.',
  converted: '{julian} (vecchio stile), {gregorian} (nuovo stile)',
  formatError: 'Scrivi la data come anno, mese e giorno, per esempio 1917-10-25.',
  julianError: 'Questa data non esiste nel calendario giuliano.',
  gregorianError: 'Questa data non esiste nel calendario gregoriano.',
};

const ru: BirthCalendarCopy = {
  legend: 'Календарь',
  gregorian: 'Григорианский (новый стиль)',
  julian: 'Юлианский (старый стиль)',
  format: 'ГГГГ-ММ-ДД',
  oldStyleNote: '{country}: до {date} даты обычно записывали по старому стилю (юлианский календарь). Если дата взята из документа того времени, выберите юлианский календарь.',
  newStyleNote: '{country}: с {date} даты обычно записывали по новому стилю (григорианский календарь). Если дата взята из документа того времени, выберите григорианский календарь.',
  otherCalendarNote: '{country}: до {date} даты обычно записывали по другому календарю, который эта форма не пересчитывает. Введите дату по григорианскому календарю.',
  converted: '{julian} (старый стиль), {gregorian} (новый стиль)',
  formatError: 'Запишите дату как год, месяц и день, например 1917-10-25.',
  julianError: 'Такой даты нет в юлианском календаре.',
  gregorianError: 'Такой даты нет в григорианском календаре.',
};

export const BIRTH_CALENDAR_COPY: Record<CatalogLocale, BirthCalendarCopy> = { en, es, pt, fr, it, ru };
