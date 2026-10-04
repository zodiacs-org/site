import { lstat, readdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { findPersonAttribute, findPersonTypes, isText, textChecks } from './check-developer-authorship.mjs';

// The source half of the authorship guard, with the served-documentation scanner's
// detectors: the retired persona, the retired editor anchor, and schema.org Person
// markup, in every file under src/ that is text (binary files are skipped, as
// grep -I skipped them before this script replaced it). It fails closed: a symlink,
// a special file or an unreadable directory is an error, never a skipped path.
//
// One recorded allowance (FINDINGS F-62): the People pilot's page template
// describes its subject, a person who has died, as a schema.org Person that the
// page is `about`. That is the page's subject, not an author or editor. Nothing
// else under src/ may carry Person markup, and that template only once.
export const PERSON_SUBJECT_ALLOWANCE = Object.freeze({ path: 'src/pages/people/[slug].astro', count: 1 });

const lineOf = (content, index) => content.slice(0, index).split('\n').length;

export async function checkSourceAuthorship(repoRoot) {
  const files = [];
  const errors = [];
  async function walk(path) {
    let entries;
    try {
      if (!(await lstat(resolve(repoRoot, path))).isDirectory()) throw new Error('not a directory');
      entries = await readdir(resolve(repoRoot, path), { withFileTypes: true });
    } catch {
      errors.push(`${path}: missing, unreadable or non-regular source directory`);
      return;
    }
    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      const child = `${path}/${entry.name}`;
      if (entry.isSymbolicLink()) errors.push(`${child}: unexpected source symlink`);
      else if (entry.isDirectory()) await walk(child);
      else if (entry.isFile()) files.push(child);
      else errors.push(`${child}: unexpected non-regular source entry`);
    }
  }
  await walk('src');
  for (const path of files) {
    let bytes;
    try {
      bytes = await readFile(resolve(repoRoot, path));
    } catch {
      errors.push(`${path}: cannot read source file`);
      continue;
    }
    if (!isText(bytes)) continue;
    const content = bytes.toString('utf8');
    for (const [label, find] of textChecks) {
      const match = find(content);
      if (match) errors.push(`${path}:${lineOf(content, match.index)}: ${label}`);
    }
    const allowed = path === PERSON_SUBJECT_ALLOWANCE.path ? PERSON_SUBJECT_ALLOWANCE.count : 0;
    for (const match of findPersonTypes(content).slice(allowed)) {
      errors.push(`${path}:${lineOf(content, match.index)}: Person markup`);
    }
    const attribute = findPersonAttribute(content);
    if (attribute) errors.push(`${path}:${lineOf(content, attribute.index)}: Person markup`);
  }
  return { files, errors };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const repoRoot = resolve(process.argv[2] ?? fileURLToPath(new URL('..', import.meta.url)));
  const { files, errors } = await checkSourceAuthorship(repoRoot);
  if (errors.length) {
    console.error(`Source authorship: FAIL\n${errors.join('\n')}`);
    process.exitCode = 1;
  } else {
    console.log(`Source authorship: PASS (${files.length} files under src/)`);
  }
}
