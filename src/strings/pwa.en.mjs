/** English source catalogue for install metadata rendered by the OS. */
export const PWA_MANIFEST_EN = Object.freeze({
  name: 'Zodiacs | birth charts and daily astrology',
  shortName: 'Zodiacs',
  description: 'Birth charts, daily horoscopes, compatibility, and sign guides, free and private on your device.',
});

/**
 * Long-press (or right-click) destinations on an installed app's icon. The
 * manifest is served once, in English, for every locale; these labels stay
 * out of the additive locale handoff until localized manifests exist.
 */
export const PWA_SHORTCUTS_EN = Object.freeze([
  Object.freeze({
    name: 'Your page',
    shortName: 'Your page',
    description: 'Your chart, your people, and the year ahead.',
    url: '/profile/',
  }),
  Object.freeze({
    name: 'Today',
    shortName: 'Today',
    description: 'Today’s sky and your daily reading.',
    url: '/today/',
  }),
]);

/** English source catalogue for the flag-off future notification surface. */
export const PWA_PUSH_EN = Object.freeze({
  title: 'Today at Zodiacs.org',
  body: 'Your daily sky note is ready.',
});
