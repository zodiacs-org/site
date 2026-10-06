import { ENGINE_VERSION, natalChart } from '@zodiacs/engine';
import { createNatalEnvelope, natalReplayInput, parseNatalEnvelope, serializeNatalEnvelope, NATAL_ENVELOPE_LIMITS, type NatalEnvelopeErrorCode } from '@zodiacs/engine/receipt';
import { compareEnvelopes } from '../../lib/compare/diff';
import { replay } from '../../lib/compare/replay';

export const RECORD_BYTES = NATAL_ENVELOPE_LIMITS.bytes;
const refusals: Record<NatalEnvelopeErrorCode, string> = {
  invalid_json: 'The record is not valid JSON.', invalid_shape: 'Use a Zodiacs natal calculation record, not a chart summary.',
  invalid_value: 'The record contains a value its schema does not allow.', inconsistent_result: 'The record contradicts its own calculation receipt.',
  invalid_context: 'The record contains an invalid context block.', size_limit: 'The record exceeds the 64 KiB limit.',
  complexity_limit: 'The record is too deeply nested or complex.', unsupported_version: 'This record uses an unsupported schema version.',
  unsupported_feature: 'This record requires a feature this inspector does not support.',
};
export function readStudioRecord(text: string) {
  const parsed = parseNatalEnvelope(text);
  if (!parsed.ok) throw new Error(refusals[parsed.code]);
  return parsed.envelope;
}
export function inspectRecords(left: string, right: string) {
  return compareEnvelopes(readStudioRecord(left), readStudioRecord(right), { engineVersion: ENGINE_VERSION, replay });
}
export function reproduceRecord(text: string) {
  const original = readStudioRecord(text);
  if (original.receipt.engine.version !== ENGINE_VERSION) throw new Error(`This record names engine ${original.receipt.engine.version}. This panel has ${ENGINE_VERSION}; it cannot reproduce a different engine version.`);
  try {
    const chart = natalChart(natalReplayInput(original));
    const reproduced = createNatalEnvelope(chart, { reference: original.receipt.reference,
      sourceInstant: original.receipt.sourceInstant, localResolution: original.receipt.localResolution });
    const comparison = compareEnvelopes(original, reproduced);
    // Provenance and extensions are supplied claims, not recalculated output.
    const differences = comparison.differences;
    return { matches: differences.length === 0, differences, record: serializeNatalEnvelope(reproduced), engine: ENGINE_VERSION };
  } catch { throw new Error('This record could not be replayed with the installed engine. Its inputs or conventions may be unsupported.'); }
}
