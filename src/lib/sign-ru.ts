import { signPrepositional, type Sign } from './signs';

/** "в Овне", "во Льве": the preposition Russian puts before a sign, with its prepositional case. */
export function signInRu(sign: Sign | string): string {
  const name = signPrepositional(sign);
  return `${/^Льв/u.test(name) ? 'во' : 'в'} ${name}`;
}
