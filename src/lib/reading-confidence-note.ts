export const READING_CONFIDENCE_NOTE = 'Reading confidence says how much birth detail the reading used: 55% for a date alone, 70% for a date, time and place. It is not the chance that anything happens.';
export const CONTACT_CONFIDENCE_NOTE = `${READING_CONFIDENCE_NOTE} A contact within one degree adds five.`;

export const READING_CONFIDENCE_FAQ = { q: 'What does reading confidence mean?', a: READING_CONFIDENCE_NOTE };
export const CONTACT_CONFIDENCE_FAQ = { ...READING_CONFIDENCE_FAQ, a: CONTACT_CONFIDENCE_NOTE };
