import type { APIRoute } from 'astro';
import candidate from '../../../data/platform-engine-candidate.json';
import guides from '../../../data/developer-guides.json';
import { engineInstallBlock } from '../../../lib/engine-install-block';

export const prerender = true;
export function getStaticPaths() {
  return [
    { params: { guide: 'index' }, props: { guide: null } },
    ...guides.map((guide) => ({ params: { guide: guide.slug }, props: { guide } })),
  ];
}
export const GET: APIRoute = ({ props }) => {
  const guide = props.guide as typeof guides[number] | null;
  const lines = [
    `# ${guide?.title ?? 'Developer guides'}`,
    '',
    guide?.description ?? 'Version-bound quickstarts, recipes, conventions, errors and receipts.',
    '',
    `Engine ${candidate.version}: ${candidate.releaseLabel}.`,
    'Archive identity and release status: https://zodiacs.org/developers/engine/',
    '',
  ];
  if (guide) {
    for (const section of guide.sections) {
      lines.push(`## ${section.heading}`, '', ...section.paragraphs.flatMap((paragraph) => [paragraph, '']));
      if ('code' in section && section.code) {
        lines.push('~~~' + section.code.language, section.code.source, '~~~', '');
      }
    }
    if (guide.installation) {
      lines.push('## Verify and install the candidate', '', '~~~sh', engineInstallBlock(candidate), '~~~', '');
    }
    lines.push('## References', '', ...guide.links.map((link) => `- [${link.label}](${link.url.startsWith('/') ? 'https://zodiacs.org' + link.url : link.url})`), '');
  } else {
    lines.push(
      'Choose the local engine for on-device or server-local calculation. Hosted recipes send their requests to the Compute API.',
      '',
      ...guides.flatMap((item) => [
        `## ${item.title}`, '', item.description, '',
        `HTML: https://zodiacs.org/developers/docs/${item.slug}/`,
        `Markdown: https://zodiacs.org/developers/docs/${item.slug}.md`, '',
      ]),
      'React Native and complete sunrise-based panchang guides are not yet available.', '',
    );
  }
  return new Response(lines.join('\n'), { headers: { 'Content-Type': 'text/markdown; charset=utf-8' } });
};
