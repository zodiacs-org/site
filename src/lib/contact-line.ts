/**
 * One readable sentence for an inter-chart contact, for get_compatibility
 * and the relationship islands: compat.ts's synastryLine, except that a
 * generational contact (generational-contact.ts) gets modest wording.
 * compat.ts itself is left as it is, because the Chart Studio panel bundles it.
 */
import { BODY_ROLE, synastryLine } from './compat';
import { isGenerationalContact } from './generational-contact';

/**
 * Plainer verbs and one modest gloss for a generational contact: most people
 * born in the same few years share it, so it describes a shared backdrop,
 * not something the pair feels strongly.
 */
const GENERATIONAL_VERB: Record<string, string> = {
  conjunction: 'lines up with',
  sextile: 'links with',
  square: 'meets',
  trine: 'links with',
  opposition: 'faces',
};
export const GENERATIONAL_GLOSS = 'A shared generational backdrop, common to many people born in the same years.';

/**
 * One readable sentence for an inter-chart contact: compat.ts's synastryLine,
 * except that a generational contact gets the modest wording above.
 */
export function contactLine(aName: string, aBody: string, bName: string, bBody: string, type: string): string {
  const verb = GENERATIONAL_VERB[type];
  if (verb === undefined || !isGenerationalContact({ a: aBody, b: bBody, type })) {
    return synastryLine(aName, aBody, bName, bBody, type);
  }
  const roleA = BODY_ROLE[aBody] ?? aBody.toLowerCase();
  const roleB = BODY_ROLE[bBody] ?? bBody.toLowerCase();
  const subject = aBody === bBody
    ? `${aName}’s ${roleA} ${verb} ${bName}’s`
    : `${aName}’s ${roleA} ${verb} ${bName}’s ${roleB}`;
  return `${subject}. ${GENERATIONAL_GLOSS}`;
}
