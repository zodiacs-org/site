/**
 * Every word the Moon journal prints, keyed by locale. English lives here;
 * Spanish, Portuguese, French and Italian live in copy-{es,pt,fr,it}.ts and
 * register themselves with defineMoonJournalCopy when imported, so each page
 * and its island carry only their own language.
 *
 * Voice: plain, warm, dry and specific. The prompts are questions, never
 * predictions, and each one is written for the sign the lunation falls in.
 * No em or en dashes anywhere (moon-journal.test.ts checks every string).
 */
import type { SignSlug } from './types';

export const MOON_JOURNAL_LOCALES = ['en', 'es', 'pt', 'fr', 'it'] as const;
export type MoonJournalLocale = typeof MOON_JOURNAL_LOCALES[number];
export type LunationPhase = 'new' | 'full';

export interface MoonJournalCopy {
  /** BCP 47 tag for dates. */
  dateLocale: string;
  /** The page's address, for the calendar file's links. */
  pageUrl: string;
  /** The prompt for each phase, in each sign the Moon can be in. */
  prompts: Record<LunationPhase, Record<SignSlug, string>>;
  phaseName: Record<LunationPhase, string>;
  /** The phase inside a sentence: 'the last new Moon'. */
  phaseInline: Record<LunationPhase, string>;
  /** 'New Moon in Scorpio'. */
  lunationTitle: (phase: LunationPhase, sign: string) => string;
  ui: {
    nowHeading: string;
    phaseTonight: string;
    illuminated: (percent: number) => string;
    moonIn: (sign: string) => string;
    nextNew: string;
    nextFull: string;
    /** The next new or full Moon: its date, then its sign. */
    nextIn: (date: string, sign: string) => string;
    promptHeading: string;
    promptFor: (title: string, date: string) => string;
    lastCycleHeading: (phase: string) => string;
    lastCycleEmpty: (phase: string) => string;
    textareaLabel: string;
    save: string;
    saved: string;
    savedNotKept: string;
    clear: string;
    pastHeading: string;
    toolsHeading: string;
    pastEmpty: string;
    edit: string;
    cancel: string;
    deleteOne: string;
    deleteOneConfirm: string;
    deleteOneYes: string;
    keep: string;
    downloadJournal: string;
    downloadCalendar: string;
    calendarNote: string;
    deleteAll: string;
    deleteAllConfirm: (count: number) => string;
    deleteAllYes: string;
    deletedAll: string;
    storageBlocked: string;
    storageFull: string;
    dataHorizon: string;
    loading: string;
    exportTitle: string;
    exportIntro: (date: string) => string;
    exportPrompt: string;
    calendarName: string;
    calendarDescription: (prompt: string) => string;
  };
}

const EN: MoonJournalCopy = {
  dateLocale: 'en-US',
  pageUrl: 'https://zodiacs.org/moon-journal/',
  prompts: {
    new: {
      aries: 'What are you starting, and what is the first small move you can make this week?',
      taurus: 'What do you want to build slowly, and what would keep it steady?',
      gemini: 'What conversation, idea or skill do you want to begin?',
      cancer: 'What do you want to start looking after, at home or in yourself?',
      leo: 'What would you like to make or show that is plainly yours?',
      virgo: 'What daily habit do you want to begin, and how small can you make it?',
      libra: 'Which relationship or agreement do you want to begin again on better terms?',
      scorpio: 'What are you ready to commit to fully, even if you keep it to yourself for now?',
      sagittarius: 'What do you want to learn, explore or plan toward this month?',
      capricorn: 'What long piece of work are you starting, and what is the first step?',
      aquarius: 'What would you like to try in a way you have not seen it done before?',
      pisces: 'What quiet hope do you want to give some room this month?',
    },
    full: {
      aries: 'What has come to light about where your energy has been going?',
      taurus: 'What has this month shown you about what you value and what you hold on to?',
      gemini: 'What did you hear or learn this cycle that changed your mind?',
      cancer: 'What has come to light about home, family or how you look after yourself?',
      leo: 'What did people see of you this month, and did it feel true?',
      virgo: 'What has your routine shown you about what is working and what is not?',
      libra: 'What has come into focus in your closest relationships?',
      scorpio: 'What surfaced this cycle that you had been keeping out of sight?',
      sagittarius: 'What did you find out this month that widened your view?',
      capricorn: 'What results can you see from the work you have been putting in?',
      aquarius: 'What has come to light about the people and groups around you?',
      pisces: 'What feeling or hunch became clear this month, and what are you ready to let go?',
    },
  },
  phaseName: { new: 'New Moon', full: 'Full Moon' },
  phaseInline: { new: 'new Moon', full: 'full Moon' },
  lunationTitle: (phase, sign) => `${phase === 'new' ? 'New Moon' : 'Full Moon'} in ${sign}`,
  ui: {
    nowHeading: 'The Moon now',
    phaseTonight: 'Phase',
    illuminated: (percent) => `${percent}% lit`,
    moonIn: (sign) => `Moon in ${sign}`,
    nextNew: 'Next new Moon',
    nextFull: 'Next full Moon',
    nextIn: (date, sign) => `${date}, in ${sign}`,
    promptHeading: 'This cycle’s question',
    promptFor: (title, date) => `For the ${title}, ${date}`,
    lastCycleHeading: (phase) => `What you wrote at the last ${phase}`,
    lastCycleEmpty: (phase) => `Nothing written at the last ${phase}. Your note from this one will show here next time.`,
    textareaLabel: 'Your note',
    save: 'Save note',
    saved: 'Saved on this device.',
    savedNotKept: 'Noted for now. This browser is not keeping it, so download it before you leave.',
    clear: 'Clear',
    pastHeading: 'Past entries',
    toolsHeading: 'Download or delete',
    pastEmpty: 'No entries yet. Your notes will gather here, one for each new and full Moon you write at.',
    edit: 'Edit',
    cancel: 'Cancel',
    deleteOne: 'Delete',
    deleteOneConfirm: 'Delete this entry? It cannot be brought back.',
    deleteOneYes: 'Delete entry',
    keep: 'Keep it',
    downloadJournal: 'Download my journal',
    downloadCalendar: 'Add the next year of Moons to a calendar',
    calendarNote: 'A calendar file with the next 12 new Moons and 12 full Moons, each with its question. It holds no entries.',
    deleteAll: 'Delete everything',
    deleteAllConfirm: (count) => `Delete all ${count} ${count === 1 ? 'entry' : 'entries'} from this device? This cannot be undone. Download your journal first if you want a copy.`,
    deleteAllYes: 'Yes, delete everything',
    deletedAll: 'Everything is deleted from this device.',
    storageBlocked: 'This browser is not letting the page keep anything, perhaps because of a private window or a privacy setting. You can still write, and download what you wrote before you leave.',
    storageFull: 'This device has no room left for the note. Download your journal, then delete a few old entries.',
    dataHorizon: 'The Moon dates on this page run out soon. A newer version of the page will carry the next ones.',
    loading: 'Reading the Moon for your device',
    exportTitle: 'My Moon journal',
    exportIntro: (date) => `Kept on my own device at zodiacs.org/moon-journal/. Downloaded ${date}.`,
    exportPrompt: 'Question',
    calendarName: 'New and full Moons, Zodiacs.org',
    calendarDescription: (prompt) => `Journal question: ${prompt} Write it at zodiacs.org/moon-journal/, where it stays on your device.`,
  },
};

/**
 * The opt-in reminder's words. English only, like the reminder itself: the
 * translated journals do not offer it, so their copy carries none of this.
 */
export const MOON_JOURNAL_REMINDER_COPY = Object.freeze({
  ui: {
    remindHeading: 'Reminders',
    remindBody: 'A notification on the day of each new and full Moon, with a link back to this page. Never more than one a day, counting sky alerts.',
    remindPrivacy: 'Turning them on stores this browser’s push subscription with us, and nothing you write here.',
    remindAccept: 'Remind me at each new and full Moon',
    remindBusy: 'Turning on…',
    remindOn: 'Reminders are on for this browser.',
    remindOff: 'Turn off reminders',
    remindDenied: 'Notifications are blocked in this browser, so reminders can’t reach you. Your browser’s site settings can change that whenever you like.',
    remindError: 'Reminders are unavailable right now. Try again later.',
    remindUnsupported: 'This browser can’t receive notifications from the site, so reminders are not available here.',
    remindIos: 'On iPhone and iPad, reminders work only after you add Zodiacs to your Home Screen. Open the journal from there to turn them on.',
  },
  /** The notification sent on a lunation day: 'New Moon in Scorpio today'. */
  reminder: {
    title: (lunationTitle: string) => `${lunationTitle} today`,
    body: (utcTime: string) => `Exact at ${utcTime} UTC. Your journal question is waiting.`,
  },
});
export type MoonJournalReminderUi = typeof MOON_JOURNAL_REMINDER_COPY.ui;

/** English, frozen; the registry below adds the other languages as their modules load. */
export const MOON_JOURNAL_COPY: Readonly<{ en: MoonJournalCopy }> = Object.freeze({ en: EN });

const REGISTRY: Partial<Record<MoonJournalLocale, MoonJournalCopy>> = { en: EN };

/** Called once by each language's copy module (copy-es.ts and the rest). */
export function defineMoonJournalCopy(locale: MoonJournalLocale, copy: MoonJournalCopy): MoonJournalCopy {
  REGISTRY[locale] = copy;
  return copy;
}

/** A language's words; English until that language's module has registered. */
export function moonJournalCopy(locale: MoonJournalLocale = 'en'): MoonJournalCopy {
  return REGISTRY[locale] ?? EN;
}
