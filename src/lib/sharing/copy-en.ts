export const SHARING_EN = {
  jsRequired: 'Enable JavaScript and reload to calculate and share in your browser.', toolsLabel: 'Explore the tools',
  bigTitle: 'Your Sun, Moon, and rising', bigLede: 'Find your three signs, then share a portrait card made in your browser. A birth time is needed for your rising sign.',
  bigSubmit: 'Show my big three', bigHelp: 'Unknown time? Use the birth chart calculator; it leaves rising and houses empty.',
  fullChart: 'Open the full chart', readSign: 'Read {sign}', bigShare: 'Share your big three',
  cardPreparing: 'Preparing your card…', sharing: 'Sharing…', shared: 'Shared', saved: 'Saved', retry: 'Try again',
  cardError: 'The card could not be prepared or saved. Your result is still ready.',
  required: 'Enter a valid birth date, time, and birthplace.', computeError: 'The chart could not be calculated. Check your details and try again.', computing: 'Calculating…',
  privacy: 'Calculated in your browser. No account needed. Birth details are not sent to our servers.',
  cardNote: '1080 × 1920 image. Your birth date, time, and place are left out.',
  inviteTitle: 'Invite a friend to compare charts', inviteLede: 'Add your chart first. Send the link, and your friend adds theirs to see your compatibility.',
  inviteCreate: 'Make an invite link', inviteShare: 'Copy invite link', inviteReady: 'Your friend adds their chart',
  inviteNote: 'The link includes your planetary positions, with rounded angles, but no birth date, time, place, or name. Anyone with the link can read those positions. A chart can still suggest an approximate birth date.',
  inviteArrival: 'A friend shared their chart. Add yours to compare.', invalidInvite: 'This invitation could not be read. Ask your friend for a new link.',
  inviteCopied: 'Invite link copied.', copyFailed: 'Copy was unavailable. Select and copy the link below.', linkLabel: 'Invite link',
  inviteResultsNote: 'The shared side has no original birth instant. Its positions are rounded; unknown-time Moon contacts are omitted.',
  groupTitle: 'Explore your group’s charts', groupLede: 'Add three to eight people and explore what each might bring to the group. Use birth details with their permission.',
  groupSubmit: 'Read the group', addPerson: 'Add a person', removePerson: 'Remove {person}', person: 'Person {n}',
  groupOpening: 'Your group brings different ways of starting, supporting, thinking, and feeling.', groupShare: 'Share the group card',
  groupMethod: 'How the roles are chosen', groupMethodBody: 'We count the elements of the Sun, Mercury, Venus, and Mars signs equally. With a known birth time, the Moon and rising count too. A clear largest count gives the role; a tie gives a blend. Without a time, positions close to a sign boundary are also left out. These are symbolic prompts, not a personality test or a measure of compatibility.',
  groupCount: '{n} of {total} counted placements', groupUnknown: 'Birth time unknown: Moon, rising, and houses are left out of the role.',
  groupError: 'Add three to eight different people, with a valid date and birthplace for each. Supply a time or mark it unknown.',
  roleFire: 'The spark', roleEarth: 'The anchor', roleAir: 'The connector', roleWater: 'The glue', roleBlend: 'The blend',
  fireRead: 'A prompt to notice who brings initiative and momentum.', earthRead: 'A prompt to notice who brings steadiness and practical support.', airRead: 'A prompt to notice who brings ideas and conversation.', waterRead: 'A prompt to notice who brings care and emotional connection.', blendRead: 'Several elements share the lead; there is no single role.',
  groupCardNote: 'The image includes the names or nicknames you entered and symbolic roles. Birth details and degrees are left out. Ask everyone before sharing.',
  twinsTitle: 'Find your chart twins', twinsLede: 'Compare your signs with the sourced people directory. A shared sign is a conversation starter, not proof of a similar personality.',
  twinsSubmit: 'Find matching signs', twinsLimit: 'Every birth time in this directory is unknown. We can compare verified Sun and Moon signs, but cannot claim a three-sign twin or compare rising.',
  twinsOpening: 'You may share a small part of your chart with someone in the public record.', twinsBoth: 'Sun and Moon match', twinsSun: 'Sun matches', twinsMoon: 'Moon matches',
  twinsEmpty: 'No verified Sun and Moon match in this directory yet.', twinsPartial: 'People who share one verified sign',
  twinsNoMoon: 'Your Moon sign is unverified without a birth time, so only your Sun is compared.', twinsCount: 'Matches: {n}',
  unknownTime: 'Birth time unknown', source: 'Birth data and sources', directory: 'Explore the people directory',
  nameHelp: 'Name or nickname', resultChanged: 'Your inputs changed. Calculate again to refresh the result.',
  sharingTools: 'Share and explore together', backCompatibility: 'Open compatibility',
} as const;
export type SharingCopy = Record<keyof typeof SHARING_EN, string>;
export type SharingKey = keyof typeof SHARING_EN;
export function formatSharingCopy(copy: SharingCopy, key: SharingKey, values: Record<string, string | number> = {}): string {
  return copy[key].replace(/\{(\w+)\}/g, (token, name: string) => Object.hasOwn(values, name) ? String(values[name]) : token);
}

