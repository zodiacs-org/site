export interface ChineseZodiacAnimal {
  slug: string;
  name: string;
  branch: string;
  branchPinyin: string;
  position: number;
  association: string;
  context: string;
}

export const CHINESE_ZODIAC_ANIMALS: readonly ChineseZodiacAnimal[] = [
  { slug: 'rat', name: 'Rat', branch: '子', branchPinyin: 'zǐ', position: 1, association: 'Traditionally associated with alertness, adaptability, and finding a way through constrained circumstances.', context: 'The Rat opens the twelve-year sequence. Modern personality summaries often call it resourceful; that is a cultural association, not a measured trait.' },
  { slug: 'ox', name: 'Ox', branch: '丑', branchPinyin: 'chǒu', position: 2, association: 'Traditionally associated with steady labor, endurance, and practical responsibility.', context: 'Ox and water buffalo may be treated as the same zodiac category in Chinese art. The image emphasizes sustained work rather than speed.' },
  { slug: 'tiger', name: 'Tiger', branch: '寅', branchPinyin: 'yín', position: 3, association: 'Traditionally associated with courage, force, and protection.', context: 'The Tiger carries a protective as well as a bold register in Chinese visual culture. Short personality lists capture only one use of the symbol.' },
  { slug: 'rabbit', name: 'Rabbit', branch: '卯', branchPinyin: 'mǎo', position: 4, association: 'Traditionally associated with vigilance, grace, and careful movement.', context: 'English sources may use Rabbit or Hare. Regional zodiac traditions can name a different animal, which is one reason this guide stays specific to the Chinese cycle.' },
  { slug: 'dragon', name: 'Dragon', branch: '辰', branchPinyin: 'chén', position: 5, association: 'Traditionally associated with auspicious power, vitality, and authority.', context: 'The Dragon is the sequence’s mythic animal. It carries a different cultural register from the adversarial dragon familiar in much European storytelling.' },
  { slug: 'snake', name: 'Snake', branch: '巳', branchPinyin: 'sì', position: 6, association: 'Traditionally associated with perception, reserve, and transformation.', context: 'The Snake follows the Dragon in the cycle. Interpretive traits vary by source, family, and region; the calendar position is the stable fact.' },
  { slug: 'horse', name: 'Horse', branch: '午', branchPinyin: 'wǔ', position: 7, association: 'Traditionally associated with effort, bravery, resilience, and movement.', context: 'The Horse is seventh in the sequence. Smithsonian material for the 2026 Fire Horse foregrounds hard work, bravery, and resilience.' },
  { slug: 'goat', name: 'Goat', branch: '未', branchPinyin: 'wèi', position: 8, association: 'Traditionally associated with care, harmony, and creative cultivation.', context: 'Goat, Ram, and Sheep all appear in English-language renderings. The underlying Chinese term does not force the same species distinction English does.' },
  { slug: 'monkey', name: 'Monkey', branch: '申', branchPinyin: 'shēn', position: 9, association: 'Traditionally associated with ingenuity, play, and quick adjustment.', context: 'The Monkey is ninth. Folklore and popular personality readings add layers beyond the calendrical animal; those layers are not uniform across all Chinese communities.' },
  { slug: 'rooster', name: 'Rooster', branch: '酉', branchPinyin: 'yǒu', position: 10, association: 'Traditionally associated with diligence, timekeeping, and industriousness.', context: 'The Met notes the rooster’s early rising as the basis for associations with diligence and industry, while also documenting its long use as an auspicious art motif.' },
  { slug: 'dog', name: 'Dog', branch: '戌', branchPinyin: 'xū', position: 11, association: 'Traditionally associated with loyalty, watchfulness, and protection.', context: 'The Dog is eleventh. As on every page in this guide, the association describes a tradition of interpretation, not a personality diagnosis.' },
  { slug: 'pig', name: 'Pig', branch: '亥', branchPinyin: 'hài', position: 12, association: 'Traditionally associated with plenty, generosity, and completion.', context: 'The Pig closes the animal sequence before it returns to Rat. Boar and Pig both occur in English-language references.' },
] as const;

export const CHINESE_ZODIAC_COPY = Object.freeze({
  kicker: 'Chinese zodiac',
  hubTitle: 'The twelve-year animal cycle.',
  hubIntro: 'A careful introduction to the Chinese zodiac: its animal sequence, year tables, historical frame, and the boundary that does not fall on January 1.',
  separateTitle: 'A separate system from Western tropical astrology',
  separateBody: 'Western tropical astrology maps planets against twelve sectors of the ecliptic and uses an exact birth moment. The Chinese zodiac pages here begin with a lunisolar calendar year and its animal branch. The two systems can be studied beside each other, but one does not translate into the other.',
  historyTitle: 'What the cycle records',
  historyBody: 'The twelve animals are paired with the twelve Earthly Branches. Historical evidence places the animal-calendar association in China by the third century BCE, firmly established by the first century. The branches also combine with ten Heavenly Stems in a sixty-part cycle.',
  boundaryTitle: 'The year starts at Lunar New Year',
  boundaryBody: 'An animal year does not switch on January 1. If a birth date falls in January or early February, check the Lunar New Year date for that calendar year before choosing an animal. Dates also vary across Asian traditions, and not every community uses the same zodiac.',
  sourceTitle: 'Museum and cultural sources',
  sequenceTitle: 'The twelve animals, in order',
  yearsTitle: 'Recent and upcoming cycle years',
  animalKicker: 'Animal year guide',
  branchLabel: 'Earthly Branch',
  sequenceLabel: 'Sequence position',
  associationLabel: 'Traditional association',
  yearsLabel: 'Cycle years',
  yearsBoundary: 'These labels name the lunisolar year that begins during the listed Gregorian year. January and early-February births may belong to the preceding animal.',
  limitsTitle: 'What this does, and does not, tell you',
  limitsBody: 'The annual animal is one calendar layer. A fuller Chinese astrology reading may also consider the Heavenly Stem and element, month, day, and hour. A year animal alone cannot determine a personality or predict an outcome.',
  allAnimals: 'All twelve animal years',
  previous: 'Previous animal',
  next: 'Next animal',
  westernLink: 'Read how Western tropical zodiac dates work',
  chartLink: 'Calculate a Western tropical birth chart',
  iconRailNote: 'The colored discs are Zodiacs.org’s Western-sign site mark. They are not substitutes for, or mappings to, the Chinese zodiac animals.',
  itemLink: 'Read the Year of the {animal}',
  siteName: 'Zodiacs.org',
  learnLabel: 'Learn',
  metaHubTitle: 'Chinese Zodiac: The Twelve Animal Years | Zodiacs.org',
  metaAnimalTitle: 'Year of the {animal}: Chinese Zodiac Years | Zodiacs.org',
  metaAnimalDescription: 'Year of the {animal}: cycle years, Earthly Branch {branch} ({pinyin}), traditional associations, and the Lunar New Year boundary.',
  yearOf: 'Year of the {animal}',
  numberLabel: 'Nº {number}',
  positionValue: '{position} of 12',
  sourceSmithsonian: 'Smithsonian, Chinese zodiac sequence and Lunar New Year context',
  sourceSmithsonianHub: 'Smithsonian, Lunar New Year and the zodiac sequence',
  sourceMet: 'The Met, the twelve-year animal calendar and its history',
  sourceMetHub: 'The Met, history of the twelve-animal calendar cycle',
  sourceMetBulletin: 'The Met Bulletin, animals, branches, and the sixty-part cycle',
});

export function chineseZodiacText(
  key: keyof typeof CHINESE_ZODIAC_COPY,
  values: Record<string, string | number> = {},
): string {
  return CHINESE_ZODIAC_COPY[key].replace(/\{(\w+)\}/g, (_, name: string) => String(values[name] ?? ''));
}

export function chineseAnimalForCycleYear(year: number): ChineseZodiacAnimal {
  const index = ((year - 2020) % 12 + 12) % 12;
  return CHINESE_ZODIAC_ANIMALS[index];
}

export function chineseYearsForAnimal(slug: string, from = 1924, to = 2043): number[] {
  const animal = CHINESE_ZODIAC_ANIMALS.find((entry) => entry.slug === slug);
  if (!animal) throw new Error(`Unknown Chinese zodiac animal: ${slug}`);
  return Array.from({ length: to - from + 1 }, (_, index) => from + index)
    .filter((year) => chineseAnimalForCycleYear(year).slug === slug);
}
