/**
 * The birthday pages' reading, taken apart for the magazine layout. Every
 * date's MDX has the same shape: one opening paragraph, three sections
 * (the character, love and work, the growth edge) and a closing paragraph
 * that points to the birth chart. The page quotes two sentences back from
 * that text, verbatim: a pull quote from the first two sections, and the
 * growth edge's own advice for the "For your birthday" card. Nothing here
 * writes a sentence; a date whose text has no suitable line gets none.
 */

export interface BirthdaySection {
  heading: string;
  paragraphs: string[];
}

export interface BirthdayReading {
  intro: string[];
  sections: BirthdaySection[];
  closing: string;
}

export function parseBirthdayBody(body: string): BirthdayReading {
  const blocks = body.trim().split(/\n\s*\n/u).map((block) => block.trim()).filter(Boolean);
  const intro: string[] = [];
  const sections: BirthdaySection[] = [];
  for (const block of blocks) {
    if (block.startsWith('## ')) {
      sections.push({ heading: block.slice(3).trim(), paragraphs: [] });
    } else if (sections.length === 0) {
      intro.push(block);
    } else {
      sections[sections.length - 1].paragraphs.push(block);
    }
  }
  if (sections.length !== 3) throw new Error(`A birthday reading has three sections; found ${sections.length}`);
  const closing = sections[2].paragraphs.pop();
  if (!closing || sections[2].paragraphs.length === 0) throw new Error('A birthday reading ends with its growth edge and a closing paragraph');
  return { intro, sections, closing };
}

/** The prose a reader sees: link text kept, Markdown marks and line breaks gone. */
export function plainText(markdown: string): string {
  return markdown
    .replace(/\[([^\]]*)\]\([^)]*\)/gu, '$1')
    .replace(/[*_]/gu, '')
    .replace(/\s+/gu, ' ')
    .trim();
}

/** The typographic quotes the site's Markdown pipeline prints. */
export function smartQuotes(text: string): string {
  let open = true;
  return text
    .replace(/'/gu, '’')
    .replace(/"/gu, () => {
      const mark = open ? '“' : '”';
      open = !open;
      return mark;
    });
}

export function sentences(paragraph: string): string[] {
  return plainText(paragraph).split(/(?<=[.!?][’”"')\]]*)\s+(?=[A-Z“"‘'(])/u);
}

const SUBJECT_START = /^(The|A|An|What|Every|Each|No|Nobody|Everyone|Most|Few|Some|One|Friends|People|Partners|Others|January|February|March|April|May|June|July|August|September|October|November|December)$/u;
const WEAK_START = /^(It|This|That|And|But|Which|So|Or|Yet|They|There|Here|These|Those|Its|Their|Then)\b/u;
const VERB = /\b(is|are|was|were|be|been|has|have|had|can|could|will|would|does|do|did|gets|get|makes|make|takes|take|keeps|keep|runs|turns|becomes|feels|reads|needs|knows|tends|looks|holds|moves|comes|goes|stays|says|means|wants|lands|starts|ends|works|shows|learns|finds|gives|sees|thinks|lives|loves|arrives|settles|matters|counts|proves|minds|rewards|follows|belongs|carries|wins|hides|asks|treats|builds|leads|sounds|fits|lasts|grows|happens|reaches|notices|trusts|remembers|forgets|sits|stands|falls|rises|shines|burns|breaks|pays|beats|outlasts|survives)\b/u;

function pullCandidates(reading: BirthdayReading, strict: boolean): { text: string; score: number }[] {
  const found: { text: string; score: number }[] = [];
  reading.sections.slice(0, 2).forEach((section, sectionIndex) => {
    for (const paragraph of section.paragraphs) {
      for (const sentence of sentences(paragraph)) {
        const variants = [sentence];
        const afterColon = sentence.match(/^[^:]{8,}:\s+(.+[.!?])$/u);
        if (afterColon) variants.push(afterColon[1].charAt(0).toUpperCase() + afterColon[1].slice(1));
        for (const text of variants) {
          const words = text.split(' ');
          if (text.length < 38 || text.length > 118) continue;
          if (/\d|\(|;/u.test(text)) continue;
          if (words.slice(0, 3).some((word) => word.endsWith(','))) continue;
          if (!VERB.test(text) || /^The ones\b/u.test(text)) continue;
          if (strict ? !SUBJECT_START.test(words[0]) : WEAK_START.test(text)) continue;
          const score = 100 - Math.abs(text.length - 72) * 0.6 - sectionIndex * 12
            - (text.endsWith('?') ? 10 : 0) - (text === sentence ? 0 : 4);
          found.push({ text, score });
        }
      }
    }
  });
  return found.sort((a, b) => b.score - a.score);
}

/**
 * One sentence (or the clause after a colon) from the character or the
 * love-and-work section, chosen by fixed rules so every build picks the
 * same line: a whole, subject-led sentence of a quotable length.
 */
export function birthdayPull(reading: BirthdayReading): string | null {
  const best = pullCandidates(reading, true)[0] ?? pullCandidates(reading, false)[0];
  return best ? smartQuotes(best.text) : null;
}

const GROWTH_LINE = /\bgrowth edge\b|^The growth\b|^The (?:[a-z]+ )?(?:practice|move|fix|work|repair|answer|remedy|corrective|lesson|discipline|counterweight|antidote|version of the fix)\b|^[A-Z][a-z]+ \d{1,2}'s growth edge\b|\bhonest work\b/u;

/** The growth-edge section's own advice: its first sentence that names the work. */
export function birthdayGrowthLine(reading: BirthdayReading): string | null {
  for (const paragraph of reading.sections[2].paragraphs) {
    for (const sentence of sentences(paragraph)) {
      if (GROWTH_LINE.test(sentence) && sentence.length <= 240) return smartQuotes(sentence);
    }
  }
  return null;
}
