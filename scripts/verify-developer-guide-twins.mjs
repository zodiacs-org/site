import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = process.cwd();
const guides = JSON.parse(await readFile(resolve(root, 'src/data/developer-guides.json'), 'utf8'));
const candidate = JSON.parse(await readFile(resolve(root, 'src/data/platform-engine-candidate.json'), 'utf8'));
const decode = (text) => text
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
  .replace(/&#(?:39|x27);/gi, "'").replace(/&amp;/g, '&');
assert.equal(guides.length, 18);
assert.equal(new Set(guides.map((guide) => guide.slug)).size, guides.length);
const llms = await Promise.all(['llms.txt', 'llms-full.txt'].map((file) => readFile(resolve(root, 'dist', file), 'utf8')));
const sitemap = await readFile(resolve(root, 'dist/sitemap.xml'), 'utf8');
assert.ok(sitemap.includes('<loc>https://zodiacs.org/developers/docs/</loc>'), 'Missing guide index sitemap URL');
const checked = [];
for (const guide of guides) {
  assert.match(guide.slug, /^[a-z][a-z0-9-]*$/);
  assert.ok(sitemap.includes('<loc>https://zodiacs.org/developers/docs/' + guide.slug + '/</loc>'), 'Missing guide sitemap URL: ' + guide.slug);
  const htmlPath = 'developers/docs/' + guide.slug + '/index.html';
  const markdownPath = 'developers/docs/' + guide.slug + '.md';
  const html = decode(await readFile(resolve(root, 'dist', htmlPath), 'utf8'));
  const markdown = await readFile(resolve(root, 'dist', markdownPath), 'utf8');
  assert.ok(html.includes('data-developer-guide="' + guide.slug + '"'), htmlPath);
  for (const text of [guide.title, guide.description, ...guide.sections.flatMap((section) => [section.heading, ...section.paragraphs, ...(section.code ? [section.code.source] : [])])]) {
    assert.ok(html.includes(text), 'Missing HTML content: ' + guide.slug);
    assert.ok(markdown.includes(text), 'Missing Markdown content: ' + guide.slug);
  }
  assert.ok(html.includes(candidate.version), 'HTML release identity');
  assert.ok(markdown.includes(candidate.version), 'Markdown release identity');
  if (guide.installation) {
    assert.ok(html.includes(candidate.sha256), 'HTML archive digest');
    assert.ok(markdown.includes(candidate.sha256), 'Markdown archive digest');
  }
  for (const content of llms) {
    assert.ok(content.includes('https://zodiacs.org/developers/docs/' + guide.slug + '/'), 'Missing HTML listing: ' + guide.slug);
    assert.ok(content.includes('https://zodiacs.org/developers/docs/' + guide.slug + '.md'), 'Missing Markdown listing: ' + guide.slug);
  }
  checked.push({ slug: guide.slug, html: htmlPath, markdown: markdownPath, status: 'pass' });
}
const index = await readFile(resolve(root, 'dist/developers/docs/index.html'), 'utf8');
const indexMarkdown = await readFile(resolve(root, 'dist/developers/docs/index.md'), 'utf8');
for (const guide of guides) {
  assert.ok(index.includes('/developers/docs/' + guide.slug + '/'));
  assert.ok(indexMarkdown.includes('/developers/docs/' + guide.slug + '/'));
}
console.log(JSON.stringify({ schema: 'zodiacs.developer-guide-twins.v1', version: candidate.version, checked }, null, 2));
