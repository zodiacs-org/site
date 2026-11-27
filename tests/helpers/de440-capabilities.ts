import release from '../../docs/platform/evidence/site-engine-3-0-0/de440-receipt-conventions.json';

/** Apply the measured engine identity to an otherwise byte exact capability fixture. */
export function expectedCapabilityReply(text: string): string {
  return text.replace(/^data: (.+)$/m, (_line, body: string) => {
    const payload = JSON.parse(body);
    const { result } = payload;
    function applyEngine(reply: { data: { engine: { version: string; ephemeris: typeof release.ephemeris }; conventions: unknown } }) {
      reply.data.engine = { ...reply.data.engine, version: release.engine, ephemeris: release.ephemeris };
      reply.data.conventions = release.conventions;
      return reply;
    }
    applyEngine(result.structuredContent);
    result.content[0].text = JSON.stringify(applyEngine(JSON.parse(result.content[0].text)));
    return `data: ${JSON.stringify(payload)}`;
  });
}
