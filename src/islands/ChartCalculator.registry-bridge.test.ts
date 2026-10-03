import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
describe('chart tools remain separate from the token collection', () => {
  it('retains chart readings and actions without promotional collection links or analytics', async () => {
    const source = await readFile(new URL('./ChartCalculator.tsx', import.meta.url), 'utf8');
    expect(source).toContain('<CommunicationRead');
    expect(source).toContain('data-download-calculation-receipt');
    expect(source).not.toMatch(/data-registry-bridge|data-registry-aura-chart-link|registry_bridge_(?:click|impression)|registryAuraChartLink/);
  });
});
