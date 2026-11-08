import type { ExpansionLocale } from '../horoscope/types';
import type { LunationCopy } from './types';

const found = import.meta.glob<Record<string, LunationCopy>>(['./es.ts', './pt.ts', './fr.ts', './it.ts', './ru.ts'], { eager: true });

export const LUNATION_COPY: Partial<Record<ExpansionLocale, LunationCopy>> = Object.fromEntries(
  Object.entries(found).map(([path, mod]) => [path.slice(2, -3), mod[path.slice(2, -3)]]),
);

export function lunationCopy(locale: ExpansionLocale): LunationCopy {
  const copy = LUNATION_COPY[locale];
  if (!copy) throw new Error(`No full and new Moon copy is written for ${locale}`);
  return copy;
}
