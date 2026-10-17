/**
 * /numerology/'s numbers, from the same numerologyProfile the page calls with the same fallback: a name with no
 * letter left after normalising gives the date numbers alone (numerology.test.ts runs the island's code beside this).
 */
import { NumerologyInputError, numerologyProfile, type Reduction } from '../../numerology';
import { pageUrl } from './format';

const reduction = (value: Reduction | null | undefined) => (value ? {
  value: value.value, total: value.total, chain: [...value.chain], karmicDebt: value.karmicDebt,
} : null);

export function numerologyResult(birthDate: string, fullName: string | null, today: string) {
  let profile;
  let nameUsed = fullName !== null && fullName.trim() !== '';
  try {
    profile = numerologyProfile({ birthDate, fullName: fullName ?? undefined, today });
  } catch (error) {
    if (!(error instanceof NumerologyInputError) || error.code !== 'empty-name') throw error;
    profile = numerologyProfile({ birthDate, today });
    nameUsed = false;
  }
  return {
    birthDate,
    nameUsed,
    lifePath: reduction(profile.date.lifePath),
    birthday: reduction(profile.date.birthday),
    attitude: profile.date.attitude,
    expression: reduction(profile.name?.expression),
    soulUrge: reduction(profile.name?.soulUrge),
    personality: reduction(profile.name?.personality),
    maturity: reduction(profile.maturity),
    personalCycles: { ...profile.personalCycles },
    karmicDebts: [...profile.karmicDebts],
    page: pageUrl('/numerology/'),
  };
}
