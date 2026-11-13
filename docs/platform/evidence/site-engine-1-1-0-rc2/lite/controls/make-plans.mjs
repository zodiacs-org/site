// Writes the two plans of control 1's showing on its constructed case alone:
// the control's own change (the base's luminary orb written 1.4999) and, as a
// contrast, no change. The case is the tool's CONTROL_ONE_CASE, imported.
import { writeFileSync } from 'node:fs';
const [tool, out] = process.argv.slice(2);
const { CONTROL_ONE_CASE } = await import(tool);
const mutation = { file: 'src/lib/declination.ts', from: 'export const DECLINATION_ORB_LUMINARY = 1.5;', to: 'export const DECLINATION_ORB_LUMINARY = 1.4999;' };
const common = { sections: ['D2-A'], constructedD2A: [CONTROL_ONE_CASE], sharedCharts: false };
writeFileSync(`${out}/plan-control-1-constructed-case.json`, `${JSON.stringify({ control: '1, on its constructed case alone (2026-11-04)', ...common, siteMutations: [mutation] }, null, 2)}\n`);
writeFileSync(`${out}/plan-constructed-case-unchanged.json`, `${JSON.stringify({ control: '1, contrast: its constructed case alone with no change (2026-11-04)', ...common, siteMutations: [] }, null, 2)}\n`);
