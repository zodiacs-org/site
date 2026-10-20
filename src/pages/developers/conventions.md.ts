import type { APIRoute } from 'astro';
import registry from '../../data/conventions/registry.json';

export const prerender = true;

type Source = { title: string; url?: string };

/** The conventions registry's Markdown twin, for agents: every id with its definition, sources and address. */
export const GET: APIRoute = () => {
  const total = registry.namespaces.reduce((sum, space) => sum + space.entries.length, 0);
  const lines = [
    '# Conventions registry',
    '',
    `https://zodiacs.org/developers/conventions/ gives each id a Zodiacs receipt or conformance vector names its definition, its sources and an address on that page. Version ${registry.version}: ${total} ids in ${registry.namespaces.length} namespaces, from @zodiacs/engine ${registry.engine.version} (${registry.engine.repository}, commit ${registry.engine.commit}) and conformance suite ${registry.conformance.suiteVersion}. CC0 1.0.`,
    '',
    `The registry as JSON, each id with its address: https://zodiacs.org/developers/conventions/registry.json (schema ${registry.schema}).`,
    '',
    `${registry.idSyntax} A superseded id is one earlier engine versions wrote and the engine still reads.`,
    '',
  ];
  for (const group of registry.groups) {
    lines.push(`## ${group.title}`, '');
    for (const name of group.namespaces) {
      const space = registry.namespaces.find((candidate) => candidate.name === name)!;
      lines.push(`### ${space.name}: ${space.title}`, '', space.description, '', `Named in: ${space.usedIn.join('; ')}.`, '');
      for (const entry of space.entries as Array<{ id: string; title: string; definition: string; sources: Source[]; status: string; writtenBy?: string }>) {
        lines.push(`- \`${entry.id}\`: ${entry.title}${entry.status === 'superseded' ? ' (superseded)' : ''}. ${entry.definition}${entry.writtenBy ? ` Written by engine ${entry.writtenBy}.` : ''}`);
        lines.push(`  Address: ${registry.base}#${encodeURI(entry.id)}`);
        lines.push(`  Sources: ${entry.sources.map((source) => (source.url ? `${source.title} (${source.url})` : source.title)).join('; ')}`);
      }
      lines.push('');
    }
  }
  return new Response(`${lines.join('\n').trimEnd()}\n`, { headers: { 'Content-Type': 'text/markdown; charset=utf-8' } });
};
